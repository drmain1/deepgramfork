import { useRef, useState, useCallback } from 'react';
import { MEDIA_RECORDER_INTERVAL, ERROR_MESSAGES } from '../constants/recordingConstants';

export const useAudioRecording = () => {
  const mediaRecorderRef = useRef(null);
  const audioStreamRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);

  const startRecording = useCallback(async (onDataAvailable, onStop) => {
    setError(null);
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          onDataAvailable?.(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        onStop?.();
      };

      mediaRecorderRef.current.onerror = (event) => {
        setError(`MediaRecorder error: ${event.error.name}. ${ERROR_MESSAGES.MICROPHONE_ACCESS}`);
        setIsRecording(false);
        stopRecording();
      };

      mediaRecorderRef.current.start(MEDIA_RECORDER_INTERVAL);
      setIsRecording(true);
      
      return true;
    } catch (err) {
      setError(`Error starting stream: ${err.message}. ${ERROR_MESSAGES.MICROPHONE_ACCESS}`);
      setIsRecording(false);
      return false;
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }

    setIsRecording(false);
  }, []);

  const cleanup = useCallback(() => {
    stopRecording();
    mediaRecorderRef.current = null;
  }, [stopRecording]);

  return {
    startRecording,
    stopRecording,
    cleanup,
    isRecording,
    error
  };
};