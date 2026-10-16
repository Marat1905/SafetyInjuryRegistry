using AutoMapper;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;

namespace Safety.Injuries.Application.Mapping;

/// <summary>
/// Профиль маппинга AutoMapper.
///
/// Описывает все преобразования между доменными сущностями и DTO,
/// используемыми прикладным слоем.
///
/// Отдельное внимание уделено токену конкурентности <see cref="Injury.RowVersion"/>:
/// это системное поле, значение которого присваивается PostgreSQL (xmin) и
/// управляется EF Core. Из DTO оно никогда не приходит и не должно в него
/// попадать — во всех маппингах с участием сущности <see cref="Injury"/> оно
/// явно игнорируется. Без этого AutoMapper при валидации конфигурации
/// (<c>AssertConfigurationIsValid</c>) сообщал бы об «unmapped member: RowVersion».
/// </summary>
public class MappingProfile : Profile
{
    public MappingProfile()
    {
        // ----------------------------------------------------------------------
        // Injury -> InjuryDto
        //
        // Дата преобразуется к строке в формате yyyy-MM-dd (только дата, без времени).
        // Категория — к строковому имени enum (Fatality, LostWorkdayCase и т.д.).
        //
        // RowVersion в InjuryDto отсутствует: поле нужно только для контроля
        // одновременного редактирования и наружу не отдаётся. AutoMapper не считает
        // это «непокрытым destination-свойством», потому что в DTO такого поля нет.
        // ----------------------------------------------------------------------
        CreateMap<Injury, InjuryDto>()
            .ForMember(dest => dest.Date,
                opt => opt.MapFrom(src => src.Date.ToString("yyyy-MM-dd")))
            .ForMember(dest => dest.Category,
                opt => opt.MapFrom(src => src.Category.ToString()));

        // ----------------------------------------------------------------------
        // CreateInjuryRequest -> Injury
        //
        // Category приходит строкой (латиница или «П1»–«П6»), конвертируется
        // через кастомный резолвер <see cref="MapCategoryFromString"/>.
        //
        // Id, CreatedAt, UpdatedAt, Files генерируются/управляются на уровне
        // сервиса и EF Core — игнорируются.
        //
        // RowVersion — токен конкурентности, значение присваивает PostgreSQL
        // (системная колонка xmin). Игнорируем его, иначе AutoMapper выдаст
        // «unmapped property» при валидации конфигурации.
        // ----------------------------------------------------------------------
        CreateMap<CreateInjuryRequest, Injury>()
            .ForMember(dest => dest.Category,
                opt => opt.MapFrom(src => MapCategoryFromString(src.Category)))
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Files, opt => opt.Ignore())
            .ForMember(dest => dest.RowVersion, opt => opt.Ignore());

        // ----------------------------------------------------------------------
        // UpdateInjuryRequest -> Injury
        //
        // Category обновляется вручную в сервисе (через MapCategoryFromString)
        // после успешного маппинга остальных полей — так проще контролировать
        // сценарии «переквалификации» травмы между значимыми и незначимыми категориями.
        //
        // Date не обновляется через этот DTO — дата происшествия считается
        // неизменяемой после создания записи.
        //
        // Id, CreatedAt, UpdatedAt, Files и RowVersion игнорируются по тем же
        // причинам, что и в CreateInjuryRequest -> Injury.
        //
        // ForAllMembers с Condition(srcMember != null) реализует PATCH-семантику:
        // обновляются только те поля, которые клиент прислал явно.
        // ----------------------------------------------------------------------
        CreateMap<UpdateInjuryRequest, Injury>()
            .ForMember(dest => dest.Category, opt => opt.Ignore()) // обновляется вручную в сервисе
            .ForMember(dest => dest.Date, opt => opt.Ignore())     // дата не обновляется через этот DTO
            .ForMember(dest => dest.Id, opt => opt.Ignore())
            .ForMember(dest => dest.CreatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.UpdatedAt, opt => opt.Ignore())
            .ForMember(dest => dest.Files, opt => opt.Ignore())
            .ForMember(dest => dest.RowVersion, opt => opt.Ignore())
            .ForAllMembers(opts => opts.Condition((src, dest, srcMember) => srcMember != null));

        // ----------------------------------------------------------------------
        // InjuryFile -> InjuryFileDto
        //
        // Явно мапится CreatedAt, чтобы не полагаться на совпадение имён
        // в будущем при возможном переименовании полей.
        // ----------------------------------------------------------------------
        CreateMap<InjuryFile, InjuryFileDto>()
            .ForMember(dest => dest.CreatedAt, opt => opt.MapFrom(src => src.CreatedAt));

        // ----------------------------------------------------------------------
        // ZeroInjuryProgram -> ZeroInjuryProgramDto
        //
        // RowVersion в DTO отсутствует, поэтому дополнительных игноров
        // со стороны source не требуется — AutoMapper проверяет только
        // destination-члены, а их здесь все покрыты.
        //
        // DaysPassed / DaysRemaining вычисляются в самой сущности с учётом
        // статуса финализации (для прерванной программы берётся дата травмы,
        // для успешной — полный целевой период, для активной — до сегодня).
        // Здесь просто указываем AutoMapper использовать эти свойства напрямую.
        // ----------------------------------------------------------------------
        CreateMap<ZeroInjuryProgram, ZeroInjuryProgramDto>()
            // Целевой период хранится в TargetDaysInternal, в DTO называется TargetDays.
            .ForMember(dest => dest.TargetDays,
                opt => opt.MapFrom(src => src.TargetDaysInternal))
            .ForMember(dest => dest.DaysPassed,
                opt => opt.MapFrom(src => src.DaysPassed))
            .ForMember(dest => dest.DaysRemaining,
                opt => opt.MapFrom(src => src.DaysRemaining))
            // Итоговый статус собираем на основе флагов.
            .ForMember(dest => dest.Status,
                opt => opt.MapFrom(src =>
                    !src.IsFinalized
                        ? "Active"
                        : (src.IsSuccessfullyCompleted ? "Completed" : "Interrupted")))
            .ForMember(dest => dest.IsCompleted,
                opt => opt.MapFrom(src => src.IsFinalized))
            .ForMember(dest => dest.CompletedAt,
                opt => opt.MapFrom(src => src.CompletedAt))
            .ForMember(dest => dest.Documents,
                opt => opt.MapFrom(src => src.Documents));

        // ----------------------------------------------------------------------
        // ZeroInjuryDocument -> ZeroInjuryDocumentDto
        //
        // Все поля совпадают по именам, дополнительных настроек не требуется.
        // ----------------------------------------------------------------------
        CreateMap<ZeroInjuryDocument, ZeroInjuryDocumentDto>();
    }

    /// <summary>
    /// Преобразует строковое представление категории в перечисление <see cref="InjuryCategory"/>.
    ///
    /// Поддерживаются два формата входных значений:
    /// <list type="bullet">
    /// <item><description>имена членов enum на латинице: <c>Fatality</c>, <c>LostWorkdayCase</c> и т.д.;</description></item>
    /// <item><description>русские обозначения: <c>П1</c>–<c>П6</c>.</description></item>
    /// </list>
    ///
    /// Если строку не удалось распознать — бросается <see cref="ArgumentException"/>.
    /// Это сигнализирует о некорректном запросе, который должен быть отловлен
    /// валидатором или глобальным middleware.
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