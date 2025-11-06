using System.ComponentModel.DataAnnotations;

namespace SafeVerse.Api.Contracts;

public record EmergencyItemDto(int Id, string Name, string Category, bool IsChecked, DateTime? ExpiryDate);

public record AddItemRequest(
    [Required, MaxLength(100)] string Name,
    [Required, MaxLength(50)] string Category,
    DateTime? ExpiryDate
);

public record UpdateItemRequest(
    [MaxLength(100)] string? Name,
    [MaxLength(50)] string? Category,
    DateTime? ExpiryDate
);

public record UpdateCheckRequest([Required] bool IsChecked);

public record ChecklistItemDto(string Name, string Category, bool Present, bool Expired);

