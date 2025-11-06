import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Platform,
  BackHandler,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {
  Camera,
  Image as ImageIcon,
  Package,
  Info,
  History,
  Trophy,
  Home,
  Plus,
  CheckCircle,
  Star
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useEmergencyBag, type BagAnalysisResult } from '@/contexts/EmergencyBagContext';
import { apiService } from '@/lib/api';
import { useNavigationBlock } from '@/contexts/NavigationBlockerContext';

type PrepCheckStep = 'intro' | 'upload' | 'results' | 'history';

export default function EmergencyBagScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const {
    startNewAnalysis,
    completeAnalysis,
    getCompletedAnalyses,
    getLatestScore,
    getLatestAnalysis,
    hasAnalysis,
    currentAnalysis,
    clearIncompleteAnalysis,
    resetToInitialState,
    clearCurrentAnalysis,
    clearForNavigation,
    clearLatestAnalysis
  } = useEmergencyBag();

  const [currentStep, setCurrentStep] = useState<PrepCheckStep>('intro');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<BagAnalysisResult | null>(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [aiRequestsRemaining, setAiRequestsRemaining] = useState<number | null>(null);

  // Block browser back button when analyzing (web only)
  useNavigationBlock(isAnalyzing);

  // Fetch AI request limits on mount
  useEffect(() => {
    const fetchAiRequestsStatus = async () => {
      try {
        const response = await apiService.safety.getAiRequestsStatus();
        setAiRequestsRemaining(response.data.remaining);
      } catch (error) {
        console.error('Error fetching AI requests status:', error);
      }
    };
    fetchAiRequestsStatus();
  }, []);

  // Hide back button in header when analyzing
  useEffect(() => {
    navigation.setOptions({
      headerLeft: isAnalyzing ? () => null : undefined,
      gestureEnabled: !isAnalyzing,
    });
  }, [isAnalyzing, navigation]);

  // Also restore header on screen focus (in case it got stuck)
  useFocusEffect(
    useCallback(() => {
      if (!isAnalyzing) {
        navigation.setOptions({
          headerLeft: undefined,
          gestureEnabled: true,
        });
      }
    }, [isAnalyzing, navigation])
  );

  // Load latest analysis result when screen loads
  useFocusEffect(
    useCallback(() => {
      if (!analysisResult && !isAnalyzing && !selectedImage) {
        const latest = getLatestAnalysis();
        if (latest) {
          setAnalysisResult(latest);
          setCurrentStep('results');
        } else {
          setCurrentStep('intro');
        }
      }
    }, [analysisResult, isAnalyzing, selectedImage, getLatestAnalysis])
  );

  // Prevent back navigation during analysis
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (isAnalyzing) {
          Alert.alert(
            'Analiz Devam Ediyor',
            'Analiz tamamlanana kadar lütfen bekleyin.',
            [{ text: 'Tamam' }]
          );
          return true; // Prevent default back action
        }
        return false; // Allow default back action
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isAnalyzing])
  );

  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Galeriye erişim için izin gereklidir.');
        return false;
      }
    }
    return true;
  };

  const pickImageFromGallery = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setCurrentStep('upload');
      if (result.assets[0].base64) {
        await startAnalysisFlow(result.assets[0].base64);
      }
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
      setCurrentStep('upload');
      if (result.assets[0].base64) {
        await startAnalysisFlow(result.assets[0].base64);
      }
    }
  };

  const startAnalysisFlow = async (base64Image: string) => {
    try {
      const analysisId = await startNewAnalysis();
      setCurrentAnalysisId(analysisId);
      await analyzeEmergencyBag(base64Image, analysisId);
    } catch (error) {
      console.error('Error starting analysis flow:', error);
      Alert.alert('Hata', 'Analiz başlatılırken bir hata oluştu.');
    }
  };

  const analyzeEmergencyBag = async (base64Image: string, analysisId: string) => {
    setIsAnalyzing(true);
    setCurrentAnalysisId(analysisId);

    try {
      const response = await apiService.emergency.analyzeBag({ base64: base64Image });
      const data = response.data;

      // Update remaining requests count
      if (typeof data.requestsRemaining === 'number') {
        setAiRequestsRemaining(data.requestsRemaining);
      }

      if (!data.completion) {
        throw new Error('API response does not contain completion');
      }

      let cleanedCompletion = data.completion.trim();
      cleanedCompletion = cleanedCompletion.replace(/```json\n?/g, '').replace(/```\n?/g, '');

      const jsonStart = cleanedCompletion.indexOf('{');
      const jsonEnd = cleanedCompletion.lastIndexOf('}');

      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error('No valid JSON found in response');
      }

      cleanedCompletion = cleanedCompletion.substring(jsonStart, jsonEnd + 1);

      let result;
      try {
        result = JSON.parse(cleanedCompletion);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        throw new Error('Invalid JSON response from API');
      }

      if (typeof result.overallScore !== 'number' || !Array.isArray(result.items)) {
        throw new Error('Invalid response structure');
      }

      setAnalysisResult(result);
      setCurrentStep('results');

      await completeAnalysis({
        overallScore: result.overallScore,
        totalItems: result.totalItems,
        presentItems: result.presentItems,
        missingItems: result.missingItems,
        expiredItems: result.expiredItems,
      }, result, analysisId);
    } catch (error) {
      console.error('Analysis error:', error);

      // Check if it's a 429 error (rate limit exceeded)
      if (error && typeof error === 'object' && 'response' in error && error.response?.status === 429) {
        const errorData = error.response.data;
        Alert.alert(
          'Günlük Limit Aşıldı',
          errorData.message || 'Günde en fazla 2 analiz yapabilirsiniz. Lütfen daha sonra tekrar deneyin.',
          [{ text: 'Tamam' }]
        );
      } else {
        Alert.alert('Hata', 'Analiz sırasında bir hata oluştu. Lütfen tekrar deneyin.');
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleNewAnalysis = async () => {
    await clearLatestAnalysis();
    setSelectedImage(null);
    setAnalysisResult(null);
    setCurrentAnalysisId(null);
    setCurrentStep('intro');
  };

  const handleReturnToStart = async () => {
    await clearLatestAnalysis();
    setSelectedImage(null);
    setAnalysisResult(null);
    setCurrentAnalysisId(null);
    setCurrentStep('intro');
    router.back();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return '✅';
      case 'missing': return '❌';
      case 'expired': return '⚠️';
      default: return '❓';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getSafetyLevel = (score: number) => {
    if (score >= 80) return 'İyi Hazırlık';
    if (score >= 60) return 'Orta Hazırlık';
    return 'Yetersiz Hazırlık';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderIntroStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>PrepCheck Nedir?</Text>
        <Text style={styles.stepDescription}>
          PrepCheck, acil durum çantanızın fotoğrafını çekerek içeriğini AI ile analiz eder. Eksik malzemeleri tespit eder ve deprem hazırlığınız için öneriler sunar.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Nasıl Çalışır?</Text>
          <Text style={styles.infoText}>• Çantanızın fotoğrafını çekin</Text>
          <Text style={styles.infoText}>• AI içindeki malzemeleri tanımlar</Text>
          <Text style={styles.infoText}>• Eksik temel ürünleri tespit eder</Text>
          <Text style={styles.infoText}>• Son kullanma tarihlerini kontrol eder</Text>
          <Text style={styles.infoText}>• Hazırlık puanı ve öneriler alırsınız</Text>
          <Text style={[styles.infoText, { color: '#10B981', fontWeight: '600', marginTop: 8 }]}>• 🔒 Görseller sadece analiz için kullanılır, hiçbir yerde saklanmaz</Text>
        </View>

        {aiRequestsRemaining !== null && (
          <View style={[styles.infoBox, { borderLeftColor: aiRequestsRemaining > 0 ? '#10B981' : '#EF4444', marginTop: 12 }]}>
            <Text style={[styles.infoTitle, { color: aiRequestsRemaining > 0 ? '#10B981' : '#EF4444' }]}>
              {aiRequestsRemaining > 0 ? '✓ Analiz Hakkınız' : '⚠️ Günlük Limit Doldu'}
            </Text>
            <Text style={styles.infoText}>
              {aiRequestsRemaining > 0
                ? `Bugün ${aiRequestsRemaining} analiz hakkınız kaldı.`
                : 'Günlük 2 analiz hakkınızı kullandınız. Yeni hakkınız 24 saat sonra yenilenecek.'}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, aiRequestsRemaining === 0 && { opacity: 0.5, backgroundColor: colors.textSecondary }]}
        onPress={() => {
          if (aiRequestsRemaining !== null && aiRequestsRemaining <= 0) {
            Alert.alert(
              'Günlük Limit Aşıldı',
              'Günde en fazla 2 analiz yapabilirsiniz. Yeni hakkınız 24 saat sonra yenilenecek.',
              [{ text: 'Tamam' }]
            );
            return;
          }
          setCurrentStep('upload');
        }}
        disabled={aiRequestsRemaining === 0}
      >
        <Plus size={20} color="white" />
        <Text style={styles.primaryButtonText}>Analizi Başlat</Text>
      </TouchableOpacity>

      {hasAnalysis() && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setCurrentStep('history')}
        >
          <History size={20} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Analiz Geçmişi</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderUploadStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.imageSection}>
        <View style={styles.imageContainer}>
          {selectedImage ? (
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
          ) : (
            <>
              <Package size={48} color={colors.textSecondary} />
              <Text style={styles.placeholderText}>
                Acil durum çantanızın fotoğrafını çekin
              </Text>
            </>
          )}
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, isAnalyzing && { opacity: 0.5 }]}
            onPress={takePhoto}
            disabled={isAnalyzing}
          >
            <Camera size={20} color="white" />
            <Text style={styles.buttonText}>Fotoğraf Çek</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, isAnalyzing && { opacity: 0.5 }]}
            onPress={pickImageFromGallery}
            disabled={isAnalyzing}
          >
            <ImageIcon size={20} color="white" />
            <Text style={styles.buttonText}>Galeriden Seç</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isAnalyzing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Çanta içeriği analiz ediliyor...</Text>
          <Text style={styles.loadingSubText}>Bu işlem birkaç dakika sürebilir</Text>
        </View>
      )}
    </View>
  );

  const renderResultsStep = () => (
    <ScrollView style={styles.stepContainer}>
      <View style={styles.completedHeader}>
        <CheckCircle size={48} color="#10B981" />
        <Text style={styles.completedTitle}>Analiz Tamamlandı!</Text>
        <Text style={styles.completedDescription}>
          Çantanız analiz edildi. Hazırlık durumunuzu aşağıda görebilirsiniz.
        </Text>
      </View>

      {analysisResult && (
        <>
          <View style={styles.finalScoreCard}>
            <Text style={styles.finalScoreTitle}>Hazırlık Puanı</Text>
            <Text style={[styles.finalScoreValue, { color: getScoreColor(analysisResult.overallScore) }]}>
              {analysisResult.overallScore}%
            </Text>
            <Text style={styles.finalScoreDescription}>
              {getSafetyLevel(analysisResult.overallScore)}
            </Text>
          </View>

          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>
                {analysisResult.presentItems}
              </Text>
              <Text style={styles.statLabel}>Mevcut</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#EF4444' }]}>
                {analysisResult.missingItems}
              </Text>
              <Text style={styles.statLabel}>Eksik</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#F59E0B' }]}>
                {analysisResult.expiredItems}
              </Text>
              <Text style={styles.statLabel}>Süresi Dolmuş</Text>
            </View>
          </View>

          {analysisResult.items.length > 0 && (
            <View style={styles.itemsAnalysisContainer}>
              <Text style={styles.itemsAnalysisTitle}>Tespit Edilen Ürünler</Text>
              {analysisResult.items.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.itemAnalysisCard}>
                  <View style={styles.itemAnalysisHeader}>
                    <Text style={{ fontSize: 20 }}>{getStatusIcon(item.status)}</Text>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCategory}>{item.category}</Text>
                    </View>
                  </View>
                  {item.expiryDate && (
                    <View style={styles.analysisSection}>
                      <Text style={styles.itemExpiry}>📅 Son kullanma: {item.expiryDate}</Text>
                    </View>
                  )}
                  {item.recommendation && (
                    <View style={styles.analysisSection}>
                      <Text style={styles.itemRecommendation}>💡 {item.recommendation}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {analysisResult.missingEssentials.length > 0 && (
            <View style={styles.itemsAnalysisContainer}>
              <Text style={styles.itemsAnalysisTitle}>⚠️ Eksik Temel Ürünler</Text>
              {analysisResult.missingEssentials.map((item, index) => (
                <View key={`missing-${index}`} style={styles.missingItemCard}>
                  <Text style={styles.missingItemText}>❌ {item}</Text>
                </View>
              ))}
            </View>
          )}

          {analysisResult.recommendations.length > 0 && (
            <View style={styles.itemsAnalysisContainer}>
              <Text style={styles.itemsAnalysisTitle}>💡 Öneriler</Text>
              {analysisResult.recommendations.map((recommendation, index) => (
                <View key={`rec-${index}`} style={styles.recommendationCard}>
                  <Text style={styles.recommendationText}>• {recommendation}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      <View style={styles.resultsButtonContainer}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleReturnToStart}
        >
          <Home size={20} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNewAnalysis}>
          <Plus size={20} color="white" />
          <Text style={styles.primaryButtonText}>Yeni Analiz</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHistoryStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <History size={32} color={colors.primary} />
        <Text style={styles.stepTitle}>Analiz Geçmişi</Text>
        <Text style={styles.stepDescription}>
          Daha önce yaptığınız çanta analizlerinizi görüntüleyin.
        </Text>
      </View>

      <ScrollView style={styles.historyList}>
        {getCompletedAnalyses().map((analysis, index) => (
          <View key={analysis.id} style={styles.historyItem}>
            <View style={styles.historyHeader}>
              <Trophy size={20} color="#F59E0B" />
              <Text style={[styles.historyScore, { color: getScoreColor(analysis.overallScore) }]}>
                {Math.round(analysis.overallScore)}%
              </Text>
              <Text style={styles.historyDate}>
                {formatDate(analysis.createdAt)}
              </Text>
            </View>
            <Text style={styles.historyDetails}>
              {analysis.presentItems} mevcut • {analysis.missingItems} eksik • {analysis.expiredItems} süresi dolmuş
            </Text>
          </View>
        ))}

        {getCompletedAnalyses().length === 0 && (
          <Text style={styles.noHistoryText}>
            Henüz analiz geçmişi bulunmuyor.
          </Text>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNewAnalysis}>
        <Plus size={20} color="white" />
        <Text style={styles.primaryButtonText}>Yeni Analiz Başlat</Text>
      </TouchableOpacity>
    </View>
  );

  // Dynamic sizing based on screen height
  const { height: screenHeight } = Dimensions.get('window');
  const isSmallScreen = screenHeight < 700;
  const scale = isSmallScreen ? 0.85 : 1;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flex: 1,
      padding: 16,
    },
    stepContainer: {
      flex: 1,
      justifyContent: 'space-between',
    },
    stepHeader: {
      alignItems: 'center',
      marginBottom: 16 * scale,
    },
    stepTitle: {
      fontSize: 22 * scale,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 12 * scale,
      marginBottom: 8 * scale,
    },
    stepDescription: {
      fontSize: 15 * scale,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22 * scale,
    },
    infoBox: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 14 * scale,
      marginTop: 16 * scale,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      maxWidth: 400,
      alignSelf: 'center',
      width: '90%',
    },
    infoTitle: {
      fontSize: 15 * scale,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 8 * scale,
    },
    infoText: {
      fontSize: 13 * scale,
      color: colors.textSecondary,
      marginBottom: 4 * scale,
      lineHeight: 18 * scale,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14 * scale,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 10 * scale,
    },
    primaryButtonText: {
      color: 'white',
      fontSize: 16 * scale,
      fontWeight: '600',
    },
    secondaryButton: {
      borderWidth: 2,
      borderColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14 * scale,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    secondaryButtonText: {
      color: colors.primary,
      fontSize: 16 * scale,
      fontWeight: '600',
    },
    imageSection: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
      alignItems: 'center',
    },
    imageContainer: {
      width: '100%',
      aspectRatio: 1.2,
      maxWidth: 720,
      alignSelf: 'center',
      borderRadius: 12,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      borderStyle: 'dashed',
    },
    selectedImage: {
      width: '100%',
      height: '100%',
      borderRadius: 12,
    },
    placeholderText: {
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    button: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    buttonText: {
      color: 'white',
      fontWeight: '600',
    },
    loadingContainer: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 40,
      alignItems: 'center',
      marginBottom: 20,
    },
    loadingText: {
      color: colors.textPrimary,
      marginTop: 16,
      fontSize: 16,
    },
    loadingSubText: {
      color: colors.textSecondary,
      marginTop: 8,
      fontSize: 14,
      textAlign: 'center',
    },
    completedHeader: {
      alignItems: 'center',
      marginBottom: 32,
    },
    completedTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    completedDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    finalScoreCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      marginBottom: 20,
    },
    finalScoreTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 16,
    },
    finalScoreValue: {
      fontSize: 48,
      fontWeight: 'bold',
      marginBottom: 8,
    },
    finalScoreDescription: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    statsCard: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 20,
    },
    statItem: {
      alignItems: 'center',
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    itemsAnalysisContainer: {
      marginBottom: 24,
    },
    itemsAnalysisTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    itemAnalysisCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    itemAnalysisHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
      gap: 12,
    },
    itemInfo: {
      flex: 1,
    },
    itemName: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    itemCategory: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    analysisSection: {
      marginTop: 12,
    },
    itemExpiry: {
      fontSize: 14,
      color: '#F59E0B',
    },
    itemRecommendation: {
      fontSize: 14,
      color: colors.textPrimary,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    missingItemCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: '#EF4444',
    },
    missingItemText: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    recommendationCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
    },
    recommendationText: {
      fontSize: 14,
      color: colors.textPrimary,
      lineHeight: 20,
    },
    historyList: {
      flex: 1,
      marginBottom: 24,
    },
    historyItem: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    },
    historyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    historyScore: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    historyDate: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 'auto',
    },
    historyDetails: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    noHistoryText: {
      textAlign: 'center',
      color: colors.textSecondary,
      fontSize: 14,
      fontStyle: 'italic',
      marginTop: 20,
    },
    resultsButtonContainer: {
      marginTop: 24,
      marginBottom: 40,
      gap: 16,
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen
        options={{
          title: 'PrepCheck',
          headerBackVisible: !isAnalyzing,
          gestureEnabled: !isAnalyzing,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 'intro' && renderIntroStep()}
        {currentStep === 'upload' && renderUploadStep()}
        {currentStep === 'results' && renderResultsStep()}
        {currentStep === 'history' && renderHistoryStep()}
      </ScrollView>
    </SafeAreaView>
  );
}
