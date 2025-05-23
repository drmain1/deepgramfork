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
    navigate('/');
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
    <aside className="sidebar w-64 flex flex-col p-6 space-y-4">
      <div className="text-2xl font-semibold text-white mb-6">Dictation App</div>
      
      <button
        className={`sidebar-link flex items-center p-3 rounded-lg space-x-3 ${
          isLoading || !isAuthenticated ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        onClick={handleNewRecordingClick}
        disabled={isLoading || !isAuthenticated}
      >
        <span className="material-icons">add_circle_outline</span>
        <span>New Recording</span>
      </button>

      <div className="mt-4 flex-1">
        <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-2">Recent Recordings</h3>
        <nav className="space-y-1 max-h-96 overflow-y-auto">
          {isFetchingRecordings && recordings.length === 0 && (
            <div className="text-center text-gray-500 mt-4">Loading recordings...</div>
          )}
          {!isFetchingRecordings && recordings.length === 0 && isAuthenticated && (
            <div className="text-center text-gray-500 mt-4">No recent recordings found.</div>
          )}
          {!isAuthenticated && !isLoading && (
            <div className="text-center text-gray-500 mt-4">Login to see recordings.</div>
          )}
          {sortedRecordings.map((recording) => (
            <div key={recording.id} className="relative group">
              <button
                className={`sidebar-link w-full flex flex-col p-3 rounded-lg text-sm text-left ${
                  selectedRecordingId === recording.id ? 'active' : ''
                }`}
                onClick={() => selectRecording(recording.id)}
              >
                <span className="truncate">
                  {recording.name || `Session ${formatSessionId(recording.id)}`}
                </span>
                <span className="text-xs text-gray-500">
                  {recording.date ? formatDate(recording.date) : 'No date'}
                </span>
              </button>
              {isAuthenticated && (
                <button
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-600 rounded"
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

      <div className="mt-auto">
        <div className="border-t border-gray-700 pt-4">
          {isLoading ? (
            <div className="text-center text-gray-400 mb-4">Loading user...</div>
          ) : isAuthenticated ? (
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-gray-500 flex items-center justify-center text-white">
                <span className="material-icons">person</span>
              </div>
              <div>
                <div className="text-sm font-medium text-white">
                  {user?.email || 'User'}
                </div>
                <button className="text-xs text-gray-400 hover:text-gray-200">
                  View Profile
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center text-gray-400 mb-4">
              Please log in to continue
            </div>
          )}

          <button
            className={`sidebar-link flex items-center p-3 rounded-lg space-x-3 w-full mb-2 ${
              isLoading || !isAuthenticated ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
            }`}
            onClick={handleGoToSettings}
            disabled={isLoading || !isAuthenticated}
          >
            <span className="material-icons">settings</span>
            <span>Settings</span>
          </button>

          {isAuthenticated ? (
            <button
              className="sidebar-link flex items-center p-3 rounded-lg space-x-3 w-full"
              onClick={handleLogout}
            >
              <span className="material-icons">logout</span>
              <span>Log Out</span>
            </button>
          ) : (
            <button
              className="sidebar-link flex items-center p-3 rounded-lg space-x-3 w-full"
              onClick={() => window.location.href = '/login'}
            >
              <span className="material-icons">login</span>
              <span>Log In</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
