# GCS Naming Conventions and Common Issues

## File Path Structure

All files in Google Cloud Storage follow this structure:
```
{user_id}/{data_type}/{subdirectory}/{session_id}.{extension}
```

## Current File Naming Conventions

### 1. Transcripts
- **Original**: `{user_id}/transcripts/original/{session_id}.txt`
- **Polished**: `{user_id}/transcripts/polished/{session_id}.txt`

### 2. Metadata
- **Path**: `{user_id}/metadata/{session_id}.txt`
- **Content**: JSON formatted data stored as plain text

### 3. Drafts
- **Path**: `{user_id}/drafts/{session_id}.txt`
- **Content**: JSON formatted draft data

### 4. Settings
- **Path**: `{user_id}/settings/user_settings.json`
- **Content**: User preferences and configuration

### 5. Audio (if stored)
- **Path**: `{user_id}/audio/{session_id}.webm`

## Common Extension Mismatch Issues

### Problem: Metadata Not Found
**Symptom**: Backend logs show:
```
INFO:gcs_utils:Successfully saved metadata for session {id}
WARNING:gcs_utils:Object not found: {user_id}/metadata/{session_id}.txt
```

**Cause**: Extension mismatch between save and read operations
- Check `gcs_utils.py` save_data_to_gcs() method
- Check `main.py` where metadata paths are constructed
- Ensure both use `.txt` extension

### Problem: Settings Not Loading
**Symptom**: User settings revert to defaults

**Cause**: Inconsistent path or extension
- Settings should be at `{user_id}/settings/user_settings.json`
- Check both save and load operations use `.json`

## Quick Debugging Checklist

1. **Check File Extensions**
   - Metadata: `.txt` (contains JSON)
   - Transcripts: `.txt`
   - Settings: `.json`
   - Drafts: `.txt` (contains JSON)

2. **Check Path Construction**
   - In `gcs_utils.py`: How paths are built when saving
   - In `main.py`: How paths are built when reading
   - Ensure leading/trailing slashes are consistent

3. **Common Files to Check**
   ```python
   # In gcs_utils.py - save_data_to_gcs()
   if data_type == "metadata":
       object_name = f"{user_id}/metadata/{session_id}.txt"  # Must be .txt
   
   # In main.py - get_user_recordings()
   gcs_path_metadata = f"{user_id}/metadata/{session_id}.txt"  # Must match
   ```

4. **Verify in GCS Console**
   - Check actual file names in Google Cloud Console
   - Look for files with wrong extensions (.json vs .txt)
   - Check for duplicate files with different extensions

## Prevention Tips

1. **Use Constants**: Define path patterns as constants
   ```python
   METADATA_PATH_PATTERN = "{user_id}/metadata/{session_id}.txt"
   TRANSCRIPT_ORIGINAL_PATH_PATTERN = "{user_id}/transcripts/original/{session_id}.txt"
   ```

2. **Centralize Path Generation**: Create utility functions
   ```python
   def get_metadata_path(user_id: str, session_id: str) -> str:
       return f"{user_id}/metadata/{session_id}.txt"
   ```

3. **Add Logging**: Log full paths when saving/reading
   ```python
   logger.info(f"Saving to GCS path: {full_path}")
   logger.info(f"Reading from GCS path: {full_path}")
   ```

## Related Files

- `backend/gcs_utils.py` - GCS operations and path construction
- `backend/main.py` - API endpoints that read/write GCS
- `backend/deepgram_utils.py` - May save audio or transcripts
- `backend/speechmatics_utils.py` - May save audio or transcripts

## Historical Issues

1. **Metadata Extension Mismatch (2024-01-23)**
   - Saved as `.json`, read as `.txt`
   - Fixed by standardizing to `.txt`
   - Affected patient name display after processing

2. **Draft Path Inconsistency**
   - Some code used `drafts/`, others used `draft/`
   - Standardized to `drafts/`

Remember: When in doubt, check the actual GCS bucket to see what files exist and their exact paths!