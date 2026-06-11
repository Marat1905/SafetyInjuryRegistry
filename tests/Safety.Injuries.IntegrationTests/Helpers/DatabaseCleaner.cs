using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Infrastructure.Data;

namespace Safety.Injuries.IntegrationTests.Helpers;

public static class DatabaseCleaner
{
    public static async Task CleanDatabaseAsync(SafetyInjuriesDbContext context)
    {
        // Удаляем все данные (сначала дочерние таблицы)
        await context.InjuryFiles.ExecuteDeleteAsync();
        await context.Injuries.ExecuteDeleteAsync();

        // Отсоединяем все отслеживаемые сущности
        foreach (var entry in context.ChangeTracker.Entries())
        {
            entry.State = EntityState.Detached;
        }
    }
}