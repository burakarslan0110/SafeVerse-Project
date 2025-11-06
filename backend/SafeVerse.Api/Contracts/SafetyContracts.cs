using System.ComponentModel.DataAnnotations;

namespace SafeVerse.Api.Contracts;

public record AnalyzeImageRequest([Required] string Base64, string? RoomName);

public record HazardDto(int Id, string Description, string Severity, bool IsFixed, DateTime CreatedAt);

