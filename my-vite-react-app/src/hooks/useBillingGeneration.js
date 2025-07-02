/**
 * Custom hook for managing billing generation
 */

import { useState } from 'react';
import { generateBilling } from '../utils/billingUtils';
import { TIMING, ERROR_MESSAGES } from '../constants/patientTranscriptConstants';

export function useBillingGeneration() {
  const [generatingBilling, setGeneratingBilling] = useState(false);
  const [showBillingDialog, setShowBillingDialog] = useState(false);
  const [billingData, setBillingData] = useState(null);
  const [billingProgress, setBillingProgress] = useState({ step: 0, message: '' });
  const [showBillingProgress, setShowBillingProgress] = useState(false);

  const handleGenerateBilling = async (patientId, selectedTranscriptIds) => {
    if (selectedTranscriptIds.length === 0) return;
    
    setGeneratingBilling(true);
    setShowBillingProgress(true);
    
    try {
      const data = await generateBilling(
        patientId, 
        selectedTranscriptIds,
        setBillingProgress
      );
      
      // Wait for completion animation
      setTimeout(() => {
        setShowBillingProgress(false);
        setBillingData(data);
        setShowBillingDialog(true);
      }, TIMING.BILLING_COMPLETE_DELAY);
      
    } catch (error) {
      setShowBillingProgress(false);
      alert(ERROR_MESSAGES.GENERATE_BILLING_ERROR);
    } finally {
      setGeneratingBilling(false);
    }
  };

  const closeBillingDialog = () => {
    setShowBillingDialog(false);
    setBillingData(null);
  };

  return {
    generatingBilling,
    showBillingDialog,
    billingData,
    billingProgress,
    showBillingProgress,
    handleGenerateBilling,
    closeBillingDialog
  };
}