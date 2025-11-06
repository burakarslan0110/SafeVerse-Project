import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ArrowLeft, ChevronDown, ChevronUp, Info, Mail, Phone, Globe } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
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

export default function HelpSupportScreen() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const { colors } = useTheme();
  const router = useRouter();

  const toggleFAQ = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
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
    content: { flex: 1 },
    section: { padding: 16 },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    aboutCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    aboutText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
      marginBottom: 12,
    },
    featureList: { marginTop: 8 },
    featureItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    featureBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
      marginTop: 7,
      marginRight: 12,
    },
    featureText: {
      flex: 1,
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    faqItem: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      marginBottom: 12,
      overflow: 'hidden',
    },
    faqQuestion: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    faqQuestionText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
    },
    faqAnswer: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    faqAnswerText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    contactCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
    },
    contactItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    contactIcon: { marginRight: 12 },
    contactText: {
      fontSize: 14,
      color: colors.textPrimary,
    },
    footer: {
      padding: 16,
      alignItems: 'center',
    },
    footerText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    versionText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
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
          <Text style={styles.headerTitle}>Hakkımızda & Yardım</Text>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama Hakkında</Text>
          <View style={styles.aboutCard}>
            <Text style={styles.aboutText}>
              SafeVerse, deprem ve acil durumlara hazırlıklı olmak için geliştirilmiş kapsamlı bir güvenlik platformudur.
            </Text>
            <Text style={styles.aboutText}>
              Uygulama, sizi ve sevdiklerinizi korumak için tasarlanmış 4 ana özellik sunar:
            </Text>
            <View style={styles.featureList}>
              <View style={styles.featureItem}>
                <View style={styles.featureBullet} />
                <Text style={styles.featureText}>
                  <Text style={{ fontWeight: 'bold' }}>Güvenli Bölge Analizi:</Text> Evinizi odalar bazında analiz eder, potansiyel tehlikeleri tespit eder ve güvenlik puanınızı artırmanız için öneriler sunar.
                </Text>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureBullet} />
                <Text style={styles.featureText}>
                  <Text style={{ fontWeight: 'bold' }}>Acil Çanta Kontrolü:</Text> Acil durum çantanızda bulunması gereken malzemeleri kategorize eder, son kullanma tarihlerini takip eder ve hazırlık puanınızı hesaplar.
                </Text>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureBullet} />
                <Text style={styles.featureText}>
                  <Text style={{ fontWeight: 'bold' }}>Aile Güvenliği:</Text> Aile üyelerinizi ekleyin, toplanma alanı belirleyin ve "Ben İyiyim" butonuyla konumunuzu ve güvenlik durumunuzu SMS ile paylaşın.
                </Text>
              </View>
              <View style={styles.featureItem}>
                <View style={styles.featureBullet} />
                <Text style={styles.featureText}>
                  <Text style={{ fontWeight: 'bold' }}>Yakınımdaki Depremler:</Text> Kandilli Rasathanesi ve AFAD verilerini birleştirerek konumunuzdan 500km yarıçapındaki depremleri gerçek zamanlı izleyin.
                </Text>
              </View>
            </View>

            <View style={{ marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
              <Text style={[styles.aboutText, { fontWeight: 'bold', marginBottom: 8 }]}>Geliştirici</Text>
              <Text style={styles.aboutText}>
                Takım Kaptanı & Cloud Planner: Enes Cıkcık (
                <Text
                  style={{ color: colors.primary, textDecorationLine: 'underline' }}
                  onPress={() => Linking.openURL('https://www.linkedin.com/in/enescikcik/')}
                >
                  LinkedIn
                </Text>
                )
              </Text>
              <Text style={[styles.aboutText, { marginTop: 8 }]}>
                Frontend & Backend Geliştirici: Burak Arslan (
                <Text
                  style={{ color: colors.primary, textDecorationLine: 'underline' }}
                  onPress={() => Linking.openURL('https://www.linkedin.com/in/burakarslann0110/')}
                >
                  LinkedIn
                </Text>
                )
              </Text>
              <Text style={[styles.aboutText, { marginTop: 8 }]}>
                Teknik Araştırmacı & Cloud: Saadet Elizaveta Babal (
                <Text
                  style={{ color: colors.primary, textDecorationLine: 'underline' }}
                  onPress={() => Linking.openURL('https://www.linkedin.com/in/saadetelizavetababal/')}
                >
                  LinkedIn
                </Text>
                )
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sık Sorulan Sorular</Text>
          {faqs.map((faq, index) => (
            <View key={index} style={styles.faqItem}>
              <TouchableOpacity
                style={styles.faqQuestion}
                onPress={() => toggleFAQ(index)}
              >
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                {expandedIndex === index ? (
                  <ChevronUp size={20} color={colors.textSecondary} />
                ) : (
                  <ChevronDown size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
              {expandedIndex === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Burak Arslan tarafından GreenNimbus ekibiyle brlkte BTK Akademi & Huawei Ar-Ge Kodlama Maratonu'25 için geliştirildi.
          </Text>
          <Text style={styles.versionText}>SafeVerse v1.0.0</Text>
        </View>
      </ScrollView>
    </View>
  );
}
