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

  // Function to parse and format JSON transcript data
  const formatTranscriptContent = (content) => {
    try {
      // Try to parse as JSON
      const data = typeof content === 'string' ? JSON.parse(content) : content;
      
      // If it's an object, format it nicely
      if (typeof data === 'object' && data !== null) {
        return formatJsonData(data);
      }
      
      // If it's already a string, return as is
      return content;
    } catch (e) {
      // If parsing fails, return the original content
      return content;
    }
  };

  // Function to format JSON data into human-readable format
  const formatJsonData = (data) => {
    const sections = [];
    
    // Patient Information
    if (data.patient_info || data.patientInfo) {
      const patientInfo = data.patient_info || data.patientInfo;
      sections.push({
        title: 'Patient Information',
        items: [
          patientInfo.patient_name && `Name: ${patientInfo.patient_name}`,
          patientInfo.date_of_birth && `DOB: ${patientInfo.date_of_birth}`,
          patientInfo.date_of_accident && `Date of Accident: ${patientInfo.date_of_accident}`,
          patientInfo.date_of_treatment && `Date of Treatment: ${patientInfo.date_of_treatment}`,
          patientInfo.provider && `Provider: ${patientInfo.provider}`
        ].filter(Boolean)
      });
    }
    
    // Clinic Information
    if (data.clinic_info) {
      sections.push({
        title: 'Clinic Information',
        items: [
          data.clinic_info.name && `Name: ${data.clinic_info.name}`,
          data.clinic_info.address && `Address: ${data.clinic_info.address}`,
          data.clinic_info.phone && `Phone: ${data.clinic_info.phone}`,
          data.clinic_info.fax && `Fax: ${data.clinic_info.fax}`
        ].filter(Boolean)
      });
    }
    
    // Chief Complaint
    if (data.chief_complaint) {
      sections.push({
        title: 'Chief Complaint',
        content: data.chief_complaint
      });
    }
    
    // History of Present Illness
    if (data.history_of_present_illness) {
      sections.push({
        title: 'History of Present Illness',
        content: data.history_of_present_illness
      });
    }
    
    // Past Medical/Surgical History
    if (data.past_medical_history || data.past_surgical_history) {
      const items = [];
      if (data.past_medical_history) items.push(`Medical: ${data.past_medical_history}`);
      if (data.past_surgical_history) items.push(`Surgical: ${data.past_surgical_history}`);
      sections.push({
        title: 'Past Medical/Surgical History',
        items
      });
    }
    
    // Current Medications
    if (data.current_medications) {
      sections.push({
        title: 'Current Medications',
        content: data.current_medications
      });
    }
    
    // Family History
    if (data.family_history) {
      sections.push({
        title: 'Family History',
        content: data.family_history
      });
    }
    
    // Handle any additional sections dynamically
    const knownKeys = ['patient_info', 'patientInfo', 'clinic_info', 'chief_complaint', 
                      'history_of_present_illness', 'past_medical_history', 'past_surgical_history',
                      'current_medications', 'family_history'];
    
    Object.keys(data).forEach(key => {
      if (!knownKeys.includes(key) && data[key]) {
        const title = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        if (typeof data[key] === 'object') {
          const items = Object.entries(data[key]).map(([k, v]) => 
            `${k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}: ${v}`
          );
          sections.push({ title, items });
        } else {
          sections.push({ title, content: data[key] });
        }
      }
    });
    
    return sections;
  };

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
                {(() => {
                  const formattedContent = formatTranscriptContent(lastTranscript.content);
                  
                  // If it's formatted sections, render them nicely
                  if (Array.isArray(formattedContent)) {
                    return (
                      <div className="space-y-6">
                        {formattedContent.map((section, index) => (
                          <div key={index} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">
                              {section.title}
                            </h3>
                            {section.content && (
                              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                                {section.content}
                              </p>
                            )}
                            {section.items && (
                              <ul className="space-y-2">
                                {section.items.map((item, idx) => (
                                  <li key={idx} className="text-gray-800">
                                    {item}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  
                  // Otherwise render as plain text
                  return (
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <pre className="whitespace-pre-wrap font-sans text-gray-800 leading-relaxed">
                        {formattedContent}
                      </pre>
                    </div>
                  );
                })()}
              </div>
              
              {/* Quick Actions */}
              <div className="mt-6 flex gap-3">
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors"
                  onClick={() => {
                    // Extract summary from JSON or use first line
                    let summary = '';
                    try {
                      const data = typeof lastTranscript.content === 'string' 
                        ? JSON.parse(lastTranscript.content) 
                        : lastTranscript.content;
                      
                      // Try to extract meaningful summary from JSON
                      if (data.chief_complaint) {
                        summary = `Chief complaint: ${data.chief_complaint}`;
                      } else if (data.history_of_present_illness) {
                        summary = `${data.history_of_present_illness.substring(0, 100)}...`;
                      } else if (data.sections && data.sections.chief_complaint) {
                        summary = `Chief complaint: ${data.sections.chief_complaint}`;
                      } else {
                        // Fallback to first meaningful value
                        const firstValue = Object.values(data).find(val => 
                          typeof val === 'string' && val.length > 10
                        );
                        summary = firstValue ? firstValue.substring(0, 100) + '...' : 'Previous visit data';
                      }
                    } catch (e) {
                      // If not JSON, use first line
                      summary = lastTranscript.content.split('\n')[0];
                    }
                    
                    const relevantInfo = `Previous visit (${lastTranscript.date}): ${summary}`;
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