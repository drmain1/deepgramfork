import { useEffect, useMemo, useCallback, useRef } from 'react';
import useUserSettingsStore from '../stores/userSettingsStore';
import userSettingsService from '../services/userSettingsService';
import { useAuth } from '../contexts/FirebaseAuthContext';

// Custom hook that provides the same interface as the old UserSettingsContext
export const useUserSettings = () => {
  const { currentUser, getToken } = useAuth();
  const initRef = useRef(false);
  
  // Subscribe to store state
  const {
    doctorInfo,
    officeInformation,
    transcriptionProfiles,
    macroPhrases,
    customVocabulary,
    customBillingRules,
    cptFees,
    loading: settingsLoading,
    error: settingsError,
  } = useUserSettingsStore();

  // Initialize service with auth context (only once)
  useEffect(() => {
    if (currentUser && getToken && !initRef.current) {
      userSettingsService.init(currentUser, getToken);
      initRef.current = true;
    }
  }, [currentUser, getToken]);

  // Load settings when auth state changes (prevent multiple calls)
  useEffect(() => {
    if (currentUser && initRef.current) {
      userSettingsService.fetchUserSettings();
    } else if (!currentUser) {
      useUserSettingsStore.getState().clearSettings();
      initRef.current = false;
    }
  }, [currentUser]);

  // Memoize userSettings object to prevent unnecessary re-renders
  const userSettings = useMemo(() => ({
    doctorName: doctorInfo.doctorName,
    doctorSignature: doctorInfo.doctorSignature,
    clinicLogo: doctorInfo.clinicLogo,
    includeLogoOnPdf: doctorInfo.includeLogoOnPdf,
    medicalSpecialty: doctorInfo.medicalSpecialty,
    officeInformation,
    transcriptionProfiles,
    macroPhrases,
    customVocabulary,
    customBillingRules,
    cptFees,
  }), [
    doctorInfo.doctorName,
    doctorInfo.doctorSignature,
    doctorInfo.clinicLogo,
    doctorInfo.includeLogoOnPdf,
    doctorInfo.medicalSpecialty,
    officeInformation,
    transcriptionProfiles,
    macroPhrases,
    customVocabulary,
    customBillingRules,
    cptFees,
  ]);

  // Memoize service methods to prevent unnecessary re-creation
  const methods = useMemo(() => ({
    fetchUserSettings: userSettingsService.fetchUserSettings.bind(userSettingsService),
    saveUserSettings: userSettingsService.saveUserSettings.bind(userSettingsService),
    updateOfficeInformation: userSettingsService.updateOfficeInformation.bind(userSettingsService),
    updateTranscriptionProfiles: userSettingsService.updateTranscriptionProfiles.bind(userSettingsService),
    updateCustomVocabulary: userSettingsService.updateCustomVocabulary.bind(userSettingsService),
    updateMacroPhrases: userSettingsService.updateMacroPhrases.bind(userSettingsService),
    updateDoctorInformation: userSettingsService.updateDoctorInformation.bind(userSettingsService),
    updateMedicalSpecialty: userSettingsService.updateMedicalSpecialty.bind(userSettingsService),
    updateCustomBillingRules: userSettingsService.updateCustomBillingRules.bind(userSettingsService),
    updateCptFees: userSettingsService.updateCptFees.bind(userSettingsService),
  }), []);

  return useMemo(() => ({
    // State (maintains same interface as old context)
    userSettings,
    settingsLoading,
    settingsError,
    
    // Methods (maintains same interface as old context)
    ...methods,
  }), [userSettings, settingsLoading, settingsError, methods]);
};

export default useUserSettings;