using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Infrastructure.Data;

namespace Safety.Injuries.IntegrationTests.Helpers;

/// <summary>
/// Утилита для полной очистки тестовой базы данных между интеграционными тестами.
///
/// Удаление идёт в порядке от дочерних таблиц к родительским, чтобы не нарушать
/// внешние ключи. Используется <see cref="RelationalQueryableExtensions.ExecuteDeleteAsync{TEntity}"/>,
/// который выполняет DELETE напрямую в БД без загрузки сущностей в память — это быстрее
/// и надёжнее, чем RemoveRange.
/// </summary>
public static class DatabaseCleaner
{
    /// <summary>
    /// Полностью очищает все таблицы домена. После очистки все отслеживаемые
    /// сущности открепляются от контекста, чтобы избежать «призрачных» SaveChanges.
    ///
    /// Порядок удаления:
    /// <list type="number">
    /// <item><description><c>ZeroInjuryDocuments</c> — дочерняя к <c>ZeroInjuryPrograms</c> (Cascade);</description></item>
    /// <item><description><c>ZeroInjuryPrograms</c> — ссылается на <c>Injuries</c> через TriggeringInjuryId (SetNull), но FK всё равно требует удалять программы раньше травм;</description></item>
    /// <item><description><c>InjuryFiles</c> — дочерняя к <c>Injuries</c> (Cascade);</description></item>
    /// <item><description><c>Injuries</c> — корневая таблица.</description></item>
    /// </list>
    /// </summary>
    /// <param name="context">Контекст базы данных.</param>
    public static async Task CleanDatabaseAsync(SafetyInjuriesDbContext context)
    {
        // 1) Документы программ «Ноль травм» — дочерняя таблица ZeroInjuryPrograms.
        await context.Set<ZeroInjuryDocument>().ExecuteDeleteAsync();

        // 2) Программы «Ноль травм» — ссылаются на Injuries через TriggeringInjuryId.
        //    Даже несмотря на DeleteBehavior.SetNull, удаляем до травм,
        //    чтобы не срабатывали side-эффекты FK.
        await context.Set<ZeroInjuryProgram>().ExecuteDeleteAsync();

        // 3) Файлы травм — дочерняя таблица Injuries.
        await context.InjuryFiles.ExecuteDeleteAsync();

        // 4) Травмы — корневая таблица.
        await context.Injuries.ExecuteDeleteAsync();

        // Отсоединяем все отслеживаемые сущности, чтобы следующий тест
        // начинал с чистого ChangeTracker.
        foreach (var entry in context.ChangeTracker.Entries())
        {
            entry.State = EntityState.Detached;
        }
    }
}