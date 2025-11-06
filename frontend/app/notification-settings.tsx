import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, Bell, Smartphone, MapPin, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettings {
  earthquakeAlerts: boolean;
  familySafetyAlerts: boolean;
  locationUpdates: boolean;
  emergencyMessages: boolean;
}

const NOTIFICATION_SETTINGS_KEY = 'notification_settings';

export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState<NotificationSettings>({
    earthquakeAlerts: true,
    familySafetyAlerts: true,
    locationUpdates: false,
    emergencyMessages: true,
  });

  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY);
      if (saved) {
        setSettings(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  };

  const toggleSetting = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.cardBackground,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: { padding: 4, marginRight: 12 },
    headerTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
    content: { flex: 1, padding: 16 },
    description: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 24,
      lineHeight: 20,
    },
    settingCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 12,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    settingInfo: { flex: 1 },
    settingTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    settingDescription: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={{ backgroundColor: colors.cardBackground }}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Bildirim Ayarları</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.description}>
          Uygulama bildirimlerini özelleştirin. Hangi durumlarda bildirim almak istediğinizi seçebilirsiniz.
        </Text>

        <View style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={styles.iconContainer}>
              <AlertTriangle size={20} color={colors.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Deprem Uyarıları</Text>
              <Text style={styles.settingDescription}>
                Yakınınızda meydana gelen depremler hakkında bildirim alın
              </Text>
            </View>
          </View>
          <Switch
            value={settings.earthquakeAlerts}
            onValueChange={() => toggleSetting('earthquakeAlerts')}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={settings.earthquakeAlerts ? 'white' : colors.background}
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={styles.iconContainer}>
              <Bell size={20} color={colors.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Aile Güvenlik Bildirimleri</Text>
              <Text style={styles.settingDescription}>
                Aile üyelerinizin güvenlik durumu değiştiğinde bildirim alın
              </Text>
            </View>
          </View>
          <Switch
            value={settings.familySafetyAlerts}
            onValueChange={() => toggleSetting('familySafetyAlerts')}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={settings.familySafetyAlerts ? 'white' : colors.background}
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={styles.iconContainer}>
              <MapPin size={20} color={colors.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Konum Güncellemeleri</Text>
              <Text style={styles.settingDescription}>
                Aile üyelerinizin konum güncellemeleri için bildirim alın
              </Text>
            </View>
          </View>
          <Switch
            value={settings.locationUpdates}
            onValueChange={() => toggleSetting('locationUpdates')}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={settings.locationUpdates ? 'white' : colors.background}
          />
        </View>

        <View style={styles.settingCard}>
          <View style={styles.settingLeft}>
            <View style={styles.iconContainer}>
              <Smartphone size={20} color={colors.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Acil Durum Mesajları</Text>
              <Text style={styles.settingDescription}>
                Acil durum mesajları ve "Ben İyiyim" bildirimleri alın
              </Text>
            </View>
          </View>
          <Switch
            value={settings.emergencyMessages}
            onValueChange={() => toggleSetting('emergencyMessages')}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={settings.emergencyMessages ? 'white' : colors.background}
          />
        </View>
      </ScrollView>
    </View>
  );
}
