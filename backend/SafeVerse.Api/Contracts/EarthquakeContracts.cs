namespace SafeVerse.Api.Contracts;

public record EarthquakePoint(string Type, double[] Coordinates);

public record EarthquakeCity(string Name, int CityCode, double Distance, int Population);

public record EarthquakeLocationProps(EarthquakeCity ClosestCity, EarthquakeCity? EpiCenter, List<EarthquakeCity> ClosestCities);

public record EarthquakeDto(
    string Earthquake_Id,
    string Provider,
    string Title,
    string Date,
    double? Mag,
    double? Depth,
    EarthquakePoint Geojson,
    EarthquakeLocationProps Location_Properties,
    string Date_Time,
    long Created_At,
    double? DistanceFromUser
);

