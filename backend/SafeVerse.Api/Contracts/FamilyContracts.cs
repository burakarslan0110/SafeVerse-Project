using System.ComponentModel.DataAnnotations;

namespace SafeVerse.Api.Contracts;

public record FamilyMemberDto(int Id, string Name, string PhoneNumber, string? Role, string Status, string? Avatar);

public record AddMemberRequest(
    [Required, MaxLength(80)] string Name,
    [Required, MaxLength(32)] string PhoneNumber,
    [MaxLength(40)] string? Role
);

public record UpdateSafetyStatusRequest([Required] int MemberId, [Required, RegularExpression("^(safe|unknown|danger)$")] string Status);

public record EmergencyMessageRequest(string? Message);

public record MeetingPointRequest(
    [Required, MaxLength(80)] string Name,
    [Required, MaxLength(200)] string Address,
    [Required] double Latitude,
    [Required] double Longitude
);

