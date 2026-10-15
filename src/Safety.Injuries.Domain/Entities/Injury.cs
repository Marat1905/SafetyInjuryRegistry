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
    /// Токен конкурентности (concurrency token) на основе системной колонки
    /// PostgreSQL <c>xmin</c>. Значение автоматически изменяется PostgreSQL
    /// при каждом <c>UPDATE</c> строки, а EF Core:
    /// <list type="bullet">
    /// <item><description>читает его при <c>SELECT</c> и сохраняет в этом свойстве;</description></item>
    /// <item><description>добавляет условие <c>WHERE xmin = @original</c> в <c>UPDATE</c> и <c>DELETE</c>;</description></item>
    /// <item><description>выбрасывает <see cref="Microsoft.EntityFrameworkCore.DbUpdateConcurrencyException"/>,
    /// если между чтением и записью строку успел изменить другой пользователь.</description></item>
    /// </list>
    ///
    /// В отличие от SQL Server, где аналог обычно имеет тип <c>byte[]</c>,
    /// в PostgreSQL системный столбец <c>xmin</c> — это 32-битное беззнаковое
    /// целое (<see cref="uint"/>). Соответствующим образом настроено в
    /// <see cref="Infrastructure.Configurations.InjuryConfiguration"/>.
    ///
    /// Значение свойства обновляется только хранилищем (после <c>INSERT</c>
    /// и <c>UPDATE</c>), вручную его присваивать не нужно. Отдавать его в API
    /// клиенту также не требуется: в текущей архитектуре чтение и запись
    /// происходят в рамках одной HTTP-сессии, и EF Core сам сравнивает
    /// «прочитанный» xmin с текущим при сохранении.
    /// </summary>
    public uint RowVersion { get; set; }

    /// <summary>
    /// Коллекция файлов, прикреплённых к данной травме.
    /// Отношение «один ко многим»: одна травма может иметь несколько файлов.
    /// При удалении травмы все связанные файлы удаляются каскадно.
    /// </summary>
    public virtual ICollection<InjuryFile> Files { get; set; } = new List<InjuryFile>();
}