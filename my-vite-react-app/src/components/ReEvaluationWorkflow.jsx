import React from 'react';
import PreviousFindings from './PreviousFindings';

function ReEvaluationWorkflow({ 
  previousFindings
}) {
  // Only show when findings are loaded
  if (!previousFindings) {
    return null;
  }

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
              Previous findings loaded - ready to compare
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-indigo-100">Step 2 of 2</p>
            <p className="text-xs text-indigo-200 mt-1">Start recording</p>
          </div>
        </div>
      </div>
      
      <div className="mt-6 bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-medium text-gray-800">
              Previous Initial Evaluation Findings
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
              <span className="font-medium">Tip:</span> The previous findings will be automatically included in your transcription context for easy comparison during the re-evaluation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReEvaluationWorkflow;