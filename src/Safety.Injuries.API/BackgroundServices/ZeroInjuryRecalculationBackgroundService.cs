using Safety.Injuries.Application.Interfaces;

namespace Safety.Injuries.API.BackgroundServices;

/// <summary>
/// Фоновый сервис, который периодически пересчитывает статусы всех программ
/// «Ноль травм».
/// </summary>
public class ZeroInjuryRecalculationBackgroundService : BackgroundService
{
    /// <summary>
    /// Фабрика scope'ов. Нужна, потому что BackgroundService — Singleton,
    /// а все его зависимости (DbContext, сервисы, репозитории) — Scoped.
    /// Создаём scope на каждый цикл пересчёта и внутри него достаём
    /// свежий IZeroInjuryProgramService.
    /// </summary>
    private readonly IServiceScopeFactory _scopeFactory;

    /// <summary>
    /// Логгер. Логирование — единственный способ узнать, что фоновый
    /// пересчёт падает: пользователь ошибку не увидит, HTTP-ответа нет.
    /// </summary>
    private readonly ILogger<ZeroInjuryRecalculationBackgroundService> _logger;

    /// <summary>
    /// Интервал между пересчётами. Читается из конфигурации (см. Program.cs),
    /// по умолчанию — 1 час. Вынесено в конфигурацию, чтобы можно было
    /// без пересборки поменять частоту на разных стендах (dev — пореже,
    /// prod — почаще или наоборот).
    /// </summary>
    private readonly TimeSpan _interval;

    public ZeroInjuryRecalculationBackgroundService(
        IServiceScopeFactory scopeFactory,
        ILogger<ZeroInjuryRecalculationBackgroundService> logger,
        IConfiguration configuration)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;

        // Читаем интервал из конфигурации.
        // Ожидаемый формат: "ZeroInjuryRecalculation": { "IntervalMinutes": 60 }
        var intervalMinutes = configuration.GetValue<int?>(
            "ZeroInjuryRecalculation:IntervalMinutes") ?? 60;

        // Защита от абсурдных значений: не чаще раза в минуту, чтобы
        // случайно не превратить фоновое задание в busy-loop.
        if (intervalMinutes < 1)
        {
            _logger.LogWarning(
                "IntervalMinutes = {Value} выглядит подозрительно. " +
                "Использую минимальное значение 1 минуту.",
                intervalMinutes);
            intervalMinutes = 1;
        }

        _interval = TimeSpan.FromMinutes(intervalMinutes);
    }

    /// <summary>
    /// Основной цикл фонового сервиса. Выполняется всё время жизни приложения,
    /// пока не придёт сигнал отмены (обычно — остановка хоста).
    /// </summary>
    /// <param name="stoppingToken">
    /// Токен отмены. Приходит от хост-приложения. Прокидываем его во все
    /// долгие операции (Task.Delay, вызовы сервисов), чтобы остановка
    /// приложения была быстрой и не ждала текущей итерации.
    /// </param>
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Сервис пересчёта программ «Ноль травм» запущен. " +
            "Интервал: {Interval}.",
            _interval);

        // Основной цикл. Проверяем stoppingToken в начале каждой итерации —
        // при остановке хоста BackgroundService сам прервёт выполнение,
        // но явная проверка делает поведение предсказуемым и не даёт
        // выполнить лишний пересчёт «уже после остановки».
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Создаём scope на каждую итерацию. Важно: scope пересоздаётся,
                // чтобы DbContext не жил всё время работы приложения — иначе
                // он превратится в Singleton-«god object» с накопленным
                // change tracker, утечками памяти и устаревшими данными.
                using var scope = _scopeFactory.CreateScope();

                var zeroInjuryService = scope.ServiceProvider
                    .GetRequiredService<IZeroInjuryProgramService>();

                // Собственно пересчёт. Внутри — цикл по всем программам,
                // который может писать в БД. Логируем только факт запуска
                // и результат, потому что RecalculateAsync — идемпотентен
                // и в 95% случаев ничего не меняет.
                await zeroInjuryService.RecalculateAsync();
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Штатная остановка приложения. Не логируем как ошибку,
                // просто выходим из цикла.
                break;
            }
            catch (Exception ex)
            {
                // Любая другая ошибка — логируем, но НЕ падаем.
                // BackgroundService, у которого ExecuteAsync выбросит
                // исключение, остановит весь хост (по умолчанию),
                // а нам это не нужно: пересчёт — второстепенная операция,
                // и следующий цикл может пройти успешно.
                _logger.LogError(
                    ex,
                    "Ошибка при фоновом пересчёте программ «Ноль травм». " +
                    "Следующая попытка через {Interval}.",
                    _interval);
            }

            try
            {
                // Ждём до следующей итерации. Task.Delay принимает
                // CancellationToken — при остановке приложения ожидание
                // прервётся немедленно, и мы не будем ждать полный
                // интервал впустую.
                await Task.Delay(_interval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Ожидание прервано — выходим из цикла.
                break;
            }
        }

        _logger.LogInformation(
            "Сервис пересчёта программ «Ноль травм» остановлен.");
    }
}