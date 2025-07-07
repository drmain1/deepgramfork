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


# PDF Generation Models
class MuscleStrength(BaseModel):
    muscle: str
    right: str
    left: str


class ReflexResult(BaseModel):
    reflex: str
    right: str
    left: str


class MotorExamination(BaseModel):
    upper_extremity: List[MuscleStrength]
    lower_extremity: List[MuscleStrength]


class ReflexExamination(BaseModel):
    deep_tendon: List[ReflexResult]
    pathological: List[ReflexResult]


class PatientInfo(BaseModel):
    patient_name: str
    date_of_birth: Optional[str] = None
    date_of_accident: Optional[str] = None
    date_of_treatment: Optional[str] = None
    provider: Optional[str] = None


class ClinicInfo(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    fax: Optional[str] = None


class MedicalDocument(BaseModel):
    patient_info: PatientInfo
    clinic_info: Optional[ClinicInfo] = None
    sections: Dict[str, Optional[str]]
    motor_exam: Optional[MotorExamination] = None
    reflexes: Optional[ReflexExamination] = None
    provider_info: Optional[Dict[str, str]] = None


class PDFGenerationRequest(BaseModel):
    transcript: str
    format_type: str = "structured"  # "structured" or "markdown"
    include_watermark: bool = False
    include_signature: bool = True


class PDFGenerationResponse(BaseModel):
    success: bool
    pdf_url: Optional[str] = None
    error: Optional[str] = None


class MultiVisitPDFRequest(BaseModel):
    visits: List[MedicalDocument]
    patient_name: str
    include_watermark: bool = False
    include_signature: bool = True


class BillingPDFRequest(BaseModel):
    billing_data: Dict[str, Any]
    patient_info: Dict[str, Any]
    doctor_info: Dict[str, Any]
    include_logo: bool = True
    include_signature: bool = True