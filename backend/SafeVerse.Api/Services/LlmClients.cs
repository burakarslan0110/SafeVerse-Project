using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace SafeVerse.Api.Services;

public interface ILlmClient
{
    Task<string> AnalyzeRoomsAsync(object requestPayload, CancellationToken ct);
}

public class HttpLlmClient : ILlmClient
{
    private readonly HttpClient _http;
    private readonly string _endpoint;

    public HttpLlmClient(HttpClient http, string endpoint)
    {
        _http = http;
        _endpoint = endpoint;
    }

    public async Task<string> AnalyzeRoomsAsync(object requestPayload, CancellationToken ct)
    {
        try
        {
            var resp = await _http.PostAsJsonAsync(_endpoint, requestPayload, ct);

            // Check if the request was successful
            if (!resp.IsSuccessStatusCode)
            {
                var errorContent = await resp.Content.ReadAsStringAsync(ct);
                throw new HttpRequestException(
                    $"LLM service returned {resp.StatusCode}. Response: {errorContent}");
            }

            // Parse the response to extract completion field
            var responseBody = await resp.Content.ReadAsStringAsync(ct);
            try
            {
                var jsonDoc = JsonDocument.Parse(responseBody);
                if (jsonDoc.RootElement.TryGetProperty("completion", out var completion))
                {
                    return completion.GetString() ?? responseBody;
                }
            }
            catch
            {
                // If parsing fails, return raw response
            }

            return responseBody;
        }
        catch (HttpRequestException ex)
        {
            throw new Exception($"Failed to connect to LLM service at {_endpoint}: {ex.Message}", ex);
        }
        catch (TaskCanceledException ex)
        {
            throw new Exception($"LLM service request timed out: {ex.Message}", ex);
        }
    }
}

public class GeminiLlmClient : ILlmClient
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _model;
    private readonly string _baseUrl;

    public GeminiLlmClient(HttpClient http, string apiKey, string baseUrl, string model = "gemini-2.0-flash-exp")
    {
        _http = http;
        _apiKey = apiKey;
        _baseUrl = baseUrl;
        _model = model;
    }

    public async Task<string> AnalyzeRoomsAsync(object requestPayload, CancellationToken ct)
    {
        try
        {
            // Convert our generic payload to Gemini format
            var geminiPayload = ConvertToGeminiFormat(requestPayload);

            var url = $"{_baseUrl}/{_model}:generateContent?key={_apiKey}";
            var jsonContent = new StringContent(
                JsonSerializer.Serialize(geminiPayload),
                Encoding.UTF8,
                "application/json");

            var resp = await _http.PostAsync(url, jsonContent, ct);

            if (!resp.IsSuccessStatusCode)
            {
                var errorContent = await resp.Content.ReadAsStringAsync(ct);
                throw new HttpRequestException(
                    $"Gemini API returned {resp.StatusCode}. Response: {errorContent}");
            }

            var responseBody = await resp.Content.ReadAsStringAsync(ct);

            // Parse Gemini response
            var jsonDoc = JsonDocument.Parse(responseBody);
            if (jsonDoc.RootElement.TryGetProperty("candidates", out var candidates) &&
                candidates.GetArrayLength() > 0)
            {
                var firstCandidate = candidates[0];
                if (firstCandidate.TryGetProperty("content", out var content) &&
                    content.TryGetProperty("parts", out var parts) &&
                    parts.GetArrayLength() > 0)
                {
                    var firstPart = parts[0];
                    if (firstPart.TryGetProperty("text", out var text))
                    {
                        return text.GetString() ?? responseBody;
                    }
                }
            }

            return responseBody;
        }
        catch (HttpRequestException ex)
        {
            throw new Exception($"Failed to connect to Gemini API: {ex.Message}", ex);
        }
        catch (TaskCanceledException ex)
        {
            throw new Exception($"Gemini API request timed out: {ex.Message}", ex);
        }
    }

    private object ConvertToGeminiFormat(object payload)
    {
        // Convert our message format to Gemini's format
        var jsonString = JsonSerializer.Serialize(payload);
        var doc = JsonDocument.Parse(jsonString);

        if (!doc.RootElement.TryGetProperty("messages", out var messages))
        {
            throw new ArgumentException("Payload must contain 'messages' property");
        }

        var geminiContents = new List<object>();

        foreach (var message in messages.EnumerateArray())
        {
            if (!message.TryGetProperty("role", out var role)) continue;
            if (!message.TryGetProperty("content", out var content)) continue;

            var parts = new List<object>();

            if (content.ValueKind == JsonValueKind.String)
            {
                // Simple text content
                parts.Add(new { text = content.GetString() });
            }
            else if (content.ValueKind == JsonValueKind.Array)
            {
                // Array of text/image content
                foreach (var item in content.EnumerateArray())
                {
                    if (!item.TryGetProperty("type", out var type)) continue;

                    var typeStr = type.GetString();
                    if (typeStr == "text" && item.TryGetProperty("text", out var text))
                    {
                        parts.Add(new { text = text.GetString() });
                    }
                    else if (typeStr == "image" && item.TryGetProperty("image", out var imageData))
                    {
                        var base64 = imageData.GetString();
                        // Remove data:image prefix if present
                        if (base64?.StartsWith("data:") == true)
                        {
                            var commaIndex = base64.IndexOf(',');
                            if (commaIndex > 0)
                            {
                                base64 = base64.Substring(commaIndex + 1);
                            }
                        }

                        parts.Add(new
                        {
                            inline_data = new
                            {
                                mime_type = "image/jpeg",
                                data = base64
                            }
                        });
                    }
                }
            }

            var geminiRole = role.GetString() == "system" ? "user" : role.GetString();
            geminiContents.Add(new { role = geminiRole, parts });
        }

        return new { contents = geminiContents };
    }
}

public class FallbackLlmClient : ILlmClient
{
    private readonly ILlmClient _primary;
    private readonly ILlmClient _fallback;
    private readonly ILogger<FallbackLlmClient> _logger;

    public FallbackLlmClient(ILlmClient primary, ILlmClient fallback, ILogger<FallbackLlmClient> logger)
    {
        _primary = primary;
        _fallback = fallback;
        _logger = logger;
    }

    public async Task<string> AnalyzeRoomsAsync(object requestPayload, CancellationToken ct)
    {
        try
        {
            _logger.LogInformation("Attempting to use primary LLM client: {ClientType}", _primary.GetType().Name);
            var result = await _primary.AnalyzeRoomsAsync(requestPayload, ct);
            _logger.LogInformation("Primary LLM client succeeded");
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Primary LLM client failed, falling back to: {FallbackType}", _fallback.GetType().Name);
            try
            {
                var result = await _fallback.AnalyzeRoomsAsync(requestPayload, ct);
                _logger.LogInformation("Fallback LLM client succeeded");
                return result;
            }
            catch (Exception fallbackEx)
            {
                _logger.LogError(fallbackEx, "Fallback LLM client also failed");
                throw new Exception($"Both primary and fallback LLM clients failed. Primary: {ex.Message}, Fallback: {fallbackEx.Message}");
            }
        }
    }
}

public class MockLlmClient : ILlmClient
{
    public Task<string> AnalyzeRoomsAsync(object requestPayload, CancellationToken ct)
    {
        // Return a deterministic mock JSON for development/offline
        var mock = "{\"rooms\":[{\"name\":\"Oda\",\"overallSafety\":\"moderate\",\"safetyScore\":72,\"safeZones\":[\"İç duvar köşeleri\"],\"risks\":[{\"type\":\"Ağır eşya\",\"severity\":\"medium\",\"description\":\"Sabitlenmemiş dolap\",\"recommendation\":\"Duvara sabitleyin\"}],\"strengths\":[\"Az cam yüzey\"],\"actionItems\":[\"Acil çıkış planı\"]}]}";
        return Task.FromResult(mock);
    }
}

public class LlmClientFactory
{
    private readonly IHttpClientFactory _factory;
    private readonly IConfiguration _config;
    private readonly ILogger<FallbackLlmClient> _logger;

    public LlmClientFactory(IHttpClientFactory factory, IConfiguration config, ILogger<FallbackLlmClient> logger)
    {
        _factory = factory;
        _config = config;
        _logger = logger;
    }

    public ILlmClient Create()
    {
        var provider = _config.GetValue<string>("Llm:Provider") ?? "fallback";

        // If provider is specifically set to mock, return mock client
        if (provider.Equals("mock", StringComparison.OrdinalIgnoreCase))
        {
            return new MockLlmClient();
        }

        // If provider is http (HTTP endpoint only), return HTTP client
        if (provider.Equals("http", StringComparison.OrdinalIgnoreCase))
        {
            var endpoint = _config.GetValue<string>("Llm:Endpoint");
            if (string.IsNullOrWhiteSpace(endpoint))
            {
                throw new InvalidOperationException("HTTP LLM endpoint is not configured. Set Llm:Endpoint in configuration.");
            }
            return new HttpLlmClient(_factory.CreateClient(), endpoint);
        }

        // If provider is gemini, return Gemini client
        if (provider.Equals("gemini", StringComparison.OrdinalIgnoreCase))
        {
            var apiKey = _config.GetValue<string>("Llm:GeminiApiKey");
            if (string.IsNullOrWhiteSpace(apiKey))
            {
                throw new InvalidOperationException("Gemini API key is not configured. Set Llm:GeminiApiKey in configuration.");
            }
            var baseUrl = _config.GetValue<string>("Llm:GeminiBaseUrl");
            if (string.IsNullOrWhiteSpace(baseUrl))
            {
                throw new InvalidOperationException("Gemini base URL is not configured. Set Llm:GeminiBaseUrl in configuration.");
            }
            var model = _config.GetValue<string>("Llm:GeminiModel");
            if (string.IsNullOrWhiteSpace(model))
            {
                throw new InvalidOperationException("Gemini model is not configured. Set Llm:GeminiModel in configuration.");
            }
            return new GeminiLlmClient(_factory.CreateClient(), apiKey, baseUrl, model);
        }

        // Default: fallback mode (HTTP -> Gemini -> Mock)
        var httpEndpoint = _config.GetValue<string>("Llm:Endpoint");
        if (string.IsNullOrWhiteSpace(httpEndpoint))
        {
            throw new InvalidOperationException("HTTP LLM endpoint is not configured for fallback mode. Set Llm:Endpoint in configuration.");
        }
        var httpClient = new HttpLlmClient(_factory.CreateClient(), httpEndpoint);

        var geminiApiKey = _config.GetValue<string>("Llm:GeminiApiKey");
        ILlmClient fallbackClient;

        if (!string.IsNullOrWhiteSpace(geminiApiKey))
        {
            var geminiBaseUrl = _config.GetValue<string>("Llm:GeminiBaseUrl");
            var geminiModel = _config.GetValue<string>("Llm:GeminiModel");

            if (string.IsNullOrWhiteSpace(geminiBaseUrl) || string.IsNullOrWhiteSpace(geminiModel))
            {
                _logger.LogWarning("Gemini configuration incomplete (missing BaseUrl or Model), falling back to mock client");
                fallbackClient = new MockLlmClient();
            }
            else
            {
                fallbackClient = new GeminiLlmClient(_factory.CreateClient(), geminiApiKey, geminiBaseUrl, geminiModel);
            }
        }
        else
        {
            // If no Gemini key, fall back to mock
            fallbackClient = new MockLlmClient();
        }

        return new FallbackLlmClient(httpClient, fallbackClient, _logger);
    }
}

