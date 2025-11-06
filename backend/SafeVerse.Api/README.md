# SafeVerse Backend API

ASP.NET Core 8 Web API for the SafeVerse earthquake safety application.

## 📁 Project Structure

```
SafeVerse.Api/
├── Controllers/                # API endpoints
│   ├── AuthController.cs      # Authentication (register, login, profile)
│   ├── FamilyController.cs    # Family members management
│   ├── SafetyController.cs    # SafeZone AI analysis
│   ├── EmergencyController.cs # PrepCheck bag management
│   ├── EarthquakesController.cs # Earthquake data
│   └── HealthController.cs    # Health check endpoint
├── Models/                     # Database entities
│   ├── User.cs                # User model
│   ├── FamilyMember.cs        # Family member model
│   ├── MeetingPoint.cs        # Meeting point model
│   └── ...                    # Other models
├── Services/                   # Business logic and services
│   ├── JwtTokenService.cs     # JWT token generation
│   ├── PasswordHasher.cs      # Password hashing (BCrypt)
│   └── LlmClientFactory.cs    # AI service management
├── Middleware/                 # Custom middlewares
│   └── SecurityHeadersMiddleware.cs
├── Configuration/              # Configuration classes
│   ├── LoggingConfiguration.cs
│   └── RateLimitConfiguration.cs
├── Data/
│   └── AppDbContext.cs        # Entity Framework DbContext
├── Migrations/                 # Database migrations
├── Contracts/                  # DTOs and contracts
├── Program.cs                  # Application entry point
├── appsettings.json           # Configuration file
├── appsettings.Production.json # Production settings
└── Dockerfile                 # Docker build configuration
```

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|----------|---------|
| **ASP.NET Core** | 8.0 | Web API framework |
| **C#** | 12.0 | Programming language |
| **Entity Framework Core** | 8.0 | ORM (Object-Relational Mapping) |
| **PostgreSQL** | 14 | Relational database |
| **JWT Bearer** | - | Authentication |
| **Npgsql** | - | PostgreSQL driver for .NET |
| **BCrypt** | - | Password hashing |

## 🔐 Authentication

### JWT Authentication

- Uses JWT Bearer tokens for authentication
- Token expiration: 7 days (configurable)
- Tokens include: userId, email, name
- Automatic token validation on protected endpoints

### Password Security

- Passwords hashed using BCrypt
- Minimum password length enforced (8 characters)
- Never stored in plain text

## 📡 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login (returns JWT token) | No |
| GET | `/profile` | Get user profile | Yes |
| PUT | `/profile` | Update user profile | Yes |
| POST | `/location` | Update user location | Yes |

### Family (`/api/family`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/members` | List all family members | Yes |
| POST | `/members` | Add new family member | Yes |
| PUT | `/members/{id}` | Update family member | Yes |
| DELETE | `/members/{id}` | Delete family member | Yes |
| POST | `/safety-status` | Update safety status | Yes |
| POST | `/meeting-point` | Create meeting point | Yes |
| GET | `/meeting-point` | Get active meeting point | Yes |

### Safety (`/api/safety`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/analyze-image` | Single room analysis (AI) | Yes |
| POST | `/analyze-rooms` | Multiple room analysis (AI) | Yes |
| GET | `/hazards` | Get detected hazards | Yes |
| POST | `/hazards` | Add new hazard | Yes |
| PATCH | `/hazards/{id}` | Update hazard status | Yes |
| DELETE | `/hazards/{id}` | Delete hazard | Yes |

### Emergency Bag (`/api/emergency`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/items` | List all bag items | Yes |
| POST | `/items` | Add new item | Yes |
| PUT | `/items/{id}` | Update item | Yes |
| PATCH | `/items/{id}` | Check/uncheck item | Yes |
| DELETE | `/items/{id}` | Delete item | Yes |
| GET | `/checklist` | Get ready-made checklist | Yes |

### Earthquakes (`/api/earthquakes`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/nearby?lat=x&lng=y&radius=150` | Get nearby earthquakes | Yes |

### Health Check

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/health` | Health check endpoint | No |

## 🤖 AI/LLM Integration

The API supports multiple AI providers for home safety analysis:

### Supported Providers

1. **Third-Party LLM** - Custom HTTP endpoint
2. **Google Gemini** - Google's AI service
3. **Mock LLM** - For development/testing

### Provider Configuration

Set via `LLM_PROVIDER` environment variable:

- `fallback` (recommended): Third-party LLM → Gemini → Mock
- `http`: Third-party LLM only
- `gemini`: Google Gemini only
- `mock`: Mock data for testing

### LlmClientFactory

The `LlmClientFactory` service manages AI provider initialization and fallback logic:

```csharp
// Configured in Program.cs
services.AddSingleton<LlmClientFactory>();

// Usage in controllers
var llmClient = _llmClientFactory.CreateClient();
var analysis = await llmClient.AnalyzeRoomSafety(imageData);
```

## 🗄️ Database

### PostgreSQL Configuration

- Database: PostgreSQL 14+
- ORM: Entity Framework Core
- Connection string format:
  ```
  Host=db;Database=safeverse;Username=postgres;Password=yourpassword;Port=5432
  ```

### Migrations

Migrations are **automatically applied on startup** with retry logic:

```csharp
// Program.cs:137-150
// Retries: 30 times with 3-second delay
// Handles concurrent deployment scenarios
```

Manual migration commands:

```bash
# Create migration
dotnet ef migrations add MigrationName

# Apply migrations
dotnet ef database update

# Rollback migration
dotnet ef database update PreviousMigrationName

# Remove last migration
dotnet ef migrations remove
```

### DbContext

The `AppDbContext` includes:
- Users
- FamilyMembers
- MeetingPoints
- EmergencyBagItems
- SafetyHazards
- NotificationHistory

## ⚙️ Configuration

### Environment Variables

Required:

```bash
DATABASE_URL=Host=db;Database=safeverse;Username=postgres;Password=yourpassword;Port=5432
JWT_SECRET_KEY=your-secret-key-min-32-characters
JWT_ISSUER=SafeVerse
JWT_AUDIENCE=SafeVerseClient
CORS_ORIGIN_1=http://localhost:3000
```

Optional:

```bash
CORS_ORIGIN_2=https://yourdomain.com
CORS_ORIGIN_3=https://www.yourdomain.com
LLM_PROVIDER=fallback
LLM_ENDPOINT=http://your-llm-service
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash-exp
ASPNETCORE_ENVIRONMENT=Production
```

### appsettings.json

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ConnectionStrings": {
    "DefaultConnection": "Host=db;Database=safeverse;..."
  },
  "Jwt": {
    "SecretKey": "${JWT_SECRET_KEY}",
    "Issuer": "${JWT_ISSUER}",
    "Audience": "${JWT_AUDIENCE}",
    "ExpirationDays": 7
  }
}
```

## 🔒 Security Features

### Development Mode

- Swagger UI enabled
- Detailed error logs
- CORS open to all origins
- No security headers
- No HTTPS redirect

### Production Mode

- Swagger UI disabled
- Restricted CORS (only specified origins)
- Security headers enabled:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: no-referrer`
  - `Content-Security-Policy`
- HSTS enabled
- Rate limiting enabled
- Limited error details

### Middleware Pipeline

```csharp
// Order matters!
app.UseSecurityHeaders();         // 1. Security headers
app.UseHttpsRedirection();        // 2. HTTPS redirect
app.UseCors();                    // 3. CORS
app.UseAuthentication();          // 4. Authentication
app.UseAuthorization();           // 5. Authorization
app.MapControllers();             // 6. Route endpoints
```

## 🚀 Development Setup

### Prerequisites

- .NET 8 SDK
- PostgreSQL 14+ (or use Docker)
- Optional: Docker & Docker Compose

### Running Locally

```bash
cd backend/SafeVerse.Api

# Restore dependencies
dotnet restore

# Update database
dotnet ef database update

# Run in development mode
dotnet run

# Run with watch mode (auto-reload)
dotnet watch run
```

API will be available at `http://localhost:5000` (or port specified in launchSettings.json).

### Running with Docker

From project root:

```bash
# Start all services (PostgreSQL + API)
docker-compose up --build

# View API logs
docker-compose logs -f api

# Connect to API container
docker-compose exec api sh

# Stop services
docker-compose down
```

API will be available at `http://localhost:8080`.

## 🧪 Testing

### Manual Testing with Swagger

1. Start API in Development mode
2. Navigate to `http://localhost:5000/swagger`
3. Test endpoints interactively

### Testing with cURL

```bash
# Register user
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Get profile (with token)
curl -X GET http://localhost:8080/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📦 Building & Deployment

### Docker Build

```bash
# Build image
docker build -t safeverse-api -f backend/SafeVerse.Api/Dockerfile .

# Run container
docker run -p 8080:80 \
  -e DATABASE_URL="Host=db;Database=safeverse;..." \
  -e JWT_SECRET_KEY="your-secret-key" \
  safeverse-api
```

### Production Checklist

- [ ] Set strong `JWT_SECRET_KEY` (min 32 characters)
- [ ] Configure `DATABASE_URL` with production credentials
- [ ] Set `ASPNETCORE_ENVIRONMENT=Production`
- [ ] Add actual domains to `CORS_ORIGIN_*` variables
- [ ] Configure `GEMINI_API_KEY` (for AI fallback)
- [ ] Set up PostgreSQL backups
- [ ] Configure monitoring and logging
- [ ] Set up SSL/TLS certificates
- [ ] Enable firewall rules

## 🌐 Deployment Platforms

SafeVerse API can be deployed on:

- **Coolify** (recommended for self-hosting)
- **Railway**
- **Render**
- **Fly.io**
- **DigitalOcean App Platform**
- **AWS ECS / Fargate**
- **Azure Container Apps**
- **Google Cloud Run**
- **Any Docker-compatible platform**

## 📝 Notes

### Database Connection

- Database runs on port 5432 inside Docker network
- Use `Host=db` when connecting from containers
- Use `Host=localhost` when connecting from host machine

### Migrations on Startup

- Migrations are automatically applied on container start
- Retry logic handles concurrent deployments
- 30 retries with 3-second delay between attempts

### CORS Configuration

- Development: Allows all origins
- Production: Only allows origins specified in `CORS_ORIGIN_*` variables
- Must include frontend URL(s) in production

### Rate Limiting

- Enabled in production mode
- Configurable via `RateLimitConfiguration.cs`
- Default: 100 requests per minute per IP

## 🔗 Related Documentation

- [Main README](../../README.md) - Project overview and setup
- [Frontend README](../../frontend/README.md) - Frontend documentation
- [CLAUDE.md](../../CLAUDE.md) - AI assistant instructions

---

**Built with ❤️ for earthquake safety and preparedness**
