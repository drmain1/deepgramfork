import React from 'react';
import useTranscriptionSessionStore from '../stores/transcriptionSessionStore';

function ReEvaluationWorkflow({ 
  previousFindings
}) {
  const { includePreviousFindingsInPrompt, setIncludePreviousFindingsInPrompt } = useTranscriptionSessionStore();
  
  // Only show when findings are loaded
  if (!previousFindings) {
    return null;
  }

  return (
    <div className="mt-6">
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-icons text-blue-600">check_circle</span>
            <div>
              <p className="text-sm font-medium text-gray-800">
                Re-evaluation Ready
              </p>
              <p className="text-xs text-gray-600">
                Previous findings loaded and will be displayed during recording
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            id="includeFindings"
            checked={includePreviousFindingsInPrompt}
            onChange={(e) => setIncludePreviousFindingsInPrompt(e.target.checked)}
            className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
          />
          <label htmlFor="includeFindings" className="flex-1 cursor-pointer">
            <span className="block text-xs font-medium text-gray-700">
              Include in AI processing
            </span>
            <span className="block text-xs text-gray-500">
              {includePreviousFindingsInPrompt 
                ? "AI will compare findings automatically"
                : "Findings visible but not sent to AI"}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}

export default ReEvaluationWorkflow;