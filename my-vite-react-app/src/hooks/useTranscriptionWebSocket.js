import { useRef, useState, useCallback } from 'react';
import { WS_MESSAGE_TYPES, WS_CLOSE_CODES, ERROR_MESSAGES } from '../constants/recordingConstants';

export const useTranscriptionWebSocket = () => {
  const webSocketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);

  const connect = useCallback((wsUrl, options = {}) => {
    return new Promise((resolve, reject) => {
      const {
        onOpen,
        onMessage,
        onError,
        onClose,
        accessToken
      } = options;

      // Close existing connection if any
      if (webSocketRef.current && webSocketRef.current.readyState !== WebSocket.CLOSED) {
        webSocketRef.current.close();
        webSocketRef.current = null;
      }

      try {
        const wsEndpoint = `${wsUrl}?token=${encodeURIComponent(accessToken)}`;
        console.log('[WebSocket Hook] Connecting to:', wsEndpoint);
        webSocketRef.current = new WebSocket(wsEndpoint);

        webSocketRef.current.onopen = () => {
          console.log('[WebSocket Hook] Connection opened');
          setIsConnected(true);
          setError(null);
          onOpen?.();
          resolve();
        };

        webSocketRef.current.onmessage = (event) => {
          let message = event.data;
          if (typeof message === 'string' && message.startsWith('\uFEFF')) {
            message = message.substring(1);
          }
          
          try {
            const parsedMessage = JSON.parse(message);
            onMessage?.(parsedMessage);
          } catch (e) {
            // Handle legacy plain text messages
            onMessage?.({ type: 'legacy', text: message });
          }
        };

        webSocketRef.current.onerror = (event) => {
          console.error('[WebSocket Hook] Error:', event);
          setError(ERROR_MESSAGES.WS_CONNECTION);
          onError?.(event);
          reject(new Error(ERROR_MESSAGES.WS_CONNECTION));
        };

        webSocketRef.current.onclose = (event) => {
          console.log('[WebSocket Hook] Connection closed:', event.code, event.reason);
          setIsConnected(false);
          onClose?.(event);
        };

      } catch (err) {
        setError(`Error connecting: ${err.message}`);
        reject(err);
      }
    });
  }, []);

  const sendMessage = useCallback((data) => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      if (data instanceof Blob || data instanceof ArrayBuffer) {
        // Send binary data as-is
        webSocketRef.current.send(data);
      } else if (typeof data === 'string') {
        webSocketRef.current.send(data);
      } else {
        console.log('[WebSocket Hook] Sending JSON message:', data);
        webSocketRef.current.send(JSON.stringify(data));
      }
      return true;
    }
    console.warn('[WebSocket Hook] Cannot send message - WebSocket not open');
    return false;
  }, []);

  const disconnect = useCallback((code = WS_CLOSE_CODES.NORMAL, reason = '') => {
    if (webSocketRef.current?.readyState === WebSocket.OPEN) {
      webSocketRef.current.close(code, reason);
      webSocketRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const getReadyState = useCallback(() => {
    return webSocketRef.current?.readyState;
  }, []);

  return {
    connect,
    disconnect,
    sendMessage,
    isConnected,
    error,
    getReadyState
  };
};