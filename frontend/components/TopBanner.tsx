import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';

type BannerType = 'success' | 'error';

interface TopBannerProps {
  visible: boolean;
  type: BannerType;
  message: string;
}

export default function TopBanner({ visible, type, message }: TopBannerProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (!visible) return null;

  const bgColor = type === 'success' ? '#10B981' : '#EF4444';
  const borderColor = type === 'success' ? '#059669' : '#DC2626';

  return (
    <View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          backgroundColor: bgColor,
          borderColor,
        },
      ]}
    >
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

