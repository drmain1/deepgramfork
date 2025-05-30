import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';
import { useAuth0 } from '@auth0/auth0-react';

function Sidebar() {
  const { recordings, deletePersistedRecording, isFetchingRecordings, selectRecording, selectedRecordingId } = useRecordings();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, logout } = useAuth0();
  const [deleteConfirmation, setDeleteConfirmation] = useState({ show: false, recordingId: null, recordingName: null });

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const handleNewRecordingClick = () => {
    selectRecording(null);
    navigate('/transcription');
  };

  const handleDeleteClick = (recordingId, recordingName) => {
    setDeleteConfirmation({ 
      show: true, 
      recordingId, 
      recordingName: recordingName || 'Untitled Encounter' 
    });
  };

  const handleDeleteConfirm = async () => {
    const { recordingId } = deleteConfirmation;
    if (!isAuthenticated) {
      console.error("User not authenticated. Cannot delete recording.");
      return;
    }
    if (deletePersistedRecording) {
      try {
        console.log(`Attempting to delete recording via context: ${recordingId}`);
        await deletePersistedRecording(recordingId);
        setDeleteConfirmation({ show: false, recordingId: null, recordingName: null });
      } catch (error) {
        console.error(`Failed to delete recording ${recordingId}:`, error);
      }
    } else {
      console.error('deletePersistedRecording function not available from context.');
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirmation({ show: false, recordingId: null, recordingName: null });
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

  const sortedRecordings = processedRecordings.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Group recordings by date
  const groupRecordingsByDate = (recordings) => {
    const groups = {};
    
    recordings.forEach(recording => {
      if (!recording.date) return;
      
      try {
        const date = new Date(recording.date);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let groupKey;
        if (date.toDateString() === today.toDateString()) {
          groupKey = 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
          groupKey = 'Yesterday';
        } else {
          groupKey = date.toLocaleDateString(undefined, {
            month: 'numeric',
            day: 'numeric',
            year: 'numeric'
          });
        }
        
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(recording);
      } catch (error) {
        console.error('Error grouping recording by date:', error);
      }
    });
    
    return groups;
  };

  const groupedRecordings = groupRecordingsByDate(sortedRecordings);

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid time';
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      return new Date(isoString).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatSessionId = (sessionId) => {
    if (!sessionId) return 'Unknown Session';
    // Take first and last few characters for display
    return sessionId.length > 20 ? `${sessionId.substring(0, 10)}...${sessionId.substring(sessionId.length - 3)}` : sessionId;
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
            <h1 className="text-2xl font-semibold text-white">Dictation App</h1>
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

      {/* Recordings Section */}
      <div className="flex-1 px-4 overflow-hidden">
        <div className="px-2 mb-4">
          <h3 className="text-sm font-medium text-gray-300">Encounter</h3>
        </div>
        
        <div className="overflow-y-auto max-h-[calc(100vh-400px)] pr-2">
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
          
          {Object.entries(groupedRecordings).map(([dateGroup, recordings]) => (
            <div key={dateGroup} className="mb-6">
              {/* Date Group Header */}
              <div className="text-xs font-medium text-gray-400 mb-3 px-2">
                {dateGroup}
              </div>
              
              {/* Recordings in this date group */}
              <div className="space-y-1">
                {recordings.map((recording) => (
                  <div key={recording.id} className="relative group">
                    <button
                      className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all duration-200 ${
                        selectedRecordingId === recording.id 
                          ? 'bg-blue-600/20 border-l-2 border-blue-500' 
                          : 'hover:bg-gray-800/50'
                      }`}
                      onClick={() => {
                        selectRecording(recording.id);
                        navigate('/transcription');
                      }}
                      disabled={recording.status === 'pending' || recording.status === 'saving'}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-white text-sm truncate">
                          Encounter
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">
                            {formatTime(recording.date)} • {recording.name || 'Untitled'}
                          </span>
                          {recording.status === 'saving' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {recording.status === 'pending' && 'Not started • 0 min'}
                          {recording.status === 'saving' && 'Processing...'}
                          {recording.status === 'saved' && `1 min`}
                          {recording.status === 'failed' && 'Failed'}
                          {recording.status === 'saved' && (
                            <span className="ml-2 text-gray-400">
                              • Deletion in 15 days
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Status indicator dot */}
                      <div className="flex items-center gap-2">
                        {recording.status === 'saved' && (
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        )}
                        {recording.status === 'pending' && (
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        )}
                        {recording.status === 'failed' && (
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        )}
                        {recording.status === 'saving' && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </button>
                    
                    {/* Delete button */}
                    {isAuthenticated && recording.status === 'saved' && (
                      <button
                        className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-2 hover:bg-red-600/20 rounded-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(recording.id, recording.name);
                        }}
                        title="Delete recording"
                      >
                        <span className="material-icons text-lg text-gray-400 hover:text-red-400">delete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Section */}
      <div className="mt-auto border-t border-gray-700">
        <div className="p-4">
          {isLoading ? (
            <div className="text-center py-4">
              <div className="spinner mx-auto"></div>
            </div>
          ) : isAuthenticated ? (
            <>
              <div className="flex items-center gap-3 mb-4 p-3 rounded-lg hover:bg-gray-800 transition-colors cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-medium">
                  {user?.name ? user.name.charAt(0).toUpperCase() : user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-base font-medium text-white truncate">
                    {user?.name || user?.email?.split('@')[0] || 'User'}
                  </div>
                  <div className="text-sm text-gray-400 truncate">
                    {user?.email || 'No email'}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
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
              <p className="text-sm text-gray-400 mb-3">Sign in to get started</p>
              <button
                className="btn btn-primary w-full"
                onClick={() => window.location.href = '/login'}
              >
                <span className="material-icons">login</span>
                <span>Log In</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <span className="material-icons text-red-600">warning</span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Recording</h3>
                <p className="text-sm text-gray-400">This action cannot be undone</p>
              </div>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                Are you sure you want to delete this recording?
              </p>
              <div className="bg-gray-700 rounded p-3">
                <p className="font-medium text-white text-sm">
                  {deleteConfirmation.recordingName}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Recording ID: {deleteConfirmation.recordingId}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                onClick={handleDeleteConfirm}
              >
                Delete Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
