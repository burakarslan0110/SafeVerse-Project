import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  useWindowDimensions,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ThumbsUp, Shield, Backpack, Activity, Play } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useFamilyContext } from '@/contexts/FamilyContext';
import { useSafeZone } from '@/contexts/SafeZoneContext';
import { useEmergencyBag } from '@/contexts/EmergencyBagContext';
import { useAuth } from '@/contexts/AuthContext';
import { showAlert } from '@/utils/platformHelpers';
import CircularProgress from '@/components/CircularProgress';
import FeatureCard from '@/components/FeatureCard';
import MessageQueueProgress from '@/components/MessageQueueProgress';
import NotificationBanner from '@/components/NotificationBanner';
import { useNotifications } from '@/contexts/NotificationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CONTENT_PADDING = 16;
const CARD_GAP = 12;

export default function HomeScreen() {
  const { width: winWidth } = useWindowDimensions();
  // Always 2 columns (2x2 layout), scale card width with viewport
  const columns = 2;
  const cardWidth = Math.floor((winWidth - (CONTENT_PADDING * 2) - CARD_GAP * (columns - 1)) / columns);
  const { colors } = useTheme();
  const {
    sendEmergencyMessage,
    messageQueue,
    currentQueueIndex,
    isQueueActive,
    queuePlatform,
    isQueueCompleted,
    processNextInQueue,
    cancelQueue,
    familyMembers,
  } = useFamilyContext();
  const { getOverallSafetyScore: getSafeZoneScore, assessments } = useSafeZone();
  const { getLatestScore: getBagScore, hasAnalysis: hasBagAnalysis } = useEmergencyBag();
  const { safetyScores, fetchSafetyScores } = useAuth();
  const [sendingMessage, setSendingMessage] = useState(false);
  const { currentBanner, dismissBanner } = useNotifications();
  const insets = useSafeAreaInsets();
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

  // Fetch safety scores on mount and when screen comes into focus
  useEffect(() => {
    fetchSafetyScores();
  }, [fetchSafetyScores]);

  useFocusEffect(
    useCallback(() => {
      fetchSafetyScores();
    }, [fetchSafetyScores])
  );

  // Use API data if available, otherwise fall back to local context data
  const safeZoneScore = safetyScores?.safeZoneScore ?? getSafeZoneScore();
  const bagScore = safetyScores?.prepCheckScore ?? getBagScore();
  const overallScore = safetyScores?.totalSafetyScore ?? 0;

  // Check if we have local analysis data
  const hasSafeZoneAnalysis = assessments.length > 0 && assessments[0].completedRooms > 0;
  const hasBagScore = hasBagAnalysis();
  
  const getScoreDescription = () => {
    // If we have API data, use it to determine completion status
    const hasApiSafeZone = safetyScores ? safetyScores.safeZoneScore > 0 : false;
    const hasApiPrepCheck = safetyScores ? safetyScores.prepCheckScore > 0 : false;

    // Use API data if available, otherwise fall back to local data
    const effectiveHasSafeZone = hasApiSafeZone || hasSafeZoneAnalysis;
    const effectiveHasPrepCheck = hasApiPrepCheck || hasBagScore;

    if (!effectiveHasSafeZone && !effectiveHasPrepCheck) {
      return 'Güvenlik puanınızı öğrenmek için SafeZone ve PrepCheck analizlerini tamamlayın.';
    }
    if (!effectiveHasSafeZone) {
      return 'Tam güvenlik puanı için SafeZone analizini de tamamlayın.';
    }
    if (!effectiveHasPrepCheck) {
      return 'Tam güvenlik puanı için PrepCheck analizini de tamamlayın.';
    }
    if (overallScore >= 80) {
      return 'Mükemmel! Hem eviniz hem de acil durum çantanız deprem için hazır.';
    }
    if (overallScore >= 60) {
      return 'İyi durumda, ancak bazı iyileştirmeler yapılabilir.';
    }
    return 'Güvenlik önlemlerinizi artırmanız önerilir.';
  };

  const handleFeaturePress = (feature: string) => {
    try {
      switch (feature) {
        case 'Ev Güvenlik':
          router.push('/home-security');
          break;
        case 'Afet Çantası':
          router.push('/emergency-bag');
          break;
        case 'Yakınımdaki Depremler':
          router.push('/nearby-earthquakes');
          break;
        case 'Simülasyon':
          router.push('/earthquake-simulation');
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  const handleEmergencyPress = async () => {
    if (!familyMembers || familyMembers.length === 0) {
      showAlert(
        'Aile üyesi bulunamadı',
        'İyiyim mesajı göndermek için önce en az bir aile üyesi eklemelisiniz.',
        [
          { text: 'İptal', style: 'cancel' },
          { text: 'Aile Üyesi Ekle', onPress: () => router.push('/(tabs)/family') },
        ]
      );
      return;
    }
    try {
      setSendingMessage(true);
      await sendEmergencyMessage();
    } catch (error) {
      console.error('Error sending emergency message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  // Dynamic sizing based on screen dimensions
  const { height: screenHeight } = Dimensions.get('window');
  // More aggressive scaling for small screens
  const isSmallScreen = screenHeight < 700;
  const isTinyScreen = screenHeight < 650;
  // Desktop scaling: reduce size on large screens (web)
  const isDesktop = winWidth > 768;
  const desktopScale = 0.8; // 20% smaller on desktop
  const scale = isTinyScreen ? 0.75 : isSmallScreen ? 0.85 : isDesktop ? desktopScale : 1;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8 * scale,
      paddingBottom: 50 * scale,
    },
    headerTitle: {
      fontSize: 36 * scale,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
      letterSpacing: 0.5,
    },
    headerSlogan: {
      fontSize: 16 * scale,
      fontWeight: '600',
      color: 'rgba(255, 255, 255, 0.95)',
      textAlign: 'center',
      marginTop: 6 * scale,
      textShadowColor: 'rgba(0, 0, 0, 0.2)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 2,
    },
    content: {
      flex: 1,
      marginTop: -40 * scale,
      paddingHorizontal: CONTENT_PADDING,
    },
    scoreCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16 * scale,
      marginBottom: 14 * scale,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 4,
    },
    scoreTitle: {
      fontSize: 18 * scale,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 12 * scale,
    },
    scoreDescription: {
      fontSize: 14 * scale,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 12 * scale,
      lineHeight: 20 * scale,
    },
    featuresGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      marginBottom: 0,
    },
    featureCardWrapper: {
      width: cardWidth,
      marginBottom: 8 * scale,
    },
    emergencyButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: colors.background,
      paddingHorizontal: CONTENT_PADDING,
      paddingTop: 8,
      paddingBottom: 8,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    emergencyButton: {
      backgroundColor: '#10B981',
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
      gap: 12,
      shadowColor: '#10B981',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    emergencyButtonText: {
      color: 'white',
      fontSize: 17 * scale,
      fontWeight: 'bold',
    },
    emergencyButtonDisabled: {
      opacity: 0.7,
    },
    scoreBreakdown: {
      marginTop: 10 * scale,
      paddingTop: 10 * scale,
      borderTopWidth: 1,
      borderTopColor: colors.textSecondary + '20',
    },
    breakdownText: {
      fontSize: 11 * scale,
      color: colors.textSecondary,
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.primary, '#0284c7']}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>SafeVerse</Text>
        <Text style={styles.headerSlogan}>Depreme Hazırlık, Güvenlik ve Farkındalık</Text>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={{ flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTitle}>Genel Güvenlik Puanı</Text>
          <CircularProgress percentage={overallScore} size={84 * scale} strokeWidth={5} />
          <Text style={styles.scoreDescription}>
            {getScoreDescription()}
          </Text>
          <View style={styles.scoreBreakdown}>
            <Text style={styles.breakdownText}>
              SafeZone: {safeZoneScore > 0 ? `${safeZoneScore}%` : 'Hesaplanmadı'} • PrepCheck: {bagScore > 0 ? `${bagScore}%` : 'Hesaplanmadı'}
            </Text>
          </View>
        </View>

        <View style={styles.featuresGrid}>
          <View style={styles.featureCardWrapper}>
            <FeatureCard
              icon={Shield}
              title="SafeZone"
              subtitle="Ev Güvenlik Analizi"
              onPress={() => handleFeaturePress('Ev Güvenlik')}
            />
          </View>
          <View style={styles.featureCardWrapper}>
            <FeatureCard
              icon={Backpack}
              title="PrepCheck"
              subtitle="Afet Çantası Kontrolü"
              onPress={() => handleFeaturePress('Afet Çantası')}
            />
          </View>
          <View style={styles.featureCardWrapper}>
            <FeatureCard
              icon={Activity}
              title="Yakınımdaki Depremler"
              subtitle="Gerçek Zamanlı Veriler"
              onPress={() => handleFeaturePress('Yakınımdaki Depremler')}
            />
          </View>
          <View style={styles.featureCardWrapper}>
            <FeatureCard
              icon={Play}
              title="Deprem Simulasyonu"
              subtitle="ÇÖK-KAPAN-TUTUN"
              onPress={() => handleFeaturePress('Simülasyon')}
            />
          </View>
        </View>

        {/* Dynamic spacer that grows to push emergency button to bottom */}
        <View style={{ flex: 1, minHeight: 16 }} />
      </ScrollView>

      <View style={styles.emergencyButtonContainer} onLayout={(e) => setBottomBarHeight(e.nativeEvent.layout.height)}>
        <TouchableOpacity
          style={[
            styles.emergencyButton,
            sendingMessage && styles.emergencyButtonDisabled
          ]}
          onPress={handleEmergencyPress}
          activeOpacity={0.8}
          disabled={sendingMessage}
          testID="emergency-button"
        >
          {sendingMessage ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <ThumbsUp size={24} color="white" />
          )}
          <Text style={styles.emergencyButtonText}>
            {sendingMessage ? 'Gönderiliyor...' : 'İyiyim'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* In-app notification banner positioned just above the "İyiyim" button */}
      <NotificationBanner
        notification={currentBanner}
        onDismiss={dismissBanner}
        autoDismissDelay={5000}
        bottomOffset={Math.max(12, bottomBarHeight - insets.bottom + 12)}
      />

      {/* Message Queue Progress UI */}
      {isQueueActive && messageQueue.length > 0 && (
        <MessageQueueProgress
          visible={isQueueActive}
          currentIndex={currentQueueIndex}
          totalCount={messageQueue.length}
          currentMemberName={messageQueue[currentQueueIndex]?.member.name || ''}
          currentPhoneNumber={messageQueue[currentQueueIndex]?.member.phoneNumber || ''}
          platform={queuePlatform || 'sms'}
          onNext={processNextInQueue}
          onCancel={cancelQueue}
          isFirst={currentQueueIndex === 0}
          isCompleted={isQueueCompleted}
        />
      )}
    </SafeAreaView>
  );
}
