"""
Example of how to refactor main.py to use the new WebSocket wrapper and UserSettingsService.
This shows the key changes needed - not a complete file.
"""

# NEW IMPORTS TO ADD:
from websocket_auth import WebSocketAuthWrapper, websocket_manager
from services.user_settings_service import UserSettingsService

# IN THE LIFESPAN FUNCTION:
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    global gcs_client, vertex_ai_client, user_settings_service
    
    try:
        # Initialize GCS client
        gcs_client = GCSClient()
        
        # Initialize UserSettingsService
        user_settings_service = UserSettingsService(gcs_client)
        print("✓ User Settings Service initialized")
        
    except Exception as e:
        print(f"Failed to initialize services: {e}")
    
    yield
    
    # Shutdown - close any remaining WebSocket connections
    await websocket_manager.close_all_connections("Server shutting down")


# REPLACE THE OLD WEBSOCKET ENDPOINTS (lines 192-275) WITH:

@app.websocket("/stream")
async def websocket_stream_endpoint(websocket: WebSocket, token: str = Query(...)):
    """Handles WebSocket streaming for Deepgram transcription."""
    await WebSocketAuthWrapper.handle_authenticated_websocket(
        websocket=websocket,
        token=token,
        handler_func=handle_deepgram_websocket,
        get_user_settings_func=lambda user_id: user_settings_service.get_user_settings(user_id),
        connection_type="DEEPGRAM"
    )

@app.websocket("/stream/multilingual")
async def websocket_multilingual_stream_endpoint(websocket: WebSocket, token: str = Query(...)):
    """Handles WebSocket streaming for Speechmatics multilingual transcription."""
    await WebSocketAuthWrapper.handle_authenticated_websocket(
        websocket=websocket,
        token=token,
        handler_func=handle_speechmatics_websocket,
        get_user_settings_func=lambda user_id: user_settings_service.get_user_settings(user_id),
        connection_type="SPEECHMATICS"
    )


# REPLACE THE GET_USER_SETTINGS ENDPOINT (lines 322-350) WITH:

@app.get("/api/v1/user_settings/{user_id}", response_model=UserSettingsData)
async def get_user_settings(
    user_id: str = Path(..., description="The ID of the user whose settings are to be fetched"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    # Verify authorization
    if user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only view your own settings")
    
    # Get settings from service
    settings = await user_settings_service.get_user_settings(user_id)
    
    # Convert to UserSettingsData model
    return UserSettingsData(
        customVocabulary=settings.get("customVocabulary", []),
        macroPhrases=settings.get("macroPhrases", []),
        transcriptionProfiles=settings.get("transcriptionProfiles", []),
        doctorName=settings.get("doctorName", ""),
        medicalSpecialty=settings.get("medicalSpecialty", ""),
        doctorSignature=settings.get("doctorSignature"),
        clinicLogo=settings.get("clinicLogo"),
        includeLogoOnPdf=settings.get("includeLogoOnPdf", False),
        officeInformation=settings.get("officeInformation", []),
        customBillingRules=settings.get("customBillingRules", ""),
        cptFees=settings.get("cptFees", {})
    )


# REPLACE THE SAVE_USER_SETTINGS ENDPOINT (lines 456-468) WITH:

@app.post("/api/v1/user_settings")
async def save_user_settings(
    request: SaveUserSettingsRequest,
    current_user_id: str = Depends(get_user_id),
    req: Request = None
):
    # Verify authorization
    if request.user_id != current_user_id:
        raise HTTPException(status_code=403, detail="You can only update your own settings")
    
    # Save through service
    settings_dict = request.settings.model_dump()
    success = await user_settings_service.save_user_settings(
        user_id=request.user_id,
        settings=settings_dict
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save settings")
    
    # Sync to Firestore for faster queries
    await user_settings_service.sync_to_firestore(request.user_id)
    
    # Log for audit trail
    logger.info(f"User {current_user_id} updated settings")
    
    return {"success": True, "message": "Settings updated successfully"}


# UPDATE IMAGE HANDLER INITIALIZATION to use the service:
# In the image handler endpoints, replace direct GCS operations with:

# OLD CODE:
# settings_content = gcs_client.get_gcs_object_content(settings_key)
# if settings_content:
#     current_settings = json.loads(settings_content)
# else:
#     current_settings = DEFAULT_USER_SETTINGS.copy()

# NEW CODE:
current_settings = await user_settings_service.get_user_settings(user_id)

# And for saving:
# OLD CODE:
# success = gcs_client.save_data_to_gcs(...)

# NEW CODE:
success = await user_settings_service.save_user_settings(user_id, current_settings)


# BENEFITS:
# 1. Removed ~80 lines of duplicated WebSocket code
# 2. Centralized settings management with caching
# 3. Consistent error handling and logging
# 4. Easy to add new WebSocket endpoints
# 5. Settings format migration support
# 6. Better testability