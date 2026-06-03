using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Application.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<Injury, InjuryDto>()
            .ForMember(dest => dest.Date,
                opt => opt.MapFrom(src => src.Date.ToString("yyyy-MM-dd")));

        CreateMap<CreateInjuryRequest, Injury>();
        CreateMap<UpdateInjuryRequest, Injury>();

        // Маппинг для файлов
        CreateMap<InjuryFile, InjuryFileDto>()
            .ForMember(dest => dest.CreatedAt,
                opt => opt.MapFrom(src => src.CreatedAt));
    }
}