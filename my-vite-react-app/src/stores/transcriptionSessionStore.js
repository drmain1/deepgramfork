import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { formatDateForDisplay } from '../utils/dateUtils';

// HIPAA Compliant: This store does NOT persist any data to localStorage
// All patient information is kept in memory only and cleared on page refresh
const useTranscriptionSessionStore = create(
  subscribeWithSelector((set, get) => ({
    // Patient Information
    patientDetails: '',
    patientContext: '',
    selectedPatientId: null,
    
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
    previousEvaluationId: null,
    previousFindings: null,
    includePreviousFindingsInPrompt: true, // Default to true for backwards compatibility
    
    // UI State
    currentView: 'setup',
    error: null,
    showPreviousFindingsSidebar: false,
    
    // Recording Session State
    sessionId: null,
    hasStreamedOnce: false,
    finalTranscript: '',
    currentInterimTranscript: '',
    isSessionSaved: false,
    saveStatusMessage: '',
    recordingStartTime: null,
    recordingDuration: 0,
    currentProfileId: null,
    showCloseConfirmation: false,
    
    // Actions - Patient Information
    setPatientDetails: (details) => set({ patientDetails: details }),
    setPatientContext: (context) => set({ patientContext: context }),
    setSelectedPatientId: (patientId) => set({ 
      selectedPatientId: patientId,
      // Clear evaluation type when patient changes
      evaluationType: '',
      initialEvaluationId: null,
      previousEvaluationId: null,
      previousFindings: null,
      includePreviousFindingsInPrompt: true // Reset to default
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
    setPreviousEvaluationId: (id) => set({ previousEvaluationId: id }),
    setPreviousFindings: (findings) => set({ 
      previousFindings: findings,
      // Automatically show sidebar when findings are loaded for re-evaluation
      showPreviousFindingsSidebar: findings && get().evaluationType === 're_evaluation' ? true : get().showPreviousFindingsSidebar
    }),
    
    // Actions - UI State
    setCurrentView: (view) => set({ currentView: view }),
    setError: (error) => set({ error: error }),
    setShowPreviousFindingsSidebar: (show) => set({ showPreviousFindingsSidebar: show }),
    setIncludePreviousFindingsInPrompt: (include) => set({ includePreviousFindingsInPrompt: include }),
    
    // Actions - Recording Session State
    setSessionId: (id) => set({ sessionId: id }),
    setHasStreamedOnce: (hasStreamed) => set({ hasStreamedOnce: hasStreamed }),
    setFinalTranscript: (transcript) => set({ finalTranscript: transcript }),
    setCurrentInterimTranscript: (transcript) => set({ currentInterimTranscript: transcript }),
    setIsSessionSaved: (saved) => set({ isSessionSaved: saved }),
    setSaveStatusMessage: (message) => set({ saveStatusMessage: message }),
    setRecordingStartTime: (time) => set({ recordingStartTime: time }),
    setRecordingDuration: (duration) => set({ recordingDuration: duration }),
    setCurrentProfileId: (id) => set({ currentProfileId: id }),
    setShowCloseConfirmation: (show) => set({ showCloseConfirmation: show }),
    
    // Combined transcript getter (computed property)
    getCombinedTranscript: () => {
      const state = get();
      return state.finalTranscript + state.currentInterimTranscript;
    },
    
    // Recording Session Management
    initializeRecording: (sessionId, profileId, resumeData = null) => set({
      sessionId,
      currentProfileId: profileId,
      hasStreamedOnce: !!resumeData,
      finalTranscript: resumeData?.savedTranscript || '',
      currentInterimTranscript: '',
      isSessionSaved: false,
      saveStatusMessage: '',
      recordingStartTime: Date.now(),
      recordingDuration: 0,
      showCloseConfirmation: false,
      error: null
    }),
    
    updateTranscript: (final, interim) => set((state) => ({
      finalTranscript: final !== undefined ? final : state.finalTranscript,
      currentInterimTranscript: interim !== undefined ? interim : state.currentInterimTranscript,
      hasStreamedOnce: true
    })),
    
    appendToFinalTranscript: (text) => set((state) => ({
      finalTranscript: state.finalTranscript ? state.finalTranscript + ' ' + text : text,
      currentInterimTranscript: ''
    })),
    
    markSessionSaved: () => set({ isSessionSaved: true }),
    
    // Complex Actions
    updatePatientFromSelector: (patient) => {
      if (!patient) {
        set({
          selectedPatientId: null,
          patientDetails: '',
          evaluationType: '',
          initialEvaluationId: null,
          previousEvaluationId: null,
          previousFindings: null
        });
        return;
      }
      
      const patientName = `${patient.last_name}, ${patient.first_name}`;
      let context = get().patientContext;
      
      // Add DOB to context if not already present
      if (patient.date_of_birth && !context.includes('DOB:')) {
        const dobFormatted = formatDateForDisplay(patient.date_of_birth);
        context = context ? `${context}\nDOB: ${dobFormatted}` : `DOB: ${dobFormatted}`;
      }
      
      // Add DOA to context if not already present
      if (patient.date_of_accident && !context.includes('DOA:')) {
        const doaFormatted = formatDateForDisplay(patient.date_of_accident);
        context = context ? `${context}\nDOA: ${doaFormatted}` : `DOA: ${doaFormatted}`;
      }
      
      set({
        selectedPatientId: patient.id,
        patientDetails: patientName,
        patientContext: context
      });
    },
    
    // Clear patient selection but keep other settings
    clearPatientSelection: () => set({
      selectedPatientId: null,
      patientDetails: '',
      patientContext: '',
      evaluationType: '',
      initialEvaluationId: null,
      previousEvaluationId: null,
      previousFindings: null,
      isDictationMode: false,
      dateOfService: ''
    }),
    
    // Clear recording session state
    clearRecordingSession: () => set({
      sessionId: null,
      hasStreamedOnce: false,
      finalTranscript: '',
      currentInterimTranscript: '',
      isSessionSaved: false,
      saveStatusMessage: '',
      recordingStartTime: null,
      recordingDuration: 0,
      currentProfileId: null,
      showCloseConfirmation: false
    }),
    
    // Reset entire session (for logout or new session)
    resetSession: () => set({
      patientDetails: '',
      patientContext: '',
      selectedPatientId: null,
      selectedLocation: get().selectedLocation, // Keep location preference
      selectedProfileId: get().selectedProfileId, // Keep profile preference
      isMultilingual: false,
      targetLanguage: '',
      isDictationMode: false,
      dateOfService: '',
      evaluationType: '',
      initialEvaluationId: null,
      previousEvaluationId: null,
      previousFindings: null,
      includePreviousFindingsInPrompt: true, // Reset to default
      currentView: 'setup',
      error: null,
      showPreviousFindingsSidebar: false,
      // Reset recording state
      sessionId: null,
      hasStreamedOnce: false,
      finalTranscript: '',
      currentInterimTranscript: '',
      isSessionSaved: false,
      saveStatusMessage: '',
      recordingStartTime: null,
      recordingDuration: 0,
      currentProfileId: null,
      showCloseConfirmation: false
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