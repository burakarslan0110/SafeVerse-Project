using System.Security.Claims;
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
public class EmergencyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LlmClientFactory _llmFactory;
    private readonly ILogger<EmergencyController> _logger;

    public EmergencyController(AppDbContext db, LlmClientFactory llmFactory, ILogger<EmergencyController> logger)
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

    [HttpPost("update-prepcheck-score")]
    public async Task<IActionResult> UpdatePrepCheckScore([FromBody] UpdateScoreRequest req)
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        user.PrepCheckScore = req.Score;
        user.TotalSafetyScore = (user.SafeZoneScore + user.PrepCheckScore) / 2;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("checklist")]
    public async Task<ActionResult<IEnumerable<ChecklistItemDto>>> GetChecklist()
    {
        var uid = GetUserId();
        var recommended = new (string Name, string Category)[]
        {
            ("Su (kişi başı 3 gün)", "Temel"),
            ("Konserve/Yiyecek", "Temel"),
            ("İlk Yardım Çantası", "Sağlık"),
            ("El Feneri", "Ekipman"),
            ("Pil/Powerbank", "Ekipman"),
            ("Battaniye", "Barınma"),
            ("Islak Mendil/Dezenfektan", "Hijyen")
        };

        // Since EmergencyItems table is removed, return static checklist
        var checklist = recommended.Select(r =>
            new ChecklistItemDto(r.Name, r.Category, false, false)
        ).ToList();

        return Ok(checklist);
    }

    [HttpPost("analyze-bag")]
    public async Task<ActionResult<object>> AnalyzeBag([FromBody] AnalyzeBagRequest req, CancellationToken ct)
    {
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
        _logger.LogInformation("Starting PrepCheck analysis using {Client}. Remaining requests: {Remaining}",
            llm.GetType().Name, remaining);

        var payload = new
        {
            messages = new object[]
            {
                new
                {
                    role = "system",
                    content = "Sen bir afet hazırlık uzmanısın. Verilen acil durum çantası fotoğrafını analiz ederek içeriğini değerlendireceksin. Yanıtını sadece geçerli JSON formatında ver, başka hiçbir metin ekleme: {\"overallScore\":0-100,\"totalItems\":sayı,\"presentItems\":sayı,\"missingItems\":sayı,\"expiredItems\":sayı,\"items\":[{\"name\":\"ürün adı\",\"category\":\"kategori\",\"status\":\"present|missing|expired\",\"expiryDate\":\"ISO tarih veya boş\",\"recommendation\":\"öneri\"}],\"missingEssentials\":[\"eksik temel ürün\"],\"recommendations\":[\"genel öneri\"]}"
                },
                new
                {
                    role = "user",
                    content = new object[]
                    {
                        new
                        {
                            type = "text",
                            text = "Bu acil durum çantasının içeriğini analiz et. Deprem için gerekli temel malzemeleri kontrol et: su, yiyecek, ilk yardım malzemeleri, fener, pil, radyo, ilaçlar, kişisel hijyen ürünleri, önemli belgeler, nakit para, battaniye, çok amaçlı bıçak, düdük, eldiven, maske. Yiyeceklerin son kullanma tarihlerini de kontrol et. Yanıtını sadece JSON formatında ver."
                        },
                        new { type = "image", image = req.Base64 }
                    }
                }
            }
        };

        var result = await llm.AnalyzeRoomsAsync(payload, ct);
        _logger.LogInformation("PrepCheck analysis result received. Length: {Length}", result?.Length ?? 0);

        return Ok(new {
            completion = result,
            requestsRemaining = remaining,
            resetAt = resetAt?.ToString("o")
        });
    }

    public record UpdateScoreRequest(int Score);

    public record AnalyzeBagRequest(string Base64);
}
