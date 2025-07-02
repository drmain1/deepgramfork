/**
 * Utility functions for billing generation
 */

import { auth } from '../firebaseConfig';
import { API_ENDPOINTS, BILLING_STEPS, TIMING } from '../constants/patientTranscriptConstants';

/**
 * Generate billing for selected transcripts
 * @param {string} patientId - Patient ID
 * @param {Array<string>} transcriptIds - Array of transcript IDs
 * @param {Function} onProgress - Progress callback function
 * @returns {Promise<Object>} Billing data
 */
export async function generateBilling(patientId, transcriptIds, onProgress) {
  // Initial progress
  onProgress(BILLING_STEPS.GATHERING);
  
  try {
    const token = await auth.currentUser?.getIdToken();
    
    // Simulate progress steps
    setTimeout(() => {
      onProgress(BILLING_STEPS.ANALYZING);
    }, TIMING.BILLING_STEP_2_DELAY);
    
    // Empty billing instructions - backend will use base + custom rules
    const billingInstructions = "";
    
    setTimeout(() => {
      onProgress(BILLING_STEPS.PROCESSING);
    }, TIMING.BILLING_STEP_3_DELAY);
    
    const response = await fetch(API_ENDPOINTS.GENERATE_BILLING(patientId), {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcript_ids: transcriptIds,
        billing_instructions: billingInstructions
      })
    });
    
    onProgress(BILLING_STEPS.FINALIZING);
    
    if (response.ok) {
      const data = await response.json();
      
      setTimeout(() => {
        onProgress(BILLING_STEPS.COMPLETE);
      }, TIMING.BILLING_COMPLETE_DELAY);
      
      return data;
    } else {
      const errorText = await response.text();
      throw new Error(errorText || 'Failed to generate billing');
    }
  } catch (error) {
    throw error;
  }
}