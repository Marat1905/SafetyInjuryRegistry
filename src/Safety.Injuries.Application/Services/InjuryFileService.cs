using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Interfaces;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Interfaces;

namespace Safety.Injuries.Application.Services;

/// <summary>
/// Реализация сервиса для управления файлами травм
/// </summary>
public class InjuryFileService : IInjuryFileService
{
    private readonly IInjuryRepository _injuryRepository;
    private readonly IInjuryFileRepository _fileRepository;
    private readonly IMapper _mapper;

    public InjuryFileService(
        IInjuryRepository injuryRepository,
        IInjuryFileRepository fileRepository,
        IMapper mapper)
    {
        _injuryRepository = injuryRepository;
        _fileRepository = fileRepository;
        _mapper = mapper;
    }

    /// <inheritdoc />
    public async Task<IEnumerable<InjuryFileDto>> GetFilesByInjuryIdAsync(Guid injuryId)
    {
        // Проверяем, существует ли травма
        var injuryExists = await _injuryRepository.ExistsAsync(injuryId);
        if (!injuryExists)
            throw new KeyNotFoundException($"Травма с id {injuryId} не найдена");

        var files = await _fileRepository.GetByInjuryIdAsync(injuryId);
        return _mapper.Map<IEnumerable<InjuryFileDto>>(files);
    }

    /// <inheritdoc />
    public async Task<InjuryFileDto> UploadFileAsync(
        Guid injuryId,
        Stream fileStream,
        string fileName,
        string contentType,
        string? description = null)
    {
        // Проверяем существование травмы
        var injury = await _injuryRepository.GetByIdAsync(injuryId);
        if (injury == null)
            throw new KeyNotFoundException($"Травма с id {injuryId} не найдена");

        // Читаем все байты файла
        using var memoryStream = new MemoryStream();
        await fileStream.CopyToAsync(memoryStream);
        var fileData = memoryStream.ToArray();

        // Создаем сущность файла
        var injuryFile = new InjuryFile
        {
            Id = Guid.NewGuid(),
            InjuryId = injuryId,
            FileName = fileName,
            ContentType = contentType,
            Size = fileData.Length,
            Data = fileData,
            Description = description,
            CreatedAt = DateTime.UtcNow
        };

        var created = await _fileRepository.AddAsync(injuryFile);
        return _mapper.Map<InjuryFileDto>(created);
    }

    /// <inheritdoc />
    public async Task<(byte[] Data, string FileName, string ContentType)> DownloadFileAsync(Guid injuryId, Guid fileId)
    {
        // Проверяем существование травмы (опционально, но для безопасности)
        var injuryExists = await _injuryRepository.ExistsAsync(injuryId);
        if (!injuryExists)
            throw new KeyNotFoundException($"Травма с id {injuryId} не найдена");

        var file = await _fileRepository.GetByInjuryAndFileIdAsync(injuryId, fileId);
        if (file == null)
            throw new KeyNotFoundException($"Файл с id {fileId} не найден для травмы {injuryId}");

        return (file.Data, file.FileName, file.ContentType);
    }

    /// <inheritdoc />
    public async Task DeleteFileAsync(Guid injuryId, Guid fileId)
    {
        // Проверяем существование травмы
        var injuryExists = await _injuryRepository.ExistsAsync(injuryId);
        if (!injuryExists)
            throw new KeyNotFoundException($"Травма с id {injuryId} не найдена");

        var file = await _fileRepository.GetByInjuryAndFileIdAsync(injuryId, fileId);
        if (file == null)
            throw new KeyNotFoundException($"Файл с id {fileId} не найден для травмы {injuryId}");

        await _fileRepository.DeleteAsync(file);
    }
}