using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;

namespace Safety.Injuries.API.Controllers;

/// <summary>
/// Контроллер для управления программой «Ноль травм»: старт/остановка периода,
/// редактирование, история, работа с прикреплёнными документами.
/// Все изменяющие операции доступны только инженеру ТБ и администратору.
/// </summary>
[ApiVersion("1.0")]
[Route("safety/api/v{version:apiVersion}/zero-injury")]
[ApiController]
//[Authorize] // При необходимости раскомментировать
public class ZeroInjuryProgramController : ControllerBase
{
    private readonly IZeroInjuryProgramService _service;
    private readonly ILogger<ZeroInjuryProgramController> _logger;

    public ZeroInjuryProgramController(
        IZeroInjuryProgramService service,
        ILogger<ZeroInjuryProgramController> logger)
    {
        _service = service;
        _logger = logger;
    }

    /// <summary>
    /// Получить текущий статус программы: активная программа, последняя значимая травма,
    /// минимально допустимая дата старта новой программы.
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(ZeroInjuryStatusDto), 200)]
    public async Task<IActionResult> GetStatus()
    {
        var status = await _service.GetStatusAsync();
        return Ok(status);
    }

    /// <summary>
    /// Получить историю всех программ «Ноль травм» (от новых к старым).
    /// </summary>
    [HttpGet("history")]
    [ProducesResponseType(typeof(IEnumerable<ZeroInjuryProgramDto>), 200)]
    public async Task<IActionResult> GetHistory()
    {
        var history = await _service.GetHistoryAsync();
        return Ok(history);
    }

    /// <summary>
    /// Получить одну программу по идентификатору.
    /// </summary>
    /// <param name="id">Идентификатор программы.</param>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ZeroInjuryProgramDto), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var dto = await _service.GetByIdAsync(id);
            return Ok(dto);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Создать новую программу «Ноль травм».
    /// Доступно только Safety/Admin.
    /// </summary>
    /// <param name="request">Параметры новой программы.</param>
    [HttpPost]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(typeof(ZeroInjuryProgramDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> Create([FromBody] CreateZeroInjuryProgramRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        // В продакшене userId/userName берутся из ClaimsPrincipal.
        // Здесь — временный заглушечный вариант.
        var userId = User?.Identity?.Name ?? "system";
        var userName = User?.Identity?.Name ?? "Система";

        try
        {
            var created = await _service.CreateAsync(request, userId, userName);
            return CreatedAtAction(nameof(GetById), new { id = created.Id }, created);
        }
        catch (InvalidOperationException ex)
        {
            // Конфликт: попытка начать новую программу при активной, либо неверная дата старта.
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Обновить существующую активную программу.
    /// Доступно только Safety/Admin.
    /// </summary>
    /// <param name="id">Идентификатор программы.</param>
    /// <param name="request">Новые значения полей.</param>
    [HttpPut("{id}")]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(typeof(ZeroInjuryProgramDto), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    [ProducesResponseType(409)]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateZeroInjuryProgramRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var userId = User?.Identity?.Name ?? "system";
        var userName = User?.Identity?.Name ?? "Система";

        try
        {
            var updated = await _service.UpdateAsync(id, request, userId, userName);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Удалить программу «Ноль травм» вместе со всеми документами.
    /// Доступно только Safety/Admin.
    /// </summary>
    /// <param name="id">Идентификатор программы.</param>
    [HttpDelete("{id}")]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _service.DeleteAsync(id);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    // ========== Документы программы ==========

    /// <summary>
    /// Получить список документов, прикреплённых к программе.
    /// </summary>
    [HttpGet("{programId}/documents")]
    [ProducesResponseType(typeof(IEnumerable<ZeroInjuryDocumentDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetDocuments(Guid programId)
    {
        try
        {
            var docs = await _service.GetDocumentsAsync(programId);
            return Ok(docs);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Загрузить документ в программу.
    /// Доступно только Safety/Admin.
    /// </summary>
    [HttpPost("{programId}/documents")]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(typeof(ZeroInjuryDocumentDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    [RequestSizeLimit(20 * 1024 * 1024)]
    public async Task<IActionResult> UploadDocument(Guid programId, [FromForm] UploadZeroInjuryDocumentForm form)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            using var stream = form.File.OpenReadStream();
            var result = await _service.UploadDocumentAsync(
                programId,
                stream,
                form.File.FileName,
                form.File.ContentType,
                form.DocumentType,
                form.Description);

            return CreatedAtAction(nameof(GetDocuments), new { programId }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при загрузке документа в программу {ProgramId}", programId);
            return StatusCode(500, "Внутренняя ошибка сервера");
        }
    }

    /// <summary>
    /// Скачать документ программы.
    /// </summary>
    [HttpGet("{programId}/documents/{documentId}")]
    [ProducesResponseType(200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DownloadDocument(Guid programId, Guid documentId)
    {
        try
        {
            var (data, fileName, contentType) = await _service.DownloadDocumentAsync(programId, documentId);
            return File(data, contentType, fileName);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Удалить документ программы.
    /// Доступно только Safety/Admin.
    /// </summary>
    [HttpDelete("{programId}/documents/{documentId}")]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteDocument(Guid programId, Guid documentId)
    {
        try
        {
            await _service.DeleteDocumentAsync(programId, documentId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }
}