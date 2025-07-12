import { create } from 'zustand';
import { auth } from '../firebaseConfig';

const usePatientsStore = create((set, get) => ({
  patients: [],
  isLoading: false,
  lastFetchTime: null,
  CACHE_DURATION: 30000, // 30 seconds cache
  
  // Check if data is stale
  isDataStale: () => {
    const { lastFetchTime, CACHE_DURATION } = get();
    if (!lastFetchTime) return true;
    return Date.now() - lastFetchTime > CACHE_DURATION;
  },
  
  // Fetch patients with caching
  fetchPatients: async (forceRefresh = false) => {
    const { patients, isLoading, isDataStale } = get();
    
    // Return cached data if not stale and not forcing refresh
    if (!forceRefresh && !isDataStale() && patients.length > 0) {
      return patients;
    }
    
    // Prevent duplicate fetches
    if (isLoading) return patients;
    
    set({ isLoading: true });
    
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/v1/patients', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        set({ 
          patients: data, 
          lastFetchTime: Date.now(),
          isLoading: false 
        });
        return data;
      } else {
        console.error('Failed to fetch patients');
        set({ isLoading: false });
        return patients;
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      set({ isLoading: false });
      return patients;
    }
  },
  
  // Add a new patient to the store
  addPatient: (patient) => {
    set(state => ({
      patients: [...state.patients, patient]
    }));
  },
  
  // Update a patient in the store
  updatePatient: (patientId, updates) => {
    set(state => ({
      patients: state.patients.map(p => 
        p.id === patientId ? { ...p, ...updates } : p
      )
    }));
  },
  
  // Remove a patient from the store
  removePatient: (patientId) => {
    set(state => ({
      patients: state.patients.filter(p => p.id !== patientId)
    }));
  },
  
  // Clear cache
  clearCache: () => {
    set({ lastFetchTime: null });
  },
  
  // Get a patient by ID
  getPatientById: (patientId) => {
    const { patients } = get();
    return patients.find(p => p.id === patientId) || null;
  }
}));

export default usePatientsStore;