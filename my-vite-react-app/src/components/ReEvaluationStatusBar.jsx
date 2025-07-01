import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';

function ReEvaluationStatusBar({ patient, useBlueTheme = false }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();

  useEffect(() => {
    if (patient?.id) {
      fetchReEvaluationStatus();
    }
  }, [patient?.id]);

  const fetchReEvaluationStatus = async () => {
    setLoading(true);
    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
      const token = await getToken();
      
      const response = await fetch(
        `${API_BASE_URL}/api/v1/patients/${patient.id}/re-evaluation-status`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      }
    } catch (error) {
      console.error('Error fetching re-evaluation status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!patient || loading) {
    return null;
  }

  if (!status) {
    return null;
  }

  // Determine background color based on status
  const getBackgroundColor = () => {
    switch (status.color) {
      case 'green':
        return 'bg-green-100 border-green-300';
      case 'yellow':
        return 'bg-yellow-100 border-yellow-300';
      case 'red':
        return 'bg-red-100 border-red-300';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  // Determine text color based on status
  const getTextColor = () => {
    switch (status.color) {
      case 'green':
        return 'text-green-800';
      case 'yellow':
        return 'text-yellow-800';
      case 'red':
        return 'text-red-800';
      default:
        return 'text-gray-800';
    }
  };

  // Determine icon based on status
  const getIcon = () => {
    switch (status.color) {
      case 'green':
        return 'check_circle';
      case 'yellow':
        return 'warning';
      case 'red':
        return 'error';
      default:
        return 'info';
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${getBackgroundColor()} transition-all duration-300 animate-slideDown`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`material-icons text-2xl ${getTextColor()}`}>
            {getIcon()}
          </span>
          <div>
            <h3 className={`text-lg font-semibold ${getTextColor()}`}>
              Re-evaluation Status
            </h3>
            <p className={`text-base ${getTextColor()} mt-1`}>
              {status.message}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <div className={`text-sm ${getTextColor()}`}>
            <div>Sessions Since Evaluation: <span className="font-semibold">{status.sessions_since_evaluation}/12</span></div>
            <div className="mt-1">Total Patient Sessions: <span className="font-semibold">{status.session_count}</span></div>
            {status.last_evaluation_date && (
              <div className="mt-1">
                Last {status.last_evaluation_type === 're_evaluation' ? 'Re-evaluation' : 'Evaluation'}: 
                <span className="font-semibold ml-1">
                  {new Date(status.last_evaluation_date).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Help text */}
      {status.color === 'yellow' || status.color === 'red' ? (
        <div className={`mt-3 text-xs ${getTextColor()} opacity-80`}>
          <span className="material-icons text-xs mr-1">info</span>
          Re-evaluations should be performed every 30-45 days or after 12 sessions, whichever comes first.
        </div>
      ) : null}

      {/* Progress indicators */}
      <div className="mt-4">
        <div className="flex items-center gap-2 text-sm">
          <span className={getTextColor()}>Days since evaluation:</span>
          <div className="flex gap-1">
            {/* Visual progress bar for days */}
            {[...Array(9)].map((_, i) => {
              const dayThreshold = (i + 1) * 5; // 5, 10, 15, 20, 25, 30, 35, 40, 45
              const isActive = status.days_since_last >= dayThreshold;
              const isWarning = dayThreshold > 30 && dayThreshold <= 45;
              const isDanger = dayThreshold > 45;
              
              return (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isActive
                      ? isDanger
                        ? 'bg-red-500'
                        : isWarning
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                  title={`${dayThreshold} days`}
                />
              );
            })}
            <span className={`ml-2 font-semibold ${getTextColor()}`}>
              {status.days_since_last} days
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm mt-2">
          <span className={getTextColor()}>Sessions since {status.last_evaluation_type === 're_evaluation' ? 're-evaluation' : 'evaluation'}:</span>
          <div className="flex gap-1">
            {/* Visual progress bar for sessions since last evaluation */}
            {[...Array(12)].map((_, i) => {
              const isActive = status.sessions_since_evaluation > i;
              const isWarning = i >= 9 && i < 12;
              const isDanger = i >= 11;
              
              return (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    isActive
                      ? isDanger
                        ? 'bg-red-500'
                        : isWarning
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                  title={`Session ${i + 1} since last evaluation`}
                />
              );
            })}
            <span className={`ml-2 font-semibold ${getTextColor()}`}>
              {status.sessions_since_evaluation}/12
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReEvaluationStatusBar;