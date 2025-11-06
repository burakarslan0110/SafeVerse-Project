import React, { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)' ||
                        segments[0] === 'home-security' ||
                        segments[0] === 'emergency-bag' ||
                        segments[0] === 'nearby-earthquakes' ||
                        segments[0] === 'earthquake-simulation' ||
                        segments[0] === 'change-password' ||
                        segments[0] === 'notification-settings' ||
                        segments[0] === 'help-support';

    if (!isAuthenticated && inAuthGroup) {
      // User is not authenticated but trying to access protected route
      router.replace('/login');
    } else if (isAuthenticated && (segments[0] === 'login' || segments[0] === 'register' || segments[0] === 'onboarding' || segments[0] === 'landing' || segments.length === 0)) {
      // User is authenticated but on auth screens, redirect to home
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <>{children}</>;
}
