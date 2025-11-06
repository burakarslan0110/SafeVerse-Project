import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Image, Platform } from 'react-native';
import { Shield, Home } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RequirePWA from '@/components/RequirePWA';

export default function SplashScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, isLoading } = useAuth();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState<boolean | null>(null);
  const fadeAnim = new Animated.Value(0);
  const scaleAnim = new Animated.Value(0.8);

  useEffect(() => {
    checkOnboardingStatus();

    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: Platform.OS === 'web' ? 600 : 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const safeAsyncStorageGetItem = async (key: string): Promise<string | null> => {
    try {
      let value;
      if (Platform.OS === 'web') {
        value = localStorage.getItem(key);
      } else {
        value = await AsyncStorage.getItem(key);
      }
      return value;
    } catch (error) {
      console.error(`Error reading ${key}, clearing corrupted data:`, error);
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
      return null;
    }
  };

  const checkOnboardingStatus = async () => {
    try {
      const onboardingComplete = await safeAsyncStorageGetItem('onboarding_complete');
      setHasSeenOnboarding(onboardingComplete === 'true');
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      setHasSeenOnboarding(false);
    }
  };

  useEffect(() => {
    if (!isLoading && hasSeenOnboarding !== null) {
      const timer = setTimeout(() => {
        if (!hasSeenOnboarding) {
          router.replace('/onboarding');
        } else if (isAuthenticated) {
          router.replace('/(tabs)');
        } else {
          router.replace('/login');
        }
      }, Platform.OS === 'web' ? 400 : 800);

      return () => clearTimeout(timer);
    }
  }, [isLoading, isAuthenticated, hasSeenOnboarding]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    iconContainer: {
      position: 'relative',
      marginBottom: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appIcon: {
      width: 144,
      height: 144,
      borderRadius: 72,
    },
    homeIcon: {
      position: 'absolute',
    },
    title: {
      fontSize: 36,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    loader: {
      position: 'absolute',
      bottom: 64,
      width: 28,
      height: 28,
      borderWidth: 3,
      borderColor: colors.border,
      borderTopColor: colors.primary,
      borderRadius: 14,
    },
    animatedText: {
      opacity: 1,
    },
    creditsContainer: {
      position: 'absolute',
      bottom: 24,
      alignItems: 'center',
    },
    creditsText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      opacity: 0.7,
    },
  });

  return (
    <RequirePWA>
      <View style={styles.container}>
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.appIcon}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[styles.animatedText, { opacity: fadeAnim }]}>
          <Text style={styles.title}>SafeVerse</Text>
          <Text style={styles.subtitle}>Güvenli Evler, Hazırlıklı Aileler</Text>
        </Animated.View>

        <Animated.View style={[styles.creditsContainer, { opacity: fadeAnim }]}>
          <Text style={styles.creditsText}>
            Burak Arslan tarafından GreenNimbus ekibiyle birlikte{'\n'}
            BTK Akademi & Huawei Ar-Ge Kodlama Maratonu'25 için geliştirildi
          </Text>
        </Animated.View>
      </View>
    </RequirePWA>
  );
}
