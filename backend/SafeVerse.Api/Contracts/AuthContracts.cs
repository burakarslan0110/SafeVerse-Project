using System.ComponentModel.DataAnnotations;

namespace SafeVerse.Api.Contracts;

public record RegisterRequest(
    [Required, MaxLength(50)] string FirstName,
    [Required, MaxLength(50)] string LastName,
    [Required, EmailAddress, MaxLength(160)] string Email,
    [Required, MinLength(6), MaxLength(128)] string Password
);

public record LoginRequest(
    [Required, EmailAddress, MaxLength(160)] string Email,
    [Required, MinLength(6), MaxLength(128)] string Password
);

public record AuthUserDto(int Id, string FirstName, string LastName, string Email);
public record AuthResponse(string Token, AuthUserDto User);

public record UpdateProfileRequest(
    [Required, MaxLength(50)] string FirstName,
    [Required, MaxLength(50)] string LastName
);

public record ChangePasswordRequest(
    [Required, MinLength(6)] string CurrentPassword,
    [Required, MinLength(6)] string NewPassword
);

public record UpdateLocationRequest(
    [Required] double Latitude,
    [Required] double Longitude
);

public record UpdateSafetyScoresRequest(
    int? SafeZoneScore,
    int? PrepCheckScore
);

public record SafetyScoresDto(
    int SafeZoneScore,
    int PrepCheckScore,
    int TotalSafetyScore,
    double? Latitude,
    double? Longitude,
    DateTime? LocationUpdatedAt
);

