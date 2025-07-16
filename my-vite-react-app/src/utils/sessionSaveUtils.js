import { LOCATION_LEAVE_OUT } from '../constants/recordingConstants';

export const prepareTranscriptWithLocation = (transcript, location) => {
  if (!location || location.trim() === '' || location === LOCATION_LEAVE_OUT) {
    return transcript;
  }
  
  const locationHeader = `CLINIC LOCATION:\n${location.trim()}\n\n---\n\n`;
  return locationHeader + transcript;
};

export const buildSaveSessionPayload = ({
  sessionId,
  transcript,
  location,
  patientDetails,
  patientContext,
  selectedPatient,
  userSettings,
  currentProfileId,
  user,
  isDictationMode,
  dateOfService,
  evaluationType,
  initialEvaluationId,
  previousEvaluationId,
  includePreviousFindingsInPrompt,
  previousFindings,
  recordingStartTime
}) => {
  const activeProfile = userSettings.transcriptionProfiles?.find(p => p.id === currentProfileId);
  const llmTemplate = activeProfile ? activeProfile.name : 'General Summary';
  const llmTemplateId = activeProfile ? activeProfile.id : null;
  const llmInstructions = activeProfile ? (activeProfile.llmInstructions || activeProfile.llmPrompt) : null;
  const encounterType = activeProfile ? activeProfile.name : patientContext || 'General';
  
  const transcriptWithLocation = prepareTranscriptWithLocation(transcript, location);
  
  return {
    session_id: sessionId,
    final_transcript_text: transcriptWithLocation,
    patient_context: patientContext,
    patient_name: patientDetails,
    patient_id: selectedPatient?.id || null,
    encounter_type: encounterType,
    llm_template: llmTemplate,
    llm_template_id: llmTemplateId,
    location: location === LOCATION_LEAVE_OUT ? '' : location,
    user_id: user.uid || user.sub,
    date_of_service: (isDictationMode && dateOfService && dateOfService.trim()) ? dateOfService : null,
    evaluation_type: evaluationType || null,
    initial_evaluation_id: initialEvaluationId || null,
    previous_evaluation_id: previousEvaluationId || initialEvaluationId || null,
    previous_findings: (includePreviousFindingsInPrompt && previousFindings) ? previousFindings : null,
    recording_start_time: recordingStartTime ? new Date(recordingStartTime).toISOString() : new Date().toISOString()
  };
};

export const saveSessionToBackend = async (payload, accessToken, apiBaseUrl) => {
  const url = `${apiBaseUrl}/api/v1/save_session_data`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  let result = {};
  try {
    result = await response.json();
  } catch (jsonError) {
    if (response.ok) {
      throw new Error(`Successfully saved but failed to parse response: ${response.statusText || 'Unknown parse error'}`);
    }
  }

  if (!response.ok) {
    const errorText = result.error || result.detail || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorText);
  }

  return result;
};

export const saveDraftToBackend = async ({
  sessionId,
  transcript,
  patientDetails,
  currentProfileId,
  user,
  isDictationMode,
  dateOfService,
  recordingStartTime,
  accessToken,
  apiBaseUrl
}) => {
  const url = `${apiBaseUrl}/api/v1/save_draft`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      session_id: sessionId,
      transcript: transcript,
      patient_name: patientDetails || 'Untitled Session',
      profile_id: currentProfileId,
      user_id: user.uid || user.sub,
      date_of_service: (isDictationMode && dateOfService && dateOfService.trim()) ? dateOfService : null,
      recording_start_time: recordingStartTime ? new Date(recordingStartTime).toISOString() : null
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to save draft: ${await response.text()}`);
  }

  return response.json();
};