namespace Safety.Injuries.Domain.Entities;

/// <summary>
/// Абстрактный базовый класс для всех сущностей домена.
/// Содержит общие свойства: идентификатор и временные метки создания/обновления.
/// </summary>
public abstract class BaseEntity
{
    /// <summary>
    /// Уникальный идентификатор сущности (UUID v4).
    /// Генерируется при создании объекта.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Дата и время создания записи в формате UTC.
    /// Устанавливается автоматически при добавлении сущности в контекст БД.
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Дата и время последнего обновления записи в формате UTC.
    /// Устанавливается автоматически при каждом сохранении изменений.
    /// Может быть null, если запись никогда не обновлялась.
    /// </summary>
    public DateTime? UpdatedAt { get; set; }
}