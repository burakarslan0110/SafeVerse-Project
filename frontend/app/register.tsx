import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, User } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import TopBanner from '@/components/TopBanner';
import RequirePWA from '@/components/RequirePWA';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerType, setBannerType] = useState<'success' | 'error'>('success');
  const [bannerMessage, setBannerMessage] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { colors } = useTheme();
  const { register } = useAuth();
  const router = useRouter();

  useEffect(() => { return () => { if (timerRef.current) clearTimeout(timerRef.current); }; }, []);

  const handleRegister = async () => {
    if (isLoading) return;
    if (password !== confirmPassword) { Alert.alert('Hata', 'Şifreler eşleşmiyor'); return; }
    setIsLoading(true);
    const result = await register(firstName.trim(), lastName.trim(), email.trim(), password);
    if (result.success) {
      setBannerType('success'); setBannerMessage('Hesap başarıyla oluşturuldu'); setBannerVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { setBannerVisible(false); router.replace('/login'); }, 1200);
    } else {
      setBannerType('error'); setBannerMessage(result.error || 'Kayıt başarısız'); setBannerVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setBannerVisible(false), 2000);
    }
    setIsLoading(false);
  };

  const navigateBack = () => { router.back(); };

  return (
    <RequirePWA>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBanner visible={bannerVisible} type={bannerType} message={bannerMessage} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.backButton} onPress={navigateBack}>
            <ArrowLeft size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image source={require('@/assets/images/icon.png')} style={styles.appIcon} resizeMode="contain" />
            </View>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Hesap Oluşturun</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>SafeVerse'e katılın ve güvenliğinizi artırın</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <User size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Adınız"
                  placeholderTextColor={colors.textSecondary}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <User size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Soyadınız"
                  placeholderTextColor={colors.textSecondary}
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

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
                  placeholder="Şifreniz (en az 6 karakter)"
                  placeholderTextColor={colors.textSecondary}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  {showPassword ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputContainer}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.cardBackground, borderColor: colors.border }]}>
                <Lock size={20} color={colors.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: colors.textPrimary }]}
                  placeholder="Şifrenizi tekrar girin"
                  placeholderTextColor={colors.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
                  {showConfirmPassword ? <EyeOff size={20} color={colors.textSecondary} /> : <Eye size={20} color={colors.textSecondary} />}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={[styles.registerButton, { opacity: isLoading ? 0.7 : 1 }]} onPress={handleRegister} disabled={isLoading}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} style={styles.buttonGradient}>
                <Text style={styles.registerButtonText}>{isLoading ? 'Hesap oluşturuluyor...' : 'Hesap Oluştur'}</Text>
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={[styles.loginText, { color: colors.textSecondary }]}>Zaten hesabınız var mı? </Text>
              <TouchableOpacity onPress={navigateBack}>
                <Text style={[styles.loginLink, { color: colors.primary }]}>Giriş Yapın</Text>
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
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: 60 },
  backButton: { position: 'absolute', top: 20, left: 24, zIndex: 1 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoContainer: { justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  appIcon: { width: 100, height: 100, borderRadius: 50 },
  title: { fontSize: 28, fontWeight: 'bold' as const, marginBottom: 8 },
  subtitle: { fontSize: 16, textAlign: 'center' },
  form: { width: '100%' },
  inputContainer: { marginBottom: 16 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, height: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, height: '100%' },
  eyeIcon: { padding: 4 },
  registerButton: { marginTop: 8, marginBottom: 24, borderRadius: 12, overflow: 'hidden' },
  buttonGradient: { paddingVertical: 16, alignItems: 'center' },
  registerButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' as const },
  loginContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  loginText: { fontSize: 14 },
  loginLink: { fontSize: 14, fontWeight: '600' as const },
  creditsContainer: { alignItems: 'center', marginTop: 32, paddingBottom: 24 },
  creditsText: { fontSize: 12, textAlign: 'center', opacity: 0.7 },
});