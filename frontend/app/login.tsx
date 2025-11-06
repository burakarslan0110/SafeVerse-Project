import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import TopBanner from '@/components/TopBanner';
import RequirePWA from '@/components/RequirePWA';

export default function LoginScreen() {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { colors } = useTheme();
  const { login } = useAuth();
  const router = useRouter();
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerType, setBannerType] = useState<'success' | 'error'>('success');
  const [bannerMessage, setBannerMessage] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  const handleLogin = async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    const result = await login(email.trim(), password);
    
    if (result.success) {
      setBannerType('success');
      setBannerMessage('Giriş yapıldı');
      setBannerVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setBannerVisible(false);
        router.replace('/(tabs)');
      }, 1200);
    } else {
      setBannerType('error');
      setBannerMessage(result.error || 'Giriş başarısız');
      setBannerVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBannerVisible(false), 2000);
    }
    
    setIsLoading(false);
  };

  const navigateToRegister = () => {
    router.push('/register' as any);
  };



  return (
    <RequirePWA>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBanner visible={bannerVisible} type={bannerType} message={bannerMessage} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('@/assets/images/icon.png')}
                style={styles.appIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Hoş Geldiniz</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Hesabınıza giriş yapın</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Mail size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="E-posta adresiniz"
                  placeholderTextColor={colors.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Şifreniz"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  {showPassword ? (
                    <EyeOff size={20} color={colors.textSecondary} />
                  ) : (
                    <Eye size={20} color={colors.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.loginButton, { opacity: isLoading ? 0.7 : 1 }]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.buttonGradient}
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.registerContainer}>
              <Text style={[styles.registerText, { color: colors.textSecondary }]}>Hesabınız yok mu? </Text>
              <TouchableOpacity onPress={navigateToRegister}>
                <Text style={[styles.registerLink, { color: colors.primary }]}>Kayıt Olun</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.creditsContainer}>
            <Text style={[styles.creditsText, { color: colors.textSecondary }]}>
              Burak Arslan tarafından GreenNimbus ekibiyle birlikte{'\n'}
              BTK Akademi & Huawei Ar-Ge Kodlama Maratonu'25 için geliştirildi
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
    </RequirePWA>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  appIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  logoTextTop: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#ffffff',
    lineHeight: 18,
    marginBottom: -2,
  },
  logoTextBottom: {
    fontSize: 16,
    fontWeight: 'bold' as const,
    color: '#ffffff',
    lineHeight: 18,
    marginTop: -2,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  eyeIcon: {
    padding: 4,
  },
  loginButton: {
    marginTop: 8,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  creditsContainer: {
    alignItems: 'center',
    marginTop: 32,
    paddingBottom: 24,
  },
  creditsText: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
});

