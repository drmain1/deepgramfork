/**
 * Custom hook for managing PDF generation from transcripts
 */

import { useState } from 'react';
import { auth } from '../firebaseConfig';
import { generatePdfFromText } from '../components/pdfUtils';
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
      console.error('PDF generation error:', error);
      
      // Fallback to old PDF generation method if server fails
      console.log('Falling back to client-side PDF generation');
      
      try {
        // Use the already sorted transcripts from the main try block
        const sortedTranscripts = selectedTranscriptObjects;
      
      // Check if any transcripts have content
      const hasContent = sortedTranscripts.some(t => 
        t.polishedTranscript || t.transcript
      );
      
      if (!hasContent) {
        // If no content, we need to fetch individual transcripts
        const token = await auth.currentUser?.getIdToken();
        
        for (let i = 0; i < sortedTranscripts.length; i++) {
          const transcript = sortedTranscripts[i];
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
      for (let i = 0; i < sortedTranscripts.length; i++) {
        const transcript = sortedTranscripts[i];
        
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
        
      } catch (fallbackError) {
        console.error('Fallback PDF generation also failed:', fallbackError);
        alert(ERROR_MESSAGES.GENERATE_PDF_ERROR);
        return false;
      }
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