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
    /// Идентификатор пользователя (инженера по ТБ или администратора), который установил
    /// или обновил дату начала отсчёта.
    /// </summary>
    public string SetByUserId { get; set; } = string.Empty;

    /// <summary>
    /// Имя пользователя, установившего отсчёт (для отображения в UI).
    /// </summary>
    public string SetByUserName { get; set; } = string.Empty;

    /// <summary>
    /// Флаг финализации программы. True, если программа завершена —
    /// успешно (пройден весь целевой период без значимых травм) или прервана
    /// значимой травмой (П1/П2). False, если программа всё ещё активна.
    /// </summary>
    public bool IsFinalized { get; set; }

    /// <summary>
    /// Флаг успешного завершения. True, если программа прошла весь целевой период
    /// без значимых травм. False, если программа была прервана или ещё активна.
    /// </summary>
    public bool IsSuccessfullyCompleted { get; set; }

    /// <summary>
    /// Идентификатор значимой травмы (П1/П2), которая прервала программу.
    /// Null, если программа завершилась успешно или ещё активна.
    /// </summary>
    public Guid? InterruptingInjuryId { get; set; }

    /// <summary>
    /// Дата фактического завершения программы (успешного или с прерыванием) в формате UTC.
    /// Null, если программа ещё активна.
    /// </summary>
    public DateTime? FinalizedAt { get; set; }

    /// <summary>
    /// Вычисляемое свойство: количество дней, «прожитых» программой.
    ///
    /// Для активной программы — это количество дней от старта до сегодня.
    /// Для завершённой успешно — ровно TargetDaysInternal (полный целевой период).
    /// Для прерванной — количество дней от старта до даты прерывающей травмы.
    ///
    /// Не мапится в БД.
    /// </summary>
    public int DaysPassed
    {
        get
        {
            // Для завершённых программ считаем дни до даты фактического завершения.
            if (IsFinalized && FinalizedAt.HasValue)
            {
                return Math.Max(0, (FinalizedAt.Value.Date - StartDate.Date).Days);
            }
            // Для активных — до сегодняшнего дня (UTC).
            return Math.Max(0, (DateTime.UtcNow.Date - StartDate.Date).Days);
        }
    }

    /// <summary>
    /// Вычисляемое свойство: количество дней, оставшихся до завершения целевого периода.
    /// Для завершённых программ всегда 0.
    /// Не мапится в БД.
    /// </summary>
    public int DaysRemaining
    {
        get
        {
            if (IsFinalized) return 0;
            return Math.Max(0, TargetDaysInternal - DaysPassed);
        }
    }

    /// <summary>
    /// Вычисляемое свойство: достигнут ли целевой период (без учёта прерываний).
    /// Используется для автоматического успешного завершения активной программы.
    /// Не мапится в БД.
    /// </summary>
    public bool IsPeriodElapsed =>
        (DateTime.UtcNow.Date - StartDate.Date).Days >= TargetDaysInternal;

    /// <summary>
    /// Вычисляемое свойство: плановая дата завершения периода (startDate + targetDays).
    /// Не мапится в БД.
    /// </summary>
    public DateTime PlannedCompletionDate => StartDate.Date.AddDays(TargetDaysInternal);

    /// <summary>
    /// Вычисляемое свойство: завершена ли программа (успешно или с прерыванием).
    /// Не мапится в БД.
    /// </summary>
    public bool IsCompleted => IsFinalized;

    /// <summary>
    /// Вычисляемое свойство: фактическая дата завершения. Для успешно завершённых программ
    /// равна startDate + targetDays, для прерванных — дате прерывающей травмы, для активных — null.
    /// Не мапится в БД.
    /// </summary>
    public DateTime? CompletedAt =>
        IsFinalized
            ? (IsSuccessfullyCompleted
                ? StartDate.Date.AddDays(TargetDaysInternal)
                : FinalizedAt)
            : null;

    /// <summary>
    /// Коллекция документов (приказы, распоряжения, скан-копии), прикреплённых к данной программе.
    /// Отношение «один ко многим»: одна программа может иметь несколько документов.
    /// При удалении программы все связанные документы удаляются каскадно.
    /// </summary>
    public virtual ICollection<ZeroInjuryDocument> Documents { get; set; } = new List<ZeroInjuryDocument>();
}