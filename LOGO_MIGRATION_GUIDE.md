# Logo Storage Migration Guide

## Overview
We've successfully refactored the logo management system from base64 storage to proper GCS file storage. This provides better performance, larger file size support, and proper CDN serving.

## Changes Made

### Backend Changes
1. **Upload Endpoint** (`/api/v1/upload_logo`):
   - Now stores logo files directly in GCS as binary files
   - Returns GCS public URL instead of base64 data URL
   - Increased file size limit from 1MB to 5MB
   - Automatically deletes old logo when uploading new one

2. **Delete Endpoint** (`/api/v1/delete_logo`):
   - Now deletes the actual logo file from GCS
   - Cleans up both the file and settings reference

3. **Migration Endpoint** (`/api/v1/migrate_logo`):
   - New endpoint to migrate existing base64 logos to GCS
   - Parses base64 data URLs and uploads as proper files
   - Updates settings with new GCS URL

4. **GCS Utils**:
   - Updated `save_data_to_gcs` to handle binary content and custom content types
   - Supports logo file storage with proper MIME types

### Frontend Changes
1. **OfficeInformationTab Component**:
   - Updated file size limit display from 1MB to 5MB
   - Added automatic migration for base64 logos on component load
   - No changes needed for display - works with both base64 and URLs

### Storage Structure
- Logos are stored at: `{user_id}/logos/logo_{timestamp}.{ext}`
- Public URL format: `https://storage.googleapis.com/{bucket_name}/{user_id}/logos/logo_{timestamp}.{ext}`

## Testing Guide

### 1. Test New Logo Upload
```bash
# Upload a new logo through the UI
# Should see the logo stored as a GCS URL in settings
```

### 2. Test Logo Deletion
```bash
# Delete a logo through the UI
# Should remove both the file from GCS and the URL from settings
```

### 3. Test Base64 Migration
```bash
# For users with existing base64 logos:
# 1. Load the Office Information tab
# 2. Should automatically migrate to GCS
# 3. Check console for migration messages

# Or manually trigger migration:
curl -X POST https://api.medlegaldoc.com/api/v1/migrate_logo \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Verify Storage
```bash
# Check debug endpoint to see logo status:
curl https://api.medlegaldoc.com/api/v1/debug_logo/USER_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Migration Script
For bulk migration of existing users, use:
```bash
cd backend
python migrate_base64_logos.py
```

## Benefits
1. **Performance**: Logos served directly from GCS/CDN
2. **Storage**: No more base64 overhead (33% size reduction)
3. **Limits**: Increased from 1MB to 5MB
4. **Efficiency**: Settings JSON stays small
5. **Scalability**: Proper object storage usage

## Rollback Plan
If issues arise:
1. The frontend handles both base64 and URL formats
2. Existing base64 logos continue to work
3. Can revert backend endpoints while keeping frontend changes