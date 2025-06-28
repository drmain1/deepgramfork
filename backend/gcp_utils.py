import os
import json
import logging
from typing import Optional, Dict, Any
from google.cloud import aiplatform
from google.oauth2 import service_account
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig, HarmCategory, HarmBlockThreshold
from datetime import datetime

logger = logging.getLogger(__name__)

def initialize_vertex_ai():
    """Initialize Vertex AI with credentials and project settings."""
    try:
        # Get configuration from environment variables
        project_id = os.getenv('GCP_PROJECT_ID')
        location = os.getenv('GCP_LOCATION', 'us-central1')
        
        # Handle credentials
        credentials_path = os.getenv('GCP_CREDENTIALS_PATH')
        if credentials_path and os.path.exists(credentials_path):
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=['https://www.googleapis.com/auth/cloud-platform']
            )
            vertexai.init(project=project_id, location=location, credentials=credentials)
        else:
            # Use default credentials (for development/testing)
            vertexai.init(project=project_id, location=location)
        
        logger.info(f"Vertex AI initialized for project: {project_id}, location: {location}")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize Vertex AI: {str(e)}")
        return False

def polish_transcript_with_gemini(
    transcript: str,
    patient_name: str,
    patient_context: str,
    encounter_type: str,
    llm_instructions: str,
    location: Optional[str] = None,
    model_name: str = "publishers/google/models/gemini-2.5-flash"
) -> Dict[str, Any]:
    """
    Polish transcript using Google Gemini Pro via Vertex AI.
    
    Args:
        transcript: Raw transcript text
        patient_name: Patient name
        patient_context: Additional patient context
        encounter_type: Type of medical encounter
        llm_instructions: Template-specific LLM instructions
        location: Optional location information
        model_name: Gemini model to use (default: gemini-1.5-pro)
    
    Returns:
        Dictionary with polished transcript and metadata
    """
    try:
        # Initialize Vertex AI if not already done
        if not hasattr(polish_transcript_with_gemini, '_initialized'):
            if initialize_vertex_ai():
                polish_transcript_with_gemini._initialized = True
            else:
                raise Exception("Failed to initialize Vertex AI")
        
        # Prepare the prompt
        prompt_parts = []
        
        # Add the LLM instructions (which already contains patient info from firestore_endpoints.py)
        prompt_parts.append(llm_instructions)
        
        # Add the transcript
        prompt_parts.append("\n\nTranscript to polish:")
        prompt_parts.append(transcript)
        
        # Combine all parts
        full_prompt = "\n".join(prompt_parts)
        
        # Log the instructions portion for debugging
        logger.info(f"LLM Instructions section: {llm_instructions[:300]}...")
        
        # Configure the model with fallback options
        model = None
        model_used = model_name
        
        # Try requested model first, then fallback to available models
        model_options = [model_name, "gemini-1.5-pro-002", "gemini-2.0-flash-exp"]
        
        for try_model in model_options:
            try:
                model = GenerativeModel(try_model)
                model_used = try_model
                logger.info(f"Using model: {try_model}")
                break
            except Exception as e:
                logger.warning(f"Model {try_model} not available: {str(e)}")
                continue
        
        if not model:
            raise Exception("No compatible Gemini model found")
        
        # Configure generation parameters for medical accuracy
        generation_config = GenerationConfig(
            temperature=0.1,  # Low temperature for consistency
            top_p=0.95,
            top_k=40,
            max_output_tokens=8192,
        )
        
        # Generate response
        logger.info(f"Sending transcript to Gemini Pro for polishing (model: {model_name})")
        response = model.generate_content(
            full_prompt,
            generation_config=generation_config,
            safety_settings={
                HarmCategory.HARM_CATEGORY_HATE_SPEECH: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: HarmBlockThreshold.BLOCK_NONE,
                HarmCategory.HARM_CATEGORY_HARASSMENT: HarmBlockThreshold.BLOCK_NONE,
            }
        )
        
        # Extract the polished text
        polished_text = response.text
        
        # Log success
        logger.info(f"Successfully polished transcript with Gemini Pro")
        
        return {
            'success': True,
            'polished_transcript': polished_text,
            'model_used': model_used,
            'timestamp': datetime.utcnow().isoformat(),
            'input_length': len(transcript),
            'output_length': len(polished_text)
        }
        
    except Exception as e:
        logger.error(f"Error polishing transcript with Gemini: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'polished_transcript': transcript  # Return original if processing fails
        }

def test_gemini_connection():
    """Test the Gemini API connection with a simple request."""
    try:
        if not initialize_vertex_ai():
            return False, "Failed to initialize Vertex AI"
        
        # Try different model options
        model_options = ["publishers/google/models/gemini-2.5-pro-preview-05-06", "gemini-1.5-pro-002", "gemini-2.0-flash-exp"]
        
        for model_name in model_options:
            try:
                model = GenerativeModel(model_name)
                response = model.generate_content("Say 'Connection successful' if you can read this.")
                if response and response.text:
                    return True, f"Connection test successful with {model_name}: {response.text[:50]}..."
            except Exception as e:
                continue
        
        return False, "No compatible Gemini model found"
            
    except Exception as e:
        return False, f"Connection test failed: {str(e)}"