from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class TranscriptionProfileItem(BaseModel):
    id: str = Field(..., description="Unique identifier for the profile")
    name: str = Field(..., description="User-defined name for the profile")
    smart_format: bool = Field(default=True, description="Enable Deepgram Smart Formatting")
    diarize: bool = Field(default=False, description="Enable Deepgram Diarization")
    interim_results: Optional[bool] = Field(default=True, description="Enable Deepgram interim results")
    utterance_end_ms: Optional[str] = Field(default="1000", description="Deepgram utterance end silence duration")
    vad_events: Optional[bool] = Field(default=True, description="Enable VAD events")
    # The original websocket_stream_endpoint code read 'utterances' from the profile (line 225 in main.py)
    # but didn't use it in LiveOptions. Kept for consistency with existing profile loading logic.
    utterances: Optional[bool] = Field(default=False, description="Enable Deepgram Utterance detection (word timestamps etc)")

class UserSettingsData(BaseModel):
    macroPhrases: List[Dict[str, Any]] = Field(default_factory=list)
    customVocabulary: List[Dict[str, Any]] = Field(default_factory=list)
    officeInformation: List[str] = Field(default_factory=list)
    transcriptionProfiles: List[TranscriptionProfileItem] = Field(default_factory=list)
    doctorName: Optional[str] = Field(default="", description="Doctor's name for signatures")
    doctorSignature: Optional[str] = Field(default=None, description="Base64 encoded doctor's signature image")
    clinicLogo: Optional[str] = Field(default=None, description="Base64 encoded clinic logo image")
    includeLogoOnPdf: bool = Field(default=False, description="Include clinic logo on PDF forms")

# Default user settings structure
DEFAULT_USER_SETTINGS = UserSettingsData(
    macroPhrases=[],
    customVocabulary=[],
    officeInformation=[],
    transcriptionProfiles=[
        TranscriptionProfileItem(
            id="default-profile", 
            name="Default General Profile", 
            smart_format=True, 
            diarize=False,
            interim_results=True,
            utterance_end_ms="1000",
            vad_events=True,
            utterances=False
        )
    ]
)
