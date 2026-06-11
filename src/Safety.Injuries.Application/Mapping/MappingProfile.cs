using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;

namespace Safety.Injuries.Application.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // Injury -> InjuryDto
        CreateMap<Injury, InjuryDto>()
            .ForMember(dest => dest.Date,
                opt => opt.MapFrom(src => src.Date.ToString("yyyy-MM-dd")))
            .ForMember(dest => dest.Category,
                opt => opt.MapFrom(src => src.Category.ToString()));

        // CreateInjuryRequest -> Injury
        CreateMap<CreateInjuryRequest, Injury>()
            .ForMember(dest => dest.Category,
                opt => opt.MapFrom(src => MapCategoryFromString(src.Category)))
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Files, opt => opt.Ignore());

        // UpdateInjuryRequest -> Injury
        CreateMap<UpdateInjuryRequest, Injury>()
            .ForMember(dest => dest.Category, opt => opt.Ignore()) // обновляется вручную в сервисе
            .ForMember(dest => dest.Date, opt => opt.Ignore())     // дата не обновляется через этот DTO
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Files, opt => opt.Ignore())
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));

        // InjuryFile -> InjuryFileDto
        CreateMap<InjuryFile, InjuryFileDto>()
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => src.CreatedAt));
    }

    /// <summary>
    /// Преобразует строковое представление категории в перечисление InjuryCategory.
    /// </summary>
    public static InjuryCategory MapCategoryFromString(string categoryStr)
    {
        if (string.IsNullOrWhiteSpace(categoryStr))
            throw new ArgumentException("Категория не может быть пустой");

        if (Enum.TryParse<InjuryCategory>(categoryStr, true, out var result))
            return result;

        return categoryStr.ToUpper() switch
        {
            "П1" => InjuryCategory.Fatality,
            "П2" => InjuryCategory.LostWorkdayCase,
            "П3" => InjuryCategory.FirstAidCase,
            "П4" => InjuryCategory.AccidentOrNearMiss,
            "П5" => InjuryCategory.PreventedIncident,
            "П6" => InjuryCategory.ThirdPartyInjury,
            _ => throw new ArgumentException($"Недопустимое значение категории: {categoryStr}")
        };
    }
}