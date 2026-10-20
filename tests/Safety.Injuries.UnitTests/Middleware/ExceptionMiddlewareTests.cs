using FluentValidation;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using System.Diagnostics;
using System.Net;
using System.Text;
using System.Text.Json.Serialization;

namespace Safety.Injuries.API.Middleware;

/// <summary>
/// Промежуточное ПО для глобальной обработки исключений.
/// Перехватывает все необработанные исключения, логирует их и возвращает клиенту
/// структурированный ответ в формате JSON с соответствующим HTTP-статусом.
/// </summary>
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;
    private readonly IWebHostEnvironment _env;

    public ExceptionMiddleware(
        RequestDelegate next,
        ILogger<ExceptionMiddleware> logger,
        IWebHostEnvironment env)
    {
        _next = next;
        _logger = logger;
        _env = env;
    }

    /// <summary>
    /// Обрабатывает входящий HTTP-запрос, перехватывая исключения и формируя ответ.
    /// </summary>
    /// <param name="context">Контекст HTTP-запроса.</param>
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            // Логируем исключение с соответствующим уровнем
            LogException(context, ex);
            await HandleExceptionAsync(context, ex);
        }
    }

    /// <summary>
    /// Логирует исключение в зависимости от его типа (Warning или Error).
    /// </summary>
    /// <param name="context">Контекст HTTP-запроса.</param>
    /// <param name="exception">Перехваченное исключение.</param>
    private void LogException(HttpContext context, Exception exception)
    {
        // Для ожидаемых бизнес-ошибок используем уровень Warning.
        //
        // DbUpdateConcurrencyException относится именно к этой категории:
        // это не сбой сервера, а конфликт одновременного редактирования —
        // пользователь открыл запись, параллельно её изменил кто-то другой
        // и при сохранении EF Core обнаружил расхождение по токену
        // конкурентности (в нашей конфигурации — по системному столбцу xmin).
        // Такая ситуация ожидаема и требует предупреждения, а не ошибки.
        if (exception is KeyNotFoundException ||
            exception is ArgumentException ||
            exception is ValidationException ||
            exception is FormatException ||
            exception is InvalidOperationException ||
            exception is DbUpdateConcurrencyException)
        {
            _logger.LogWarning(exception,
                "Ожидаемая ошибка при обработке запроса {Method} {Path}: {Message}",
                context.Request.Method,
                context.Request.Path,
                exception.Message);
        }
        else
        {
            // Для всех прочих неожиданных ошибок — уровень Error
            _logger.LogError(exception,
                "Необработанное исключение при обработке запроса {Method} {Path}: {Message}",
                context.Request.Method,
                context.Request.Path,
                exception.Message);
        }
    }

    /// <summary>
    /// Формирует и отправляет клиенту структурированный ответ об ошибке.
    /// </summary>
    /// <param name="context">Контекст HTTP-запроса.</param>
    /// <param name="exception">Перехваченное исключение.</param>
    private async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var response = new ErrorResponse
        {
            TraceId = Activity.Current?.Id ?? context.TraceIdentifier
        };

        // Обработка специфичных типов исключений.
        //
        // ВАЖНО ПОРЯДОК ВЕТОК: DbUpdateConcurrencyException наследуется от
        // DbUpdateException, поэтому его ветка должна стоять ВЫШЕ ветки
        // DbUpdateException. Иначе конфликт конкурентности будет обработан
        // как обычная ошибка целостности БД.
        switch (exception)
        {
            case BadHttpRequestException badRequestEx:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                response.StatusCode = context.Response.StatusCode;
                response.Message = badRequestEx.Message;
                break;

            case KeyNotFoundException notFoundEx:
                context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                response.StatusCode = context.Response.StatusCode;
                response.Message = notFoundEx.Message;
                break;

            case ValidationException validationEx:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                response.StatusCode = context.Response.StatusCode;
                response.Message = "Ошибка валидации данных";
                response.Errors = validationEx.Errors.Select(e => e.ErrorMessage);
                break;

            case ArgumentException argEx:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                response.StatusCode = context.Response.StatusCode;
                response.Message = argEx.Message;
                break;

            case InvalidOperationException invalidOpEx:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                response.StatusCode = context.Response.StatusCode;
                response.Message = invalidOpEx.Message;
                break;

            case FormatException formatEx:
                context.Response.StatusCode = (int)HttpStatusCode.BadRequest;
                response.StatusCode = context.Response.StatusCode;
                response.Message = "Неверный формат данных: " + formatEx.Message;
                break;

            case DbUpdateConcurrencyException concurrencyEx:
                // Конфликт одновременного редактирования.
                //
                // Ситуация: пользователь прочитал сущность (EF Core запомнил
                // текущее значение токена конкурентности — для PostgreSQL это
                // системный столбец xmin), затем кто-то другой изменил эту же
                // строку, а потом первый пользователь попытался сохранить
                // изменения. EF Core добавляет в UPDATE условие
                //     WHERE xmin = @original
                // — 0 строк попадает под условие, и выбрасывается
                // DbUpdateConcurrencyException.
                //
                // Возвращаем 409 Conflict с человекочитаемым сообщением и
                // стабильным машинным кодом, чтобы фронт мог показать
                // специальный диалог «данные устарели, обновите страницу».
                context.Response.StatusCode = (int)HttpStatusCode.Conflict;
                response.StatusCode = context.Response.StatusCode;
                response.Message = "Запись была изменена другим пользователем. Обновите данные и повторите попытку.";
                response.Code = "ConcurrencyConflict";

                // В режиме разработки добавляем детали: какие сущности
                // конфликтуют, их первичные ключи и какие поля разошлись.
                // В продакшене эти сведения не отдаём, чтобы не раскрывать
                // внутреннюю структуру модели и данные.
                if (_env.IsDevelopment())
                {
                    response.Details = BuildConcurrencyDetails(concurrencyEx);
                }
                break;

            case DbUpdateException dbEx:
                HandleDbUpdateException(context, response, dbEx);
                break;

            default:
                context.Response.StatusCode = (int)HttpStatusCode.InternalServerError;
                response.StatusCode = context.Response.StatusCode;
                response.Message = "Произошла внутренняя ошибка сервера";

                if (_env.IsDevelopment())
                {
                    response.Details = exception.Message;
                }
                break;
        }

        await context.Response.WriteAsJsonAsync(response);
    }

    /// <summary>
    /// Обрабатывает исключения, связанные с обновлением базы данных, извлекая код ошибки PostgreSQL
    /// и формируя понятное сообщение для клиента.
    /// </summary>
    /// <param name="context">Контекст HTTP-запроса.</param>
    /// <param name="response">Объект ответа с ошибкой.</param>
    /// <param name="dbEx">Исключение DbUpdateException.</param>
    private void HandleDbUpdateException(HttpContext context, ErrorResponse response, DbUpdateException dbEx)
    {
        context.Response.StatusCode = (int)HttpStatusCode.Conflict;
        response.StatusCode = context.Response.StatusCode;

        // Получаем внутреннее исключение PostgreSQL
        var postgresEx = dbEx.InnerException as PostgresException;
        if (postgresEx != null)
        {
            // Сопоставляем код ошибки PostgreSQL с сообщением
            response.Message = postgresEx.SqlState switch
            {
                "23505" => "Нарушение уникальности: запись с такими данными уже существует.",
                "23503" => "Нарушение внешнего ключа: невозможно удалить или изменить связанные данные.",
                "23514" => "Нарушение ограничения CHECK: значение не удовлетворяет условию.",
                "23502" => "Нарушение NOT NULL: обязательное поле не заполнено.",
                "23000" => "Общая ошибка целостности данных.",
                _ => "Ошибка при сохранении данных в базу."
            };

            // Для клиента — стабильный машинный код, чтобы фронт мог
            // различать типы ошибок БД без парсинга текста.
            response.Code = postgresEx.SqlState switch
            {
                "23505" => "DbUniqueViolation",
                "23503" => "DbForeignKeyViolation",
                "23514" => "DbCheckViolation",
                "23502" => "DbNotNullViolation",
                "23000" => "DbIntegrityViolation",
                _ => "DbUpdateError"
            };

            // В режиме разработки добавляем детали ошибки для отладки
            if (_env.IsDevelopment())
            {
                response.Details = $"PostgreSQL Error Code: {postgresEx.SqlState}, Message: {postgresEx.MessageText}";
                if (!string.IsNullOrEmpty(postgresEx.Detail))
                    response.Details += $", Detail: {postgresEx.Detail}";
            }
        }
        else
        {
            // Если не удалось распознать специфичную ошибку PostgreSQL
            response.Message = "Ошибка при сохранении данных в базу.";
            response.Code = "DbUpdateError";
            if (_env.IsDevelopment())
            {
                response.Details = dbEx.InnerException?.Message ?? dbEx.Message;
            }
        }
    }

    /// <summary>
    /// Формирует человекочитаемое описание конфликта одновременного редактирования.
    ///
    /// Для каждой сущности из <see cref="DbUpdateConcurrencyException.Entries"/> собирает:
    /// <list type="bullet">
    /// <item><description>имя сущности (например, <c>Injury</c>);</description></item>
    /// <item><description>значения первичного ключа (обычно <c>Id</c>);</description></item>
    /// <item><description>список полей, значения которых разошлись между тем, что клиент
    /// собирался записать, и тем, что реально лежит в БД в момент конфликта.</description></item>
    /// </list>
    ///
    /// Метод используется только в режиме разработки — в проде детали не отдаются.
    /// Обратите внимание, что <c>GetDatabaseValues()</c> — синхронный метод, который
    /// выполняет дополнительный <c>SELECT</c> к БД. Это допустимо, потому что мы уже
    /// в обработчике исключения, где задержка не критична, а информация полезна для отладки.
    /// Если такой SELECT по каким-то причинам не удался (например, строку уже удалили),
    /// метод молча пропускает эту сущность и продолжает со следующей.
    /// </summary>
    /// <param name="ex">Исключение конфликта одновременного редактирования.</param>
    /// <returns>Строка с описанием конфликта или сообщение «нет данных».</returns>
    private static string BuildConcurrencyDetails(DbUpdateConcurrencyException ex)
    {
        // Если коллекция Entries пуста (например, конфликт был поднят вручную
        // без явного указания сущностей), возвращаем общее описание.
        if (ex.Entries == null || !ex.Entries.Any())
        {
            return "Конфликт одновременного редактирования без указания сущностей.";
        }

        var sb = new StringBuilder();
        sb.Append("Конфликт одновременного редактирования: ");

        // Собираем информацию по каждой конфликтующей сущности.
        var entriesInfo = new List<string>();

        foreach (var entry in ex.Entries)
        {
            try
            {
                // Имя сущности в модели (например, "Injury" или "ZeroInjuryProgram").
                var entityName = entry.Metadata.ClrType.Name;

                // Значения первичного ключа. В нашей модели PK — Guid Id,
                // но код написан так, чтобы работать и с составными ключами.
                var keyValues = entry.Properties
                    .Where(p => p.Metadata.IsPrimaryKey())
                    .Select(p => $"{p.Metadata.Name}={p.OriginalValue ?? "null"}")
                    .ToList();

                var keyPart = keyValues.Any()
                    ? string.Join(", ", keyValues)
                    : "<нет PK>";

                // Список полей, которые разошлись между текущими значениями
                // в контексте (то, что клиент пытался записать) и тем,
                // что реально лежит в БД на момент обработки исключения.
                //
                // ВАЖНО: GetDatabaseValues() выполняет дополнительный SELECT.
                // Если строку успели удалить между UPDATE и этим SELECT,
                // метод вернёт null, и мы просто пропустим сравнение.
                var dbValues = entry.GetDatabaseValues();
                if (dbValues == null)
                {
                    entriesInfo.Add($"{entityName} [{keyPart}] — запись больше не существует в БД");
                    continue;
                }

                var conflictingFields = new List<string>();
                foreach (var property in entry.Properties)
                {
                    // Пропускаем токен конкурентности: он отличается всегда
                    // по определению (иначе бы конфликта не было) и только
                    // шумит в логе.
                    if (property.Metadata.IsConcurrencyToken)
                    {
                        continue;
                    }

                    // OriginalValue — то, что EF Core прочитал при загрузке
                    // сущности (то есть то, что видел клиент).
                    // CurrentValue — то, что клиент попытался записать.
                    // DatabaseValue — то, что лежит в БД сейчас.
                    var originalValue = property.OriginalValue;
                    var databaseValue = dbValues[property.Metadata.Name];

                    // Если клиент не менял это поле — не считаем его
                    // конфликтующим, даже если в БД оно изменилось.
                    // Конфликтующие поля — те, где и клиент, и БД
                    // отошли от исходного значения.
                    if (Equals(originalValue, databaseValue))
                    {
                        continue;
                    }

                    conflictingFields.Add(
                        $"{property.Metadata.Name}: было '{FormatValue(originalValue)}', " +
                        $"сейчас в БД '{FormatValue(databaseValue)}'");
                }

                if (conflictingFields.Any())
                {
                    entriesInfo.Add(
                        $"{entityName} [{keyPart}] — расхождения: {string.Join("; ", conflictingFields)}");
                }
                else
                {
                    entriesInfo.Add(
                        $"{entityName} [{keyPart}] — данные в БД изменились (поля не детализируются)");
                }
            }
            catch (Exception innerEx)
            {
                // Защита от неожиданных проблем при сборе деталей:
                // например, если GetDatabaseValues() бросит из-за проблем
                // с соединением. В этом случае просто пишем имя сущности.
                entriesInfo.Add(
                    $"{entry.Metadata.ClrType.Name} [<ошибка сбора деталей: {innerEx.Message}>]");
            }
        }

        sb.Append(string.Join(" | ", entriesInfo));
        return sb.ToString();
    }

    /// <summary>
    /// Приводит произвольное значение свойства к удобочитаемой строке для лога/ответа.
    /// <c>null</c> отображается как «null», строки — без изменений, остальные — через
    /// <c>ToString()</c> с защитой от исключений.
    /// </summary>
    private static string FormatValue(object? value)
    {
        if (value == null) return "null";
        try
        {
            return value.ToString() ?? "null";
        }
        catch
        {
            return "<ToString() failed>";
        }
    }
}

/// <summary>
/// Универсальный ответ об ошибке, возвращаемый клиенту.
///
/// Свойства, которые могут быть <c>null</c> в зависимости от контекста
/// (<see cref="Code"/>, <see cref="Details"/>, <see cref="Errors"/>),
/// помечены атрибутом <see cref="JsonIgnoreAttribute"/> с условием
/// <see cref="JsonIgnoreCondition.WhenWritingNull"/>. Это позволяет:
/// <list type="bullet">
/// <item><description>не сериализовать отсутствующие поля вообще — клиент не увидит
/// <c>"details": null</c> там, где деталей нет;</description></item>
/// <item><description>сохранить обратную совместимость, потому что код фронта проверяет
/// наличие свойства через <c>TryGetProperty</c>, а не его значение.</description></item>
/// </list>
/// </summary>
public class ErrorResponse
{
    /// <summary>
    /// HTTP-статус ответа (дублируется в теле для удобства клиента).
    /// </summary>
    public int StatusCode { get; set; }

    /// <summary>
    /// Человекочитаемое сообщение об ошибке.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Машинно-читаемый код ошибки. Позволяет фронту различать типы ошибок
    /// без парсинга текста. Примеры значений:
    /// <list type="bullet">
    /// <item><description><c>ConcurrencyConflict</c> — конфликт одновременного редактирования;</description></item>
    /// <item><description><c>DbUniqueViolation</c> — нарушение уникальности;</description></item>
    /// <item><description><c>DbForeignKeyViolation</c> — нарушение внешнего ключа;</description></item>
    /// <item><description><c>DbUpdateError</c> — прочие ошибки обновления БД.</description></item>
    /// </list>
    /// Для ошибок, у которых код не определён, поле в JSON отсутствует.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Code { get; set; }

    /// <summary>
    /// Дополнительные сведения об ошибке. Заполняется только в режиме Development.
    ///
    /// Атрибут <see cref="JsonIgnoreAttribute"/> с <see cref="JsonIgnoreCondition.WhenWritingNull"/>
    /// критичен: без него System.Text.Json сериализует поле как <c>"details": null</c>,
    /// и клиенты не смогут отличить «деталей нет» от «деталей не должно быть вовсе».
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public string? Details { get; set; }

    /// <summary>
    /// Идентификатор трассировки запроса (Activity.Current.Id или TraceIdentifier).
    /// Помогает сопоставить ответ клиента с записью в логах.
    /// </summary>
    public string? TraceId { get; set; }

    /// <summary>
    /// Список сообщений об ошибках валидации. Заполняется только для
    /// <see cref="FluentValidation.ValidationException"/>.
    /// </summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IEnumerable<string>? Errors { get; set; }
}