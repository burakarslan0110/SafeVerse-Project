# SafeVerse Frontend

React Native/Expo mobile and web application for earthquake safety and preparedness.

## 📁 Project Structure

```
frontend/
├── app/                        # Expo Router pages
│   ├── (tabs)/                 # Tab navigation screens
│   │   ├── index.tsx          # Home dashboard
│   │   ├── family.tsx         # Family tracking
│   │   ├── profile.tsx        # User profile & settings
│   │   └── notifications.tsx  # Notifications list
│   ├── login.tsx              # Login screen
│   ├── register.tsx           # Registration screen
│   ├── home-security.tsx      # SafeZone home analysis
│   ├── emergency-bag.tsx      # PrepCheck bag management
│   ├── nearby-earthquakes.tsx # Earthquake list
│   ├── earthquake-simulation.tsx # Safety simulation
│   └── _layout.tsx            # Root layout & provider hierarchy
├── components/                 # Reusable React components
│   ├── ui/                    # Basic UI components
│   ├── SafeZoneCard.tsx       # Home safety feature card
│   ├── PrepCheckCard.tsx      # Emergency bag card
│   ├── FamilyMemberCard.tsx   # Family member card
│   └── NotificationBanner.tsx # In-app notification banner
├── contexts/                   # React Context API (state management)
│   ├── AuthContext.tsx        # Authentication & user state
│   ├── LocationContext.tsx    # GPS tracking & earthquake monitoring
│   ├── NotificationContext.tsx # Push notifications
│   ├── FamilyContext.tsx      # Family members management
│   ├── SafeZoneContext.tsx    # Home safety analysis
│   └── EmergencyBagContext.tsx # Emergency bag items
├── lib/                       # Core utilities
│   ├── api.ts                 # Axios HTTP client
│   ├── storage.ts             # AsyncStorage wrapper
│   └── utils.ts               # Helper functions
├── services/                   # API service layer
├── utils/                      # Additional utilities
├── assets/                     # Images, fonts, and media
├── web/                        # Web-specific files
├── Dockerfile.web              # Docker build for web app
├── nginx.conf                  # Nginx configuration for web
├── package.json                # Dependencies & scripts
└── tsconfig.json               # TypeScript configuration
```

## 🛠️ Tech Stack

| Technology | Version | Purpose |
|-----------|----------|---------|
| **React Native** | 0.81.4 | Cross-platform mobile framework |
| **Expo** | ~54.0.0 | Development tooling & APIs |
| **TypeScript** | ~5.9.2 | Type safety |
| **Expo Router** | ~6.0.7 | File-based navigation |
| **Axios** | ^1.7.7 | HTTP requests |
| **AsyncStorage** | 2.2.0 | Local persistence |
| **Expo Location** | ~19.0.0 | GPS tracking |
| **Expo Notifications** | ^0.32.11 | Push notifications |
| **Expo SMS** | ~14.0.0 | SMS functionality |
| **React Native Maps** | 1.20.1 | Map display |
| **Lucide React Native** | ^0.475.0 | Icon library |

## 🏗️ Architecture

### Context Provider Hierarchy

The app uses React Context for state management with a **specific hierarchy**. This order is critical because contexts have dependencies:

```typescript
SafeAreaProvider
└── ThemeProvider
    └── NavigationBlockerProvider
        └── AuthProvider                  // 1. Authentication
            └── ProtectedRoute           // 2. Route guards
                └── SafeZoneProvider     // 3. Home safety
                    └── EmergencyBagProvider  // 4. Emergency bag
                        └── NotificationProvider  // 5. Push notifications
                            └── LocationProvider  // 6. GPS & earthquake tracking
                                └── FamilyProvider  // 7. Family members
                                    └── App Content
```

**Dependencies:**
- `LocationProvider` requires `AuthProvider` (for API token)
- `NotificationProvider` requires `LocationProvider` (for earthquake proximity checks)
- `FamilyProvider` requires `LocationProvider` (for location sharing)

**⚠️ Never modify this hierarchy without understanding the dependencies.**

### Key Context Providers

#### AuthContext (`contexts/AuthContext.tsx`)
- Manages authentication state (login/logout/register)
- Stores user profile and JWT token (AsyncStorage)
- Tracks safety scores (SafeZone + PrepCheck)
- Updates user location to backend every 5 minutes

#### LocationContext (`contexts/LocationContext.tsx`)
- GPS location tracking with 5-minute refresh interval
- Handles both native (expo-location) and web (navigator.geolocation) APIs
- Caches location in AsyncStorage (30-minute stale time)
- Checks for nearby earthquakes (150km radius, mag >= 3.0) every 2 minutes
- Only active when user is authenticated

#### NotificationContext (`contexts/NotificationContext.tsx`)
- Manages push notifications via expo-notifications
- Checks for new earthquakes and sends alerts
- Provides `NotificationBanner` component for in-app notifications

#### FamilyContext (`contexts/FamilyContext.tsx`)
- Manages family members and emergency contacts
- Handles bulk SMS sending via expo-sms
- Coordinates meeting point sharing
- Depends on LocationProvider for user location

### Path Aliases

TypeScript path alias `@/*` maps to the project root:

```typescript
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/lib/api';
```

Configured in `tsconfig.json`.

## 🔧 Development Setup

### Prerequisites

From the **project root** directory:

```bash
# Install dependencies (must be run from project root)
npm install
```

### Environment Variables

Create `.env` file in the **project root**:

```bash
# Backend API URL (no /api suffix)
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.101:8080

# HTTPS setting
EXPO_USE_HTTPS=true
```

**Important:** For mobile device testing, use your local network IP, not `localhost`.

### Running the App

From the **project root**:

```bash
# Start Expo dev server with tunnel (for mobile devices)
npm start

# Platform-specific startup
npm run android         # Android device/emulator
npm run ios            # iOS device/simulator
npm run web            # Web browser

# Linting
npm run lint

# Start backend services (PostgreSQL + API)
npm run dev:compose
```

### Docker Build (Web)

Build web application:

```bash
# From project root
docker-compose up --build web
```

The web app will be available at `http://localhost:3000`.

## 📱 Platform-Specific Notes

### Web Platform
- Uses `localStorage` instead of AsyncStorage
- Falls back to Ankara coordinates (39.9334, 32.8597) for non-HTTPS contexts
- Location API requires HTTPS in browsers
- Service worker registered for PWA functionality
- PWA install prompt handled via `window.__pwaDeferredPrompt`
- Build process: Bun + Expo export → nginx static hosting

### Mobile Platform
- Uses AsyncStorage for persistence
- Background location tracking enabled for iOS/Android
- Requires permissions: location (always), contacts, SMS, notifications
- Location service checks with automatic prompts to enable GPS
- Force location service enable dialog on Android

## 🔐 Authentication Flow

1. On app start, checks AsyncStorage for JWT token
2. If token exists, fetches fresh profile from `/auth/profile`
3. Updates local user state and safety scores
4. If token invalid (401), clears token and redirects to login

## 📡 API Integration

### API Client (`lib/api.ts`)

Axios-based HTTP client with:
- Automatic JWT token injection from AsyncStorage
- Automatic 401 handling (token expiration)
- Base URL from environment: `EXPO_PUBLIC_API_BASE_URL`

### Key Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile
- `POST /api/auth/location` - Update user location
- `GET /api/earthquakes/nearby` - Get nearby earthquakes
- `POST /api/safety/analyze-image` - AI safety analysis
- `GET /api/emergency/items` - Get emergency bag items
- `GET /api/family/members` - Get family members

## 🎨 Routing

Uses **Expo Router** (file-based routing):

- `app/(tabs)/` - Tab navigation pages
- `app/login.tsx`, `app/register.tsx` - Auth screens
- `app/home-security.tsx` - SafeZone room analysis
- `app/emergency-bag.tsx` - PrepCheck checklist
- `app/nearby-earthquakes.tsx` - Earthquake list
- `app/earthquake-simulation.tsx` - Safety simulation

### Protected Routes

`ProtectedRoute` component (`components/ProtectedRoute.tsx`):
- Wraps entire app to guard authenticated routes
- Redirects unauthenticated users to `/login`
- Redirects authenticated users from auth screens to `/(tabs)`

Protected routes: `(tabs)`, `home-security`, `emergency-bag`, `nearby-earthquakes`, `earthquake-simulation`, `change-password`, `notification-settings`, `help-support`

## 🚨 Earthquake Monitoring

- Uses Kandilli Observatory API (`api.orhanaydogdu.com.tr/deprem/kandilli/live`)
- Checks every 2 minutes for new earthquakes
- Filters by distance (150km) and magnitude (>= 3.0)
- Sends push notifications for nearby earthquakes
- Stores notification history locally

## 📊 Safety Scores

Two scores tracked:
- `safeZoneScore` - Home safety analysis score (0-100)
- `prepCheckScore` - Emergency preparedness score (0-100)
- `totalSafetyScore` - Combined score displayed to user

## 🧪 Testing & Quality

- ESLint configured with `expo` preset
- TypeScript strict mode enabled
- No test suite currently configured

## 🌐 Building for Production

### Web Build

```bash
# Build static web app
docker build -f frontend/Dockerfile.web -t safeverse-web .
docker run -p 3000:3000 safeverse-web
```

### Mobile Build

```bash
# Build for Android
npm run android -- --variant release

# Build for iOS
npm run ios -- --configuration Release
```

**Important:** Set `EXPO_PUBLIC_API_BASE_URL` to production URL before building.

## 📝 Notes

- **Location updates**: Sent to backend every 5 minutes when authenticated
- **Earthquake checks**: Run every 2 minutes in background
- **Token expiration**: Automatically handles 401 responses
- **Offline support**: Location cached for 30 minutes
- **Family SMS**: Uses expo-sms (requires SMS permission on device)

## 🔗 Related Documentation

- [Main README](../README.md) - Project overview and setup
- [Backend README](../backend/SafeVerse.Api/README.md) - API documentation
- [CLAUDE.md](../CLAUDE.md) - AI assistant instructions

---

**Built with ❤️ for earthquake safety and preparedness**
