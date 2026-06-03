using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Infrastructure.Configurations;

public class InjuryFileConfiguration : IEntityTypeConfiguration<InjuryFile>
{
    public void Configure(EntityTypeBuilder<InjuryFile> builder)
    {
        builder.ToTable("InjuryFiles");
        builder.HasKey(f => f.Id);
        builder.Property(f => f.FileName)
            .IsRequired()
            .HasMaxLength(255);
        builder.Property(f => f.ContentType)
            .IsRequired()
            .HasMaxLength(100);
        builder.Property(f => f.Size)
            .IsRequired();
        builder.Property(f => f.Data)
            .IsRequired();
        builder.Property(f => f.Description)
            .HasMaxLength(500);

        // Индекс для быстрого поиска по InjuryId
        builder.HasIndex(f => f.InjuryId);
    }
}