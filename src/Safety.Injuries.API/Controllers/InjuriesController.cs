using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;

namespace Safety.Injuries.API.Controllers;

[Route("api/safety/[controller]")]
[ApiController]
//[Authorize] // Требуется аутентификация для всех методов
public class InjuriesController : ControllerBase
{
    private readonly IInjuryService _injuryService;

    public InjuriesController(IInjuryService injuryService)
    {
        _injuryService = injuryService;
    }

    /// <summary>Получить травмы за указанный месяц</summary>
    /// <param name="year">Год</param>
    /// <param name="month">Месяц (1-12)</param>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<InjuryDto>), 200)]
    public async Task<IActionResult> GetByMonth([FromQuery] int year, [FromQuery] int month)
    {
        var injuries = await _injuryService.GetByMonthAsync(year, month);
        return Ok(injuries);
    }

    /// <summary>Получить травмы за указанный год</summary>
    /// <param name="year">Год</param>
    [HttpGet("year/{year}")]
    [ProducesResponseType(typeof(IEnumerable<InjuryDto>), 200)]
    public async Task<IActionResult> GetByYear(int year)
    {
        var injuries = await _injuryService.GetByYearAsync(year);
        return Ok(injuries);
    }

    /// <summary>Получить самую последнюю травму</summary>
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

    /// <summary>Создать новую запись о травме (доступно только Safety/Admin)</summary>
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

    /// <summary>Обновить существующую травму (доступно только Safety/Admin)</summary>
    /// <param name="id">Идентификатор травмы</param>
    /// <param name="request">Данные для обновления</param>
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

    /// <summary>Удалить травму (доступно только Safety/Admin)</summary>
    /// <param name="id">Идентификатор травмы</param>
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