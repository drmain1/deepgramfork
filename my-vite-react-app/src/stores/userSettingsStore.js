import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

const useUserSettingsStore = create(
  subscribeWithSelector((set, get) => ({
    // State
    doctorInfo: {
      doctorName: '',
      doctorSignature: null,
      clinicLogo: null,
      includeLogoOnPdf: false,
      medicalSpecialty: '',
    },
    officeInformation: [],
    transcriptionProfiles: [],
    macroPhrases: [],
    customVocabulary: [],
    customBillingRules: '',
    cptFees: {},
    
    // Loading and error states
    loading: false,
    error: null,
    
    // Actions
    setLoading: (loading) => set({ loading }),
    setError: (error) => set({ error }),
    
    // Initialize store with user settings from API
    initializeSettings: (settings) => {
      console.log('userSettingsStore: initializeSettings called with:', settings);
      const currentState = get();
      
      // Only update if settings actually changed to prevent unnecessary re-renders
      const newDoctorInfo = {
        doctorName: settings.doctorName || '',
        doctorSignature: settings.doctorSignature || null,
        clinicLogo: settings.clinicLogo || null,
        includeLogoOnPdf: settings.includeLogoOnPdf || false,
        medicalSpecialty: settings.medicalSpecialty || '',
      };
      
      const hasChanged = (
        JSON.stringify(currentState.doctorInfo) !== JSON.stringify(newDoctorInfo) ||
        JSON.stringify(currentState.officeInformation) !== JSON.stringify(settings.officeInformation || []) ||
        JSON.stringify(currentState.transcriptionProfiles) !== JSON.stringify(settings.transcriptionProfiles || []) ||
        JSON.stringify(currentState.macroPhrases) !== JSON.stringify(settings.macroPhrases || []) ||
        JSON.stringify(currentState.customVocabulary) !== JSON.stringify(settings.customVocabulary || []) ||
        currentState.customBillingRules !== (settings.customBillingRules || '') ||
        JSON.stringify(currentState.cptFees) !== JSON.stringify(settings.cptFees || {})
      );
      
      if (!hasChanged && !currentState.loading) {
        console.log('userSettingsStore: No changes detected, skipping update');
        return;
      }
      
      console.log('userSettingsStore: Settings changed, updating store');
      set({
        doctorInfo: newDoctorInfo,
        officeInformation: settings.officeInformation || [],
        transcriptionProfiles: settings.transcriptionProfiles || [],
        macroPhrases: settings.macroPhrases || [],
        customVocabulary: settings.customVocabulary || [],
        customBillingRules: settings.customBillingRules || '',
        cptFees: settings.cptFees || {},
        loading: false,
        error: null,
      });
    },
    
    // Individual update methods
    updateDoctorInfo: (info) => set((state) => ({
      doctorInfo: { ...state.doctorInfo, ...info }
    })),
    
    updateOfficeInformation: (officeInfo) => set({ officeInformation: officeInfo }),
    
    updateTranscriptionProfiles: (profiles) => set({ transcriptionProfiles: profiles }),
    
    updateMacroPhrases: (phrases) => set({ macroPhrases: phrases }),
    
    updateCustomVocabulary: (vocabulary) => set({ customVocabulary: vocabulary }),
    
    updateCustomBillingRules: (rules) => set({ customBillingRules: rules }),
    
    updateCptFees: (fees) => set({ cptFees: fees }),
    
    // Batch update for settings page
    updateAllSettings: (settings) => set({
      doctorInfo: {
        doctorName: settings.doctorName || get().doctorInfo.doctorName,
        doctorSignature: settings.doctorSignature !== undefined ? settings.doctorSignature : get().doctorInfo.doctorSignature,
        clinicLogo: settings.clinicLogo !== undefined ? settings.clinicLogo : get().doctorInfo.clinicLogo,
        includeLogoOnPdf: settings.includeLogoOnPdf !== undefined ? settings.includeLogoOnPdf : get().doctorInfo.includeLogoOnPdf,
        medicalSpecialty: settings.medicalSpecialty !== undefined ? settings.medicalSpecialty : get().doctorInfo.medicalSpecialty,
      },
      officeInformation: settings.officeInformation !== undefined ? settings.officeInformation : get().officeInformation,
      transcriptionProfiles: settings.transcriptionProfiles !== undefined ? settings.transcriptionProfiles : get().transcriptionProfiles,
      macroPhrases: settings.macroPhrases !== undefined ? settings.macroPhrases : get().macroPhrases,
      customVocabulary: settings.customVocabulary !== undefined ? settings.customVocabulary : get().customVocabulary,
      customBillingRules: settings.customBillingRules !== undefined ? settings.customBillingRules : get().customBillingRules,
      cptFees: settings.cptFees !== undefined ? settings.cptFees : get().cptFees,
    }),
    
    // Get settings in the format expected by the API
    getSettingsForAPI: () => {
      const state = get();
      return {
        doctorName: state.doctorInfo.doctorName,
        doctorSignature: state.doctorInfo.doctorSignature,
        clinicLogo: state.doctorInfo.clinicLogo,
        includeLogoOnPdf: state.doctorInfo.includeLogoOnPdf,
        medicalSpecialty: state.doctorInfo.medicalSpecialty,
        officeInformation: state.officeInformation,
        transcriptionProfiles: state.transcriptionProfiles,
        macroPhrases: state.macroPhrases,
        customVocabulary: state.customVocabulary,
        customBillingRules: state.customBillingRules,
        cptFees: state.cptFees,
      };
    },
    
    // Clear all settings (for logout)
    clearSettings: () => set({
      doctorInfo: {
        doctorName: '',
        doctorSignature: null,
        clinicLogo: null,
        includeLogoOnPdf: false,
        medicalSpecialty: '',
      },
      officeInformation: [],
      transcriptionProfiles: [],
      macroPhrases: [],
      customVocabulary: [],
      customBillingRules: '',
      cptFees: {},
      loading: false,
      error: null,
    }),
  }))
);

export default useUserSettingsStore;