import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';

interface NavigationBlockerContextType {
  isBlocked: boolean;
  blockNavigation: () => void;
  unblockNavigation: () => void;
}

const NavigationBlockerContext = createContext<NavigationBlockerContextType | undefined>(undefined);

export function NavigationBlockerProvider({ children }: { children: React.ReactNode }) {
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockerCount, setBlockerCount] = useState(0);

  const blockNavigation = useCallback(() => {
    setBlockerCount(prev => prev + 1);
    setIsBlocked(true);
  }, []);

  const unblockNavigation = useCallback(() => {
    setBlockerCount(prev => {
      const newCount = Math.max(0, prev - 1);
      if (newCount === 0) {
        setIsBlocked(false);
      }
      return newCount;
    });
  }, []);

  useEffect(() => {
    // Only run on web platform
    if (Platform.OS !== 'web') {
      return;
    }

    if (!isBlocked) {
      return;
    }

    // Prevent browser back button
    const handlePopState = (event: PopStateEvent) => {
      if (isBlocked) {
        // Push a new state to prevent going back
        window.history.pushState(null, '', window.location.href);

        // Show warning
        alert('Analiz devam ediyor. Lütfen analiz tamamlanana kadar bekleyin.');
      }
    };

    // Prevent page unload/refresh
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isBlocked) {
        event.preventDefault();
        event.returnValue = 'Analiz devam ediyor. Sayfadan çıkmak istediğinize emin misiniz?';
        return event.returnValue;
      }
    };

    // Add an initial state to history
    window.history.pushState(null, '', window.location.href);

    // Add event listeners
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isBlocked]);

  return (
    <NavigationBlockerContext.Provider value={{ isBlocked, blockNavigation, unblockNavigation }}>
      {children}
    </NavigationBlockerContext.Provider>
  );
}

export function useNavigationBlocker() {
  const context = useContext(NavigationBlockerContext);
  if (context === undefined) {
    throw new Error('useNavigationBlocker must be used within a NavigationBlockerProvider');
  }
  return context;
}

/**
 * Hook to automatically block navigation when a condition is met
 * Usage: useNavigationBlock(isAnalyzing)
 */
export function useNavigationBlock(shouldBlock: boolean) {
  const { blockNavigation, unblockNavigation } = useNavigationBlocker();

  useEffect(() => {
    if (shouldBlock) {
      blockNavigation();
      return () => {
        unblockNavigation();
      };
    }
  }, [shouldBlock, blockNavigation, unblockNavigation]);
}
