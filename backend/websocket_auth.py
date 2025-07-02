"""WebSocket authentication and lifecycle management wrapper."""
import time
import logging
from typing import Callable, Awaitable, Optional
from fastapi import WebSocket, HTTPException
from audit_logger import AuditLogger

logger = logging.getLogger(__name__)


class WebSocketAuthWrapper:
    """Handles authentication and lifecycle management for WebSocket connections."""
    
    @staticmethod
    async def handle_authenticated_websocket(
        websocket: WebSocket,
        token: str,
        handler_func: Callable[[WebSocket, Callable, str], Awaitable[None]],
        get_user_settings_func: Callable,
        connection_type: str = "standard",
        validate_token_func: Optional[Callable[[str], str]] = None
    ) -> None:
        """
        Handle WebSocket connection with authentication and audit logging.
        
        Args:
            websocket: The WebSocket connection
            token: Firebase authentication token
            handler_func: The actual WebSocket handler (e.g., handle_deepgram_websocket)
            get_user_settings_func: Function to retrieve user settings
            connection_type: Type of connection for logging (e.g., "DEEPGRAM", "SPEECHMATICS")
            validate_token_func: Optional custom token validation function
        """
        # Generate unique connection ID
        connection_id = f"ws_{connection_type.lower()}_{int(time.time() * 1000)}"
        start_time = time.time()
        user_id = None
        
        try:
            # Use provided token validation or default
            if validate_token_func:
                user_id = validate_token_func(token)
            else:
                # Default to Firebase validation
                from gcp_auth_middleware import validate_firebase_token
                user_id = validate_firebase_token(token)
            
            # Accept the WebSocket connection
            await websocket.accept()
            
            # Log WebSocket connection start
            AuditLogger.log_websocket_event(
                user_id=user_id,
                event_type=f"CONNECT_{connection_type.upper()}",
                connection_id=connection_id
            )
            
            logger.info(f"WebSocket {connection_type} connection established for user {user_id}")
            
            # Pass control to the specific handler
            await handler_func(websocket, get_user_settings_func, user_id)
            
            # Log successful completion
            duration = time.time() - start_time
            AuditLogger.log_websocket_event(
                user_id=user_id,
                event_type=f"DISCONNECT_{connection_type.upper()}",
                connection_id=connection_id,
                duration_seconds=duration
            )
            
            logger.info(f"WebSocket {connection_type} connection closed normally for user {user_id} "
                       f"after {duration:.2f} seconds")
            
        except HTTPException as e:
            # Authentication failures
            logger.warning(f"WebSocket {connection_type} authentication failed: {e.detail}")
            await websocket.close(code=1008, reason=f"Authentication failed: {e.detail}")
            
        except Exception as e:
            # Other errors
            logger.error(f"WebSocket {connection_type} error for user {user_id}: {str(e)}", exc_info=True)
            
            # Log error event if we have a user_id
            if user_id:
                duration = time.time() - start_time
                AuditLogger.log_websocket_event(
                    user_id=user_id,
                    event_type=f"ERROR_{connection_type.upper()}",
                    connection_id=connection_id,
                    duration_seconds=duration,
                    error=str(e)
                )
            
            # Close with appropriate error code
            await websocket.close(code=1011, reason=f"Server error: {str(e)}")


class WebSocketConnectionManager:
    """Manages WebSocket connections and provides utility functions."""
    
    def __init__(self):
        self.active_connections: dict[str, dict] = {}
    
    async def connect(self, user_id: str, connection_id: str, websocket: WebSocket):
        """Track a new WebSocket connection."""
        self.active_connections[connection_id] = {
            "user_id": user_id,
            "websocket": websocket,
            "connected_at": time.time()
        }
        logger.info(f"Tracked connection {connection_id} for user {user_id}. "
                   f"Total active: {len(self.active_connections)}")
    
    async def disconnect(self, connection_id: str):
        """Remove a WebSocket connection."""
        if connection_id in self.active_connections:
            conn_info = self.active_connections.pop(connection_id)
            duration = time.time() - conn_info["connected_at"]
            logger.info(f"Removed connection {connection_id} for user {conn_info['user_id']} "
                       f"after {duration:.2f} seconds. Total active: {len(self.active_connections)}")
    
    def get_user_connections(self, user_id: str) -> list[str]:
        """Get all connection IDs for a user."""
        return [
            conn_id for conn_id, info in self.active_connections.items()
            if info["user_id"] == user_id
        ]
    
    async def close_user_connections(self, user_id: str, reason: str = "Session terminated"):
        """Close all connections for a specific user."""
        user_connections = self.get_user_connections(user_id)
        for conn_id in user_connections:
            if conn_id in self.active_connections:
                conn_info = self.active_connections[conn_id]
                try:
                    await conn_info["websocket"].close(code=1000, reason=reason)
                except Exception as e:
                    logger.error(f"Error closing connection {conn_id}: {e}")
                await self.disconnect(conn_id)
        
        if user_connections:
            logger.info(f"Closed {len(user_connections)} connections for user {user_id}")


# Global connection manager instance
websocket_manager = WebSocketConnectionManager()