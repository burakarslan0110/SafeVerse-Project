import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useSafeZone } from '@/contexts/SafeZoneContext';
import { useEmergencyBag } from '@/contexts/EmergencyBagContext';
import { isMobileBrowser } from '@/utils/platformHelpers';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export type NotificationType = 'earthquake' | 'warning' | 'success' | 'info';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  time: string;
  timestamp: number;
  key?: string; // Unique key for deduplication
};

export type BannerNotification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
};

const NOTIFICATION_STORAGE_KEY = '@SafeVerse:notifications';
const LAST_EARTHQUAKE_CHECK_KEY = '@SafeVerse:lastEarthquakeCheck';
const LAST_SAFETY_REMINDER_KEY = '@SafeVerse:lastSafetyReminder';
const LAST_ASSESSMENT_REMINDER_KEY = '@SafeVerse:lastAssessmentReminder';
const UNREAD_COUNT_KEY = '@SafeVerse:unreadNotificationCount';
const REMINDER_INTERVAL = 20 * 60 * 1000; // 20 minutes
const EARTHQUAKE_NOTIFICATION_DISTANCE = 150; // 150km - notify for nearby earthquakes

export const [NotificationProvider, useNotifications] = createContextHook(() => {
  const { isAuthenticated, safetyScores } = useAuth();
  const { assessments } = useSafeZone();
  const { analyses } = useEmergencyBag();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lastEarthquakes, setLastEarthquakes] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [currentBanner, setCurrentBanner] = useState<BannerNotification | null>(null);
  const hasCheckedInitialStatus = useRef(false);

  // Request notification permissions only after authentication
  useEffect(() => {
    if (!isAuthenticated) return;
    if (Platform.OS !== 'web') {
      registerForPushNotificationsAsync();
    } else {
      requestWebNotificationPermission();
    }
  }, [isAuthenticated]);

  // Load notifications from storage
  useEffect(() => {
    loadNotifications();
    loadLastEarthquakes();
    loadUnreadCount();
  }, []);

  // Check initial assessment status when user logs in
  useEffect(() => {
    if (isAuthenticated && !hasCheckedInitialStatus.current) {
      hasCheckedInitialStatus.current = true;
      checkInitialAssessmentStatus();
    }
  }, [isAuthenticated]);

  // Periodically check for low safety score and assessment status (every 20 minutes)
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkReminders = async () => {
      const now = Date.now();

      // Check safety score
      const lastSafetyReminder = await AsyncStorage.getItem(LAST_SAFETY_REMINDER_KEY);
      if (!lastSafetyReminder || now - parseInt(lastSafetyReminder) >= REMINDER_INTERVAL) {
        if (safetyScores && safetyScores.totalSafetyScore < 50) {
          await addNotification({
            type: 'warning',
            title: 'Güvenlik Puanınız Düşük',
            message: `Genel güvenlik puanınız ${safetyScores.totalSafetyScore}%. SafeZone ve PrepCheck analizlerinizi tamamlayarak puanınızı yükseltebilirsiniz.`,
            key: 'low-safety-score',
          });
          await AsyncStorage.setItem(LAST_SAFETY_REMINDER_KEY, now.toString());
        }
      }

      // Check assessment status
      const lastAssessmentReminder = await AsyncStorage.getItem(LAST_ASSESSMENT_REMINDER_KEY);
      if (!lastAssessmentReminder || now - parseInt(lastAssessmentReminder) >= REMINDER_INTERVAL) {
        const hasSafeZone = assessments.length > 0 && assessments[0].completedRooms > 0;
        const hasPrepCheck = analyses.length > 0 && analyses[0].isCompleted;

        if (!hasSafeZone || !hasPrepCheck) {
          if (!hasSafeZone && !hasPrepCheck) {
            await addNotification({
              type: 'warning',
              title: 'Güvenlik Analizlerinizi Tamamlayın',
              message: 'SafeZone ve PrepCheck analizlerinizi yaparak ev güvenliğinizi değerlendirin ve depreme hazırlıklı olun.',
              key: 'complete-both-assessments',
            });
          } else if (!hasSafeZone) {
            await addNotification({
              type: 'info',
              title: 'SafeZone Analizini Tamamlayın',
              message: 'Evinizin deprem güvenliğini değerlendirmek için SafeZone analizini yapın.',
              key: 'complete-safezone',
            });
          } else if (!hasPrepCheck) {
            await addNotification({
              type: 'info',
              title: 'PrepCheck Analizini Tamamlayın',
              message: 'Acil durum çantanızı kontrol etmek için PrepCheck analizini yapın.',
              key: 'complete-prepcheck',
            });
          }
          await AsyncStorage.setItem(LAST_ASSESSMENT_REMINDER_KEY, now.toString());
        }
      }
    };

    // Check immediately and then every 20 minutes
    checkReminders();
    const interval = setInterval(checkReminders, REMINDER_INTERVAL);

    return () => clearInterval(interval);
  }, [isAuthenticated, safetyScores, assessments, analyses]);

  const loadNotifications = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (stored) {
        const loadedNotifications: Notification[] = JSON.parse(stored);
        setNotifications(loadedNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const loadLastEarthquakes = async () => {
    try {
      const stored = await AsyncStorage.getItem(LAST_EARTHQUAKE_CHECK_KEY);
      if (stored) {
        setLastEarthquakes(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading last earthquakes:', error);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const stored = await AsyncStorage.getItem(UNREAD_COUNT_KEY);
      if (stored) {
        setUnreadCount(parseInt(stored));
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const saveUnreadCount = async (count: number) => {
    try {
      await AsyncStorage.setItem(UNREAD_COUNT_KEY, count.toString());
    } catch (error) {
      console.error('Error saving unread count:', error);
    }
  };

  const saveNotifications = async (notificationsToSave: Notification[]) => {
    try {
      // Keep only last 50 notifications
      const limitedNotifications = notificationsToSave.slice(0, 50);
      await AsyncStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(limitedNotifications));
    } catch (error) {
      console.error('Error saving notifications:', error);
    }
  };

  const saveLastEarthquakes = async (earthquakeIds: string[]) => {
    try {
      await AsyncStorage.setItem(LAST_EARTHQUAKE_CHECK_KEY, JSON.stringify(earthquakeIds));
    } catch (error) {
      console.error('Error saving last earthquakes:', error);
    }
  };


  const getRelativeTime = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Şimdi';
    if (minutes < 60) return `${minutes} dk önce`;
    if (hours < 24) return `${hours} saat önce`;
    return `${days} gün önce`;
  };

  const registerForPushNotificationsAsync = async () => {
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
    }
  };

  const requestWebNotificationPermission = async () => {
    if (!('Notification' in window)) {
      return;
    }

    // iOS Safari doesn't support Web Notification API at all
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (isIOS) {
      return;
    }

    // Check for secure context on mobile browsers
    const isMobile = isMobileBrowser();
    if (isMobile) {
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
      if (!isSecureContext) {
        return;
      }
    }

    if (Notification.permission === 'granted') {
      return;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Test notification on mobile PWA
          if (isMobile) {
            try {
              const testNotif = new Notification('SafeVerse Bildirimleri Aktif', {
                body: 'Artık önemli deprem ve güvenlik bildirimlerini alacaksınız.',
                icon: '/icon.png',
                badge: '/icon.png',
                silent: false,
              });
              setTimeout(() => testNotif.close(), 4000);
            } catch (error) {
              console.error('❌ Failed to send test notification:', error);
            }
          }
        }
      } catch (error) {
        console.error('❌ Failed to request notification permission:', error);
      }
    }
  };

  const isMobileBrowser = () => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
  };

  const showBannerNotification = (type: NotificationType, title: string, message: string) => {
    // Show in-app banner on all platforms (web + native)
    const bannerNotification: BannerNotification = {
      id: Date.now().toString(),
      type,
      title,
      message,
    };
    setCurrentBanner(bannerNotification);
  };

  const sendWebNotification = (title: string, body: string, type: NotificationType = 'info') => {
    // Always show in-app banner for all web notifications
    showBannerNotification(type, title, body);

    // Also try to send Web Notification if available
    if (!('Notification' in window)) {
      return;
    }

    // Check if it's iOS Safari - doesn't support Web Notifications at all
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
    if (isIOS) {
      return;
    }

    // Check for secure context (HTTPS) on mobile browsers
    const isMobile = isMobileBrowser();
    if (isMobile) {
      const isSecureContext = window.isSecureContext || window.location.protocol === 'https:';
      if (!isSecureContext) {
        return;
      }
    }

    // Try to send Web Notification if permission granted (as additional notification)
    if (Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          body,
          icon: '/icon.png', // App icon
          badge: '/icon.png',
          vibrate: [200, 100, 200],
          tag: `safeverse-${Date.now()}`, // Unique tag to prevent grouping
          requireInteraction: false, // Auto-dismiss after a few seconds
          silent: false,
        });

        // Auto-close after 6 seconds
        setTimeout(() => notification.close(), 6000);

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      } catch (error) {
        console.error('❌ Failed to send web notification:', error);
      }
    }
  };

  const sendPushNotification = async (title: string, body: string, type: NotificationType = 'info') => {
    if (Platform.OS === 'web') {
      // On web, also trigger in-app banner + Web Notification (if permitted)
      sendWebNotification(title, body, type);
      return;
    }

    // On native, show in-app banner as immediate feedback
    showBannerNotification(type, title, body);

    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          vibrate: [0, 250, 250, 250],
          badge: 1,
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  };

  const addNotification = useCallback(async (notification: Omit<Notification, 'id' | 'time' | 'timestamp'>) => {
    const timestamp = Date.now();

    // Generate a unique key for deduplication if not provided
    const notificationKey = notification.key || `${notification.type}-${notification.title}`;

    // Check if this notification already exists
    const existingIndex = notifications.findIndex(n => n.key === notificationKey);

    let updatedNotifications: Notification[];
    let shouldIncrementUnread = true;

    if (existingIndex !== -1) {
      // Notification exists, update it and move to top
      const existingNotification = notifications[existingIndex];
      const updatedNotification: Notification = {
        ...existingNotification,
        message: notification.message, // Update message in case it changed
        time: getRelativeTime(timestamp),
        timestamp,
      };

      // Remove from old position and add to top
      updatedNotifications = [
        updatedNotification,
        ...notifications.slice(0, existingIndex),
        ...notifications.slice(existingIndex + 1)
      ];

      // Don't increment unread count if just updating existing notification
      shouldIncrementUnread = false;
      // Avoid re-sending push/banner for duplicate updates to prevent double banners
    } else {
      // New notification
      const newNotification: Notification = {
        ...notification,
        id: timestamp.toString(),
        key: notificationKey,
        time: getRelativeTime(timestamp),
        timestamp,
      };

      updatedNotifications = [newNotification, ...notifications];

      // Send push notification for new notification
      await sendPushNotification(newNotification.title, newNotification.message, newNotification.type);
    }

    setNotifications(updatedNotifications);
    await saveNotifications(updatedNotifications);

    // Increment unread count only for new notifications
    if (shouldIncrementUnread) {
      const newUnreadCount = unreadCount + 1;
      setUnreadCount(newUnreadCount);
      await saveUnreadCount(newUnreadCount);
    }
  }, [notifications, unreadCount]);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    setUnreadCount(0);
    await AsyncStorage.removeItem(NOTIFICATION_STORAGE_KEY);
    await AsyncStorage.removeItem(UNREAD_COUNT_KEY);
  }, []);

  const markAllAsRead = useCallback(async () => {
    setUnreadCount(0);
    await saveUnreadCount(0);
  }, []);

  const checkInitialAssessmentStatus = useCallback(async () => {
    const hasSafeZone = assessments.length > 0 && assessments[0].completedRooms > 0;
    const hasPrepCheck = analyses.length > 0 && analyses[0].isCompleted;

    // İkisi de yapılmamışsa
    if (!hasSafeZone && !hasPrepCheck) {
      await addNotification({
        type: 'warning',
        title: 'Güvenlik Analizlerinizi Tamamlayın',
        message: 'SafeZone ve PrepCheck analizlerinizi yaparak ev güvenliğinizi değerlendirin ve depreme hazırlıklı olun.',
        key: 'complete-both-assessments',
      });
    }
    // Sadece SafeZone eksikse
    else if (!hasSafeZone) {
      await addNotification({
        type: 'info',
        title: 'SafeZone Analizini Tamamlayın',
        message: 'Evinizin deprem güvenliğini değerlendirmek için SafeZone analizini yapın.',
        key: 'complete-safezone',
      });
    }
    // Sadece PrepCheck eksikse
    else if (!hasPrepCheck) {
      await addNotification({
        type: 'info',
        title: 'PrepCheck Analizini Tamamlayın',
        message: 'Acil durum çantanızı kontrol etmek için PrepCheck analizini yapın.',
        key: 'complete-prepcheck',
      });
    }
    // İkisi de yapılmış ama güvenlik puanı düşükse
    else if (safetyScores && safetyScores.totalSafetyScore < 50) {
      await addNotification({
        type: 'warning',
        title: 'Güvenlik Puanınız Düşük',
        message: `Genel güvenlik puanınız ${safetyScores.totalSafetyScore}%. SafeZone ve PrepCheck analizlerinizi güncelleyerek puanınızı yükseltebilirsiniz.`,
        key: 'low-safety-score',
      });
    }
  }, [assessments, analyses, safetyScores, addNotification]);

  const checkForNewEarthquakes = useCallback(async (earthquakes: any[]) => {
    if (!earthquakes || earthquakes.length === 0) return;

    // Get earthquake IDs within EARTHQUAKE_NOTIFICATION_DISTANCE (50km) with magnitude >= 3.0
    const nearbyEarthquakes = earthquakes
      .filter(eq => (eq.distanceFromUser || 0) <= EARTHQUAKE_NOTIFICATION_DISTANCE && eq.mag >= 3.0)
      .map(eq => eq.earthquake_id);

    // Find new earthquakes
    const newEarthquakes = nearbyEarthquakes.filter(id => !lastEarthquakes.includes(id));

    if (newEarthquakes.length > 0) {
      // Get details of new earthquakes
      const newEarthquakeDetails = earthquakes.filter(eq =>
        newEarthquakes.includes(eq.earthquake_id)
      );

      // Sort by magnitude and take the strongest one
      const strongestEarthquake = newEarthquakeDetails.sort((a, b) => b.mag - a.mag)[0];

      await addNotification({
        type: 'earthquake',
        title: 'Yakınınızda Deprem Algılandı!',
        message: `${strongestEarthquake.title} - Büyüklük: ${strongestEarthquake.mag}, Uzaklık: ${Math.round(strongestEarthquake.distanceFromUser || 0)} km`,
        key: `earthquake-${strongestEarthquake.earthquake_id}`,
      });

      // Update last earthquakes list
      const updatedLastEarthquakes = [...nearbyEarthquakes].slice(0, 100); // Keep last 100
      setLastEarthquakes(updatedLastEarthquakes);
      await saveLastEarthquakes(updatedLastEarthquakes);
    }
  }, [lastEarthquakes, addNotification]);

  // Update relative times every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifications(prev =>
        prev.map(n => ({
          ...n,
          time: getRelativeTime(n.timestamp),
        }))
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const dismissBanner = useCallback(() => {
    setCurrentBanner(null);
  }, []);

  return {
    notifications,
    unreadCount,
    currentBanner,
    addNotification,
    clearAll,
    markAllAsRead,
    checkForNewEarthquakes,
    dismissBanner,
  };
});
