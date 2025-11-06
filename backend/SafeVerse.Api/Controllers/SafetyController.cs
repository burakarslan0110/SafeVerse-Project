using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafeVerse.Api.Contracts;
using SafeVerse.Api.Data;
using SafeVerse.Api.Models;
using SafeVerse.Api.Services;

namespace SafeVerse.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class SafetyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LlmClientFactory _llmFactory;
    private readonly ILogger<SafetyController> _logger;

    public SafetyController(AppDbContext db, LlmClientFactory llmFactory, ILogger<SafetyController> logger)
    {
        _db = db;
        _llmFactory = llmFactory;
        _logger = logger;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("uid") ?? User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return int.Parse(claim!.Value);
    }

    private async Task<(bool allowed, int remaining, DateTime? resetAt)> CheckAndConsumeAiRequestLimit()
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return (false, 0, null);

        var now = DateTime.UtcNow;

        // Reset limit if 24 hours have passed
        if (user.AiRequestsResetAt == null || now >= user.AiRequestsResetAt)
        {
            user.DailyAiRequestsRemaining = 2;
            user.AiRequestsResetAt = now.AddHours(24);
            await _db.SaveChangesAsync();
        }

        // Check if user has remaining requests
        if (user.DailyAiRequestsRemaining <= 0)
        {
            var timeUntilReset = user.AiRequestsResetAt.HasValue
                ? user.AiRequestsResetAt.Value - now
                : TimeSpan.Zero;

            _logger.LogWarning("User {UserId} exceeded daily AI request limit. Reset in {Hours}h {Minutes}m",
                uid, timeUntilReset.Hours, timeUntilReset.Minutes);

            return (false, 0, user.AiRequestsResetAt);
        }

        // Consume one request
        user.DailyAiRequestsRemaining--;
        await _db.SaveChangesAsync();

        _logger.LogInformation("User {UserId} consumed AI request. Remaining: {Remaining}",
            uid, user.DailyAiRequestsRemaining);

        return (true, user.DailyAiRequestsRemaining, user.AiRequestsResetAt);
    }

    [HttpGet("ai-requests-status")]
    public async Task<ActionResult<object>> GetAiRequestsStatus()
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        var now = DateTime.UtcNow;

        // Reset limit if 24 hours have passed
        if (user.AiRequestsResetAt == null || now >= user.AiRequestsResetAt)
        {
            user.DailyAiRequestsRemaining = 2;
            user.AiRequestsResetAt = now.AddHours(24);
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            remaining = user.DailyAiRequestsRemaining,
            resetAt = user.AiRequestsResetAt?.ToString("o"),
            hoursUntilReset = user.AiRequestsResetAt.HasValue
                ? Math.Max(0, (user.AiRequestsResetAt.Value - now).TotalHours)
                : 0
        });
    }

    [HttpPost("analyze-image")]
    public async Task<ActionResult<object>> AnalyzeImage([FromBody] AnalyzeImageRequest req, CancellationToken ct)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(req.Base64))
            {
                _logger.LogWarning("analyze-image called with empty base64");
                return BadRequest(new { error = "Görsel verisi eksik." });
            }

            // Check AI request limit
            var (allowed, remaining, resetAt) = await CheckAndConsumeAiRequestLimit();
            if (!allowed)
            {
                var hoursUntilReset = resetAt.HasValue ? (resetAt.Value - DateTime.UtcNow).TotalHours : 0;
                return StatusCode(429, new
                {
                    error = "Günlük AI analiz hakkınız doldu.",
                    message = $"Günde en fazla 2 analiz yapabilirsiniz. Yeni hakkınız yaklaşık {Math.Ceiling(hoursUntilReset)} saat sonra yenilenecek.",
                    remaining = 0,
                    resetAt = resetAt?.ToString("o")
                });
            }

            // Simple wrapper to produce hazards from a single image using LLM
            var llm = _llmFactory.Create();
            var payload = new
            {
                messages = new object[]
                {
                    new { role = "system", content = "Sen bir deprem güvenlik uzmanısın. Verilen oda fotoğrafını analiz ederek güvenli bölgeler, riskler ve öneriler üret. Yanıtı JSON olarak ver: {\"rooms\":[{\"name\":\"oda\",\"overallSafety\":\"safe|moderate|dangerous\",\"safetyScore\":0-100,\"safeZones\":[...],\"risks\":[{\"type\":...,\"severity\":\"low|medium|high\",\"description\":...,\"recommendation\":...}],\"strengths\":[...],\"actionItems\":[...]}]}" },
                    new { role = "user", content = new object[] { new { type = "text", text = req.RoomName ?? "Oda" }, new { type = "image", image = req.Base64 } } }
                }
            };

            _logger.LogInformation("Analyzing single image for room: {RoomName}. User has {Remaining} requests remaining.",
                req.RoomName ?? "Oda", remaining);
            var result = await llm.AnalyzeRoomsAsync(payload, ct);
            _logger.LogInformation("Received single image analysis result, length: {ResultLength}", result?.Length ?? 0);

            // Return raw LLM result to client with remaining requests info
            return Ok(new {
                completion = result,
                requestsRemaining = remaining,
                resetAt = resetAt?.ToString("o")
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error analyzing image");
            return StatusCode(500, new { error = "Görsel analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.", details = ex.Message });
        }
    }

    public class AnalyzeRoomsRequest
    {
        public required List<RoomInput> Rooms { get; set; }
        public class RoomInput { public required string Name { get; set; } public required string Base64 { get; set; } }
    }

    [HttpPost("analyze-rooms")]
    public async Task<ActionResult<object>> AnalyzeRooms([FromBody] AnalyzeRoomsRequest req, CancellationToken ct)
    {
        try
        {
            if (req.Rooms == null || req.Rooms.Count == 0)
            {
                _logger.LogWarning("analyze-rooms called with empty or null rooms array");
                return BadRequest(new { error = "En az bir oda görseli göndermeniz gerekiyor." });
            }

            // Check AI request limit
            var (allowed, remaining, resetAt) = await CheckAndConsumeAiRequestLimit();
            if (!allowed)
            {
                var hoursUntilReset = resetAt.HasValue ? (resetAt.Value - DateTime.UtcNow).TotalHours : 0;
                return StatusCode(429, new
                {
                    error = "Günlük AI analiz hakkınız doldu.",
                    message = $"Günde en fazla 2 analiz yapabilirsiniz. Yeni hakkınız yaklaşık {Math.Ceiling(hoursUntilReset)} saat sonra yenilenecek.",
                    remaining = 0,
                    resetAt = resetAt?.ToString("o")
                });
            }

            var llm = _llmFactory.Create();
            _logger.LogInformation("Using LLM client: {ClientType}", llm.GetType().Name);

            var imageContent = new List<object>();
            for (var i = 0; i < req.Rooms.Count; i++)
            {
                var r = req.Rooms[i];
                if (string.IsNullOrWhiteSpace(r.Name) || string.IsNullOrWhiteSpace(r.Base64))
                {
                    _logger.LogWarning("Room {Index} has empty name or base64", i);
                    return BadRequest(new { error = $"Oda {i + 1} için isim veya görsel eksik." });
                }
                imageContent.Add(new { type = "text", text = $"{i + 1}. Oda: {r.Name}" });
                imageContent.Add(new { type = "image", image = r.Base64 });
            }

            var payload = new
            {
                messages = new object[]
                {
                    new { role = "system", content = "Sen bir deprem güvenlik uzmanısın. Verilen görselleri analiz et ve SADECE gerçek ev/oda fotoğrafları için deprem güvenliği değerlendirmesi yap.\n\nÖNEMLİ KURALLAR:\n1. Görsel gerçek bir oda/ev içi değilse (örn: diyagram, şema, logo, doğa fotoğrafı, vb), o oda için safetyScore=0 ver ve risks alanına 'Bu görsel gerçek bir oda fotoğrafı değil' yaz.\n2. SADECE mobilya, eşya, duvar, pencere gibi fiziksel iç mekan öğeleri varsa puan ver.\n3. Her gerçek oda için deprem güvenliği analizi yap: mobilya sabitlenme durumu, ağır eşyaların konumu, cam yüzeylerin riski, güvenli bölgeler.\n\nYanıt formatı (JSON): {\"rooms\":[{\"name\":\"oda ad\",\"overallSafety\":\"safe|moderate|dangerous\",\"safetyScore\":0-100,\"safeZones\":[...],\"risks\":[{\"type\":...,\"severity\":\"low|medium|high\",\"description\":...,\"recommendation\":...}],\"strengths\":[...],\"actionItems\":[...]}]}" },
                    new { role = "user", content = imageContent.ToArray() }
                }
            };

            _logger.LogInformation("Sending analysis request for {RoomCount} rooms. User has {Remaining} requests remaining.",
                req.Rooms.Count, remaining);
            var result = await llm.AnalyzeRoomsAsync(payload, ct);
            _logger.LogInformation("Received analysis result, length: {ResultLength}", result?.Length ?? 0);

            return Ok(new {
                completion = result,
                requestsRemaining = remaining,
                resetAt = resetAt?.ToString("o")
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error analyzing rooms");
            return StatusCode(500, new { error = "Oda analizi sırasında bir hata oluştu. Lütfen tekrar deneyin.", details = ex.Message });
        }
    }

    [HttpPost("update-safezone-score")]
    public async Task<IActionResult> UpdateSafeZoneScore([FromBody] UpdateScoreRequest req)
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        user.SafeZoneScore = req.Score;
        user.TotalSafetyScore = (user.SafeZoneScore + user.PrepCheckScore) / 2;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    public record UpdateScoreRequest(int Score);
}

