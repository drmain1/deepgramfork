import React, { useEffect, useRef } from 'react';

function ReEvaluationWorkflow({ 
  previousFindings
}) {
  const logCountRef = useRef(0);
  
  // Debug: Log the findings object with rate limiting
  useEffect(() => {
    if (logCountRef.current < 5) {
      console.log('ReEvaluationWorkflow received previousFindings:', previousFindings);
      logCountRef.current++;
    }
  }, [previousFindings]);
  
  // Only show when findings are loaded
  if (!previousFindings) {
    return (
      <div className="mt-6">
        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <p className="text-sm text-yellow-800">
            Debug: No previousFindings received by ReEvaluationWorkflow
          </p>
        </div>
      </div>
    );
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
        
        {/* Debug info */}
        <div className="mt-3 p-2 bg-white rounded border">
          <p className="text-xs font-mono text-gray-600">
            Debug: Findings keys: {Object.keys(previousFindings || {}).join(', ')}
          </p>
          <p className="text-xs font-mono text-gray-600">
            Has _markdown: {!!previousFindings?._markdown}
          </p>
          <p className="text-xs font-mono text-gray-600">
            _markdown type: {typeof previousFindings?._markdown}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ReEvaluationWorkflow;