import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect } from 'react';

interface ThemeContextType {
  isDark: boolean;
  toggleTheme: () => void;
  colors: {
    primary: string;
    primaryDark: string;
    secondary: string;
    accent: string;
    textPrimary: string;
    textSecondary: string;
    background: string;
    cardBackground: string;
    border: string;
  };
}

export const [ThemeProvider, useTheme] = createContextHook(() => {
  const [isDark, setIsDark] = useState<boolean>(false);

  const lightColors = {
    primary: '#0ea5e9',
    primaryDark: '#0284c7',
    secondary: '#f8fafb',
    accent: '#d1dde6',
    textPrimary: '#0e161b',
    textSecondary: '#4a5568',
    background: '#f8fafb',
    cardBackground: '#ffffff',
    border: '#e2e8f0',
  };

  const darkColors = {
    primary: '#0ea5e9',
    primaryDark: '#0284c7',
    secondary: '#1a202c',
    accent: '#2d3748',
    textPrimary: '#f7fafc',
    textSecondary: '#a0aec0',
    background: '#1a202c',
    cardBackground: '#2d3748',
    border: '#4a5568',
  };

  const colors = isDark ? darkColors : lightColors;

  useEffect(() => {
    loadTheme();
  }, []);

  const safeAsyncStorageGetItem = async (key: string): Promise<string | null> => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (error) {
      console.error(`Error reading ${key}, clearing corrupted data:`, error);
      await AsyncStorage.removeItem(key);
      return null;
    }
  };

  const safeAsyncStorageSetItem = async (key: string, value: string) => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.error(`Error storing ${key}:`, error);
      await AsyncStorage.removeItem(key);
      throw error;
    }
  };

  const loadTheme = async () => {
    try {
      const savedTheme = await safeAsyncStorageGetItem('theme');
      if (savedTheme === 'dark') {
        setIsDark(true);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    try {
      await safeAsyncStorageSetItem('theme', newTheme ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  return {
    isDark,
    toggleTheme,
    colors,
  };
});
