# Re-evaluation Functionality Documentation

## Overview
The re-evaluation functionality allows healthcare practitioners to perform comprehensive re-evaluations by comparing current examination findings with previous initial evaluations. The system automatically retrieves and displays previous positive findings, with optional AI-assisted comparison during transcription.

## Architecture Overview

### Key Features
1. **Automatic Previous Findings Retrieval**: Loads positive findings from initial evaluation
2. **User-Controlled AI Integration**: Optional injection of findings into LLM prompt
3. **Visual Findings Display**: Side panel showing previous findings during recording
4. **Smart Template Selection**: Supports re-evaluation-specific templates
5. **Backward Compatibility**: Works with existing transcription profiles

## Data Flow

### 1. Setup Phase - Patient Selection and Findings Loading

```
User Action                    Frontend                           Backend
-----------                    --------                           -------
Select Patient ───────────────> SetupView.jsx
                               │
                               ├─> EvaluationTypeSelector.jsx
                               │   └─> Shows evaluation options
                               │
Select "Re-evaluation" ────────> Update Store State
                               │ - evaluationType = 're_evaluation'
                               │
                               ├─> ReEvaluationWorkflow.jsx renders
                               │
Click "Load Previous ──────────> API Call ───────────────────────> GET /api/v1/patients/{id}/initial-evaluation
Findings"                      │                                 │
                               │                                 ├─> patient_endpoints.py
                               │                                 │   └─> get_patient_initial_evaluation()
                               │                                 │
                               │                                 ├─> firestore_client.py
                               │                                 │   └─> get_patient_transcripts()
                               │                                 │       - Filter by evaluation_type='initial'
                               │                                 │       - Sort by created_at DESC
                               │                                 │       - Return first result
                               │                                 │
                               │                                 └─> Return evaluation with findings
                               │
                               ├─> Check findings format
                               │   - If old format → trigger re-extraction
                               │   - If new format → use as-is
                               │
                               ├─> Store findings in state
                               │   - setInitialEvaluationId()
                               │   - setPreviousFindings()
                               │   - setShowPreviousFindingsSidebar(true)
                               │
                               └─> Display in ReEvaluationWorkflow
                                   - Show findings preview
                                   - Show include/exclude checkbox
```

### 2. Recording Phase - Transcription with Context

```
User Action                    Frontend                           Backend
-----------                    --------                           -------
Configure Options ────────────> ReEvaluationWorkflow.jsx
                               │
                               ├─> User toggles checkbox:
                               │   "Include previous findings in AI prompt"
                               │   └─> setIncludePreviousFindingsInPrompt(bool)
                               │
Start Recording ──────────────> RecordingView.jsx
                               │
                               ├─> Show Previous Findings Panel
                               │   └─> PreviousFindingsEnhanced.jsx
                               │
                               ├─> Create WebSocket ─────────────> /stream endpoint
                               │   with metadata:                │
                               │   - evaluation_type             │
                               │   - initial_evaluation_id       │
                               │                                 │
Stream Audio ─────────────────> Forward to WebSocket ───────────> Process with Deepgram/Speechmatics
                               │                                 │
                               └─> Display live transcript <─────┘
```

### 3. Save Phase - AI Processing with Optional Comparison

```
User Action                    Frontend                           Backend
-----------                    --------                           -------
Save Transcript ──────────────> RecordingView.jsx
                               │
                               ├─> Prepare Request Body:
                               │   {
                               │     session_id,
                               │     final_transcript_text,
                               │     evaluation_type: 're_evaluation',
                               │     initial_evaluation_id,
                               │     previous_findings: includePreviousFindingsInPrompt ? findings : null,
                               │     ...
                               │   }
                               │
                               └─> POST /api/v1/save_session_data ─> firestore_endpoints.py
                                                                    │
                                                                    ├─> save_session_data_firestore()
                                                                    │
                                                                    ├─> Check for transcription profile
                                                                    │   - If found: Use profile instructions
                                                                    │   - If not: Use fallback instructions
                                                                    │
                                                                    ├─> Add previous findings to instructions:
                                                                    │   if evaluation_type == 're_evaluation' and previous_findings:
                                                                    │     custom_instructions += f"\n\nPrevious Initial Evaluation Findings:\n{json.dumps(previous_findings, indent=2)}"
                                                                    │
                                                                    └─> polish_transcript_with_gemini()
                                                                        │
                                                                        ├─> gcp_utils.py
                                                                        │   - Combine instructions + transcript
                                                                        │   - Send to Vertex AI (Gemini)
                                                                        │
                                                                        └─> Return polished transcript
                                                                            with comparative analysis
```

## Component Dependencies

### Frontend Components

```
TranscriptionPage.jsx (Parent)
├── Manages top-level navigation and view switching
│
├── SetupView.jsx
│   ├── Patient selection interface
│   ├── Contains evaluation type selection logic
│   ├── Fetches initial evaluation when re-evaluation selected
│   ├── Handles old format detection and re-extraction
│   │
│   ├── EvaluationTypeSelector.jsx
│   │   ├── Displays evaluation type buttons
│   │   ├── Auto-recommends based on patient history
│   │   └── Updates store with selection
│   │
│   ├── ReEvaluationWorkflow.jsx
│   │   ├── Shows when evaluation_type === 're_evaluation'
│   │   ├── Displays previous findings preview
│   │   ├── Contains checkbox for AI injection control
│   │   └── Uses FormattedMedicalText for display
│   │
│   └── PatientSelector.jsx
│       └── Triggers evaluation type reset on patient change
│
└── RecordingView.jsx
    ├── Recording interface with audio capture
    ├── Reads evaluation state from store
    ├── Conditionally sends previous_findings based on user preference
    ├── Shows/hides findings sidebar
    │
    └── PreviousFindingsEnhanced.jsx
        ├── Side panel for viewing findings during recording
        ├── Tabbed interface (Formatted/Raw JSON)
        ├── Copy functionality
        └── Persists across view transitions
```

### State Management (Zustand Store)

```javascript
// transcriptionSessionStore.js
{
  // Evaluation State
  evaluationType: '',                        // 'initial' | 'follow_up' | 're_evaluation'
  initialEvaluationId: null,                // Session ID of initial evaluation
  previousFindings: null,                   // Findings object from initial eval
  includePreviousFindingsInPrompt: true,    // User preference for AI injection
  showPreviousFindingsSidebar: false,       // UI state for sidebar

  // Actions
  setEvaluationType: (type) => {...},
  setInitialEvaluationId: (id) => {...},
  setPreviousFindings: (findings) => {...},
  setIncludePreviousFindingsInPrompt: (bool) => {...},
  setShowPreviousFindingsSidebar: (bool) => {...},
}
```

### Backend Components

```
main.py (FastAPI Application)
├── API endpoint definitions
├── Authentication middleware
│
├── patient_endpoints.py
│   ├── get_patient_initial_evaluation()
│   │   └── Retrieves most recent initial evaluation
│   │
│   └── get_patient_reevaluation_status()
│       └── Calculates if re-evaluation is due
│
├── firestore_endpoints.py
│   ├── save_session_data_firestore()
│   │   ├── Receives evaluation metadata
│   │   ├── Loads user transcription profile
│   │   ├── Builds custom instructions
│   │   ├── Injects previous findings (if enabled)
│   │   └── Calls LLM for processing
│   │
│   └── extract_findings()
│       └── Uses AI to extract structured findings
│
├── firestore_client.py
│   ├── Direct Firestore operations
│   └── get_patient_transcripts()
│       └── Queries with evaluation_type filter
│
└── gcp_utils.py
    └── polish_transcript_with_gemini()
        ├── Receives combined instructions
        ├── Logs findings injection status
        └── Calls Vertex AI for processing
```

## Data Models

### Firestore Document Structure

```javascript
// transcripts collection
{
  "session_id": "20240630_143022_abc123",
  "user_id": "firebase_uid",
  "patient_id": "patient_123",
  "evaluation_type": "re_evaluation",              // Evaluation type enum
  "initial_evaluation_id": "20240115_100000_xyz",  // Links to initial eval
  "positive_findings": {                           // Structured findings (JSON)
    "pain_findings": ["Finding 1", "Finding 2"],
    "range_of_motion_findings": [...],
    "neurological_findings": [...],
    "orthopedic_test_findings": [...],
    "palpation_findings": [...],
    "functional_limitations": [...],
    "posture_and_gait_findings": [...],
    "outcome_assessment_tools": [...]
  },
  "positive_findings_markdown": "### Clinical...", // Formatted for display
  "transcript_original": "...",
  "transcript_polished": "...",
  "created_at": "2024-06-30T14:30:22Z",
  "status": "completed"
}
```

### Request/Response Formats

#### GET /api/v1/patients/{patient_id}/initial-evaluation
```javascript
// Response
{
  "id": "session_id",
  "patient_name": "John Doe",
  "created_at": "2024-01-15T10:00:00Z",
  "evaluation_type": "initial",
  "positive_findings": { /* structured findings */ },
  "positive_findings_markdown": "# Clinical Findings Summary...",
  "transcript": "...",
  "polishedTranscript": "..."
}
```

#### POST /api/v1/save_session_data
```javascript
// Request
{
  "session_id": "20240630_143022_abc123",
  "final_transcript_text": "Patient returns for re-evaluation...",
  "evaluation_type": "re_evaluation",
  "initial_evaluation_id": "20240115_100000_xyz",
  "previous_findings": { /* findings object */ },  // Only if user enabled
  // ... other fields
}
```

## Key Implementation Details

### 1. Previous Findings Injection
The system injects findings in two paths to ensure they're always included when needed:

```python
# firestore_endpoints.py

# Path 1: When using a transcription profile
if selected_profile:
    custom_instructions = selected_profile.get('llmInstructions')
    # ... append context ...
    if evaluation_type == 're_evaluation' and previous_findings:
        custom_instructions += f"\n\nPrevious Initial Evaluation Findings:\n{json.dumps(previous_findings, indent=2)}"

# Path 2: Fallback when no profile found
else:
    custom_instructions = f"Patient Name: {patient_name}\n..."
    if evaluation_type == 're_evaluation' and previous_findings:
        custom_instructions += f"\n\nPrevious Initial Evaluation Findings:\n{json.dumps(previous_findings, indent=2)}"
```

### 2. User Control Implementation
```javascript
// RecordingView.jsx
const requestBody = {
  // ... other fields ...
  previous_findings: (includePreviousFindingsInPrompt && previousFindings) ? previousFindings : null
};
```

### 3. Old Format Migration
The system automatically detects and migrates old finding formats:

```javascript
// SetupView.jsx
const needsReExtraction = evaluation.positive_findings?.raw_findings && 
                         !evaluation.positive_findings?.pain_findings &&
                         !evaluation.positive_findings_markdown;

if (needsReExtraction) {
  // Trigger re-extraction via API
  const extractResponse = await fetch(`/api/v1/transcripts/${evaluation.id}/extract-findings`, {
    method: 'POST',
    // ...
  });
}
```

## Debugging and Monitoring

### Frontend Debug Points
1. **SetupView.jsx**: Logs evaluation loading and format detection
2. **RecordingView.jsx**: Logs include preference and request body
3. **ReEvaluationWorkflow.jsx**: Component render with findings state

### Backend Debug Points
1. **firestore_endpoints.py**: 
   - Logs evaluation type and findings presence
   - Shows custom instructions length and preview
   - Confirms findings injection

2. **gcp_utils.py**:
   - Detects "Previous Initial Evaluation Findings:" in prompt
   - Shows preview of findings section
   - Confirms AI received context

### Common Issues and Solutions

1. **Findings Not Appearing in AI Output**
   - Check: Is "Include previous findings in AI prompt" checkbox enabled?
   - Check: Backend logs for "Added previous findings to LLM context"
   - Check: Total instruction length (should be >1000 chars with findings)

2. **Old Format Findings**
   - System auto-detects and re-extracts
   - Check for "Old format detected, triggering re-extraction" in console

3. **No Initial Evaluation Found**
   - Verify patient has a completed initial evaluation
   - Check evaluation_type field in Firestore

## Future Enhancements

1. **Multiple Evaluation Comparison**: Compare across multiple re-evaluations
2. **Custom Comparison Templates**: Specialty-specific re-evaluation formats
3. **Progress Visualization**: Charts showing improvement trends
4. **Automated Insights**: AI-suggested focus areas based on changes
5. **Export Features**: Re-evaluation summary reports
6. **Batch Re-evaluations**: Process multiple patients

## Security Considerations

- All API calls require valid Firebase authentication
- User can only access their own patient data
- PHI access is logged via AuditLogger
- Previous findings are only sent if explicitly enabled by user