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
        
        # Additional logging for re-evaluation debugging
        if "Previous Initial Evaluation Findings:" in llm_instructions:
            logger.info("Re-evaluation detected - Previous findings ARE included in LLM instructions")
            findings_start = llm_instructions.find("Previous Initial Evaluation Findings:")
            logger.info(f"Previous findings section preview: {llm_instructions[findings_start:findings_start+200]}...")
        else:
            logger.info("No previous findings section found in LLM instructions")
        
        # Configure the model with fallback options
        model = None
        model_used = model_name
        
        # Try requested model first, then fallback to available models
        model_options = [model_name, "gemini-2.5-flash-lite-preview-06-17", "publishers/google/models/gemini-2.5-flash", "gemini-2.0-flash-exp"]
        
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
        if encounter_type == "findings_extraction":
            # Optimized parameters for fast extraction
            generation_config = GenerationConfig(
                temperature=0.2,  # Very low temperature for consistent extraction
                top_p=0.9,
                top_k=20,
                max_output_tokens=4000,  # Smaller output for findings only
            )
        else:
            generation_config = GenerationConfig(
                temperature=0.4,  # Low temperature for consistency
                top_p=0.95,
                top_k=40,
                max_output_tokens=12000,
            )
        
        # Generate response
        if encounter_type == "findings_extraction":
            logger.info(f"Extracting findings using lightweight model: {model_used}")
        else:
            logger.info(f"Sending transcript to Gemini for polishing (model: {model_used})")
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
        
        # For findings extraction, keep the full response with code blocks
        if encounter_type == "findings_extraction":
            logger.info("Findings extraction mode - keeping full response with code blocks")
            logger.info(f"Raw LLM response length: {len(polished_text)}")
            logger.info(f"First 500 chars of LLM response: {polished_text[:500]}...")
            # Don't strip anything for findings extraction
        else:
            # Clean up the response in case it's wrapped in markdown or quotes
            # Remove markdown code blocks if present
            if polished_text.strip().startswith('```json'):
                polished_text = polished_text.strip()[7:]  # Remove ```json
                if polished_text.endswith('```'):
                    polished_text = polished_text[:-3]  # Remove closing ```
            elif polished_text.strip().startswith('```'):
                polished_text = polished_text.strip()[3:]  # Remove ```
                if polished_text.endswith('```'):
                    polished_text = polished_text[:-3]  # Remove closing ```
        
        # Remove any leading/trailing whitespace
        polished_text = polished_text.strip()
        
        # Remove outer quotes if the entire response is quoted
        if polished_text.startswith('"') and polished_text.endswith('"'):
            try:
                # Try to parse as a JSON string
                import json
                polished_text = json.loads(polished_text)
                if isinstance(polished_text, str):
                    # It was a quoted string, use the unquoted version
                    pass
                else:
                    # It wasn't a simple quoted string, revert
                    polished_text = response.text.strip()
            except:
                # If parsing fails, keep the original
                pass
        
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

def generate_billing_with_gemini(
    transcript: str,
    patient_info: Dict[str, Any],
    billing_instructions: str,
    encounter_type: str,
    service_date: Optional[str] = None,
    custom_cpt_fees: Optional[Dict[str, float]] = None,
    model_name: str = "gemini-2.5-pro"
) -> Dict[str, Any]:
    """
    Generate billing information from a medical transcript using Google Gemini 2.5 Pro.
    
    Args:
        transcript: The medical transcript (polished or original)
        patient_info: Patient information dictionary
        billing_instructions: Custom billing instructions/template
        encounter_type: Type of medical encounter
        service_date: Date of service (YYYY-MM-DD format)
        model_name: Gemini model to use (default: gemini-2.5-pro)
    
    Returns:
        Dictionary with billing data and metadata
    """
    try:
        # Initialize Vertex AI if not already done
        if not hasattr(generate_billing_with_gemini, '_initialized'):
            if initialize_vertex_ai():
                generate_billing_with_gemini._initialized = True
            else:
                raise Exception("Failed to initialize Vertex AI")
        
        # Prepare the prompt
        prompt_parts = []
        
        # Add billing context
        prompt_parts.append("You are a medical billing specialist generating accurate billing information from medical transcripts.")
        prompt_parts.append(f"\nEncounter Type: {encounter_type}")
        
        if service_date:
            prompt_parts.append(f"Date of Service: {service_date}")
        
        # Add patient info
        prompt_parts.append(f"\nPatient: {patient_info.get('first_name', '')} {patient_info.get('last_name', '')}")
        if patient_info.get('date_of_birth'):
            prompt_parts.append(f"DOB: {patient_info.get('date_of_birth')}")
        if patient_info.get('insurance_info'):
            prompt_parts.append(f"Insurance: {patient_info.get('insurance_info')}")
        
        # Add custom billing instructions
        prompt_parts.append("\n\nBilling Instructions:")
        prompt_parts.append(billing_instructions)
        
        # Add custom CPT fees if provided
        if custom_cpt_fees:
            prompt_parts.append("\n\nCustom CPT Code Fees:")
            for cpt_code, fee in custom_cpt_fees.items():
                prompt_parts.append(f"{cpt_code}: ${fee}")
        
        # Add the transcript
        prompt_parts.append("\n\nMedical Transcript:")
        prompt_parts.append(transcript)
        
        # Add output format request - be specific to control output size
        prompt_parts.append("\n\nIMPORTANT: Keep your response concise and focused.")
        prompt_parts.append("Generate the billing output in exactly this format:")
        prompt_parts.append("1. First, the Compliance & Recommendations Report (keep it under 2000 words)")
        prompt_parts.append("2. Then, the billing JSON in a ```json code block")
        prompt_parts.append("Do not include lengthy explanations or examples. Focus on the actual billing data for this specific case.")
        
        # Combine all parts
        full_prompt = "\n".join(prompt_parts)
        
        # Configure the model with fallback options
        model = None
        model_used = model_name
        
        # Try different model name formats
        model_options = [
            model_name,
            "gemini-1.5-pro-002",  # Fallback to stable model
            "gemini-1.5-flash",    # Another fallback
            "publishers/google/models/gemini-2.5-flash"  # Try with full path
        ]
        
        for try_model in model_options:
            try:
                model = GenerativeModel(try_model)
                model_used = try_model
                logger.info(f"Using model for billing: {try_model}")
                break
            except Exception as e:
                logger.warning(f"Billing model {try_model} not available: {str(e)}")
                continue
        
        if not model:
            raise Exception("No compatible Gemini model found for billing")
        
        # Configure generation parameters for accuracy
        # Increase max tokens to handle comprehensive billing output
        generation_config = GenerationConfig(
            temperature=0.1,  # Very low for billing accuracy
            top_p=0.95,
            top_k=40,
            max_output_tokens=37768,  # Increased by 5000 for billing reports
        )
        
        # Generate response
        logger.info(f"Generating billing information with Gemini 2.5 Pro")
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
        
        # Extract the billing text
        # Check if response was cut off due to token limit
        if hasattr(response, 'candidates') and response.candidates:
            candidate = response.candidates[0]
            if hasattr(candidate, 'finish_reason') and candidate.finish_reason == 'MAX_TOKENS':
                logger.warning("Response hit token limit - output may be truncated")
                # Try to extract partial content if available
                if hasattr(response, 'text'):
                    billing_text = response.text
                else:
                    # If no text available, return error
                    return {
                        'success': False,
                        'error': 'Response exceeded token limit and was truncated. Please try with fewer transcripts.',
                        'billing_data': None
                    }
            else:
                billing_text = response.text
        else:
            billing_text = response.text
        
        # Log success
        logger.info(f"Successfully generated billing information")
        
        return {
            'success': True,
            'billing_data': billing_text,
            'model_used': model_used,
            'timestamp': datetime.utcnow().isoformat(),
            'service_date': service_date,
            'encounter_type': encounter_type
        }
        
    except Exception as e:
        error_msg = str(e)
        # Check for specific error patterns
        if "MAX_TOKENS" in error_msg or "Cannot get the response text" in error_msg:
            logger.error(f"Token limit exceeded in billing generation: {error_msg}")
            return {
                'success': False,
                'error': 'The billing report is too large. Please select fewer transcripts or contact support.',
                'billing_data': None
            }
        else:
            logger.error(f"Error generating billing with Gemini: {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'billing_data': None
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