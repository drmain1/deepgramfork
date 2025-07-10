import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';

function ReEvaluationIndicator({ patient }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState(null);
  const { getToken } = useAuth();

  useEffect(() => {
    if (patient?.id && !loading) {
      fetchReEvaluationStatus();
    }
  }, [patient?.id]);

  const fetchReEvaluationStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const token = await getToken();
      
      const response = await fetch(
        `${API_BASE_URL}/api/v1/patients/${patient.id}/re-evaluation-status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        const errorText = await response.text();
        console.error('Re-evaluation API error:', response.status, errorText);
        setError(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error fetching re-evaluation status:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Debug rendering
  if (!patient) {
    return <span className="text-xs text-red-500">No patient</span>;
  }
  
  if (loading) {
    return <span className="text-xs text-gray-500">Loading visits...</span>;
  }
  
  if (error) {
    return <span className="text-xs text-red-500">Error: {error}</span>;
  }
  
  if (!status) {
    return <span className="text-xs text-orange-500">No status data</span>;
  }

  // Determine icon and color based on status
  const getStatusIcon = () => {
    if (status.status === 'error') {
      return 'warning';
    }
    switch (status.color) {
      case 'green':
        return 'check_circle';
      case 'yellow':
        return 'schedule';
      case 'red':
        return 'error_outline';
      case 'gray':
        return 'pending';
      default:
        return 'info';
    }
  };

  const getStatusColor = () => {
    switch (status.color) {
      case 'green':
        return 'text-green-600';
      case 'yellow':
        return 'text-yellow-600';
      case 'red':
        return 'text-red-600';
      case 'gray':
        return 'text-gray-500';
      default:
        return 'text-gray-600';
    }
  };

  const getBgColor = () => {
    switch (status.color) {
      case 'green':
        return 'bg-green-50 border-green-200';
      case 'yellow':
        return 'bg-yellow-50 border-yellow-200';
      case 'red':
        return 'bg-red-50 border-red-200';
      case 'gray':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="relative inline-block">
      {/* Minimalist button similar to View Last Visit */}
      <button
        type="button"
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        <span className={`material-icons text-sm ${getStatusColor()}`}>
          {getStatusIcon()}
        </span>
        <span>
          {status.status === 'error' ? (
            <>
              {status.session_count} total visit{status.session_count !== 1 ? 's' : ''}
            </>
          ) : status.status === 'no_evaluation' ? (
            <>
              {status.sessions_since_evaluation} visit{status.sessions_since_evaluation !== 1 ? 's' : ''} - {status.message.includes('No valid evaluation dates') ? 'Dates missing' : 'No eval'}
            </>
          ) : status.sessions_since_evaluation > 0 ? (
            <>
              {status.sessions_since_evaluation} visit{status.sessions_since_evaluation !== 1 ? 's' : ''} since last {status.last_evaluation_type === 're_evaluation' ? 're-eval' : 'eval'}
            </>
          ) : (
            'Re-evaluation current'
          )}
        </span>
        {/* Pulse animation for yellow/red status */}
        {(status.color === 'yellow' || status.color === 'red') && (
          <span className="relative flex h-2 w-2 ml-1">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              status.color === 'red' ? 'bg-red-400' : 'bg-yellow-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              status.color === 'red' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></span>
          </span>
        )}
      </button>

      {/* Expandable details panel */}
      {showDetails && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-20 z-40"
            onClick={() => setShowDetails(false)}
          />
          
          {/* Details card */}
          <div className={`absolute right-0 mt-2 w-96 p-6 rounded-lg shadow-xl border z-50 animate-slideDown ${getBgColor()}`}>
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Re-evaluation Status
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {status.patient_name}
                </p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <span className="material-icons text-gray-500">close</span>
              </button>
            </div>

            {/* Status message */}
            <div className={`flex items-center gap-3 p-3 rounded-lg bg-white bg-opacity-60 mb-4`}>
              <span className={`material-icons text-2xl ${getStatusColor()}`}>
                {getStatusIcon()}
              </span>
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {status.message}
                </p>
                {status.last_evaluation_type === 're_evaluation' && (
                  <p className="text-xs text-gray-600 mt-1">
                    Tracking from most recent re-evaluation
                  </p>
                )}
              </div>
            </div>

            {/* Progress indicators */}
            <div className="space-y-3">
              {/* Days progress - only show if we have a last evaluation */}
              {status.days_since_last !== null && (
                <div>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>Days since evaluation</span>
                    <span className="font-medium">{status.days_since_last} days</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-500 ${
                        status.days_since_last <= 30 ? 'bg-green-500' :
                        status.days_since_last <= 45 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.min(100, (status.days_since_last / 45) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Sessions progress */}
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Sessions since evaluation</span>
                  <span className="font-medium">{status.sessions_since_evaluation}/12</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-500 ${
                      status.sessions_since_evaluation < 10 ? 'bg-green-500' :
                      status.sessions_since_evaluation < 12 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, (status.sessions_since_evaluation / 12) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Additional info */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {status.last_evaluation_date && (
                <div className="flex justify-between text-xs text-gray-600">
                  <span>Last {status.last_evaluation_type === 're_evaluation' ? 're-evaluation' : 'evaluation'}</span>
                  <span>{new Date(status.last_evaluation_date).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>Total patient sessions</span>
                <span>{status.session_count}</span>
              </div>
            </div>

            {/* Guidelines reminder */}
            {(status.color === 'yellow' || status.color === 'red') && (
              <div className="mt-4 p-3 bg-white bg-opacity-40 rounded-lg">
                <p className="text-xs text-gray-700 flex items-start gap-1">
                  <span className="material-icons text-sm">info</span>
                  Re-evaluations should be performed every 30-45 days or after 12 sessions.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default ReEvaluationIndicator;