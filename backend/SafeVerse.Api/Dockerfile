FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80

ENV ASPNETCORE_URLS=http://0.0.0.0:80

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore as distinct layers
COPY SafeVerse.Api/SafeVerse.Api.csproj SafeVerse.Api/
RUN dotnet restore "SafeVerse.Api/SafeVerse.Api.csproj"

# Copy source code
COPY SafeVerse.Api/ SafeVerse.Api/
WORKDIR "/src/SafeVerse.Api"
RUN dotnet publish "SafeVerse.Api.csproj" -c Release -o /app/publish --no-restore

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:80/health || exit 1

ENTRYPOINT ["dotnet", "SafeVerse.Api.dll"]

