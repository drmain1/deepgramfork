"""Pydantic models for the application."""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class TranscriptionProfileItem(BaseModel):
    """Transcription profile configuration."""
    id: str = Field(..., description="Unique identifier for the profile")
    name: str = Field(..., description="User-defined name for the profile")
    llmInstructions: Optional[str] = Field(default=None, description="Custom LLM instructions/template for this profile")
    llmPrompt: Optional[str] = Field(default=None, description="Custom LLM prompt/template for this profile (deprecated, use llmInstructions)")
    isDefault: Optional[bool] = Field(default=False, description="Whether this is the default profile")
    # Deepgram specific options
    smart_format: Optional[bool] = Field(default=True, description="Enable Deepgram Smart Formatting")
    diarize: Optional[bool] = Field(default=False, description="Enable Deepgram Speaker Diarization")
    num_speakers: Optional[int] = Field(default=None, ge=1, description="Suggested number of speakers if diarization is enabled")
    utterances: Optional[bool] = Field(default=False, description="Enable Deepgram Word-Level Timestamps (utterances)")
    specialty: Optional[str] = Field(default=None, description="Medical specialty category")
    originalTemplateId: Optional[str] = Field(default=None, description="Original template ID from templateConfig")


class UserSettingsData(BaseModel):
    """User settings data model."""
    macroPhrases: List[Dict[str, Any]] = Field(default_factory=list)
    customVocabulary: List[Dict[str, Any]] = Field(default_factory=list)
    officeInformation: List[str] = Field(default_factory=list)
    transcriptionProfiles: List[TranscriptionProfileItem] = Field(default_factory=list)
    doctorName: Optional[str] = Field(default="", description="Doctor's name for signatures")
    doctorSignature: Optional[str] = Field(default=None, description="Doctor's signature image URL")
    clinicLogo: Optional[str] = Field(default=None, description="URL to clinic logo in GCS")
    includeLogoOnPdf: bool = Field(default=False, description="Include clinic logo on PDF forms")
    medicalSpecialty: Optional[str] = Field(default="", description="Medical specialty of the doctor")
    customBillingRules: Optional[str] = Field(default="", description="Custom billing rules for the clinic")
    cptFees: Dict[str, float] = Field(default_factory=dict, description="Custom CPT code fees mapping")


class SaveUserSettingsRequest(BaseModel):
    """Request model for saving user settings."""
    user_id: str
    settings: UserSettingsData


class SaveSessionRequest(BaseModel):
    """Request model for saving session data."""
    session_id: str
    final_transcript_text: str 
    user_id: str  
    patient_context: Optional[str] = None 
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    encounter_type: Optional[str] = None  
    llm_template: Optional[str] = None
    llm_template_id: Optional[str] = None
    location: Optional[str] = None
    date_of_service: Optional[str] = None
    evaluation_type: Optional[str] = None
    initial_evaluation_id: Optional[str] = None
    previous_findings: Optional[Dict[str, Any]] = None


class SaveDraftRequest(BaseModel):
    """Request model for saving draft recordings."""
    session_id: str
    transcript: str
    patient_name: str
    profile_id: Optional[str] = None
    user_id: str


class RecordingInfo(BaseModel):
    """Recording information model."""
    id: str  # session_id
    name: str  # Derived name, e.g., from patient context or session title
    date: datetime  # Last modified date of the metadata file or a date from metadata
    status: str = "saved"  # Can be "saved", "draft", "pending", "saving", "failed"
    gcsPathTranscript: Optional[str] = None
    gcsPathPolished: Optional[str] = None
    gcsPathMetadata: Optional[str] = None
    patientContext: Optional[str] = None
    encounterType: Optional[str] = None
    llmTemplateName: Optional[str] = None
    location: Optional[str] = None
    durationSeconds: Optional[int] = None
    # Draft-specific fields
    transcript: Optional[str] = None
    polishedTranscript: Optional[str] = None
    profileId: Optional[str] = None
    isDictation: Optional[bool] = None
    patientId: Optional[str] = None


class UpdateTranscriptRequest(BaseModel):
    """Request model for updating transcripts."""
    polishedTranscript: Optional[str] = None
    originalTranscript: Optional[str] = None


# Default user settings
DEFAULT_USER_SETTINGS = UserSettingsData(
    macroPhrases=[],
    customVocabulary=[],
    officeInformation=[],
    transcriptionProfiles=[],
    doctorName='',
    doctorSignature=None,
    clinicLogo=None,
    includeLogoOnPdf=False,
    medicalSpecialty='',
    customBillingRules='',
    cptFees={}
).model_dump()