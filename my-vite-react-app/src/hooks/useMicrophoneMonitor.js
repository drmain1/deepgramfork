import { useState, useRef, useEffect, useCallback } from 'react';

export function useMicrophoneMonitor() {
  const [micLevel, setMicLevel] = useState(0);
  const [micStatus, setMicStatus] = useState('checking'); // 'checking', 'active', 'error', 'denied'
  
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const micStreamRef = useRef(null);
  const animationRef = useRef(null);
  const dataArrayRef = useRef(null);
  const isMonitoringRef = useRef(false);

  const updateLevel = useCallback(() => {
    if (!isMonitoringRef.current || !analyserRef.current || !dataArrayRef.current) {
      return;
    }
    
    try {
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Calculate average volume level
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        sum += dataArrayRef.current[i];
      }
      const average = sum / dataArrayRef.current.length;
      
      // Normalize to 0-100 range with better sensitivity
      const normalizedLevel = Math.min(100, Math.max(0, (average / 128) * 100));
      
      setMicLevel(normalizedLevel);
      
      // Continue the animation loop
      if (isMonitoringRef.current) {
        animationRef.current = requestAnimationFrame(updateLevel);
      }
    } catch (error) {
      isMonitoringRef.current = false;
    }
  }, []);

  const startMicrophoneMonitoring = useCallback(async () => {
    try {
      setMicStatus('checking');
      
      // Stop any existing monitoring first
      stopMicrophoneMonitoring();
      
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      micStreamRef.current = stream;
      setMicStatus('active');
      
      // Set up audio analysis
      audioContextRef.current = new AudioContext();
      
      // Resume audio context if it's suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.3;
      source.connect(analyserRef.current);
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      dataArrayRef.current = new Uint8Array(bufferLength);
      
      isMonitoringRef.current = true;
      
      updateLevel();
      
    } catch (error) {
      setMicStatus(error.name === 'NotAllowedError' ? 'denied' : 'error');
      isMonitoringRef.current = false;
    }
  }, [updateLevel]);

  const stopMicrophoneMonitoring = useCallback(() => {
    isMonitoringRef.current = false;
    setMicLevel(0);
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      micStreamRef.current = null;
    }
    
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    analyserRef.current = null;
    dataArrayRef.current = null;
  }, []);

  const retryMicrophoneAccess = useCallback(() => {
    setMicStatus('checking');
    startMicrophoneMonitoring();
  }, [startMicrophoneMonitoring]);

  // Auto-start microphone monitoring when hook is used
  useEffect(() => {
    startMicrophoneMonitoring();
    
    // Cleanup on unmount
    return () => {
      stopMicrophoneMonitoring();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    micLevel,
    micStatus,
    startMicrophoneMonitoring,
    stopMicrophoneMonitoring,
    retryMicrophoneAccess
  };
}