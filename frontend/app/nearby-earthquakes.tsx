import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Stack } from 'expo-router';
import * as Location from 'expo-location';
import { MapPin, Clock, AlertTriangle, RefreshCw, Navigation, Map } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation } from '@/contexts/LocationContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { apiService } from '@/lib/api';

interface EarthquakeData {
  earthquake_id: string;
  provider: string;
  title: string;
  date: string;
  mag: number;
  depth: number;
  geojson: {
    type: string;
    coordinates: [number, number];
  };
  location_properties: {
    closestCity: {
      name: string;
      cityCode: number;
      distance: number;
      population: number;
    };
    epiCenter: {
      name: string;
      cityCode: number;
      population: number;
    } | null;
    closestCities: {
      name: string;
      cityCode: number;
      distance: number;
      population: number;
    }[];
  };
  date_time: string;
  created_at: number;
  distanceFromUser?: number;
}




export default function NearbyEarthquakesScreen() {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const { location: userLocation, locationError, refreshLocation, isLoadingLocation } = useLocation();
  const { checkForNewEarthquakes } = useNotifications();
  const [earthquakes, setEarthquakes] = useState<EarthquakeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [webViewKey, setWebViewKey] = useState(0);
  const [mapTimeout, setMapTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);



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



  // Kandilli ve AFAD API'lerinden deprem verileri çek
  const fetchEarthquakes = async () => {
    try {
      // Hem Kandilli hem AFAD verilerini paralel çek
      const [kandilliResponse, afadResponse] = await Promise.all([
        apiService.earthquakes.getKandilliLive().catch(err => {
          console.error('Kandilli API hatası:', err);
          return null;
        }),
        apiService.earthquakes.getAfadLive().catch(err => {
          console.error('AFAD API hatası:', err);
          return null;
        })
      ]);

      let allEarthquakes: EarthquakeData[] = [];

      // Kandilli verilerini işle
      if (kandilliResponse?.data) {
        const kandilliData = kandilliResponse.data;

        if (kandilliData?.result && Array.isArray(kandilliData.result)) {
          const currentLocation = userLocation;
          const kandilliEarthquakes = kandilliData.result.map((item: any): EarthquakeData => {
            const earthquake: EarthquakeData = {
              earthquake_id: `kandilli_${item.earthquake_id}`,
              provider: 'Kandilli',
              title: item.title,
              date: item.date,
              mag: item.mag,
              depth: item.depth,
              geojson: item.geojson,
              location_properties: item.location_properties,
              date_time: item.date_time,
              created_at: item.created_at
            };

            // Mesafe hesapla
            if (currentLocation) {
              earthquake.distanceFromUser = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                item.geojson.coordinates[1],
                item.geojson.coordinates[0]
              );
            }

            return earthquake;
          });

          allEarthquakes = [...allEarthquakes, ...kandilliEarthquakes];
        }
      }

      // AFAD verilerini işle
      if (afadResponse?.data) {
        const afadData = afadResponse.data;

        if (afadData?.result && Array.isArray(afadData.result)) {
          const currentLocation = userLocation;
          const afadEarthquakes = afadData.result.map((item: any): EarthquakeData => {
            const earthquake: EarthquakeData = {
              earthquake_id: `afad_${item.earthquake_id}`,
              provider: 'AFAD',
              title: item.title,
              date: item.date,
              mag: item.mag,
              depth: item.depth,
              geojson: item.geojson,
              location_properties: item.location_properties,
              date_time: item.date_time,
              created_at: item.created_at
            };

            // Mesafe hesapla
            if (currentLocation) {
              earthquake.distanceFromUser = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                item.geojson.coordinates[1],
                item.geojson.coordinates[0]
              );
            }

            return earthquake;
          });

          allEarthquakes = [...allEarthquakes, ...afadEarthquakes];
        }
      }

      // Filtreleme ve sıralama
      let earthquakeList = allEarthquakes.filter((eq: EarthquakeData) => eq.mag >= 2.0);

      // Kullanıcı konumu varsa 500km mesafeye göre filtrele
      if (userLocation) {
        earthquakeList = earthquakeList.filter((eq: EarthquakeData) =>
          (eq.distanceFromUser || 0) <= 500
        );

        // Mesafeye göre sırala
        earthquakeList = earthquakeList.sort((a: EarthquakeData, b: EarthquakeData) => {
          const distanceA = a.distanceFromUser || Infinity;
          const distanceB = b.distanceFromUser || Infinity;
          return distanceA - distanceB;
        });
      } else {
        // Konum yoksa tarihe göre sırala
        earthquakeList = earthquakeList.sort((a: EarthquakeData, b: EarthquakeData) =>
          b.created_at - a.created_at
        );
      }

      // İlk 100 depremi al
      earthquakeList = earthquakeList.slice(0, 100);

      setEarthquakes(earthquakeList);

      // Check for new earthquakes and notify
      await checkForNewEarthquakes(earthquakeList);

      // Eğer hiç veri yoksa USGS fallback
      if (earthquakeList.length === 0) {
        throw new Error('No data from Kandilli or AFAD');
      }
    } catch (error) {
      console.error('API hatası:', error);
      console.warn('USGS API fallback kullanılıyor...');

      // Kandilli başarısız olursa USGS fallback
      try {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const start = yesterday.toISOString().slice(0, 19);
        const end = now.toISOString().slice(0, 19);

        const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${start}&endtime=${end}&minmagnitude=2.0&orderby=time`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`USGS API HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data && Array.isArray(data.features)) {
          const currentLocation = userLocation;

          let earthquakeList: EarthquakeData[] = data.features.map((feat: any) => {
            const prop = feat.properties;
            const geom = feat.geometry;
            const coords = geom.coordinates; // [lon, lat, depth]

            const earthquake: EarthquakeData = {
              earthquake_id: `usgs_${feat.id}`,
              provider: "USGS",
              title: prop.title,
              date: new Date(prop.time).toISOString(),
              mag: prop.mag,
              depth: coords[2],
              geojson: {
                type: geom.type,
                coordinates: [coords[0], coords[1]],
              },
              location_properties: {
                closestCity: { name: prop.place || "", cityCode: 0, distance: 0, population: 0 },
                epiCenter: null,
                closestCities: []
              },
              date_time: new Date(prop.time).toISOString(),
              created_at: prop.time
            };

            if (currentLocation) {
              earthquake.distanceFromUser = calculateDistance(
                currentLocation.latitude,
                currentLocation.longitude,
                coords[1],
                coords[0]
              );
            }

            return earthquake;
          });

          earthquakeList = earthquakeList.filter(eq => (eq.mag ?? 0) >= 2.0);

          if (currentLocation) {
            earthquakeList = earthquakeList
              .sort((a, b) => (a.distanceFromUser || Infinity) - (b.distanceFromUser || Infinity))
              .filter(eq => (eq.distanceFromUser || 0) <= 500);
          } else {
            earthquakeList = earthquakeList.sort((a, b) => b.created_at - a.created_at);
          }

          earthquakeList = earthquakeList.slice(0, 100);
          setEarthquakes(earthquakeList);

          // Check for new earthquakes and notify
          await checkForNewEarthquakes(earthquakeList);
        } else {
          throw new Error("USGS API beklenmedik veri formatı");
        }
      } catch (usgsError) {
        console.error("USGS API hatası:", usgsError);
        setEarthquakes([]);
      }
    }
  };
  
  




  const loadData = async () => {
    setLoading(true);
    
    try {
      // Just fetch earthquakes - location is already managed by LocationContext
      await fetchEarthquakes();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    // Optionally refresh location if it's old
    if (Platform.OS !== 'web' && userLocation && Date.now() - userLocation.timestamp > 5 * 60 * 1000) {
      await refreshLocation();
    }
    await fetchEarthquakes();
  };

  useEffect(() => {
    loadData();
    
    // Cleanup timeout on unmount
    return () => {
      if (mapTimeout) {
        clearTimeout(mapTimeout);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch earthquakes when location is available or changes
  useEffect(() => {
    if (userLocation && !loading) {
      fetchEarthquakes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation]);

  const getMagnitudeColor = (magnitude: number): string => {
    if (magnitude >= 5.0) return '#EF4444'; // Red
    if (magnitude >= 4.0) return '#F97316'; // Orange
    if (magnitude >= 3.0) return '#EAB308'; // Yellow
    return '#10B981'; // Green
  };

  const getMagnitudeLabel = (magnitude: number): string => {
    if (magnitude >= 5.0) return 'Güçlü';
    if (magnitude >= 4.0) return 'Orta';
    if (magnitude >= 3.0) return 'Hafif';
    return 'Zayıf';
  };

  const formatDate = (dateString: string): string => {
    try {
      // API'den gelen format: "2025-10-01 13:51:39" veya ISO format
      let date: Date;

      if (dateString.includes('T')) {
        // ISO format
        date = new Date(dateString);
      } else {
        // "2025-10-01 13:51:39" format
        date = new Date(dateString.replace(/\./g, '-').replace(' ', 'T'));
      }

      // Türkçe tarih ve saat formatı
      return date.toLocaleString('tr-TR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  const formatDistance = (distance: number): string => {
    // Input validation
    if (!distance || distance < 0 || isNaN(distance)) return '0 km';
    
    if (distance < 1) {
      return `${Math.round(distance * 1000)} m`;
    }
    return `${Math.round(distance)} km`;
  };



  const renderMapView = () => {
    if (!earthquakes.length) return null;

    const centerLat = userLocation?.latitude || 39.9334;
    const centerLon = userLocation?.longitude || 32.8597;
    
    // Mobil için WebView ile harita
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
          #map { height: 100vh; width: 100%; }
          .legend {
            position: absolute;
            bottom: 20px;
            right: 20px;
            background: rgba(255, 255, 255, 0.9);
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            font-size: 12px;
          }
          .legend-item {
            display: flex;
            align-items: center;
            margin: 4px 0;
          }
          .legend-color {
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <div class="legend">
          <div class="legend-item">
            <div class="legend-color" style="background-color: #EF4444;"></div>
            <span>5.0+ Güçlü</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: #F97316;"></div>
            <span>4.0-4.9 Orta</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: #EAB308;"></div>
            <span>3.0-3.9 Hafif</span>
          </div>
          <div class="legend-item">
            <div class="legend-color" style="background-color: #10B981;"></div>
            <span>2.0-2.9 Zayıf</span>
          </div>
        </div>
        <script>
          // Wait for page to fully load before initializing map
          window.addEventListener('load', function() {
            setTimeout(function() {
              try {
                const map = L.map('map').setView([${centerLat}, ${centerLon}], ${userLocation ? '8' : '6'});
                
                // Simplified tile loading with better error handling
                let tilesLoaded = false;
                let tileErrorCount = 0;
                const maxTileErrors = 10;
                
                // Use a single reliable tile server
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                  attribution: '© OpenStreetMap contributors',
                  maxZoom: 18,
                  minZoom: 3,
                  subdomains: ['a', 'b', 'c'],
                  tileSize: 256,
                  // Timeout for each tile
                  timeout: 10000,
                  // Keep trying to load tiles
                  keepBuffer: 2,
                  updateWhenZooming: false,
                  updateWhenIdle: true
                });
                
                // Track tile loading
                tileLayer.on('tileerror', function(e) {
                  tileErrorCount++;
                  console.error('Tile load error count:', tileErrorCount);

                  if (tileErrorCount > maxTileErrors && !tilesLoaded) {
                    console.error('Too many tile errors');
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage('MAP_ERROR');
                    } else {
                      window.parent.postMessage('MAP_ERROR', '*');
                    }
                  }
                });

                tileLayer.on('tileload', function(e) {
                  if (!tilesLoaded) {
                    tilesLoaded = true;
                    // Notify that map is ready once we have at least one tile
                    setTimeout(function() {
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage('MAP_LOADED');
                      } else {
                        window.parent.postMessage('MAP_LOADED', '*');
                      }
                    }, 500);
                  }
                });
                
                tileLayer.addTo(map);
          
          // Add earthquake markers
          ${earthquakes.map(earthquake => {
            const lat = earthquake.geojson.coordinates[1];
            const lon = earthquake.geojson.coordinates[0];
            const magnitudeColor = getMagnitudeColor(earthquake.mag);
            const radius = Math.max(earthquake.mag * 3, 6);
            
            return `
              L.circleMarker([${lat}, ${lon}], {
                color: 'white',
                weight: 2,
                fillColor: '${magnitudeColor}',
                fillOpacity: 0.8,
                radius: ${radius}
              }).addTo(map)
                .bindPopup(\`
                  <div style="min-width: 200px;">
                    <h3 style="margin: 0 0 8px 0; color: ${magnitudeColor}; font-size: 16px;">
                      ${earthquake.mag.toFixed(1)} Büyüklük
                    </h3>
                    <p style="margin: 4px 0; font-weight: bold;">${earthquake.title}</p>
                    <p style="margin: 4px 0;">📅 ${formatDate(earthquake.date_time)}</p>
                    <p style="margin: 4px 0;">📍 Derinlik: ${earthquake.depth} km</p>
                    ${earthquake.location_properties.epiCenter ? 
                      `<p style="margin: 4px 0;">🎯 Merkez: ${earthquake.location_properties.epiCenter.name}</p>` : ''}
                    ${earthquake.distanceFromUser ? 
                      `<p style="margin: 4px 0;">📏 Uzaklık: ${formatDistance(earthquake.distanceFromUser)}</p>` : ''}
                  </div>
                \`);
            `;
          }).join('')}
          
          // Add user location marker if available
          ${userLocation ? `
            const userIcon = L.divIcon({
              html: '<div style="background: #4F46E5; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3);"></div>',
              iconSize: [20, 20],
              iconAnchor: [10, 10],
              className: 'user-location-marker'
            });
            
            L.marker([${userLocation.latitude}, ${userLocation.longitude}], {
              icon: userIcon
            }).addTo(map)
              .bindPopup('<div style="text-align: center; font-weight: bold; color: #4F46E5;">📍 Konumunuz</div>');
          ` : ''}
          
          // Calculate map bounds based on user location and earthquakes
          let mapBounds;
          if (${userLocation ? 'true' : 'false'}) {
            // Calculate bounds to show user location and nearby earthquakes
            const userLat = ${userLocation?.latitude || 39.9334};
            const userLon = ${userLocation?.longitude || 32.8597};
            
            // Use a reasonable delta for showing nearby area (about 100km radius)
            const latDelta = 1.0; // approximately 111km
            const lonDelta = 1.0;
            
            // Expand bounds to include nearby earthquakes
            const earthquakeBounds = {
              minLat: Math.min(...[${earthquakes.map(eq => eq.geojson.coordinates[1]).join(',')}]),
              maxLat: Math.max(...[${earthquakes.map(eq => eq.geojson.coordinates[1]).join(',')}]),
              minLon: Math.min(...[${earthquakes.map(eq => eq.geojson.coordinates[0]).join(',')}]),
              maxLon: Math.max(...[${earthquakes.map(eq => eq.geojson.coordinates[0]).join(',')}])
            };
            
            // Combine user location bounds with earthquake bounds
            const minLat = Math.min(userLat - latDelta, earthquakeBounds.minLat);
            const maxLat = Math.max(userLat + latDelta, earthquakeBounds.maxLat);
            const minLon = Math.min(userLon - lonDelta, earthquakeBounds.minLon);
            const maxLon = Math.max(userLon + lonDelta, earthquakeBounds.maxLon);
            
            mapBounds = [[minLat, minLon], [maxLat, maxLon]];
          } else if (${earthquakes.length} > 0) {
            // If no user location, fit to earthquakes only
            const lats = [${earthquakes.map(eq => eq.geojson.coordinates[1]).join(',')}];
            const lons = [${earthquakes.map(eq => eq.geojson.coordinates[0]).join(',')}];
            
            mapBounds = [
              [Math.min(...lats), Math.min(...lons)],
              [Math.max(...lats), Math.max(...lons)]
            ];
          }
          
          // Set map bounds and disable user interaction
          if (mapBounds) {
            map.fitBounds(mapBounds, { padding: [20, 20] });
          }
          
                // Disable map interaction to keep it static
                map.dragging.disable();
                map.touchZoom.disable();
                map.doubleClickZoom.disable();
                map.scrollWheelZoom.disable();
                map.boxZoom.disable();
                map.keyboard.disable();
                if (map.tap) map.tap.disable();
                
                // Map ready notification is now handled by tile loading
              } catch (error) {
                console.error('Map initialization error:', error);
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage('MAP_ERROR');
                } else {
                  window.parent.postMessage('MAP_ERROR', '*');
                }
              }
            }, 100); // Minimal delay for faster loading
          });
        </script>
      </body>
      </html>
    `;

    // Web için iframe, mobil için WebView
    if (Platform.OS === 'web') {
      return (
        <View style={styles.mapContainer}>
          <iframe
            srcDoc={mapHtml}
            style={{
              width: '100%',
              height: 400,
              border: 'none',
              borderRadius: 16,
            }}
            ref={(iframe) => {
              if (iframe) {
                const handleMessage = (event: MessageEvent) => {
                  if (event.data === 'MAP_LOADED') {
                    setMapLoaded(true);
                    setMapError(false);
                  } else if (event.data === 'MAP_ERROR') {
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

          {mapError && (
            <View style={styles.mapErrorOverlay}>
              <AlertTriangle size={32} color={colors.textSecondary} />
              <Text style={[styles.mapErrorText, { color: colors.textSecondary }]}>
                Harita yüklenemedi
              </Text>
              <TouchableOpacity
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
                onPress={() => {
                  setMapError(false);
                  setMapLoaded(false);
                  setWebViewKey(prev => prev + 1);
                }}
              >
                <Text style={styles.retryButtonText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    // Mobil için WebView
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { WebView } = require('react-native-webview');

    return (
      <View style={styles.mapContainer}>
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
          // Disable hardware acceleration to prevent rendering issues
          androidHardwareAccelerationDisabled={false}
          // Increase timeout for slow connections
          injectedJavaScript={`
            window.onerror = function(msg, url, line) {
              window.ReactNativeWebView.postMessage('JS_ERROR: ' + msg);
              return true;
            };
            true;
          `}
          onMessage={(event: any) => {
            const message = event.nativeEvent.data;
            
            if (message === 'MAP_LOADED') {
              setMapLoaded(true);
              setMapError(false);
              // Clear timeout if map loads successfully
              if (mapTimeout) {
                clearTimeout(mapTimeout);
                setMapTimeout(null);
              }
            } else if (message === 'MAP_ERROR') {
              setMapError(true);
              setMapLoaded(false);
            } else if (message.startsWith('JS_ERROR:')) {
              console.error('JavaScript error in WebView:', message);
            }
          }}
          onError={(syntheticEvent: any) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
            setMapError(true);
            if (mapTimeout) {
              clearTimeout(mapTimeout);
              setMapTimeout(null);
            }
          }}
          onHttpError={(syntheticEvent: any) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView HTTP error: ', nativeEvent);
            // Don't immediately show error for HTTP errors, wait for timeout
          }}
          onLoadStart={() => {
            // Clear any existing timeout
            if (mapTimeout) {
              clearTimeout(mapTimeout);
            }
            // Set a new timeout
            const timeout = setTimeout(() => {
              if (!mapLoaded) {
                console.error('Map loading timeout reached');
                setMapError(true);
              }
            }, 30000); // Increased to 30 seconds
            setMapTimeout(timeout);
          }}
          onLoadEnd={() => {
            // Don't set error immediately, wait for the message from the map
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
            <AlertTriangle size={32} color={colors.textSecondary} />
            <Text style={[styles.mapErrorText, { color: colors.textSecondary }]}>
              Harita yüklenemedi
            </Text>
            <TouchableOpacity 
              style={[styles.retryButton, { backgroundColor: colors.primary }]}
              onPress={() => {
                // Clear any existing timeout
                if (mapTimeout) {
                  clearTimeout(mapTimeout);
                  setMapTimeout(null);
                }
                // Reset states
                setMapError(false);
                setMapLoaded(false);
                // Force WebView to reload
                setWebViewKey(prev => prev + 1);
              }}
            >
              <Text style={styles.retryButtonText}>Tekrar Dene</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEarthquakeItem = (earthquake: EarthquakeData) => {
    const magnitudeColor = getMagnitudeColor(earthquake.mag);
    const magnitudeLabel = getMagnitudeLabel(earthquake.mag);

    return (
      <View key={earthquake.earthquake_id} style={[styles.earthquakeCard, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.earthquakeHeader}>
          <View style={[styles.magnitudeBadge, { backgroundColor: magnitudeColor }]}>
            <Text style={styles.magnitudeText}>{earthquake.mag.toFixed(1)}</Text>
          </View>
          <View style={styles.earthquakeInfo}>
            <Text style={[styles.earthquakeTitle, { color: colors.textPrimary }]} numberOfLines={2}>
              {earthquake.title}
            </Text>
            <View style={styles.labelRow}>
              <Text style={[styles.magnitudeLabel, { color: magnitudeColor }]}>
                {magnitudeLabel} Deprem
              </Text>
              <Text style={[styles.providerLabel, { color: colors.textSecondary }]}>
                • {earthquake.provider}
              </Text>
            </View>
          </View>
          {earthquake.distanceFromUser && (
            <View style={styles.distanceContainer}>
              <Navigation size={16} color={colors.textSecondary} />
              <Text style={[styles.distanceText, { color: colors.textSecondary }]}>
                {formatDistance(earthquake.distanceFromUser)}
              </Text>
            </View>
          )}
        </View>
        
        <View style={styles.earthquakeDetails}>
          <View style={styles.detailRow}>
            <Clock size={16} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              {formatDate(earthquake.date_time)}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <MapPin size={16} color={colors.textSecondary} />
            <Text style={[styles.detailText, { color: colors.textSecondary }]}>
              Derinlik: {earthquake.depth} km
            </Text>
          </View>
          
          {earthquake.location_properties.epiCenter && (
            <View style={styles.detailRow}>
              <AlertTriangle size={16} color={colors.textSecondary} />
              <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                Merkez: {earthquake.location_properties.epiCenter.name}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    refreshButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 8,
    },
    refreshButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.primary,
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 12,
      gap: 8,
      flex: 1,
    },
    toggleButtonActive: {
      backgroundColor: colors.primary,
    },
    toggleButtonText: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    toggleButtonTextActive: {
      color: 'white',
    },
    mapContainer: {
      height: height * 0.4,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 16,
    },
    map: {
      flex: 1,
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
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    webMapHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 8,
    },
    webMapTitle: {
      fontSize: 20,
      fontWeight: 'bold',
    },
    webMapSubtitle: {
      fontSize: 16,
      marginBottom: 24,
      textAlign: 'center',
    },
    webMapStats: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    statColor: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    statText: {
      fontSize: 14,
      fontWeight: '500',
    },
    openMapButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 12,
    },
    openMapButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    earthquakeCard: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    earthquakeHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
      gap: 12,
    },
    magnitudeBadge: {
      width: 50,
      height: 50,
      borderRadius: 25,
      justifyContent: 'center',
      alignItems: 'center',
    },
    magnitudeText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    earthquakeInfo: {
      flex: 1,
    },
    earthquakeTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    magnitudeLabel: {
      fontSize: 14,
      fontWeight: '500',
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    providerLabel: {
      fontSize: 12,
      fontWeight: '400',
    },
    distanceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    distanceText: {
      fontSize: 14,
      fontWeight: '500',
    },
    earthquakeDetails: {
      gap: 8,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    detailText: {
      fontSize: 14,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    emptyText: {
      fontSize: 18,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 16,
    },
    listHeader: {
      marginBottom: 16,
      paddingTop: 8,
    },
    listTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    listSubtitle: {
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
      fontSize: 16,
      textAlign: 'center',
    },
    retryButton: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    retryButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '600',
    },

  });

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Yakınımdaki Depremler',
            headerStyle: {
              backgroundColor: colors.primary,
            },
            headerTintColor: 'white',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Deprem verileri yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Yakınımdaki Depremler',
          headerStyle: {
            backgroundColor: colors.primary,
          },
          headerTintColor: 'white',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
      
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >


        <View style={styles.header}>
          <Text style={styles.title}>Son Depremler</Text>
          <Text style={styles.subtitle}>
            {userLocation
              ? `500 km yarıçapındaki depremler${userLocation.accuracy ? ` (±${Math.round(userLocation.accuracy)}m doğruluk)` : ''}`
              : locationError
                ? `Konum alınamadı: ${locationError}`
                : 'Kandilli + AFAD - Türkiye&apos;deki son depremler (2.0+ büyüklük)'
            }
          </Text>
          
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <RefreshCw size={20} color="white" />
            <Text style={styles.refreshButtonText}>Yenile</Text>
          </TouchableOpacity>
        </View>

        {earthquakes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AlertTriangle size={64} color={colors.textSecondary} />
            <Text style={styles.emptyText}>
              Şu anda gösterilecek deprem verisi bulunmuyor.
            </Text>
          </View>
        ) : (
          <>
            {renderMapView()}
            
            <View style={styles.listHeader}>
              <Text style={[styles.listTitle, { color: colors.textPrimary }]}>
                Deprem Listesi ({earthquakes.length})
              </Text>
              <Text style={[styles.listSubtitle, { color: colors.textSecondary }]}>
                {userLocation ? 'En yakın depremler yukarıda' : 'En güncel depremler yukarıda'}
              </Text>
            </View>
            
            {earthquakes.map(renderEarthquakeItem)}
          </>
        )}
      </ScrollView>
    </View>
  );
}
