import { Platform, Alert } from 'react-native';

/**
 * Platform-agnostic alert/confirm dialog
 */
export const showAlert = (
  title: string,
  message: string,
  buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>
) => {
  if (Platform.OS === 'web') {
    // Web için native confirm/alert kullan
    if (buttons && buttons.length > 1) {
      const confirmText = buttons.find(b => b.style !== 'cancel')?.text || 'OK';
      const result = window.confirm(`${title}\n\n${message}`);

      if (result) {
        const confirmButton = buttons.find(b => b.style !== 'cancel');
        confirmButton?.onPress?.();
      } else {
        const cancelButton = buttons.find(b => b.style === 'cancel');
        cancelButton?.onPress?.();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
      buttons?.[0]?.onPress?.();
    }
  } else {
    // Mobil için native Alert kullan
    Alert.alert(title, message, buttons);
  }
};

/**
 * Platform-agnostic simple alert
 */
export const showSimpleAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

/**
 * Check if platform is web
 */
export const isWeb = Platform.OS === 'web';

/**
 * Check if platform is mobile (iOS or Android)
 */
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

/**
 * Get platform-specific value
 */
export const platformSelect = <T,>(options: { web?: T; mobile?: T; ios?: T; android?: T; default?: T }): T => {
  if (Platform.OS === 'web' && options.web !== undefined) return options.web;
  if (Platform.OS === 'ios' && options.ios !== undefined) return options.ios;
  if (Platform.OS === 'android' && options.android !== undefined) return options.android;
  if (isMobile && options.mobile !== undefined) return options.mobile;
  return options.default as T;
};

/**
 * Check if running on desktop browser (not mobile browser)
 */
export const isDesktopBrowser = (): boolean => {
  if (Platform.OS !== 'web') return false;

  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;

  // Check for mobile user agents
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  return !mobileRegex.test(userAgent.toLowerCase());
};

/**
 * Check if running on mobile browser (not desktop)
 */
export const isMobileBrowser = (): boolean => {
  if (Platform.OS !== 'web') return false;

  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;

  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  const mobileRegex = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  return mobileRegex.test(userAgent.toLowerCase());
};
