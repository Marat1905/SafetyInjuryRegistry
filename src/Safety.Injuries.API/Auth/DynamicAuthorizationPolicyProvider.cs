using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace Safety.Injuries.API.Auth;

public class DynamicAuthorizationPolicyProvider : IAuthorizationPolicyProvider
{
    private readonly IConfiguration _configuration;
    private readonly DefaultAuthorizationPolicyProvider _fallbackPolicyProvider;

    public DynamicAuthorizationPolicyProvider(
        IConfiguration configuration,
        IOptions<AuthorizationOptions> options)
    {
        _configuration = configuration;
        _fallbackPolicyProvider = new DefaultAuthorizationPolicyProvider(options);
    }

    public async Task<AuthorizationPolicy> GetPolicyAsync(string policyName)
    {
        var roles = _configuration
            .GetSection($"AuthorizationPolicies:{policyName}")
            .Get<string[]>();

        if (roles != null && roles.Any())
        {
            var builder = new AuthorizationPolicyBuilder();
            builder.RequireRole(roles);
            return builder.Build();
        }

        return await _fallbackPolicyProvider.GetPolicyAsync(policyName);
    }

    public async Task<AuthorizationPolicy> GetDefaultPolicyAsync()
    {
        return await _fallbackPolicyProvider.GetDefaultPolicyAsync();
    }

    public async Task<AuthorizationPolicy> GetFallbackPolicyAsync()
    {
        return await _fallbackPolicyProvider.GetFallbackPolicyAsync();
    }
}
