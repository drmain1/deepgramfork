import { useNavigate } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useState, useEffect } from 'react';
import { useUserSettings } from '../hooks/useUserSettings';
import { getDateAtMidnightInTimezone, getTodayInTimezone, getYesterdayInTimezone, formatDateInTimezone } from '../utils/timezoneUtils';

function Sidebar() {
  const { recordings, deletePersistedRecording, isFetchingRecordings, selectRecording, selectedRecordingId, fetchUserRecordings, selectedTranscriptError } = useRecordings();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { userSettings } = useUserSettings();
  
  // Track backend connection status
  const [isBackendAvailable, setIsBackendAvailable] = useState(true);
  
  // State for delete confirmation modal
  const [deleteConfirmation, setDeleteConfirmation] = useState({
    isOpen: false,
    recordingId: null,
    recordingName: null,
    isDeleting: false
  });

  // State for search
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  
  // Update backend availability based on errors
  useEffect(() => {
    setIsBackendAvailable(!selectedTranscriptError || selectedTranscriptError === 'PROCESSING');
  }, [selectedTranscriptError]);

  // Keyboard shortcut for search (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchExpanded(!isSearchExpanded);
      }
      // Close search on Escape
      if (e.key === 'Escape' && isSearchExpanded) {
        setIsSearchExpanded(false);
        setSearchQuery('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchExpanded]);

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const handleNewRecordingClick = () => {
    selectRecording(null);
    navigate('/transcription');
  };

  const handleDeleteClick = (recordingId, recordingName) => {
    setDeleteConfirmation({
      isOpen: true,
      recordingId,
      recordingName,
      isDeleting: false
    });
  };

  const handleConfirmDelete = async () => {
    if (!isAuthenticated || !deleteConfirmation.recordingId || deleteConfirmation.isDeleting) {
      console.error("User not authenticated, no recording selected, or deletion already in progress.");
      return;
    }
    
    if (deletePersistedRecording) {
      try {
        // Set deleting state to prevent duplicate requests
        setDeleteConfirmation(prev => ({ ...prev, isDeleting: true }));
        
        // PHI-safe logging
        console.log(`Attempting to delete recording`);
        await deletePersistedRecording(deleteConfirmation.recordingId);
        setDeleteConfirmation({ isOpen: false, recordingId: null, recordingName: null, isDeleting: false });
      } catch (error) {
        console.error(`Failed to delete recording:`, error);
        setDeleteConfirmation(prev => ({ ...prev, isDeleting: false }));
      }
    } else {
      console.error('deletePersistedRecording function not available from context.');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation({ isOpen: false, recordingId: null, recordingName: null, isDeleting: false });
  };

  const handleLogout = () => {
    logout({
      logoutParams: {
        returnTo: window.location.origin
      }
    });
  };


  // Filter out 'pending' recordings from display if they have an associated 'saved' or 'failed' recording
  const processedRecordings = recordings.reduce((acc, current) => {
    const existingRecording = acc.find((recording) => recording.id === current.id);
    if (existingRecording) {
      if (existingRecording.status === 'pending' && (current.status === 'saved' || current.status === 'failed')) {
        return acc;
      } else {
        return acc.map((recording) => recording.id === current.id ? current : recording);
      }
    } else {
      return [...acc, current];
    }
  }, []);

  // Filter recordings based on search query
  const filteredRecordings = processedRecordings.filter(recording => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const name = (recording.name || '').toLowerCase();
    const sessionId = (recording.id || '').toLowerCase();
    
    return name.includes(query) || sessionId.includes(query);
  });

  const sortedRecordings = filteredRecordings.sort((a, b) => {
    // Always use the date field from backend as primary sort
    // The backend already handles dictation mode dates correctly
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    
    // Sort by date descending (newest first)
    return dateB - dateA;
  });

  // Group recordings by date
  const groupRecordingsByDate = (recordings) => {
    const groups = {};
    
    // Use user's timezone if available, otherwise fallback to browser timezone
    const userTimezone = userSettings?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Get today and yesterday at midnight in user's timezone
    const today = getTodayInTimezone(userTimezone);
    const yesterday = getYesterdayInTimezone(userTimezone);
    
    recordings.forEach(recording => {
      // Use the backend date as the source of truth
      const recordingDate = new Date(recording.date);
      if (!recording.date || !recordingDate || isNaN(recordingDate.getTime())) {
        console.error(`Recording ${recording.id} has invalid date:`, recording.date);
        return; // Skip this recording
      }
      
      // Get the recording date at midnight in the user's timezone
      const recordingDay = getDateAtMidnightInTimezone(recordingDate, userTimezone);
      
      let groupKey;
      if (recordingDay.getTime() === today.getTime()) {
        groupKey = 'Today';
      } else if (recordingDay.getTime() === yesterday.getTime()) {
        groupKey = 'Yesterday';
      } else {
        // Format the date appropriately in user's timezone
        const now = new Date();
        const isThisYear = recordingDate.getFullYear() === now.getFullYear();
        if (isThisYear) {
          groupKey = formatDateInTimezone(recordingDate, userTimezone, { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          });
        } else {
          groupKey = formatDateInTimezone(recordingDate, userTimezone, { 
            month: 'long', 
            day: 'numeric',
            year: 'numeric'
          });
        }
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(recording);
    });
    
    return groups;
  };

  const groupedRecordings = groupRecordingsByDate(sortedRecordings);

  const formatSessionId = (sessionId) => {
    if (!sessionId) return 'Unknown Session';
    // Take first and last few characters for display
    return sessionId.length > 20 ? `${sessionId.substring(0, 10)}...${sessionId.substring(sessionId.length - 3)}` : sessionId;
  };

  // Highlight search terms in text
  const highlightSearchTerm = (text, searchTerm) => {
    if (!searchTerm || !text) return text;
    
    const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
    return parts.map((part, index) => 
      part.toLowerCase() === searchTerm.toLowerCase() 
        ? <mark key={index} className="bg-purple-600/40 text-white rounded px-0.5">{part}</mark>
        : part
    );
  };

  return (
    <aside className="sidebar w-80 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
            <span className="material-icons text-white text-2xl">mic</span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Medlegaldoc</h1>
            <p className="text-sm text-gray-400">Medical Transcription</p>
          </div>
        </div>
      </div>
      
      {/* New Recording Button */}
      <div className="px-4 pb-4">
        <button
          className={`w-full btn ${
            isLoading || !isAuthenticated 
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-primary to-secondary text-white hover:shadow-lg'
          } py-3 rounded-lg font-medium transition-all text-base`}
          onClick={handleNewRecordingClick}
          disabled={isLoading || !isAuthenticated}
        >
          <span className="material-icons text-xl">add</span>
          <span>New Encounter</span>
        </button>
      </div>

      {/* Search Section */}
      <div className="px-4 pb-3">
        <div className={`transition-all duration-300 overflow-hidden ${isSearchExpanded ? 'max-h-20' : 'max-h-0'}`}>
          <div className="relative">
            <input
              type="text"
              placeholder="Search patients or sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 pr-10 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-all text-sm"
              autoFocus={isSearchExpanded}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
              >
                <span className="material-icons text-xl">close</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recordings Section */}
      <div className="flex-1 px-4 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header px-2 mb-0">Recent Recordings</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchUserRecordings()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
              title="Refresh recordings"
            >
              <span className="material-icons text-xl">refresh</span>
            </button>
            <button
            onClick={() => setIsSearchExpanded(!isSearchExpanded)}
            className={`p-1.5 rounded-lg transition-all group relative ${
              isSearchExpanded 
                ? 'bg-primary text-white' 
                : 'text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
            title={isSearchExpanded ? 'Close search (Esc)' : 'Search recordings (⌘K)'}
          >
            <span className="material-icons text-xl">search</span>
            {!isSearchExpanded && (
              <span className="absolute -bottom-8 right-0 bg-gray-900 text-xs text-gray-400 px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                ⌘K
              </span>
            )}
          </button>
          </div>
        </div>
        
        {/* Backend Status Indicator */}
        {!isBackendAvailable && (
          <div className="px-4 py-2 bg-red-600/20 border border-red-600 rounded mx-4 mb-2">
            <p className="text-sm text-red-400">Unable to connect to server</p>
          </div>
        )}
        
        <nav className="space-y-4 overflow-y-auto flex-1 pr-2 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          {isFetchingRecordings && recordings.length === 0 && (
            <div className="text-center py-8">
              <div className="spinner mx-auto mb-3"></div>
              <p className="text-sm text-gray-400">Loading recordings...</p>
            </div>
          )}
          {!isFetchingRecordings && recordings.length === 0 && isAuthenticated && (
            <div className="text-center py-8">
              <span className="material-icons text-gray-600 text-4xl mb-3 block">folder_open</span>
              <p className="text-sm text-gray-400">No recordings yet</p>
              <p className="text-xs text-gray-500 mt-1">Start your first encounter above</p>
            </div>
          )}
          {!isAuthenticated && !isLoading && (
            <div className="text-center py-8">
              <span className="material-icons text-gray-600 text-4xl mb-3 block">lock</span>
              <p className="text-sm text-gray-400">Login to see recordings</p>
            </div>
          )}
          
          {/* No search results message */}
          {searchQuery && sortedRecordings.length === 0 && !isFetchingRecordings && isAuthenticated && (
            <div className="text-center py-8">
              <span className="material-icons text-gray-600 text-4xl mb-3 block">search_off</span>
              <p className="text-sm text-gray-400">No recordings found for "{searchQuery}"</p>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-xs text-primary hover:text-primary-light mt-2"
              >
                Clear search
              </button>
            </div>
          )}
          
          {/* Grouped Recordings */}
          {Object.entries(groupedRecordings).map(([dateGroup, groupRecordings]) => (
            <div key={dateGroup} className="space-y-1">
              {/* Date Group Header */}
              <div className="px-2 py-1">
                <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {dateGroup}
                </h4>
              </div>
              
              {/* Recordings in this date group */}
              {groupRecordings.map((recording) => (
                <div key={recording.id} className="relative group">
                  <button
                    className={`sidebar-link w-full flex flex-col p-4 rounded-lg text-left ${
                      selectedRecordingId === recording.id ? 'active' : ''
                    }`}
                    onClick={() => {
                      selectRecording(recording.id);
                      navigate('/transcription');
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="truncate flex-1 font-medium text-base">
                        {searchQuery 
                          ? highlightSearchTerm(recording.name || `Session ${formatSessionId(recording.id)}`, searchQuery)
                          : (recording.name || `Session ${formatSessionId(recording.id)}`)
                        }
                      </span>
                      <span className={`status-indicator ${recording.status || 'pending'} ml-2 mt-1.5`}></span>
                    </div>
                  </button>
                  {isAuthenticated && (
                    <button
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 hover:bg-red-600 bg-red-500 rounded-lg shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(recording.id, recording.name);
                      }}
                      title="Delete recording"
                    >
                      <span className="material-icons text-sm text-white">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </nav>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 m-4 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="material-icons text-red-600 text-2xl">warning</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Recording</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700">
                Are you sure you want to delete the recording <span className="font-semibold">"{deleteConfirmation.recordingName}"</span>?
              </p>
              <p className="text-sm text-gray-500 mt-2">
                This will permanently delete the recording, transcript, and all associated data.
              </p>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
                onClick={handleCancelDelete}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 text-white rounded-lg transition-colors font-medium flex items-center gap-2 ${
                  deleteConfirmation.isDeleting 
                    ? 'bg-red-400 cursor-not-allowed' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
                onClick={handleConfirmDelete}
                disabled={deleteConfirmation.isDeleting}
              >
                {deleteConfirmation.isDeleting ? (
                  <>
                    <div className="spinner-small"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-sm">delete</span>
                    Delete Recording
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Section */}
      <div className="mt-auto border-t border-gray-700">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="spinner mx-auto"></div>
            </div>
          ) : isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 mb-3 p-3 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                  {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium text-white truncate">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  className="sidebar-link flex items-center gap-3 p-3 rounded-lg w-full text-base bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={() => navigate('/patients')}
                >
                  <span className="material-icons text-xl">group</span>
                  <span>Manage Patients</span>
                </button>
                <button
                  className="sidebar-link flex items-center gap-3 p-3 rounded-lg w-full text-base"
                  onClick={handleGoToSettings}
                  disabled={isLoading || !isAuthenticated}
                >
                  <span className="material-icons text-xl">settings</span>
                  <span>Settings</span>
                </button>

                <button
                  className="sidebar-link flex items-center gap-3 p-3 rounded-lg w-full text-base text-red-400 hover:text-red-300 hover:bg-red-900/20"
                  onClick={handleLogout}
                >
                  <span className="material-icons text-xl">logout</span>
                  <span>Log Out</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">Loading authentication...</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer Links */}
      <div className="p-4 border-t border-gray-800 mt-auto">
        <div className="flex justify-center gap-4 text-xs text-gray-500">
          <button
            onClick={() => navigate('/privacy')}
            className="hover:text-gray-300 transition-colors"
          >
            Privacy Policy
          </button>
          <span>•</span>
          <button
            onClick={() => navigate('/terms')}
            className="hover:text-gray-300 transition-colors"
          >
            Terms of Service
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
