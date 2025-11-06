import { router } from 'expo-router';
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Shield, Home, ArrowRight } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useLocation } from '@/contexts/LocationContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { openLocationSettings, forceLocationServiceEnable } from '@/utils/locationHelpers';

const { width } = Dimensions.get('window');

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const slides = [
  {
    id: 1,
    title: 'SafeVerse',
    subtitle: 'Güvenli Evler, Hazırlıklı Aileler',
    icon: 'logo',
  },
  {
    id: 2,
    title: 'Evinizin Güvenliğini Analiz Edin',
    subtitle: 'Evinizdeki potansiyel deprem tehlikelerini belirlemek ve kişiselleştirilmiş güvenlik önerileri almak için telefonunuzun kamerasını kullanın.',
    image: 'https://content.domu.com/styles/global_webp/s3/c-banner-images/woman_holding_iphone11_taking_apartment_photo_hires.jpg.webp?VersionId=q7QCAn2lnMNYoL80188JcZ2hWW9xz9SD&itok=iULC20Dq',
  },
  {
    id: 3,
    title: 'Bağlantıda Kal',
    subtitle: 'Acil durumda sevdiklerinize hızla haber verin.',
    icon: 'communication',
  },
  {
    id: 4,
    title: 'Acil Durum Çantası Kontrolü',
    subtitle: 'Deprem için gerekli tüm malzemelere sahip olduğunuzdan emin olmak için acil durum çantanızı tarayın.',
    image: 'https://alobilginet.teimg.com/crop/1280x720/alobilgi-net/uploads/2025/09/deprem-cantasi-nasil-hazirlanir-808793-1.png',
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { refreshLocation } = useLocation();
  const [currentSlide, setCurrentSlide] = useState<number>(0);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPWAMode, setIsPWAMode] = useState(false);

  // Check if running in PWA mode
  useEffect(() => {
    if (Platform.OS === 'web') {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      setIsPWAMode(isStandalone);
    }
  }, []);

  // PWA Install handler
  useEffect(() => {
    if (Platform.OS !== 'web') return;

      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        const installEvent = e as BeforeInstallPromptEvent;
        setDeferredPrompt(installEvent);
      };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const safeAsyncStorageSetItem = async (key: string, value: string) => {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
      throw error;
    }
  };

  const checkLocationAndProceed = async () => {
    setIsCheckingLocation(true);
    try {
      // Web'de location API'leri farklı çalışır, direkt onboarding'i tamamla
      if (Platform.OS === 'web') {
        await completeOnboarding();
        return;
      }
      
      // Mobil platformlarda konum kontrolü yap
      const { status } = await Location.getForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        // İzin yoksa iste
        const { status: newStatus } = await Location.requestForegroundPermissionsAsync();
        
        if (newStatus !== 'granted') {
          Alert.alert(
            'Konum İzni Gerekli',
            'SafeVerse güvenliğiniz için konum erişimine ihtiyaç duyar.',
            [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Tekrar Dene',
                onPress: () => checkLocationAndProceed(),
              },
            ]
          );
          setIsCheckingLocation(false);
          return;
        }
      }
      
      // İzin alındı, konum servisi kontrolü
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      
      if (!isLocationEnabled) {
        // Konum servisi kapalı, zorunlu aç
        await forceLocationServiceEnable();
        
        // Kullanıcı ayarlardan döndüğünde tekrar kontrol et
        const checkInterval = setInterval(async () => {
          const enabled = await Location.hasServicesEnabledAsync();
          if (enabled) {
            clearInterval(checkInterval);
            await refreshLocation();
            await completeOnboarding();
          }
        }, 1000);
        
        // 30 saniye timeout
        setTimeout(() => {
          clearInterval(checkInterval);
          setIsCheckingLocation(false);
        }, 30000);
      } else {
        // Her şey hazır, konumu al ve devam et
        try {
          await refreshLocation();
        } catch (locationError) {
          console.error('Location refresh error:', locationError);
          // Location refresh hata verse bile onboarding'i tamamla
        }
        await completeOnboarding();
      }
    } catch (error) {
      console.error('Location check error:', error);
      // Hata olsa bile onboarding'i tamamla
      await completeOnboarding();
    }
  };

  const completeOnboarding = async () => {
    try {
      await safeAsyncStorageSetItem('onboarding_complete', 'true');
      router.replace('/login');
    } catch (error) {
      console.error('Error saving onboarding status:', error);
      router.replace('/login');
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const handleInstallPWA = async () => {
    if (!deferredPrompt) {
      // Show browser-specific instructions
      const userAgent = navigator.userAgent.toLowerCase();
      let message = '';

      if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        message = 'Chrome: Adres çubuğundaki yükle simgesine tıklayın veya menüden "Yükle SafeVerse" seçeneğini kullanın.';
      } else if (userAgent.includes('edg')) {
        message = 'Edge: Adres çubuğundaki uygulama simgesine tıklayın veya menüden "Uygulamayı yükle" seçeneğini kullanın.';
      } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        message = 'Safari: Paylaş butonuna (⬆) tıklayıp "Ana Ekrana Ekle" seçeneğini kullanın.';
      } else {
        message = 'Tarayıcınızın menüsünden "Ana ekrana ekle" veya "Yükle" seçeneğini kullanabilirsiniz.';
      }

      Alert.alert('PWA Yükleme', message);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        // PWA installed, proceed to location check
        checkLocationAndProceed();
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      const nextSlide = currentSlide + 1;
      setCurrentSlide(nextSlide);
      scrollViewRef.current?.scrollTo({
        x: nextSlide * width,
        animated: true,
      });
    } else {
      // Last slide - check if PWA or browser
      if (Platform.OS === 'web' && !isPWAMode) {
        // Browser mode - complete onboarding and go to login
        completeOnboarding();
      } else {
        // PWA mode or native - proceed normally
        checkLocationAndProceed();
      }
    }
  };

  const handleSkip = () => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Konum İzni Gerekli',
        'SafeVerse güvenlik özellikleri için konum erişimi gereklidir. Devam etmek için konum iznini vermeniz gerekmektedir.',
        [
          { text: 'Geri', style: 'cancel' },
          {
            text: 'İzin Ver ve Devam Et',
            onPress: () => checkLocationAndProceed(),
          },
        ]
      );
    } else {
      checkLocationAndProceed();
    }
  };

  const renderSlide = (slide: typeof slides[0]) => {
    return (
      <View key={slide.id} style={[styles.slide, { width }]}>
        <View style={styles.content}>
          {slide.icon === 'logo' && (
            <View style={styles.logoContainer}>
              <Image 
                source={require('@/assets/images/icon.png')}
                style={styles.appIcon}
                resizeMode="contain"
              />
            </View>
          )}
          
          {slide.icon === 'communication' && (
            <View style={styles.communicationContainer}>
              <View style={[styles.communicationCircle, styles.outerCircle]} />
              <View style={[styles.communicationCircle, styles.middleCircle]} />
              <View style={[styles.communicationCircle, styles.innerCircle]}>
                <View style={styles.iconRow}>
                  <View style={[styles.iconBubble, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={styles.iconText}>💬</Text>
                  </View>
                  <View style={[styles.iconBubble, { backgroundColor: '#10B981' + '20' }]}>
                    <Text style={styles.iconText}>📍</Text>
                  </View>
                </View>
              </View>
            </View>
          )}
          
          {slide.image && (
            <Image
              source={{ uri: slide.image }}
              style={styles.slideImage}
              resizeMode="cover"
            />
          )}
          
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {slide.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {slide.subtitle}
          </Text>
        </View>
      </View>
    );
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      position: 'absolute',
      top: 50,
      right: 16,
      zIndex: 10,
    },
    skipButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    skipText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    scrollView: {
      flex: 1,
    },
    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingTop: 60,
      paddingBottom: 20,
    },
    content: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
    },
    logoContainer: {
      position: 'relative',
      marginBottom: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appIcon: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    homeIconOverlay: {
      position: 'absolute',
    },
    communicationContainer: {
      width: 240,
      height: 240,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    communicationCircle: {
      position: 'absolute',
      borderRadius: 1000,
    },
    outerCircle: {
      width: 240,
      height: 240,
      backgroundColor: colors.primary + '10',
    },
    middleCircle: {
      width: 200,
      height: 200,
      backgroundColor: colors.primary + '20',
    },
    innerCircle: {
      width: 160,
      height: 160,
      backgroundColor: colors.cardBackground,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconRow: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
    },
    iconBubble: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconText: {
      fontSize: 28,
    },
    slideImage: {
      width: Math.min(width - 80, 300),
      height: Math.min(width - 80, 300) * 0.75, // 4:3 aspect ratio
      borderRadius: 16,
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 12,
      lineHeight: 30,
      paddingHorizontal: 8,
    },
    subtitle: {
      fontSize: 15,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: width - 80,
      paddingHorizontal: 8,
    },
    footer: {
      padding: 24,
    },
    nextButton: {
      backgroundColor: colors.primary,
      borderRadius: 28,
      height: 56,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    nextButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '600',
      marginRight: 8,
    },
    dotsContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 12,
    },
    dot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    activeDot: {
      backgroundColor: colors.primary,
    },
    inactiveDot: {
      backgroundColor: colors.accent,
    },
    disabledButton: {
      opacity: 0.7,
    },
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>Atla</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => {
          const slideIndex = Math.round(event.nativeEvent.contentOffset.x / width);
          setCurrentSlide(slideIndex);
        }}
        style={styles.scrollView}
      >
        {slides.map(renderSlide)}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.nextButton, isCheckingLocation && styles.disabledButton]} 
          onPress={handleNext}
          disabled={isCheckingLocation}
        >
          {isCheckingLocation ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              {currentSlide === slides.length - 1 && Platform.OS === 'web' && !isPWAMode ? (
                <>
                  
                  <Text style={styles.nextButtonText}>SafeVerse'e devam et</Text>
                </>
              ) : (
                <>
                  <Text style={styles.nextButtonText}>
                    {currentSlide === slides.length - 1 ? 'Başla' : 'İleri'}
                  </Text>
                  <ArrowRight size={20} color="white" />
                </>
              )}
            </>
          )}
        </TouchableOpacity>

        <View style={styles.dotsContainer}>
          {slides.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentSlide ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

