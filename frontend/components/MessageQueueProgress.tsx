import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Send, X, MessageCircle, MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface MessageQueueProgressProps {
  visible: boolean;
  currentIndex: number;
  totalCount: number;
  currentMemberName: string;
  currentPhoneNumber: string;
  platform: 'whatsapp' | 'sms';
  onNext: () => void;
  onCancel: () => void;
  isFirst: boolean;
  isCompleted: boolean;
}

export default function MessageQueueProgress({
  visible,
  currentIndex,
  totalCount,
  currentMemberName,
  currentPhoneNumber,
  platform,
  onNext,
  onCancel,
  isFirst,
  isCompleted,
}: MessageQueueProgressProps) {
  const { colors } = useTheme();

  const platformText = platform === 'whatsapp' ? 'WhatsApp' : 'SMS';
  const PlatformIcon = platform === 'whatsapp' ? MessageCircle : MessageSquare;
  const buttonText = isFirst ? 'Başla' : 'Sonraki Kişiye Geç';
  const instructionText = isFirst
    ? `${platformText} ${Platform.OS === 'web' ? (platform === 'whatsapp' ? 'Web açılacak' : 'uygulaması açılacak') : 'uygulaması açılacak'}.\nLütfen mesajı gönderin ve bu pencereye geri dönün.`
    : `Mesajı gönderdiyseniz, bir sonraki kişiye geçmek için aşağıdaki butona basın.`;

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    container: {
      backgroundColor: colors.cardBackground,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 400,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 10,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.textPrimary,
      flex: 1,
    },
    closeButton: {
      padding: 4,
    },
    progressContainer: {
      marginBottom: 20,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.border,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 8,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 4,
    },
    progressText: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    memberCard: {
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 2,
      borderColor: colors.primary,
    },
    instructionBox: {
      backgroundColor: colors.primary + '10',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.primary + '50',
    },
    instructionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    instructionTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: 0.2,
    },
    memberHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
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
    memberInfo: {
      flex: 1,
    },
    memberName: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textPrimary,
      marginBottom: 4,
    },
    memberPhone: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    instruction: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      textAlign: 'center',
    },
    buttonContainer: {
      marginTop: 20,
    },
    nextButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 4,
    },
    nextButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: 'bold',
    },
    cancelButton: {
      marginTop: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    successContainer: {
      alignItems: 'center',
      paddingVertical: 20,
    },
    successIcon: {
      marginBottom: 20,
    },
    successTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#10B981',
      marginBottom: 12,
      textAlign: 'center',
    },
    successMessage: {
      fontSize: 16,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: 24,
      lineHeight: 24,
    },
    closeButton2: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    closeButtonText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '600',
    },
  });

  if (!visible) return null;

  const progress = ((currentIndex + 1) / totalCount) * 100;

  // Completion screen
  if (isCompleted) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onCancel}
      >
        <View style={styles.overlay}>
          <View style={styles.container}>
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <CheckCircle size={64} color="#10B981" />
              </View>
              <Text style={styles.successTitle}>Tamamlandı!</Text>
              <Text style={styles.successMessage}>
                {totalCount} kişi için mesaj gönderimi başarıyla tamamlandı.
                {'\n\n'}
                Lütfen {platformText} üzerinden mesajların gönderildiğini kontrol edin.
              </Text>
              <TouchableOpacity
                style={styles.closeButton2}
                onPress={onCancel}
                testID="close-success-button"
              >
                <Text style={styles.closeButtonText}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>Mesaj Gönderimi</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onCancel}
              testID="cancel-queue-button"
            >
              <X size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressText}>
              {currentIndex + 1} / {totalCount} kişi
            </Text>
          </View>

          <View style={styles.memberCard}>
            <View style={styles.memberHeader}>
              <View style={styles.iconContainer}>
                <PlatformIcon size={24} color={colors.primary} />
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{currentMemberName}</Text>
                <Text style={styles.memberPhone}>{currentPhoneNumber}</Text>
              </View>
            </View>
            <View style={styles.instructionBox}>
              <View style={{ alignItems: 'center', marginBottom: 6 }}>
                <AlertTriangle size={18} color={colors.primary} />
              </View>
              <Text style={styles.instruction}>{instructionText}</Text>
            </View>
          </View>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.nextButton}
              onPress={onNext}
              testID="next-message-button"
              activeOpacity={0.8}
            >
              <Send size={20} color="white" />
              <Text style={styles.nextButtonText}>{buttonText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              testID="cancel-button"
            >
              <Text style={styles.cancelButtonText}>İptal Et</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
