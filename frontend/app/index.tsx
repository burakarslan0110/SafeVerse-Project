import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, Linking, Image, Platform, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, Stack } from 'expo-router';
import { Shield, MapPin, Users, Backpack, Zap, CheckCircle, Smartphone, Brain, Bell, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const [featuresOffsetY, setFeaturesOffsetY] = useState<number>(0);
  const arrowAnim = useRef(new Animated.Value(0)).current;

  // If running as PWA (standalone), route based on auth status
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (!isStandalone) return;
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/(tabs)');
    } // if not authenticated, stay on landing (index)
  }, [isAuthenticated, isLoading]);

  // If already authenticated, never show landing page
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading]);

  // Root (index) is the landing page: if authenticated redirect to app, otherwise stay here
  // No extra redirect for unauthenticated so install button remains visible on landing

  // PWA Install handler
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) {
      return;
    }

    // Show button on web by default

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Animated scroll-down arrow (bounce)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(arrowAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(arrowAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [arrowAnim]);

  const translateY = arrowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 8] });

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // Show browser-specific instructions
      const userAgent = navigator.userAgent.toLowerCase();
      let message = '';

      if (userAgent.includes('chrome') && !userAgent.includes('edg')) {
        message = 'Chrome: Adres çubuğundaki yükle simgesine tıklayın veya menüden "Yükle SafeVerse" seçeneğini kullanın.';
      } else if (userAgent.includes('edg')) {
        message = 'Edge: Adres çubuğundaki uygulama simgesine tıklayın veya menüden "Uygulamayı yükle" seçeneğini kullanın.';
      } else if (userAgent.includes('safari') && !userAgent.includes('chrome')) {
        message = 'Safari: Paylaş butonuna (⬆) tıklayıp "Ana Ekrana Ekle" seçeneğini kullanın.';
      } else {
        message = 'Tarayıcınızın menüsünden "Ana ekrana ekle" veya "Yükle" seçeneğini kullanabilirsiniz.';
      }

      alert(`PWA Yükleme Talimatları:\n\n${message}`);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };


  const features = [
    {
      icon: Shield,
      title: 'SafeZone',
      description: 'AI destekli ev güvenliği analizi ile evinizin deprem güvenliğini değerlendirin.',
      color: '#10B981',
    },
    {
      icon: Backpack,
      title: 'PrepCheck',
      description: 'Acil durum çantanızı AI ile kontrol edin, eksiklikleri tespit edin.',
      color: '#F59E0B',
    },
    {
      icon: Users,
      title: 'Aile Güvenliği',
      description: '"Ben İyiyim" butonu ile konumunuzu ve durumunuzu aile üyelerinizle paylaşın.',
      color: '#EF4444',
    },
    {
      icon: MapPin,
      title: 'Deprem Takibi',
      description: 'Kandilli ve AFAD verilerini birleştirerek yakınınızdaki depremleri izleyin.',
      color: '#8B5CF6',
    },
  ];

  const faqs = [
    {
      question: 'SafeVerse nedir?',
      answer: 'SafeVerse, deprem ve acil durumlara hazırlıklı olmak için geliştirilmiş kapsamlı bir güvenlik uygulamasıdır. Yakınızdaki depremleri izleyebilir, aile üyelerinizle iletişimde kalabilir ve acil durumlara hazırlanabilirsiniz.',
    },
    {
      question: 'Uygulama nasıl çalışır?',
      answer: 'SafeVerse dört ana özellik sunar:\n\n1. Güvenli Bölge Analizi: Evinizi odalar bazında analiz eder ve güvenlik önerileri sunar.\n\n2. Acil Çanta Kontrolü: Acil durum çantanızda bulunması gereken malzemeleri takip eder.\n\n3. Aile Güvenliği: Aile üyelerinizle güvenlik durumunuzu paylaşır ve "Ben İyiyim" mesajları gönderebilirsiniz.\n\n4. Yakınımdaki Depremler: Konumunuza göre 500km yarıçapındaki depremleri izler (Kandilli ve AFAD verileri).',
    },
    {
      question: 'Deprem verileri nereden geliyor?',
      answer: 'Deprem verileri Kandilli Rasathanesi ve AFAD\'dan gerçek zamanlı olarak çekilmektedir. Her iki kaynaktaki veriler birleştirilerek size en güncel deprem bilgileri sunulur.',
    },
    {
      question: 'Aile güvenliği nasıl çalışır?',
      answer: 'Aile üyelerinizi telefon numaralarıyla ekleyebilirsiniz. "Ben İyiyim" butonuna bastığınızda, konumunuz ve güvenlik durumunuz tüm aile üyelerinize SMS ile gönderilir. Her aile üyesi için sırayla SMS uygulaması açılır ve mesajı onaylamanız beklenir.',
    },
    {
      question: 'Toplanma alanı nedir?',
      answer: 'Toplanma alanı, acil durumlarda aile üyelerinizin buluşacağı önceden belirlenmiş bir konumdur. Harita üzerinden seçebilir ve tüm aile üyelerinizle paylaşabilirsiniz.',
    },
    {
      question: 'Verilerim güvende mi?',
      answer: 'Evet! Verileriniz şifrelenmiş olarak saklanır. Konum bilgileriniz sadece sizin izninizle paylaşılır ve aile üyelerinize SMS göndermek istediğinizde kullanılır.',
    },
  ];

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={['#1E1B4B', '#312E81', '#4F46E5']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Decorative circles */}
          <View style={[styles.decorCircle, { top: 50, right: 30, width: 100, height: 100 }]} />
          <View style={[styles.decorCircle, { bottom: 100, left: 20, width: 150, height: 150 }]} />

          <View style={styles.heroContent}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/icon.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.heroTitle}>SafeVerse</Text>
            <Text style={styles.heroSubtitle}>
              Deprem ve Acil Durumlara Hazırlıklı Olun
            </Text>
            <Text style={styles.heroDescription}>
                          Yapay zekâ temelli analizlerle olası riskleri önceden fark edin, deprem verilerini anlık olarak takip edin ve sevdiklerinizin güvenliğini tek bir platformdan yönetin.
            </Text>

            <View style={styles.ctaButtonsContainer}>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={handleInstallClick}
              >
                <Text style={styles.ctaButtonText}>{"SafeVerse\u0027\u00FC Y\u00FCkleyin"}</Text>
                <Zap size={20} color="#4F46E5" fill="#4F46E5" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctaButtonOutline}
                onPress={() => router.push('/splash')}
              >
                <Text style={styles.ctaButtonOutlineText}>{"Taray\u0131c\u0131 \u00DCzerinden Devam Edin"}</Text>
              </TouchableOpacity>

            </View>
            {/* Animated scroll down arrow */}
            <TouchableOpacity
              onPress={() => scrollViewRef.current?.scrollTo({ y: featuresOffsetY, animated: true })}
              activeOpacity={0.7}
            >
              <Animated.View style={{ marginTop: 24, transform: [{ translateY }] }}>
                <ChevronDown size={40} color="#FFFFFF" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Features Section */}
        <View style={styles.section} onLayout={(e) => setFeaturesOffsetY(e.nativeEvent.layout.y)}>
          <View style={styles.sectionHeader}>
            <Brain size={40} color="#4F46E5" strokeWidth={2} />
            <Text style={styles.sectionTitle}>Özellikler</Text>
          </View>
          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View key={index} style={styles.featureCard}>
                <LinearGradient
                  colors={[feature.color + '20', feature.color + '10']}
                  style={styles.featureIconContainer}
                >
                  <feature.icon size={40} color={feature.color} strokeWidth={2.5} />
                </LinearGradient>
                <Text style={styles.featureTitle}>{feature.title}</Text>
                <Text style={styles.featureDescription}>{feature.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Benefits Section */}
        <View style={[styles.section, styles.benefitsSection]}>
          <View style={styles.sectionHeader}>
            <Smartphone size={40} color="#4F46E5" strokeWidth={2} />
            <Text style={styles.sectionTitle}>Neden SafeVerse?</Text>
          </View>
          <View style={styles.benefitsContainer}>
            {[
              { icon: Brain, text: 'AI destekli akıllı analiz', color: '#8B5CF6' },
              { icon: Bell, text: 'Gerçek zamanlı deprem verileri', color: '#EF4444' },
              { icon: Smartphone, text: 'Kolay kullanım ve modern arayüz', color: '#3B82F6' },
              { icon: Shield, text: 'Güvenli ve şifreli veri', color: '#10B981' },
              { icon: Zap, text: 'Hızlı ve stabil', color: '#F59E0B' },
            ].map((benefit, index) => (
              <View key={index} style={styles.benefitCard}>
                <View style={[styles.benefitIconContainer, { backgroundColor: benefit.color + '20' }]}>
                  <benefit.icon size={32} color={benefit.color} strokeWidth={2} />
                </View>
                <Text style={styles.benefitText}>{benefit.text}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <HelpCircle size={40} color="#4F46E5" strokeWidth={2} />
            <Text style={styles.sectionTitle}>Sık Sorulan Sorular</Text>
          </View>
          <View style={styles.faqContainer}>
            {faqs.map((faq, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggleFAQ(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  {expandedFAQ === index ? (
                    <ChevronUp size={24} color="#6B7280" />
                  ) : (
                    <ChevronDown size={24} color="#6B7280" />
                  )}
                </TouchableOpacity>
                {expandedFAQ === index && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Hazır mısınız?</Text>
          <Text style={styles.ctaDescription}>
            Depreme karşı hazırlıklı olun, ailenizin güvenliğini sağlayın.
          </Text>
          <TouchableOpacity
            style={styles.ctaButtonSecondary}
            onPress={() => router.push('/splash')}
          >
            <Text style={styles.ctaButtonSecondaryText}>Şimdi Başlayın</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Burak Arslan tarafından GreenNimbus ekibiyle birlikte BTK Akademi & Huawei Ar-Ge Kodlama Maratonu'25 için geliştirildi
          </Text>
          <Text style={styles.footerVersion}>SafeVerse v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  hero: {
    paddingVertical: 100,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    borderRadius: 1000,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroContent: {
    alignItems: 'center',
    maxWidth: 700,
    zIndex: 1,
  },
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  heroTitle: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#E0E7FF',
    marginBottom: 20,
    textAlign: 'center',
  },
  heroDescription: {
    fontSize: 17,
    color: '#C7D2FE',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  ctaButtonsContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4F46E5',
  },
  ctaButtonOutline: {
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ctaButtonOutlineText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },


  section: {
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
  },
  featureCard: {
    width: SCREEN_WIDTH > 768 ? 280 : SCREEN_WIDTH - 48,
    backgroundColor: '#FFFFFF',
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  featureIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  featureTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  benefitsSection: {
    backgroundColor: '#F9FAFB',
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  benefitCard: {
    width: SCREEN_WIDTH > 768 ? 220 : SCREEN_WIDTH - 48,
    maxWidth: SCREEN_WIDTH > 768 ? 220 : 400,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  benefitIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  benefitText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaSection: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 64,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  ctaDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 500,
  },
  ctaButtonSecondary: {
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  ctaButtonSecondaryText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: '#1F2937',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
    textAlign: 'center',
  },
  footerVersion: {
    fontSize: 12,
    color: '#6B7280',
  },
  faqContainer: {
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  faqQuestionText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    marginRight: 12,
  },
  faqAnswer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 4,
  },
  faqAnswerText: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 24,
  },
});






