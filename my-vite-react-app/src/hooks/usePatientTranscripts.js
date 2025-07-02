/**
 * Custom hook for managing patient transcripts data and operations
 */

import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants/patientTranscriptConstants';

export function usePatientTranscripts(patientId, isAuthenticated) {
  const [patient, setPatient] = useState(null);
  const [transcripts, setTranscripts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isAuthenticated && patientId) {
      fetchPatientData();
    }
  }, [isAuthenticated, patientId]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();
      
      // Fetch patient info
      const patientResponse = await fetch(API_ENDPOINTS.GET_PATIENT(patientId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (patientResponse.ok) {
        const patientData = await patientResponse.json();
        setPatient(patientData);
      } else {
        throw new Error(ERROR_MESSAGES.FETCH_PATIENT_FAILED);
      }
      
      // Fetch transcripts
      const transcriptsResponse = await fetch(API_ENDPOINTS.GET_PATIENT_TRANSCRIPTS(patientId), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (transcriptsResponse.ok) {
        const transcriptsData = await transcriptsResponse.json();
        setTranscripts(transcriptsData);
      } else {
        throw new Error(ERROR_MESSAGES.FETCH_TRANSCRIPTS_FAILED);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTranscriptDetails = async (transcriptId) => {
    const token = await auth.currentUser?.getIdToken();
    const response = await fetch(
      API_ENDPOINTS.GET_TRANSCRIPT(auth.currentUser.uid, transcriptId), 
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    if (response.ok) {
      return await response.json();
    }
    return null;
  };

  return {
    patient,
    transcripts,
    loading,
    error,
    fetchTranscriptDetails,
    refetch: fetchPatientData
  };
}