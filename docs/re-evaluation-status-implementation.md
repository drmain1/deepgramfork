# Re-evaluation Status Feature Implementation

## Overview

The re-evaluation status feature displays a visual indicator showing how many sessions have occurred since the last evaluation and whether a re-evaluation is due. This feature has been updated to work with the multiple re-evaluation system, tracking sessions from the most recent evaluation rather than always from the initial evaluation.

## Feature Components

### 1. Backend API Endpoint

**Endpoint**: `/api/v1/patients/{patient_id}/re-evaluation-status`
**File**: `/backend/patient_endpoints.py` (function `get_re_evaluation_status`)

#### Response Format
```json
{
  "status": "evaluated",
  "days_since_last": 15,
  "session_count": 25,
  "sessions_since_evaluation": 8,
  "last_evaluation_date": "2024-01-15T10:30:00Z",
  "last_evaluation_type": "re_evaluation",
  "color": "yellow",
  "message": "Re-evaluation due soon: 15 days, 8 sessions",
  "patient_name": "Smith, John"
}
```

#### Status Colors
- **Green**: 0-30 days AND < 12 sessions since last evaluation
- **Yellow**: 31-45 days OR 10-11 sessions since last evaluation
- **Red**: 46+ days OR 12+ sessions since last evaluation
- **Gray**: No evaluation exists, < 10 total sessions

### 2. Frontend Component

**Component**: `ReEvaluationIndicator.jsx`
**Location**: `/my-vite-react-app/src/components/ReEvaluationIndicator.jsx`

#### Display States
1. **No evaluation**: Shows total visit count
2. **Current**: Shows "Re-evaluation current" when no sessions since last eval
3. **Sessions tracked**: Shows "X visits since last [eval/re-eval]"
4. **Error state**: Shows total visits with warning icon

### 3. Timestamp Handling

#### Fallback Strategy
The system uses multiple fallbacks to ensure timestamps are available:
1. **Primary**: `created_at` field
2. **Secondary**: `updated_at` field
3. **Tertiary**: Parse from session_id format (e.g., `abc_20240115_103000_123`)
4. **Last resort**: Current timestamp (for migration purposes)

#### Data Migration Script
**Location**: `/backend/scripts/fix_missing_created_at.py`

Usage:
```bash
# Dry run (default)
python backend/scripts/fix_missing_created_at.py

# Execute changes
python backend/scripts/fix_missing_created_at.py --execute
```

## Implementation Details

### Session Counting Logic

The feature tracks:
1. **Total patient sessions**: All transcripts for the patient
2. **Sessions since evaluation**: Transcripts created after the last evaluation
3. **Days since evaluation**: Calendar days since the last evaluation

Key improvement: Now properly counts sessions between any two evaluations, not just from the initial evaluation.

### Multiple Re-evaluation Support

When a patient has multiple re-evaluations:
- Initial Evaluation (Day 1)
- Re-evaluation 1 (Day 30) - counts 10 sessions since initial
- Re-evaluation 2 (Day 60) - counts 8 sessions since Re-eval 1 (NOT from initial)
- Current status shows: "8 visits since last re-eval"

### Error Handling

1. **Missing timestamps**: Uses fallback strategy described above
2. **No evaluations**: Shows gray status with total visit count
3. **Invalid data**: Logs warnings but continues with best effort

## Visual Indicators

1. **Icon colors**: Match status color (green/yellow/red/gray)
2. **Pulse animation**: Active on yellow/red status to draw attention
3. **Expandable details**: Click to see full progress bars and dates

## Usage in Application

The component is used in:
- `SetupView.jsx`: Next to "View Last Visit" button when selecting a patient
- Shows real-time status to help doctors decide if re-evaluation is needed

## Troubleshooting

### Common Issues

1. **"No valid evaluation dates found"**
   - Run the migration script to fix missing timestamps
   - Check that new evaluations are saving with proper timestamps
   - **Important**: Ensure `firestore_client.get_patient_transcripts()` includes necessary fields for timestamp parsing (see Critical Fix below)

2. **Incorrect session counts**
   - Verify all transcripts have timestamps
   - Check that evaluation_type is properly set

3. **Status not updating**
   - Component fetches on patient selection
   - May need to refresh if patient data changes

### Critical Fix: Missing Fields in get_patient_transcripts

**Issue**: The `get_patient_transcripts` function in `firestore_client.py` was transforming transcript data but not including fields needed for timestamp fallback logic.

**Solution**: Update the `recording_info` dictionary in `/backend/firestore_client.py` (around line 550) to include:

```python
recording_info = {
    'id': doc.id,
    'session_id': transcript_data.get('session_id', doc.id),  # Include session_id for timestamp parsing
    'created_at': transcript_data.get('created_at'),  # Include raw created_at
    'updated_at': transcript_data.get('updated_at'),  # Include raw updated_at
    # ... rest of fields
}
```

Without these fields, the timestamp fallback logic cannot parse from session IDs when `created_at` is missing.

### Debug Logging

Backend logs helpful information:
- When timestamps are missing
- Fallback strategies used
- Session counting details

Enable debug logging:
```python
logger.setLevel(logging.DEBUG)
```

### Timestamp Formats Supported

The fallback logic supports multiple ID formats:
1. **Continuous format**: `YYYYMMDDHHMMSSSSSSSS` (e.g., `20250709180852848588`)
2. **Underscore format**: `prefix_YYYYMMDD_HHMMSS_suffix` (e.g., `abc_20250709_180852_123`)

## Future Enhancements

1. **Evaluation Timeline**: Visual timeline of all evaluations
2. **Configurable Thresholds**: Allow practices to customize day/session limits
3. **Bulk Status View**: See re-evaluation status for all patients at once
4. **Notification System**: Alert when patients are due for re-evaluation

## Related Documentation

- [Multiple Re-evaluation Implementation Guide](./multiple-reevaluation-implementation-guide.md)
- [Backend API Documentation](./api-documentation.md)
- [Frontend Component Guide](./frontend-components.md)