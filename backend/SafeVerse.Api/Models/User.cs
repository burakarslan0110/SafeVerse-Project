using System.ComponentModel.DataAnnotations;

namespace SafeVerse.Api.Models;

public class User
{
    public int Id { get; set; }

    [Required, MaxLength(50)]
    public string FirstName { get; set; } = string.Empty;

    [Required, MaxLength(50)]
    public string LastName { get; set; } = string.Empty;

    [Required, MaxLength(160)]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string PasswordHash { get; set; } = string.Empty;

    // Safety Scores
    public int SafeZoneScore { get; set; } = 0;
    public int PrepCheckScore { get; set; } = 0;
    public int TotalSafetyScore { get; set; } = 0;

    // AI Request Limits (2 requests per day for each service)
    public int DailyAiRequestsRemaining { get; set; } = 2;
    public DateTime? AiRequestsResetAt { get; set; }

    // Location
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public DateTime? LocationUpdatedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

