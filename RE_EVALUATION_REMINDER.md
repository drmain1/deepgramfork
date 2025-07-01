# Re-evaluation Reminder Feature

## Overview
The Re-evaluation Reminder is a visual status indicator that helps healthcare practitioners (chiropractors and physical therapists) track when patient re-evaluations are due. The system displays a color-coded status bar that appears automatically when a patient is selected, showing days elapsed and sessions completed since the last evaluation.

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

#### Response Schema
```json
{
  "status": "evaluated",
  "days_since_last": 25,
  "session_count": 45,  // Total lifetime sessions
  "sessions_since_evaluation": 8,  // Sessions since last eval
  "last_evaluation_date": "2024-06-01T10:00:00Z",
  "last_evaluation_type": "initial" | "re_evaluation",
  "color": "green" | "yellow" | "red",
  "message": "Last evaluation: 25 days ago (8 sessions)",
  "patient_name": "Doe, John"
}
```

### Status Color Logic
- **Green (✓)**: 0-30 days AND < 10 sessions since last evaluation
- **Yellow (⚠)**: 31-45 days OR 10-11 sessions since last evaluation  
- **Red (⚠️)**: 46+ days OR 12+ sessions since last evaluation

### Frontend Components

#### ReEvaluationIndicator.jsx (Minimalist Design)
A clean, unobtrusive indicator that follows modern UI principles:

**Features:**
1. **Single Icon Indicator** - Shows status at a glance
   - Green check for good standing
   - Yellow clock for due soon
   - Red warning for overdue
   - Pulsing animation for urgent states

2. **Click-to-Expand Details** - Full information on demand
   - Smooth slide-down animation
   - Semi-transparent backdrop
   - Clean card layout with progress bars

3. **Progress Visualization**:
   - Linear progress bars (not dots) for cleaner look
   - Days elapsed (0-45 day scale)
   - Sessions completed (0-12 session scale)

4. **Minimal Footprint** - Integrates seamlessly into patient selection area

#### Legacy Component (ReEvaluationStatusBar.jsx)
The original full-width status bar component remains available for alternative layouts.

## Implementation Details

### Backend Logic (main.py)
```python
# Key implementation points:
1. Retrieves all patient transcripts
2. Filters for evaluations (initial or re_evaluation types)
3. Finds most recent evaluation
4. Counts sessions that occurred AFTER last evaluation
5. Calculates days since last evaluation
6. Determines color status based on business rules
7. Returns comprehensive status object
```

### Frontend Integration (SetupView.jsx)
```jsx
{/* Re-evaluation Status Bar - Shows when patient is selected */}
{selectedPatient && (
  <div className="mt-4">
    <ReEvaluationStatusBar patient={selectedPatient} />
  </div>
)}
```

### Visual Design
- Smooth slide-down animation when appearing
- Responsive design with clear visual hierarchy
- Color-coded backgrounds match status severity
- Material Icons for visual clarity
- Progress dots provide quick visual reference

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

## Testing Checklist
- [ ] Create patient with initial evaluation
- [ ] Verify status bar appears on patient selection
- [ ] Add sessions and verify counter increments
- [ ] Test color changes at 30, 45 days
- [ ] Test color changes at 10, 12 sessions
- [ ] Perform re-evaluation and verify counter reset
- [ ] Verify sessions count from new re-evaluation
- [ ] Test with patients having no evaluations
- [ ] Verify proper error handling
- [ ] Test responsive design on mobile

## Configuration
No additional configuration required. The feature uses:
- Existing patient and transcript data
- Standard evaluation type fields
- Current authentication system
- Default intervals (30-45 days, 12 sessions)

## Dependencies
- React component: `ReEvaluationStatusBar.jsx`
- Backend endpoint: `/api/v1/patients/{patient_id}/re-evaluation-status`
- Evaluation types: `initial`, `re_evaluation`
- CSS animations in `index.css`