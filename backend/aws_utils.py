import asyncio
import json
import os # Though os.getenv for AWS_S3_BUCKET_NAME is removed from functions

async def polish_transcript_with_bedrock(transcript: str, bedrock_client) -> str:
    if not bedrock_client:
        print("Bedrock runtime client not provided to utility function. Skipping polishing.")
        return transcript

    model_id = 'anthropic.claude-3-haiku-20240307-v1:0'
    prompt = f"""Human: Please review and polish the following medical transcript. Focus on:
- Clarity and conciseness.
- Correcting grammatical errors, spelling mistakes, and punctuation.
- Ensuring a professional and formal tone suitable for clinical notes.
- Do NOT add any information that isn't present in the original transcript.
- Do NOT add any preamble like 'Here is the polished transcript:'. Just output the polished text directly.

Transcript to polish:
```text
{transcript}
```

Assistant:"""

    try:
        request_body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 4096, 
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
                print("Transcript polished successfully by Bedrock Claude Haiku (via aws_utils).")
                return polished_text.strip()
            else:
                print("Bedrock response was empty or malformed (no text content) (via aws_utils).")
        else:
            print(f"Bedrock Claude Haiku response structure not as expected (via aws_utils): {response_body}")
        
        print("Failed to get polished transcript from Bedrock (via aws_utils), returning original.")
        return transcript
        
    except Exception as e:
        print(f"Error invoking Bedrock Claude Haiku (via aws_utils): {e}")
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
