/**
 * Custom hook for managing PDF generation from transcripts
 */

import { useState } from 'react';
import { auth } from '../firebaseConfig';
import { generatePdfFromText } from '../components/pdfUtils';
import { shouldShowClinicHeader, isInitialVisit, isFollowUpVisit } from '../utils/encounterTypeUtils';
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
      
      // Create structured content for better PDF generation
      const structuredContent = {
        visits: [],
        hasFollowUpSection: false
      };
      
      let followUpVisitCount = 0;
      let lastWasInitial = false;
      
      // Process each transcript into structured format
      for (let i = 0; i < selectedTranscriptObjects.length; i++) {
        const transcript = selectedTranscriptObjects[i];
        
        // Get transcript content (prefer polished over original)
        let content = transcript.polishedTranscript || 
                     transcript.transcript || 
                     PDF_CONSTANTS.NO_CONTENT_MESSAGE;
        
        // Clean up any existing date headers in the content
        const followUpDatePattern = /^Follow up treatment date:\s*\d{4}-\d{2}-\d{2}\.?\s*/i;
        if (followUpDatePattern.test(content.trim())) {
          content = content.trim().replace(followUpDatePattern, '');
        }
        
        // Determine visit type and number
        let visitType = '';
        let visitNumber = null;
        
        if (isFollowUpVisit(transcript.encounterType)) {
          followUpVisitCount++;
          visitType = 'follow-up';
          visitNumber = followUpVisitCount;
        } else if (isInitialVisit(transcript.encounterType)) {
          visitType = 'initial';
          lastWasInitial = true;
        } else {
          visitType = 'other';
        }
        
        // Check if we need to add follow-up section header
        if (visitType === 'follow-up' && lastWasInitial && !structuredContent.hasFollowUpSection) {
          structuredContent.hasFollowUpSection = true;
          structuredContent.visits.push({
            type: 'section-header',
            content: 'FOLLOW-UP VISITS'
          });
        }
        
        // Format the date
        let formattedDate = '';
        if (transcript.date) {
          const visitDate = new Date(transcript.date);
          formattedDate = visitDate.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          });
        }
        
        // Create structured visit object
        const visitData = {
          type: 'visit',
          visitType: visitType,
          visitNumber: visitNumber,
          date: formattedDate,
          location: transcript.location || '',
          showLocationHeader: shouldShowClinicHeader(transcript.encounterType) && 
                             transcript.location && 
                             transcript.location.trim(),
          content: content.trim()
        };
        
        structuredContent.visits.push(visitData);
        
        if (visitType !== 'initial') {
          lastWasInitial = false;
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
        structuredContent,
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