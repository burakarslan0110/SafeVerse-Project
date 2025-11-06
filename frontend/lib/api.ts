import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - bu değer environment variable olarak ayarlanabilir
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// Callback for handling 401 unauthorized errors (token expired)
let onUnauthorizedCallback: (() => void) | null = null;

export const setUnauthorizedCallback = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

// Axios instance oluştur
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 saniye (2 dakika) timeout - AI image processing için
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - her istekte token ekle
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Token alınamadı:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - hata durumlarını yakala
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // 401 hatası - token geçersiz veya expire olmuş
    if (error.response?.status === 401) {
      // Token'ı temizle
      await AsyncStorage.removeItem('auth_token');

      // AuthContext'e bildirimi gönder (logout yapacak)
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }

    // Network hataları
    if (!error.response) {
      console.error('Network hatası:', error.message);
    }

    return Promise.reject(error);
  }
);

// API fonksiyonları
export const apiService = {
  // Auth endpoints
  auth: {
    login: (credentials: { email: string; password: string }) =>
      api.post('/auth/login', credentials),
    register: (userData: { firstName: string; lastName: string; email: string; password: string }) =>
      api.post('/auth/register', userData),
    logout: () => api.post('/auth/logout'),
    getProfile: () => api.get('/auth/profile'),
    updateProfile: (data: any) => api.put('/auth/profile', data),
    changePassword: (data: { currentPassword: string; newPassword: string }) =>
      api.put('/auth/change-password', data),
    updateLocation: (latitude: number, longitude: number) =>
      api.put('/auth/location', { latitude, longitude }),
    updateSafetyScores: (data: { safeZoneScore?: number; prepCheckScore?: number }) =>
      api.put('/auth/safety-scores', data),
    getSafetyScores: () => api.get('/auth/safety-scores'),
  },

  // Family endpoints
  family: {
    getMembers: () => api.get('/family/members'),
    addMember: (member: any) => api.post('/family/members', member),
    removeMember: (id: string) => api.delete(`/family/members/${id}`),
    updateSafetyStatus: (data: any) => api.post('/family/safety-status', data),
    sendEmergencyMessage: (data: any) => api.post('/family/emergency-message', data),
    setMeetingPoint: (data: any) => api.post('/family/meeting-point', data),
    reverseGeocode: (lat: number, lon: number) => api.get(`/family/reverse-geocode?lat=${lat}&lon=${lon}`),
  },

  // Safety endpoints
  safety: {
    getAiRequestsStatus: () => api.get('/safety/ai-requests-status'),
    analyzeImage: (imageData: any) => api.post('/safety/analyze-image', imageData),
    analyzeRooms: (roomsData: any) => api.post('/safety/analyze-rooms', roomsData),
    updateSafeZoneScore: (score: number) => api.post('/safety/update-safezone-score', { score }),
  },

  // Emergency bag endpoints
  emergency: {
    getChecklist: () => api.get('/emergency/checklist'),
    analyzeBag: (data: { base64: string }) => api.post('/emergency/analyze-bag', data),
    updatePrepCheckScore: (score: number) => api.post('/emergency/update-prepcheck-score', { score }),
  },

  // Earthquake endpoints
  earthquakes: {
    getKandilliLive: () => api.get('/earthquakes/kandilli/live'),
    getAfadLive: () => api.get('/earthquakes/afad/live'),
    getNearby: (lat: number, lng: number, radius: number = 100) =>
      api.get(`/earthquakes/nearby?lat=${lat}&lng=${lng}&radius=${radius}`),
    getHistory: () => api.get('/earthquakes/history'),
  },
};

export default api;
