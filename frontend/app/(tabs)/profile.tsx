import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
} from 'react-native';
import { User, Moon, Bell, Lock, HelpCircle, ChevronRight, LogOut } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleSettingPress = (setting: string) => {
    if (setting === 'Şifre Değiştir') {
      router.push('/change-password');
    } else if (setting === 'Bildirim Ayarları') {
      router.push('/notification-settings');
    } else if (setting === 'Hakkımızda & Yardım') {
      router.push('/help-support');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      backgroundColor: colors.cardBackground,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
    content: { flex: 1, padding: 16 },
    profileCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    avatarContainer: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: colors.primary + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    userName: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 4 },
    userEmail: { fontSize: 16, color: colors.textSecondary, marginBottom: 4 },
    userId: { fontSize: 14, color: colors.textSecondary },
    settingsCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
    },
    settingsTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, marginBottom: 16 },
    settingItem: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      backgroundColor: colors.background, borderRadius: 12, padding: 16, marginBottom: 8,
    },
    settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    settingText: { fontSize: 16, color: colors.textPrimary, fontWeight: '500' },
    settingRight: { flexDirection: 'row', alignItems: 'center' },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Profilim</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <User size={48} color={colors.primary} />
          </View>
          {user?.firstName && user?.lastName && (
            <Text style={styles.userName}>{user.firstName} {user.lastName}</Text>
          )}
          <Text style={styles.userEmail}>{user?.email || 'Kullanıcı'}</Text>
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>Ayarlar</Text>

          <TouchableOpacity
            style={styles.settingItem}
            onPress={toggleTheme}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={{ checked: isDark }}
            accessibilityLabel="Gece modunu değiştir"
          >
            <View style={styles.settingLeft}>
              <Moon size={20} color={colors.primary} />
              <Text style={styles.settingText}>Gece Modu</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={isDark ? 'white' : colors.background}
            />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => handleSettingPress('Bildirim Ayarları')}>
            <View style={styles.settingLeft}>
              <Bell size={20} color={colors.primary} />
              <Text style={styles.settingText}>Bildirim Ayarları</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => handleSettingPress('Şifre Değiştir')}>
            <View style={styles.settingLeft}>
              <Lock size={20} color={colors.primary} />
              <Text style={styles.settingText}>Şifre Değiştir</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingItem} onPress={() => handleSettingPress('Hakkımızda & Yardım')}>
            <View style={styles.settingLeft}>
              <HelpCircle size={20} color={colors.primary} />
              <Text style={styles.settingText}>Hakkımızda & Yardım</Text>
            </View>
            <ChevronRight size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.settingItem, { backgroundColor: '#fee2e2' }]} onPress={handleLogout}>
            <View style={styles.settingLeft}>
              <LogOut size={20} color="#dc2626" />
              <Text style={[styles.settingText, { color: '#dc2626' }]}>Çıkış Yap</Text>
            </View>
            <ChevronRight size={20} color="#dc2626" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
