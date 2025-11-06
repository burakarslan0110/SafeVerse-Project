import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert, Linking, AppState, AppStateStatus } from 'react-native';
import { locationService } from '@/services/locationService';
import { openLocationSettings, checkAndRequestLocation, forceLocationServiceEnable } from '@/utils/locationHelpers';
import { apiService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

interface LocationContextType {
  location: LocationData | null;
  locationError: string | null;
  locationPermission: boolean;
  isLoadingLocation: boolean;
  isLocationServiceEnabled: boolean;
  refreshLocation: () => Promise<void>;
  getLastKnownLocation: () => LocationData | null;
  checkLocationServices: () => Promise<boolean>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

const LOCATION_STORAGE_KEY = '@SafeVerse:lastKnownLocation';
const LOCATION_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes
const LOCATION_STALE_TIME = 30 * 60 * 1000; // 30 minutes
const EARTHQUAKE_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes - more frequent than location updates
const EARTHQUAKE_NOTIFICATION_DISTANCE = 150; // 150km - notify for nearby earthquakes

export function LocationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const { checkForNewEarthquakes } = useNotifications();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState<boolean>(false);
  const [isLocationServiceEnabled, setIsLocationServiceEnabled] = useState<boolean>(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [earthquakeCheckInterval, setEarthquakeCheckInterval] = useState<NodeJS.Timeout | null>(null);
  const [isWaitingForLocationService, setIsWaitingForLocationService] = useState<boolean>(false);
  const appState = useRef(AppState.currentState);
  const locationCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Load cached location on mount
  useEffect(() => {
    loadCachedLocation();
  }, []);

  // Start location tracking only when user is authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear intervals if user logs out
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      if (earthquakeCheckInterval) {
        clearInterval(earthquakeCheckInterval);
        setEarthquakeCheckInterval(null);
      }
      return;
    }

    // Initial location fetch after login
    if (Platform.OS === 'web') {
      requestWebLocationPermission();
    } else {
      requestLocationPermissionAndFetch();
    }

    // Set up periodic location refresh (every 5 minutes)
    const locInterval = setInterval(async () => {
      if (locationPermission && isAuthenticated) {
        await refreshLocation();
      }
    }, LOCATION_REFRESH_INTERVAL);

    // Set up more frequent earthquake checking (every 2 minutes)
    const eqInterval = setInterval(async () => {
      if (locationPermission && isAuthenticated) {
        await checkEarthquakes();
      }
    }, EARTHQUAKE_CHECK_INTERVAL);

    setRefreshInterval(locInterval);
    setEarthquakeCheckInterval(eqInterval);

    // Check earthquakes immediately after login
    if (locationPermission) {
      checkEarthquakes();
    }

    // App state listener for returning from settings
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      if (locInterval) {
        clearInterval(locInterval);
      }
      if (eqInterval) {
        clearInterval(eqInterval);
      }
      subscription.remove();
      if (locationCheckInterval.current) {
        clearInterval(locationCheckInterval.current);
      }
    };
  }, [isAuthenticated, locationPermission]);

  const loadCachedLocation = async () => {
    try {
      const cached = await AsyncStorage.getItem(LOCATION_STORAGE_KEY);
      if (cached) {
        const locationData: LocationData = JSON.parse(cached);
        // Check if cached location is not too old
        if (Date.now() - locationData.timestamp < LOCATION_STALE_TIME) {
          setLocation(locationData);
          locationService.setLocation(locationData); // Update global location service
        }
      }
    } catch (error) {
      console.error('Error loading cached location:', error);
    }
  };

  const saveLocationToCache = async (locationData: LocationData) => {
    try {
      await AsyncStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(locationData));
    } catch (error) {
      console.error('Error saving location to cache:', error);
    }
  };

  const saveLocationToAPI = async (locationData: LocationData) => {
    // Only save to API if user is authenticated
    if (!isAuthenticated) {
      return;
    }

    try {
      await apiService.auth.updateLocation(locationData.latitude, locationData.longitude);
    } catch (error) {
      console.error('Error saving location to API:', error);
      // Don't throw error, location saving to API is not critical
    }
  };

  // App state change handler
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // Eğer konum servisi bekliyorsak kontrol et
      if (isWaitingForLocationService && locationPermission) {
        const isEnabled = await Location.hasServicesEnabledAsync();
        setIsLocationServiceEnabled(isEnabled);

        if (isEnabled) {
          setIsWaitingForLocationService(false);
          await fetchLocation();

          // Kontrol interval'ini durdur
          if (locationCheckInterval.current) {
            clearInterval(locationCheckInterval.current);
            locationCheckInterval.current = null;
          }
        }
      }
    }
    appState.current = nextAppState;
  };

  // Konum servisi kontrol döngüsü başlat
  const startLocationServiceCheck = () => {
    setIsWaitingForLocationService(true);
    
    // Her 1 saniyede bir konum servisi durumunu kontrol et
    if (locationCheckInterval.current) {
      clearInterval(locationCheckInterval.current);
    }
    
    locationCheckInterval.current = setInterval(async () => {
      const isEnabled = await Location.hasServicesEnabledAsync();

      if (isEnabled) {
        setIsLocationServiceEnabled(true);
        setIsWaitingForLocationService(false);

        // Konum servisi açıldı, konumu al
        await fetchLocation();

        // Interval'i durdur
        if (locationCheckInterval.current) {
          clearInterval(locationCheckInterval.current);
          locationCheckInterval.current = null;
        }
      }
    }, 1000);
    
    // 30 saniye sonra timeout
    setTimeout(() => {
      if (locationCheckInterval.current) {
        clearInterval(locationCheckInterval.current);
        locationCheckInterval.current = null;
        setIsWaitingForLocationService(false);
      }
    }, 30000);
  };

  const requestWebLocationPermission = async () => {
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Tarayıcınız konum hizmetlerini desteklemiyor');
      setLocationPermission(false);
      return;
    }

    try {
      setIsLoadingLocation(true);

      // HTTP bağlantılarda konum izni çalışmaz, fallback kullan
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
      if (!isSecureContext) {
        const fallbackLocation: LocationData = {
          latitude: 39.9334,
          longitude: 32.8597,
          accuracy: 1000,
          timestamp: Date.now(),
        };
        setLocation(fallbackLocation);
        setLocationPermission(true);
        setIsLocationServiceEnabled(true);
        setLocationError('Güvenli bağlantı gerekli (HTTPS). Ankara merkez konumu kullanılıyor.');
        setIsLoadingLocation(false);
        saveLocationToCache(fallbackLocation);
        return;
      }

      // Check if permissions API is available (modern browsers and mobile)
      if ('permissions' in navigator) {
        try {
          const result = await navigator.permissions.query({ name: 'geolocation' });

          if (result.state === 'denied') {
            setLocationError('Konum izni reddedildi. Lütfen tarayıcı/telefon ayarlarından konum iznini etkinleştirin.');
            setLocationPermission(false);
            setIsLoadingLocation(false);
            return;
          }
        } catch (permError) {
          // Permissions API not fully supported, continuing with getCurrentPosition
        }
      }

      // Request location
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newLocation: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: Date.now(),
          };

          setLocation(newLocation);
          setLocationPermission(true);
          setIsLocationServiceEnabled(true);
          setLocationError(null);
          setIsLoadingLocation(false);
          saveLocationToCache(newLocation);

          // Update backend
          if (isAuthenticated) {
            saveLocationToAPI(newLocation);
          }
        },
        (error) => {
          console.error('Web geolocation error:', error);
          let errorMessage = 'Konum alınamadı';

          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Konum izni reddedildi. Lütfen tarayıcı/telefon ayarlarından konum iznini etkinleştirin ve sayfayı yenileyin.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Konum bilgisi şu anda mevcut değil. GPS/Konum servislerinizin açık olduğundan emin olun.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Konum alınırken zaman aşımı. Lütfen tekrar deneyin.';
              break;
          }

          setLocationError(errorMessage);
          setLocationPermission(false);
          setIsLoadingLocation(false);
        },
        {
          enableHighAccuracy: true, // GPS kullan
          timeout: 15000, // 15 saniye timeout
          maximumAge: 0, // Cache kullanma, her zaman fresh location
        }
      );
    } catch (error) {
      console.error('Web location request error:', error);
      setLocationError('Konum izni alınamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
      setLocationPermission(false);
      setIsLoadingLocation(false);
    }
  };

  const requestLocationPermissionAndFetch = async () => {
    try {

      // First check current permission status
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
      
      if (currentStatus === 'granted') {
        setLocationPermission(true);
        
        // Android'de izin verilmiş olsa bile konum servisi kapalı olabilir
        const isLocationEnabled = await Location.hasServicesEnabledAsync();
        if (!isLocationEnabled) {
          setIsLocationServiceEnabled(false);
          
          // Konum servisi kapalı, zorunlu açma dialog'u göster
          
          // Önce kullanıcıyı bilgilendir ve hemen ayarlara yönlendir
          await forceLocationServiceEnable();
          
          // Kullanıcı ayarlardan döndüğünde kontrol etmek için başlat
          startLocationServiceCheck();
          
          setLocationError('Konum servisleri kapalı. Lütfen konum servislerini açın.');
          return;
        } else {
          setIsLocationServiceEnabled(true);
          await fetchLocation();
        }
        return;
      }
      
      // Request permission if not granted
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setLocationPermission(true);
        
        // İzin verildikten hemen sonra konum servisi kontrolü
        const isLocationEnabled = await Location.hasServicesEnabledAsync();
        setIsLocationServiceEnabled(isLocationEnabled);
        
        if (!isLocationEnabled) {
          // Konum servisi kapalı, zorunlu açma dialog'u göster
          
          // Hemen zorunlu dialog göster
          await forceLocationServiceEnable();
          
          // Kullanıcı ayarlardan döndüğünde kontrol etmek için başlat
          startLocationServiceCheck();
          
          setLocationError('Konum servisleri kapalı. Lütfen konum servislerini açın.');
        } else {
          // Konum servisi açık, hemen konum al
          await fetchLocation();
        }
      } else {
        setLocationPermission(false);
        setLocationError('Konum izni verilmedi');
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
      setLocationPermission(false);
      setLocationError('Konum izni alınamadı');
    }
  };

  const fetchLocation = async () => {
    if (isLoadingLocation) {
      return;
    }

    setIsLoadingLocation(true);
    setLocationError(null);

    try {
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      setIsLocationServiceEnabled(isLocationEnabled);
      if (!isLocationEnabled) {
        throw new Error('Konum servisleri kapalı. Lütfen cihaz ayarlarından konum servislerini açın.');
      }

      const accuracyLevels = [
        Location.Accuracy.Balanced,
        Location.Accuracy.Low,
        Location.Accuracy.Lowest,
      ];

      for (const accuracy of accuracyLevels) {
        try {
          const locationResult = await Location.getCurrentPositionAsync({
            accuracy,
            timeout: 10000,
          });

          const locationData: LocationData = {
            latitude: locationResult.coords.latitude,
            longitude: locationResult.coords.longitude,
            accuracy: locationResult.coords.accuracy || null,
            timestamp: Date.now(),
          };

          setLocation(locationData);
          locationService.setLocation(locationData);
          await saveLocationToCache(locationData);
          await saveLocationToAPI(locationData);
          return;
        } catch {
          // Try next accuracy level
        }
      }

      try {
        const lastKnownPosition = await Location.getLastKnownPositionAsync({
          maxAge: 300000,
        });

        if (lastKnownPosition) {
          const locationData: LocationData = {
            latitude: lastKnownPosition.coords.latitude,
            longitude: lastKnownPosition.coords.longitude,
            accuracy: lastKnownPosition.coords.accuracy || null,
            timestamp: Date.now(),
          };

          setLocation(locationData);
          locationService.setLocation(locationData);
          await saveLocationToCache(locationData);
          await saveLocationToAPI(locationData);
          return;
        }
      } catch (lastKnownError) {
        console.error('Failed to get last known position:', lastKnownError);
      }

      throw new Error('Konum alınamadı');
    } catch (error) {
      console.error('Error getting location:', error);
      const errorMessage = error instanceof Error ? error.message : 'Konum alınamadı';
      setLocationError(errorMessage);
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const refreshLocation = async () => {
    if (locationPermission && !isLoadingLocation) {
      await fetchLocation();
    }
  };

  const checkEarthquakes = async () => {
    if (!location) {
      return;
    }

    try {
      // Fetch from Kandilli API via backend proxy
      const response = await apiService.earthquakes.getKandilliLive();
      const data = response.data;

      if (data && data.result && Array.isArray(data.result)) {
        // Calculate distances and filter
        const earthquakesWithDistance = data.result.map((item: any) => ({
          ...item,
          distanceFromUser: calculateDistance(
            location.latitude,
            location.longitude,
            item.geojson.coordinates[1],
            item.geojson.coordinates[0]
          ),
        }));

        // Filter earthquakes within EARTHQUAKE_NOTIFICATION_DISTANCE (50km) with magnitude >= 3.0 for notifications
        const nearbyEarthquakes = earthquakesWithDistance.filter(
          (eq: any) => (eq.distanceFromUser || 0) <= EARTHQUAKE_NOTIFICATION_DISTANCE && eq.mag >= 3.0
        );

        // Check for new earthquakes and notify
        if (nearbyEarthquakes.length > 0) {
          await checkForNewEarthquakes(nearbyEarthquakes);
        }
      }
    } catch (error) {
      console.error('Error checking earthquakes:', error);
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getLastKnownLocation = () => {
    return location;
  };

  const checkLocationServices = async (): Promise<boolean> => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      setIsLocationServiceEnabled(enabled);
      return enabled;
    } catch (error) {
      console.error('Error checking location services:', error);
      return false;
    }
  };

  const value: LocationContextType = {
    location,
    locationError,
    locationPermission,
    isLoadingLocation,
    isLocationServiceEnabled,
    refreshLocation,
    getLastKnownLocation,
    checkLocationServices,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
}
