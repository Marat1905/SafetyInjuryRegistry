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
            .HasMaxLength(200);
        builder.Property(i => i.Description)
            .IsRequired()
            .HasMaxLength(1000);
        builder.Property(i => i.Date)
            .IsRequired();

        // Настройка свойства Category – храним как строку (значение enum)
        builder.Property(i => i.Category)
            .IsRequired()
            .HasConversion<string>()
            .HasMaxLength(50);

        // Настройка связи один-ко-многим с InjuryFile
        builder.HasMany(i => i.Files)
            .WithOne(f => f.Injury)
            .HasForeignKey(f => f.InjuryId)
            .OnDelete(DeleteBehavior.Cascade); // При удалении травмы удаляются и файлы
    }
}