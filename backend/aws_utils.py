import asyncio
import json
import os # Though os.getenv for AWS_S3_BUCKET_NAME is removed from functions

async def polish_transcript_with_bedrock(transcript: str, bedrock_client, custom_instructions: str = None) -> str:
    if not bedrock_client:
        print("Bedrock runtime client not provided to utility function. Skipping polishing.")
        return transcript

    # Using Claude Sonnet 4 via cross-region inference - Latest and most advanced model
    # This model ID leverages cross-region inference for better throughput and availability
    # The 'us.' prefix indicates this will route across US regions (us-east-1, us-east-2, us-west-2)
    # Fallback option if needed: 'anthropic.claude-sonnet-4-20250514-v1:0' (direct model access)
    model_id = 'us.anthropic.claude-sonnet-4-20250514-v1:0'
    
    # Define the default prompt if no custom instructions are provided
    if custom_instructions:
        user_prompt_content = custom_instructions
    else:
        user_prompt_content = """Please review and polish the following medical transcript. Focus on:
- Clarity and conciseness.
- Correcting grammatical errors, spelling mistakes, and punctuation.
- Ensuring a professional and formal tone suitable for clinical notes.
- Do NOT add any information that isn't present in the original transcript.
- Do NOT add any preamble like 'Here is the polished transcript:'. Just output the polished text directly."""

    prompt = f"""Human: {user_prompt_content}

Transcript to process:
```text
{transcript}
```

A:"""

    try:
        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 1000, 
            "messages": [
                {
                    "role": "user",
                    "content": [{
                        "type": "text",
                        "text": prompt
                    }]
                }
            ]
        })

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, 
            lambda: bedrock_client.invoke_model(
                body=request_body,
                modelId=model_id,
                contentType='application/json',
                accept='application/json'
            )
        )
        
        response_body = json.loads(response.get('body').read())
        
        if response_body.get("content") and isinstance(response_body["content"], list) and len(response_body["content"]) > 0:
            polished_text = response_body["content"][0].get("text", "")
            if polished_text:
                print(f"Transcript processed by Bedrock Claude Sonnet 4 (cross-region). Custom instructions used: {'Yes' if custom_instructions else 'No (default medical)'}.")
                return polished_text.strip()
            else:
                print("Bedrock response was empty or malformed (no text content) (via aws_utils).")
        else:
            print(f"Bedrock Claude Sonnet 4 response structure not as expected (via aws_utils): {response_body}")
        
        print("Failed to get processed transcript from Bedrock (via aws_utils), returning original.")
        return transcript
        
    except Exception as e:
        # Enhanced error logging for debugging
        error_details = {
            'error_type': type(e).__name__,
            'error_message': str(e),
            'model_id': model_id,
            'transcript_length': len(transcript) if transcript else 0,
            'custom_instructions_used': bool(custom_instructions),
            'max_tokens_requested': 8096
        }
        
        # Check if it's a specific AWS/Bedrock error
        if hasattr(e, 'response'):
            error_details['aws_error_code'] = e.response.get('Error', {}).get('Code', 'Unknown')
            error_details['aws_error_message'] = e.response.get('Error', {}).get('Message', 'Unknown')
            error_details['http_status_code'] = e.response.get('ResponseMetadata', {}).get('HTTPStatusCode', 'Unknown')
            error_details['request_id'] = e.response.get('ResponseMetadata', {}).get('RequestId', 'Unknown')
        
        print(f"DETAILED ERROR - Bedrock Claude Sonnet 4 invocation failed:")
        print(f"  Error Type: {error_details['error_type']}")
        print(f"  Error Message: {error_details['error_message']}")
        print(f"  Model ID: {error_details['model_id']}")
        print(f"  Transcript Length: {error_details['transcript_length']} characters")
        print(f"  Custom Instructions: {error_details['custom_instructions_used']}")
        print(f"  Max Tokens Requested: {error_details['max_tokens_requested']}")
        
        if hasattr(e, 'response'):
            print(f"  AWS Error Code: {error_details['aws_error_code']}")
            print(f"  AWS Error Message: {error_details['aws_error_message']}")
            print(f"  HTTP Status: {error_details['http_status_code']}")
            print(f"  Request ID: {error_details['request_id']}")
        
        return transcript

async def save_text_to_s3(s3_client, aws_s3_bucket_name: str, tenant_id: str, session_id: str, content: str, folder: str = "notes"):
    if not s3_client or not aws_s3_bucket_name:
        print(f"S3 client or bucket name not provided to utility function. Skipping S3 upload for {folder}/{session_id}.txt.")
        return None
    
    s3_key = f"{tenant_id}/{folder}/{session_id}.txt"
    try:
        # For run_in_executor with s3_client.put_object as it's a blocking call
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None, 
            lambda: s3_client.put_object(Bucket=aws_s3_bucket_name, Key=s3_key, Body=content.encode('utf-8'), ContentType='text/plain')
        )
        print(f"Successfully uploaded {s3_key} to S3 bucket {aws_s3_bucket_name} (via aws_utils).")
        return f"s3://{aws_s3_bucket_name}/{s3_key}"
    except Exception as e:
        print(f"Error uploading {s3_key} to S3 (via aws_utils): {e}")
        return None

async def save_audio_file_to_s3(s3_client, aws_s3_bucket_name: str, tenant_id: str, session_id: str, local_file_path: str, folder: str = "audio", content_type: str = "audio/wav"):
    if not s3_client or not aws_s3_bucket_name:
        print(f"S3 client or bucket name not provided to utility function. Skipping S3 upload for {folder}/{session_id}.wav.")
        return None
    
    s3_key = f"{tenant_id}/{folder}/{session_id}.wav"
    try:
        with open(local_file_path, 'rb') as f:
            # For run_in_executor with s3_client.put_object as it's a blocking call
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                lambda: s3_client.put_object(Bucket=aws_s3_bucket_name, Key=s3_key, Body=f, ContentType=content_type)
            )
        print(f"Successfully uploaded {s3_key} to S3 bucket {aws_s3_bucket_name} (via aws_utils).")
        return f"s3://{aws_s3_bucket_name}/{s3_key}"
    except FileNotFoundError:
        print(f"Error: Local audio file {local_file_path} not found for S3 upload (via aws_utils).")
        return None
    except Exception as e:
        print(f"Error uploading {s3_key} to S3 (via aws_utils): {e}")
        return None

async def delete_s3_object(s3_client, aws_s3_bucket_name: str, s3_key: str):
    if not s3_client or not aws_s3_bucket_name:
        print(f"S3 client or bucket name not provided. Skipping S3 delete for {s3_key}.")
        return False
    
    try:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: s3_client.delete_object(Bucket=aws_s3_bucket_name, Key=s3_key)
        )
        print(f"Successfully deleted {s3_key} from S3 bucket {aws_s3_bucket_name} (via aws_utils).")
        return True
    except Exception as e:
        print(f"Error deleting {s3_key} from S3 (via aws_utils): {e}")
        return False
