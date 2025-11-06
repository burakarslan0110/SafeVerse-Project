using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SafeVerse.Api.Contracts;
using SafeVerse.Api.Data;
using SafeVerse.Api.Models;
using SafeVerse.Api.Services;

namespace SafeVerse.Api.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly PasswordHasher _hasher;
    private readonly JwtTokenService _jwt;

    public AuthController(AppDbContext db, PasswordHasher hasher, JwtTokenService jwt)
    {
        _db = db;
        _hasher = hasher;
        _jwt = jwt;
    }

    [HttpPost("register")]
    [EnableRateLimiting("RegisterPolicy")]
    public async Task<ActionResult<AuthUserDto>> Register([FromBody] RegisterRequest req)
    {
        var exists = await _db.Users.AnyAsync(u => u.Email == req.Email);
        if (exists)
        {
            return Conflict(new { message = "Email zaten kayıtlı" });
        }

        var user = new User
        {
            FirstName = req.FirstName.Trim(),
            LastName = req.LastName.Trim(),
            Email = req.Email.Trim().ToLowerInvariant(),
            PasswordHash = _hasher.Hash(req.Password)
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Ok(new AuthUserDto(user.Id, user.FirstName, user.LastName, user.Email));
    }

    [HttpPost("login")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest req)
    {
        var email = req.Email.Trim().ToLowerInvariant();
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null || !_hasher.Verify(req.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Geçersiz e-posta veya şifre" });
        }

        var fullName = $"{user.FirstName} {user.LastName}";
        var token = _jwt.CreateToken(user.Id, user.Email, fullName);
        return Ok(new AuthResponse(token, new AuthUserDto(user.Id, user.FirstName, user.LastName, user.Email)));
    }

    [Authorize]
    [HttpPost("logout")]
    public IActionResult Logout()
    {
        // JWT stateless, nothing to do on server side
        return NoContent();
    }

    [Authorize]
    [HttpGet("profile")]
    public async Task<ActionResult<AuthUserDto>> GetProfile()
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();
        return Ok(new AuthUserDto(user.Id, user.FirstName, user.LastName, user.Email));
    }

    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<AuthUserDto>> UpdateProfile([FromBody] UpdateProfileRequest req)
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        user.FirstName = req.FirstName.Trim();
        user.LastName = req.LastName.Trim();
        await _db.SaveChangesAsync();
        return Ok(new AuthUserDto(user.Id, user.FirstName, user.LastName, user.Email));
    }

    [Authorize]
    [HttpPut("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        Console.WriteLine($"[ChangePassword] Request received");
        var uid = GetUserId();
        Console.WriteLine($"[ChangePassword] User ID: {uid}");

        var user = await _db.Users.FindAsync(uid);
        if (user == null)
        {
            Console.WriteLine($"[ChangePassword] User not found");
            return NotFound();
        }

        Console.WriteLine($"[ChangePassword] User found: {user.Email}");

        // Verify current password
        if (!_hasher.Verify(req.CurrentPassword, user.PasswordHash))
        {
            Console.WriteLine($"[ChangePassword] Current password verification failed");
            return BadRequest(new { message = "Mevcut şifre yanlış" });
        }

        Console.WriteLine($"[ChangePassword] Current password verified, updating...");

        // Update password
        user.PasswordHash = _hasher.Hash(req.NewPassword);
        await _db.SaveChangesAsync();

        Console.WriteLine($"[ChangePassword] Password updated successfully");
        return NoContent();
    }

    [Authorize]
    [HttpPut("location")]
    public async Task<IActionResult> UpdateLocation([FromBody] UpdateLocationRequest req)
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        user.Latitude = req.Latitude;
        user.Longitude = req.Longitude;
        user.LocationUpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpPut("safety-scores")]
    public async Task<IActionResult> UpdateSafetyScores([FromBody] UpdateSafetyScoresRequest req)
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        if (req.SafeZoneScore.HasValue)
            user.SafeZoneScore = req.SafeZoneScore.Value;

        if (req.PrepCheckScore.HasValue)
            user.PrepCheckScore = req.PrepCheckScore.Value;

        // Calculate total safety score (average of safezone and prepcheck)
        user.TotalSafetyScore = (user.SafeZoneScore + user.PrepCheckScore) / 2;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [Authorize]
    [HttpGet("safety-scores")]
    public async Task<ActionResult<SafetyScoresDto>> GetSafetyScores()
    {
        var uid = GetUserId();
        var user = await _db.Users.FindAsync(uid);
        if (user == null) return NotFound();

        return Ok(new SafetyScoresDto(
            user.SafeZoneScore,
            user.PrepCheckScore,
            user.TotalSafetyScore,
            user.Latitude,
            user.Longitude,
            user.LocationUpdatedAt
        ));
    }

    private int GetUserId()
    {
        var claim = User.FindFirst("uid") ?? User.FindFirst(ClaimTypes.NameIdentifier) ?? User.FindFirst("sub");
        return int.Parse(claim!.Value);
    }
}











