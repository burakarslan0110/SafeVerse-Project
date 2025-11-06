import { Platform, Linking, Alert } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Location from 'expo-location';

export const openLocationSettings = async () => {
  if (Platform.OS === 'android') {
    // Android için doğrudan konum ayarlarını aç
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.LOCATION_SOURCE_SETTINGS
      );
    } catch (error) {
      console.error('Konum ayarları açılamadı:', error);
      // Alternatif olarak genel ayarlara yönlendir
      Linking.openSettings();
    }
  } else if (Platform.OS === 'ios') {
    // iOS için uygulama ayarlarına yönlendir
    Linking.openURL('app-settings:');
  }
};

export const checkAndRequestLocation = async () => {
  try {
    // Önce izin kontrolü
    const { status } = await Location.getForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      // İzin yoksa izin iste
      const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
      
      if (newStatus !== 'granted') {
        Alert.alert(
          'Konum İzni Gerekli',
          'SafeVerse uygulaması için konum izni vermeniz gerekiyor.',
          [
            { text: 'İptal', style: 'cancel' },
            { 
              text: 'Ayarlara Git', 
              onPress: () => Linking.openSettings() 
            }
          ]
        );
        return false;
      }
    }
    
    // İzin varsa, konum servisi kontrolü
    const isLocationEnabled = await Location.hasServicesEnabledAsync();
    
    if (!isLocationEnabled) {
      Alert.alert(
        'Konum Servisi Kapalı',
        'Konum servisleriniz kapalı. SafeVerse\'in tüm özelliklerini kullanabilmek için lütfen konum servislerini açın.',
        [
          { text: 'Daha Sonra', style: 'cancel' },
          { 
            text: 'Konum Ayarlarını Aç', 
            onPress: openLocationSettings 
          }
        ]
      );
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Konum kontrolü hatası:', error);
    return false;
  }
};

// Android için özel konum servisi açma zorlaması
export const forceLocationServiceEnable = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    Alert.alert(
      'Konum Servisi Zorunlu',
      'SafeVerse güvenlik özellikleri için konum servislerinin açık olması gerekiyor. Lütfen konum servislerini açın.',
      [
        {
          text: 'Konum Ayarlarını Aç',
          onPress: async () => {
            await openLocationSettings();
            resolve(true);
          },
        },
      ],
      { cancelable: false } // Kullanıcı dialog dışına tıklayarak kapatamaz
    );
  });
};

// Konum servisi durumunu sürekli kontrol eden hook
export const useLocationServiceMonitor = (callback: (enabled: boolean) => void) => {
  let interval: NodeJS.Timeout;
  
  const startMonitoring = () => {
    // Her 2 saniyede bir konum servisi durumunu kontrol et
    interval = setInterval(async () => {
      const enabled = await Location.hasServicesEnabledAsync();
      callback(enabled);
    }, 2000);
  };
  
  const stopMonitoring = () => {
    if (interval) {
      clearInterval(interval);
    }
  };
  
  return { startMonitoring, stopMonitoring };
};