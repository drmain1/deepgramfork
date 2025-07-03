import React from 'react';

function ReEvaluationWorkflow({ 
  previousFindings
}) {
  
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
      </div>
    </div>
  );
}

export default ReEvaluationWorkflow;