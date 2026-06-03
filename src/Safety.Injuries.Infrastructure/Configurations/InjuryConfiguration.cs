using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Infrastructure.Configurations;

public class InjuryConfiguration : IEntityTypeConfiguration<Injury>
{
    public void Configure(EntityTypeBuilder<Injury> builder)
    {
        builder.ToTable("Injuries");
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Type)
            .IsRequired()
            .HasMaxLength(100);
        builder.Property(i => i.Description)
            .IsRequired()
            .HasMaxLength(500);
        builder.Property(i => i.Date)
            .IsRequired();

        // Настройка связи один-ко-многим с InjuryFile
        builder.HasMany(i => i.Files)
            .WithOne(f => f.Injury)
            .HasForeignKey(f => f.InjuryId)
            .OnDelete(DeleteBehavior.Cascade); // При удалении травмы удаляются и файлы
    }
}