import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, AlertTriangle, CheckCircle, Info, X } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

export interface BannerNotification {
  id: string;
  type: 'earthquake' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
}

interface NotificationBannerProps {
  notification: BannerNotification | null;
  onDismiss: () => void;
  autoDismissDelay?: number; // milliseconds
  bottomOffset?: number;
}

/**
 * Mobile web notification banner - shown at the top of the screen
 * Used as fallback when Web Notification API is not available (iOS Safari, non-HTTPS Android)
 */
export default function NotificationBanner({
  notification,
  onDismiss,
  autoDismissDelay = 5000,
  bottomOffset = 24,
}: NotificationBannerProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Slide from bottom instead of top
  const [slideAnim] = useState(new Animated.Value(200));
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsVisible(true);
      // Slide up from bottom
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 10,
      }).start();

      // Auto dismiss after delay
      const timer = setTimeout(() => {
        dismissBanner();
      }, autoDismissDelay);

      return () => clearTimeout(timer);
    }
  }, [notification]);

  const dismissBanner = () => {
    // Slide down to bottom
    Animated.timing(slideAnim, {
      toValue: 200,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      onDismiss();
    });
  };

  const getNotificationIcon = (type: string) => {
    const iconSize = 24;
    switch (type) {
      case 'earthquake':
        return <Bell size={iconSize} color="#FFF" />;
      case 'warning':
        return <AlertTriangle size={iconSize} color="#FFF" />;
      case 'success':
        return <CheckCircle size={iconSize} color="#FFF" />;
      case 'info':
        return <Info size={iconSize} color="#FFF" />;
      default:
        return <Bell size={iconSize} color="#FFF" />;
    }
  };

  const getBackgroundColor = (type: string) => {
    switch (type) {
      case 'earthquake':
        return '#EF4444'; // Red
      case 'warning':
        return '#F59E0B'; // Orange
      case 'success':
        return '#10B981'; // Green
      case 'info':
        return colors.primary; // Blue
      default:
        return colors.primary;
    }
  };

  if (!isVisible || !notification) {
    return null;
  }

  const styles = StyleSheet.create({
    container: {
      position: 'absolute',
      // Position above tab bar / bottom UI (use provided offset + safe area)
      bottom: insets.bottom + bottomOffset,
      left: 16,
      right: 16,
      zIndex: 9999,
      backgroundColor: getBackgroundColor(notification.type),
      borderRadius: 12,
      padding: 16,
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      marginTop: 2,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
      marginBottom: 4,
    },
    message: {
      fontSize: 14,
      color: '#FFFFFF',
      opacity: 0.95,
      lineHeight: 18,
    },
    closeButton: {
      padding: 4,
      marginTop: -4,
      marginRight: -4,
    },
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={styles.iconContainer}>
        {getNotificationIcon(notification.type)}
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.message} numberOfLines={2}>
          {notification.message}
        </Text>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={dismissBanner}>
        <X size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </Animated.View>
  );
}
