import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { apiService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type EmergencyItem = {
  name: string;
  category: string;
  status: 'present' | 'missing' | 'expired';
  expiryDate?: string;
  recommendation?: string;
};

export type BagAnalysisResult = {
  overallScore: number;
  totalItems: number;
  presentItems: number;
  missingItems: number;
  expiredItems: number;
  items: EmergencyItem[];
  missingEssentials: string[];
  recommendations: string[];
};

export type EmergencyBagAnalysis = {
  id: string;
  overallScore: number;
  totalItems: number;
  presentItems: number;
  missingItems: number;
  expiredItems: number;
  createdAt: string;
  fullResult?: BagAnalysisResult;
  isCompleted: boolean;
};

export const [EmergencyBagProvider, useEmergencyBag] = createContextHook(() => {
  const { updateSafetyScores } = useAuth();
  const [analyses, setAnalyses] = useState<EmergencyBagAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<EmergencyBagAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAnalysesFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('emergency_bag_analyses');
      if (stored) {
        const loadedAnalyses: EmergencyBagAnalysis[] = JSON.parse(stored);
        setAnalyses(loadedAnalyses);
        
        // Find any incomplete analysis first
        const incompleteAnalysis = loadedAnalyses.find(a => !a.isCompleted);
        if (incompleteAnalysis) {
          setCurrentAnalysis(incompleteAnalysis);
        } else {
          // If no incomplete analysis, load the latest completed one
          const latestCompleted = loadedAnalyses.find(a => a.isCompleted);
          if (latestCompleted) {
            setCurrentAnalysis(latestCompleted);
          }
        }
      }
    } catch (error) {
      console.error('Error loading emergency bag analyses from storage:', error);
      try {
        await AsyncStorage.removeItem('emergency_bag_analyses');
        setAnalyses([]);
        setCurrentAnalysis(null);
      } catch (clearError) {
        console.error('Error clearing corrupted storage:', clearError);
      }
    }
  }, []);

  const savePrepCheckScoreToAPI = useCallback(async (score: number) => {
    try {
      await apiService.emergency.updatePrepCheckScore(score);

      // Update via AuthContext to refresh state immediately
      try {
        await updateSafetyScores(undefined, score);
      } catch (authError) {
        console.error('Error updating via AuthContext:', authError);
      }
    } catch (error) {
      console.error('Error saving PrepCheck score to API:', error);
      // Don't throw error, API saving is not critical
    }
  }, [updateSafetyScores]);

  const saveAnalysesToStorage = useCallback(async (analysesToSave: EmergencyBagAnalysis[]) => {
    try {
      // Keep only last 3 analyses to prevent storage issues
      const limitedAnalyses = analysesToSave.slice(0, 3);
      await AsyncStorage.setItem('emergency_bag_analyses', JSON.stringify(limitedAnalyses));
    } catch (error) {
      console.error('Error saving emergency bag analyses to storage:', error);
    }
  }, []);

  const initializeStorage = useCallback(async () => {
    try {
      await loadAnalysesFromStorage();
    } catch (error) {
      console.error('Storage initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAnalysesFromStorage]);

  useEffect(() => {
    initializeStorage();
  }, [initializeStorage]);

  const startNewAnalysis = useCallback(async (): Promise<string> => {
    const analysisId = `bag_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      const newAnalysis: EmergencyBagAnalysis = {
        id: analysisId,
        overallScore: 0,
        totalItems: 0,
        presentItems: 0,
        missingItems: 0,
        expiredItems: 0,
        createdAt: now,
        isCompleted: false,
      };

      const updatedAnalyses = [newAnalysis, ...analyses];
      setAnalyses(updatedAnalyses);
      await saveAnalysesToStorage(updatedAnalyses);

      setCurrentAnalysis(newAnalysis);
      return analysisId;
    } catch (error) {
      console.error('Error starting new analysis:', error);
      throw error;
    }
  }, [analyses, saveAnalysesToStorage]);

  const completeAnalysis = useCallback(async (analysisResult: {
    overallScore: number;
    totalItems: number;
    presentItems: number;
    missingItems: number;
    expiredItems: number;
  }, fullResult?: BagAnalysisResult, analysisId?: string): Promise<void> => {
    // Resolve target analysis either by provided ID or currentAnalysis
    const targetAnalysis = analysisId
      ? analyses.find(a => a.id === analysisId)
      : currentAnalysis;

    if (!targetAnalysis) {
      // Fallback: create a completed analysis entry so we don't lose results
      try {
        const fallbackId = analysisId || `bag_analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date().toISOString();
        const completedAnalysis: EmergencyBagAnalysis = {
          id: fallbackId,
          overallScore: analysisResult.overallScore,
          totalItems: analysisResult.totalItems,
          presentItems: analysisResult.presentItems,
          missingItems: analysisResult.missingItems,
          expiredItems: analysisResult.expiredItems,
          createdAt: now,
          fullResult: fullResult,
          isCompleted: true,
        };
        const updatedAnalyses = [completedAnalysis, ...analyses];
        setAnalyses(updatedAnalyses);
        setCurrentAnalysis(completedAnalysis);
        await saveAnalysesToStorage(updatedAnalyses);

        // Save score to API when fallback analysis is completed
        savePrepCheckScoreToAPI(Math.round(analysisResult.overallScore));
        return;
      } catch (fallbackError) {
        console.error('Fallback completeAnalysis failed:', fallbackError);
        throw new Error('No current analysis to complete');
      }
    }

    try {
      const completedAnalysis: EmergencyBagAnalysis = {
        ...targetAnalysis,
        overallScore: analysisResult.overallScore,
        totalItems: analysisResult.totalItems,
        presentItems: analysisResult.presentItems,
        missingItems: analysisResult.missingItems,
        expiredItems: analysisResult.expiredItems,
        fullResult: fullResult,
        isCompleted: true,
      };

      const updatedAnalyses = analyses.map(a => 
        a.id === targetAnalysis.id ? completedAnalysis : a
      );
      
      setAnalyses(updatedAnalyses);
      setCurrentAnalysis(completedAnalysis);
      await saveAnalysesToStorage(updatedAnalyses);

      // Save score to API when analysis is completed
      savePrepCheckScoreToAPI(Math.round(analysisResult.overallScore));
    } catch (error) {
      console.error('Error completing analysis:', error);
      throw error;
    }
  }, [currentAnalysis, analyses, saveAnalysesToStorage]);

  const getLatestScore = useCallback((): number => {
    const completedAnalyses = analyses.filter(a => a.isCompleted);
    if (completedAnalyses.length === 0) return 0;
    return Math.round(completedAnalyses[0].overallScore);
  }, [analyses]);

  const getLatestAnalysis = useCallback((): BagAnalysisResult | null => {
    const completedAnalyses = analyses.filter(a => a.isCompleted);
    if (completedAnalyses.length === 0 || !completedAnalyses[0].fullResult) return null;
    return completedAnalyses[0].fullResult;
  }, [analyses]);

  const getCompletedAnalyses = useCallback((): EmergencyBagAnalysis[] => {
    return analyses.filter(a => a.isCompleted);
  }, [analyses]);

  const hasAnalysis = useCallback((): boolean => {
    return analyses.filter(a => a.isCompleted).length > 0;
  }, [analyses]);

  const clearCurrentAnalysis = useCallback(async () => {
    setCurrentAnalysis(null);
    // Also clear any incomplete analyses from storage
    try {
      const updatedAnalyses = analyses.filter(a => a.isCompleted);
      await saveAnalysesToStorage(updatedAnalyses);
      setAnalyses(updatedAnalyses);
    } catch (error) {
      console.error('Error clearing incomplete analyses:', error);
    }
  }, [analyses, saveAnalysesToStorage]);

  const clearIncompleteAnalysis = useCallback(async () => {
    if (currentAnalysis && !currentAnalysis.isCompleted) {
      setCurrentAnalysis(null);
      try {
        const updatedAnalyses = analyses.filter(a => a.id !== currentAnalysis.id);
        await saveAnalysesToStorage(updatedAnalyses);
        setAnalyses(updatedAnalyses);
      } catch (error) {
        console.error('Error clearing incomplete analysis:', error);
      }
    }
  }, [currentAnalysis, analyses, saveAnalysesToStorage]);

  const resetToInitialState = useCallback(async () => {
    // Keep completed analyses in storage
    try {
      const completedAnalyses = analyses.filter(a => a.isCompleted);
      await saveAnalysesToStorage(completedAnalyses);
      setAnalyses(completedAnalyses);
      
      // Clear current analysis ONLY if navigation is from results
      // Otherwise keep the latest completed analysis as current
      if (completedAnalyses.length > 0) {
        setCurrentAnalysis(completedAnalyses[0]);
      } else {
        setCurrentAnalysis(null);
      }
    } catch (error) {
      console.error('Error resetting to initial state:', error);
    }
  }, [analyses, saveAnalysesToStorage]);

  const clearAllData = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('emergency_bag_analyses');
      setAnalyses([]);
      setCurrentAnalysis(null);
    } catch (error) {
      console.error('Error clearing all emergency bag data:', error);
    }
  }, []);

  const clearLatestAnalysis = useCallback(async () => {
    try {
      if (analyses.length > 0) {
        // Remove the full result from the latest analysis but keep the summary
        const updatedAnalyses = analyses.map((analysis, index) => {
          if (index === 0 && analysis.isCompleted) {
            // Clear fullResult from latest analysis
            return { ...analysis, fullResult: undefined };
          }
          return analysis;
        });
        setAnalyses(updatedAnalyses);
        await saveAnalysesToStorage(updatedAnalyses);
        
        // Also clear current analysis so PrepCheck intro shows next time
        setCurrentAnalysis(null);
      }
    } catch (error) {
      console.error('Error clearing latest analysis:', error);
    }
  }, [analyses, saveAnalysesToStorage]);

  const clearForNavigation = useCallback(async () => {
    // This clears current analysis completely for navigation
    setCurrentAnalysis(null);
  }, []);

  return useMemo(() => ({
    analyses,
    currentAnalysis,
    isLoading,
    startNewAnalysis,
    completeAnalysis,
    getLatestScore,
    getLatestAnalysis,
    getCompletedAnalyses,
    hasAnalysis,
    clearCurrentAnalysis,
    clearIncompleteAnalysis,
    resetToInitialState,
    clearAllData,
    clearLatestAnalysis,
    clearForNavigation,
  }), [
    analyses,
    currentAnalysis,
    isLoading,
    startNewAnalysis,
    completeAnalysis,
    getLatestScore,
    getLatestAnalysis,
    getCompletedAnalyses,
    hasAnalysis,
    clearCurrentAnalysis,
    clearIncompleteAnalysis,
    resetToInitialState,
    clearAllData,
    clearLatestAnalysis,
    clearForNavigation,
  ]);
});
