import React from 'react';

function LastTranscriptModal({ 
  show, 
  onClose, 
  selectedPatient, 
  lastTranscript, 
  loadingTranscript, 
  onCopyToContext 
}) {
  if (!show) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold flex items-center gap-3">
                <span className="material-icons">medical_information</span>
                Previous Visit Summary
              </h2>
              <p className="text-blue-100 mt-1">
                {selectedPatient?.last_name}, {selectedPatient?.first_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <span className="material-icons text-2xl">close</span>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 180px)' }}>
          {loadingTranscript ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">Loading transcript...</p>
            </div>
          ) : lastTranscript ? (
            <div>
              {/* Date Badge */}
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full text-gray-700">
                  <span className="material-icons text-sm">calendar_today</span>
                  <span className="font-medium">Visit Date: {lastTranscript.date}</span>
                </span>
              </div>
              
              {/* Transcript Content */}
              <div className="prose prose-lg max-w-none">
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                  <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                    {lastTranscript.content}
                  </pre>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    // Copy relevant info to context
                    const relevantInfo = `Previous visit (${lastTranscript.date}): ${lastTranscript.content.split('\n')[0]}`;
                    onCopyToContext(relevantInfo);
                    onClose();
                  }}
                >
                  <span className="material-icons text-sm">content_copy</span>
                  Copy Summary to Context
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="material-icons text-6xl text-gray-300 mb-4">description</span>
              <p className="text-gray-600">No previous transcripts found for this patient.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LastTranscriptModal;