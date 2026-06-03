namespace Safety.Injuries.API.Auth;

public class JwtBearerTokenOptions
{
    public const string Position = "Authorization:JwtBearerOptions";

    /// <summary>
    /// Возвращает или задает значение , если для адреса или центра метаданных требуется протокол HTTPS.
    /// </summary>
    public bool RequireHttpsMetadata { get; set; }

    /// <summary>
    /// укзывает, будет ли валидироваться издатель при валидации токена
    /// </summary>
    public bool ValidateIssuer { get; set; }

    /// <summary>
    /// будет ли валидироваться потребитель токена
    /// </summary>
    public bool ValidateAudience { get; set; }

    /// <summary>
    /// будет ли валидироваться время существования
    /// </summary>
    public bool ValidateLifetime { get; set; }

    /// <summary>
    /// валидация ключа безопасности
    /// </summary>
    public bool ValidateIssuerSigningKey { get; set; }
}
