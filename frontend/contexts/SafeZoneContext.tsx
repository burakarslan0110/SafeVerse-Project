import { useEffect, useState, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { apiService } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type RoomType = {
  id: string;
  name: string;
  imageUri: string;
  safetyScore: number;
  analysisResult: AnalysisResult;
  createdAt: string;
};

export type SafeZoneAssessment = {
  id: string;
  totalRooms: number;
  completedRooms: number;
  overallScore: number;
  rooms: RoomType[];
  createdAt: string;
  updatedAt: string;
};

export type AnalysisResult = {
  overallSafety: 'safe' | 'moderate' | 'dangerous';
  safetyScore: number;
  safeZones?: string[];
  risks: {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    recommendation: string;
  }[];
  strengths: string[];
  actionItems?: string[];
};

export const [SafeZoneProvider, useSafeZone] = createContextHook(() => {
  const { updateSafetyScores } = useAuth();
  const [assessments, setAssessments] = useState<SafeZoneAssessment[]>([]);
  const [currentAssessment, setCurrentAssessment] = useState<SafeZoneAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadAssessmentsFromStorage = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem('safezone_assessments');
      if (stored) {
        const loadedAssessments: SafeZoneAssessment[] = JSON.parse(stored);
        setAssessments(loadedAssessments);
        
        const incompleteAssessment = loadedAssessments.find(
          a => a.completedRooms < a.totalRooms
        );
        if (incompleteAssessment) {
          setCurrentAssessment(incompleteAssessment);
        }
      }
    } catch (error) {
      console.error('Error loading assessments from storage:', error);
      // If there's a storage error, clear it and start fresh
      try {
        await AsyncStorage.removeItem('safezone_assessments');
        setAssessments([]);
        setCurrentAssessment(null);
      } catch (clearError) {
        console.error('Error clearing corrupted storage:', clearError);
      }
    }
  }, []);



  const saveSafetyScoreToAPI = useCallback(async (score: number) => {
    try {
      await apiService.safety.updateSafeZoneScore(score);
      // Update via AuthContext to refresh state immediately
      try {
        await updateSafetyScores(score, undefined);
      } catch (authError) {
        console.error('Error updating via AuthContext:', authError);
      }
    } catch (error) {
      console.error('Error saving SafeZone score to API:', error);
      // Don't throw error, API saving is not critical
    }
  }, [updateSafetyScores]);

  const saveAssessmentsToStorage = useCallback(async (assessmentsToSave: SafeZoneAssessment[]) => {
    try {
      if (!assessmentsToSave || !Array.isArray(assessmentsToSave)) {
        console.error('Invalid assessments data');
        return;
      }
      
      // Limit storage to prevent database full errors - keep only last 3 assessments
      const limitedAssessments = assessmentsToSave.slice(0, 3);
      
      // Clean up data to reduce size - completely remove images and limit analysis data
      const cleanedAssessments = limitedAssessments.map(assessment => ({
        id: assessment.id,
        totalRooms: assessment.totalRooms,
        completedRooms: assessment.completedRooms,
        overallScore: assessment.overallScore,
        createdAt: assessment.createdAt,
        updatedAt: assessment.updatedAt,
        rooms: assessment.rooms.map(room => ({
          id: room.id,
          name: room.name,
          imageUri: '', // Never store image URIs
          safetyScore: room.safetyScore,
          createdAt: room.createdAt,
          analysisResult: {
            overallSafety: room.analysisResult.overallSafety,
            safetyScore: room.analysisResult.safetyScore,
            // Store only essential analysis data with strict limits
            risks: room.analysisResult.risks?.slice(0, 2).map(risk => ({
              type: risk.type?.substring(0, 50) || '',
              severity: risk.severity,
              description: risk.description?.substring(0, 100) || '',
              recommendation: risk.recommendation?.substring(0, 100) || ''
            })) || [],
            strengths: room.analysisResult.strengths?.slice(0, 2).map(s => s?.substring(0, 80) || '') || [],
            safeZones: room.analysisResult.safeZones?.slice(0, 2).map(s => s?.substring(0, 80) || '') || [],
            actionItems: room.analysisResult.actionItems?.slice(0, 2).map(s => s?.substring(0, 80) || '') || []
          }
        }))
      }));
      
      // Check data size before saving
      const dataString = JSON.stringify(cleanedAssessments);
      const dataSizeKB = (dataString.length * 2) / 1024;
      
      // If data is still too large, keep only the most recent assessment
      if (dataSizeKB > 200) { // Reduced to 200KB limit
        const mostRecentOnly = cleanedAssessments.slice(0, 1);
        await AsyncStorage.setItem('safezone_assessments', JSON.stringify(mostRecentOnly));
      } else {
        await AsyncStorage.setItem('safezone_assessments', JSON.stringify(cleanedAssessments));
      }
    } catch (error) {
      console.error('Error saving assessments to storage:', error);
      // Try to clear storage if it's full
      try {
        await AsyncStorage.removeItem('safezone_assessments');
      } catch (clearError) {
        console.error('Error clearing storage:', clearError);
      }
    }
  }, []);

  const initializeStorage = useCallback(async () => {
    try {
      await loadAssessmentsFromStorage();
    } catch (error) {
      console.error('Storage initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadAssessmentsFromStorage]);

  useEffect(() => {
    initializeStorage();
  }, [initializeStorage]);

  const startNewAssessment = useCallback(async (totalRooms: number): Promise<string> => {
    const assessmentId = `assessment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      const newAssessment: SafeZoneAssessment = {
        id: assessmentId,
        totalRooms,
        completedRooms: 0,
        overallScore: 0,
        rooms: [],
        createdAt: now,
        updatedAt: now,
      };

      const updatedAssessments = [newAssessment, ...assessments];
      setAssessments(updatedAssessments);
      await saveAssessmentsToStorage(updatedAssessments);

      setCurrentAssessment(newAssessment);
      return assessmentId;
    } catch (error) {
      console.error('Error starting new assessment:', error);
      throw error;
    }
  }, [assessments, saveAssessmentsToStorage]);

  const addRoomAnalysis = useCallback(async (
    assessmentId: string,
    roomName: string,
    imageUri: string,
    analysisResult: AnalysisResult
  ): Promise<void> => {
    if (!analysisResult || typeof analysisResult.safetyScore !== 'number') {
      throw new Error('Invalid analysis result');
    }
    if (!roomName.trim() || roomName.length > 50) {
      throw new Error('Room name too long');
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    try {
      const newRoom: RoomType = {
        id: roomId,
        name: roomName.trim(),
        imageUri: '', // Never store image URI
        safetyScore: analysisResult.safetyScore,
        analysisResult,
        createdAt: now,
      };

      let updatedAssessments: SafeZoneAssessment[] = [];

      setAssessments(prev => {
        const assessment = prev.find(a => a.id === assessmentId);
        if (assessment) {
          const updatedRooms = [...assessment.rooms, newRoom];
          const completedRooms = updatedRooms.length;
          const overallScore = updatedRooms.reduce((sum, room) => sum + room.safetyScore, 0) / completedRooms;

          const updatedAssessment: SafeZoneAssessment = {
            ...assessment,
            completedRooms,
            overallScore,
            rooms: updatedRooms,
            updatedAt: now,
          };

          setCurrentAssessment(updatedAssessment);
          updatedAssessments = prev.map(a => a.id === assessmentId ? updatedAssessment : a);

          // Save score to API when assessment is updated
          saveSafetyScoreToAPI(Math.round(overallScore));

          return updatedAssessments;
        }
        return prev;
      });

      // Save to storage with error handling
      try {
        await saveAssessmentsToStorage(updatedAssessments);
      } catch (storageError) {
        console.error('Storage error, continuing without saving:', storageError);
        // Continue execution even if storage fails
      }
    } catch (error) {
      console.error('Error adding room analysis:', error);
      throw error;
    }
  }, [saveAssessmentsToStorage]);

  const getOverallSafetyScore = useCallback((): number => {
    if (assessments.length === 0) return 0;
    const latestAssessment = assessments[0];
    return Math.round(latestAssessment.overallScore);
  }, [assessments]);

  const getRoomProgress = useCallback((): { completed: number; total: number } => {
    if (!currentAssessment) return { completed: 0, total: 0 };
    return {
      completed: currentAssessment.completedRooms,
      total: currentAssessment.totalRooms,
    };
  }, [currentAssessment]);

  const clearCurrentAssessment = useCallback(async () => {
    setCurrentAssessment(null);
    // Also clear any incomplete assessments from storage
    try {
      const updatedAssessments = assessments.filter(a => a.completedRooms >= a.totalRooms);
      await saveAssessmentsToStorage(updatedAssessments);
      setAssessments(updatedAssessments);
    } catch (error) {
      console.error('Error clearing incomplete assessments:', error);
    }
  }, [assessments, saveAssessmentsToStorage]);

  const clearIncompleteAssessment = useCallback(async () => {
    if (currentAssessment && currentAssessment.completedRooms === 0) {
      // Only clear if no rooms have been analyzed yet
      setCurrentAssessment(null);
      try {
        const updatedAssessments = assessments.filter(a => a.id !== currentAssessment.id);
        await saveAssessmentsToStorage(updatedAssessments);
        setAssessments(updatedAssessments);
      } catch (error) {
        console.error('Error clearing incomplete assessment:', error);
      }
    }
  }, [currentAssessment, assessments, saveAssessmentsToStorage]);

  const resetToInitialState = useCallback(async () => {
    setCurrentAssessment(null);
    // Keep completed assessments but clear current assessment
    try {
      const completedAssessments = assessments.filter(a => a.completedRooms >= a.totalRooms);
      await saveAssessmentsToStorage(completedAssessments);
      setAssessments(completedAssessments);
    } catch (error) {
      console.error('Error resetting to initial state:', error);
    }
  }, [assessments, saveAssessmentsToStorage]);

  const clearAllData = useCallback(async () => {
    try {
      await AsyncStorage.removeItem('safezone_assessments');
      setAssessments([]);
      setCurrentAssessment(null);
    } catch (error) {
      console.error('Error clearing all data:', error);
    }
  }, []);

  return useMemo(() => ({
    assessments,
    currentAssessment,
    isLoading,
    startNewAssessment,
    addRoomAnalysis,
    getOverallSafetyScore,
    getRoomProgress,
    clearCurrentAssessment,
    clearIncompleteAssessment,
    resetToInitialState,
    clearAllData,
  }), [
    assessments,
    currentAssessment,
    isLoading,
    startNewAssessment,
    addRoomAnalysis,
    getOverallSafetyScore,
    getRoomProgress,
    clearCurrentAssessment,
    clearIncompleteAssessment,
    resetToInitialState,
    clearAllData,
  ]);
});
