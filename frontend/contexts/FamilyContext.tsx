import { useState, useEffect, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import * as Location from 'expo-location';
import * as SMS from 'expo-sms';
import { Platform, Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { locationService } from '@/services/locationService';
import { apiService } from '@/lib/api';
import { isDesktopBrowser, isMobileBrowser } from '@/utils/platformHelpers';
import { sendMultipleWhatsAppMessages } from '@/utils/whatsappHelpers';
import { sendMultipleSMSMessages } from '@/utils/smsHelpers';
import { normalizeToE164TR, unformatPhoneNumber } from '@/lib/phoneFormatter';

export interface FamilyMember {
  id: string; // server uses numeric id, keep string in UI
  userId: number;
  name: string;
  phoneNumber: string;
  role?: string;
  status: 'safe' | 'unknown' | 'danger';
  avatar?: string;
}

export interface MeetingPoint {
  id: string;
  userId: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

const MEETING_POINT_KEY = 'meeting_point';

export interface MessageQueueItem {
  member: FamilyMember;
  message: string;
}

export const [FamilyProvider, useFamilyContext] = createContextHook(() => {
  const { user } = useAuth();
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [meetingPoint, setMeetingPoint] = useState<MeetingPoint | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Message queue state
  const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState<number>(0);
  const [isQueueActive, setIsQueueActive] = useState<boolean>(false);
  const [queuePlatform, setQueuePlatform] = useState<'whatsapp' | 'sms' | null>(null);
  const [isQueueCompleted, setIsQueueCompleted] = useState<boolean>(false);

  const mapServerMemberToLocal = (m: any): FamilyMember => ({
    id: String(m.id),
    userId: user!.id,
    name: m.name,
    phoneNumber: m.phoneNumber,
    role: m.role ?? undefined,
    status: (m.status as 'safe' | 'unknown' | 'danger') ?? 'unknown',
    avatar: m.avatar ?? undefined,
  });

  const loadMeetingPoint = async (): Promise<MeetingPoint | null> => {
    try {
      const raw = await AsyncStorage.getItem(MEETING_POINT_KEY);
      return raw ? (JSON.parse(raw) as MeetingPoint) : null;
    } catch (e) {
      console.error('Meeting point load error:', e);
      return null;
    }
  };

  const saveMeetingPoint = async (mp: MeetingPoint) => {
    try {
      await AsyncStorage.setItem(MEETING_POINT_KEY, JSON.stringify(mp));
    } catch (e) {
      console.error('Meeting point save error:', e);
    }
  };

  const loadFamilyMembers = useCallback(async () => {
    try {
      if (!user?.id) {
        setFamilyMembers([]);
        setMeetingPoint(null);
        setIsLoading(false);
        return;
      }

      // Load family members from backend
      const resp = await apiService.family.getMembers();
      const members = (resp.data as any[]).map(mapServerMemberToLocal);

      // Load meeting point from local storage (no backend GET endpoint yet)
      const mp = await loadMeetingPoint();

      setFamilyMembers(members);
      setMeetingPoint(mp);
    } catch (error) {
      console.error('Error loading family members:', error);
      setFamilyMembers([]);
      setMeetingPoint(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  const addFamilyMember = useCallback(async (memberData: Omit<FamilyMember, 'id' | 'userId' | 'status'>) => {
    if (!user?.id) throw new Error('Kullanıcı oturumu bulunamadı');

    // Normalize phone numbers for comparison and storage (E.164 Turkey)
    const normalizeDigits = (phone: string) => unformatPhoneNumber(phone); // national 10-digit
    const e164 = normalizeToE164TR(memberData.phoneNumber);
    const newPhoneNormalized = normalizeDigits(e164 || memberData.phoneNumber);

    // Check if member with same phone number already exists
    const existingMember = familyMembers.find(
      m => normalizeDigits(m.phoneNumber) === newPhoneNormalized
    );

    if (existingMember) {
      throw new Error(`${existingMember.name} zaten aile üyeleriniz arasında mevcut.`);
    }

    const resp = await apiService.family.addMember({ name: memberData.name, phoneNumber: e164 || memberData.phoneNumber, role: memberData.role });
    const newMember = mapServerMemberToLocal(resp.data);
    setFamilyMembers(prev => [...prev, newMember]);
  }, [user?.id, familyMembers]);

  const removeFamilyMember = useCallback(async (id: string) => {
    if (!user?.id) throw new Error('Kullanıcı oturumu bulunamadı');
    await apiService.family.removeMember(String(id));
    setFamilyMembers(prev => prev.filter(m => m.id !== id));
  }, [user?.id]);

  const updateMemberStatus = useCallback(async (id: string, status: FamilyMember['status']) => {
    if (!user?.id) throw new Error('Kullanıcı oturumu bulunamadı');
    await apiService.family.updateSafetyStatus({ memberId: parseInt(id, 10), status });
    setFamilyMembers(prev => prev.map(m => m.id === id ? { ...m, status } : m));
  }, [user?.id]);

  const getLocationInfo = async (latitude: number, longitude: number) => {
    try {
      // Try backend API first (no CORS issues)
      try {
        const response = await apiService.family.reverseGeocode(latitude, longitude);
        if (response.data) {
          const { city, district, source } = response.data;
          return { city, district };
        }
      } catch (backendError) {
      }

      // Fallback to Expo Location API (may not work on web)
      if (Platform.OS !== 'web') {
        const reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocode && reverseGeocode.length > 0) {
          const loc = reverseGeocode[0];
          const city = loc.city || loc.region || 'Bilinmeyen Şehir';
          const district = loc.district || loc.subregion || 'Bilinmeyen İlçe';
          return { city, district };
        }
      }
    } catch (error) {
      console.error('Reverse geocoding error:', error);
    }

    return { city: 'Bilinmeyen Şehir', district: 'Bilinmeyen İlçe' };
  };

  const setMeetingPointLocation = useCallback(async (latitude: number, longitude: number, name: string, address: string) => {
    if (!user?.id) throw new Error('Kullanıcı oturumu bulunamadı');
    const resp = await apiService.family.setMeetingPoint({ name, address, latitude, longitude });
    const mp = resp.data as any;
    const newMeetingPoint: MeetingPoint = {
      id: String(mp?.id ?? Date.now()),
      userId: user.id,
      name: mp?.name ?? name,
      address: mp?.address ?? address,
      latitude: mp?.latitude ?? latitude,
      longitude: mp?.longitude ?? longitude,
      createdAt: mp?.createdAt ?? new Date().toISOString(),
    };
    await saveMeetingPoint(newMeetingPoint);
    setMeetingPoint(newMeetingPoint);
  }, [user?.id]);

  const sendMessageViaPlatform = async (phoneNumbers: string[], message: string) => {
    try {
      // Desktop browser: Use WhatsApp Web
      if (isDesktopBrowser()) {
        // Show initial confirmation dialog
        const confirmed = window.confirm(
          `${phoneNumbers.length} kişiye WhatsApp üzerinden mesaj gönderilecek.\n\n` +
          `• Her aile üyesi için sırayla onay penceresi açılacak\n` +
          `• Tarayıcıda WhatsApp Web açılacak\n` +
          `• Her mesajı gönderdikten sonra bu pencereye dönün\n\n` +
          `Devam etmek istiyor musunuz?`
        );

        if (!confirmed) {
          return false;
        }

        try {
          // Get member names in the same order as phone numbers
          const memberNames = phoneNumbers.map(phone => {
            const member = familyMembers.find(m => m.phoneNumber === phone);
            return member?.name || phone;
          });

          // Send via WhatsApp Web with queue system
          // Now with member names for better confirmation dialogs
          await sendMultipleWhatsAppMessages(phoneNumbers, message, memberNames);

          // Show completion message only after all messages sent
          window.alert(
            `✓ WhatsApp mesaj gönderimi tamamlandı!\n\n` +
            `Lütfen açılan WhatsApp pencerelerinde mesajları kontrol edin.`
          );
          return true;
        } catch (whatsappError) {
          console.error('WhatsApp error:', whatsappError);
          window.alert('WhatsApp üzerinden mesaj gönderilirken hata oluştu. Lütfen popup engelleyicisini kontrol edin.');
          return false;
        }
      }

      // Mobile browser: Use SMS URL scheme with queue system
      if (Platform.OS === 'web' && isMobileBrowser()) {
        // Show initial confirmation dialog
        const confirmed = window.confirm(
          `${phoneNumbers.length} kişiye SMS gönderilecek.\n\n` +
          `• Her aile üyesi için sırayla onay penceresi açılacak\n` +
          `• Telefonunuzda SMS uygulaması açılacak\n` +
          `• Her mesajı gönderdikten sonra tarayıcıya dönün\n\n` +
          `Devam etmek istiyor musunuz?`
        );

        if (!confirmed) {
          return false;
        }

        try {
          // Get member names in the same order as phone numbers
          const memberNames = phoneNumbers.map(phone => {
            const member = familyMembers.find(m => m.phoneNumber === phone);
            return member?.name || phone;
          });

          // Send via SMS with queue system
          await sendMultipleSMSMessages(phoneNumbers, message, memberNames);

          // Show completion message only after all messages sent
          window.alert(
            `✓ SMS gönderim işlemi tamamlandı!\n\n` +
            `Lütfen mesajların gönderildiğini kontrol edin.`
          );
          return true;
        } catch (smsError) {
          console.error('SMS URL scheme error:', smsError);
          window.alert('SMS gönderilemedi. Lütfen cihazınızın SMS özelliğini kontrol edin.');
          return false;
        }
      }

      // Native mobile app: Use SMS module
      const isAvailable = await SMS.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Hata', 'SMS gönderimi bu cihazda desteklenmiyor.');
        return false;
      }

      // Send SMS one by one - user must send each SMS manually
      for (let i = 0; i < phoneNumbers.length; i++) {
        const phoneNumber = phoneNumbers[i];
        const member = familyMembers.find(m => m.phoneNumber === phoneNumber);
        const memberName = member?.name || phoneNumber;

        try {
          // Show alert before opening SMS for each contact
          await new Promise<void>((resolve) => {
            Alert.alert(
              'SMS Gönder',
              `${memberName} kişisine mesaj göndermek için SMS uygulaması açılacak. (${i + 1}/${phoneNumbers.length})`,
              [
                {
                  text: 'Tamam',
                  onPress: () => resolve()
                }
              ]
            );
          });

          // Open SMS app with pre-filled message
          await SMS.sendSMSAsync([phoneNumber], message);

          // Wait a bit for user to return from SMS app before showing next alert
          if (i < phoneNumbers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`SMS error for ${phoneNumber}:`, error);
        }
      }

      // Show completion message
      Alert.alert('Tamamlandı', `${phoneNumbers.length} kişiye SMS gönderim işlemi tamamlandı.`);
      return true;
    } catch (error) {
      console.error('Message sending error:', error);
      return false;
    }
  };
  // Message queue functions
  const startMessageQueue = useCallback((queue: MessageQueueItem[], platform: 'whatsapp' | 'sms') => {
    setMessageQueue(queue);
    setCurrentQueueIndex(0);
    setQueuePlatform(platform);
    setIsQueueActive(true);
    setIsQueueCompleted(false);
  }, []);

  const processNextInQueue = useCallback(() => {
    if (!isQueueActive || currentQueueIndex >= messageQueue.length) {
      return;
    }

    const currentItem = messageQueue[currentQueueIndex];
    const { member, message } = currentItem;

    // Open WhatsApp/SMS based on platform
    // This is called from button click, so it's a real user gesture!
    if (queuePlatform === 'whatsapp' && Platform.OS === 'web') {
      const webURL = `https://web.whatsapp.com/send?phone=${member.phoneNumber.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`;
      const newWindow = window.open(webURL, '_blank');

      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        window.alert(`❌ Popup engelleyici tespit edildi!\n\n${member.name} için WhatsApp açılamadı.`);
        cancelQueue();
        return;
      }
    } else if (queuePlatform === 'sms' && Platform.OS === 'web') {
      const smsUrl = `sms:${member.phoneNumber}?body=${encodeURIComponent(message)}`;
      const link = document.createElement('a');
      link.href = smsUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (queuePlatform === 'sms' && Platform.OS !== 'web') {
      // Native SMS
      SMS.sendSMSAsync([member.phoneNumber], message).catch((error) => {
        console.error('Native SMS error:', error);
        Alert.alert('Hata', `${member.name} için SMS gönderilemedi.`);
      });
    }

    // Move to next person
    const nextIndex = currentQueueIndex + 1;
    if (nextIndex >= messageQueue.length) {
      // Queue completed - show completion screen instead of popup
      setIsQueueCompleted(true);
    } else {
      setCurrentQueueIndex(nextIndex);
    }
  }, [isQueueActive, currentQueueIndex, messageQueue, queuePlatform]);

  const cancelQueue = useCallback(() => {
    setIsQueueActive(false);
    setMessageQueue([]);
    setCurrentQueueIndex(0);
    setQueuePlatform(null);
    setIsQueueCompleted(false);
  }, []);

  const sendEmergencyMessage = useCallback(async () => {
    try {
      if (familyMembers.length === 0) {
        if (Platform.OS === 'web') {
          window.alert('Mesaj gönderilecek aile üyesi bulunamadı. Lütfen önce aile üyelerinizi ekleyin.');
        } else {
          Alert.alert('Uyarı', 'Mesaj gönderilecek aile üyesi bulunamadı.');
        }
        return;
      }

      // Location
      let latitude: number;
      let longitude: number;
      const cached = locationService.getLocation();

      if (cached && locationService.isLocationFresh()) {
        latitude = cached.latitude;
        longitude = cached.longitude;
      } else {
        // Web için navigator.geolocation kullan
        if (Platform.OS === 'web') {
          if (!navigator.geolocation) {
            window.alert('Tarayıcınız konum bilgisini desteklemiyor.');
            return;
          }

          try {
            const position = await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false,
                timeout: 10000,
                maximumAge: 300000
              });
            });

            latitude = position.coords.latitude;
            longitude = position.coords.longitude;
            locationService.setLocation({ latitude, longitude, accuracy: position.coords.accuracy || null, timestamp: Date.now() });
          } catch (error) {
            console.error('Geolocation error:', error);
            window.alert('Konum bilgisi alınamadı. Lütfen tarayıcınızın konum iznini kontrol edin.');
            return;
          }
        } else {
          // Mobile için expo-location kullan
          const { status } = await Location.requestForegroundPermissionsAsync();

          if (status !== 'granted') {
            Alert.alert('Konum İzni', 'Konum bilgisi paylaşmak için izin gerekli.');
            return;
          }

          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeout: 10000 });
          latitude = loc.coords.latitude;
          longitude = loc.coords.longitude;
          locationService.setLocation({ latitude, longitude, accuracy: loc.coords.accuracy || null, timestamp: Date.now() });
        }
      }

      const { city, district } = await getLocationInfo(latitude, longitude);
      const googleMapsLink = `https://maps.google.com/maps?q=${latitude},${longitude}`;
      let mpInfo = '';
      if (meetingPoint) {
        const mpLink = `https://maps.google.com/maps?q=${meetingPoint.latitude},${meetingPoint.longitude}`;
        mpInfo = `\n\n🏁 Toplanma Alanımız: ${meetingPoint.name}\n📫 Adres: ${meetingPoint.address}\n🔗 Harita: ${mpLink}`;
      }
      // Get user's full name from auth context
      const userName = user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.name || 'Kullanıcı';

      const message = `${userName}: Ben iyiyim!

📍 Konum: ${city}, ${district}
🗺️ Koordinatlar: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
🔗 Harita: ${googleMapsLink}${mpInfo}

SafeVerse tarafından gönderildi`;

      // Notify backend (stub)
      try {
        await apiService.family.sendEmergencyMessage({ message });
      } catch {}

      // Create queue items
      const queue: MessageQueueItem[] = familyMembers.map(member => ({
        member,
        message
      }));

      // Determine platform
      const platform = isDesktopBrowser() ? 'whatsapp' : 'sms';

      // Start the queue - this will show the UI
      startMessageQueue(queue, platform);
    } catch (error) {
      console.error('Error in sendEmergencyMessage:', error);
      if (Platform.OS === 'web') {
        window.alert('Mesaj gönderilirken bir hata oluştu. Lütfen tekrar deneyin.');
      } else {
        Alert.alert('Hata', 'Mesaj gönderilirken bir hata oluştu.');
      }
    }
  }, [familyMembers, meetingPoint, user, startMessageQueue]);

  useEffect(() => { loadFamilyMembers(); }, [loadFamilyMembers]);

  const contextValue = useMemo(() => ({
    familyMembers,
    meetingPoint,
    addFamilyMember,
    removeFamilyMember,
    updateMemberStatus,
    setMeetingPointLocation,
    sendEmergencyMessage,
    isLoading,
    // Message queue
    messageQueue,
    currentQueueIndex,
    isQueueActive,
    queuePlatform,
    isQueueCompleted,
    processNextInQueue,
    cancelQueue,
  }), [
    familyMembers,
    meetingPoint,
    addFamilyMember,
    removeFamilyMember,
    updateMemberStatus,
    setMeetingPointLocation,
    sendEmergencyMessage,
    isLoading,
    messageQueue,
    currentQueueIndex,
    isQueueActive,
    queuePlatform,
    isQueueCompleted,
    processNextInQueue,
    cancelQueue,
  ]);

  return contextValue;
});
