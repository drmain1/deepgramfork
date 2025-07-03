# Re-evaluation Reminder Feature

## Overview
The Re-evaluation Reminder is a visual status indicator that helps healthcare practitioners (chiropractors and physical therapists) track when patient re-evaluations are due. The system displays a compact, color-coded indicator next to the patient information, showing the number of visits since the last evaluation.

## Business Requirements
- Re-evaluations should be performed every 30-45 days
- Re-evaluations are required after a maximum of 12 sessions
- The countdown resets after each re-evaluation (not just from initial evaluation)
- Visual indicators help prevent missed re-evaluations

## Technical Architecture

### Backend API Endpoint
```
GET /api/v1/patients/{patient_id}/re-evaluation-status
```

**Location**: `/backend/patient_endpoints.py` - `get_re_evaluation_status()`

#### Response Schema
```json
{
  "status": "evaluated" | "no_evaluation" | "error",
  "days_since_last": 25,
  "session_count": 45,  // Total lifetime sessions
  "sessions_since_evaluation": 8,  // Sessions since last eval
  "last_evaluation_date": "2024-06-01T10:00:00Z",
  "last_evaluation_type": "initial" | "re_evaluation",
  "color": "green" | "yellow" | "red" | "gray",
  "message": "Last evaluation: 25 days ago (8 sessions)",
  "patient_name": "Doe, John"
}
```

#### Special Cases Handled
- **No evaluation found**: Returns all sessions as "sessions_since_evaluation"
- **Missing timestamps**: Counts transcripts without created_at as newer sessions
- **Invalid data**: Returns error status with gray color

### Status Color Logic
- **Green (✓)**: 0-30 days AND < 10 sessions since last evaluation
- **Yellow (⚠)**: 31-45 days OR 10-11 sessions since last evaluation  
- **Red (⚠️)**: 46+ days OR 12+ sessions since last evaluation
- **Gray (○)**: No evaluation found or data quality issues

### Frontend Components

#### ReEvaluationIndicator.jsx (Current Implementation)
A compact, inline indicator that displays visit count prominently:

**Location**: `/my-vite-react-app/src/components/ReEvaluationIndicator.jsx`

**Features:**
1. **Visit Count Display** - Shows primary information upfront
   - "2 visits since initial eval"
   - "5 visits since re-evaluation"
   - "3 visits" (when no evaluation exists)
   - "0 total visits" (on error)

2. **Color-Coded Icon** - Visual status indicator
   - Green check (check_circle) for good standing
   - Yellow clock (schedule) for due soon
   - Red error (error_outline) for overdue
   - Gray pending (pending) for no evaluation
   - Warning icon for data errors
   - Pulsing animation for yellow/red states

3. **Click-to-Expand Details** - Full information on demand
   - Smooth slide-down animation
   - Semi-transparent backdrop
   - Clean card layout with progress bars
   - Days progress (only shown if evaluation exists)
   - Sessions progress (always shown)
   - Guidelines reminder for yellow/red status

4. **Error Handling**:
   - Shows "Loading visits..." during API call
   - Shows "Error: [message]" on API failure
   - Shows "No patient" if patient prop missing
   - Shows "No status data" if API returns empty

#### Alternative Component (ReEvaluationStatusBar.jsx)
A full-width status bar component is available for alternative layouts but is not currently in use.

## Implementation Details

### Backend Logic (`patient_endpoints.py`)
```python
# Key implementation points:
1. Retrieves all patient transcripts
2. Filters for evaluations (initial or re_evaluation types)
3. Handles missing timestamps gracefully:
   - Filters out evaluations without created_at
   - Falls back to "no_evaluation" status if none have timestamps
4. Finds most recent valid evaluation
5. Counts sessions that occurred AFTER last evaluation:
   - Only counts transcripts with valid timestamps
   - Adds count of transcripts without timestamps (assumed newer)
6. Calculates days since last evaluation
7. Determines color status based on business rules
8. Returns comprehensive status object
9. Logs PHI access for HIPAA compliance
```

**Critical Data Handling**:
- Transcripts without `created_at` are counted as newer sessions
- Evaluations without `created_at` are filtered out
- Returns meaningful data even with partial timestamp coverage

### Frontend Integration (SetupView.jsx)
```jsx
{/* Shows inline next to "View Last Visit" button */}
<div className="flex items-center gap-3">
  <button
    type="button"
    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors"
    onClick={() => handleViewLastVisit()}
  >
    <span className="material-icons text-sm">history</span>
    View Last Visit
  </button>
  <ReEvaluationIndicator patient={selectedPatient} />
</div>
```

### Visual Design
- Inline display next to patient actions
- Minimal footprint with expandable details
- Color-coded icons match status severity
- Material Icons for visual clarity
- Linear progress bars in expanded view
- Pulsing animation draws attention to warnings

## Data Flow

1. **Patient Selection**: User selects patient in SetupView
2. **API Call**: ReEvaluationStatusBar fetches status from backend
3. **Calculation**: Backend counts sessions since last evaluation
4. **Display**: Frontend renders color-coded status with progress indicators
5. **Updates**: Status refreshes when patient changes

## Session Counting Logic

### Important: Counter Resets After Re-evaluations
- Initial evaluation → Counter starts at 0
- Each session → Counter increments
- Re-evaluation performed → Counter resets to 0
- Ensures compliance tracking from most recent evaluation

### Example Timeline
```
Day 0: Initial evaluation (counter = 0)
Day 3: Session 1 (counter = 1)
Day 7: Session 2 (counter = 2)
...
Day 35: Session 11 (counter = 11) - Status: Yellow
Day 38: Re-evaluation performed (counter resets to 0)
Day 42: Session 1 after re-eval (counter = 1) - Status: Green
```

## Integration with Re-evaluation Feature

This reminder system works in conjunction with the main re-evaluation feature:
- Prompts practitioners to select "Re-evaluation" type when due
- Ensures previous findings are loaded for comparison
- Maintains compliance with insurance requirements
- Provides audit trail for proper evaluation intervals

## HIPAA Compliance
- All status checks are logged via AuditLogger
- Patient data access is restricted to authorized users
- No PHI stored in browser state
- Secure API endpoints with Firebase authentication

## Future Enhancements
1. **Email/SMS Reminders**: Notify when re-evaluations approach
2. **Bulk Status View**: See all patients needing re-evaluations
3. **Customizable Intervals**: Practice-specific timing rules
4. **Insurance Integration**: Auto-populate based on payer requirements
5. **Report Generation**: Compliance reports for audits

## Troubleshooting Guide

### Component Not Showing
1. **Check patient prop**: Ensure `selectedPatient` has an `id` field
2. **Verify API endpoint**: Check backend logs for route registration
3. **Authentication**: Confirm Firebase token is valid
4. **Console errors**: Look for 401/403 errors or network issues

### Incorrect Visit Count
1. **Check evaluation_type**: Ensure transcripts have correct type set
2. **Timestamp issues**: Look for missing `created_at` fields
3. **Backend logs**: Check for warnings about missing timestamps
4. **Firestore data**: Verify transcript documents exist

### Common Issues and Solutions

#### 401 Unauthorized
- **Cause**: Invalid or missing Firebase token
- **Fix**: Check `getToken()` returns valid token
- **Debug**: Log token in console (first 20 chars only)

#### Visit count shows 0
- **Cause**: No transcripts found or all missing evaluation_type
- **Fix**: Ensure transcripts have evaluation_type field
- **Migration**: Update existing transcripts with appropriate type

#### Missing timestamps
- **Symptom**: Warning in backend logs
- **Impact**: Sessions counted but date calculations fail
- **Fix**: Backfill created_at for existing transcripts

## Testing Checklist
- [ ] Create patient with initial evaluation
- [ ] Verify indicator appears next to "View Last Visit"
- [ ] Check visit count displays correctly (e.g., "2 visits")
- [ ] Add sessions and verify counter increments
- [ ] Test color changes at 30, 45 days
- [ ] Test color changes at 10, 12 sessions
- [ ] Perform re-evaluation and verify counter reset
- [ ] Verify sessions count from new re-evaluation
- [ ] Test with patients having no evaluations (shows total visits)
- [ ] Test with missing timestamps (still shows count)
- [ ] Click indicator to expand details panel
- [ ] Verify progress bars show correct percentages
- [ ] Test responsive design on mobile
- [ ] Check for duplicate API calls in network tab

## Configuration
No additional configuration required. The feature uses:
- Existing patient and transcript data
- Standard evaluation type fields
- Current authentication system
- Default intervals (30-45 days, 12 sessions)

## Dependencies

### Frontend
- React 18+ with hooks (useState, useEffect)
- Firebase Auth Context (`useAuth` hook for token)
- Material Icons font
- Tailwind CSS for styling
- Component location: `/my-vite-react-app/src/components/ReEvaluationIndicator.jsx`

### Backend
- FastAPI framework
- Firebase Admin SDK for authentication
- Firestore client for data access
- Python datetime module
- AuditLogger for HIPAA compliance
- Files:
  - `/backend/patient_endpoints.py` - API endpoint implementation
  - `/backend/main.py` - Route registration (line 622)
  - `/backend/firestore_models.py` - EvaluationType enum

### Data Requirements
- Transcript documents must have:
  - `evaluation_type` field (required)
  - `created_at` timestamp (recommended)
  - `session_id` (required)
- Patient documents must have:
  - `first_name`, `last_name` fields
  - `id` field

### Authentication
- Requires valid Firebase authentication token
- Uses `get_user_id` dependency from `gcp_auth_middleware`
- Token passed as Bearer token in Authorization header