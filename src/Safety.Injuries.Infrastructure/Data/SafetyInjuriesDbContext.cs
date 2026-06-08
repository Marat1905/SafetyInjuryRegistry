using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Infrastructure.Configurations;

namespace Safety.Injuries.Infrastructure.Data;

/// <summary>
/// Контекст базы данных для работы с травмами и связанными файлами.
/// Использует PostgreSQL, автоматически преобразует DateTime в UTC и управляет временными метками.
/// </summary>
/// <remarks>
/// <para>Особенности:</para>
/// <list type="bullet">
/// <item><description>Автоматическая установка <see cref="BaseEntity.CreatedAt"/> и <see cref="BaseEntity.UpdatedAt"/> при сохранении.</description></item>
/// <item><description>Приведение всех DateTime значений к UTC (Kind = Utc).</description></item>
/// <item><description>Использование типа столбца "timestamp with time zone" для DateTime свойств.</description></item>
/// <item><description>Настройки таблиц заданы через <see cref="InjuryConfiguration"/> и <see cref="InjuryFileConfiguration"/>.</description></item>
/// </list>
/// </remarks>
public class SafetyInjuriesDbContext : DbContext
{
    /// <summary>
    /// Инициализирует новый экземпляр контекста базы данных.
    /// </summary>
    /// <param name="options">Параметры подключения и конфигурации EF Core.</param>
    public SafetyInjuriesDbContext(DbContextOptions<SafetyInjuriesDbContext> options)
        : base(options)
    {
    }

    /// <summary>
    /// Набор сущностей травм.
    /// </summary>
    public DbSet<Injury> Injuries { get; set; }

    /// <summary>
    /// Набор сущностей файлов, прикреплённых к травмам.
    /// </summary>
    public DbSet<InjuryFile> InjuryFiles { get; set; }

    /// <summary>
    /// Настраивает модели и отношения между сущностями.
    /// </summary>
    /// <param name="modelBuilder">Построитель модели.</param>
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Применяем конфигурации из отдельных классов
        modelBuilder.ApplyConfiguration(new InjuryConfiguration());
        modelBuilder.ApplyConfiguration(new InjuryFileConfiguration());

        // Конфигурация для автоматического преобразования DateTime в UTC
        ConfigureDateTimeProperties(modelBuilder);

        base.OnModelCreating(modelBuilder);
    }

    /// <summary>
    /// Асинхронно сохраняет изменения, автоматически обновляя временные метки и приводя DateTime к UTC.
    /// </summary>
    /// <param name="cancellationToken">Токен отмены операции.</param>
    /// <returns>Количество записей, затронутых в БД.</returns>
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return await base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Синхронно сохраняет изменения, автоматически обновляя временные метки и приводя DateTime к UTC.
    /// </summary>
    /// <returns>Количество записей, затронутых в БД.</returns>
    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    /// <summary>
    /// Обновляет свойства CreatedAt и UpdatedAt у сущностей, наследующих <see cref="BaseEntity"/>.
    /// Также преобразует все DateTime свойства в UTC (Kind = Utc).
    /// </summary>
    private void UpdateTimestamps()
    {
        // Обработка временных меток для сущностей BaseEntity
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is BaseEntity &&
                (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entityEntry in entries)
        {
            var entity = (BaseEntity)entityEntry.Entity;

            if (entityEntry.State == EntityState.Added)
            {
                entity.CreatedAt = DateTime.UtcNow;
            }

            entity.UpdatedAt = DateTime.UtcNow;
        }

        // Обработка DateTime свойств для преобразования в UTC
        var dateEntries = ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

        foreach (var entityEntry in dateEntries)
        {
            foreach (var property in entityEntry.Properties)
            {
                if (property.Metadata.ClrType == typeof(DateTime) && property.CurrentValue != null)
                {
                    var dateTime = (DateTime)property.CurrentValue;
                    if (dateTime.Kind != DateTimeKind.Utc)
                    {
                        property.CurrentValue = dateTime.Kind == DateTimeKind.Unspecified
                            ? DateTime.SpecifyKind(dateTime, DateTimeKind.Utc)
                            : dateTime.ToUniversalTime();
                    }
                }
                else if (property.Metadata.ClrType == typeof(DateTime?) && property.CurrentValue != null)
                {
                    var dateTime = (DateTime?)property.CurrentValue;
                    if (dateTime.HasValue && dateTime.Value.Kind != DateTimeKind.Utc)
                    {
                        property.CurrentValue = dateTime.Value.Kind == DateTimeKind.Unspecified
                            ? DateTime.SpecifyKind(dateTime.Value, DateTimeKind.Utc)
                            : dateTime.Value.ToUniversalTime();
                    }
                }
            }
        }
    }

    /// <summary>
    /// Настраивает все DateTime свойства в модели на использование типа столбца "timestamp with time zone".
    /// Это обеспечивает корректное хранение UTC времени в PostgreSQL.
    /// </summary>
    /// <param name="modelBuilder">Построитель модели.</param>
    private void ConfigureDateTimeProperties(ModelBuilder modelBuilder)
    {
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                {
                    // Устанавливаем тип столбца как timestamp with time zone
                    property.SetColumnType("timestamp with time zone");
                }
            }
        }
    }
}