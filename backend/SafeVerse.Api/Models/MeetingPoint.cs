using System.ComponentModel.DataAnnotations;

namespace SafeVerse.Api.Models;

public class MeetingPoint
{
    public int Id { get; set; }
    public int UserId { get; set; }

    [Required, MaxLength(80)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(200)]
    public string Address { get; set; } = string.Empty;

    public double Latitude { get; set; }
    public double Longitude { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

