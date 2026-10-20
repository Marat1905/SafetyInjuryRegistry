using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Infrastructure.Data;
using Safety.Injuries.IntegrationTests.Fixtures;
using Safety.Injuries.IntegrationTests.Helpers;
using Xunit;

namespace Safety.Injuries.IntegrationTests.Repositories;

/// <summary>
/// Интеграционные тесты для токена конкурентности (RowVersion) сущности
/// <see cref="ZeroInjuryProgram"/>. Работают на реальной PostgreSQL.
///
/// Конкурентность программы «Ноль травм» особенно важна: инженер ТБ
/// редактирует активную программу, а параллельно сервис RecalculateAsync
/// может её финализировать по факту травмы. Без токена один из апдейтов
/// молча перезаписал бы другой.
/// </summary>
public class ZeroInjuryProgramRowVersionTests : IClassFixture<TestContainersFixture>
{
    private readonly TestContainersFixture _fixture;

    public ZeroInjuryProgramRowVersionTests(TestContainersFixture fixture)
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

    private static ZeroInjuryProgram CreateSampleProgram(
        DateTime? startDate = null,
        string description = "Тестовая программа «Ноль травм»")
    {
        return new ZeroInjuryProgram
        {
            Id = Guid.NewGuid(),
            StartDate = DateTime.SpecifyKind(
                (startDate ?? DateTime.UtcNow.Date).Date,
                DateTimeKind.Utc),
            Description = description,
            TargetDaysInternal = 365,
            SetByUserId = "test-user",
            SetByUserName = "Тестовый пользователь",
            IsFinalized = false,
            IsSuccessfullyCompleted = false,
            CreatedAt = DateTime.UtcNow,
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
        var entityType = context.Model.FindEntityType(typeof(ZeroInjuryProgram));
        var rowVersionProperty = entityType!.FindProperty(nameof(ZeroInjuryProgram.RowVersion));

        // Assert
        rowVersionProperty.Should().NotBeNull(
            "свойство RowVersion должно присутствовать в модели ZeroInjuryProgram");
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

        var program = CreateSampleProgram();

        // Act
        context.ZeroInjuryPrograms.Add(program);
        await context.SaveChangesAsync();

        // Assert
        program.RowVersion.Should().NotBe(0u,
            "PostgreSQL присваивает xmin сразу после INSERT");
    }

    [Fact]
    public async Task RowVersion_ShouldChangeAfterUpdate()
    {
        // Arrange
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);

        var program = CreateSampleProgram();
        context.ZeroInjuryPrograms.Add(program);
        await context.SaveChangesAsync();
        var originalRowVersion = program.RowVersion;

        // Act
        program.Description = "Изменённое описание";
        await context.SaveChangesAsync();

        // Assert
        program.RowVersion.Should().NotBe(originalRowVersion,
            "PostgreSQL инкрементирует xmin при каждом UPDATE строки");
    }

    // ------------------------------------------------------------------
    // Конфликт при параллельном обновлении
    // ------------------------------------------------------------------

    [Fact]
    public async Task ConcurrentUpdate_WithStaleVersion_ShouldThrowDbUpdateConcurrencyException()
    {
        // Arrange: сеем программу.
        Guid programId;
        await using (var seedContext = CreateContext())
        {
            await CleanDatabaseAsync(seedContext);
            var program = CreateSampleProgram();
            seedContext.ZeroInjuryPrograms.Add(program);
            await seedContext.SaveChangesAsync();
            programId = program.Id;
        }

        // Два независимых контекста.
        await using var contextA = CreateContext();
        await using var contextB = CreateContext();

        var programA = await contextA.ZeroInjuryPrograms.FindAsync(programId);
        var programB = await contextB.ZeroInjuryPrograms.FindAsync(programId);

        programA.Should().NotBeNull();
        programB.Should().NotBeNull();

        // Act
        // A сохраняет изменения (как будто пользователь нажал «Сохранить»).
        programA!.Description = "Отредактировано пользователем A";
        await contextA.SaveChangesAsync();

        // B пытается сохранить свою версию с устаревшим xmin
        // (как будто сервис RecalculateAsync уже финализировал программу
        //  в параллельной сессии).
        programB!.Description = "Отредактировано пользователем B";

        Func<Task> act = async () => await contextB.SaveChangesAsync();

        // Assert
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>(
            "конфликт одновременного редактирования должен быть обнаружен");
    }

    [Fact]
    public async Task ConcurrentUpdate_SameProgramByTwoUsers_SecondSaveThrows()
    {
        // Arrange
        Guid programId;
        await using (var seedContext = CreateContext())
        {
            await CleanDatabaseAsync(seedContext);
            var program = CreateSampleProgram();
            seedContext.ZeroInjuryPrograms.Add(program);
            await seedContext.SaveChangesAsync();
            programId = program.Id;
        }

        // Симулируем сценарий: инженер ТБ редактирует программу, а
        // параллельно сервис авто-финализации (RecalculateAsync) её закрывает.
        await using var engineerContext = CreateContext();
        await using var recalculationContext = CreateContext();

        var engineerProgram = await engineerContext.ZeroInjuryPrograms.FindAsync(programId);
        var recalculationProgram = await recalculationContext.ZeroInjuryPrograms.FindAsync(programId);

        // Сервис финализирует программу первым.
        recalculationProgram!.IsFinalized = true;
        recalculationProgram.IsSuccessfullyCompleted = true;
        recalculationProgram.FinalizedAt = recalculationProgram.StartDate.AddDays(365);
        await recalculationContext.SaveChangesAsync();

        // Инженер пытается сохранить редактирование, не зная о финализации.
        engineerProgram!.Description = "Инженер изменил описание";

        Func<Task> act = async () => await engineerContext.SaveChangesAsync();

        // Assert
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>(
            "сохранение устаревшей версии не должно затирать авто-финализацию");
    }

    [Fact]
    public async Task ConcurrentDelete_WithStaleVersion_ShouldThrowDbUpdateConcurrencyException()
    {
        // Arrange
        Guid programId;
        await using (var seedContext = CreateContext())
        {
            await CleanDatabaseAsync(seedContext);
            var program = CreateSampleProgram();
            seedContext.ZeroInjuryPrograms.Add(program);
            await seedContext.SaveChangesAsync();
            programId = program.Id;
        }

        await using var contextA = CreateContext();
        await using var contextB = CreateContext();

        var programA = await contextA.ZeroInjuryPrograms.FindAsync(programId);
        var programB = await contextB.ZeroInjuryPrograms.FindAsync(programId);

        // A обновляет.
        programA!.Description = "Изменено перед удалением";
        await contextA.SaveChangesAsync();

        // Act
        // B пытается удалить устаревшую версию.
        contextB.ZeroInjuryPrograms.Remove(programB!);
        Func<Task> act = async () => await contextB.SaveChangesAsync();

        // Assert
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();
    }

    // ------------------------------------------------------------------
    // Восстановление после конфликта
    // ------------------------------------------------------------------

    [Fact]
    public async Task ReloadAfterConflict_ShouldSucceedAndPickUpNewRowVersion()
    {
        // Arrange
        Guid programId;
        await using (var seedContext = CreateContext())
        {
            await CleanDatabaseAsync(seedContext);
            var program = CreateSampleProgram();
            seedContext.ZeroInjuryPrograms.Add(program);
            await seedContext.SaveChangesAsync();
            programId = program.Id;
        }

        await using var contextA = CreateContext();
        await using var contextB = CreateContext();

        var programA = await contextA.ZeroInjuryPrograms.FindAsync(programId);
        var programB = await contextB.ZeroInjuryPrograms.FindAsync(programId);

        programA!.Description = "Победитель";
        await contextA.SaveChangesAsync();

        programB!.Description = "Проигравший";
        Func<Task> act = async () => await contextB.SaveChangesAsync();
        await act.Should().ThrowAsync<DbUpdateConcurrencyException>();

        // Act
        await contextB.Entry(programB).ReloadAsync();
        programB.Description = "Проигравший, но перезагруженный";

        Func<Task> act2 = async () => await contextB.SaveChangesAsync();

        // Assert
        await act2.Should().NotThrowAsync(
            "после ReloadAsync контекст B подхватывает актуальный xmin");
    }

    [Fact]
    public async Task SequentialUpdate_InSameContext_ShouldNotThrow()
    {
        // Arrange
        await using var context = CreateContext();
        await CleanDatabaseAsync(context);

        var program = CreateSampleProgram();
        context.ZeroInjuryPrograms.Add(program);
        await context.SaveChangesAsync();

        // Act
        program.Description = "Первое изменение";
        await context.SaveChangesAsync();

        program.Description = "Второе изменение";
        await context.SaveChangesAsync();

        program.Description = "Третье изменение";
        Func<Task> act = async () => await context.SaveChangesAsync();

        // Assert
        await act.Should().NotThrowAsync();
    }
}