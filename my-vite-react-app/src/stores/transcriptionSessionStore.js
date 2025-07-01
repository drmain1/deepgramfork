import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

// HIPAA Compliant: This store does NOT persist any data to localStorage
// All patient information is kept in memory only and cleared on page refresh
const useTranscriptionSessionStore = create(
  subscribeWithSelector((set, get) => ({
    // Patient Information
    patientDetails: '',
    patientContext: '',
    selectedPatient: null,
    
    // Session Settings
    selectedLocation: '',
    selectedProfileId: '',
    isMultilingual: false,
    targetLanguage: '',
    
    // Recording Mode
    isDictationMode: false,
    dateOfService: '',
    
    // Evaluation Information
    evaluationType: '',
    initialEvaluationId: null,
    previousFindings: null,
    
    // UI State
    currentView: 'setup',
    error: null,
    
    // Actions - Patient Information
    setPatientDetails: (details) => set({ patientDetails: details }),
    setPatientContext: (context) => set({ patientContext: context }),
    setSelectedPatient: (patient) => set({ 
      selectedPatient: patient,
      // Clear evaluation type when patient changes
      evaluationType: '',
      initialEvaluationId: null,
      previousFindings: null
    }),
    
    // Actions - Session Settings
    setSelectedLocation: (location) => set({ selectedLocation: location }),
    setSelectedProfileId: (profileId) => set({ selectedProfileId: profileId }),
    setIsMultilingual: (isMultilingual) => set({ isMultilingual: isMultilingual }),
    setTargetLanguage: (language) => set({ targetLanguage: language }),
    
    // Actions - Recording Mode
    setIsDictationMode: (isDictation) => set({ 
      isDictationMode: isDictation,
      // Clear date of service when toggling off
      dateOfService: isDictation ? get().dateOfService : ''
    }),
    setDateOfService: (date) => set({ dateOfService: date }),
    
    // Actions - Evaluation
    setEvaluationType: (type) => set({ evaluationType: type }),
    setInitialEvaluationId: (id) => set({ initialEvaluationId: id }),
    setPreviousFindings: (findings) => set({ previousFindings: findings }),
    
    // Actions - UI State
    setCurrentView: (view) => set({ currentView: view }),
    setError: (error) => set({ error: error }),
    
    // Complex Actions
    updatePatientFromSelector: (patient) => {
      if (!patient) {
        set({
          selectedPatient: null,
          patientDetails: '',
          evaluationType: '',
          initialEvaluationId: null,
          previousFindings: null
        });
        return;
      }
      
      const patientName = `${patient.last_name}, ${patient.first_name}`;
      let context = get().patientContext;
      
      // Add DOB to context if not already present
      if (patient.date_of_birth && !context.includes('DOB:')) {
        const dobFormatted = new Date(patient.date_of_birth).toLocaleDateString();
        context = context ? `${context}\nDOB: ${dobFormatted}` : `DOB: ${dobFormatted}`;
      }
      
      // Add DOA to context if not already present
      if (patient.date_of_accident && !context.includes('DOA:')) {
        const doaFormatted = new Date(patient.date_of_accident).toLocaleDateString();
        context = context ? `${context}\nDOA: ${doaFormatted}` : `DOA: ${doaFormatted}`;
      }
      
      set({
        selectedPatient: patient,
        patientDetails: patientName,
        patientContext: context
      });
    },
    
    // Clear patient selection but keep other settings
    clearPatientSelection: () => set({
      selectedPatient: null,
      patientDetails: '',
      patientContext: '',
      evaluationType: '',
      initialEvaluationId: null,
      previousFindings: null,
      isDictationMode: false,
      dateOfService: ''
    }),
    
    // Reset entire session (for logout or new session)
    resetSession: () => set({
      patientDetails: '',
      patientContext: '',
      selectedPatient: null,
      selectedLocation: get().selectedLocation, // Keep location preference
      selectedProfileId: get().selectedProfileId, // Keep profile preference
      isMultilingual: false,
      targetLanguage: '',
      isDictationMode: false,
      dateOfService: '',
      evaluationType: '',
      initialEvaluationId: null,
      previousFindings: null,
      currentView: 'setup',
      error: null
    }),
    
    // Initialize settings (called when user settings load)
    initializeSettings: (userSettings) => {
      const state = get();
      const updates = {};
      
      // Set location if not already set
      if (!state.selectedLocation && userSettings.officeInformation?.length > 0) {
        updates.selectedLocation = userSettings.officeInformation[0];
      }
      
      // Set profile if not already set
      if (!state.selectedProfileId && userSettings.transcriptionProfiles) {
        const filteredProfiles = userSettings.transcriptionProfiles.filter(
          profile => profile.name !== 'Default/General summary'
        );
        if (filteredProfiles.length > 0) {
          const defaultProfile = filteredProfiles.find(p => p.isDefault) || filteredProfiles[0];
          if (defaultProfile) {
            updates.selectedProfileId = defaultProfile.id;
          }
        }
      }
      
      if (Object.keys(updates).length > 0) {
        set(updates);
      }
    }
  }))
);

// HIPAA Compliance: Clear all patient data on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    useTranscriptionSessionStore.getState().resetSession();
  });
}

export default useTranscriptionSessionStore;