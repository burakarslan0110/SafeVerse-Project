import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocation } from '@/contexts/LocationContext';
import { openLocationSettings, useLocationServiceMonitor } from '@/utils/locationHelpers';

export function LocationStatusCard() {
  const {
    location,
    locationPermission,
    isLocationServiceEnabled,
    isLoadingLocation,
    refreshLocation,
    checkLocationServices,
  } = useLocation();

  const [isMonitoring, setIsMonitoring] = useState(false);

  // Android'de konum servisi değişikliğini izle
  const { startMonitoring, stopMonitoring } = useLocationServiceMonitor(
    async (enabled) => {
      if (enabled && !isLocationServiceEnabled) {
        // Konum servisi yeni açıldı, konumu al
        await checkLocationServices();
        await refreshLocation();
      }
    }
  );

  useEffect(() => {
    if (Platform.OS === 'android' && !isLocationServiceEnabled && locationPermission) {
      // Android'de izin var ama konum servisi kapalıysa monitörü başlat
      startMonitoring();
      setIsMonitoring(true);
    }

    return () => {
      if (isMonitoring) {
        stopMonitoring();
      }
    };
  }, [isLocationServiceEnabled, locationPermission]);

  const getStatusInfo = () => {
    if (!locationPermission) {
      return {
        icon: 'location-off',
        color: '#FF6B6B',
        title: 'Konum İzni Yok',
        description: 'Uygulamaya konum izni verin',
      };
    }

    if (!isLocationServiceEnabled) {
      return {
        icon: 'location-disabled',
        color: '#FFA500',
        title: 'Konum Servisi Kapalı',
        description: 'Cihazınızın konum ayarlarını açın',
      };
    }

    if (isLoadingLocation) {
      return {
        icon: 'my-location',
        color: '#4CAF50',
        title: 'Konum Alınıyor...',
        description: 'Konumunuz belirleniyor',
      };
    }

    if (location) {
      return {
        icon: 'location-on',
        color: '#4CAF50',
        title: 'Konum Aktif',
        description: `Enlem: ${location.latitude.toFixed(4)}, Boylam: ${location.longitude.toFixed(4)}`,
      };
    }

    return {
      icon: 'location-searching',
      color: '#9E9E9E',
      title: 'Konum Bekleniyor',
      description: 'Konum bilgisi alınamadı',
    };
  };

  const handlePress = async () => {
    if (!locationPermission || !isLocationServiceEnabled) {
      await openLocationSettings();
    } else {
      await refreshLocation();
    }
  };

  const status = getStatusInfo();

  return (
    <TouchableOpacity style={styles.card} onPress={handlePress}>
      <View style={styles.iconContainer}>
        {isLoadingLocation ? (
          <ActivityIndicator size="large" color={status.color} />
        ) : (
          <MaterialIcons name={status.icon} size={32} color={status.color} />
        )}
      </View>
      
      <View style={styles.textContainer}>
        <Text style={styles.title}>{status.title}</Text>
        <Text style={styles.description}>{status.description}</Text>
      </View>

      {(!locationPermission || !isLocationServiceEnabled) && (
        <MaterialIcons name="settings" size={24} color="#666" />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 4,
  },
  iconContainer: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#666',
  },
});