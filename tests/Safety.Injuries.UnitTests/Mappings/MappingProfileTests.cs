using AutoMapper;
using FluentAssertions;
using Safety.Injuries.Application.DTOs;
using Safety.Injuries.Application.Mapping;
using Safety.Injuries.Domain.Entities;
using Safety.Injuries.Domain.Enums;
using Safety.Injuries.UnitTests.Helpers;
using Xunit;

namespace Safety.Injuries.UnitTests.Mappings;

public class MappingProfileTests
{
    private readonly IMapper _mapper;

    public MappingProfileTests()
    {
        _mapper = MapperHelper.CreateMapper();
    }

    [Fact]
    public void MappingProfile_ShouldBeValid()
    {
        _mapper.ConfigurationProvider.AssertConfigurationIsValid();
    }

    [Fact]
    public void Should_Map_Injury_To_InjuryDto()
    {
        var injury = new Injury
        {
            Id = Guid.NewGuid(),
            Date = new DateTime(2026, 6, 8, 0, 0, 0, DateTimeKind.Utc),
            Type = "Burn",
            Description = "Chemical",
            Category = InjuryCategory.Fatality
        };

        var dto = _mapper.Map<InjuryDto>(injury);

        dto.Id.Should().Be(injury.Id);
        dto.Date.Should().Be("2026-06-08");
        dto.Type.Should().Be("Burn");
        dto.Description.Should().Be("Chemical");
        dto.Category.Should().Be("Fatality");
    }

    [Fact]
    public void Should_Map_CreateInjuryRequest_To_Injury()
    {
        var request = new CreateInjuryRequest
        {
            Date = "2026-06-08",
            Type = "Fracture",
            Description = "Leg fracture",
            Category = "П2"
        };

        var injury = _mapper.Map<Injury>(request);

        injury.Date.Should().Be(new DateTime(2026, 6, 8));
        injury.Type.Should().Be("Fracture");
        injury.Description.Should().Be("Leg fracture");
        injury.Category.Should().Be(InjuryCategory.LostWorkdayCase);
    }

    [Fact]
    public void Should_Map_UpdateInjuryRequest_To_Injury_IgnoringCategory()
    {
        var request = new UpdateInjuryRequest
        {
            Type = "New type",
            Description = "New desc",
            Category = "П1"
        };

        var injury = new Injury { Category = InjuryCategory.FirstAidCase };
        _mapper.Map(request, injury);

        injury.Type.Should().Be("New type");
        injury.Description.Should().Be("New desc");
        injury.Category.Should().Be(InjuryCategory.FirstAidCase); // не изменилась
    }

    [Fact]
    public void Should_Map_InjuryFile_To_InjuryFileDto()
    {
        var file = new InjuryFile
        {
            Id = Guid.NewGuid(),
            InjuryId = Guid.NewGuid(),
            FileName = "doc.pdf",
            ContentType = "application/pdf",
            Size = 1024,
            Description = "Test",
            CreatedAt = DateTime.UtcNow
        };

        var dto = _mapper.Map<InjuryFileDto>(file);

        dto.Id.Should().Be(file.Id);
        dto.InjuryId.Should().Be(file.InjuryId);
        dto.FileName.Should().Be("doc.pdf");
        dto.ContentType.Should().Be("application/pdf");
        dto.Size.Should().Be(1024);
        dto.Description.Should().Be("Test");
        dto.CreatedAt.Should().Be(file.CreatedAt);
    }
}