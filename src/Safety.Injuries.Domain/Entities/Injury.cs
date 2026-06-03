namespace Safety.Injuries.Domain.Entities;

/// <summary>Травма </summary>
public class Injury : BaseEntity
    {
        public DateTime Date { get; set; }
        public string Type { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        // Новая навигационная коллекция для файлов
        public virtual ICollection<InjuryFile> Files { get; set; } = new List<InjuryFile>();
    }