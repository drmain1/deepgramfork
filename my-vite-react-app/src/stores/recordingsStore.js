import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';

// Custom storage that excludes PHI (Protected Health Information)
const secureStorage = {
  getItem: (name) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    
    try {
      const data = JSON.parse(str);
      // Return only non-PHI data (IDs and statuses)
      return JSON.stringify({
        recordingMetadata: data.recordingMetadata || {},
        lastSync: data.lastSync
      });
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      const state = JSON.parse(value);
      // Store only non-PHI metadata
      const secureData = {
        recordingMetadata: state.recordingMetadata || {},
        lastSync: new Date().toISOString()
      };
      localStorage.setItem(name, JSON.stringify(secureData));
    } catch (error) {
      console.error('Error saving to secure storage:', error);
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
  }
};

const useRecordingsStore = create(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // State
        recordings: [],
        recordingMetadata: {}, // Only stores { id: { status, lastUpdated } }
        patientNameCache: {}, // In-memory only, never persisted
        isLoading: false,
        isFetchingRecordings: false,
        error: null,
        selectedRecordingId: null,
        originalTranscriptContent: null,
        polishedTranscriptContent: null,
        isLoadingSelectedTranscript: false,
        selectedTranscriptError: null,

        // Actions
        setRecordings: (recordings) => set({ recordings }),
        
        setLoading: (isLoading) => set({ isLoading }),
        
        setError: (error) => set({ error }),

        // Initialize store on mount
        initialize: async (currentUser, getToken) => {
          if (!currentUser?.uid) return;
          
          const { recordingMetadata } = get();
          
          // Set initial loading state with metadata statuses
          if (Object.keys(recordingMetadata).length > 0) {
            set({ 
              recordings: Object.entries(recordingMetadata).map(([id, meta]) => ({
                id,
                name: `Loading...`,
                status: meta.status,
                date: meta.lastUpdated,
                lastUpdated: meta.lastUpdated
              }))
            });
          }
          
          // Fetch full data from backend
          await get().fetchUserRecordings(currentUser, getToken);
        },

        // Fetch recordings from backend
        fetchUserRecordings: async (currentUser, getToken) => {
          if (!currentUser?.uid || get().isFetchingRecordings) return;
          
          set({ isFetchingRecordings: true });
          
          try {
            const accessToken = await getToken();
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            const response = await fetch(`${API_BASE_URL}/api/v1/user_recordings/${currentUser.uid}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch recordings.' }));
              throw new Error(errorData.detail || `Server error: ${response.status}`);
            }
            
            const fetchedRecordings = await response.json();
            console.log("Fetched recordings from backend:", fetchedRecordings.length);
            
            // Merge with local state
            get().mergeRecordings(fetchedRecordings);
            
          } catch (error) {
            console.error("Error fetching recordings:", error);
            set({ error: error.message });
          } finally {
            set({ isFetchingRecordings: false });
          }
        },

        // Complex merge logic from RecordingsContext
        mergeRecordings: (backendRecordings) => {
          const { recordings: localRecordings, patientNameCache } = get();
          const gcsMap = new Map(backendRecordings.map(r => [r.id, { ...r }]));
          const merged = [];
          const newMetadata = {};
          
          // First, handle local recordings
          localRecordings.forEach(localRec => {
            const gcsVersion = gcsMap.get(localRec.id);
            if (gcsVersion) {
              // Preserve patient names logic
              const localHasRealName = localRec.name && 
                !localRec.name.startsWith('Transcript ') && 
                !localRec.name.startsWith('Session ') &&
                !localRec.name.startsWith('Tx @ ');
              const gcsHasTimestampName = gcsVersion.name && 
                (gcsVersion.name.startsWith('Transcript ') || 
                 gcsVersion.name.startsWith('Session ') ||
                 gcsVersion.name.startsWith('Tx @ '));
              
              if (localHasRealName && gcsHasTimestampName) {
                let patientName = localRec.name;
                if (patientName.startsWith('Processing: ')) {
                  patientName = patientName.substring('Processing: '.length);
                } else if (patientName.startsWith('Failed: ')) {
                  patientName = patientName.substring('Failed: '.length);
                }
                gcsVersion.name = patientName;
                patientNameCache[localRec.id] = patientName;
              } else if (gcsHasTimestampName && patientNameCache[localRec.id]) {
                gcsVersion.name = patientNameCache[localRec.id];
              }
              
              merged.push(gcsVersion);
              newMetadata[gcsVersion.id] = {
                status: gcsVersion.status || 'saved',
                lastUpdated: gcsVersion.date || new Date().toISOString()
              };
              gcsMap.delete(localRec.id);
            } else {
              // Keep local-only recordings if recent
              if (localRec.status !== 'pending' || 
                  (Date.now() - new Date(localRec.lastUpdated || localRec.date).getTime() < 60000)) {
                merged.push(localRec);
                newMetadata[localRec.id] = {
                  status: localRec.status,
                  lastUpdated: localRec.lastUpdated || localRec.date
                };
              }
            }
          });
          
          // Add remaining backend recordings
          gcsMap.forEach((gcsRec) => {
            if (gcsRec.name && gcsRec.name.startsWith('Transcript ') && patientNameCache[gcsRec.id]) {
              gcsRec.name = patientNameCache[gcsRec.id];
            }
            merged.push(gcsRec);
            newMetadata[gcsRec.id] = {
              status: gcsRec.status || 'saved',
              lastUpdated: gcsRec.date || new Date().toISOString()
            };
          });
          
          // Sort by date
          merged.sort((a, b) => new Date(b.date) - new Date(a.date));
          
          set({ 
            recordings: merged,
            recordingMetadata: newMetadata,
            patientNameCache 
          });
        },

        // Start a pending recording
        startPendingRecording: (sessionId, recordingName) => {
          const now = new Date();
          const newRecording = {
            id: sessionId,
            name: recordingName || `Pending Recording - ${now.toLocaleTimeString()}`,
            date: now.toISOString(),
            status: 'pending',
            lastUpdated: now.toISOString()
          };
          
          set(state => ({
            recordings: [newRecording, ...state.recordings.filter(r => r.id !== sessionId)],
            recordingMetadata: {
              ...state.recordingMetadata,
              [sessionId]: {
                status: 'pending',
                lastUpdated: now.toISOString()
              }
            }
          }));
        },

        // Update recording
        updateRecording: (sessionId, updates) => {
          console.log(`[updateRecording] Updating recording ${sessionId} with:`, updates);
          
          // Cache patient names in memory
          if (updates.name && 
              !updates.name.startsWith('Transcript ') && 
              !updates.name.startsWith('Session ') &&
              !updates.name.startsWith('Pending ') &&
              !updates.name.startsWith('Tx @ ')) {
            const cleanName = updates.name.replace('Processing: ', '').replace('Failed: ', '');
            set(state => ({
              patientNameCache: {
                ...state.patientNameCache,
                [sessionId]: cleanName
              }
            }));
          }
          
          set(state => ({
            recordings: state.recordings.map(rec =>
              rec.id === sessionId 
                ? { ...rec, ...updates, date: rec.date, lastUpdated: new Date().toISOString() } 
                : rec
            ),
            recordingMetadata: {
              ...state.recordingMetadata,
              [sessionId]: {
                status: updates.status || state.recordingMetadata[sessionId]?.status || 'pending',
                lastUpdated: new Date().toISOString()
              }
            }
          }));
        },

        // Remove recording
        removeRecording: (sessionId) => {
          set(state => ({
            recordings: state.recordings.filter(rec => rec.id !== sessionId),
            recordingMetadata: Object.fromEntries(
              Object.entries(state.recordingMetadata).filter(([id]) => id !== sessionId)
            ),
            patientNameCache: Object.fromEntries(
              Object.entries(state.patientNameCache).filter(([id]) => id !== sessionId)
            )
          }));
        },

        // Add recording
        addRecording: (recording) => {
          set(state => ({
            recordings: [recording, ...state.recordings.filter(r => r.id !== recording.id)]
              .sort((a, b) => new Date(b.date) - new Date(a.date)),
            recordingMetadata: {
              ...state.recordingMetadata,
              [recording.id]: {
                status: recording.status || 'saved',
                lastUpdated: recording.date
              }
            }
          }));
        },

        // Select recording
        selectRecording: (recordingId) => {
          set({ 
            selectedRecordingId: recordingId,
            originalTranscriptContent: null,
            polishedTranscriptContent: null,
            selectedTranscriptError: null
          });
        },

        // Fetch transcript content
        fetchTranscriptContent: async (gcsKey, type, currentUser, getToken) => {
          if (!gcsKey) {
            return type === 'original' 
              ? 'Original transcript GCS path not found.' 
              : 'Polished transcript GCS path not found.';
          }
          
          try {
            const cleanedKey = gcsKey.replace(/^(s3|gs):\/\/[^\/]+\//, '');
            const [userId, ...pathParts] = cleanedKey.split('/');
            
            if (userId !== currentUser?.uid) {
              throw new Error('Unauthorized access to transcript');
            }
            
            const accessToken = await getToken();
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            
            const response = await fetch(
              `${API_BASE_URL}/api/v1/gcs_object_content?gcs_key=${encodeURIComponent(cleanedKey)}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            
            if (!response.ok) {
              throw new Error(`Failed to fetch transcript: ${response.status}`);
            }
            
            const content = await response.text();
            return content;
          } catch (error) {
            console.error('Error fetching transcript:', error);
            return `Error loading transcript: ${error.message}`;
          }
        },

        // Load selected transcript
        loadSelectedTranscript: async (currentUser, getToken) => {
          const { selectedRecordingId, recordings } = get();
          if (!selectedRecordingId) return;
          
          const recording = recordings.find(r => r.id === selectedRecordingId);
          if (!recording) return;
          
          set({ isLoadingSelectedTranscript: true, selectedTranscriptError: null });
          
          try {
            const [originalContent, polishedContent] = await Promise.all([
              recording.gcsPathTranscript 
                ? get().fetchTranscriptContent(recording.gcsPathTranscript, 'original', currentUser, getToken)
                : Promise.resolve(null),
              recording.gcsPathPolished 
                ? get().fetchTranscriptContent(recording.gcsPathPolished, 'polished', currentUser, getToken)
                : Promise.resolve(null)
            ]);
            
            set({
              originalTranscriptContent: originalContent,
              polishedTranscriptContent: polishedContent,
              isLoadingSelectedTranscript: false
            });
          } catch (error) {
            set({
              selectedTranscriptError: error.message,
              isLoadingSelectedTranscript: false
            });
          }
        },

        // Delete recording from backend and local state
        deletePersistedRecording: async (recordingId, currentUser, getToken) => {
          if (!currentUser?.uid) {
            throw new Error('User not authenticated');
          }
          
          try {
            const accessToken = await getToken();
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            
            const response = await fetch(
              `${API_BASE_URL}/api/v1/recordings/${currentUser.uid}/${recordingId}`,
              {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ detail: 'Failed to delete recording' }));
              throw new Error(errorData.detail || `Failed to delete: ${response.status}`);
            }
            
            // Remove from local state
            get().removeRecording(recordingId);
            
            // Clear selection if this was the selected recording
            if (get().selectedRecordingId === recordingId) {
              set({ 
                selectedRecordingId: null,
                originalTranscriptContent: null,
                polishedTranscriptContent: null
              });
            }
            
            console.log(`Successfully deleted recording ${recordingId}`);
          } catch (error) {
            console.error(`Error deleting recording ${recordingId}:`, error);
            throw error;
          }
        },

        // Clear store on logout
        clearStore: () => {
          set({
            recordings: [],
            recordingMetadata: {},
            patientNameCache: {},
            selectedRecordingId: null,
            originalTranscriptContent: null,
            polishedTranscriptContent: null,
            error: null
          });
          localStorage.removeItem(`recordings-${get().currentUserId}`);
        }
      }),
      {
        name: 'recordings-storage',
        storage: createJSONStorage(() => secureStorage),
        partialize: (state) => ({
          recordingMetadata: state.recordingMetadata
        })
      }
    )
  )
);

export default useRecordingsStore;