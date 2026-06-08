using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;

namespace Safety.Injuries.API.Controllers;

/// <summary>
/// Контроллер для управления записями о травмах
/// </summary>
[Route("api/safety/[controller]")]
[ApiController]
//[Authorize]
public class InjuriesController : ControllerBase
{
    private readonly IInjuryService _injuryService;

    public InjuriesController(IInjuryService injuryService)
    {
        _injuryService = injuryService;
    }

    /// <summary>
    /// Получить список травм за указанный месяц
    /// </summary>
    /// <param name="year">Год (например, 2026)</param>
    /// <param name="month">Месяц (от 1 до 12)</param>
    /// <returns>Список травм за месяц</returns>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<InjuryDto>), 200)]
    public async Task<IActionResult> GetByMonth([FromQuery] int year, [FromQuery] int month)
    {
        var injuries = await _injuryService.GetByMonthAsync(year, month);
        return Ok(injuries);
    }

    /// <summary>
    /// Получить список травм за указанный год
    /// </summary>
    /// <param name="year">Год (например, 2026)</param>
    /// <returns>Список травм за год</returns>
    [HttpGet("year/{year}")]
    [ProducesResponseType(typeof(IEnumerable<InjuryDto>), 200)]
    public async Task<IActionResult> GetByYear(int year)
    {
        var injuries = await _injuryService.GetByYearAsync(year);
        return Ok(injuries);
    }

    /// <summary>
    /// Получить самую последнюю травму (по дате происшествия)
    /// </summary>
    /// <returns>Данные последней травмы или 404, если травм нет</returns>
    [HttpGet("latest")]
    [ProducesResponseType(typeof(InjuryDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetLatest()
    {
        var injury = await _injuryService.GetLatestAsync();
        if (injury == null)
            return NotFound("Травмы не найдены");
        return Ok(injury);
    }

    /// <summary>
    /// Получить последнюю значимую травму (категории П1 или П2)
    /// Используется для сброса счётчика дней без происшествий
    /// </summary>
    /// <returns>Данные последней значимой травмы или 404, если такой нет</returns>
    [HttpGet("latest/significant")]
    [ProducesResponseType(typeof(InjuryDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetLatestSignificant()
    {
        var injury = await _injuryService.GetLatestSignificantAsync();
        if (injury == null)
            return NotFound("Нет травм категорий П1 или П2");
        return Ok(injury);
    }

    /// <summary>
    /// Создать новую запись о травме
    /// </summary>
    /// <param name="request">Данные для создания травмы</param>
    /// <returns>Созданная травма с HTTP-статусом 201 (Created)</returns>
    [HttpPost]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(typeof(InjuryDto), 201)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Create([FromBody] CreateInjuryRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var created = await _injuryService.CreateAsync(request);
        return CreatedAtAction(nameof(GetByMonth), new { year = DateTime.Parse(created.Date).Year, month = DateTime.Parse(created.Date).Month }, created);
    }

    /// <summary>
    /// Обновить существующую запись о травме
    /// </summary>
    /// <param name="id">Идентификатор травмы</param>
    /// <param name="request">Данные для обновления (все поля опциональны)</param>
    /// <returns>Обновлённая травма</returns>
    [HttpPut("{id}")]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(typeof(InjuryDto), 200)]
    [ProducesResponseType(404)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInjuryRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            var updated = await _injuryService.UpdateAsync(id, request);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Удалить запись о травме
    /// </summary>
    /// <param name="id">Идентификатор травмы</param>
    /// <returns>HTTP 204 No Content при успешном удалении</returns>
    [HttpDelete("{id}")]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _injuryService.DeleteAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }
}