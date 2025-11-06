import React from 'react';
import { ViewStyle } from 'react-native';

type RequirePWAProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

// No-op wrapper: previously enforced PWA-only on web.
// Now allows running in both Web and PWA without redirects.
export default function RequirePWA({ children }: RequirePWAProps) {
  return <>{children}</>;
}

