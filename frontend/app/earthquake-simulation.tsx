import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { ArrowLeft, Play, RotateCcw, Users, Baby, Home } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { useNavigationBlock } from '@/contexts/NavigationBlockerContext';


type SimulationPhase = 'preparation' | 'start' | 'crouch' | 'cover' | 'hold' | 'end' | 'completed';
type SimulationMode = 'adult' | 'child';

interface SimulationStep {
  phase: SimulationPhase;
  title: string;
  description: string;
  detailedInfo: string;
  duration: number;
  speechText: string;
  emoji: string;
  color: string;
}

export default function EarthquakeSimulation() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SimulationMode>('adult');
  const [currentPhase, setCurrentPhase] = useState<SimulationPhase>('preparation');
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(0);
  const scaleAnimation = useRef(new Animated.Value(1)).current;
  const fadeAnimation = useRef(new Animated.Value(1)).current;

  // Block browser back button when simulation is running (web only)
  useNavigationBlock(isRunning);
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const bounceAnimation = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const vibrationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const simulationSteps: Record<SimulationMode, SimulationStep[]> = useMemo(() => ({
    adult: [
      {
        phase: 'start',
        title: 'DEPREM BAŞLADI!',
        description: 'Sakin kalın ve hemen harekete geçin. Panik yapmayın, öğrendiğiniz teknikleri uygulayın.',
        detailedInfo: 'Deprem anında ilk 15-20 saniye kritiktir. Bu sürede doğru kararlar alarak kendinizi koruyabilirsiniz. Panik yapmak yerine, önceden öğrendiğiniz "ÇÖK-KAPAN-TUTUN" tekniğini uygulamaya başlayın. Çevrenizde düşebilecek eşyalardan uzaklaşın.',
        duration: 5,
        speechText: 'Deprem başladı! Sakin kalın ve hemen harekete geçin.',
        emoji: '🚨',
        color: '#EF4444'
      },
      {
        phase: 'crouch',
        title: 'ÇÖK!',
        description: 'Hemen yere çökün. Dizlerinizin üzerine çömelip ellerinizi yere koyun.',
        detailedInfo: 'Yere çökmek, düşme riskini minimize eder ve bir sonraki adım için hazırlık yapar. Dizlerinizin üzerine çömelip, ellerinizi yere koyarak denge sağlayın. Bu pozisyon size hızlı hareket etme imkanı verir ve yaralanma riskini azaltır.',
        duration: 10,
        speechText: 'Çök! Hemen yere çökün. Dizlerinizin üzerine çömelip ellerinizi yere koyun.',
        emoji: '🧎',
        color: '#F59E0B'
      },
      {
        phase: 'cover',
        title: 'KAPAN!',
        description: 'Başınızı ve boynunuzu koruyun. Masa altına girin veya kollarınızla başınızı örtün.',
        detailedInfo: 'Baş ve boyun bölgesi en kritik koruma alanıdır. Mümkünse sağlam bir masa altına girin. Masa yoksa kollarınızı başınızın üzerine koyarak koruma sağlayın. Cam, ayna ve ağır eşyalardan uzak durun. Duvarların yanına yaklaşmayın.',
        duration: 10,
        speechText: 'Kapan! Başınızı ve boynunuzu koruyun. Masa altına girin veya kollarınızla başınızı örtün.',
        emoji: '🛡️',
        color: '#3B82F6'
      },
      {
        phase: 'hold',
        title: 'TUTUN!',
        description: 'Sağlam bir nesneyi sıkıca tutun. Masa ayağı veya sabit bir yapıya tutunun.',
        detailedInfo: 'Masa ayağını veya sağlam bir yapıyı sıkıca tutarak pozisyonunuzu koruyun. Bu, sarsıntı sırasında kaymanızı ve düşmenizi engeller. Masa hareket ederse onunla birlikte hareket edin. Sarsıntı bitene kadar bu pozisyonu koruyun.',
        duration: 15,
        speechText: 'Tutun! Sağlam bir nesneyi sıkıca tutun. Masa ayağı veya sabit bir yapıya tutunun.',
        emoji: '✊',
        color: '#10B981'
      },
      {
        phase: 'end',
        title: 'DEPREM DURDU',
        description: 'Sarsıntı durdu. Yavaşça kalkın ve çevrenizi kontrol edin. Güvenli bir şekilde tahliye edin.',
        detailedInfo: 'Sarsıntı durduktan sonra acele etmeyin. Artçı sarsıntılar olabileceği için dikkatli olun. Çevrenizde hasar olup olmadığını kontrol edin. Gaz kaçağı, elektrik arızası gibi tehlikeleri kontrol edin. Güvenli çıkış yolunu kullanarak binayı terk edin.',
        duration: 5,
        speechText: 'Deprem durdu. Sarsıntı durdu. Yavaşça kalkın ve çevrenizi kontrol edin.',
        emoji: '✅',
        color: '#10B981'
      }
    ],
    child: [
      {
        phase: 'start',
        title: 'DEPREM OYUNU BAŞLADI!',
        description: 'Merhaba küçük kahraman! Şimdi deprem oyununu oynayacağız. Beni takip et!',
        detailedInfo: 'Sen çok özel bir kahramansın! Bu oyun sana deprem anında nasıl güvende kalacağını öğretecek. Tıpkı süper kahramanlar gibi, sen de özel güçlerin var. Bu güçleri kullanarak kendini koruyabilirsin. Hazır mısın kahraman?',
        duration: 5,
        speechText: 'Merhaba küçük kahraman! Şimdi deprem oyununu oynayacağız. Beni takip et!',
        emoji: '🦸',
        color: '#EF4444'
      },
      {
        phase: 'crouch',
        title: 'KAPLUMBAĞA GİBİ ÇÖK!',
        description: 'Kaplumbağa gibi yere çök! Dizlerinin üzerine çömel, tıpkı kaplumbağa gibi!',
        detailedInfo: 'Kaplumbağalar çok akıllı hayvanlardır! Tehlike anında hemen yere çökerler. Sen de tıpkı onlar gibi, dizlerinin üzerine çömel ve ellerini yere koy. Bu şekilde çok güçlü ve dengeli olursun. Kaplumbağa kahramanımız olmaya hazır mısın?',
        duration: 10,
        speechText: 'Kaplumbağa gibi yere çök! Dizlerinin üzerine çömel, tıpkı kaplumbağa gibi!',
        emoji: '🐢',
        color: '#F59E0B'
      },
      {
        phase: 'cover',
        title: 'KABUĞUNA SAKLAN!',
        description: 'Kaplumbağa kabuğuna saklan! Başını kollarınla koru, masa altına gir!',
        detailedInfo: 'Kaplumbağaların en güçlü yanı kabuklarıdır! Sen de kendi kabuğunu yarat. Kollarını başının üzerine koy, tıpkı güçlü bir kalkan gibi. Masa varsa altına gir, yoksa kolların seni koruyacak. Sen artık süper güçlü kaplumbağa kahramanısın!',
        duration: 10,
        speechText: 'Kaplumbağa kabuğuna saklan! Başını kollarınla koru, masa altına gir!',
        emoji: '🛡️',
        color: '#3B82F6'
      },
      {
        phase: 'hold',
        title: 'SIKI SIKI TUT!',
        description: 'Masa ayağını sıkı sıkı tut! Güçlü bir kahraman gibi sıkıca tutun!',
        detailedInfo: 'Süper kahramanların en önemli özelliği güçlü elleridir! Sen de masa ayağını veya sağlam bir yeri çok sıkı tut. Tıpkı süper güçlü bir kahraman gibi! Bu şekilde hiçbir şey seni yerinden oynatamaz. Sen gerçek bir güç kahramanısın!',
        duration: 15,
        speechText: 'Masa ayağını sıkı sıkı tut! Güçlü bir kahraman gibi sıkıca tutun!',
        emoji: '💪',
        color: '#10B981'
      },
      {
        phase: 'end',
        title: 'BRAVO KAHRAMAN!',
        description: 'Harika! Oyunu başarıyla tamamladın! Sen gerçek bir deprem kahramanısın!',
        detailedInfo: 'Tebrikler süper kahraman! Sen inanılmaz bir iş başardın! Artık deprem anında ne yapman gerektiğini biliyorsun. Ailenle ve arkadaşlarınla bu oyunu paylaşabilirsin. Sen gerçek bir kahraman olduğunu kanıtladın!',
        duration: 5,
        speechText: 'Harika! Oyunu başarıyla tamamladın! Sen gerçek bir deprem kahramanısın!',
        emoji: '🏆',
        color: '#10B981'
      }
    ]
  }), []);

  const getCurrentStep = useCallback((): SimulationStep | null => {
    const steps = simulationSteps[mode];
    return steps.find(step => step.phase === currentPhase) || null;
  }, [mode, currentPhase, simulationSteps]);

  const startEarthquakeEffects = useCallback(() => {
    const earthquakePattern = [200, 100, 200, 100, 300, 100, 200];
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, ...earthquakePattern], true);
      return;
    }
    // Web/PWA: use Navigator.vibrate if supported, retrigger periodically to simulate repeat
    try {
      const anyNavigator = navigator as any;
      if (typeof anyNavigator.vibrate === 'function') {
        anyNavigator.vibrate(earthquakePattern);
        if (vibrationIntervalRef.current) clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = setInterval(() => {
          anyNavigator.vibrate(earthquakePattern);
        }, 2000);
      }
    } catch {}
  }, []);

  const stopEarthquakeEffects = useCallback(() => {
    if (Platform.OS !== 'web') {
      Vibration.cancel();
      return;
    }
    try {
      const anyNavigator = navigator as any;
      if (typeof anyNavigator.vibrate === 'function') {
        anyNavigator.vibrate(0);
      }
    } catch {}
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
  }, []);



  const startChildAnimation = useCallback((phase: SimulationPhase) => {
    // Çocuk modu için eğlenceli animasyonlar
    switch (phase) {
      case 'start':
        // Heyecanlı bounce animasyonu
        Animated.sequence([
          Animated.timing(bounceAnimation, {
            toValue: 1.2,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        break;
      case 'crouch':
        // Yumuşak slide down animasyonu
        Animated.timing(slideAnimation, {
          toValue: 20,
          duration: 500,
          useNativeDriver: true,
        }).start();
        break;
      case 'cover':
        // Koruyucu fade animasyonu
        Animated.sequence([
          Animated.timing(fadeAnimation, {
            toValue: 0.7,
            duration: 400,
            useNativeDriver: true,
          }),
          Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }),
        ]).start();
        break;
      case 'hold':
        // Güçlü tutma animasyonu
        Animated.loop(
          Animated.sequence([
            Animated.timing(scaleAnimation, {
              toValue: 1.05,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(scaleAnimation, {
              toValue: 1,
              duration: 600,
              useNativeDriver: true,
            }),
          ])
        ).start();
        break;
      case 'end':
        // Kutlama animasyonu
        Animated.sequence([
          Animated.timing(bounceAnimation, {
            toValue: 1.3,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(bounceAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
        break;
    }
  }, [bounceAnimation, slideAnimation, fadeAnimation, scaleAnimation]);

  const startAdultAnimation = useCallback((phase: SimulationPhase) => {
    // Yetişkin modu için profesyonel animasyonlar
    switch (phase) {
      case 'start':
        // Dikkat çekici pulse animasyonu
        Animated.timing(scaleAnimation, {
          toValue: 1.1,
          duration: 400,
          useNativeDriver: true,
        }).start(() => {
          Animated.timing(scaleAnimation, {
            toValue: 1,
            duration: 400,
            useNativeDriver: true,
          }).start();
        });
        break;
      case 'crouch':
      case 'cover':
      case 'hold':
        // Sakin ve kontrollü fade animasyonu
        Animated.timing(fadeAnimation, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          Animated.timing(fadeAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
        break;
      case 'end':
        // Başarı animasyonu
        Animated.timing(scaleAnimation, {
          toValue: 1.05,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          Animated.timing(scaleAnimation, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        });
        break;
    }
  }, [scaleAnimation, fadeAnimation]);

  const resetAnimations = useCallback(() => {
    scaleAnimation.setValue(1);
    fadeAnimation.setValue(1);
    slideAnimation.setValue(0);
    bounceAnimation.setValue(1);
    scaleAnimation.stopAnimation();
    fadeAnimation.stopAnimation();
    slideAnimation.stopAnimation();
    bounceAnimation.stopAnimation();
  }, [scaleAnimation, fadeAnimation, slideAnimation, bounceAnimation]);

  const startSimulation = () => {
    // Prime vibration on web within user gesture
    if (Platform.OS === 'web') {
      try {
        const anyNavigator = navigator as any;
        if (typeof anyNavigator.vibrate === 'function') {
          anyNavigator.vibrate(30);
        }
      } catch {}
    }
    setCountdown(3);
    
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
          }
          setCurrentPhase('start');
          setIsRunning(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };



  const resetSimulation = () => {
    setIsRunning(false);
    setCurrentPhase('preparation');
    setTimeLeft(0);
    setCountdown(0);
    stopEarthquakeEffects();
    resetAnimations();

    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }
  };

  useEffect(() => {
    if (isRunning && currentPhase !== 'preparation' && currentPhase !== 'completed') {
      const currentStep = getCurrentStep();
      if (currentStep) {
        setTimeLeft(currentStep.duration);

        
        // Mod bazlı animasyonlar
        if (mode === 'child') {
          startChildAnimation(currentStep.phase);
        } else {
          startAdultAnimation(currentStep.phase);
        }
        
        if (currentStep.phase === 'start') {
          startEarthquakeEffects();
        } else if (currentStep.phase === 'end') {
          stopEarthquakeEffects();
        }

        intervalRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              const steps = simulationSteps[mode];
              const currentIndex = steps.findIndex(step => step.phase === currentPhase);
              
              if (currentIndex < steps.length - 1) {
                setCurrentPhase(steps[currentIndex + 1].phase);
              } else {
                setCurrentPhase('completed');
                setIsRunning(false);
                stopEarthquakeEffects();
              }
              
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
              }
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [currentPhase, isRunning, mode, getCurrentStep, simulationSteps, startChildAnimation, startAdultAnimation, startEarthquakeEffects, stopEarthquakeEffects]);

  useEffect(() => {
    return () => {
      stopEarthquakeEffects();

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
      }
    };
  }, [stopEarthquakeEffects]);



  const currentStep = getCurrentStep();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 24,
      paddingVertical: 16,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: 'white',
      textAlign: 'center',
    },
    content: {
      flex: 1,
      paddingHorizontal: 24,
      paddingVertical: 32,
      paddingBottom: Math.max(32, insets.bottom + 16),
    },
    modeSelector: {
      flexDirection: 'row',
      backgroundColor: colors.cardBackground,
      borderRadius: 16,
      padding: 8,
      marginBottom: 32,
      gap: 8,
    },
    modeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      gap: 8,
    },
    modeButtonActive: {
      backgroundColor: colors.primary,
    },
    modeButtonInactive: {
      backgroundColor: 'transparent',
    },
    modeButtonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    modeButtonTextActive: {
      color: 'white',
    },
    modeButtonTextInactive: {
      color: colors.textSecondary,
    },
    simulationCard: {
      backgroundColor: colors.cardBackground,
      borderRadius: 24,
      padding: 32,
      alignItems: 'center',
      minHeight: 400,
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
      elevation: 8,
    },
    phaseIconContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    phaseTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      textAlign: 'center',
      marginBottom: 16,
    },
    phaseDescription: {
      fontSize: 16,
      textAlign: 'center',
      lineHeight: 24,
      marginBottom: 32,
      color: colors.textSecondary,
    },
    timer: {
      fontSize: 48,
      fontWeight: 'bold',
      marginBottom: 24,
    },
    countdown: {
      fontSize: 120,
      fontWeight: 'bold',
      color: colors.primary,
    },
    countdownText: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: 16,
    },
    buttonContainer: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 32,
    },
    button: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 16,
      gap: 8,
    },
    primaryButton: {
      backgroundColor: colors.primary,
    },
    secondaryButton: {
      backgroundColor: colors.cardBackground,
      borderWidth: 2,
      borderColor: colors.border,
    },
    buttonText: {
      fontSize: 16,
      fontWeight: '600',
    },
    primaryButtonText: {
      color: 'white',
    },
    secondaryButtonText: {
      color: colors.textPrimary,
    },
    completedCard: {
      backgroundColor: '#10B981',
    },
    completedText: {
      color: 'white',
    },
    headerBackButton: {
      marginRight: 16,
    },
  });

  const renderPreparation = () => (
    <>
      <View style={[styles.phaseIconContainer, { backgroundColor: colors.primary + '20' }]}>
        <Home size={60} color={colors.primary} />
      </View>
      <Text style={[styles.phaseTitle, { color: colors.textPrimary }]}>
        Deprem Simülasyonu
      </Text>
      <Text style={styles.phaseDescription}>
        {mode === 'child' 
          ? 'Merhaba küçük kahraman! Deprem oyununu oynamaya hazır mısın? Bu oyun sana deprem anında ne yapman gerektiğini öğretecek. Kaplumbağa tekniğini öğreneceğiz!'
          : 'Deprem anında yapılması gereken "ÇÖK-KAPAN-TUTUN" tekniğini interaktif olarak pratik yapacaksınız. Simülasyon yaklaşık 45 saniye sürecek ve her adımda detaylı bilgi alacaksınız.'}
      </Text>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={startSimulation}
          activeOpacity={0.8}
          testID="start-simulation-button"
        >
          <Play size={20} color="white" />
          <Text style={[styles.buttonText, styles.primaryButtonText]}>
            Simülasyonu Başlat
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderCountdown = () => (
    <>
      <Animated.Text style={[styles.countdown, {
        transform: [{ scale: scaleAnimation }]
      }]}>
        <Text>{countdown}</Text>
      </Animated.Text>
      <Text style={styles.countdownText}>Hazırlanın...</Text>
    </>
  );

  const renderSimulation = () => {
    if (!currentStep) return null;

    return (
      <>
        <Animated.View style={[
          styles.phaseIconContainer,
          { backgroundColor: currentStep.color + '20' },
          {
            transform: [
              { scale: mode === 'child' ? bounceAnimation : scaleAnimation }
            ]
          }
        ]}>
          <Text style={{ fontSize: 60 }}>{currentStep.emoji}</Text>
        </Animated.View>
        <Text style={[styles.phaseTitle, { color: currentStep.color }]}>
          {currentStep.title}
        </Text>
        <Text style={styles.phaseDescription}>
          {currentStep.description}
        </Text>
        <Text style={[styles.phaseDescription, { fontSize: 14, marginTop: 16, fontStyle: 'italic' }]}>
          {currentStep.detailedInfo}
        </Text>
        <Text style={[styles.timer, { color: currentStep.color }]}>
          {timeLeft}
        </Text>
      </>
    );
  };

  const renderCompleted = () => (
    <>
      <Animated.View style={[
        styles.phaseIconContainer,
        { backgroundColor: '#10B981' + '20' },
        {
          transform: [
            { scale: bounceAnimation }
          ]
        }
      ]}>
        <Text style={{ fontSize: 60 }}>🏆</Text>
      </Animated.View>
      <Text style={[styles.phaseTitle, styles.completedText]}>
        {mode === 'child' ? 'Tebrikler Kahraman!' : 'Simülasyon Tamamlandı!'}
      </Text>
      <Text style={[styles.phaseDescription, styles.completedText]}>
        {mode === 'child'
          ? 'Harika! Deprem oyununu başarıyla tamamladın. Artık gerçek bir deprem kahramanısın! Kaplumbağa tekniğini mükemmel öğrendin.'
          : 'ÇÖK-KAPAN-TUTUN tekniğini başarıyla uyguladınız. Bu teknik hayat kurtarıcıdır. Düzenli pratik yaparak bu teknikleri pekiştirebilir ve ailenizle paylaşabilirsiniz.'}
      </Text>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={resetSimulation}
          activeOpacity={0.8}
          testID="reset-simulation-button"
        >
          <RotateCcw size={20} color={colors.textPrimary} />
          <Text style={[styles.buttonText, styles.secondaryButtonText]}>
            Tekrar Dene
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const getCardStyle = () => {
    if (currentPhase === 'completed') {
      return [styles.simulationCard, styles.completedCard];
    }
    return styles.simulationCard;
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {currentPhase === 'preparation' && (
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'adult' ? styles.modeButtonActive : styles.modeButtonInactive
              ]}
              onPress={() => setMode('adult')}
              activeOpacity={0.8}
              testID="adult-mode-button"
            >
              <Users size={20} color={mode === 'adult' ? 'white' : colors.textSecondary} />
              <Text style={[
                styles.modeButtonText,
                mode === 'adult' ? styles.modeButtonTextActive : styles.modeButtonTextInactive
              ]}>
                Yetişkin
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.modeButton,
                mode === 'child' ? styles.modeButtonActive : styles.modeButtonInactive
              ]}
              onPress={() => setMode('child')}
              activeOpacity={0.8}
              testID="child-mode-button"
            >
              <Baby size={20} color={mode === 'child' ? 'white' : colors.textSecondary} />
              <Text style={[
                styles.modeButtonText,
                mode === 'child' ? styles.modeButtonTextActive : styles.modeButtonTextInactive
              ]}>
                Çocuk
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <Animated.View style={[
          getCardStyle(),
          {
            opacity: fadeAnimation,
            transform: [
              { translateY: slideAnimation },
              { scale: mode === 'child' ? bounceAnimation : scaleAnimation }
            ]
          }
        ]}>
          {countdown > 0 && renderCountdown()}
          {currentPhase === 'preparation' && countdown === 0 && renderPreparation()}
          {isRunning && currentPhase !== 'preparation' && currentPhase !== 'completed' && renderSimulation()}
          {currentPhase === 'completed' && renderCompleted()}
        </Animated.View>
      </View>
    </View>
  );
}
