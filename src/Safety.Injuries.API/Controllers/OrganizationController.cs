using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using Safety.Injuries.API.Services;

namespace Safety.Injuries.API.Controllers;

[ApiVersion("1.0")]
[Route("safety/api/v{version:apiVersion}/[controller]")]
[ApiController]
public class OrganizationController : ControllerBase
{
    private readonly IOrganizationNameDecryptor _decryptor;

    public OrganizationController(IOrganizationNameDecryptor decryptor)
    {
        _decryptor = decryptor;
    }

    [HttpGet("name")]
    [ProducesResponseType(typeof(OrganizationNameResponse), 200)]
    [ProducesResponseType(500)]
    public IActionResult GetOrganizationName()
    {
        try
        {
            var name = _decryptor.GetDecryptedOrganizationName();
            return Ok(new OrganizationNameResponse { OrganizationName = name });
        }
        catch (Exception ex)
        {
            // Замените на нормальное логирование
            Console.WriteLine($"Decryption error: {ex.Message}");
            return StatusCode(500, new { error = "Failed to decrypt organization name" });
        }
    }
}

public class OrganizationNameResponse
{
    public string OrganizationName { get; set; } = string.Empty;
}