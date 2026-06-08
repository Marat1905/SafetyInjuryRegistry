using Microsoft.EntityFrameworkCore;
using Safety.Injuries.Infrastructure.Data;
using Testcontainers.PostgreSql;
using Xunit;

namespace Safety.Injuries.IntegrationTests.Fixtures;

public class TestContainersFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgresContainer;
    public string ConnectionString { get; private set; } = string.Empty;

    public TestContainersFixture()
    {
        _postgresContainer = new PostgreSqlBuilder()
            .WithImage("postgres:16-alpine")
            .WithDatabase("safety_injuries_test")
            .WithUsername("test_user")
            .WithPassword("test_password")
            .WithCleanUp(true)
            .Build();
    }

    public async Task InitializeAsync()
    {
        await _postgresContainer.StartAsync();
        ConnectionString = _postgresContainer.GetConnectionString();

        var options = new DbContextOptionsBuilder<SafetyInjuriesDbContext>()
            .UseNpgsql(ConnectionString)
            .Options;

        using var context = new SafetyInjuriesDbContext(options);
        await context.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _postgresContainer.DisposeAsync();
    }
}