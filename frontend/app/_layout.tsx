import { Stack, usePathname } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, View, ActivityIndicator } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { FamilyProvider } from "@/contexts/FamilyContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SafeZoneProvider } from "@/contexts/SafeZoneContext";
import { EmergencyBagProvider } from "@/contexts/EmergencyBagContext";
import { LocationProvider } from "@/contexts/LocationContext";
import { NotificationProvider, useNotifications } from "@/contexts/NotificationContext";
import { NavigationBlockerProvider } from "@/contexts/NavigationBlockerContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import NotificationBanner from "@/components/NotificationBanner";
import Head from "expo-router/head";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { currentBanner, dismissBanner } = useNotifications();
  const { isAuthenticated } = useAuth();
  const pathname = usePathname();

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={{
        headerBackTitle: "Geri",
        headerStyle: { backgroundColor: '#0ea5e9' },
        headerTintColor: 'white',
        headerTitleStyle: { fontWeight: 'bold' }
      }}>
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="home-security" options={{
          title: 'SafeZone - Ev Güvenlik Analizi',
          headerShown: true
        }} />
        <Stack.Screen name="emergency-bag" options={{
          title: 'PrepCheck - Acil Durum Çantası',
          headerShown: true
        }} />
        <Stack.Screen name="nearby-earthquakes" options={{
          title: 'Yakınımdaki Depremler',
          headerShown: true
        }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="earthquake-simulation" options={{
          title: 'Deprem Simülasyonu',
          headerShown: true
        }} />
      </Stack>
      {/* Notification banner: hide only on auth/marketing screens */}
      {(() => {
        const path = typeof pathname === 'string' ? pathname : '';
        const hideOn = ['/landing', 'onboarding', '/login', '/register'];
        // Hide global banner on any tabs route or when authenticated on root ('/')
        const isInTabs = path.includes('(tabs)');
        const isRoot = !path || path === '/' || path === '';
        const shouldHide = hideOn.some(seg => path.includes(seg)) || isInTabs || (isAuthenticated && isRoot);
        if (shouldHide) return null;
        const isTabsLike = isRoot;
        return (
          <NotificationBanner
            notification={currentBanner}
            onDismiss={dismissBanner}
            autoDismissDelay={5000}
            bottomOffset={isTabsLike ? 120 : 24}
          />
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure contexts are mounted, especially on web
    const timer = setTimeout(() => {
      setAppIsReady(true);
      SplashScreen.hideAsync();
    }, Platform.OS === 'web' ? 150 : 50);

    if (Platform.OS !== 'web') {
      return () => clearTimeout(timer);
    }

    let loadListenerAttached = false;
    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register('/service-worker.js', { scope: '/' })
        .catch(error => console.error('Service worker registration failed:', error));
    };

    if ('serviceWorker' in navigator) {
      if (document.readyState === 'complete') {
        registerServiceWorker();
      } else {
        window.addEventListener('load', registerServiceWorker, { once: true });
        loadListenerAttached = true;
      }
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      // Store globally so pages like landing can trigger reliably
      (window as any).__pwaDeferredPrompt = event as InstallPromptEvent;
    };

    const handleAppInstalled = () => {
      (window as any).__pwaDeferredPrompt = null;
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (loadListenerAttached) {
        window.removeEventListener('load', registerServiceWorker);
      }
    };
  }, []);

  if (!appIsReady) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0ea5e9', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      {Platform.OS === 'web' && (
        <Head>
          <meta charSet="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

          {/* PWA Meta Tags */}
          <meta name="application-name" content="SafeVerse" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="SafeVerse" />
          <meta name="description" content="SafeVerse ile deprem güvenliği, aile iletişimi ve acil durum hazırlığını tek platformdan yönetin." />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="theme-color" content="#0ea5e9" />

          {/* PWA Manifest */}
          <link rel="manifest" href="/manifest.json" />

          {/* Icons */}
          <link rel="icon" type="image/png" sizes="192x192" href="/assets/images/icon.png" />
          <link rel="icon" type="image/png" sizes="512x512" href="/assets/images/icon.png" />
          <link rel="apple-touch-icon" href="/assets/images/icon.png" />
          <link rel="shortcut icon" href="/assets/images/favicon.png" />

          <title>SafeVerse - Deprem Güvenlik Uygulaması</title>
        </Head>
      )}
      <ThemeProvider>
        <NavigationBlockerProvider>
          <AuthProvider>
            <ProtectedRoute>
              <SafeZoneProvider>
                <EmergencyBagProvider>
                  <NotificationProvider>
                    <LocationProvider>
                      <FamilyProvider>
                        <GestureHandlerRootView style={styles.container}>
                          <RootLayoutNav />
                        </GestureHandlerRootView>
                      </FamilyProvider>
                    </LocationProvider>
                  </NotificationProvider>
                </EmergencyBagProvider>
              </SafeZoneProvider>
            </ProtectedRoute>
          </AuthProvider>
        </NavigationBlockerProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
