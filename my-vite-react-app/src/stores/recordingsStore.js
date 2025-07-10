import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';


const useRecordingsStore = create(
  subscribeWithSelector(
    (set, get) => ({
      // State
      recordings: [],
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
          
          // Just fetch fresh data from backend
          await get().fetchUserRecordings(currentUser, getToken);
        },

        // Fetch recordings from backend
        fetchUserRecordings: async (currentUser, getToken) => {
          if (!currentUser?.uid || get().isFetchingRecordings) return;
          
          set({ isFetchingRecordings: true });
          
          try {
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            
            // First attempt
            let accessToken = await getToken();
            let response = await fetch(`${API_BASE_URL}/api/v1/user_recordings/${currentUser.uid}`, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            });
            
            // Retry with fresh token on 401
            if (response.status === 401) {
              console.log('Got 401, retrying with fresh token...');
              // Force token refresh and retry once
              accessToken = await getToken();
              response = await fetch(`${API_BASE_URL}/api/v1/user_recordings/${currentUser.uid}`, {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              });
            }
            
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch recordings.' }));
              throw new Error(errorData.detail || `Server error: ${response.status}`);
            }
            
            const fetchedRecordings = await response.json();
            // PHI-safe logging: only log count, not content
            console.log("Fetched recordings count:", fetchedRecordings.length);
            
            // Debug log to check if transcript field is present
            if (fetchedRecordings.length > 0) {
              console.log('[fetchUserRecordings] First recording sample:', {
                id: fetchedRecordings[0].id,
                hasTranscript: !!fetchedRecordings[0].transcript,
                transcriptLength: fetchedRecordings[0].transcript?.length || 0,
                status: fetchedRecordings[0].status,
                isDictation: fetchedRecordings[0].isDictation,
                date: fetchedRecordings[0].date
              });
              
              // Find any dictation mode recordings
              const dictationRecordings = fetchedRecordings.filter(r => r.isDictation);
              if (dictationRecordings.length > 0) {
                console.log('[fetchUserRecordings] Dictation recordings found:', dictationRecordings.map(r => ({
                  id: r.id,
                  isDictation: r.isDictation,
                  date: r.date,
                  name: r.name
                })));
              }
            }
            
            // Merge with local state
            get().mergeRecordings(fetchedRecordings);
            
          } catch (error) {
            console.error("Error fetching recordings:", error);
            set({ error: error.message });
          } finally {
            set({ isFetchingRecordings: false });
          }
        },

        // Simplified merge - just replace with backend data
        mergeRecordings: (backendRecordings) => {
          // Sort by date descending (newest first)
          const sorted = backendRecordings.sort((a, b) => {
            const dateA = new Date(a.date || 0);
            const dateB = new Date(b.date || 0);
            return dateB - dateA;
          });
          
          set({ recordings: sorted });
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
            recordings: [newRecording, ...state.recordings.filter(r => r.id !== sessionId)]
          }));
        },

        // Update recording
        updateRecording: (sessionId, updates) => {
          // PHI-safe logging: only log sessionId and status, not patient names
          console.log(`[updateRecording] Updating recording ${sessionId}, status: ${updates.status || 'unchanged'}`);
          
          set(state => ({
            recordings: state.recordings.map(rec =>
              rec.id === sessionId 
                ? { ...rec, ...updates, date: rec.date || updates.date, lastUpdated: updates.lastUpdated || rec.lastUpdated || new Date().toISOString() } 
                : rec
            )
          }));
        },

        // Remove recording
        removeRecording: (sessionId) => {
          set(state => ({
            recordings: state.recordings.filter(rec => rec.id !== sessionId)
          }));
        },

        // Add recording
        addRecording: (recording) => {
          set(state => ({
            recordings: [recording, ...state.recordings.filter(r => r.id !== recording.id)]
              .sort((a, b) => {
                const dateA = new Date(a.date || 0);
                const dateB = new Date(b.date || 0);
                return dateB - dateA;
              })
          }));
        },

        // Select recording
        selectRecording: (recordingId) => {
          console.log(`[selectRecording] Selecting recording: ${recordingId}`);
          const recording = get().recordings.find(r => r.id === recordingId);
          console.log(`[selectRecording] Found recording:`, {
            id: recording?.id,
            hasTranscript: !!recording?.transcript,
            transcriptLength: recording?.transcript?.length || 0,
            status: recording?.status
          });
          
          // Check if recording is still processing
          if (recording?.status === 'processing' || recording?.status === 'saving') {
            set({ 
              selectedRecordingId: recordingId,
              originalTranscriptContent: null,
              polishedTranscriptContent: null,
              selectedTranscriptError: 'PROCESSING',
              isLoadingSelectedTranscript: false
            });
            return;
          }
          
          // If recording has inline transcript, set it immediately
          if (recording?.transcript) {
            console.log('[selectRecording] Setting inline transcript immediately');
            set({ 
              selectedRecordingId: recordingId,
              originalTranscriptContent: recording.transcript,
              polishedTranscriptContent: recording.polishedTranscript || 'No polished transcript available.',
              selectedTranscriptError: null,
              isLoadingSelectedTranscript: false
            });
          } else {
            set({ 
              selectedRecordingId: recordingId,
              originalTranscriptContent: null,
              polishedTranscriptContent: null,
              selectedTranscriptError: null
            });
          }
        },

        // Fetch transcript content
        fetchTranscriptContent: async (gcsKey, type, currentUser, getToken) => {
          if (!gcsKey) {
            return type === 'original' 
              ? 'Original transcript GCS path not found.' 
              : 'Polished transcript GCS path not found.';
          }
          
          try {
            const cleanedKey = gcsKey.replace(/^(s3|gs):\/\/[^/]+\//, '');
            const [userId] = cleanedKey.split('/');
            
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
          
          // Check if still processing
          if (recording.status === 'processing' || recording.status === 'saving') {
            console.log(`[loadSelectedTranscript] Recording ${selectedRecordingId} is still processing`);
            set({ 
              selectedTranscriptError: 'PROCESSING',
              isLoadingSelectedTranscript: false 
            });
            return;
          }
          
          set({ isLoadingSelectedTranscript: true, selectedTranscriptError: null });
          
          try {
            // Debug logging
            console.log(`[loadSelectedTranscript] Loading transcript for ${selectedRecordingId}`);
            console.log(`[loadSelectedTranscript] Recording has transcript field: ${!!recording.transcript}`);
            console.log(`[loadSelectedTranscript] Transcript length: ${recording.transcript?.length || 0}`);
            
            // For drafts or recordings with inline transcript content
            if (recording.transcript) {
              console.log('[loadSelectedTranscript] Setting inline transcript:', {
                transcriptPreview: recording.transcript.substring(0, 100) + '...',
                fullLength: recording.transcript.length,
                hasPolished: !!recording.polishedTranscript
              });
              set({
                originalTranscriptContent: recording.transcript,
                polishedTranscriptContent: recording.polishedTranscript || 'No polished transcript available.',
                isLoadingSelectedTranscript: false
              });
              return;
            }
            
            // Fetch from new Firestore endpoint
            const accessToken = await getToken();
            const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            
            const response = await fetch(
              `${API_BASE_URL}/api/v1/transcript/${currentUser.uid}/${selectedRecordingId}`,
              {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              }
            );
            
            if (!response.ok) {
              // Check if it's still processing
              if (response.status === 404) {
                // Transcript not ready yet, set processing state
                set({
                  selectedTranscriptError: 'PROCESSING',
                  isLoadingSelectedTranscript: false
                });
                return;
              }
              throw new Error(`Failed to fetch transcript: ${response.status}`);
            }
            
            const transcriptData = await response.json();
            
            // Check if transcript content is actually available
            if (!transcriptData.originalTranscript || transcriptData.originalTranscript === '') {
              // Transcript exists but content not ready yet
              set({
                selectedTranscriptError: 'PROCESSING',
                isLoadingSelectedTranscript: false
              });
              return;
            }
            
            set({
              originalTranscriptContent: transcriptData.originalTranscript || 'No original transcript available.',
              polishedTranscriptContent: transcriptData.polishedTranscript || 'No polished transcript available.',
              isLoadingSelectedTranscript: false
            });
          } catch (error) {
            console.error('Error loading transcript:', error);
            
            // Fallback to GCS if Firestore fails (for backwards compatibility)
            if (recording.gcsPathTranscript) {
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
                  originalTranscriptContent: originalContent || 'No original transcript available.',
                  polishedTranscriptContent: polishedContent || 'No polished transcript available.',
                  isLoadingSelectedTranscript: false
                });
              } catch {
                set({
                  selectedTranscriptError: error.message,
                  isLoadingSelectedTranscript: false
                });
              }
            } else {
              set({
                selectedTranscriptError: error.message,
                isLoadingSelectedTranscript: false
              });
            }
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
            
            // PHI-safe logging
            console.log(`Successfully deleted recording`);
          } catch (error) {
            console.error(`Error deleting recording ${recordingId}:`, error);
            throw error;
          }
        },

        // Clear store on logout
        clearStore: () => {
          set({
            recordings: [],
            selectedRecordingId: null,
            originalTranscriptContent: null,
            polishedTranscriptContent: null,
            error: null
          });
        }
    })
  )
);

export default useRecordingsStore;