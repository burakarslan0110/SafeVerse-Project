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
  TextInput,
  Modal,
  BackHandler,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { 
  Camera, 
  Image as ImageIcon, 
  CheckCircle, 
  Home,
  Plus,
  History,
  Star
} from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeZone } from '@/contexts/SafeZoneContext';
import { router } from 'expo-router';
import { useNavigationBlock } from '@/contexts/NavigationBlockerContext';
import { apiService } from '@/lib/api';

type RoomSetupStep = 'room-count' | 'room-upload' | 'results' | 'history';

export default function HomeSecurityScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();

  const {
    currentAssessment,
    assessments,
    startNewAssessment,
    addRoomAnalysis,
    clearCurrentAssessment,
    clearIncompleteAssessment,
    resetToInitialState,
    clearAllData,
    isLoading: dbLoading
  } = useSafeZone();

  const [currentStep, setCurrentStep] = useState<RoomSetupStep>('room-count');
  const [totalRooms, setTotalRooms] = useState<string>('');

  const [roomName, setRoomName] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [showRoomNameModal, setShowRoomNameModal] = useState<boolean>(false);
  const [roomImages, setRoomImages] = useState<{name: string, uri: string, base64: string}[]>([]);
  const [aiRequestsRemaining, setAiRequestsRemaining] = useState<number | null>(null);
  const [aiRequestsResetAt, setAiRequestsResetAt] = useState<string | null>(null);

  // Block browser back button when analyzing (web only)
  useNavigationBlock(isAnalyzing);

  // Fetch AI request limits on mount
  useEffect(() => {
    const fetchAiRequestsStatus = async () => {
      try {
        const response = await apiService.safety.getAiRequestsStatus();
        setAiRequestsRemaining(response.data.remaining);
        setAiRequestsResetAt(response.data.resetAt);
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



  // Handle navigation and prevent back during analysis
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
        
        // If user is in room-count step and tries to go back, clear incomplete assessment
        if (currentStep === 'room-count' && currentAssessment && currentAssessment.completedRooms === 0 && roomImages.length === 0) {
          clearIncompleteAssessment();
        }
        // If user is in room-upload step and tries to go back, only clear if no images collected
        if (currentStep === 'room-upload' && currentAssessment && currentAssessment.completedRooms === 0 && roomImages.length === 0) {
          clearIncompleteAssessment();
        }
        
        return false; // Allow default back action
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isAnalyzing, currentStep, currentAssessment, clearIncompleteAssessment, roomImages.length])
  );

  // Track if assessment was just created to prevent premature cleanup
  const justCreatedAssessment = React.useRef(false);
  const hasVisitedBefore = React.useRef(false);

  // Clean up incomplete assessments only when user navigates away and returns
  useFocusEffect(
    useCallback(() => {
      // On focus (screen becomes visible)
      if (hasVisitedBefore.current && currentAssessment && currentAssessment.completedRooms === 0 && roomImages.length === 0 && !justCreatedAssessment.current) {
        // User returned to this screen without uploading any images, clear the incomplete assessment
        clearIncompleteAssessment();
        setCurrentStep('room-count');
        setTotalRooms('');
        setSelectedImage(null);
        setSelectedImageBase64(null);
        setRoomImages([]);
      }

      // Mark that screen has been visited at least once
      hasVisitedBefore.current = true;

      return () => {
        // On blur (screen loses focus / user navigates away)
      };
    }, [currentAssessment, roomImages.length, clearIncompleteAssessment])
  );

  useEffect(() => {
    if (currentAssessment) {
      // If there's an incomplete assessment with analyzed rooms, continue with room upload
      if (currentAssessment.completedRooms < currentAssessment.totalRooms && currentAssessment.completedRooms > 0) {
        if (currentStep !== 'room-upload' && !isAnalyzing) {
          setCurrentStep('room-upload');
        }
      } else if (currentAssessment.completedRooms >= currentAssessment.totalRooms) {
        // If assessment is complete, show results
        if (currentStep !== 'results') {
          setCurrentStep('results');
          // Clear roomImages when moving to results
          if (roomImages.length > 0) {
            setRoomImages([]);
          }
        }
      } else if (currentAssessment.completedRooms === 0 && roomImages.length > 0) {
        // If we have collected images but no analyzed rooms, stay in room-upload
        if (currentStep !== 'room-upload' && !isAnalyzing) {
          setCurrentStep('room-upload');
        }
      }
      // REMOVED: Don't try to auto-transition new assessments here - handleStartAssessment does it
      // If we're analyzing, don't change the step
    } else if (!isAnalyzing && currentStep !== 'history' && !justCreatedAssessment.current) {
      // Only go back to room-count if we're not in the middle of creating an assessment
      setCurrentStep('room-count');
    }
  }, [currentAssessment, isAnalyzing, roomImages.length, currentStep]);

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

  const handleStartAssessment = async () => {
    const rooms = parseInt(totalRooms);
    if (isNaN(rooms) || rooms < 1 || rooms > 20) {
      Alert.alert('Hata', 'Lütfen 1-20 arasında geçerli bir oda sayısı girin.');
      return;
    }

    // Check AI request limit before starting
    if (aiRequestsRemaining !== null && aiRequestsRemaining <= 0) {
      Alert.alert(
        'Günlük Limit Aşıldı',
        'Günde en fazla 2 analiz yapabilirsiniz. Yeni hakkınız 24 saat sonra yenilenecek.',
        [{ text: 'Tamam' }]
      );
      return;
    }

    try {
      // Clear any incomplete assessments before starting new one
      if (currentAssessment && currentAssessment.completedRooms === 0) {
        await clearIncompleteAssessment();
      }

      // Mark that we're creating a new assessment to prevent useFocusEffect from clearing it
      justCreatedAssessment.current = true;

      const assessmentId = await startNewAssessment(rooms);
      // DIRECTLY transition to room-upload step after creating assessment
      setCurrentStep('room-upload');
    } catch (error) {
      console.error('❌ Error starting assessment:', error);
      justCreatedAssessment.current = false; // Reset on error
      Alert.alert('Hata', 'Değerlendirme başlatılırken bir hata oluştu: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const pickImageFromGallery = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setSelectedImageBase64(result.assets[0].base64 || null);
        setShowRoomNameModal(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Hata', 'Resim seçilirken bir hata oluştu: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const takePhoto = async () => {
    try {
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0].uri);
        setSelectedImageBase64(result.assets[0].base64 || null);
        setShowRoomNameModal(true);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Hata', 'Fotoğraf çekilirken bir hata oluştu: ' + (error instanceof Error ? error.message : String(error)));
    }
  };



  const handleRoomNameSubmit = async () => {
    if (!roomName.trim()) {
      Alert.alert('Hata', 'Lütfen oda adını girin.');
      return;
    }

    if (!selectedImage || !selectedImageBase64) {
      Alert.alert('Hata', 'Fotoğraf seçilmedi veya işlenemedi.');
      return;
    }

    if (!currentAssessment) {
      Alert.alert('Hata', 'Değerlendirme bulunamadı.');
      return;
    }

    setShowRoomNameModal(false);
    
    // Add room to collection
    const newRoomImages = [...roomImages, { name: roomName, uri: selectedImage, base64: selectedImageBase64 }];
    setRoomImages(newRoomImages);
    
    // Reset form for next room
    setRoomName('');
    setSelectedImage(null);
    setSelectedImageBase64(null);
    
    // Check if all rooms are collected
    if (newRoomImages.length >= currentAssessment.totalRooms) {
      // Start analysis immediately without delay to prevent state conflicts
      analyzeAllRooms(newRoomImages);
    }
  };

  const analyzeAllRooms = async (roomImages: {name: string, uri: string, base64: string}[]) => {
    setIsAnalyzing(true);
    try {
      // Call backend API which uses configured LLM service
      const response = await apiService.safety.analyzeRooms({
        rooms: roomImages.map(room => ({
          name: room.name,
          base64: room.base64
        }))
      });

      const data = response.data;

      // Update remaining requests count
      if (typeof data.requestsRemaining === 'number') {
        setAiRequestsRemaining(data.requestsRemaining);
      }
      if (data.resetAt) {
        setAiRequestsResetAt(data.resetAt);
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
      
      const result = JSON.parse(cleanedCompletion);
      
      if (!result.rooms || !Array.isArray(result.rooms)) {
        throw new Error('Invalid response structure');
      }
      
      // Save all room analyses
      if (currentAssessment) {
        for (let i = 0; i < result.rooms.length; i++) {
          const roomResult = result.rooms[i];
          const roomImage = roomImages[i];
          if (roomResult && roomImage) {
            await addRoomAnalysis(currentAssessment.id, roomImage.name, '', roomResult);
          }
        }
      } else {
        console.error('No current assessment found!');
      }
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

  const getSafetyColor = (safety: string) => {
    switch (safety) {
      case 'safe': return '#10B981';
      case 'moderate': return '#F59E0B';
      case 'dangerous': return '#EF4444';
      default: return colors.textSecondary;
    }
  };





  const handleNewAssessment = async () => {
    await clearCurrentAssessment();
    setCurrentStep('room-count');
    setTotalRooms('');
    setRoomName('');
    setSelectedImage(null);
    setSelectedImageBase64(null);
    setRoomImages([]);
  };

  const handleReturnToStart = async () => {
    await resetToInitialState();
    // Reset local state
    setCurrentStep('room-count');
    setTotalRooms('');
    setRoomName('');
    setSelectedImage(null);
    setSelectedImageBase64(null);
    setRoomImages([]);
    router.back(); // Return to main screen
  };

  const renderRoomCountStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <Text style={styles.stepTitle}>SafeZone Nedir?</Text>
        <Text style={styles.stepDescription}>
          SafeZone, evinizin deprem güvenliğini analiz eden akıllı sistemimizdir. Her odanızın fotoğrafını çekerek AI ile güvenlik analizi yapar, risk alanlarını tespit eder ve güvenli bölgeleri belirler.
        </Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Nasıl Çalışır?</Text>
          <Text style={styles.infoText}>• Her oda için fotoğraf çekin</Text>
          <Text style={styles.infoText}>• AI mobilya ve yapısal riskleri analiz eder</Text>
          <Text style={styles.infoText}>• Güvenlik puanı ve öneriler alın</Text>
          <Text style={styles.infoText}>• Geçmiş analizlerinizi takip edin</Text>
          <Text style={[styles.infoText, { color: '#10B981', fontWeight: '600', marginTop: 8 }]}>• 🔒 Görseller sadece analiz için kullanılır, hiçbir yerde saklanmaz</Text>
        </View>

        {aiRequestsRemaining !== null && (
          <View style={[styles.infoBox, { borderLeftColor: aiRequestsRemaining > 0 ? '#10B981' : '#EF4444', marginTop: 12 }]}>
            <Text style={[styles.infoTitle, { color: aiRequestsRemaining > 0 ? '#10B981' : '#EF4444' }]}>
              {aiRequestsRemaining > 0 ? '✓ Analiz Hakkınız' : '⚠️ Günlük Limit Doldu'}
            </Text>
            <Text style={styles.infoText}>
              {aiRequestsRemaining > 0
                ? `Bugün ${aiRequestsRemaining} analiz hakkınız kaldı. Her analiz tüm odaları birlikte işler.`
                : 'Günlük 2 analiz hakkınızı kullandınız. Yeni hakkınız 24 saat sonra yenilenecek.'}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.inputContainer}>
        <Text style={[styles.inputLabel, aiRequestsRemaining === 0 && { opacity: 0.5 }]}>Evinizde Kaç Oda Var?</Text>
        <Text style={[styles.inputHint, aiRequestsRemaining === 0 && { opacity: 0.5 }]}>Yatak odası, salon, mutfak, banyo gibi tüm odaları sayın</Text>
        <TextInput
          style={[styles.textInput, aiRequestsRemaining === 0 && { opacity: 0.5, backgroundColor: colors.border }]}
          value={totalRooms}
          onChangeText={setTotalRooms}
          placeholder="Örn: 4"
          keyboardType="numeric"
          maxLength={2}
          editable={aiRequestsRemaining !== 0}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, aiRequestsRemaining === 0 && { opacity: 0.5, backgroundColor: colors.textSecondary }]}
        onPress={handleStartAssessment}
        disabled={aiRequestsRemaining === 0}
      >
        <Plus size={20} color="white" />
        <Text style={styles.primaryButtonText}>Değerlendirmeyi Başlat</Text>
      </TouchableOpacity>

      {assessments.length > 0 && (
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={() => setCurrentStep('history')}
        >
          <History size={20} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Geçmiş Değerlendirmeler</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderRoomUploadStep = () => {
    const totalRooms = currentAssessment?.totalRooms || 0;
    const completedRooms = roomImages.length;
    const currentRoomNumber = completedRooms + 1;
    const isCompleted = completedRooms >= totalRooms;
    
    return (
    <View style={styles.stepContainer}>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>
          {isCompleted ? `${totalRooms} / ${totalRooms} Oda Tamamlandı` : `${completedRooms} / ${totalRooms} Oda Tamamlandı`}
        </Text>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${(completedRooms / totalRooms) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {!isCompleted && (
        <View style={styles.imageSection}>
          <View style={styles.imageContainer}>
            {selectedImage ? (
              <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            ) : (
              <>
                <ImageIcon size={48} color={colors.textSecondary} />
                <Text style={styles.placeholderText}>
                  {isCompleted ? 'Tüm odalar toplandı' : `${currentRoomNumber}. odanızın fotoğrafını çekin`}
                </Text>
              </>
            )}
          </View>
          
          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.button} onPress={takePhoto}>
              <Camera size={20} color="white" />
              <Text style={styles.buttonText}>Fotoğraf Çek</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.button} onPress={pickImageFromGallery}>
              <ImageIcon size={20} color="white" />
              <Text style={styles.buttonText}>Galeriden Seç</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {roomImages.length > 0 && (
        <View style={styles.collectedRoomsContainer}>
          <Text style={styles.collectedRoomsTitle}>Toplanan Odalar:</Text>
          <View style={styles.collectedRoomsList}>
            {roomImages.map((room, index) => (
              <View key={`${room.name}-${index}`} style={styles.collectedRoomItem}>
                <Image source={{ uri: room.uri }} style={styles.collectedRoomImage} />
                <Text style={styles.collectedRoomName}>{room.name}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {isCompleted && !isAnalyzing && (
        <View style={styles.completedUploadContainer}>
          <CheckCircle size={48} color="#10B981" />
          <Text style={styles.completedUploadTitle}>Tüm Odalar Toplandı!</Text>
          <Text style={styles.completedUploadDescription}>
            {totalRooms} oda fotoğrafı başarıyla toplandı. Analiz başlatılıyor...
          </Text>
        </View>
      )}

      {isAnalyzing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Tüm odalar analiz ediliyor...</Text>
          <Text style={styles.loadingSubText}>Bu işlem birkaç dakika sürebilir</Text>
        </View>
      )}
    </View>
    );
  };

  const renderResultsStep = () => (
    <ScrollView style={styles.stepContainer}>
      <View style={styles.completedHeader}>
        <CheckCircle size={48} color="#10B981" />
        <Text style={styles.completedTitle}>Değerlendirme Tamamlandı!</Text>
        <Text style={styles.completedDescription}>
          Tüm odalarınız analiz edildi. Genel güvenlik puanınız hesaplandı.
        </Text>
      </View>

      {currentAssessment && (
        <View style={styles.finalScoreCard}>
          <Text style={styles.finalScoreTitle}>Genel Güvenlik Puanı</Text>
          <Text style={styles.finalScoreValue}>
            {Math.round(currentAssessment.overallScore)}%
          </Text>
          <Text style={styles.finalScoreDescription}>
            {currentAssessment.completedRooms} oda analiz edildi
          </Text>
        </View>
      )}

      {/* Detailed Room Analysis Results */}
      {currentAssessment && currentAssessment.rooms.length > 0 && (
        <View style={styles.roomAnalysisContainer}>
          <Text style={styles.roomAnalysisTitle}>Oda Analiz Sonuçları</Text>
          {currentAssessment.rooms.map((room, index) => (
            <View key={room.id} style={styles.roomAnalysisCard}>
              {room.safetyScore === 0 ? (
                // Special rendering for invalid room images
                <View>
                  <View style={styles.roomAnalysisHeader}>
                    <Text style={styles.roomAnalysisName}>{room.name}</Text>
                    <Text style={[styles.roomAnalysisScore, { color: '#EF4444' }]}>
                      ⚠️
                    </Text>
                  </View>
                  <View style={[styles.safetyBadge, { backgroundColor: '#EF444420' }]}>
                    <Text style={[styles.safetyBadgeText, { color: '#EF4444' }]}>
                      Geçersiz Görsel
                    </Text>
                  </View>
                  <View style={styles.analysisSection}>
                    <Text style={styles.analysisSectionTitle}>⚠️ Uyarı</Text>
                    <Text style={styles.analysisItem}>
                      Bu görsel gerçek bir oda fotoğrafı değil. Lütfen odanızın iç mekan fotoğrafını yükleyin (mobilya, duvarlar, pencereler görünür olmalı).
                    </Text>
                  </View>
                </View>
              ) : (
                // Normal room analysis rendering
                <View>
                  <View style={styles.roomAnalysisHeader}>
                    <Text style={styles.roomAnalysisName}>{room.name}</Text>
                    <Text style={[
                      styles.roomAnalysisScore,
                      { color: getSafetyColor(room.analysisResult.overallSafety) }
                    ]}>
                      {room.safetyScore}%
                    </Text>
                  </View>
              
              <View style={[
                styles.safetyBadge,
                { backgroundColor: getSafetyColor(room.analysisResult.overallSafety) + '20' }
              ]}>
                <Text style={[
                  styles.safetyBadgeText,
                  { color: getSafetyColor(room.analysisResult.overallSafety) }
                ]}>
                  {room.analysisResult.overallSafety === 'safe' ? 'Güvenli' :
                   room.analysisResult.overallSafety === 'moderate' ? 'Orta Risk' : 'Yüksek Risk'}
                </Text>
              </View>

              {room.analysisResult.safeZones && room.analysisResult.safeZones.length > 0 && (
                <View style={styles.analysisSection}>
                  <Text style={styles.analysisSectionTitle}>🛡️ Güvenli Bölgeler:</Text>
                  {room.analysisResult.safeZones.map((zone, zoneIndex) => (
                    <Text key={zoneIndex} style={styles.analysisItem}>• {zone}</Text>
                  ))}
                </View>
              )}

              {room.analysisResult.risks && room.analysisResult.risks.length > 0 && (
                <View style={styles.analysisSection}>
                  <Text style={styles.analysisSectionTitle}>⚠️ Risk Alanları:</Text>
                  {room.analysisResult.risks.map((risk, riskIndex) => (
                    <View key={riskIndex} style={styles.riskItem}>
                      <Text style={[
                        styles.riskSeverity,
                        { color: risk.severity === 'high' ? '#EF4444' : risk.severity === 'medium' ? '#F59E0B' : '#10B981' }
                      ]}>
                        {risk.severity === 'high' ? '🔴' : risk.severity === 'medium' ? '🟡' : '🟢'} {risk.type}
                      </Text>
                      <Text style={styles.riskDescription}>{risk.description}</Text>
                      <Text style={styles.riskRecommendation}>💡 {risk.recommendation}</Text>
                    </View>
                  ))}
                </View>
              )}

              {room.analysisResult.strengths && room.analysisResult.strengths.length > 0 && (
                <View style={styles.analysisSection}>
                  <Text style={styles.analysisSectionTitle}>✅ Güçlü Yönler:</Text>
                  {room.analysisResult.strengths.map((strength, strengthIndex) => (
                    <Text key={strengthIndex} style={styles.analysisItem}>• {strength}</Text>
                  ))}
                </View>
              )}

              {room.analysisResult.actionItems && room.analysisResult.actionItems.length > 0 && (
                <View style={styles.analysisSection}>
                  <Text style={styles.analysisSectionTitle}>🎯 Acil Eylem Önerileri:</Text>
                  {room.analysisResult.actionItems.map((action, actionIndex) => (
                    <Text key={actionIndex} style={styles.actionItem}>• {action}</Text>
                  ))}
                </View>
              )}
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      <View style={styles.resultsButtonContainer}>
        <TouchableOpacity 
          style={styles.secondaryButton} 
          onPress={handleReturnToStart}
        >
          <Home size={20} color={colors.primary} />
          <Text style={styles.secondaryButtonText}>Ana Sayfaya Dön</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNewAssessment}>
          <Plus size={20} color="white" />
          <Text style={styles.primaryButtonText}>Yeni Değerlendirme</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderHistoryStep = () => (
    <View style={styles.stepContainer}>
      <View style={styles.stepHeader}>
        <History size={32} color={colors.primary} />
        <Text style={styles.stepTitle}>Geçmiş Değerlendirmeler</Text>
        <Text style={styles.stepDescription}>
          Daha önce yaptığınız güvenlik değerlendirmelerinizi görüntüleyin.
        </Text>
      </View>

      <ScrollView style={styles.historyList}>
        {assessments.map((assessment, index) => (
          <View key={assessment.id} style={styles.historyItem}>
            <View style={styles.historyHeader}>
              <Star size={20} color="#F59E0B" />
              <Text style={styles.historyScore}>
                {Math.round(assessment.overallScore)}%
              </Text>
              <Text style={styles.historyDate}>
                {new Date(assessment.createdAt).toLocaleDateString('tr-TR')}
              </Text>
            </View>
            <Text style={styles.historyDetails}>
              {assessment.completedRooms}/{assessment.totalRooms} oda tamamlandı
            </Text>

            <View style={styles.roomsList}>
              {assessment.rooms.map((room, roomIndex) => (
                <View key={room.id} style={styles.roomItem}>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={[
                    styles.roomScore,
                    { color: getSafetyColor(room.analysisResult.overallSafety) }
                  ]}>
                    {room.safetyScore}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNewAssessment}>
        <Plus size={20} color="white" />
        <Text style={styles.primaryButtonText}>Yeni Değerlendirme Başlat</Text>
      </TouchableOpacity>

      {__DEV__ && (
        <TouchableOpacity
          style={[styles.secondaryButton, { borderColor: '#EF4444', marginTop: 16 }]}
          onPress={async () => {
            Alert.alert(
              'Tüm Verileri Sil',
              'Bu işlem tüm SafeZone verilerini kalıcı olarak silecektir. Emin misiniz?',
              [
                { text: 'İptal', style: 'cancel' },
                {
                  text: 'Sil',
                  style: 'destructive',
                  onPress: async () => {
                    await clearAllData();
                    setCurrentStep('room-count');
                  }
                }
              ]
            );
          }}
        >
          <Text style={[styles.secondaryButtonText, { color: '#EF4444' }]}>Tüm Verileri Sil (Debug)</Text>
        </TouchableOpacity>
      )}
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
    inputContainer: {
      marginBottom: 16 * scale,
    },
    inputLabel: {
      fontSize: 16 * scale,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 8 * scale,
    },
    inputHint: {
      fontSize: 14 * scale,
      color: colors.textSecondary,
      marginBottom: 12 * scale,
      fontStyle: 'italic',
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
    textInput: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14 * scale,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.cardBackground,
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
    progressContainer: {
      marginBottom: 24,
    },
    progressText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      textAlign: 'center',
      marginBottom: 8,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
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
      aspectRatio: 4/3,
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
    roomAnalysisSection: {
      marginBottom: 16,
    },
    analysisHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
      gap: 12,
    },
    analysisTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    scoreContainer: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
    },
    scoreText: {
      fontSize: 32,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    scoreLabel: {
      color: colors.textSecondary,
      fontSize: 14,
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
      marginBottom: 32,
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
      color: colors.primary,
      marginBottom: 8,
    },
    finalScoreDescription: {
      fontSize: 14,
      color: colors.textSecondary,
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
      color: colors.primary,
    },
    historyDate: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 'auto',
    },
    historyDetails: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 16,
    },
    roomsList: {
      gap: 8,
    },
    roomItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 8,
      padding: 12,
    },
    roomName: {
      fontSize: 14,
      color: colors.textPrimary,
      fontWeight: '500',
    },
    roomScore: {
      fontSize: 14,
      fontWeight: 'bold',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 24,
      width: '80%',
      maxWidth: 300,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    modalInput: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.textPrimary,
      backgroundColor: colors.background,
      marginBottom: 20,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
    },
    modalButtonPrimary: {
      backgroundColor: colors.primary,
    },
    modalButtonSecondary: {
      backgroundColor: colors.border,
    },
    modalButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextPrimary: {
      color: 'white',
    },
    modalButtonTextSecondary: {
      color: colors.textPrimary,
    },
    completedUploadContainer: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 32,
      alignItems: 'center',
      marginBottom: 20,
    },
    completedUploadTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginTop: 16,
      marginBottom: 8,
    },
    completedUploadDescription: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 24,
    },
    collectedRoomsContainer: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 16,
      marginBottom: 20,
    },
    collectedRoomsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 12,
    },
    collectedRoomsList: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    collectedRoomItem: {
      alignItems: 'center',
      width: 80,
    },
    collectedRoomImage: {
      width: 60,
      height: 60,
      borderRadius: 8,
      marginBottom: 4,
    },
    collectedRoomName: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    roomAnalysisContainer: {
      marginBottom: 24,
    },
    roomAnalysisTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    roomAnalysisCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    roomAnalysisHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    roomAnalysisName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.textPrimary,
    },
    roomAnalysisScore: {
      fontSize: 18,
      fontWeight: 'bold',
    },
    safetyBadge: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 16,
    },
    safetyBadgeText: {
      fontSize: 14,
      fontWeight: '600',
    },
    analysisSection: {
      marginBottom: 16,
    },
    analysisSectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.textPrimary,
      marginBottom: 8,
    },
    analysisItem: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
      lineHeight: 20,
    },
    riskItem: {
      marginBottom: 12,
      paddingLeft: 8,
    },
    riskSeverity: {
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    riskDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
      lineHeight: 20,
    },
    riskRecommendation: {
      fontSize: 14,
      color: colors.primary,
      fontStyle: 'italic',
      lineHeight: 20,
    },
    actionItem: {
      fontSize: 14,
      color: colors.primary,
      marginBottom: 4,
      lineHeight: 20,
      fontWeight: '500',
    },
    tertiaryButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 8,
    },
    tertiaryButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
      fontWeight: '500',
    },
    resultsButtonContainer: {
      marginTop: 24,
      marginBottom: 40,
      gap: 16,
    },
  });

  if (dbLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { marginTop: 16 }]}>Yükleniyor...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {currentStep === 'room-count' && renderRoomCountStep()}
        {currentStep === 'room-upload' && renderRoomUploadStep()}
        {currentStep === 'results' && renderResultsStep()}
        {currentStep === 'history' && renderHistoryStep()}
      </ScrollView>

      <Modal
        visible={showRoomNameModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoomNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Oda Adı</Text>
            <TextInput
              style={styles.modalInput}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="Örn: Yatak Odası, Salon, Mutfak"
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => {
                  setShowRoomNameModal(false);
                  setSelectedImage(null);
                  setSelectedImageBase64(null);
                  setRoomName('');
                }}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextSecondary]}>
                  İptal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleRoomNameSubmit}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary]}>
                  {(roomImages.length + 1) >= (currentAssessment?.totalRooms || 0) ? 'Tamamla' : 'Ekle'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
