import React from 'react';

function EvaluationTypeSelector({ 
  evaluationType, 
  setEvaluationType, 
  recommendedEvalType, 
  onTypeChange, 
  isNewPatient = false,
  loadingFindings = false,
  previousFindings = null,
  onLoadFindings = null
}) {
  const handleTypeChange = (type) => {
    setEvaluationType(type);
    if (onTypeChange) {
      onTypeChange(type);
    }
  };

  // For new patients, only show Initial Evaluation
  // For existing patients on follow-up, show option to switch to Re-evaluation
  const showFollowUp = !isNewPatient && evaluationType !== 'initial';
  const showReEvaluation = !isNewPatient && evaluationType === 'follow_up';

  return (
    <div className="flex items-center gap-2 mt-4">
      <span className="text-sm font-medium text-gray-600">Visit Type:</span>
      <div className="flex gap-2">
        {/* Initial Evaluation Button - Always show for new patients */}
        {(isNewPatient || evaluationType === 'initial') && (
          <button
            type="button"
            onClick={() => handleTypeChange('initial')}
            className={`px-4 py-2 text-sm rounded-lg border transition-all duration-150 ${
              evaluationType === 'initial'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-medium'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            Initial Evaluation
            {recommendedEvalType === 'initial' && (
              <span className="ml-1 text-xs">(Recommended)</span>
            )}
          </button>
        )}

        {/* Follow-up Visit - Only show for existing patients */}
        {showFollowUp && evaluationType === 'follow_up' && (
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-lg border border-indigo-600 bg-indigo-50 text-indigo-700 font-medium cursor-default"
            disabled
          >
            Follow-up Visit
          </button>
        )}

        {/* Re-evaluation Option - Show when on follow-up */}
        {showReEvaluation && (
          <button
            type="button"
            onClick={() => handleTypeChange('re_evaluation')}
            className="px-4 py-2 text-sm rounded-lg border border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all duration-150 flex items-center gap-1"
          >
            <span className="material-icons text-base">swap_horiz</span>
            Switch to Re-evaluation
            {recommendedEvalType === 're_evaluation' && (
              <span className="ml-1 text-xs">(Recommended)</span>
            )}
          </button>
        )}

        {/* Re-evaluation - Show when selected */}
        {evaluationType === 're_evaluation' && (
          <>
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg border border-indigo-600 bg-indigo-50 text-indigo-700 font-medium cursor-default"
              disabled
            >
              Re-evaluation
            </button>
            
            {/* Load Previous Findings button - shows immediately after switching */}
            {onLoadFindings && !previousFindings && (
              <button
                type="button"
                onClick={onLoadFindings}
                disabled={loadingFindings}
                className={`px-4 py-2 text-sm rounded-lg border transition-all duration-150 flex items-center gap-2 ${
                  loadingFindings 
                    ? 'border-gray-300 bg-gray-50 text-gray-500 cursor-not-allowed' 
                    : 'border-purple-500 bg-purple-50 text-purple-700 hover:bg-purple-100 animate-pulse'
                }`}
              >
                {loadingFindings ? (
                  <>
                    <svg 
                      className="animate-spin h-3 w-3" 
                      xmlns="http://www.w3.org/2000/svg" 
                      fill="none" 
                      viewBox="0 0 24 24"
                    >
                      <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                      />
                      <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Loading...
                  </>
                ) : (
                  <>
                    <span className="material-icons text-base">download</span>
                    Load Previous Findings
                  </>
                )}
              </button>
            )}
            
            {/* Success indicator when findings are loaded */}
            {previousFindings && (
              <span className="px-3 py-2 text-sm text-green-700 bg-green-50 rounded-lg flex items-center gap-1">
                <span className="material-icons text-base">check_circle</span>
                Findings Loaded
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default EvaluationTypeSelector;