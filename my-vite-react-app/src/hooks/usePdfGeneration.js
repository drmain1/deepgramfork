/**
 * Custom hook for managing PDF generation from transcripts
 */

import { useState } from 'react';
import { auth } from '../firebaseConfig';
// Removed: import { generatePdfFromText } from '../components/pdfUtils'; - now using server-side PDF generation
import { useServerPdfGeneration } from './useServerPdfGeneration';
import { shouldShowClinicHeader, isInitialVisit, isFollowUpVisit } from '../utils/encounterTypeUtils';
import { PDF_CONSTANTS, ERROR_MESSAGES } from '../constants/patientTranscriptConstants';

export function usePdfGeneration(patient, userSettings) {
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [generatingDownload, setGeneratingDownload] = useState(false);
  
  // Use the new server-side PDF generation
  const {
    downloadMultiVisitPDF,
    openMultiVisitPDFInNewTab,
    convertTranscriptToStructured,
    loading: serverLoading,
    error: serverError
  } = useServerPdfGeneration();

  const generateTranscriptsPDF = async (selectedTranscriptObjects, previewMode = false, fetchTranscriptDetails) => {
    if (selectedTranscriptObjects.length === 0) return;
    
    // Set the appropriate loading state based on mode
    if (previewMode) {
      setGeneratingPreview(true);
    } else {
      setGeneratingDownload(true);
    }
    
    try {
      // Sort transcripts by date (oldest first) before processing
      const sortedTranscripts = selectedTranscriptObjects.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      // Fetch transcript details and convert to structured format for WeasyPrint
      const visits = [];
      
      for (const transcript of sortedTranscripts) {
        // Fetch detailed transcript if needed
        if (!transcript.polishedTranscript && !transcript.transcript) {
          const detailedTranscript = await fetchTranscriptDetails(transcript.id);
          if (detailedTranscript) {
            transcript.transcript = detailedTranscript.originalTranscript || 
                                  detailedTranscript.transcript || 
                                  detailedTranscript.original_transcript;
            transcript.polishedTranscript = detailedTranscript.polishedTranscript || 
                                          detailedTranscript.polished_transcript || 
                                          detailedTranscript.transcript_polished;
          }
        }
        
        // Convert transcript to structured format for WeasyPrint
        const content = transcript.polishedTranscript || 
                       transcript.transcript || 
                       PDF_CONSTANTS.NO_CONTENT_MESSAGE;
        
        const structuredData = convertTranscriptToStructured(content, {
          name: `${patient.first_name} ${patient.last_name}`,
          dateOfTreatment: new Date(transcript.date).toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })
        });
        
        // Add additional info from transcript metadata
        if (structuredData.patient_info) {
          structuredData.patient_info.date_of_treatment = new Date(transcript.date).toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          });
        }
        
        // Add clinic info if available
        if (transcript.location) {
          structuredData.clinic_info = {
            name: transcript.location
          };
        }
        
        visits.push(structuredData);
      }
      
      // Use server-side PDF generation for WeasyPrint
      const patientName = `${patient.first_name} ${patient.last_name}`;
      
      if (previewMode) {
        await openMultiVisitPDFInNewTab(visits, patientName);
      } else {
        await downloadMultiVisitPDF(visits, patientName);
      }
      
      return true; // Success
      
    } catch (error) {
      console.error('Server-side PDF generation failed:', error);
      alert(ERROR_MESSAGES.GENERATE_PDF_ERROR);
      return false;
    } finally {
      // Reset the appropriate loading state based on mode
      if (previewMode) {
        setGeneratingPreview(false);
      } else {
        setGeneratingDownload(false);
      }
    }
  };

  return {
    generatingPreview,
    generatingDownload,
    generateTranscriptsPDF
  };
}