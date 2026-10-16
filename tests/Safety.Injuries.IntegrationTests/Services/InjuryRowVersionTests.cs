using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.Infrastructure.Data;
using Safety.Injuries.IntegrationTests.Fixtures;
using Safety.Injuries.IntegrationTests.Helpers;
using Xunit;

namespace Safety.Injuries.IntegrationTests.Repositories;

/// <summary>
/// Интеграционные тесты для токена конкурентности (RowVersion) сущности
/// <see cref="Injury"/>. Работают на реальной PostgreSQL, поднятой в контейнере
/// через <see cref="TestContainersFixture"/>.
///
/// Проверяется:
/// <list type="bullet">
/// <item><description>корректный маппинг свойства RowVersion на системный столбец xmin;</description></item>
/// <item><description>заполнение RowVersion после INSERT;</description></item>
/// <item><description>изменение RowVersion после UPDATE;</description></item>
/// <item><description>обнаружение конфликта при одновременном обновлении разными контекстами;</description></item>
/// <item><description>обнаружение конфликта при одновременном удалении;</description></item>
/// <item><description>возможность восстановиться после конфликта через ReloadAsync;</description></item>
/// <item><description>отсутствие ложных конфликтов при последовательных изменениях в одном контексте.</description></item>
/// </list>
/// </summary>
public class InjuryRowVersionTests : IClassFixture<TestContainersFixture>
{
    private readonly TestContainersFixture _fixture;

    public InjuryRowVersionTests(TestContainersFixture fixture)
    {
        _fixture = fixture;
    }

    private SafetyInjuriesDbContext CreateContext()
    {
        var options = new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
            .UseNpgsql(_fixture.ConnectionString)
            .Options;
        return new SafetyInjuriesDbContext(options);
    }

    private static async Task CleanDatabaseAsync(SafetyInjuriesDbContext context)
    {
        await DatabaseCleaner.CleanDatabaseAsync(context);
    }

    private static Injury CreateSampleInjury(string type = "Test injury")
    {
        return new Injury
        {
            Id = Guid.NewGuid(),
            Date = DateTime.SpecifyKind(DateTime.UtcNow.Date, DateTimeKind.Utc),
            Type = type,
            Description = "Описание для интеграционного теста",
            Category = InjuryCategory.FirstAidCase
        };
    }

    // ------------------------------------------------------------------
    // Модель
    // ------------------------------------------------------------------

    [Fact]
    public void Model_ShouldMapRowVersionToXminColumn()
    {
        // Arrange
        using var context = CreateContext();

        // Act
        var entityType = context.Model.FindEntityType(typeof(Injury));
        var rowVersionProperty = entityType!.FindProperty(nameof(Injury.RowVersion));

        // Assert
        rowVersionProperty.Should().NotBeNull(
            "свойство RowVersion должно присутствовать в модели Injury");
        rowVersionProperty!.GetColumnName().Should().Be("xmin",
            "в PostgreSQL используется системный столбец xmin");
        rowVersionProperty.IsConcurrencyToken.Should().BeTrue(
            "RowVersion должен быть помечен как concurrency token");
        rowVersionProperty.ValueGenerated.Should().Be(
            Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.OnAddOrUpdate,
            "значение xmin управляется хранилищем");
    }

    // ------------------------------------------------------------------
    // Заполнение RowVersion
    // ------------------------------------------------------------------

    [Fact]
    public async Task RowVersion_ShouldBePopulatedAfterInsert()
    {
        // Arrange
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);

        var injury = CreateSampleInjury();

        // Act
        context.Injuries.Add(injury);
        await context.SaveChangesAsync();

        // Assert
        injury.RowVersion.Should().NotBe(0u,
            "PostgreSQL присваивает xmin сразу после INSERT, а EF Core подхватывает его в RowVersion");
    }

    [Fact]
    public async Task RowVersion_ShouldChangeAfterUpdate()
    {
        // Arrange
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);

        var injury = CreateSampleInjury();
        context.Injuries.Add(injury);
        await context.SaveChangesAsync();

        var originalRowVersion = injury.RowVersion;

        // Act
        injury.Type = "Изменённый тип";
        await context.SaveChangesAsync();

        // Assert
        injury.RowVersion.Should().NotBe(originalRowVersion,
            "PostgreSQL инкрементирует xmin при каждом UPDATE строки");
    }

    // ------------------------------------------------------------------
    // Конфликт при параллельном обновлении
    // ------------------------------------------------------------------

    [Fact]
    public async Task ConcurrentUpdate_WithStaleVersion_ShouldThrowDbUpdateConcurrencyException()
    {
        // Arrange: сеем исходную запись.
        Guid injuryId;
        await using (var seedContext = CreateContext())
        {
            await CleanDatabaseAsync(seedContext);
            var injury = CreateSampleInjury();
            seedContext.Injuries.Add(injury);
            await seedContext.SaveChangesAsync();
            injuryId = injury.Id;
        }

        // Два независимых контекста читают одну и ту же запись.
        await using var contextA = CreateContext();
        await using var contextB = CreateContext();

        var injuryA = await contextA.Injuries.FindAsync(injuryId);
        var injuryB = await contextB.Injuries.FindAsync(injuryId);

        injuryA.Should().NotBeNull();
        injuryB.Should().NotBeNull();

        // Act
        // Контекст A сохраняет первым.
        injuryA!.Type = "Изменено пользователем A";
        await contextA.SaveChangesAsync();

        // Контекст B пытается сохранить с устаревшим xmin.
        injuryB!.Type = "Изменено пользователем B";

        Func<Task> act = async () => await contextB.SaveChangesAsync();

        // Assert
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>(
            "xmin в БД уже изменился — EF Core должен обнаружить конфликт");
    }

    [Fact]
    public async Task ConcurrentDelete_WithStaleVersion_ShouldThrowDbUpdateConcurrencyException()
    {
        // Arrange
        Guid injuryId;
        await using (var seedContext = CreateContext())
        {
            await CleanDatabaseAsync(seedContext);
            var injury = CreateSampleInjury();
            seedContext.Injuries.Add(injury);
            await seedContext.SaveChangesAsync();
            injuryId = injury.Id;
        }

        await using var contextA = CreateContext();
        await using var contextB = CreateContext();

        var injuryA = await contextA.Injuries.FindAsync(injuryId);
        var injuryB = await contextB.Injuries.FindAsync(injuryId);

        // Контекст A обновляет запись.
        injuryA!.Description = "Изменено перед удалением";
        await contextA.SaveChangesAsync();

        // Act
        // Контекст B пытается удалить устаревшую версию.
        contextB.Injuries.Remove(injuryB!);
        Func<Task> act = async () => await contextB.SaveChangesAsync();

        // Assert
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>(
            "конфликт обнаруживается и при DELETE — EF добавляет условие WHERE xmin = @original");
    }

    // ------------------------------------------------------------------
    // Восстановление после конфликта
    // ------------------------------------------------------------------

    [Fact]
    public async Task ReloadAfterConflict_ShouldSucceedAndPickUpNewRowVersion()
    {
        // Arrange
        Guid injuryId;
        await using (var seedContext = CreateContext())
        {
            await CleanDatabaseAsync(seedContext);
            var injury = CreateSampleInjury();
            seedContext.Injuries.Add(injury);
            await seedContext.SaveChangesAsync();
            injuryId = injury.Id;
        }

        await using var contextA = CreateContext();
        await using var contextB = CreateContext();

        var injuryA = await contextA.Injuries.FindAsync(injuryId);
        var injuryB = await contextB.Injuries.FindAsync(injuryId);

        // A побеждает.
        injuryA!.Type = "Победитель";
        await contextA.SaveChangesAsync();

        // B получает конфликт.
        injuryB!.Type = "Проигравший";
        Func<Task> act = async () => await contextB.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();

        // Act
        // B перечитывает запись — подхватывает актуальный xmin.
        await contextB.Entry(injuryB).ReloadAsync();
        injuryB.Type = "Проигравший, но перезагруженный";

        Func<Task> act2 = async () => await contextB.SaveChangesAsync();

        // Assert
        await act2.Should().NotThrowAsync(
            "после ReloadAsync контекст B знает актуальный xmin и может сохранить изменения");
    }

    [Fact]
    public async Task SequentialUpdate_InSameContext_ShouldNotThrow()
    {
        // Arrange
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);

        var injury = CreateSampleInjury();
        context.Injuries.Add(injury);
        await context.SaveChangesAsync();

        // Act
        injury.Type = "Первый апдейт";
        await context.SaveChangesAsync();

        injury.Type = "Второй апдейт";
        await context.SaveChangesAsync();

        injury.Type = "Третий апдейт";
        Func<Task> act = async () => await context.SaveChangesAsync();

        // Assert
        await act.Should().NotThrowAsync(
            "последовательные апдейты одной и той же сущности в одном контексте — не конфликт");
    }
}