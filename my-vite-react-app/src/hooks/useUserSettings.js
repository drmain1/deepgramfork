import { useEffect } from 'react';
import useUserSettingsStore from '../stores/userSettingsStore';
import userSettingsService from '../services/userSettingsService';
import { useAuth } from '../contexts/FirebaseAuthContext';

// Custom hook that provides the same interface as the old UserSettingsContext
export const useUserSettings = () => {
  const { currentUser, getToken } = useAuth();
  
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

  // Initialize service with auth context
  useEffect(() => {
    if (currentUser && getToken) {
      userSettingsService.init(currentUser, getToken);
    }
  }, [currentUser, getToken]);

  // Load settings when auth state changes
  useEffect(() => {
    if (currentUser) {
      userSettingsService.fetchUserSettings();
    } else {
      useUserSettingsStore.getState().clearSettings();
    }
  }, [currentUser]);

  // Create userSettings object in the format expected by existing components
  const userSettings = {
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
  };

  return {
    // State (maintains same interface as old context)
    userSettings,
    settingsLoading,
    settingsError,
    
    // Methods (maintains same interface as old context)
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
  };
};

export default useUserSettings;