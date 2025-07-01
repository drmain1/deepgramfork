# Re-evaluation Feature Documentation

## Overview
The re-evaluation feature allows healthcare practitioners (chiropractors and physical therapists) to perform comprehensive re-evaluations by comparing current examination findings with previous initial evaluations. The system automatically retrieves and displays previous positive findings during the recording session, enabling practitioners to track patient progress effectively.

## Architecture

### Data Model

#### Backend (Firestore)
```python
# firestore_models.py

class EvaluationType(str, Enum):
    INITIAL = "initial"
    FOLLOW_UP = "follow_up"
    RE_EVALUATION = "re_evaluation"

class TranscriptDocument(BaseModel):
    # ... existing fields ...
    
    # Evaluation tracking fields
    evaluation_type: Optional[EvaluationType] = None
    initial_evaluation_id: Optional[str] = None  # Link to initial evaluation
    positive_findings: Optional[Dict[str, Any]] = None  # Extracted findings for display (JSON format)
    positive_findings_markdown: Optional[str] = None  # Markdown formatted findings for better UI display
```

#### Frontend State
```javascript
// TranscriptionPage.jsx
const [evaluationType, setEvaluationType] = useState('');
const [initialEvaluationId, setInitialEvaluationId] = useState(null);
const [previousFindings, setPreviousFindings] = useState(null);
```

### API Endpoints

#### 1. Get Patient's Initial Evaluation
```
GET /api/v1/patients/{patient_id}/initial-evaluation
Authorization: Bearer {firebase_token}

Response:
{
    "id": "session_id",
    "patient_name": "John Doe",
    "created_at": "2024-01-15T10:00:00Z",
    "evaluation_type": "initial",
    "positive_findings": { ... },
    "transcript": "...",
    "polishedTranscript": "..."
}
```

#### 2. Get All Patient Evaluations
```
GET /api/v1/patients/{patient_id}/evaluations?evaluation_type=initial
Authorization: Bearer {firebase_token}

Response: [
    {
        "id": "session_id",
        "evaluation_type": "initial",
        "created_at": "2024-01-15T10:00:00Z",
        ...
    }
]
```

#### 3. Extract Findings from Transcript
```
POST /api/v1/transcripts/{transcript_id}/extract-findings
Authorization: Bearer {firebase_token}

Response:
{
    "success": true,
    "findings": {
        "chief_complaint": "Lower back pain",
        "pain_levels": {
            "lower_back": 7,
            "neck": 3
        },
        "range_of_motion": { ... },
        "positive_tests": [ ... ],
        "diagnoses": [ ... ]
    },
    "findings_markdown": "# Clinical Findings Summary\n\n## Chief Complaint\nLower back pain...",
    "transcript_id": "session_123"
}
```

## Data Flow

### 1. Setup Phase (Patient Selection)
```
User Action                    Frontend                           Backend
-----------                    --------                           -------
Select Patient ───────────────> SetupView
                               │
                               ├─> Show Evaluation Type Selector
                               │
Select "Re-evaluation" ────────> Update State
                               │
Click "Load Previous ─────────> Fetch Initial Evaluation ──────> GET /patients/{id}/initial-evaluation
Findings"                      │                                 │
                               │                                 ├─> Query Firestore for initial eval
                               │                                 │
                               │                                 ├─> Check positive_findings field
                               │                                 │
                               │                                 └─> Return evaluation data
                               │
                               ├─> If no findings exist ────────> POST /transcripts/{id}/extract-findings
                               │                                 │
                               │                                 ├─> Use Vertex AI to extract
                               │                                 │
                               │                                 └─> Update Firestore & return
                               │
                               └─> Display findings in UI
```

### 2. Recording Phase
```
User Action                    Frontend                           Backend
-----------                    --------                           -------
Start Recording ──────────────> RecordingView
                               │
                               ├─> Show Previous Findings Panel
                               │
                               ├─> Create WebSocket ─────────────> /stream endpoint
                               │   with metadata:                │
                               │   - evaluation_type             │
                               │   - initial_evaluation_id       │
                               │   - previous_findings           │
                               │                                 │
Stream Audio ─────────────────> Forward to WebSocket ───────────> Process with Deepgram
                               │                                 │
                               └─> Display live transcript <─────┘
```

### 3. Save Phase
```
User Action                    Frontend                           Backend
-----------                    --------                           -------
Save Transcript ──────────────> Prepare Request Body
                               │ {
                               │   session_id,
                               │   transcript,
                               │   evaluation_type,
                               │   initial_evaluation_id,
                               │   previous_findings,
                               │   ...
                               │ }
                               │
                               └─> POST /save_session_data ─────> firestore_endpoints.py
                                                                │
                                                                ├─> Auto-detect evaluation type
                                                                │   if not provided
                                                                │
                                                                ├─> Save to Firestore with:
                                                                │   - evaluation_type
                                                                │   - initial_evaluation_id
                                                                │   - positive_findings
                                                                │
                                                                └─> Polish with Vertex AI
                                                                    │
                                                                    ├─> Include previous findings
                                                                    │   in LLM context
                                                                    │
                                                                    └─> Generate comparative note
```

## Component Dependencies

### Frontend Components

```
TranscriptionPage.jsx
├── Manages evaluation state
├── Passes props to child components
│
├── SetupView.jsx
│   ├── Evaluation type selector
│   ├── Load previous findings button
│   ├── Fetches initial evaluation via API
│   └── Triggers findings extraction if needed
│
└── RecordingView.jsx
    ├── Receives evaluation props
    ├── Shows/hides findings panel
    ├── Includes evaluation data in save request
    └── PreviousFindingsEnhanced.jsx  # Enhanced UI component
        ├── Displays markdown-formatted findings
        ├── Clinical summary bar
        ├── Tabbed interface (Formatted/Comparison)
        ├── Toggle between markdown and raw JSON
        └── Copy functionality
```

### Backend Dependencies

```
main.py
├── API endpoint definitions
├── Authentication middleware
├── Enhanced extract_findings endpoint
│   └── Generates both JSON and markdown
│
├── firestore_endpoints.py
│   ├── save_session_data_firestore()
│   │   ├── Handles evaluation type detection
│   │   ├── Passes findings to LLM
│   │   └── Saves evaluation metadata
│   │
│   └── Uses firestore_client.py
│
├── firestore_client.py
│   ├── get_patient_transcripts()
│   ├── update_transcript()
│   └── Direct Firestore operations
│
├── gcp_utils.py
│   └── generate_polish_transcript_with_gemini()
│       └── Includes previous findings in context
│
├── extraction_prompts.py
│   └── Basic extraction prompts (JSON only)
│
└── extraction_prompts_enhanced.py  # NEW
    ├── Enhanced prompts for JSON + markdown
    ├── Specialty-specific formatting
    └── Comparison analysis prompts
```

## State Management

### Component State Flow
```
TranscriptionPage (Parent)
    ↓ evaluationType, setEvaluationType
    ↓ initialEvaluationId, setInitialEvaluationId
    ↓ previousFindings, setPreviousFindings
    ↓
SetupView (Child)
    - Manages evaluation type selection
    - Fetches initial evaluation
    - Updates parent state
    ↓
RecordingView (Sibling)
    - Receives evaluation data as props
    - Displays findings panel
    - Includes in save request
```

### Firestore Document Structure
```javascript
// transcripts collection
{
    "session_id": "20240630_143022_abc123",
    "user_id": "firebase_uid",
    "patient_id": "patient_123",
    "evaluation_type": "re_evaluation",
    "initial_evaluation_id": "20240115_100000_xyz789",
    "positive_findings": {
        "chief_complaint": "Lower back pain",
        "pain_levels": {
            "lower_back": 7,
            "neck": 3
        },
        "range_of_motion": {
            "lumbar_flexion": "Limited to 45 degrees",
            "lumbar_extension": "Limited to 15 degrees"
        },
        "positive_tests": [
            "Straight leg raise positive at 30 degrees",
            "Slump test positive"
        ],
        "diagnoses": [
            "L4-L5 disc herniation",
            "Lumbar radiculopathy"
        ]
    },
    "positive_findings_markdown": "# Clinical Findings Summary\n\n## Chief Complaint\n...",
    "transcript_original": "...",
    "transcript_polished": "...",
    "created_at": "2024-06-30T14:30:22Z",
    "status": "completed"
}
```

## LLM Integration

### Context Passed to Vertex AI
```python
# In firestore_endpoints.py save_session_data_firestore()

if evaluation_type == 're_evaluation' and previous_findings:
    custom_instructions += f"""
    
Previous Initial Evaluation Findings:
{json.dumps(previous_findings, indent=2)}

Please compare current findings to the previous evaluation and note:
- Improvements in symptoms and function
- Areas that remain problematic
- New findings or concerns
- Overall progress assessment
"""
```

### Template Structure
The re-evaluation template (`chiropractic-reevaluation.js`) provides structured sections for:
- Comparative history
- Pain assessment comparison
- Range of motion changes
- Treatment response analysis
- Updated assessment and plan

## Enhanced UI Features

### Data Storage Strategy
The system uses a **hybrid approach** for optimal performance and user experience:

1. **JSON Format** (stored in `positive_findings`):
   - Structured data for queries and comparisons
   - Enables programmatic analysis
   - Maintains data integrity
   - Used for backend processing

2. **Markdown Format** (stored in `positive_findings_markdown`):
   - Doctor-friendly readable format
   - Clean visual hierarchy
   - Tables for pain levels and ROM
   - Proper medical terminology formatting

### PreviousFindingsEnhanced Component

The enhanced UI component provides:

1. **Clinical Summary Bar**
   - Quick overview of key findings
   - One-line summary with chief complaint, highest pain, and diagnosis
   - Copy button for easy documentation

2. **Tabbed Interface**
   - **Formatted View**: Markdown-rendered findings with proper medical formatting
   - **Comparison Mode**: (Future) Side-by-side comparison of evaluations

3. **Display Options**
   - Toggle between formatted markdown and raw JSON
   - Expandable sections for detailed viewing
   - Copy functionality for entire findings or sections

4. **Responsive Design**
   - Fixed side panel (520px width)
   - Smooth slide-in animation
   - Mobile-responsive on smaller screens

### Utilities

#### findingsFormatter.js
Provides conversion and formatting utilities:
- `convertFindingsToMarkdown()`: Converts JSON findings to readable markdown
- `createClinicalSummary()`: Generates one-line clinical summary
- `generateFindingsComparison()`: Creates comparison tables between evaluations

## User Experience Flow

### 1. Patient Selection
- User selects existing patient from dropdown
- Evaluation type selector becomes visible
- User chooses "Re-evaluation"

### 2. Loading Previous Findings
- "Load Previous Findings" button appears
- Click triggers API call to fetch initial evaluation
- If no findings exist, extraction is triggered automatically
- Findings displayed in enhanced preview panel

### 3. Recording Session
- User starts recording with findings loaded
- Toggle button in header: "Show/Hide Previous Findings"
- Enhanced side panel displays:
  - Clinical summary at top
  - Markdown-formatted findings
  - Optional raw JSON view
- Doctor can reference while examining patient

### 4. Save & Processing
- All evaluation metadata included in save request
- LLM receives previous findings as context
- Generated note includes comparative analysis
- Transcript linked to initial evaluation in database

## Error Handling

### API Errors
- **404 Not Found**: "No initial evaluation found for this patient"
- **500 Server Error**: "Failed to load previous findings"
- **Extraction Failure**: Falls back to raw findings display

### Frontend Validation
- Evaluation type required when patient selected
- Date picker prevents future dates (dictation mode)
- Save button disabled without required fields

## Security Considerations

1. **Authentication**: All API calls require valid Firebase token
2. **Authorization**: Users can only access their own patient data
3. **Audit Logging**: All PHI access logged via AuditLogger
4. **Data Isolation**: User ID verification at every step

## Future Enhancements

1. **Multiple Evaluation Comparison**: Compare across multiple re-evaluations
2. **Outcome Metrics**: Standardized outcome measure tracking
3. **Progress Visualization**: Charts showing improvement over time
4. **Template Customization**: Specialty-specific re-evaluation templates
5. **Automated Findings**: AI-suggested comparison points
6. **Export Features**: Re-evaluation summary reports

## Testing Checklist

- [ ] Create patient with initial evaluation
- [ ] Verify evaluation type selector appears
- [ ] Test loading previous findings
- [ ] Verify findings extraction generates both JSON and markdown
- [ ] Test enhanced findings panel:
  - [ ] Clinical summary displays correctly
  - [ ] Markdown formatting renders properly
  - [ ] Toggle between markdown/JSON works
  - [ ] Copy functionality works for all sections
  - [ ] Panel animation and responsiveness
- [ ] Test findings panel toggle during recording
- [ ] Verify evaluation metadata saves correctly with both formats
- [ ] Check LLM output includes comparisons
- [ ] Test error handling:
  - [ ] Missing evaluations
  - [ ] Extraction failures
  - [ ] Malformed JSON responses
- [ ] Verify proper data isolation between users
- [ ] Test with both Deepgram and Speechmatics
- [ ] Test backward compatibility (old transcripts without markdown)

## Enhanced Extraction System

### Extraction Prompts
The system now uses enhanced extraction prompts that generate both structured JSON and formatted markdown:

1. **General Medical Prompt** (`ENHANCED_INITIAL_EVALUATION_PROMPT`):
   - Comprehensive extraction for all medical specialties
   - Organizes findings by body systems
   - Includes pain assessment, ROM, tests, diagnoses

2. **Chiropractic-Specific Prompt** (`ENHANCED_CHIROPRACTIC_PROMPT`):
   - Focuses on subluxations and spinal assessment
   - Includes postural analysis
   - Detailed palpation findings

3. **Output Format**:
   ```
   ```json
   {structured_findings_object}
   ```
   
   ```markdown
   # Clinical Findings Summary
   [Formatted medical report]
   ```
   ```

### Extraction Process
1. System detects user's medical specialty
2. Selects appropriate enhanced extraction prompt
3. Vertex AI (Gemini 2.5 Flash) processes transcript
4. Response parsed to extract both JSON and markdown
5. Both formats stored in Firestore for optimal use

## Configuration

No additional configuration required. The feature uses existing:
- Firebase Authentication
- Firestore database
- Vertex AI (Gemini) for findings extraction
- Existing transcription profiles

The feature is automatically available when a patient is selected during setup.

## Re-evaluation Reminder Integration

### Overview
The re-evaluation reminder system has been integrated into the main re-evaluation feature to provide practitioners with real-time feedback on when re-evaluations are due. This minimalist indicator helps ensure compliance with the 30-45 day and 12-session requirements.

### UI Integration
The reminder appears as a subtle button next to "View Last Visit" when a patient is selected:
- **Location**: Inline with other patient actions in the selected patient info box
- **Design**: Matches existing UI patterns (blue text, same hover effects)
- **Visual Indicators**:
  - Green check (✓) - Good standing (0-30 days, <10 sessions)
  - Yellow clock (🕐) - Due soon (31-45 days or 10-11 sessions)
  - Red warning (⚠️) - Overdue (46+ days or 12+ sessions)
  - Pulsing dot for urgent states

### Component: ReEvaluationIndicator.jsx
A minimalist component that:
1. Shows status icon with "Re-evaluation Status" text
2. Clicks to expand detailed information panel
3. Displays:
   - Clear status message
   - Progress bars for days and sessions
   - Last evaluation date and type
   - Total patient sessions
4. Auto-fetches status when patient is selected
5. Dismisses by clicking outside the panel

### Data Flow with Re-evaluation Feature
1. **Patient Selection** → Indicator fetches status from `/api/v1/patients/{id}/re-evaluation-status`
2. **Status Calculation** → Backend counts sessions since last evaluation (initial OR re-evaluation)
3. **Visual Feedback** → Color-coded icon shows urgency at a glance
4. **User Action** → When overdue, prompts selection of "Re-evaluation" in evaluation type dropdown
5. **Workflow Integration** → Re-evaluation type triggers loading of previous findings for comparison

### Key Benefits
- **Non-intrusive**: Takes minimal space, expands on demand
- **Contextual**: Appears exactly where patient information is shown
- **Action-oriented**: Clear visual cues guide practitioners to perform timely re-evaluations
- **Compliance**: Helps maintain insurance requirements and best practices