import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocation } from '@/contexts/LocationContext';
import { MaterialIcons } from '@expo/vector-icons';

interface RequireLocationServiceProps {
  children: React.ReactNode;
}

export function RequireLocationService({ children }: RequireLocationServiceProps) {
  const {
    locationPermission,
    isLocationServiceEnabled,
    isLoadingLocation,
    location,
  } = useLocation();
  
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Konum servisi açık ve konum alındıysa hazır
    if (isLocationServiceEnabled && (location || isLoadingLocation)) {
      setIsReady(true);
    }
  }, [isLocationServiceEnabled, location, isLoadingLocation]);

  // Eğer her şey hazırsa children'ı göster
  if (isReady) {
    return <>{children}</>;
  }

  // Bekleme ekranı
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="location-on" size={80} color="#007AFF" />
        
        <Text style={styles.title}>SafeVerse Hazırlanıyor</Text>
        
        <Text style={styles.subtitle}>
          {!locationPermission
            ? 'Konum izni bekleniyor...'
            : !isLocationServiceEnabled
            ? 'Konum servisi açılması bekleniyor...'
            : 'Konumunuz belirleniyor...'}
        </Text>

        <ActivityIndicator
          size="large"
          color="#007AFF"
          style={styles.loader}
        />

        <View style={styles.infoBox}>
          <MaterialIcons name="info-outline" size={20} color="#666" />
          <Text style={styles.infoText}>
            SafeVerse güvenliğiniz için konumunuza ihtiyaç duyar
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 24,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  loader: {
    marginBottom: 40,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
});