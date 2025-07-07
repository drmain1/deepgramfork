import { useState } from 'react';
import { auth } from '../firebaseConfig';

/**
 * Custom hook for server-side PDF generation using the new backend service
 * This replaces the client-side HTML rendering approach with structured data
 */
export const useServerPdfGeneration = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generatePDF = async (transcriptData, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const token = await user.getIdToken();
      
      // Determine API endpoint based on input type
      const isStructured = typeof transcriptData === 'object' && transcriptData.patient_info;
      const endpoint = isStructured ? '/api/generate-pdf' : '/api/generate-pdf-from-transcript';
      
      // Prepare request body
      const requestBody = isStructured 
        ? transcriptData 
        : {
            transcript: transcriptData,
            format_type: options.formatType || 'structured',
            include_watermark: options.includeWatermark || false,
            include_signature: options.includeSignature !== false
          };
      
      // Send to backend
      const response = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf'
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`PDF generation failed: ${errorText}`);
      }
      
      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error(`Expected PDF response but got: ${contentType}`);
      }
      
      // Get PDF blob
      const blob = await response.blob();
      
      // Create download URL
      const url = URL.createObjectURL(blob);
      
      // Extract filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'medical_record.pdf';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Return URL and filename for flexible usage
      return { url, filename, blob };
      
    } catch (error) {
      console.error('PDF generation error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const generatePDFPreview = async (transcriptData) => {
    setLoading(true);
    setError(null);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const token = await user.getIdToken();
      
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-pdf-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(transcriptData),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'PDF preview generation failed');
      }
      
      // Convert base64 to blob for preview
      const byteCharacters = atob(result.pdf_data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      return { url, filename: result.filename, blob };
      
    } catch (error) {
      console.error('PDF preview error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async (transcriptData, filename = 'medical_record.pdf') => {
    try {
      const { url, filename: responseFilename } = await generatePDF(transcriptData);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = responseFilename || filename;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('PDF download error:', error);
      throw error;
    }
  };

  const openPDFInNewTab = async (transcriptData) => {
    try {
      const { url } = await generatePDF(transcriptData);
      
      // Open in new tab
      window.open(url, '_blank');
      
      // Cleanup after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000); // Clean up after 1 minute
      
    } catch (error) {
      console.error('PDF open error:', error);
      throw error;
    }
  };

  /**
   * Convert markdown transcript to structured data format
   * This is a helper for transitioning from the old format
   */
  const convertTranscriptToStructured = (transcript, patientInfo = {}) => {
    // Try to parse if it's already JSON
    try {
      const parsed = JSON.parse(transcript);
      if (parsed.patient_info) {
        return parsed;
      }
    } catch (e) {
      // Not JSON, continue with conversion
    }

    // Extract sections from markdown
    const sections = {};
    const sectionRegex = /\*\*([A-Z\s/]+)\*\*:?\s*([^*]+(?:\n(?!\*\*)[^*]*)*)/g;
    let match;
    let hasStructuredSections = false;
    
    while ((match = sectionRegex.exec(transcript)) !== null) {
      const sectionName = match[1].trim().toLowerCase().replace(/\s+/g, '_').replace(/\//g, '_');
      const sectionContent = match[2].trim();
      sections[sectionName] = sectionContent;
      hasStructuredSections = true;
    }
    
    // If no structured sections found, treat as narrative follow-up visit
    if (!hasStructuredSections && transcript.trim()) {
      // Check if this looks like a follow-up visit (starts with "Follow up treatment date:")
      if (transcript.trim().toLowerCase().startsWith('follow up') || 
          transcript.includes('follow up treatment date') ||
          transcript.includes('returns for') ||
          transcript.includes('follow-up')) {
        sections['follow_up_visit'] = transcript.trim();
      } else {
        // For other narrative content, put it in a general section
        sections['clinical_notes'] = transcript.trim();
      }
    }

    // Extract patient info from transcript if not provided
    const extractedInfo = {
      patient_name: patientInfo.name || extractPatientName(transcript),
      date_of_birth: patientInfo.dateOfBirth || extractDate(transcript, 'Date of Birth'),
      date_of_accident: extractDate(transcript, 'Date of Accident'),
      date_of_treatment: patientInfo.dateOfTreatment || extractDate(transcript, 'Date of Treatment'),
    };

    // Extract motor exam if present
    const motorExam = extractMotorExam(transcript);
    const reflexes = extractReflexes(transcript);

    return {
      patient_info: extractedInfo,
      sections: sections,
      motor_exam: motorExam,
      reflexes: reflexes
    };
  };

  // Helper functions for extraction
  const extractPatientName = (text) => {
    const match = text.match(/Patient Name:\s*([^\n]+)/i);
    return match ? match[1].trim() : 'Unknown Patient';
  };

  const extractDate = (text, dateType) => {
    const regex = new RegExp(`${dateType}:\\s*([^\\n]+)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : null;
  };

  const extractMotorExam = (text) => {
    // Look for motor strength table
    if (!text.includes('MOTOR EXAMINATION') && !text.includes('Motor Strength')) {
      return null;
    }

    // This is simplified - in production, you'd want more robust parsing
    return null; // Let the backend handle table extraction for now
  };

  const extractReflexes = (text) => {
    // Look for reflex tables
    if (!text.includes('DEEP TENDON REFLEXES') && !text.includes('Reflexes')) {
      return null;
    }

    return null; // Let the backend handle table extraction for now
  };

  const generateMultiVisitPDF = async (visits, patientName, options = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      // Get auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const token = await user.getIdToken();
      
      // Prepare request body
      const requestBody = {
        visits: visits,
        patient_name: patientName,
        include_watermark: options.includeWatermark || false,
        include_signature: options.includeSignature !== false
      };
      
      // Send to backend
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/generate-multi-visit-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/pdf'
        },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Multi-visit PDF generation failed: ${errorText}`);
      }
      
      // Check if response is actually a PDF
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/pdf')) {
        throw new Error(`Expected PDF response but got: ${contentType}`);
      }
      
      // Get PDF blob
      const blob = await response.blob();
      
      // Create download URL
      const url = URL.createObjectURL(blob);
      
      // Extract filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `${patientName}_multi_visit.pdf`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      // Return URL and filename for flexible usage
      return { url, filename, blob };
      
    } catch (error) {
      console.error('Multi-visit PDF generation error:', error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const downloadMultiVisitPDF = async (visits, patientName, filename) => {
    try {
      const { url, filename: responseFilename } = await generateMultiVisitPDF(visits, patientName);
      
      // Create download link
      const a = document.createElement('a');
      a.href = url;
      a.download = responseFilename || filename || `${patientName}_multi_visit.pdf`;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
    } catch (error) {
      console.error('Multi-visit PDF download error:', error);
      throw error;
    }
  };

  const openMultiVisitPDFInNewTab = async (visits, patientName) => {
    try {
      const { url } = await generateMultiVisitPDF(visits, patientName);
      
      // Open in new tab
      window.open(url, '_blank');
      
      // Cleanup after a delay
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000); // Clean up after 1 minute
      
    } catch (error) {
      console.error('Multi-visit PDF open error:', error);
      throw error;
    }
  };

  return {
    generatePDF,
    generatePDFPreview,
    downloadPDF,
    openPDFInNewTab,
    generateMultiVisitPDF,
    downloadMultiVisitPDF,
    openMultiVisitPDFInNewTab,
    convertTranscriptToStructured,
    loading,
    error
  };
};