using System.Security.Cryptography;
using System.Text;

namespace Safety.Injuries.API.Services;

public class OrganizationNameDecryptor : IOrganizationNameDecryptor
{
    private readonly IConfiguration _configuration;
    private readonly IWebHostEnvironment _environment;

    public OrganizationNameDecryptor(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _configuration = configuration;
        _environment = environment;
    }

    public string GetDecryptedOrganizationName()
    {
        var encryptedBase64 = _configuration["EncryptedOrganizationName"];
        if (string.IsNullOrWhiteSpace(encryptedBase64))
            throw new InvalidOperationException("EncryptedOrganizationName is missing in configuration.");

        // Путь к приватному ключу. Для production используйте более безопасное хранилище.
        var privateKeyPath = Path.Combine(_environment.ContentRootPath, "private_key.pem");
        if (!File.Exists(privateKeyPath))
            throw new FileNotFoundException($"Private key not found at {privateKeyPath}");

        var privateKeyPem = File.ReadAllText(privateKeyPath);
        using var rsa = RSA.Create();
        rsa.ImportFromPem(privateKeyPem);

        var encrypted = Convert.FromBase64String(encryptedBase64);
        // Padding должен совпадать с использованным при шифровании
        var decrypted = rsa.Decrypt(encrypted, RSAEncryptionPadding.OaepSHA256);
        return Encoding.UTF8.GetString(decrypted);
    }
}