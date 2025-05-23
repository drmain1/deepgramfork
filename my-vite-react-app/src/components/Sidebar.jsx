import { useNavigate } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';
import { useAuth0 } from '@auth0/auth0-react';

function Sidebar() {
  const { recordings, deletePersistedRecording, isFetchingRecordings, selectRecording, selectedRecordingId } = useRecordings();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, user, logout } = useAuth0();

  const handleGoToSettings = () => {
    navigate('/settings');
  };

  const handleNewRecordingClick = () => {
    selectRecording(null);
    navigate('/transcription');
  };

  const handleDeleteRecording = async (recordingId) => {
    if (!isAuthenticated) {
      console.error("User not authenticated. Cannot delete recording.");
      return;
    }
    if (deletePersistedRecording) {
      try {
        console.log(`Attempting to delete recording via context: ${recordingId}`);
        await deletePersistedRecording(recordingId);
      } catch (error) {
        console.error(`Failed to delete recording ${recordingId}:`, error);
      }
    } else {
      console.error('deletePersistedRecording function not available from context.');
    }
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
        <h3 className="section-header px-2">Recent Recordings</h3>
        <nav className="space-y-1 overflow-y-auto max-h-[calc(100vh-400px)] pr-2">
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
          {sortedRecordings.map((recording) => (
            <div key={recording.id} className="relative group">
              <button
                className={`sidebar-link w-full flex flex-col p-4 rounded-lg text-left ${
                  selectedRecordingId === recording.id ? 'active' : ''
                }`}
                onClick={() => selectRecording(recording.id)}
              >
                <div className="flex items-start justify-between">
                  <span className="truncate flex-1 font-medium text-base">
                    {recording.name || `Session ${formatSessionId(recording.id)}`}
                  </span>
                  <span className={`status-indicator ${recording.status || 'pending'} ml-2 mt-1.5`}></span>
                </div>
                <span className="text-sm text-gray-500 mt-1">
                  {recording.date ? formatDate(recording.date) : 'No date'}
                </span>
              </button>
              {isAuthenticated && (
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1.5 hover:bg-gray-700 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteRecording(recording.id);
                  }}
                  title="Delete recording"
                >
                  <span className="material-icons text-xs text-gray-400 hover:text-red-400">delete</span>
                </button>
              )}
            </div>
          ))}
        </nav>
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
    </aside>
  );
}

export default Sidebar;
