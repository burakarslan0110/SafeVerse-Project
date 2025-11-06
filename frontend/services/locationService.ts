import { Platform } from 'react-native';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

class LocationService {
  private static instance: LocationService;
  private currentLocation: LocationData | null = null;
  private listeners: ((location: LocationData | null) => void)[] = [];

  private constructor() {}

  static getInstance(): LocationService {
    if (!LocationService.instance) {
      LocationService.instance = new LocationService();
    }
    return LocationService.instance;
  }

  setLocation(location: LocationData | null) {
    this.currentLocation = location;
    // Notify all listeners
    this.listeners.forEach(listener => listener(location));
  }

  getLocation(): LocationData | null {
    return this.currentLocation;
  }

  subscribe(listener: (location: LocationData | null) => void) {
    this.listeners.push(listener);
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  isLocationFresh(maxAge: number = 5 * 60 * 1000): boolean {
    if (!this.currentLocation) return false;
    return Date.now() - this.currentLocation.timestamp < maxAge;
  }
}

export const locationService = LocationService.getInstance();