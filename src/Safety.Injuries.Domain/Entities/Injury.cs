using Safety.Injuries.Domain.Enums;

namespace Safety.Injuries.Domain.Entities;

/// <summary>
/// Запись о травме или происшествии на производстве.
/// Содержит информацию о дате, типе, описании, категории (П1–П6)
/// и список прикреплённых файлов (документы, фото и т.п.).
/// </summary>
public class Injury : BaseEntity
{
    /// <summary>
    /// Дата происшествия в формате UTC (только дата, время игнорируется).
    /// </summary>
    public DateTime Date { get; set; }

    /// <summary>
    /// Тип травмы (например, "Перелом", "Ушиб", "Ожог").
    /// </summary>
    public string Type { get; set; } = string.Empty;

    /// <summary>
    /// Подробное описание обстоятельств и последствий травмы.
    /// </summary>
    public string Description { get; set; } = string.Empty;

    /// <summary>
    /// Категория происшествия в соответствии с внутренней классификацией (П1–П6).
    /// </summary>
    /// <remarks>
    /// <list type="bullet">
    /// <item><description><see cref="InjuryCategory.Fatality"/> (П1) – смертельный случай или стойкая утрата трудоспособности</description></item>
    /// <item><description><see cref="InjuryCategory.LostWorkdayCase"/> (П2) – травма с временной утратой трудоспособности</description></item>
    /// <item><description><see cref="InjuryCategory.FirstAidCase"/> (П3) – микротравма, потребовавшая только первой помощи</description></item>
    /// <item><description><see cref="InjuryCategory.AccidentOrNearMiss"/> (П4) – событие с высоким риском, но без травм</description></item>
    /// <item><description><see cref="InjuryCategory.PreventedIncident"/> (П5) – предотвращённое происшествие</description></item>
    /// <item><description><see cref="InjuryCategory.ThirdPartyInjury"/> (П6) – травма стороннего лица (подрядчик, посетитель)</description></item>
    /// </list>
    /// </remarks>
    public InjuryCategory Category { get; set; }

    /// <summary>
    /// Коллекция файлов, прикреплённых к данной травме.
    /// Отношение «один ко многим»: одна травма может иметь несколько файлов.
    /// При удалении травмы все связанные файлы удаляются каскадно.
    /// </summary>
    public virtual ICollection<InjuryFile> Files { get; set; } = new List<InjuryFile>();
}