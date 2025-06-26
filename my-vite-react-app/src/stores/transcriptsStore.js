import { create } from 'zustand';
import { auth } from '../firebaseConfig';

const useTranscriptsStore = create((set, get) => ({
  transcriptsByPatient: {}, // { patientId: { transcripts: [], lastFetch: timestamp } }
  isLoading: false,
  CACHE_DURATION: 60000, // 60 seconds cache for transcripts
  
  // Check if data is stale for a specific patient
  isDataStale: (patientId) => {
    const { transcriptsByPatient, CACHE_DURATION } = get();
    const patientData = transcriptsByPatient[patientId];
    if (!patientData || !patientData.lastFetch) return true;
    return Date.now() - patientData.lastFetch > CACHE_DURATION;
  },
  
  // Fetch transcripts for a patient with caching
  fetchPatientTranscripts: async (patientId, forceRefresh = false) => {
    const { transcriptsByPatient, isLoading, isDataStale } = get();
    const patientData = transcriptsByPatient[patientId];
    
    // Return cached data if not stale and not forcing refresh
    if (!forceRefresh && !isDataStale(patientId) && patientData?.transcripts) {
      return patientData.transcripts;
    }
    
    // Prevent duplicate fetches
    if (isLoading) return patientData?.transcripts || [];
    
    set({ isLoading: true });
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch(`/api/v1/patients/${patientId}/transcripts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        set(state => ({
          transcriptsByPatient: {
            ...state.transcriptsByPatient,
            [patientId]: {
              transcripts: data,
              lastFetch: Date.now()
            }
          },
          isLoading: false
        }));
        return data;
      } else {
        console.error('Failed to fetch patient transcripts');
        set({ isLoading: false });
        return patientData?.transcripts || [];
      }
    } catch (error) {
      console.error('Error fetching patient transcripts:', error);
      set({ isLoading: false });
      return patientData?.transcripts || [];
    }
  },
  
  // Clear cache for a specific patient
  clearPatientCache: (patientId) => {
    set(state => ({
      transcriptsByPatient: {
        ...state.transcriptsByPatient,
        [patientId]: undefined
      }
    }));
  },
  
  // Clear all caches
  clearAllCaches: () => {
    set({ transcriptsByPatient: {} });
  }
}));

export default useTranscriptsStore;