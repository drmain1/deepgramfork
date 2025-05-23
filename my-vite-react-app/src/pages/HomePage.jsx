import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useNavigate } from 'react-router-dom';
import { useRecordings } from '../contexts/RecordingsContext';

function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const { recordings } = useRecordings();
  const navigate = useNavigate();

  const handleStartNewEncounter = () => {
    navigate('/transcription');
  };

  const handleViewRecordings = () => {
    // Navigate to transcription page where recordings can be viewed via sidebar
    navigate('/transcription');
  };

  if (isLoading) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <div className="flex flex-col justify-center items-center min-h-screen px-8">
          <div className="card max-w-md w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
              <span className="material-icons text-white text-4xl">mic</span>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-3">Welcome to Dictation App</h2>
            <p className="text-gray-600 mb-8">
              Professional medical transcription made simple. Start recording encounters, manage your notes, and streamline your workflow.
            </p>
            <button
              className="btn btn-primary w-full"
              onClick={() => window.location.href = '/login'}
            >
              <span className="material-icons">login</span>
              <span>Get Started</span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Welcome Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name || user?.email?.split('@')[0] || 'Doctor'}!
          </h1>
          <p className="text-gray-600">
            Ready to start a new encounter or review your recent recordings?
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="card p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center mr-4">
                <span className="material-icons text-white text-2xl">add</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">New Encounter</h3>
                <p className="text-gray-600">Start recording a new patient encounter</p>
              </div>
            </div>
            <button
              className="btn btn-primary w-full"
              onClick={handleStartNewEncounter}
            >
              <span className="material-icons">mic</span>
              <span>Start Recording</span>
            </button>
          </div>

          <div className="card p-6">
            <div className="flex items-center mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mr-4">
                <span className="material-icons text-white text-2xl">folder_open</span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Recent Recordings</h3>
                <p className="text-gray-600">View and manage your transcriptions</p>
              </div>
            </div>
            <button
              className="btn btn-secondary w-full"
              onClick={handleViewRecordings}
            >
              <span className="material-icons">list</span>
              <span>View Recordings ({recordings.length})</span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        {recordings.length > 0 && (
          <div className="card p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {recordings.slice(0, 3).map((recording) => (
                <div key={recording.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <span className={`status-indicator ${recording.status || 'pending'} mr-3`}></span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {recording.name || `Session ${recording.id.substring(0, 8)}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {recording.date ? new Date(recording.date).toLocaleString() : 'No date'}
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={handleViewRecordings}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
            {recordings.length > 3 && (
              <div className="text-center mt-4">
                <button
                  className="btn btn-outline"
                  onClick={handleViewRecordings}
                >
                  View All Recordings
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

export default HomePage; 