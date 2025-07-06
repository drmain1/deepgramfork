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
      
      // Create combined transcript content
      let combinedContent = '';
      
      // Count total follow-up visits first to get accurate numbering
      let totalFollowUpsBefore = 0;
      for (let j = 0; j < selectedTranscriptObjects.length; j++) {
        if (isFollowUpVisit(selectedTranscriptObjects[j].encounterType)) {
          totalFollowUpsBefore++;
        }
      }
      
      let followUpVisitCount = 0;
      
      // Add each transcript
      for (let i = 0; i < selectedTranscriptObjects.length; i++) {
        const transcript = selectedTranscriptObjects[i];
        // Get transcript content (prefer polished over original)
        let content = transcript.polishedTranscript || 
                     transcript.transcript || 
                     PDF_CONSTANTS.NO_CONTENT_MESSAGE;
        
        // Only add date headers to follow-up visits to avoid breaking table detection
        // Initial visits will have their dates shown via clinic location headers
        if (transcript.date && isFollowUpVisit(transcript.encounterType)) {
          followUpVisitCount++;
          
          // Format the date from the transcript
          const visitDate = new Date(transcript.date);
          const formattedDate = visitDate.toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          });
          
          // Check if content starts with "Follow up treatment date:" and remove it
          const followUpDatePattern = /^Follow up treatment date:\s*\d{4}-\d{2}-\d{2}\.?\s*/i;
          if (followUpDatePattern.test(content.trim())) {
            content = content.trim().replace(followUpDatePattern, '');
          }
          
          // Add visit header for follow-ups only
          content = `${formattedDate} - Visit #${followUpVisitCount}\n\n${content.trim()}`;
        }
        
        // Check if content already has a clinic location header
        const hasClinicLocationHeader = content.startsWith(PDF_CONSTANTS.CLINIC_LOCATION_PREFIX);
        
        // Use utility function to determine if we should add a clinic header
        // Only add if: content doesn't already have it, location exists, and encounter type warrants it
        if (!hasClinicLocationHeader && 
            transcript.location && 
            transcript.location.trim() && 
            shouldShowClinicHeader(transcript.encounterType)) {
          // Add date to clinic header for initial visits
          let clinicHeader = PDF_CONSTANTS.LOCATION_HEADER_TEMPLATE(transcript.location);
          if (transcript.date && isInitialVisit(transcript.encounterType)) {
            const visitDate = new Date(transcript.date);
            const formattedDate = visitDate.toLocaleDateString('en-US', { 
              month: 'long', 
              day: 'numeric', 
              year: 'numeric' 
            });
            clinicHeader = `CLINIC LOCATION:\n${transcript.location.trim()}\n${formattedDate}\n\n---\n\n`;
          }
          content = clinicHeader + content;
        }
        
        combinedContent += content;
        
        // Add separator only between initial examination and first follow-up visit
        if (i < selectedTranscriptObjects.length - 1) {
          const currentIsInitial = isInitialVisit(transcript.encounterType);
          const nextIsFollowUp = isFollowUpVisit(selectedTranscriptObjects[i + 1].encounterType);
          
          // Only add separator if current is initial and next is follow-up
          if (currentIsInitial && nextIsFollowUp) {
            combinedContent += `\n\n${PDF_CONSTANTS.SEPARATOR}\n\nFOLLOW-UP VISITS\n\n`;
          } else {
            // Just add some spacing between other visits
            combinedContent += `\n\n`;
          }
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