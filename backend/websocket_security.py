"""
WebSocket Security Enhancements for Audio Inactivity Detection

This module provides security features for WebSocket connections including:
- Audio data inactivity detection
- Configurable timeout warnings and disconnections
- Audit logging for security events
"""

import asyncio
import time
import logging
from typing import Optional, Callable
from datetime import datetime, timezone
import json

logger = logging.getLogger(__name__)


class AudioInactivityMonitor:
    """
    Monitors WebSocket connections for audio data inactivity.
    
    Features:
    - Tracks last audio data received timestamp
    - Sends warning messages before timeout
    - Automatically closes connections after timeout
    - Configurable warning and timeout thresholds
    """
    
    def __init__(
        self,
        warning_timeout: int = 8,  # Seconds before warning
        disconnect_timeout: int = 15,  # Seconds before disconnect
        check_interval: float = 1.0,  # How often to check for inactivity
        on_warning: Optional[Callable] = None,
        on_disconnect: Optional[Callable] = None
    ):
        """
        Initialize the audio inactivity monitor.
        
        Args:
            warning_timeout: Seconds of inactivity before sending warning
            disconnect_timeout: Seconds of inactivity before disconnecting
            check_interval: How often to check for inactivity (seconds)
            on_warning: Callback when warning threshold reached
            on_disconnect: Callback when disconnect threshold reached
        """
        self.warning_timeout = warning_timeout
        self.disconnect_timeout = disconnect_timeout
        self.check_interval = check_interval
        self.on_warning = on_warning
        self.on_disconnect = on_disconnect
        
        self._last_audio_time: Optional[float] = None
        self._warning_sent = False
        self._monitoring = False
        self._monitor_task: Optional[asyncio.Task] = None
        self._start_time = time.time()
        
    def record_audio_received(self, size_bytes: int = 0):
        """Record that audio data was received."""
        old_time = self._last_audio_time
        self._last_audio_time = time.time()
        self._warning_sent = False  # Reset warning flag when audio received
        logger.debug(f"Audio received: {size_bytes} bytes, last_audio_time updated from {old_time} to {self._last_audio_time}")
        
    def start_monitoring(self):
        """Start the inactivity monitoring task."""
        if not self._monitoring:
            self._monitoring = True
            self._monitor_task = asyncio.create_task(self._monitor_loop())
            logger.info("Audio inactivity monitoring started")
            
    async def stop_monitoring(self):
        """Stop the inactivity monitoring task."""
        self._monitoring = False
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
            logger.info("Audio inactivity monitoring stopped")
            
    async def _monitor_loop(self):
        """Main monitoring loop that checks for inactivity."""
        logger.debug(f"Monitor loop started with warning={self.warning_timeout}s, disconnect={self.disconnect_timeout}s")
        try:
            check_count = 0
            while self._monitoring:
                await asyncio.sleep(self.check_interval)
                check_count += 1
                
                # If no audio has been received yet, use connection start time
                last_activity = self._last_audio_time or self._start_time
                inactive_seconds = time.time() - last_activity
                
                # Log every 5 checks for debugging
                if check_count % 5 == 0:
                    logger.debug(f"Monitor check #{check_count}: last_activity={last_activity}, inactive_seconds={inactive_seconds:.1f}s, warning_sent={self._warning_sent}")
                
                # Check for disconnect threshold
                if inactive_seconds >= self.disconnect_timeout:
                    logger.warning(
                        f"Audio inactivity timeout reached: {inactive_seconds:.1f}s >= {self.disconnect_timeout}s"
                    )
                    if self.on_disconnect:
                        await self.on_disconnect(inactive_seconds)
                    break
                    
                # Check for warning threshold
                elif inactive_seconds >= self.warning_timeout and not self._warning_sent:
                    logger.info(
                        f"Audio inactivity warning threshold reached: {inactive_seconds:.1f}s >= {self.warning_timeout}s"
                    )
                    self._warning_sent = True
                    if self.on_warning:
                        await self.on_warning(inactive_seconds)
                        
        except asyncio.CancelledError:
            logger.debug("Audio inactivity monitor cancelled")
            raise
        except Exception as e:
            logger.error(f"Error in audio inactivity monitor: {e}", exc_info=True)
            
    def get_inactivity_status(self) -> dict:
        """Get current inactivity status."""
        last_activity = self._last_audio_time or self._start_time
        inactive_seconds = time.time() - last_activity
        
        return {
            "inactive_seconds": inactive_seconds,
            "warning_sent": self._warning_sent,
            "warning_threshold": self.warning_timeout,
            "disconnect_threshold": self.disconnect_timeout,
            "monitoring_active": self._monitoring
        }


class WebSocketSecurityManager:
    """
    Manages security features for WebSocket connections.
    
    Integrates with existing WebSocket handlers to provide:
    - Audio inactivity detection
    - Security event logging
    - Connection lifecycle management
    """
    
    def __init__(
        self,
        session_id: str,
        user_id: str,
        warning_timeout: int = 8,
        disconnect_timeout: int = 15,
        audit_logger: Optional[object] = None
    ):
        """
        Initialize the security manager.
        
        Args:
            session_id: Unique session identifier
            user_id: Authenticated user ID
            warning_timeout: Seconds before inactivity warning
            disconnect_timeout: Seconds before forced disconnect
            audit_logger: Optional audit logger instance
        """
        self.session_id = session_id
        self.user_id = user_id
        self.audit_logger = audit_logger
        
        # Create inactivity monitor
        self.inactivity_monitor = AudioInactivityMonitor(
            warning_timeout=warning_timeout,
            disconnect_timeout=disconnect_timeout,
            on_warning=self._handle_inactivity_warning,
            on_disconnect=self._handle_inactivity_disconnect
        )
        
        # Track security events
        self.security_events = []
        self._websocket = None
        self._disconnect_callback = None
        
    def set_websocket(self, websocket):
        """Set the WebSocket instance for sending messages."""
        self._websocket = websocket
        
    def set_disconnect_callback(self, callback: Callable):
        """Set callback to trigger WebSocket disconnection."""
        self._disconnect_callback = callback
        
    async def start(self):
        """Start security monitoring."""
        self.inactivity_monitor.start_monitoring()
        self._log_security_event("monitoring_started", {
            "warning_timeout": self.inactivity_monitor.warning_timeout,
            "disconnect_timeout": self.inactivity_monitor.disconnect_timeout
        })
        
    async def stop(self):
        """Stop security monitoring."""
        await self.inactivity_monitor.stop_monitoring()
        self._log_security_event("monitoring_stopped", {
            "total_events": len(self.security_events)
        })
        
    def record_audio_received(self, size_bytes: int = 0):
        """Record that audio data was received."""
        self.inactivity_monitor.record_audio_received(size_bytes)
        
    async def _handle_inactivity_warning(self, inactive_seconds: float):
        """Handle inactivity warning event."""
        self._log_security_event("inactivity_warning", {
            "inactive_seconds": round(inactive_seconds, 1)
        })
        
        # Send warning to client
        if self._websocket:
            warning_message = {
                "type": "inactivity_warning",
                "message": f"No audio detected for {int(inactive_seconds)} seconds. Connection will close in {int(self.inactivity_monitor.disconnect_timeout - inactive_seconds)} seconds.",
                "inactive_seconds": round(inactive_seconds, 1),
                "disconnect_in": round(self.inactivity_monitor.disconnect_timeout - inactive_seconds, 1)
            }
            try:
                await self._websocket.send_text(json.dumps(warning_message))
                logger.info(f"Sent inactivity warning to client for session {self.session_id}")
            except Exception as e:
                logger.error(f"Failed to send inactivity warning: {e}")
                
    async def _handle_inactivity_disconnect(self, inactive_seconds: float):
        """Handle inactivity disconnect event."""
        self._log_security_event("inactivity_disconnect", {
            "inactive_seconds": round(inactive_seconds, 1),
            "reason": "audio_inactivity_timeout"
        })
        
        # Log to audit system
        if self.audit_logger:
            try:
                from audit_logger import AuditLogger
                AuditLogger.log_data_access(
                    user_id=self.user_id,
                    operation="WEBSOCKET_TIMEOUT",
                    data_type="audio_stream",
                    resource_id=self.session_id,
                    request=None,
                    success=True,
                    details={
                        "reason": "audio_inactivity",
                        "inactive_seconds": round(inactive_seconds, 1)
                    }
                )
            except Exception as e:
                logger.error(f"Failed to log audit event: {e}")
        
        # Trigger disconnect
        if self._disconnect_callback:
            await self._disconnect_callback(
                code=4008,  # Custom close code for inactivity
                reason=f"Audio inactivity timeout: {int(inactive_seconds)}s"
            )
            
    def _log_security_event(self, event_type: str, details: dict):
        """Log a security event."""
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "type": event_type,
            "session_id": self.session_id,
            "user_id": self.user_id,
            "details": details
        }
        self.security_events.append(event)
        logger.info(f"Security event: {event_type} - {details}")
        
    def get_security_summary(self) -> dict:
        """Get summary of security events for this session."""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "total_events": len(self.security_events),
            "inactivity_status": self.inactivity_monitor.get_inactivity_status(),
            "events": self.security_events[-10:]  # Last 10 events
        }


# Configuration helper
def get_inactivity_config() -> dict:
    """Get inactivity timeout configuration from environment."""
    import os
    
    return {
        "warning_timeout": int(os.getenv("WEBSOCKET_INACTIVITY_WARNING", "8")),
        "disconnect_timeout": int(os.getenv("WEBSOCKET_INACTIVITY_TIMEOUT", "15")),
        "enabled": os.getenv("WEBSOCKET_INACTIVITY_ENABLED", "true").lower() == "true"
    }