using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SafeVerse.Api.Configuration;
using SafeVerse.Api.Data;
using SafeVerse.Api.Middleware;
using SafeVerse.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Environment-specific configuration
var environment = builder.Environment.EnvironmentName;
var isProduction = builder.Environment.IsProduction();

// Logging configuration
builder.ConfigureLogging();

// Config
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection.GetValue<string>("Key") ??
    Environment.GetEnvironmentVariable("JWT_SECRET_KEY") ??
    throw new InvalidOperationException("JWT Secret Key is required. Set JWT_SECRET_KEY environment variable or Jwt:Key in appsettings.json");
var jwtIssuer = jwtSection.GetValue<string>("Issuer") ??
    throw new InvalidOperationException("JWT Issuer is required. Set JWT_ISSUER environment variable or Jwt:Issuer in appsettings.json");
var jwtAudience = jwtSection.GetValue<string>("Audience") ??
    throw new InvalidOperationException("JWT Audience is required. Set JWT_AUDIENCE environment variable or Jwt:Audience in appsettings.json");

// Add services
builder.Services.AddControllers();
builder.Services.AddRouting(options => options.LowercaseUrls = true);
builder.Services.AddEndpointsApiExplorer();

// Swagger only in development
if (!isProduction)
{
    builder.Services.AddSwaggerGen();
}

// DbContext (PostgreSQL) - Environment variable is required
var connStr = Environment.GetEnvironmentVariable("DATABASE_URL") ??
    builder.Configuration.GetConnectionString("Default") ??
    throw new InvalidOperationException("Database connection string is required. Set DATABASE_URL environment variable or ConnectionStrings:Default in appsettings.json");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connStr));

// Health checks
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>()
    .AddNpgSql(connStr);

// CORS - Production-ready configuration
var corsOrigins = builder.Configuration.GetSection("CORS:AllowedOrigins").Get<string[]>() ?? Array.Empty<string>();

builder.Services.AddCors(options =>
{
    if (isProduction)
    {
        options.AddPolicy("ProductionCors", policy =>
            policy.WithOrigins(corsOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .AllowCredentials());
    }
    else
    {
        options.AddPolicy("DevelopmentCors", policy =>
            policy.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
    }
});

// Rate Limiting
builder.Services.ConfigureRateLimiting(builder.Configuration);

// JWT Auth
builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
            ClockSkew = TimeSpan.FromMinutes(5)
        };
    });

builder.Services.AddAuthorization();

// HTTPS Redirection in production
if (isProduction)
{
    builder.Services.AddHttpsRedirection(options =>
    {
        options.RedirectStatusCode = StatusCodes.Status308PermanentRedirect;
        options.HttpsPort = 443;
    });

    builder.Services.AddHsts(options =>
    {
        options.Preload = true;
        options.IncludeSubDomains = true;
        options.MaxAge = TimeSpan.FromDays(365);
    });
}

// App Services
builder.Services.AddSingleton<JwtTokenService>(sp => new JwtTokenService(jwtIssuer, jwtAudience, jwtKey));
builder.Services.AddScoped<PasswordHasher>();
builder.Services.AddScoped<LlmClientFactory>();
builder.Services.AddHttpClient();

var app = builder.Build();

// Ensure DB exists and apply migrations with retry logic
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // Log the connection string for debugging (mask password)
    var connectionString = db.Database.GetConnectionString() ?? "null";
    var maskedConnStr = System.Text.RegularExpressions.Regex.Replace(connectionString, @"Password=[^;]+", "Password=***");
    logger.LogInformation($"Database connection string: {maskedConnStr}");

    var maxRetries = 30;
    var delaySeconds = 3;

    for (int i = 0; i < maxRetries; i++)
    {
        try
        {
            logger.LogInformation($"Attempting database migration (attempt {i + 1}/{maxRetries})...");

            // First try to open a connection to check if DB is reachable
            await db.Database.CanConnectAsync();
            logger.LogInformation("Database connection successful, applying migrations...");

            // Set lock timeout to prevent waiting indefinitely on migration locks
            await db.Database.ExecuteSqlRawAsync("SET lock_timeout = '10s'");

            // Apply migrations
            await db.Database.MigrateAsync();
            logger.LogInformation("Database migrations applied successfully");
            break;
        }
        catch (Npgsql.NpgsqlException ex) when ((ex.Message.Contains("lock_timeout") || ex.Message.Contains("Resource temporarily unavailable") || ex.Message.Contains("deadlock")) && i < maxRetries - 1)
        {
            logger.LogWarning($"Database migration attempt {i + 1} failed due to lock/resource conflict. Another instance may be migrating. Retrying in {delaySeconds} seconds...");
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
        }
        catch (Exception ex) when (i < maxRetries - 1)
        {
            logger.LogWarning($"Database migration attempt {i + 1} failed: {ex.Message}. Retrying in {delaySeconds} seconds...");
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error applying database migrations after all retries");
            throw;
        }
    }
}

// Configure pipeline
if (isProduction)
{
    app.UseHsts();
    // REMOVED: app.UseHttpsRedirection(); - Traefik handles HTTPS
    app.UseMiddleware<SecurityHeadersMiddleware>();
}
else
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// CORS must be before rate limiting and auth
app.UseCors(isProduction ? "ProductionCors" : "DevelopmentCors");

// Rate limiting
app.UseRateLimiter();

// Authentication & Authorization
app.UseAuthentication();
app.UseAuthorization();

// Health checks
if (isProduction)
{
    app.MapHealthChecks("/health");
    app.MapHealthChecks("/health/ready");
    app.MapHealthChecks("/health/live");
}
else
{
    app.MapHealthChecks("/health");
    app.MapHealthChecks("/health/ready");
    app.MapHealthChecks("/health/live");
}

// Path base handled by Traefik reverse proxy with stripprefix middleware

// Controllers
app.MapControllers();

app.Run();

namespace SafeVerse.Api
{
    public partial class Program { }
}

