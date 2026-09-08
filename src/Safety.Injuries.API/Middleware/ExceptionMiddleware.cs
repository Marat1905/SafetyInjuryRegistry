using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using System.Diagnostics;
using System.Net;
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
        // Для ожидаемых бизнес-ошибок используем уровень Warning
        if (exception is KeyNotFoundException ||
            exception is ArgumentException ||
            exception is ValidationException ||
            exception is FormatException ||
            exception is InvalidOperationException)
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

        // Обработка специфичных типов исключений
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
                context.Response.StatusCode = (int)HttpStatusCode.Conflict;
                response.StatusCode = context.Response.StatusCode;
                response.Message = "Запись была изменена другим пользователем. Обновите данные и повторите попытку.";
                if (_env.IsDevelopment())
                {
                    response.Details = concurrencyEx.Message;
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
            if (_env.IsDevelopment())
            {
                response.Details = dbEx.InnerException?.Message ?? dbEx.Message;
            }
        }
    }
}

public class ErrorResponse
{
    public int StatusCode { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string? TraceId { get; set; }

    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IEnumerable<string>? Errors { get; set; } // Для ошибок валидации
}