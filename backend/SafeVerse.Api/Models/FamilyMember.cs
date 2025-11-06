using System.ComponentModel.DataAnnotations;

namespace SafeVerse.Api.Models;

public class FamilyMember
{
    public int Id { get; set; }
    public int UserId { get; set; }

    [Required, MaxLength(80)]
    public string Name { get; set; } = string.Empty;

    [Required, MaxLength(32)]
    public string PhoneNumber { get; set; } = string.Empty;

    [MaxLength(40)]
    public string? Role { get; set; }

    [Required, MaxLength(16)]
    public string Status { get; set; } = "unknown"; // safe | unknown | danger

    public string? Avatar { get; set; }
}

