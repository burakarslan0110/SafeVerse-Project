using System.Globalization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SafeVerse.Api.Contracts;

namespace SafeVerse.Api.Controllers;

[ApiController]
[Route("[controller]")]
[Authorize]
public class EarthquakesController : ControllerBase
{
    private readonly IHttpClientFactory _httpFactory;

    public EarthquakesController(IHttpClientFactory httpFactory)
    {
        _httpFactory = httpFactory;
    }

    [HttpGet("kandilli/live")]
    public async Task<IActionResult> GetKandilliLive(CancellationToken cancellationToken)
    {
        var http = _httpFactory.CreateClient();
        using var resp = await http.GetAsync("https://api.orhanaydogdu.com.tr/deprem/kandilli/live", cancellationToken);
        if (!resp.IsSuccessStatusCode)
        {
            return StatusCode((int)resp.StatusCode, new { message = "Kandilli API error" });
        }

        var json = await resp.Content.ReadAsStringAsync(cancellationToken);
        return Content(json, "application/json");
    }

    [HttpGet("afad/live")]
    public async Task<IActionResult> GetAfadLive(CancellationToken cancellationToken)
    {
        var http = _httpFactory.CreateClient();
        using var resp = await http.GetAsync("https://api.orhanaydogdu.com.tr/deprem/afad/live", cancellationToken);
        if (!resp.IsSuccessStatusCode)
        {
            return StatusCode((int)resp.StatusCode, new { message = "AFAD API error" });
        }

        var json = await resp.Content.ReadAsStringAsync(cancellationToken);
        return Content(json, "application/json");
    }

    [HttpGet("nearby")]
    public async Task<ActionResult<IEnumerable<EarthquakeDto>>> GetNearby([FromQuery] double lat, [FromQuery] double lng, [FromQuery] double radius = 100)
    {
        // Fetch last 24h from USGS and filter by radius (km)
        var now = DateTime.UtcNow;
        var start = now.AddDays(-1).ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        var end = now.ToString("yyyy-MM-ddTHH:mm:ss", CultureInfo.InvariantCulture);
        var url = $"https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime={start}&endtime={end}&minmagnitude=2.0&orderby=time";

        var http = _httpFactory.CreateClient();
        var resp = await http.GetAsync(url);
        if (!resp.IsSuccessStatusCode)
        {
            return StatusCode((int)resp.StatusCode, new { message = "USGS API error" });
        }

        using var stream = await resp.Content.ReadAsStreamAsync();
        using var doc = await System.Text.Json.JsonDocument.ParseAsync(stream);
        if (!doc.RootElement.TryGetProperty("features", out var features) || features.ValueKind != System.Text.Json.JsonValueKind.Array)
        {
            return Ok(Array.Empty<EarthquakeDto>());
        }

        var list = new List<EarthquakeDto>();
        foreach (var f in features.EnumerateArray())
        {
            var prop = f.GetProperty("properties");
            var geom = f.GetProperty("geometry");
            var coords = geom.GetProperty("coordinates"); // [lon, lat, depth]
            var lon = coords[0].GetDouble();
            var lat2 = coords[1].GetDouble();
            var depth = coords.GetArrayLength() > 2 ? coords[2].GetDouble() : (double?)null;
            var mag = prop.TryGetProperty("mag", out var magEl) && magEl.ValueKind != System.Text.Json.JsonValueKind.Null ? magEl.GetDouble() : (double?)null;
            var time = prop.GetProperty("time").GetInt64();
            var title = prop.TryGetProperty("title", out var tEl) ? tEl.GetString() ?? "Earthquake" : "Earthquake";

            double? distance = null;
            if (!double.IsNaN(lat) && !double.IsNaN(lng))
            {
                distance = HaversineKm(lat, lng, lat2, lon);
            }

            // Filter by radius
            if (distance.HasValue && distance.Value > radius) continue;

            var dto = new EarthquakeDto(
                Earthquake_Id: f.GetProperty("id").GetString() ?? Guid.NewGuid().ToString(),
                Provider: "USGS",
                Title: title,
                Date: DateTimeOffset.FromUnixTimeMilliseconds(time).UtcDateTime.ToString("O"),
                Mag: mag,
                Depth: depth,
                Geojson: new EarthquakePoint("Point", new[] { lon, lat2 }),
                Location_Properties: new EarthquakeLocationProps(
                    new EarthquakeCity(title, 0, distance ?? 0, 0),
                    null,
                    new List<EarthquakeCity>()
                ),
                Date_Time: DateTimeOffset.FromUnixTimeMilliseconds(time).UtcDateTime.ToString("O"),
                Created_At: time,
                DistanceFromUser: distance
            );

            list.Add(dto);
        }

        // Sorting: nearest first, then newest
        var ordered = list
            .OrderBy(e => e.DistanceFromUser ?? double.MaxValue)
            .ThenByDescending(e => e.Created_At)
            .ToList();

        return Ok(ordered);
    }

    [HttpGet("history")]
    public ActionResult<IEnumerable<object>> GetHistory()
    {
        // Placeholder: Could be implemented to persist queries/history.
        return Ok(Array.Empty<object>());
    }

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0; // Earth radius (km)
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;
}
