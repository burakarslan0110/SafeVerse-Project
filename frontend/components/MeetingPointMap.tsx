import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { MapPin, Navigation, Map } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation } from '@/contexts/LocationContext';
import * as Location from 'expo-location';
import { apiService } from '@/lib/api';

interface MeetingPointMapProps {
  selectedLocation?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  } | null;
  onLocationSelect?: (location: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  }) => void;
  onPendingLocationChange?: (location: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  } | null) => void;
  height?: number;
  showConfirmButton?: boolean; // If true, user must confirm location selection
}

export default function MeetingPointMap({
  selectedLocation,
  onLocationSelect,
  onPendingLocationChange,
  height = 300,
  showConfirmButton = true
}: MeetingPointMapProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { location: userLocation } = useLocation();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [mapTimeout, setMapTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isGettingAddress, setIsGettingAddress] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{
    latitude: number;
    longitude: number;
    name: string;
    address: string;
  } | null>(null);

  // Debounce timer ref
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Default center coordinates (Turkey center)
  const centerLat = selectedLocation?.latitude || userLocation?.latitude || 39.9334;
  const centerLon = selectedLocation?.longitude || userLocation?.longitude || 32.8597;

  useEffect(() => {
    // Cleanup timeouts on unmount
    return () => {
      if (mapTimeout) {
        clearTimeout(mapTimeout);
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [mapTimeout]);

  const getAddressFromCoordinates = useCallback(async (latitude: number, longitude: number) => {
    try {
      setIsGettingAddress(true);

      // Try backend API first (no CORS issues)
      try {
        const response = await apiService.family.reverseGeocode(latitude, longitude);
        if (response.data) {
          const { city, district } = response.data;
          return {
            name: district || city || 'Yakın Konum',
            address: `${district}, ${city}`
          };
        }
      } catch {}

      // Fallback: Try Expo Location API (only works on native mobile)
      if (Platform.OS !== 'web') {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });

        if (reverseGeocode && reverseGeocode.length > 0) {
          const location = reverseGeocode[0];
          const name = location.district || location.subregion || location.street || location.city || location.region || 'Yakın Konum';
          const addressParts = [
            location.street,
            location.district || location.subregion,
          ].filter(Boolean);

          const address = addressParts.length > 0 ? addressParts.join(', ') : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

          return { name, address };
        }
      }

      // Final fallback
      return {
        name: 'Yakın Konum',
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      };
    } catch (error) {
      console.error('❌ Reverse geocoding error:', error);
      return {
        name: 'Yakın Konum',
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      };
    } finally {
      setIsGettingAddress(false);
    }
  }, []);

  const handleMapClick = useCallback((latitude: number, longitude: number) => {
    if (!onLocationSelect && !onPendingLocationChange) {
      return;
    }

    // Clear previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce for 500ms to prevent multiple requests
    debounceTimerRef.current = setTimeout(async () => {
      const { name, address } = await getAddressFromCoordinates(latitude, longitude);

      const location = {
        latitude,
        longitude,
        name,
        address,
      };

      if (showConfirmButton) {
        setPendingLocation(location);
      } else {
        // If showConfirmButton is false, use external confirmation UI
        if (onPendingLocationChange) {
          onPendingLocationChange(location);
        } else if (onLocationSelect) {
          onLocationSelect(location);
        }
      }
    }, 500); // 500ms debounce
  }, [onLocationSelect, onPendingLocationChange, showConfirmButton, getAddressFromCoordinates]);

  const handleConfirmLocation = () => {
    if (pendingLocation && onLocationSelect) {
      onLocationSelect(pendingLocation);
      setPendingLocation(null);
    }
  };

  const handleCancelLocation = () => {
    setPendingLocation(null);
  };

  const renderWebMap = () => {
    const mapHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          #map { height: 100vh; width: 100%; cursor: ${(onLocationSelect || onPendingLocationChange) ? 'crosshair' : 'grab'}; }
          .instruction-banner {
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(14, 165, 233, 0.95);
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            z-index: 1000;
            font-weight: 500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        ${(onLocationSelect || onPendingLocationChange) ? '<div class="instruction-banner">📍 Harita üzerinde toplanma alanınızı seçmek için tıklayın</div>' : ''}
        <div id="map"></div>
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              try {
                const map = L.map('map').setView([${centerLat}, ${centerLon}], 17);

                let selectedMarker = null;

                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '© OpenStreetMap contributors',
                  maxZoom: 19,
                  minZoom: 3,
                }).addTo(map);

                // Add user location marker if available
                ${userLocation ? `
                  const userIcon = L.divIcon({
                    html: '<div style="background: #4F46E5; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                    className: 'user-location-marker'
                  });

                  L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
                    icon: userIcon
                  }).addTo(map)
                    .bindPopup('<div style="text-align: center; font-weight: bold; color: #4F46E5;">📱 Mevcut Konumunuz</div>')
                    .openPopup();
                ` : ''}

                // Add selected location marker if available
                ${selectedLocation ? `
                  const selectedIcon = L.divIcon({
                    html: '<div style="background: #10B981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                    className: 'selected-location-marker'
                  });

                  selectedMarker = L.marker([${selectedLocation.latitude}, ${selectedLocation.longitude}], {
                    icon: selectedIcon
                  }).addTo(map)
                    .bindPopup('<div style="text-align: center; font-weight: bold; color: #10B981;">🏃‍♀️ Toplanma Alanı<br/><small style="color: #666;">${selectedLocation.name || 'Seçilen Konum'}</small></div>');
                ` : ''}

                // Handle map clicks only if onLocationSelect or onPendingLocationChange is available
                ${(onLocationSelect || onPendingLocationChange) ? `
                map.on('click', function(e) {
                  const lat = e.latlng.lat;
                  const lng = e.latlng.lng;

                  // Remove previous selected marker
                  if (selectedMarker) {
                    map.removeLayer(selectedMarker);
                  }

                  // Add new marker
                  const newIcon = L.divIcon({
                    html: '<div style="background: #10B981; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12],
                    className: 'selected-location-marker'
                  });

                  selectedMarker = L.marker([lat, lng], {
                    icon: newIcon
                  }).addTo(map)
                    .bindPopup('<div style="text-align: center; font-weight: bold; color: #10B981;">🏃‍♀️ Yeni Toplanma Alanı<br/><small style="color: #666;">Adres alınıyor...</small></div>')
                    .openPopup();

                  // Send coordinates via postMessage
                  window.parent.postMessage({
                    type: 'LOCATION_SELECTED',
                    latitude: lat,
                    longitude: lng
                  }, '*');
                });
                ` : '// Map clicks disabled - view only mode'}

                // Notify parent that map is loaded
                window.parent.postMessage({ type: 'MAP_LOADED' }, '*');
              } catch (error) {
                console.error('Map initialization error:', error);
                window.parent.postMessage({ type: 'MAP_ERROR' }, '*');
              }
            }, 100);
          });
        </script>
      </body>
      </html>
    `;

    return (
      <View style={[styles.mapContainer, { height }]}>
        <iframe
          srcDoc={mapHtml}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: 16,
          }}
          ref={(iframe) => {
            if (iframe && Platform.OS === 'web') {
              const handleMessage = (event: MessageEvent) => {
                if (event.data?.type === 'LOCATION_SELECTED') {
                  const { latitude, longitude } = event.data;
                  if (!isNaN(latitude) && !isNaN(longitude)) {
                    handleMapClick(latitude, longitude);
                  }
                } else if (event.data?.type === 'MAP_LOADED') {
                  setMapLoaded(true);
                  setMapError(false);
                } else if (event.data?.type === 'MAP_ERROR') {
                  setMapError(true);
                }
              };
              window.addEventListener('message', handleMessage);
            }
          }}
        />

        {!mapLoaded && !mapError && (
          <View style={styles.webViewLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Harita yükleniyor...
            </Text>
          </View>
        )}

        {isGettingAddress && (
          <View style={styles.addressLoadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.addressLoadingText, { color: colors.textPrimary }]}>
              Adres alınıyor...
            </Text>
          </View>
        )}

        {showConfirmButton && pendingLocation && (
          <View style={styles.confirmOverlay}>
            <View style={[styles.confirmCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.confirmInfo}>
                <MapPin size={20} color={colors.primary} />
                <View style={styles.confirmText}>
                  <Text style={[styles.confirmName, { color: colors.textPrimary }]}>
                    {pendingLocation.name}
                  </Text>
                  <Text style={[styles.confirmAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                    {pendingLocation.address}
                  </Text>
                </View>
              </View>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={handleCancelLocation}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleConfirmLocation}
                >
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderMobileMap = () => {
    const mapHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
        <style>
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          #map { height: 100vh; width: 100%; cursor: ${(onLocationSelect || onPendingLocationChange) ? 'crosshair' : 'grab'}; }
          .instruction-banner {
            position: absolute;
            top: 10px;
            left: 10px;
            right: 10px;
            background: rgba(14, 165, 233, 0.9);
            color: white;
            padding: 8px 12px;
            border-radius: 8px;
            font-size: 14px;
            text-align: center;
            z-index: 1000;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          window.addEventListener('load', function() {
            setTimeout(function() {
              try {
                const map = L.map('map').setView([${centerLat}, ${centerLon}], 17);
                
                let selectedMarker = null;
                
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '© OpenStreetMap contributors',
                  maxZoom: 18,
                  minZoom: 3,
                });
                
                tileLayer.on('tileerror', function(e) {
                  console.error('Tile loading error');
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage('MAP_ERROR');
                  }
                });
                
                tileLayer.on('tileload', function(e) {
                  setTimeout(function() {
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage('MAP_LOADED');
                    }
                  }, 500);
                });
                
                tileLayer.addTo(map);
                
                // Add user location marker if available
                ${userLocation ? `
                  const userIcon = L.divIcon({
                    html: '<div style="background: #4F46E5; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
                    iconSize: [16, 16],
                    iconAnchor: [8, 8],
                    className: 'user-location-marker'
                  });
                  
                  L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
                    icon: userIcon
                  }).addTo(map)
                    .bindPopup('<div style="text-align: center; font-weight: bold; color: #4F46E5;">📱 Mevcut Konumunuz</div>');
                ` : ''}
                
                // Add selected location marker if available
                ${selectedLocation ? `
                  const selectedIcon = L.divIcon({
                    html: '<div style="background: #10B981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                    className: 'selected-location-marker'
                  });
                  
                  selectedMarker = L.marker([${selectedLocation.latitude}, ${selectedLocation.longitude}], {
                    icon: selectedIcon
                  }).addTo(map)
                    .bindPopup('<div style="text-align: center; font-weight: bold; color: #10B981;">🏃‍♀️ Toplanma Alanı<br/><small>${selectedLocation.name || 'Seçilen Konum'}</small></div>');
                ` : ''}
                
                // Handle map clicks only if onLocationSelect or onPendingLocationChange is available
                ${(onLocationSelect || onPendingLocationChange) ? `
                map.on('click', function(e) {
                  const lat = e.latlng.lat;
                  const lng = e.latlng.lng;
                  
                  // Remove previous selected marker
                  if (selectedMarker) {
                    map.removeLayer(selectedMarker);
                  }
                  
                  // Add new marker
                  const newIcon = L.divIcon({
                    html: '<div style="background: #10B981; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4);"></div>',
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                    className: 'selected-location-marker'
                  });
                  
                  selectedMarker = L.marker([lat, lng], {
                    icon: newIcon
                  }).addTo(map)
                    .bindPopup('<div style="text-align: center; font-weight: bold; color: #10B981;">🏃‍♀️ Yeni Toplanma Alanı<br/><small>Adres alınıyor...</small></div>');
                  
                  // Send coordinates to React Native
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage('LOCATION_SELECTED:' + lat + ',' + lng);
                  }
                });
                ` : '// Map clicks disabled - view only mode'}
                
              } catch (error) {
                console.error('Map initialization error:', error);
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage('MAP_ERROR');
                }
              }
            }, 100);
          });
        </script>
      </body>
      </html>
    `;
    
    // WebView sadece mobilde kullan
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebView } = require('react-native-webview');
    
    return (
      <View style={[styles.mapContainer, { height }]}>
        <WebView
          key={webViewKey}
          source={{ html: mapHtml }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          originWhitelist={['*']}
          allowUniversalAccessFromFileURLs={true}
          allowFileAccessFromFileURLs={true}
          onMessage={(event: any) => {
            const message = event.nativeEvent.data;

            if (message === 'MAP_LOADED') {
              setMapLoaded(true);
              setMapError(false);
              if (mapTimeout) {
                clearTimeout(mapTimeout);
                setMapTimeout(null);
              }
            } else if (message === 'MAP_ERROR') {
              setMapError(true);
              setMapLoaded(false);
            } else if (message.startsWith('LOCATION_SELECTED:')) {
              const coords = message.replace('LOCATION_SELECTED:', '').split(',');
              const latitude = parseFloat(coords[0]);
              const longitude = parseFloat(coords[1]);
              
              if (!isNaN(latitude) && !isNaN(longitude)) {
                handleMapClick(latitude, longitude);
              }
            }
          }}
          onError={(syntheticEvent: any) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView error: ', nativeEvent);
            setMapError(true);
            if (mapTimeout) {
              clearTimeout(mapTimeout);
              setMapTimeout(null);
            }
          }}
          onLoadStart={() => {
            if (mapTimeout) {
              clearTimeout(mapTimeout);
            }
            const timeout = setTimeout(() => {
              if (!mapLoaded) {
                setMapError(true);
              }
            }, 20000);
            setMapTimeout(timeout);
          }}
          renderLoading={() => (
            <View style={styles.webViewLoading}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Harita yükleniyor...
              </Text>
            </View>
          )}
        />
        
        {mapError && (
          <View style={styles.mapErrorOverlay}>
            <MapPin size={32} color={colors.textSecondary} />
            <Text style={[styles.mapErrorText, { color: colors.textSecondary }]}>
              Harita yüklenemedi
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                if (mapTimeout) {
                  clearTimeout(mapTimeout);
                  setMapTimeout(null);
                }
                setMapError(false);
                setMapLoaded(false);
                setWebViewKey(prev => prev + 1);
              }}
            >
              <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}

        {isGettingAddress && (
          <View style={styles.addressLoadingOverlay}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.addressLoadingText, { color: colors.textPrimary }]}>
              Adres alınıyor...
            </Text>
          </View>
        )}

        {showConfirmButton && pendingLocation && (
          <View style={styles.confirmOverlay}>
            <View style={[styles.confirmCard, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.confirmInfo}>
                <MapPin size={20} color={colors.primary} />
                <View style={styles.confirmText}>
                  <Text style={[styles.confirmName, { color: colors.textPrimary }]}>
                    {pendingLocation.name}
                  </Text>
                  <Text style={[styles.confirmAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                    {pendingLocation.address}
                  </Text>
                </View>
              </View>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelButton, { borderColor: colors.border }]}
                  onPress={handleCancelLocation}
                >
                  <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.saveButton, { backgroundColor: colors.primary }]}
                  onPress={handleConfirmLocation}
                >
                  <Text style={styles.saveButtonText}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    );
  };

  const styles = StyleSheet.create({
    mapContainer: {
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: colors.cardBackground,
    },
    webView: {
      flex: 1,
    },
    webViewLoading: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.cardBackground,
      gap: 16,
    },
    webMapContainer: {
      flex: 1,
      padding: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    webMapHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    webMapTitle: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    webMapSubtitle: {
      fontSize: 14,
      marginBottom: 24,
      textAlign: 'center',
    },
    selectedLocationInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      width: '100%',
    },
    locationDetails: {
      flex: 1,
    },
    locationName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    locationAddress: {
      fontSize: 14,
    },
    openMapButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    openMapButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },
    loadingText: {
      fontSize: 14,
    },
    mapErrorOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    mapErrorText: {
      fontSize: 14,
      textAlign: 'center',
    },
    retryButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 12,
      fontWeight: '600',
    },
    addressLoadingOverlay: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 16,
      backgroundColor: colors.cardBackground,
      borderRadius: 8,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
    },
    addressLoadingText: {
      fontSize: 14,
    },
    confirmOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 16,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    confirmCard: {
      borderRadius: 12,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    confirmInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      marginBottom: 16,
    },
    confirmText: {
      flex: 1,
    },
    confirmName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    confirmAddress: {
      fontSize: 14,
    },
    confirmButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
    },
    saveButton: {
      // backgroundColor set via inline style
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: 'white',
    },
  });

  return Platform.OS === 'web' ? renderWebMap() : renderMobileMap();
}
