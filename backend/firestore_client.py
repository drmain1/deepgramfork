"""
Firestore client for managing users, transcripts, and sessions.
This replaces metadata storage in GCS with structured Firestore documents.
"""

import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
import asyncio
from firestore_models import (
    UserDocument, TranscriptDocument, SessionDocument, PatientDocument,
    TranscriptStatus, create_user_document, create_transcript_document,
    create_patient_document
)

logger = logging.getLogger(__name__)

class FirestoreClient:
    """
    Client for interacting with Firestore collections.
    Handles users, transcripts, and sessions.
    """
    
    def __init__(self):
        firebase_project_id = os.getenv('FIREBASE_PROJECT_ID', 'medlegaldoc-b31df')
        logger.info(f"Initializing Firestore client for project: {firebase_project_id}")
        self.db = firestore.Client(project=firebase_project_id)
        
        # Collection references
        self.users_collection = self.db.collection('users')
        self.transcripts_collection = self.db.collection('transcripts')
        self.sessions_collection = self.db.collection('user_sessions')
        self.patients_collection = self.db.collection('patients')
    
    # User operations
    async def get_or_create_user(self, user_id: str, email: str, name: Optional[str] = None) -> Dict[str, Any]:
        """Get existing user or create new one"""
        try:
            user_ref = self.users_collection.document(user_id)
            user_doc = user_ref.get()
            
            if user_doc.exists:
                # Update last login
                user_ref.update({
                    'last_login': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc)
                })
                return user_doc.to_dict()
            else:
                # Create new user
                user_data = {
                    'email': email,
                    'name': name,
                    'created_at': datetime.now(timezone.utc),
                    'updated_at': datetime.now(timezone.utc),
                    'last_login': datetime.now(timezone.utc),
                    'email_verified': True  # Assuming verified if they got this far
                }
                
                user_doc_dict = create_user_document(user_data)
                user_ref.set(user_doc_dict)
                logger.info(f"Created new user document for {user_id}")
                return user_doc_dict
                
        except Exception as e:
            logger.error(f"Error getting/creating user {user_id}: {str(e)}")
            raise
    
    async def update_user_settings(self, user_id: str, settings: Dict[str, Any]) -> bool:
        """Update user settings in Firestore"""
        try:
            user_ref = self.users_collection.document(user_id)
            
            # Add updated_at timestamp
            settings['updated_at'] = datetime.now(timezone.utc)
            
            user_ref.update(settings)
            logger.info(f"Updated settings for user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating user settings: {str(e)}")
            return False
    
    async def get_user_settings(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user settings from Firestore"""
        try:
            user_ref = self.users_collection.document(user_id)
            user_doc = user_ref.get()
            
            if user_doc.exists:
                return user_doc.to_dict()
            else:
                logger.warning(f"No user document found for {user_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting user settings: {str(e)}")
            return None
    
    # Transcript operations
    async def create_transcript(self, transcript_data: Dict[str, Any]) -> str:
        """Create a new transcript document"""
        try:
            # Use session_id as document ID
            session_id = transcript_data['session_id']
            transcript_ref = self.transcripts_collection.document(session_id)
            
            # Create document using model
            transcript_doc = create_transcript_document(transcript_data)
            transcript_ref.set(transcript_doc)
            
            logger.info(f"Created transcript document for session {session_id}")
            return session_id
            
        except Exception as e:
            logger.error(f"Error creating transcript: {str(e)}")
            raise
    
    async def update_transcript(self, session_id: str, updates: Dict[str, Any]) -> bool:
        """Update an existing transcript"""
        try:
            transcript_ref = self.transcripts_collection.document(session_id)
            
            # Add updated_at timestamp
            updates['updated_at'] = datetime.now(timezone.utc)
            
            # If status is being set to completed, add completed_at
            if updates.get('status') == TranscriptStatus.COMPLETED:
                updates['completed_at'] = datetime.now(timezone.utc)
            
            transcript_ref.update(updates)
            logger.info(f"Updated transcript {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating transcript: {str(e)}")
            return False
    
    async def get_user_transcripts(
        self, 
        user_id: str, 
        limit: int = 50,
        status: Optional[TranscriptStatus] = None
    ) -> List[Dict[str, Any]]:
        """Get transcripts for a user, sorted by creation date"""
        try:
            query = self.transcripts_collection.where(
                filter=FieldFilter('user_id', '==', user_id)
            )
            
            if status:
                query = query.where(filter=FieldFilter('status', '==', status))
            
            # Order by created_at descending (newest first)
            query = query.order_by('created_at', direction=firestore.Query.DESCENDING)
            
            if limit:
                query = query.limit(limit)
            
            transcripts = []
            for doc in query.stream():
                transcript_data = doc.to_dict()
                transcript_data['id'] = doc.id  # Add document ID
                transcripts.append(transcript_data)
            
            logger.info(f"Retrieved {len(transcripts)} transcripts for user {user_id}")
            return transcripts
            
        except Exception as e:
            logger.error(f"Error getting user transcripts: {str(e)}")
            return []
    
    async def get_transcript(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Get a single transcript by session ID"""
        try:
            transcript_ref = self.transcripts_collection.document(session_id)
            transcript_doc = transcript_ref.get()
            
            if transcript_doc.exists:
                data = transcript_doc.to_dict()
                data['id'] = transcript_doc.id
                return data
            else:
                logger.warning(f"No transcript found for session {session_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting transcript: {str(e)}")
            return None
    
    async def delete_transcript(self, session_id: str) -> bool:
        """Delete a transcript document"""
        try:
            transcript_ref = self.transcripts_collection.document(session_id)
            transcript_ref.delete()
            logger.info(f"Deleted transcript {session_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error deleting transcript: {str(e)}")
            return False
    
    # Batch operations for migration
    async def batch_create_transcripts(self, transcripts: List[Dict[str, Any]]) -> int:
        """Batch create multiple transcripts (for migration)"""
        try:
            batch = self.db.batch()
            count = 0
            
            for transcript_data in transcripts:
                session_id = transcript_data['session_id']
                transcript_ref = self.transcripts_collection.document(session_id)
                transcript_doc = create_transcript_document(transcript_data)
                batch.set(transcript_ref, transcript_doc)
                count += 1
                
                # Commit every 500 documents (Firestore limit)
                if count % 500 == 0:
                    batch.commit()
                    batch = self.db.batch()
            
            # Commit remaining
            if count % 500 != 0:
                batch.commit()
            
            logger.info(f"Batch created {count} transcripts")
            return count
            
        except Exception as e:
            logger.error(f"Error in batch creation: {str(e)}")
            raise
    
    # Query helpers
    async def get_recent_transcripts(self, user_id: str, days: int = 7) -> List[Dict[str, Any]]:
        """Get transcripts from the last N days"""
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=days)
            
            query = self.transcripts_collection.where(
                filter=FieldFilter('user_id', '==', user_id)
            ).where(
                filter=FieldFilter('created_at', '>=', cutoff_date)
            ).order_by(
                'created_at', direction=firestore.Query.DESCENDING
            )
            
            transcripts = []
            for doc in query.stream():
                transcript_data = doc.to_dict()
                transcript_data['id'] = doc.id
                
                # Debug logging
                original_transcript = transcript_data.get('transcript_original')
                polished_transcript = transcript_data.get('transcript_polished')
                logger.info(f"Transcript {doc.id}: has original: {bool(original_transcript)}, "
                           f"original length: {len(original_transcript) if original_transcript else 0}, "
                           f"has polished: {bool(polished_transcript)}, "
                           f"polished length: {len(polished_transcript) if polished_transcript else 0}")
                
                transcripts.append(transcript_data)
            
            return transcripts
            
        except Exception as e:
            logger.error(f"Error getting recent transcripts: {str(e)}")
            return []
    
    async def search_transcripts(
        self, 
        user_id: str, 
        patient_name: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """Search transcripts with filters"""
        try:
            query = self.transcripts_collection.where(
                filter=FieldFilter('user_id', '==', user_id)
            )
            
            if patient_name:
                query = query.where(
                    filter=FieldFilter('patient_name', '==', patient_name)
                )
            
            if start_date:
                query = query.where(
                    filter=FieldFilter('created_at', '>=', start_date)
                )
            
            if end_date:
                query = query.where(
                    filter=FieldFilter('created_at', '<=', end_date)
                )
            
            query = query.order_by('created_at', direction=firestore.Query.DESCENDING)
            
            transcripts = []
            for doc in query.stream():
                transcript_data = doc.to_dict()
                transcript_data['id'] = doc.id
                transcripts.append(transcript_data)
            
            return transcripts
            
        except Exception as e:
            logger.error(f"Error searching transcripts: {str(e)}")
            return []
    
    # Patient operations
    async def create_patient(self, patient_data: Dict[str, Any]) -> str:
        """Create a new patient profile"""
        try:
            # Generate a new document reference with auto ID
            patient_ref = self.patients_collection.document()
            patient_id = patient_ref.id
            
            # Create document using model
            patient_doc = create_patient_document(patient_data)
            patient_ref.set(patient_doc)
            
            logger.info(f"Created patient document {patient_id} for user {patient_data['user_id']}")
            return patient_id
            
        except Exception as e:
            logger.error(f"Error creating patient: {str(e)}")
            raise
    
    async def get_patient(self, patient_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Get a patient profile by ID (with ownership check)"""
        try:
            patient_ref = self.patients_collection.document(patient_id)
            patient_doc = patient_ref.get()
            
            if patient_doc.exists:
                data = patient_doc.to_dict()
                # Security check - ensure the requesting user owns this patient
                if data.get('user_id') != user_id:
                    logger.warning(f"User {user_id} attempted to access patient {patient_id} owned by {data.get('user_id')}")
                    return None
                data['id'] = patient_doc.id
                return data
            else:
                logger.warning(f"No patient found with ID {patient_id}")
                return None
                
        except Exception as e:
            logger.error(f"Error getting patient: {str(e)}")
            return None
    
    async def update_patient(self, patient_id: str, user_id: str, updates: Dict[str, Any]) -> bool:
        """Update a patient profile (with ownership check)"""
        try:
            # First check ownership
            patient = await self.get_patient(patient_id, user_id)
            if not patient:
                return False
            
            patient_ref = self.patients_collection.document(patient_id)
            
            # Add updated_at timestamp
            updates['updated_at'] = datetime.now(timezone.utc)
            
            patient_ref.update(updates)
            logger.info(f"Updated patient {patient_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating patient: {str(e)}")
            return False
    
    async def list_user_patients(
        self, 
        user_id: str, 
        active_only: bool = True,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """List all patients for a user"""
        try:
            # TEMPORARY FIX: Simplified query to avoid composite index requirement
            # TODO: Deploy firestore.indexes.json and revert to the optimized query
            
            # Simple query - just filter by user_id
            query = self.patients_collection.where(
                filter=FieldFilter('user_id', '==', user_id)
            )
            
            # Get extra results if we need to filter/limit in Python
            if limit and active_only:
                query = query.limit(limit * 2)  # Get more to account for filtering
            elif limit:
                query = query.limit(limit)
            
            patients = []
            for doc in query.stream():
                patient_data = doc.to_dict()
                patient_data['id'] = doc.id
                
                # Apply active filter in Python
                if active_only and not patient_data.get('active', True):
                    continue
                    
                patients.append(patient_data)
            
            # Sort in Python by last name, then first name
            patients.sort(key=lambda p: (
                p.get('last_name', '').lower(),
                p.get('first_name', '').lower()
            ))
            
            # Apply limit after sorting if needed
            if limit and len(patients) > limit:
                patients = patients[:limit]
            
            logger.info(f"Retrieved {len(patients)} patients for user {user_id}")
            return patients
            
        except Exception as e:
            logger.error(f"Error listing user patients for user {user_id}: {str(e)}")
            logger.error(f"Full exception details: {type(e).__name__}: {e}")
            # Check if this is a missing index error
            if "The query requires an index" in str(e):
                logger.error("Missing Firestore index for patients query. Deploy firestore.indexes.json to fix.")
            return []
    
    async def search_patients(
        self, 
        user_id: str, 
        search_term: str,
        active_only: bool = True
    ) -> List[Dict[str, Any]]:
        """Search patients by name (case-insensitive partial match)"""
        try:
            # Get all patients for the user
            all_patients = await self.list_user_patients(user_id, active_only=active_only)
            
            # Filter by search term (case-insensitive)
            search_lower = search_term.lower()
            matching_patients = []
            
            for patient in all_patients:
                first_name = patient.get('first_name', '').lower()
                last_name = patient.get('last_name', '').lower()
                
                if search_lower in first_name or search_lower in last_name:
                    matching_patients.append(patient)
            
            return matching_patients
            
        except Exception as e:
            logger.error(f"Error searching patients: {str(e)}")
            return []
    
    async def soft_delete_patient(self, patient_id: str, user_id: str) -> bool:
        """Soft delete a patient (set active=False)"""
        try:
            return await self.update_patient(patient_id, user_id, {'active': False})
        except Exception as e:
            logger.error(f"Error soft deleting patient: {str(e)}")
            return False
    
    async def get_patient_transcripts(self, patient_id: str, user_id: str) -> List[Dict[str, Any]]:
        """Get all transcripts for a specific patient"""
        try:
            # Query transcripts collection for all transcripts with this patient_id
            query = self.transcripts_collection.where(
                filter=FieldFilter('patient_id', '==', patient_id)
            ).where(
                filter=FieldFilter('user_id', '==', user_id)
            ).order_by('created_at', direction=firestore.Query.DESCENDING)
            
            transcripts = []
            docs_found = 0
            for doc in query.stream():
                docs_found += 1
                transcript_data = doc.to_dict()
                transcript_data['id'] = doc.id
                logger.info(f"Found transcript {doc.id} with patient_id: {transcript_data.get('patient_id')}, patient_name: {transcript_data.get('patient_name')}")
                
                # Format the transcript data to match RecordingInfo model
                recording_info = {
                    'id': doc.id,
                    'name': transcript_data.get('patient_name', 'Unknown Patient'),
                    'date': transcript_data.get('created_at', datetime.now()),
                    'status': transcript_data.get('status', 'saved'),
                    'gcsPathTranscript': transcript_data.get('gcs_path_transcript'),
                    'gcsPathPolished': transcript_data.get('gcs_path_polished'),
                    'gcsPathMetadata': transcript_data.get('gcs_path_metadata'),
                    'patientContext': transcript_data.get('patient_context'),
                    'encounterType': transcript_data.get('encounter_type'),
                    'evaluation_type': transcript_data.get('evaluation_type'),
                    'positive_findings': transcript_data.get('positive_findings'),
                    'llmTemplateName': transcript_data.get('llm_template_name'),
                    'location': transcript_data.get('location'),
                    'durationSeconds': transcript_data.get('duration_seconds'),
                    'transcript': transcript_data.get('transcript_original', ''),
                    'polishedTranscript': transcript_data.get('transcript_polished', ''),
                    'profileId': transcript_data.get('profile_id'),
                    'patient_id': patient_id
                }
                transcripts.append(recording_info)
            
            logger.info(f"Query found {docs_found} documents, returning {len(transcripts)} transcripts for patient {patient_id}")
            return transcripts
            
        except Exception as e:
            logger.error(f"Error getting patient transcripts: {str(e)}")
            return []

# Create singleton instance
firestore_client = FirestoreClient()