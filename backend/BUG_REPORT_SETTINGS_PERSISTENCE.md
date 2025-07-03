# Bug Report: User Settings Persistence Issue

## Issue Summary
After the main.py refactor on July 2, 2025, user settings stopped persisting correctly. Only simple string fields (doctor_name, medical_specialty) were saved, while complex fields (arrays, objects) like narrative templates, custom vocabulary, and macro phrases were lost after cache expiry.

## Timeline
1. **Pre-refactor**: Settings stored in Firestore → Working correctly ✓
2. **Post-refactor**: Settings moved to hybrid GCS/Firestore system → Complex fields not persisting ✗
3. **Initial fix attempt**: Modified sync_to_firestore to save full data → Data saved to Firestore correctly ✓
4. **Second fix attempt**: Changed Firestore update method to set(merge=True) → Data still not showing ✗
5. **Root cause discovered**: Read/write mismatch - saving to Firestore but reading from GCS ✗
6. **Final fix**: Changed read endpoint to use Firestore → Fixed ✓

## Root Cause
The issue was a **read/write mismatch** introduced during the refactor:
- **WRITE**: The save endpoint (`POST /api/v1/user_settings`) was correctly saving to both GCS and Firestore
- **READ**: The read endpoint (`GET /api/v1/user_settings/{user_id}`) was reading from GCS only
- **Problem**: GCS wasn't properly saving complex fields, but Firestore was

This created the illusion that data wasn't persisting, when in fact it was saved correctly in Firestore but the frontend was reading from the wrong source (GCS).

## The Fix
Changed the GET endpoint to read from Firestore instead of GCS:

```python
# OLD CODE (reading from GCS via UserSettingsService)
settings = await user_settings_service.get_user_settings(user_id)

# NEW CODE (reading directly from Firestore)
from firestore_endpoints import get_user_settings_firestore
settings = await get_user_settings_firestore(user_id, current_user_id, request)
```

## Why This Fixed It
By changing the read endpoint to use Firestore:
1. **Consistent data source** - Both read and write use the same storage (Firestore)
2. **No cache issues** - Firestore provides real-time data, no 5-minute cache delays
3. **Complex fields work** - Firestore handles arrays, objects, and nested structures properly
4. **Immediate persistence** - Changes are visible immediately after saving

## Additional Improvements Made
The `set(merge=True)` change in firestore_client.py also helped:
1. **More robust updates** - Creates document if it doesn't exist
2. **Better error handling** - Less likely to fail silently
3. **Handles all field types** - Works with complex nested data

## Affected Fields
Fields that were NOT persisting:
- `transcription_profiles` (array of objects) - Narrative templates
- `custom_vocabulary` (array)
- `macro_phrases` (array of objects)
- `office_information` (array)
- `cpt_fees` (object)
- `doctor_signature` (string/URL)
- `clinic_logo` (string/URL)
- `custom_billing_rules` (string)

Fields that WERE persisting:
- `doctor_name` (simple string)
- `medical_specialty` (simple string)

## Testing Checklist
After applying the fix, verify:
- [ ] Narrative templates save and persist after 5+ minutes
- [ ] Custom vocabulary saves and persists
- [ ] Macro phrases save and persist
- [ ] Office information saves and persists
- [ ] Doctor signature/clinic logo URLs save and persist
- [ ] CPT fees save and persist
- [ ] All settings survive cache expiry and server restarts

## Lessons Learned
1. **Read/write consistency is critical** - Ensure endpoints use the same data source
2. **Hybrid storage adds complexity** - Having data in both GCS and Firestore created confusion
3. **Cache can mask issues** - The 5-minute GCS cache made debugging harder
4. **Debug logging is essential** - Added logging helped identify the mismatch
5. **Firestore is better for structured data** - GCS is for files, not JSON settings

## Prevention
To prevent similar issues:
1. **Single source of truth** - Use one storage system for each data type
2. **Consistent read/write paths** - Ensure GET and POST endpoints use the same storage
3. **Comprehensive logging** - Log data at each step of save/load operations
4. **Integration tests** - Test the full cycle: save → cache expiry → load
5. **Clear architecture** - Document which storage system is used for what data

## Files Modified
1. `/backend/main.py` - Line 228: Changed GET endpoint to read from Firestore
2. `/backend/firestore_client.py` - Line 92: Changed from `update()` to `set(merge=True)`
3. Added extensive debug logging to trace the issue

## Recommendation
Consider removing GCS storage for user settings entirely and using Firestore as the single source of truth. GCS should be reserved for actual files (images, documents), while Firestore handles all structured data (settings, metadata).