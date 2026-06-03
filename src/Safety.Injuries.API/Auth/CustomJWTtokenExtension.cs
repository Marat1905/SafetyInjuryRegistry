using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

namespace Safety.Injuries.API.Auth;

public static class CustomJWTtokenExtension
{
    public static IServiceCollection AddCustomJWTAuthentification(this IServiceCollection services)
    {
        var authOptions = CommonConfigurationManager.Configuration.GetSection(AuthOptions.Position).Get<AuthOptions>();
        var jwtOptions = CommonConfigurationManager.Configuration.GetSection(JwtBearerTokenOptions.Position).Get<JwtBearerTokenOptions>();

        services.AddSingleton(authOptions);
        services.AddAuthentication(authOpt =>
        {
            authOpt.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            authOpt.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
                .AddJwtBearer(jwtOpt =>
                {
                    jwtOpt.RequireHttpsMetadata = jwtOptions.RequireHttpsMetadata;
                    jwtOpt.TokenValidationParameters = new TokenValidationParameters
                    {
                        // укзывает, будет ли валидироваться издатель при валидации токена
                        ValidateIssuer = jwtOptions.ValidateIssuer,
                        // будет ли валидироваться потребитель токена
                        ValidateAudience = jwtOptions.ValidateAudience,
                        // будет ли валидироваться время существования
                        ValidateLifetime = jwtOptions.ValidateLifetime,
                        // валидация ключа безопасности
                        ValidateIssuerSigningKey = jwtOptions.ValidateIssuerSigningKey,
                        // строка, представляющая издателя
                        ValidIssuer = authOptions.Issuer,
                        // установка потребителя токена
                        ValidAudience = authOptions.Audience,
                        // установка ключа безопасности
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authOptions.Key))
                    };
                });

        return services;
    }
}
