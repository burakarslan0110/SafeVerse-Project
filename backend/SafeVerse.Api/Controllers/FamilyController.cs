using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SafeVerse.Api.Contracts;
using SafeVerse.Api.Data;
using SafeVerse.Api.Models;

namespace SafeVerse.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class FamilyController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IHttpClientFactory _httpClientFactory;

    public FamilyController(AppDbContext db, IHttpClientFactory httpClientFactory)
    {
        _db = db;
        _httpClientFactory = httpClientFactory;
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("uid") ?? User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return int.Parse(claim!.Value);
    }

    [HttpGet("members")]
    public async Task<ActionResult<IEnumerable<FamilyMemberDto>>> GetMembers()
    {
        var uid = GetUserId();
        var members = await _db.FamilyMembers.Where(f => f.UserId == uid)
            .OrderBy(f => f.Name)
            .Select(f => new FamilyMemberDto(f.Id, f.Name, f.PhoneNumber, f.Role, f.Status, f.Avatar))
            .ToListAsync();
        return Ok(members);
    }

    [HttpPost("members")]
    public async Task<ActionResult<FamilyMemberDto>> AddMember([FromBody] AddMemberRequest req)
    {
        var uid = GetUserId();
        var member = new FamilyMember
        {
            UserId = uid,
            Name = req.Name.Trim(),
            PhoneNumber = req.PhoneNumber.Trim(),
            Role = string.IsNullOrWhiteSpace(req.Role) ? null : req.Role!.Trim(),
            Status = "unknown"
        };
        _db.FamilyMembers.Add(member);
        await _db.SaveChangesAsync();
        return Ok(new FamilyMemberDto(member.Id, member.Name, member.PhoneNumber, member.Role, member.Status, member.Avatar));
    }

    [HttpDelete("members/{id:int}")]
    public async Task<IActionResult> RemoveMember([FromRoute] int id)
    {
        var uid = GetUserId();
        var member = await _db.FamilyMembers.FirstOrDefaultAsync(f => f.Id == id && f.UserId == uid);
        if (member == null) return NotFound();
        _db.FamilyMembers.Remove(member);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("safety-status")]
    public async Task<IActionResult> UpdateSafetyStatus([FromBody] UpdateSafetyStatusRequest req)
    {
        var uid = GetUserId();
        var member = await _db.FamilyMembers.FirstOrDefaultAsync(f => f.Id == req.MemberId && f.UserId == uid);
        if (member == null) return NotFound();
        member.Status = req.Status;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("emergency-message")]
    public IActionResult SendEmergencyMessage([FromBody] EmergencyMessageRequest req)
    {
        // Stub: actual SMS sending would integrate with an SMS provider
        // Logically succeed to allow UI to proceed
        return Ok(new { sent = true });
    }

    [HttpPost("meeting-point")]
    public async Task<ActionResult<MeetingPoint>> SetMeetingPoint([FromBody] MeetingPointRequest req)
    {
        var uid = GetUserId();

        // Remove existing meeting point for user (only one)
        var existing = await _db.MeetingPoints.Where(m => m.UserId == uid).ToListAsync();
        if (existing.Count > 0)
        {
            _db.MeetingPoints.RemoveRange(existing);
        }

        var mp = new MeetingPoint
        {
            UserId = uid,
            Name = req.Name.Trim(),
            Address = req.Address.Trim(),
            Latitude = req.Latitude,
            Longitude = req.Longitude,
            CreatedAt = DateTime.UtcNow
        };
        _db.MeetingPoints.Add(mp);
        await _db.SaveChangesAsync();
        return Ok(mp);
    }

    [HttpGet("reverse-geocode")]
    public async Task<ActionResult<object>> ReverseGeocode([FromQuery] double lat, [FromQuery] double lon)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.DefaultRequestHeaders.Add("User-Agent", "SafeVerse-App/1.0");

            // Try Photon API first (CORS-friendly, OpenStreetMap-based)
            try
            {
                var photonUrl = $"https://photon.komoot.io/reverse?lon={lon}&lat={lat}";
                var photonResponse = await client.GetAsync(photonUrl);

                if (photonResponse.IsSuccessStatusCode)
                {
                    var photonContent = await photonResponse.Content.ReadAsStringAsync();
                    var photonData = JsonDocument.Parse(photonContent);

                    if (photonData.RootElement.TryGetProperty("features", out var features) && features.GetArrayLength() > 0)
                    {
                        var props = features[0].GetProperty("properties");
                        var city = GetPropertyOrDefault(props, "city")
                                ?? GetPropertyOrDefault(props, "town")
                                ?? GetPropertyOrDefault(props, "village")
                                ?? GetPropertyOrDefault(props, "state")
                                ?? "Bilinmeyen Şehir";

                        var district = GetPropertyOrDefault(props, "district")
                                    ?? GetPropertyOrDefault(props, "suburb")
                                    ?? GetPropertyOrDefault(props, "neighbourhood")
                                    ?? GetPropertyOrDefault(props, "locality")
                                    ?? "Bilinmeyen İlçe";

                        return Ok(new { city, district, source = "photon" });
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Photon API error: {ex.Message}");
            }

            // Fallback to Nominatim API
            var nominatimUrl = $"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1";
            var nominatimResponse = await client.GetAsync(nominatimUrl);

            if (nominatimResponse.IsSuccessStatusCode)
            {
                var nominatimContent = await nominatimResponse.Content.ReadAsStringAsync();
                var nominatimData = JsonDocument.Parse(nominatimContent);

                if (nominatimData.RootElement.TryGetProperty("address", out var address))
                {
                    var city = GetPropertyOrDefault(address, "city")
                            ?? GetPropertyOrDefault(address, "town")
                            ?? GetPropertyOrDefault(address, "village")
                            ?? GetPropertyOrDefault(address, "state")
                            ?? "Bilinmeyen Şehir";

                    var district = GetPropertyOrDefault(address, "suburb")
                                ?? GetPropertyOrDefault(address, "neighbourhood")
                                ?? GetPropertyOrDefault(address, "quarter")
                                ?? GetPropertyOrDefault(address, "district")
                                ?? "Bilinmeyen İlçe";

                    return Ok(new { city, district, source = "nominatim" });
                }
            }

            return Ok(new { city = "Bilinmeyen Şehir", district = "Bilinmeyen İlçe", source = "fallback" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Reverse geocode error: {ex.Message}");
            return Ok(new { city = "Bilinmeyen Şehir", district = "Bilinmeyen İlçe", source = "error" });
        }
    }

    private string? GetPropertyOrDefault(JsonElement element, string propertyName)
    {
        if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind == JsonValueKind.String)
        {
            var value = prop.GetString();
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }
        return null;
    }
}

