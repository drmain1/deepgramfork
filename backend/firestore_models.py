"""
Firestore data models for the medical transcription application.
Defines the structure for users, transcripts, and sessions collections.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel, Field

class TranscriptStatus(str, Enum):
    """Status of a transcription session"""
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"
    DRAFT = "draft"

class UserDocument(BaseModel):
    """
    Firestore document model for users collection.
    Document ID: Firebase Auth UID
    """
    email: str
    name: Optional[str] = None
    clinic_name: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Settings that were in GCS
    custom_vocabulary: List[str] = Field(default_factory=list)
    macro_phrases: Dict[str, str] = Field(default_factory=dict)
    transcription_profiles: List[Dict[str, Any]] = Field(default_factory=list)
    
    # References to GCS files
    logo_gcs_path: Optional[str] = None
    
    # HIPAA compliance fields
    last_login: Optional[datetime] = None
    email_verified: bool = False
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class PatientDocument(BaseModel):
    """
    Firestore document model for patients collection.
    Document ID: Auto-generated unique ID
    """
    user_id: str  # Firebase Auth UID (doctor who owns this patient profile)
    first_name: str
    last_name: str
    date_of_birth: datetime
    date_of_accident: Optional[datetime] = None
    
    # Patient notes
    notes_private: Optional[str] = None  # Private notes not shared with AI
    notes_ai_context: Optional[str] = None  # Notes shared with AI for context
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    # Soft delete support
    active: bool = True
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class TranscriptDocument(BaseModel):
    """
    Firestore document model for transcripts collection.
    Document ID: Unique session ID
    """
    user_id: str  # Firebase Auth UID
    session_id: str
    status: TranscriptStatus = TranscriptStatus.PROCESSING
    
    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    
    # Recording details
    duration_seconds: Optional[int] = None
    patient_name: str  # Note: Consider de-identification for HIPAA
    patient_id: Optional[str] = None  # Reference to patient document (optional)
    patient_context: Optional[str] = None
    encounter_type: Optional[str] = None
    location: Optional[str] = None
    
    # Transcription settings used
    llm_template: Optional[str] = None
    llm_template_id: Optional[str] = None
    language: str = "en"
    
    # Transcript content stored directly in Firestore
    transcript_original: Optional[str] = None
    transcript_polished: Optional[str] = None
    
    # References to GCS files (kept for backwards compatibility but not used)
    gcs_path_audio: Optional[str] = None  # DEPRECATED - streaming audio, no files stored
    gcs_path_original: Optional[str] = None  # Deprecated - kept for backwards compatibility
    gcs_path_polished: Optional[str] = None  # Deprecated - kept for backwards compatibility
    
    # Error tracking
    error_message: Optional[str] = None
    processing_errors: List[str] = Field(default_factory=list)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

class SessionDocument(BaseModel):
    """
    Firestore document model for user_sessions collection.
    Document ID: Firebase Auth UID
    Used for session management and HIPAA compliance.
    """
    user_id: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_activity: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: datetime
    active: bool = True
    
    # Audit fields
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    
    # Logout tracking
    logged_out_at: Optional[datetime] = None
    expired_at: Optional[datetime] = None
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }

# Helper functions for Firestore operations

def create_user_document(user_data: dict) -> dict:
    """Create a user document from raw data"""
    user = UserDocument(**user_data)
    return user.dict()

def create_transcript_document(transcript_data: dict) -> dict:
    """Create a transcript document from raw data"""
    transcript = TranscriptDocument(**transcript_data)
    return transcript.dict()

def create_session_document(session_data: dict) -> dict:
    """Create a session document from raw data"""
    session = SessionDocument(**session_data)
    return session.dict()

def create_patient_document(patient_data: dict) -> dict:
    """Create a patient document from raw data"""
    patient = PatientDocument(**patient_data)
    return patient.dict()