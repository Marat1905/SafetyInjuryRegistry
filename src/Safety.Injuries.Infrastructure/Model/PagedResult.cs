namespace Safety.Injuries.Infrastructure.Model;

/// <summary>
/// Представляет результат запроса с пагинацией (постраничным разделением).
/// Содержит элементы текущей страницы и метаданные для навигации.
/// </summary>
/// <typeparam name="T">Тип элементов, составляющих страницу.</typeparam>
/// <remarks>
/// Используется для возврата больших наборов данных с разбивкой на страницы,
/// чтобы уменьшить нагрузку на сеть и клиентскую часть.
/// </remarks>
public class PagedResult<T>
{
    /// <summary>
    /// Коллекция элементов, отображаемых на текущей странице.
    /// </summary>
    public IEnumerable<T> Items { get; set; }

    /// <summary>
    /// Общее количество элементов во всем наборе данных (без учёта пагинации).
    /// </summary>
    public int TotalCount { get; set; }

    /// <summary>
    /// Номер текущей страницы (начиная с 1).
    /// </summary>
    public int PageNumber { get; set; }

    /// <summary>
    /// Количество элементов на одной странице.
    /// </summary>
    public int PageSize { get; set; }

    /// <summary>
    /// Общее количество страниц, рассчитанное на основе <see cref="TotalCount"/> и <see cref="PageSize"/>.
    /// </summary>
    public int TotalPages { get; set; }
}