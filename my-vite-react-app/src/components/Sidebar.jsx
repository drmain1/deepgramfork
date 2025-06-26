import { useNavigate } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';
import { useAuth } from '../contexts/FirebaseAuthContext';
import { useState, useEffect } from 'react';

function Sidebar() {
  const { recordings, deletePersistedRecording, isFetchingRecordings, selectRecording, selectedRecordingId } = useRecordings();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  
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

  // Parse timestamp from session ID (format: YYYYMMDDHHMMSSxxxxxx)
  const parseSessionIdTime = (sessionId) => {
    if (!sessionId || sessionId.length < 14 || !sessionId.substring(0, 14).match(/^\d{14}$/)) {
      return null;
    }
    
    try {
      const year = sessionId.substring(0, 4);
      const month = sessionId.substring(4, 6);
      const day = sessionId.substring(6, 8);
      const hour = sessionId.substring(8, 10);
      const minute = sessionId.substring(10, 12);
      const second = sessionId.substring(12, 14);
      
      // Create UTC date string and parse it
      // Session IDs are now generated in UTC on the backend
      // For backward compatibility: session IDs created before June 26, 2025 are in server local time
      const sessionDate = parseInt(year + month + day);
      const migrationDate = 20250626; // Date when we switched to UTC
      
      if (sessionDate < migrationDate) {
        // Old session IDs - parse as local time (server was likely in UTC or US timezone)
        // This is a best-effort approach since we don't know the exact server timezone
        return new Date(year, month - 1, day, hour, minute, second);
      } else {
        // New session IDs - parse as UTC
        const utcDateString = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
        return new Date(utcDateString);
      }
    } catch (error) {
      return null;
    }
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
    // Sort by session ID timestamp for accuracy
    const timeA = parseSessionIdTime(a.id) || new Date(a.date || 0);
    const timeB = parseSessionIdTime(b.id) || new Date(b.date || 0);
    return timeB - timeA;
  });

  // Group recordings by date
  const groupRecordingsByDate = (recordings) => {
    const groups = {};
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    recordings.forEach(recording => {
      // Use session ID timestamp for accurate grouping
      const recordingDate = parseSessionIdTime(recording.id) || new Date(recording.date || 0);
      if (!recordingDate || recordingDate.toString() === 'Invalid Date') return;
      
      const dateKey = recordingDate.toDateString();
      
      let groupKey;
      if (dateKey === today.toDateString()) {
        groupKey = 'Today';
      } else if (dateKey === yesterday.toDateString()) {
        groupKey = 'Yesterday';
      } else {
        // Format as "Monday, January 15" for recent dates, or "January 15, 2024" for older dates
        const isThisYear = recordingDate.getFullYear() === today.getFullYear();
        if (isThisYear) {
          groupKey = recordingDate.toLocaleDateString(undefined, { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          });
        } else {
          groupKey = recordingDate.toLocaleDateString(undefined, { 
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

  const formatTime = (isoString, sessionId) => {
    // First try to parse from session ID for accuracy
    const sessionTime = parseSessionIdTime(sessionId);
    if (sessionTime) {
      return sessionTime.toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'  // Shows timezone like "PST" or "EST"
      });
    }
    
    // Fallback to ISO string if available
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
      });
    } catch (error) {
      return 'Invalid time';
    }
  };

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
      <div className="flex-1 px-4 overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <h3 className="section-header px-2 mb-0">Recent Recordings</h3>
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
        <nav className="space-y-4 overflow-y-auto max-h-[calc(100vh-450px)] pr-2">
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
    </aside>
  );
}

export default Sidebar;
