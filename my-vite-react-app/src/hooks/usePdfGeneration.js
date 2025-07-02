/**
 * Custom hook for managing PDF generation from transcripts
 */

import { useState } from 'react';
import { auth } from '../firebaseConfig';
import { generatePdfFromText } from '../components/pdfUtils';
import { shouldShowClinicHeader } from '../utils/encounterTypeUtils';
import { PDF_CONSTANTS, ERROR_MESSAGES } from '../constants/patientTranscriptConstants';

export function usePdfGeneration(patient, userSettings) {
  const [generatingPreview, setGeneratingPreview] = useState(false);
  const [generatingDownload, setGeneratingDownload] = useState(false);

  const generateTranscriptsPDF = async (selectedTranscriptObjects, previewMode = false, fetchTranscriptDetails) => {
    if (selectedTranscriptObjects.length === 0) return;
    
    // Set the appropriate loading state based on mode
    if (previewMode) {
      setGeneratingPreview(true);
    } else {
      setGeneratingDownload(true);
    }
    
    try {
      // Sort by date (oldest first)
      selectedTranscriptObjects.sort((a, b) => 
        new Date(a.date) - new Date(b.date)
      );
      
      // Check if any transcripts have content
      const hasContent = selectedTranscriptObjects.some(t => 
        t.polishedTranscript || t.transcript
      );
      
      if (!hasContent) {
        // If no content, we need to fetch individual transcripts
        const token = await auth.currentUser?.getIdToken();
        
        for (let i = 0; i < selectedTranscriptObjects.length; i++) {
          const transcript = selectedTranscriptObjects[i];
          const detailedTranscript = await fetchTranscriptDetails(transcript.id);
          
          if (detailedTranscript) {
            // Handle both field naming conventions
            transcript.transcript = detailedTranscript.originalTranscript || 
                                  detailedTranscript.transcript || 
                                  detailedTranscript.original_transcript;
            transcript.polishedTranscript = detailedTranscript.polishedTranscript || 
                                          detailedTranscript.polished_transcript || 
                                          detailedTranscript.transcript_polished;
          }
        }
      }
      
      // Create combined transcript content
      let combinedContent = '';
      
      // Add each transcript
      for (let i = 0; i < selectedTranscriptObjects.length; i++) {
        const transcript = selectedTranscriptObjects[i];
        // Get transcript content (prefer polished over original)
        let content = transcript.polishedTranscript || 
                     transcript.transcript || 
                     PDF_CONSTANTS.NO_CONTENT_MESSAGE;
        
        // Check if content already has a clinic location header
        const hasClinicLocationHeader = content.startsWith(PDF_CONSTANTS.CLINIC_LOCATION_PREFIX);
        
        // Use utility function to determine if we should add a clinic header
        // Only add if: content doesn't already have it, location exists, and encounter type warrants it
        if (!hasClinicLocationHeader && 
            transcript.location && 
            transcript.location.trim() && 
            shouldShowClinicHeader(transcript.encounterType)) {
          content = PDF_CONSTANTS.LOCATION_HEADER_TEMPLATE(transcript.location) + content;
        }
        
        combinedContent += content;
        
        // Add separator between transcripts if not the last one
        if (i < selectedTranscriptObjects.length - 1) {
          combinedContent += `\n\n${PDF_CONSTANTS.SEPARATOR}\n\n`;
        }
      }
      
      // PDF options - match the format used in EditableNote
      const pdfOptions = {
        doctorName: userSettings.doctorName || '',
        doctorSignature: userSettings.doctorSignature || '',
        isSigned: true, // Assuming all saved transcripts are signed
        clinicLogo: userSettings.clinicLogo || '',
        includeLogoOnPdf: userSettings.includeLogoOnPdf || false,
        useProfessionalFormat: true,
        usePagedFormat: true,
        previewMode: previewMode // Add preview mode flag
      };
      
      await generatePdfFromText(
        combinedContent,
        `${patient.last_name}_${patient.first_name}_transcripts`,
        '', // location will be extracted from content
        pdfOptions
      );
      
      return true; // Success
      
    } catch (error) {
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