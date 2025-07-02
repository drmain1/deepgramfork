import React from 'react';
import FormattedMedicalText from './FormattedMedicalText';
import { convertFindingsToMarkdown } from '../utils/findingsFormatter';
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
            {/* Use the same logic as PreviousFindingsEnhanced to get markdown content */}
            {(() => {
              let markdownContent = '';
              
              // First, check if we have valid markdown in the _markdown field
              if (previousFindings._markdown) {
                const trimmedContent = previousFindings._markdown.trim();
                
                // Check if it's actual markdown (contains markdown indicators)
                if (typeof previousFindings._markdown === 'string' && 
                    (trimmedContent.includes('#') || trimmedContent.includes('*') || trimmedContent.includes('-')) &&
                    !trimmedContent.startsWith('{') && !trimmedContent.startsWith('[')) {
                  // This looks like valid markdown, use it
                  markdownContent = previousFindings._markdown;
                } else {
                  // Convert from findings object
                  markdownContent = convertFindingsToMarkdown(previousFindings);
                }
              } else {
                // No _markdown field, convert from findings object
                markdownContent = convertFindingsToMarkdown(previousFindings);
              }
              
              return <FormattedMedicalText content={markdownContent} />;
            })()}
          </div>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="includeFindings"
                checked={includePreviousFindingsInPrompt}
                onChange={(e) => setIncludePreviousFindingsInPrompt(e.target.checked)}
                className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="includeFindings" className="flex-1 cursor-pointer">
                <span className="block text-sm font-medium text-gray-800">
                  Include previous findings in AI prompt
                </span>
                <span className="block text-xs text-gray-600 mt-1">
                  When enabled, the AI will automatically compare current findings with the initial evaluation. 
                  Disable this if you prefer to manually reference the findings.
                </span>
              </label>
            </div>
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Tip:</span> 
                {includePreviousFindingsInPrompt 
                  ? " The previous findings will be automatically included in your transcription context for easy comparison during the re-evaluation."
                  : " You can view previous findings on the side panel during recording but they won't be sent to the AI."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReEvaluationWorkflow;