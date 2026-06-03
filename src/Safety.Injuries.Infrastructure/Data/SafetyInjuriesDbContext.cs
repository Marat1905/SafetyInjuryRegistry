using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Infrastructure.Configurations;


namespace Safety.Injuries.Infrastructure.Data;

public class SafetyInjuriesDbContext : DbContext
{
    public SafetyInjuriesDbContext(DbContextOptions<SafetyInjuriesDbContext> options)
        : base(options)
    {
    }

    public DbSet<Injury> Injuries { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfiguration(new InjuryConfiguration());

        // Конфигурация для автоматического преобразования DateTime в UTC
        ConfigureDateTimeProperties(modelBuilder);

        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        UpdateTimestamps();
        return await base.SaveChangesAsync(cancellationToken);
    }

    public override int SaveChanges()
    {
        UpdateTimestamps();
        return base.SaveChanges();
    }

    private void UpdateTimestamps()
    {
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
