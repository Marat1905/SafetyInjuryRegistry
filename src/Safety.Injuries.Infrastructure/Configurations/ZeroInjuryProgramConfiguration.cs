using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Safety.Injuries.Domain.Entities;

namespace Safety.Injuries.Infrastructure.Configurations;

/// <summary>
/// Конфигурация таблицы и отображения для сущности <see cref="ZeroInjuryProgram"/> в базе данных.
/// </summary>
public class ZeroInjuryProgramConfiguration : IEntityTypeConfiguration<ZeroInjuryProgram>
{
    public void Configure(EntityTypeBuilder<ZeroInjuryProgram> builder)
    {
        // Устанавливаем имя таблицы в базе данных
        builder.ToTable("ZeroInjuryPrograms");

        // Настройка первичного ключа
        builder.HasKey(p => p.Id);

        // Дата начала периода – обязательна
        builder.Property(p => p.StartDate)
            .IsRequired();

        // Описание программы – обязательно, максимум 1000 символов
        builder.Property(p => p.Description)
            .IsRequired()
            .HasMaxLength(1000);

        // Целевой период дней – обязателен
        builder.Property(p => p.TargetDaysInternal)
            .IsRequired();

        // ID пользователя, установившего отсчёт – обязательно, максимум 100 символов
        builder.Property(p => p.SetByUserId)
            .IsRequired()
            .HasMaxLength(100);

        // Имя пользователя – обязательно, максимум 200 символов
        builder.Property(p => p.SetByUserName)
            .IsRequired()
            .HasMaxLength(200);

        // Флаг финализации программы
        builder.Property(p => p.IsFinalized)
            .IsRequired()
            .HasDefaultValue(false);

        // Флаг успешного завершения
        builder.Property(p => p.IsSuccessfullyCompleted)
            .IsRequired()
            .HasDefaultValue(false);

        // Дата фактического завершения
        builder.Property(p => p.FinalizedAt);

        // Вычисляемые свойства — не мапятся в БД, так как вычисляются на лету в C#
        builder.Ignore(p => p.DaysPassed);
        builder.Ignore(p => p.DaysRemaining);
        builder.Ignore(p => p.IsPeriodElapsed);
        builder.Ignore(p => p.PlannedCompletionDate);
        builder.Ignore(p => p.IsCompleted);
        builder.Ignore(p => p.CompletedAt);

        // Связь с травмой-триггером (опциональная, SetNull при удалении травмы)
        builder.HasOne(p => p.TriggeringInjury)
            .WithMany()
            .HasForeignKey(p => p.TriggeringInjuryId)
            .OnDelete(DeleteBehavior.SetNull);

        // Связь один-ко-многим с документами
        builder.HasMany(p => p.Documents)
            .WithOne(d => d.Program)
            .HasForeignKey(d => d.ProgramId)
            .OnDelete(DeleteBehavior.Cascade);

        // Индекс по дате начала для быстрой сортировки истории
        builder.HasIndex(p => p.StartDate);

        // Индекс по флагу финализации для быстрого поиска активной программы
        builder.HasIndex(p => p.IsFinalized);
    }
}