import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { apiService, setUnauthorizedCallback } from '@/lib/api';
import { showAlert } from '@/utils/platformHelpers';

interface User {
  id: number;
  email: string;
  firstName?: string;
  lastName?: string;
  name?: string; // Deprecated, kept for backward compatibility
}

interface SafetyScores {
  safeZoneScore: number;
  prepCheckScore: number;
  totalSafetyScore: number;
  latitude?: number;
  longitude?: number;
  locationUpdatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  safetyScores: SafetyScores | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (firstName: string, lastName: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  updateLocation: (latitude: number, longitude: number) => Promise<void>;
  updateSafetyScores: (safeZoneScore?: number, prepCheckScore?: number) => Promise<void>;
  fetchSafetyScores: () => Promise<void>;
}

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [safetyScores, setSafetyScores] = useState<SafetyScores | null>(null);
  const hasShownTokenExpiredAlert = useRef(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  // Register callback for handling 401 unauthorized errors (token expired)
  useEffect(() => {
    const handleUnauthorized = async () => {
      // Show alert only once per session to avoid spam
      if (!hasShownTokenExpiredAlert.current) {
        hasShownTokenExpiredAlert.current = true;

        showAlert(
          'Oturum Süresi Doldu',
          'Güvenliğiniz için oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.'
        );

        // Reset the flag after 5 seconds to allow showing again if needed
        setTimeout(() => {
          hasShownTokenExpiredAlert.current = false;
        }, 5000);
      }

      // Logout user (duplicate logout logic to avoid dependency issues)
      try {
        setUser(null);
        setSafetyScores(null);
        if (Platform.OS === 'web') {
          localStorage.removeItem('user');
        } else {
          await AsyncStorage.removeItem('user');
        }
        await AsyncStorage.removeItem('auth_token');
      } catch (error) {
        // Silent error handling for unauthorized logout
      }
    };

    setUnauthorizedCallback(handleUnauthorized);

    return () => {
      setUnauthorizedCallback(() => {});
    };
  }, []);

  const safeAsyncStorageSetItem = async (key: string, value: string) => {
    try {
      // Validate JSON before storing
      if (key === 'user') {
        JSON.parse(value); // Test if it's valid JSON
      }

      if (Platform.OS === 'web') {
        localStorage.setItem(key, value);
      } else {
        await AsyncStorage.setItem(key, value);
      }
    } catch (error) {
      // Clear corrupted data and retry with safe defaults
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
      throw error;
    }
  };

  const safeAsyncStorageGetItem = async (key: string): Promise<string | null> => {
    try {
      let value;
      if (Platform.OS === 'web') {
        value = localStorage.getItem(key);
      } else {
        value = await AsyncStorage.getItem(key);
      }

      if (value && key === 'user') {
        // Validate JSON before returning
        JSON.parse(value);
      }
      return value;
    } catch (error) {
      if (Platform.OS === 'web') {
        localStorage.removeItem(key);
      } else {
        await AsyncStorage.removeItem(key);
      }
      return null;
    }
  };

  const clearCorruptedStorage = async () => {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem('user');
      } else {
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('auth_token');
      }
    } catch (error) {
      // Silent error handling
    }
  };

  const initializeAuth = async () => {
    try {
      // If a JWT exists, prefer backend profile as the source of truth
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        try {
          const resp = await apiService.auth.getProfile();
          const profile = resp.data as { id: number; firstName?: string; lastName?: string; email: string };
          const fullName = profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : undefined;
          setUser({ id: profile.id, email: profile.email, firstName: profile.firstName, lastName: profile.lastName, name: fullName });
          await safeAsyncStorageSetItem('user', JSON.stringify({
            id: profile.id,
            email: profile.email,
            firstName: profile.firstName,
            lastName: profile.lastName,
            name: fullName
          }));

          // Fetch safety scores after profile is loaded
          try {
            const scoresResp = await apiService.auth.getSafetyScores();
            setSafetyScores(scoresResp.data as SafetyScores);
          } catch (scoresError) {
            // Silent error handling for safety scores
          }
        } catch (err) {
          await AsyncStorage.removeItem('auth_token');
          const savedUser = await safeAsyncStorageGetItem('user');
          if (savedUser) {
            try {
              const localUser = JSON.parse(savedUser);
              if (localUser && typeof localUser === 'object' && localUser.id && localUser.email) {
                setUser(localUser);
              }
            } catch {}
          }
        }
      } else {
        // No token, try to load any saved local user (web-only fallback)
        const savedUser = await safeAsyncStorageGetItem('user');
        if (savedUser) {
          try {
            const localUser = JSON.parse(savedUser);
            if (localUser && typeof localUser === 'object' && localUser.id && localUser.email) {
              setUser(localUser);
            }
          } catch {}
        }
      }
    } catch (error) {
      await clearCorruptedStorage();
    } finally {
      setIsLoading(false);
    }
  };

  const register = useCallback(async (firstName: string, lastName: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!firstName || !lastName || !email || !password) {
        return { success: false, error: 'Tüm alanlar gereklidir' };
      }

      if (password.length < 6) {
        return { success: false, error: 'Şifre en az 6 karakter olmalıdır' };
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return { success: false, error: 'Geçerli bir e-posta adresi giriniz' };
      }

      // Backend register
      try {
        await apiService.auth.register({ firstName, lastName, email, password });
        return { success: true };
      } catch (error) {
        let msg = 'Kayıt sırasında bir hata oluştu';
        if (error && typeof error === 'object' && 'response' in error && error.response?.data?.message) {
          msg = error.response.data.message;
        }
        return { success: false, error: msg };
      }
    } catch (error) {
      return { success: false, error: 'Kayıt sırasında bir hata oluştu' };
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!email || !password) {
        return { success: false, error: 'E-posta ve şifre gereklidir' };
      }

      // Backend login
      try {
        const resp = await apiService.auth.login({ email, password });
        const { token, user } = resp.data as any;
        await AsyncStorage.setItem('auth_token', token);
        const fullName = user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.name;
        setUser({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: fullName
        });
        await safeAsyncStorageSetItem('user', JSON.stringify({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          name: fullName
        }));

        // Fetch safety scores after successful login
        try {
          const scoresResp = await apiService.auth.getSafetyScores();
          setSafetyScores(scoresResp.data as SafetyScores);
        } catch (scoresError) {
          // Silent error handling for safety scores
        }

        return { success: true };
      } catch (error) {
        let msg = 'Giriş sırasında bir hata oluştu';
        if (error && typeof error === 'object' && 'response' in error) {
          const status = error.response?.status;
          if (status === 401) {
            return { success: false, error: 'E-posta veya şifre hatalı' };
          }
          if (error.response?.data?.message) {
            msg = error.response.data.message;
          }
        }
        return { success: false, error: msg };
      }
    } catch (error) {
      return { success: false, error: 'Giriş sırasında bir hata oluştu' };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      setUser(null);
      if (Platform.OS === 'web') {
        localStorage.removeItem('user');
      } else {
        await AsyncStorage.removeItem('user');
      }
      await AsyncStorage.removeItem('auth_token');
    } catch (error) {
      // Silent error handling
    }
  }, []);

  const updateLocation = useCallback(async (latitude: number, longitude: number): Promise<void> => {
    try {
      await apiService.auth.updateLocation(latitude, longitude);
    } catch (error) {
      console.error('Error updating location via AuthContext:', error);
      throw error;
    }
  }, []);

  const fetchSafetyScores = useCallback(async (): Promise<void> => {
    try {
      if (!user) return;

      const response = await apiService.auth.getSafetyScores();
      const scores = response.data as SafetyScores;
      setSafetyScores(scores);
    } catch (error) {
      console.error('Error fetching safety scores:', error);
      // Set default scores if fetch fails
      setSafetyScores({
        safeZoneScore: 0,
        prepCheckScore: 0,
        totalSafetyScore: 0,
      });
    }
  }, [user]);

  const updateSafetyScores = useCallback(async (safeZoneScore?: number, prepCheckScore?: number): Promise<void> => {
    try {
      const data: { safeZoneScore?: number; prepCheckScore?: number } = {};
      if (safeZoneScore !== undefined) data.safeZoneScore = safeZoneScore;
      if (prepCheckScore !== undefined) data.prepCheckScore = prepCheckScore;

      await apiService.auth.updateSafetyScores(data);

      // Refresh safety scores after update
      await fetchSafetyScores();
    } catch (error) {
      console.error('Error updating safety scores via AuthContext:', error);
      throw error;
    }
  }, [fetchSafetyScores]);

  const contextValue = useMemo(() => ({
    user,
    isLoading,
    safetyScores,
    login,
    register,
    logout,
    isAuthenticated: !!user,
    updateLocation,
    updateSafetyScores,
    fetchSafetyScores,
  }), [user, isLoading, safetyScores, login, register, logout, updateLocation, updateSafetyScores, fetchSafetyScores]);

  return contextValue;
});
