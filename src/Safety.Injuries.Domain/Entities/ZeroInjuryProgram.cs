namespace Safety.Injuries.Domain.Entities;

/// <summary>
/// Сущность программы «Ноль травм» (365 дней без травм).
/// Хранит информацию о текущем периоде без значимых травм (П1/П2),
/// дату начала отсчёта, связанную травму-триггер и прикреплённые документы (приказы, распоряжения и т.п.).
/// </summary>
public class ZeroInjuryProgram : BaseEntity
{
    /// <summary>
    /// Дата начала периода «365 дней без травм» в формате UTC (только дата, время игнорируется).
    /// Не может быть раньше даты последней значимой травмы (П1 или П2).
    /// Устанавливается инженером по ТБ или администратором.
    /// </summary>
    public DateTime StartDate { get; set; }

    /// <summary>
    /// Идентификатор значимой травмы (П1 или П2), которая инициировала сброс счётчика.
    /// Может быть null, если программа запущена вручную без привязки к конкретной травме
    /// (например, при первом запуске или после успешного завершения 365-дневного периода).
    /// </summary>
    public Guid? TriggeringInjuryId { get; set; }

    /// <summary>
    /// Навигационное свойство к сущности Injury, которая вызвала сброс счётчика.
    /// </summary>
    public virtual Injury? TriggeringInjury { get; set; }

    /// <summary>
    /// Описание программы / комментарий (например, ссылка на приказ, номер распоряжения).
    /// Максимальная длина – 1000 символов.
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Целевое количество дней периода (обычно 365).
    /// Внутреннее поле; в DTO экспортируется как TargetDays.
    /// </summary>
    public int TargetDaysInternal { get; set; } = 365;

    /// <summary>
    /// Флаг завершения 365-дневного периода. Вычисляется автоматически на основе StartDate и TargetDaysInternal.
    /// Примечание: окончательное значение с учётом прерываний корректируется на уровне сервиса (DTO).
    /// </summary>
    public bool IsCompleted => (DateTime.UtcNow.Date - StartDate.Date).Days >= TargetDaysInternal;

    /// <summary>
    /// Дата фактического завершения периода. Вычисляется автоматически.
    /// Null, если период ещё не завершён (или был прерван, что обрабатывается в DTO).
    /// </summary>
    public DateTime? CompletedAt => IsCompleted ? StartDate.AddDays(TargetDaysInternal) : null;

    /// <summary>
    /// Идентификатор пользователя (инженера по ТБ или администратора), который установил
    /// или обновил дату начала отсчёта.
    /// </summary>
    public string SetByUserId { get; set; } = string.Empty;

    /// <summary>
    /// Имя пользователя, установившего отсчёт (для отображения в UI).
    /// </summary>
    public string SetByUserName { get; set; } = string.Empty;

    /// <summary>
    /// Коллекция документов (приказы, распоряжения, скан-копии), прикреплённых к данной программе.
    /// Отношение «один ко многим»: одна программа может иметь несколько документов.
    /// При удалении программы все связанные документы удаляются каскадно.
    /// </summary>
    public virtual ICollection<ZeroInjuryDocument> Documents { get; set; } = new List<ZeroInjuryDocument>();
}