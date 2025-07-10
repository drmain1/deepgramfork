# Multiple Re-evaluation Support Implementation Guide

## Overview

This document provides detailed instructions for implementing support for multiple re-evaluations in the medical transcription application. Currently, the system only compares re-evaluations against the initial evaluation, but in practice, doctors perform multiple re-evaluations that should each compare against the most recent previous evaluation.

## Current System Limitations

1. **Single Re-evaluation Assumption**: The system always fetches the initial evaluation when creating a re-evaluation, even for 2nd, 3rd, or subsequent re-evaluations
2. **Hardcoded Field Names**: Uses `initial_evaluation_id` which implies linking only to initial evaluations
3. **API Endpoint Naming**: `/initial-evaluation` endpoint name suggests single re-evaluation pattern
4. **Comparison Logic**: Always compares against initial evaluation findings, missing incremental improvements

## Implementation Plan

### 1. Backend Changes

#### 1.1 Create New API Endpoint

**File**: `/backend/patient_endpoints.py`

Create a new endpoint that fetches the most recent evaluation (initial OR re-evaluation) for a patient:

```python
async def get_patient_previous_evaluation(
    patient_id: str = Path(..., description="Patient ID"),
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Get the most recent evaluation (initial or re-evaluation) for a patient"""
    # Implementation details:
    # 1. Get all transcripts for patient
    # 2. Filter for evaluations (both initial and re-evaluation types)
    # 3. Sort by created_at DESC
    # 4. Return the most recent one
    # 5. Include proper logging for HIPAA compliance
```

**Dependencies**:
- Uses existing `firestore_client.get_patient_transcripts()`
- Uses `EvaluationType` enum from `firestore_models.py`
- Uses `AuditLogger` for HIPAA compliance logging

#### 1.2 Update Main Router

**File**: `/backend/main.py`

Add the new endpoint to the router:

```python
# Around line 555, add import
from patient_endpoints import get_patient_previous_evaluation

# Around line 625, add endpoint
@app.get("/api/v1/patients/{patient_id}/previous-evaluation")
async def get_patient_previous_evaluation_endpoint(
    patient_id: str = Path(...),
    current_user: dict = Depends(get_current_user),
    request: Request = Request
):
    current_user_id = current_user.get('sub', current_user.get('uid'))
    return await get_patient_previous_evaluation(patient_id, current_user_id, request)
```

#### 1.3 Update Data Models

**File**: `/backend/firestore_models.py` and `/backend/models.py`

Add backward-compatible field:

```python
# In TranscriptFirestore class
previous_evaluation_id: Optional[str] = None  # New field for linking to any previous evaluation
initial_evaluation_id: Optional[str] = None  # Keep for backward compatibility
```

#### 1.4 Update Save Logic

**File**: `/backend/firestore_endpoints.py`

Update the transcript save endpoint to handle both field names:

```python
# Around line 370, update to support both fields
initial_evaluation_id = request_data.get('initial_evaluation_id')
previous_evaluation_id = request_data.get('previous_evaluation_id', initial_evaluation_id)

# Around line 445, save both fields
'initial_evaluation_id': initial_evaluation_id,  # Keep for backward compatibility
'previous_evaluation_id': previous_evaluation_id
```

### 2. Frontend Changes

#### 2.1 Update SetupView Component

**File**: `/my-vite-react-app/src/components/SetupView.jsx`

1. **Update State Variables** (around line 25):
```javascript
// Change from:
const [initialEvaluationId, setInitialEvaluationId] = useState(null);
// To:
const [previousEvaluationId, setPreviousEvaluationId] = useState(null);
```

2. **Update API Call** (around line 78):
```javascript
// Change from:
const response = await fetch(`${API_BASE_URL}/api/v1/patients/${selectedPatient.id}/initial-evaluation`, {
// To:
const response = await fetch(`${API_BASE_URL}/api/v1/patients/${selectedPatient.id}/previous-evaluation`, {
```

3. **Update State Setting** (around line 89):
```javascript
// Change from:
setInitialEvaluationId(evaluation.id);
// To:
setPreviousEvaluationId(evaluation.id);
```

4. **Update Error Messages** (around line 171):
```javascript
// Change from:
alert('No initial evaluation found for this patient. Please ensure this patient has a completed initial evaluation before attempting re-evaluation.');
// To:
alert('No previous evaluation found for this patient. Please ensure this patient has a completed evaluation before attempting re-evaluation.');
```

#### 2.2 Update Session Save Utils

**File**: `/my-vite-react-app/src/utils/sessionSaveUtils.js`

Update the payload construction to use the new field name:

```javascript
// Look for where initialEvaluationId is used in the save payload
// Change from:
initial_evaluation_id: initialEvaluationId,
// To:
previous_evaluation_id: previousEvaluationId,
initial_evaluation_id: previousEvaluationId, // Keep for backward compatibility
```

#### 2.3 Update Props Passing

**File**: `/my-vite-react-app/src/components/TranscriptionView.jsx`

Update where `initialEvaluationId` is passed as props:

```javascript
// Change prop name from initialEvaluationId to previousEvaluationId
// Update all references throughout the component
```

#### 2.4 Update Recordings Store

**File**: `/my-vite-react-app/src/stores/recordingsStore.js`

Update the store to handle the new field:

```javascript
// In the state definition, add:
previousEvaluationId: null,

// Update setter methods to use previousEvaluationId
// Keep initialEvaluationId for backward compatibility
```

### 3. UI/UX Updates

#### 3.1 Update Component Labels

**File**: `/my-vite-react-app/src/components/EvaluationTypeSelector.jsx`

Update the re-evaluation description:

```javascript
// Around line where re-evaluation is described
// Change from references to "initial evaluation" to "previous evaluation"
```

#### 3.2 Update Previous Findings Display

**File**: `/my-vite-react-app/src/components/TranscriptionView/PreviousFindingsEnhanced.jsx`

Update the header to show which evaluation is being compared:

```javascript
// Add evaluation type and date to the display
// Show "Comparing to: [Initial Evaluation | Re-evaluation] from [date]"
```

### 4. Testing Checklist

1. **Test Initial Evaluation Creation**
   - Create a new patient
   - Complete initial evaluation
   - Verify it saves correctly

2. **Test First Re-evaluation**
   - Select patient with initial evaluation
   - Create re-evaluation
   - Verify it loads initial evaluation findings
   - Verify it saves with correct `previous_evaluation_id`

3. **Test Second Re-evaluation**
   - Select patient with existing re-evaluation
   - Create another re-evaluation
   - **Verify it loads the previous re-evaluation, NOT the initial evaluation**
   - Verify comparison shows changes from first re-evaluation

4. **Test Multiple Re-evaluations**
   - Create 3+ re-evaluations
   - Verify each compares to the immediately previous evaluation
   - Verify the chain: Initial → Re-eval 1 → Re-eval 2 → Re-eval 3

5. **Test Backward Compatibility**
   - Verify existing re-evaluations still display correctly
   - Verify PDFs generate correctly for old and new re-evaluations

### 5. Migration Strategy

1. **Phase 1**: Deploy backend changes with both fields supported
2. **Phase 2**: Deploy frontend changes using new field
3. **Phase 3**: Run migration script to populate `previous_evaluation_id` for existing records
4. **Phase 4**: After verification, deprecate `initial_evaluation_id` field

### 6. Future Enhancements

1. **Evaluation Timeline View**: Show visual timeline of all evaluations
2. **Comparison Selector**: Allow comparing any two evaluations
3. **Progress Tracking**: Show cumulative progress across all evaluations
4. **Evaluation Chain Export**: Export full evaluation history as single report

## Dependencies Summary

### Backend Dependencies
- Python 3.10+
- FastAPI
- Firebase Admin SDK
- Existing firestore_client module
- Existing patient_endpoints module
- Existing authentication middleware

### Frontend Dependencies
- React 19
- Existing API service layer
- Existing Zustand stores
- Existing authentication context
- Material-UI components

### No New Package Installations Required

All changes use existing packages and frameworks already in the project.

## Important Considerations

1. **HIPAA Compliance**: All new endpoints must include audit logging
2. **Error Handling**: Handle cases where no previous evaluation exists
3. **Performance**: Ensure efficient queries when fetching evaluations
4. **Data Integrity**: Maintain referential integrity between evaluations
5. **UI Clarity**: Make it clear to users which evaluation is being compared

## Expected Outcome

After implementation, the system will properly support multiple re-evaluations where:
- Each re-evaluation compares to the most recent previous evaluation
- Progress is tracked incrementally across the evaluation chain
- Users have clear visibility into which evaluation is being compared
- The system maintains backward compatibility with existing data