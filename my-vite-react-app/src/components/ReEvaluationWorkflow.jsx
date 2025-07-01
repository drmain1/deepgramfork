import React, { useState } from 'react';
import PreviousFindings from './PreviousFindings';
import { useAuth } from '../contexts/FirebaseAuthContext';

function ReEvaluationWorkflow({ 
  selectedPatient, 
  previousFindings, 
  onFindingsLoaded,
  initialEvaluationId,
  onEvaluationIdSet
}) {
  const [loadingFindings, setLoadingFindings] = useState(false);
  const { getToken } = useAuth();

  const handleLoadFindings = async () => {
    setLoadingFindings(true);
    try {
      const token = await getToken();
      const response = await fetch(`/api/v1/patients/${selectedPatient.id}/initial-evaluation`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const evaluation = await response.json();
        onEvaluationIdSet(evaluation.id);
        
        // Extract findings if not already done
        if (evaluation.positive_findings) {
          // Check if we need to re-extract due to old format
          const needsReExtraction = evaluation.positive_findings.raw_findings && 
                                  !evaluation.positive_findings.pain_findings &&
                                  !evaluation.positive_findings_markdown;
          
          if (needsReExtraction) {
            // Trigger re-extraction for old format
            const extractResponse = await fetch(`/api/v1/transcripts/${evaluation.id}/extract-findings`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (extractResponse.ok) {
              const extractResult = await extractResponse.json();
              if (extractResult.success && extractResult.findings) {
                onFindingsLoaded({
                  ...extractResult.findings,
                  date: evaluation.date || evaluation.created_at,
                  _markdown: extractResult.findings_markdown || null
                });
              }
            }
          } else {
            onFindingsLoaded({
              ...evaluation.positive_findings,
              date: evaluation.date || evaluation.created_at,
              // Include markdown version if available
              _markdown: evaluation.positive_findings_markdown || null
            });
          }
        } else {
          // Trigger extraction of findings
          const extractResponse = await fetch(`/api/v1/transcripts/${evaluation.id}/extract-findings`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (extractResponse.ok) {
            const extractResult = await extractResponse.json();
            
            if (extractResult.success && extractResult.findings) {
              onFindingsLoaded({
                ...extractResult.findings,
                date: evaluation.date || evaluation.created_at,
                // Include markdown version if available
                _markdown: extractResult.findings_markdown || null
              });
            } else {
              alert('Failed to extract findings from the previous evaluation');
            }
          } else {
            alert('Failed to extract findings from the previous evaluation');
          }
        }
      } else if (response.status === 404) {
        alert('No initial evaluation found for this patient');
      }
    } catch (error) {
      alert('Failed to load previous findings');
    } finally {
      setLoadingFindings(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-xl text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-semibold flex items-center gap-3">
              <span className="material-icons text-3xl">assessment</span>
              Re-evaluation Workflow
            </h3>
            <p className="text-indigo-100 mt-2">
              Compare current findings with initial evaluation
            </p>
          </div>
          {!previousFindings && (
            <div className="text-right">
              <p className="text-sm text-indigo-100">Step 1 of 2</p>
              <p className="text-xs text-indigo-200 mt-1">Load previous findings</p>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-6 bg-white p-6 rounded-lg shadow-md border border-gray-200">
        {!previousFindings ? (
          <button
            type="button"
            disabled={loadingFindings}
            onClick={handleLoadFindings}
            className={`bg-indigo-600 text-white px-6 py-3 rounded-lg transition-all text-lg flex items-center justify-center ${
              loadingFindings ? 'opacity-75 cursor-not-allowed' : 'hover:bg-indigo-700'
            }`}
          >
            {loadingFindings ? (
              <>
                <svg 
                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
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
                Loading Previous Findings...
              </>
            ) : (
              'Load Previous Findings'
            )}
          </button>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-gray-800">
                Previous Findings Loaded
              </h4>
              <span className="text-sm text-green-600 flex items-center gap-1">
                <span className="material-icons text-base">check_circle</span>
                Ready to compare
              </span>
            </div>
            <div className="max-h-96 overflow-y-auto bg-gray-50 p-4 rounded-lg">
              <PreviousFindings 
                findings={previousFindings} 
                evaluationDate={previousFindings.date}
              />
            </div>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Tip:</span> The previous findings will be automatically included in your transcription context for easy comparison.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ReEvaluationWorkflow;