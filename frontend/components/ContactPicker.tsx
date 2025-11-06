import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  SafeAreaView,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import * as Contacts from 'expo-contacts';
import { X, Search, User, Phone } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { formatPhoneNumber, unformatPhoneNumber, normalizeToE164TR } from '@/lib/phoneFormatter';

interface Contact {
  id: string;
  name: string;
  phoneNumbers?: { number?: string }[];
}

interface ContactPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectContact: (contact: { name: string; phoneNumber: string }) => void;
}

export default function ContactPicker({ visible, onClose, onSelectContact }: ContactPickerProps) {
  const { colors } = useTheme();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Web manuel input
  const [showManualInput, setShowManualInput] = useState(Platform.OS === 'web');
  const [manualName, setManualName] = useState('');
  const [manualPhone, setManualPhone] = useState('');
  const [isContactPickerSupported, setIsContactPickerSupported] = useState(false);

  // Check if Contact Picker API is supported (mobile browsers)
  useEffect(() => {
    if (Platform.OS === 'web' && 'contacts' in navigator && 'ContactsManager' in window) {
      setIsContactPickerSupported(true);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadContacts();
    }
  }, [visible]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredContacts(filtered);
    } else {
      setFilteredContacts(contacts);
    }
  }, [searchQuery, contacts]);

  const handlePickContactFromBrowser = async () => {
    if (!('contacts' in navigator) || !('select' in (navigator as any).contacts)) {
      alert('Rehber erişimi bu tarayıcıda desteklenmiyor');
      return;
    }

    try {
      const props = ['name', 'tel'];
      const opts = { multiple: false };

      const contacts = await (navigator as any).contacts.select(props, opts);

      if (contacts && contacts.length > 0) {
        const contact = contacts[0];
        const name = contact.name ? contact.name[0] : '';
        const phone = contact.tel && contact.tel.length > 0 ? contact.tel[0] : '';

        if (!name || !phone) {
          alert('Seçilen kişinin ad veya telefon bilgisi eksik');
          return;
        }

        // Auto-fill form
        setManualName(name);
        setManualPhone(formatPhoneNumber(phone));
      }
    } catch (error) {
      console.error('Contact picker error:', error);
      // User cancelled or error - ignore
    }
  };

  const handleManualSubmit = () => {
    if (!manualName.trim() || !manualPhone.trim()) {
      if (Platform.OS === 'web') {
        alert('Lütfen isim ve telefon numarası girin');
      } else {
        Alert.alert('Hata', 'Lütfen isim ve telefon numarası girin');
      }
      return;
    }

    // Normalize to E.164 (+90XXXXXXXXXX)
    const rawPhone = normalizeToE164TR(manualPhone);

    onSelectContact({
      name: manualName.trim(),
      phoneNumber: rawPhone,
    });

    setManualName('');
    setManualPhone('');
    onClose();
  };

  const loadContacts = async () => {
    try {
      setLoading(true);

      if (Platform.OS === 'web') {
        // Web'de direkt manuel girişe yönlendir
        setLoading(false);
        return;
      }

      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Rehber erişimi için izin gerekli.');
        onClose();
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      const validContacts: Contact[] = data
        .filter(contact => contact.name && contact.phoneNumbers && contact.phoneNumbers.length > 0)
        .map(contact => ({
          id: contact.id || Math.random().toString(),
          name: contact.name || 'İsimsiz',
          phoneNumbers: contact.phoneNumbers?.map(phone => ({ number: phone.number })),
        }));

      setContacts(validContacts);
      setFilteredContacts(validContacts);
    } catch (error) {
      console.error('Error loading contacts:', error);
      Alert.alert('Hata', 'Rehber yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectContact = (contact: Contact) => {
    if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
      Alert.alert('Hata', 'Bu kişinin telefon numarası bulunamadı.');
      return;
    }

    const phoneNumber = contact.phoneNumbers[0].number || '';
    if (!phoneNumber.trim()) {
      if (Platform.OS !== 'web') {
        Alert.alert('Hata', 'Geçerli telefon numarası bulunamadı.');
      }
      return;
    }
    
    // Normalize to E.164 (+90XXXXXXXXXX)
    const normalized = normalizeToE164TR(phoneNumber);
    onSelectContact({
      name: contact.name,
      phoneNumber: normalized || phoneNumber,
    });
    onClose();
  };

  const renderContact = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={[styles.contactItem, { backgroundColor: colors.cardBackground }]}
      onPress={() => handleSelectContact(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        <User size={20} color={colors.primary} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={[styles.contactName, { color: colors.textPrimary }]}>
          {item.name}
        </Text>
        {item.phoneNumbers && item.phoneNumbers.length > 0 && item.phoneNumbers[0].number && (
          <View style={styles.phoneContainer}>
            <Phone size={14} color={colors.textSecondary} />
            <Text style={[styles.phoneNumber, { color: colors.textSecondary }]}>
              {formatPhoneNumber(item.phoneNumbers[0].number)}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    modalContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.cardBackground,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    closeButton: {
      padding: 8,
    },
    manualInputContainer: {
      flex: 1,
      padding: 24,
    },
    inputGroup: {
      marginBottom: 24,
    },
    inputLabel: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    input: {
      flex: 1,
      fontSize: 16,
    },
    submitButton: {
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 16,
    },
    submitButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
    contactPickerButton: {
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 2,
    },
    contactPickerButtonText: {
      fontSize: 15,
      fontWeight: '600',
    },
    orDivider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    orLine: {
      flex: 1,
      height: 1,
    },
    orText: {
      marginHorizontal: 16,
      fontSize: 14,
      fontWeight: '500',
    },
    searchContainer: {
      padding: 16,
      backgroundColor: colors.cardBackground,
    },
    searchInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.textPrimary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    contactsList: {
      flex: 1,
      padding: 16,
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 1,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    contactInfo: {
      flex: 1,
    },
    contactName: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    phoneContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    phoneNumber: {
      fontSize: 14,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 16,
      color: colors.textSecondary,
      marginTop: 16,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 32,
    },
    emptyText: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    searchInputContainer: {
      position: 'relative',
    },
    searchIcon: {
      position: 'absolute',
      right: 12,
      top: 12,
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {Platform.OS === 'web' ? 'Aile Üyesi Ekle' : 'Kişi Seç'}
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <X size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? (
          // Web için manuel input formu
          <View style={styles.manualInputContainer}>
            {/* Rehberden seç butonu - sadece Contact Picker API destekleniyorsa */}
            {isContactPickerSupported && (
              <>
                <TouchableOpacity
                  style={[styles.contactPickerButton, { borderColor: colors.primary, backgroundColor: colors.primary + '10' }]}
                  onPress={handlePickContactFromBrowser}
                >
                  <Text style={[styles.contactPickerButtonText, { color: colors.primary }]}>
                    📱 Rehberden Seç
                  </Text>
                </TouchableOpacity>

                <View style={styles.orDivider}>
                  <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.orText, { color: colors.textSecondary }]}>veya</Text>
                  <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                </View>
              </>
            )}

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                Ad Soyad
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <User size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Örn: Ahmet Yılmaz"
                  placeholderTextColor={colors.textSecondary}
                  value={manualName}
                  onChangeText={setManualName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: colors.textPrimary }]}>
                Telefon Numarası
              </Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Phone size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="(555) 555 55 55"
                  placeholderTextColor={colors.textSecondary}
                  value={manualPhone}
                  onChangeText={(text) => {
                    const formatted = formatPhoneNumber(text);
                    setManualPhone(formatted);
                  }}
                  keyboardType="phone-pad"
                  maxLength={16}
                />
              </View>
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.primary }]}
              onPress={handleManualSubmit}
            >
              <Text style={styles.submitButtonText}>Ekle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // Mobil için rehber seçimi
          <>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Kişi ara..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                <View style={styles.searchIcon}>
                  <Search size={20} color={colors.textSecondary} />
                </View>
              </View>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Rehber yükleniyor...</Text>
              </View>
            ) : filteredContacts.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Arama sonucu bulunamadı.' : 'Rehber boş.'}
                </Text>
              </View>
            ) : (
              <FlatList
                style={styles.contactsList}
                data={filteredContacts}
                renderItem={renderContact}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
              />
            )}
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}
