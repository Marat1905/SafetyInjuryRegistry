using Safety.Injuries.Domain.Enums;

namespace Safety.Injuries.Domain.Entities;

/// <summary>Травма </summary>
public class Injury : BaseEntity
{
    public DateTime Date { get; set; }
    public string Type { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;

    /// <summary>Категория происшествия (П1–П6)</summary>
    public InjuryCategory Category { get; set; }

    // Новая навигационная коллекция для файлов
    public virtual ICollection<InjuryFile> Files { get; set; } = new List<InjuryFile>();
}