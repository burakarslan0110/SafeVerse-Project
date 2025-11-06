using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SafeVerse.Api.Data;

namespace SafeVerse.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[EnableRateLimiting("HealthPolicy")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ILogger<HealthController> _logger;

    public HealthController(AppDbContext db, ILogger<HealthController> logger)
    {
        _db = db;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        try
        {
            // Basic health check
            var healthStatus = new
            {
                status = "healthy",
                timestamp = DateTime.UtcNow,
                version = "1.0.0",
                environment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "Development"
            };

            return Ok(healthStatus);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Health check failed");
            return StatusCode(503, new { status = "unhealthy", error = ex.Message });
        }
    }

    [HttpGet("ready")]
    public async Task<IActionResult> Ready()
    {
        try
        {
            // Check database connectivity
            await _db.Database.CanConnectAsync();
            
            var readinessStatus = new
            {
                status = "ready",
                timestamp = DateTime.UtcNow,
                database = "connected",
                version = "1.0.0"
            };

            return Ok(readinessStatus);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Readiness check failed");
            return StatusCode(503, new { 
                status = "not ready", 
                database = "disconnected",
                error = ex.Message 
            });
        }
    }

    [HttpGet("live")]
    public IActionResult Live()
    {
        // Simple liveness check - if this endpoint responds, the app is alive
        return Ok(new { 
            status = "alive", 
            timestamp = DateTime.UtcNow 
        });
    }
}