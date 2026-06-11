using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;

namespace Safety.Injuries.API.Controllers;

/// <summary>
/// Контроллер для управления файлами, прикрепленными к травмам
/// </summary>
[Route("api/safety/injuries/{injuryId}/files")]
[ApiController]
//[Authorize] // При необходимости раскомментировать
public class InjuryFilesController : ControllerBase
{
    private readonly IInjuryFileService _fileService;
    private readonly ILogger<InjuryFilesController> _logger;

    public InjuryFilesController(IInjuryFileService fileService, ILogger<InjuryFilesController> logger)
    {
        _fileService = fileService;
        _logger = logger;
    }

    /// <summary>
    /// Получить список всех файлов для конкретной травмы
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы</param>
    [HttpGet]
    [ProducesResponseType(typeof(IEnumerable<InjuryFileDto>), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> GetFiles(Guid injuryId)
    {
        try
        {
            var files = await _fileService.GetFilesByInjuryIdAsync(injuryId);
            return Ok(files);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Загрузить новый файл для травмы (доступно Safety/Admin)
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы</param>
    /// <param name="uploadForm">Данные загружаемого файла (описание и сам файл)</param>
    [HttpPost]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(typeof(InjuryFileDto), 201)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    [RequestSizeLimit(10 * 1024 * 1024)] // Лимит 10 MB
    public async Task<IActionResult> UploadFile(Guid injuryId, [FromForm] UploadFileForm uploadForm)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        try
        {
            using var stream = uploadForm.File.OpenReadStream();
            var result = await _fileService.UploadFileAsync(
                injuryId,
                stream,
                uploadForm.File.FileName,
                uploadForm.File.ContentType,
                uploadForm.Description);

            return CreatedAtAction(nameof(GetFiles), new { injuryId = injuryId }, result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Ошибка при загрузке файла для травмы {InjuryId}", injuryId);
            return StatusCode(500, "Внутренняя ошибка сервера");
        }
    }

    /// <summary>
    /// Скачать файл
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы</param>
    /// <param name="fileId">Идентификатор файла</param>
    [HttpGet("{fileId}")]
    [ProducesResponseType(200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DownloadFile(Guid injuryId, Guid fileId)
    {
        try
        {
            var (data, fileName, contentType) = await _fileService.DownloadFileAsync(injuryId, fileId);
            return File(data, contentType, fileName);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }

    /// <summary>
    /// Удалить файл (доступно Safety/Admin)
    /// </summary>
    /// <param name="injuryId">Идентификатор травмы</param>
    /// <param name="fileId">Идентификатор файла</param>
    [HttpDelete("{fileId}")]
    //[Authorize(Policy = "SafetyPolicy")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> DeleteFile(Guid injuryId, Guid fileId)
    {
        try
        {
            await _fileService.DeleteFileAsync(injuryId, fileId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(ex.Message);
        }
    }
}