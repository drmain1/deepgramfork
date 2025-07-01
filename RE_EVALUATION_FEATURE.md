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

// SetupView.jsx - Added loading state
const [loadingFindings, setLoadingFindings] = useState(false);
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
    "positive_findings_markdown": "# Clinical Findings Summary...",
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
        "pain_findings": ["Severe neck pain radiating down arm", ...],
        "range_of_motion_findings": ["restriction in right rotation", ...],
        "neurological_findings": ["Biceps strength 4+/5 on the left", ...],
        "palpation_findings": ["Tenderness on the bilateral AC joints", ...],
        "orthopedic_test_findings": ["Positive Straight Leg Raise", ...],
        "functional_limitations": ["insomnia", "pain while driving", ...],
        "posture_and_gait_findings": ["Observed anterior head carriage", ...],
        "outcome_assessment_tools": [
            {
                "tool_name": "Oswestry Disability Index",
                "score": "45%",
                "interpretation": "Severe Disability"
            }
        ]
    },
    "findings_markdown": "### Clinical Baseline Summary\n\n#### Pain Findings\n- Severe neck pain...",
    "transcript_id": "session_123"
}
```

## Implementation Details

### Backend Implementation

#### 1. Extraction Endpoint (main.py)
```python
@app.post("/api/v1/transcripts/{transcript_id}/extract-findings")
async def extract_findings(
    transcript_id: str,
    current_user_id: str = Depends(get_user_id),
    request: Request = None
):
    """Extract positive findings from a transcript using AI"""
    try:
        # ... authentication and validation ...
        
        # Use enhanced extraction prompt that generates both JSON and markdown
        extraction_prompt = get_enhanced_extraction_prompt(specialty=specialty)
        
        # Run extraction with Gemini
        result = await asyncio.get_event_loop().run_in_executor(
            None,
            polish_transcript_with_gemini,
            content,
            "",
            "",
            "findings_extraction",
            extraction_prompt,
            None,
            "publishers/google/models/gemini-2.5-flash"
        )
        
        if result['success']:
            # Parse the enhanced extraction output (contains both JSON and markdown)
            output = result['polished_transcript']
            
            # Extract JSON section
            json_match = re.search(r'```json\n(.*?)\n```', output, re.DOTALL)
            findings = {}
            if json_match:
                try:
                    findings = json.loads(json_match.group(1))
                except:
                    findings = {"raw_findings": json_match.group(1)}
            
            # Extract markdown section
            markdown_match = re.search(r'```markdown\n(.*?)\n```', output, re.DOTALL)
            findings_markdown = markdown_match.group(1) if markdown_match else None
            
            # Debug logging
            logger.info(f"Raw LLM output length: {len(output)}")
            logger.info(f"Found JSON section: {bool(json_match)}")
            logger.info(f"Found markdown section: {bool(markdown_match)}")
            
            # Update the transcript with both JSON findings and markdown
            update_data = {'positive_findings': findings}
            if findings_markdown:
                update_data['positive_findings_markdown'] = findings_markdown
            
            await firestore_client.update_transcript(transcript_id, update_data)
            
            return {
                'success': True,
                'findings': findings,
                'findings_markdown': findings_markdown,
                'transcript_id': transcript_id
            }
```

#### 2. Enhanced Extraction Prompts (extraction_prompts_enhanced.py)
```python
# Enhanced initial evaluation findings extraction
ENHANCED_INITIAL_EVALUATION_PROMPT = """
Extract ALL positive clinical findings from this initial evaluation for baseline documentation.

IMPORTANT: Generate TWO outputs in the exact format specified below.

Part 1: Markdown Summary
Create a well-formatted clinical summary using proper markdown formatting.
- Use ### for main title
- Use #### for category headers
- Use - for bullet points
- Focus on clarity and readability

Part 2: JSON Data
Create a structured JSON object with categorized findings.
Each finding should be a verbatim quote from the transcript.

FORMAT YOUR RESPONSE EXACTLY AS:
```markdown
### Clinical Baseline Summary

#### Pain Findings
- [List each pain finding]

#### Range of Motion Findings
- [List each ROM limitation]

[... other categories ...]
```

```json
{
  "pain_findings": ["Direct quote of pain description"],
  "range_of_motion_findings": ["Direct quote of ROM limitation"],
  [... other categories ...]
}
```

EXTRACTION RULES:
1. Only include POSITIVE/ABNORMAL findings
2. Use exact quotes from the transcript
3. If a category has no findings, use empty array []
4. Include all relevant clinical details
5. Maintain professional medical terminology
"""
```

### Frontend Implementation

#### 1. SetupView.jsx - Loading Previous Findings
```javascript
// Added loading state for findings
const [loadingFindings, setLoadingFindings] = useState(false);

// Enhanced button with loading animation
{!previousFindings ? (
  <button
    type="button"
    disabled={loadingFindings}
    onClick={async () => {
      setLoadingFindings(true);
      try {
        const token = await getToken();
        const response = await fetch(`/api/v1/patients/${selectedPatient.id}/initial-evaluation`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const evaluation = await response.json();
          setInitialEvaluationId(evaluation.id);
          
          // Check if we need to re-extract due to old format
          const needsReExtraction = evaluation.positive_findings?.raw_findings && 
                                  !evaluation.positive_findings?.pain_findings &&
                                  !evaluation.positive_findings_markdown;
          
          if (needsReExtraction) {
            console.log('Old format detected, triggering re-extraction');
            // Trigger re-extraction for old format
            const extractResponse = await fetch(`/api/v1/transcripts/${evaluation.id}/extract-findings`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (extractResponse.ok) {
              const extractResult = await extractResponse.json();
              if (extractResult.success && extractResult.findings) {
                setPreviousFindings({
                  ...extractResult.findings,
                  date: evaluation.date || evaluation.created_at,
                  _markdown: extractResult.findings_markdown || null
                });
              }
            }
          } else {
            setPreviousFindings({
              ...evaluation.positive_findings,
              date: evaluation.date || evaluation.created_at,
              _markdown: evaluation.positive_findings_markdown || null
            });
          }
        }
      } catch (error) {
        console.error('Error fetching initial evaluation:', error);
        alert('Failed to load previous findings');
      } finally {
        setLoadingFindings(false);
      }
    }}
    className={`bg-indigo-600 text-white px-6 py-3 rounded-lg transition-all text-lg flex items-center justify-center ${
      loadingFindings ? 'opacity-75 cursor-not-allowed' : 'hover:bg-indigo-700'
    }`}
  >
    {loadingFindings ? (
      <>
        <svg 
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="currentColor" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Loading Previous Findings...
      </>
    ) : (
      'Load Previous Findings'
    )}
  </button>
) : (
  <div className="max-h-96 overflow-y-auto">
    <PreviousFindings 
      findings={previousFindings} 
      evaluationDate={previousFindings.date}
    />
  </div>
)}
```

#### 2. PreviousFindingsEnhanced.jsx - Enhanced Display Component
```javascript
const PreviousFindingsEnhanced = ({ findings, onClose, isOpen, patientName }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedSection, setCopiedSection] = useState(null);

  if (!isOpen || !findings) return null;

  // Use pre-generated markdown if available, otherwise convert from JSON
  let markdownContent = findings._markdown;
  
  // If no markdown or if it looks like JSON, convert from findings
  if (!markdownContent || markdownContent.trim().startsWith('{')) {
    console.log('No valid markdown found, converting from JSON findings');
    markdownContent = convertFindingsToMarkdown(findings);
  }
  
  const clinicalSummary = createClinicalSummary(findings);

  return (
    <Box sx={{
      position: 'fixed',
      right: 0,
      top: 64,
      height: 'calc(100vh - 64px)',
      width: { xs: '100%', sm: 480, md: 520 },
      bgcolor: 'background.paper',
      boxShadow: 3,
      zIndex: 1200,
      display: 'flex',
      flexDirection: 'column',
      transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
      transition: 'transform 0.3s ease-in-out',
    }}>
      {/* Component content with formatted markdown display */}
      <FormattedMedicalText content={markdownContent} />
    </Box>
  );
};
```

#### 3. findingsFormatter.js - Enhanced Conversion Utilities
```javascript
export const convertFindingsToMarkdown = (findings) => {
  console.log('convertFindingsToMarkdown called with:', findings);
  if (!findings || typeof findings !== 'object') {
    return '### No Previous Findings Available\n\nThe transcript may need to be processed for findings extraction.';
  }

  // Check if findings contains raw_findings field with JSON string
  if (findings.raw_findings && typeof findings.raw_findings === 'string') {
    console.log('Found raw_findings field, attempting to parse JSON');
    try {
      // Extract JSON from markdown code blocks if present
      let jsonStr = findings.raw_findings;
      const jsonMatch = jsonStr.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }
      
      // Parse the JSON
      const parsedFindings = JSON.parse(jsonStr);
      console.log('Successfully parsed findings from raw_findings:', parsedFindings);
      
      // Now convert the parsed findings to markdown
      return convertFindingsToMarkdown(parsedFindings);
    } catch (e) {
      console.error('Failed to parse raw_findings JSON:', e);
    }
  }

  // Check if this is the enhanced format with arrays of findings
  if (findings.pain_findings || findings.range_of_motion_findings || findings.neurological_findings || 
      findings.orthopedic_test_findings || findings.palpation_findings || findings.functional_limitations ||
      findings.posture_and_gait_findings || findings.outcome_assessment_tools) {
    console.log('Detected enhanced format, using convertSimpleFormatToMarkdown');
    return convertSimpleFormatToMarkdown(findings);
  }

  // ... existing conversion logic ...
};

function convertSimpleFormatToMarkdown(findings) {
  let markdown = '### Clinical Baseline Summary\n\n';

  // Pain Findings
  if (findings.pain_findings && findings.pain_findings.length > 0) {
    markdown += '#### Pain Findings\n';
    findings.pain_findings.forEach(finding => {
      markdown += `- ${finding}\n`;
    });
    markdown += '\n';
  }

  // Range of Motion Findings
  if (findings.range_of_motion_findings && findings.range_of_motion_findings.length > 0) {
    markdown += '#### Range of Motion Findings\n';
    findings.range_of_motion_findings.forEach(finding => {
      markdown += `- ${finding}\n`;
    });
    markdown += '\n';
  }

  // ... other categories ...

  return markdown || '### No findings data available';
}
```

### Debug Logging Added

Throughout the implementation, extensive debug logging was added to help troubleshoot issues:

1. **Backend (main.py)**:
   - LLM output length
   - JSON/markdown section detection
   - First 500 chars of output if markdown not found

2. **Frontend (SetupView.jsx)**:
   - Extract API response
   - Markdown content received
   - Old format detection

3. **Frontend (PreviousFindingsEnhanced.jsx)**:
   - Findings object structure
   - Markdown field content
   - Conversion process

4. **Frontend (findingsFormatter.js)**:
   - Input findings structure
   - Conversion path taken
   - Parsing attempts for raw_findings

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
Click "Load Previous ─────────> Show Loading Animation ─────────> GET /patients/{id}/initial-evaluation
Findings"                      │                                 │
                               │                                 ├─> Query Firestore for initial eval
                               │                                 │
                               │                                 ├─> Check positive_findings field
                               │                                 │
                               │                                 └─> Return evaluation data
                               │
                               ├─> Check if old format ─────────> If raw_findings only
                               │                                 │
                               ├─> Trigger re-extraction ───────> POST /transcripts/{id}/extract-findings
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
│   ├── Load previous findings button (with loading animation)
│   ├── Fetches initial evaluation via API
│   ├── Detects old format and triggers re-extraction
│   └── Handles loading states
│
└── RecordingView.jsx
    ├── Receives evaluation props
    ├── Shows/hides findings panel
    ├── Includes evaluation data in save request
    └── PreviousFindingsEnhanced.jsx
        ├── Displays markdown-formatted findings
        ├── Handles JSON to markdown conversion
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
│   ├── Generates both JSON and markdown
│   ├── Handles parsing failures
│   └── Extensive debug logging
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
│   └── Basic extraction prompts (JSON only) - NOT USED
│
└── extraction_prompts_enhanced.py
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
    - loadingFindings state (local)
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
        // Enhanced format (arrays of strings)
        "pain_findings": [
            "Severe neck pain radiating down arm",
            "Thoracic pain, severe",
            "Right shoulder pain"
        ],
        "range_of_motion_findings": [
            "restriction in right rotation and extension, both eliciting pain"
        ],
        "neurological_findings": [
            "Biceps strength 4+/5 on the left",
            "Iliopsoas strength 4+/5 on the right"
        ],
        "palpation_findings": [
            "Tenderness on the bilateral AC joints",
            "Bilateral cervical and trapezius muscle spasm"
        ],
        "orthopedic_test_findings": [],
        "functional_limitations": [
            "insomnia",
            "pain while performing duties as a truck driver"
        ],
        "posture_and_gait_findings": [],
        "outcome_assessment_tools": []
    },
    "positive_findings_markdown": "### Clinical Findings Summary\n\n#### Pain Findings\n- Severe neck pain...",
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
- `isLikelyMarkdown()`: Helper to detect markdown vs JSON content
- `convertSimpleFormatToMarkdown()`: Handles enhanced format conversion

## User Experience Flow

### 1. Patient Selection
- User selects existing patient from dropdown
- Evaluation type selector becomes visible
- User chooses "Re-evaluation"

### 2. Loading Previous Findings
- "Load Previous Findings" button appears
- Click shows loading animation with spinner
- API call fetches initial evaluation
- System detects format and re-extracts if needed
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
- Loading button disabled during operation
- Date picker prevents future dates (dictation mode)
- Save button disabled without required fields

### Format Migration
- System automatically detects old format (raw_findings only)
- Triggers re-extraction to get proper JSON + markdown
- Handles parsing failures gracefully

## Security Considerations

1. **Authentication**: All API calls require valid Firebase token
2. **Authorization**: Users can only access their own patient data
3. **Audit Logging**: All PHI access logged via AuditLogger
4. **Data Isolation**: User ID verification at every step

## Extraneous Code and Debug Elements

### Debug Logging (Should be removed for production)
1. **Backend main.py**:
   - `logger.info(f"Raw LLM output length: {len(output)}")`
   - `logger.info(f"Found JSON section: {bool(json_match)}")`
   - `logger.info(f"Found markdown section: {bool(markdown_match)}")`
   - `logger.warning("No markdown found in LLM output. First 500 chars of output:")`

2. **Frontend SetupView.jsx**:
   - `console.log('Found existing positive_findings:', evaluation.positive_findings)`
   - `console.log('Found existing positive_findings_markdown:', evaluation.positive_findings_markdown)`
   - `console.log('Old format detected, triggering re-extraction')`
   - `console.log('Extract API response:', extractResult)`
   - `console.log('Markdown content:', extractResult.findings_markdown)`

3. **Frontend PreviousFindingsEnhanced.jsx**:
   - `console.log('PreviousFindingsEnhanced - findings object:', findings)`
   - `console.log('PreviousFindingsEnhanced - findings._markdown:', findings._markdown)`
   - `console.log('No valid markdown found, converting from JSON findings')`
   - `console.log('PreviousFindingsEnhanced - final markdownContent:', markdownContent)`

4. **Frontend findingsFormatter.js**:
   - `console.log('convertFindingsToMarkdown called with:', findings)`
   - `console.log('Found raw_findings field, attempting to parse JSON')`
   - `console.log('Successfully parsed findings from raw_findings:', parsedFindings)`
   - `console.error('Failed to parse raw_findings JSON:', e)`
   - `console.log('Detected enhanced format, using convertSimpleFormatToMarkdown')`
   - `console.log('Findings object keys:', Object.keys(findings))`

### Temporary Code Elements
1. **Old Format Support**: The code to handle `raw_findings` format should eventually be removed once all transcripts are migrated
2. **Multiple Extraction Prompt Files**: `extraction_prompts.py` is imported but not used (only `extraction_prompts_enhanced.py` is active)

## Future Enhancements

1. **Multiple Evaluation Comparison**: Compare across multiple re-evaluations
2. **Outcome Metrics**: Standardized outcome measure tracking
3. **Progress Visualization**: Charts showing improvement over time
4. **Template Customization**: Specialty-specific re-evaluation templates
5. **Automated Findings**: AI-suggested comparison points
6. **Export Features**: Re-evaluation summary reports
7. **Comparison Tab**: Implement the comparison mode tab in PreviousFindingsEnhanced

## Testing Checklist

- [x] Create patient with initial evaluation
- [x] Verify evaluation type selector appears
- [x] Test loading previous findings with animation
- [x] Verify findings extraction generates both JSON and markdown
- [x] Test enhanced findings panel:
  - [x] Clinical summary displays correctly
  - [x] Markdown formatting renders properly
  - [x] Toggle between markdown/JSON works
  - [x] Copy functionality works for all sections
  - [x] Panel animation and responsiveness
- [x] Test findings panel toggle during recording
- [x] Verify evaluation metadata saves correctly with both formats
- [x] Check LLM output includes comparisons
- [x] Test error handling:
  - [x] Missing evaluations
  - [x] Extraction failures
  - [x] Malformed JSON responses
  - [x] Old format migration
- [x] Verify proper data isolation between users
- [x] Test with both Deepgram and Speechmatics
- [x] Test backward compatibility (old transcripts without markdown)

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

## UI Improvements (December 2024)

### Modern Evaluation Type Selection
Replaced the dropdown menu with a modern button-based interface:

#### 1. **Button-Based Selection**
- Three visually distinct buttons with icons and descriptions
- Initial Evaluation (article icon)
- Follow-up Visit (update icon)  
- Re-evaluation (assessment icon)
- Selected button shows enhanced styling with shadow and indigo color scheme

#### 2. **Auto-Detection Logic**
When a patient is selected, the system automatically:
- Checks patient transcript history via `/api/v1/patients/{id}/transcripts`
- For new patients (no transcripts): Sets to "Initial Evaluation"
- For existing patients: Checks re-evaluation status
  - Red status (overdue) → Suggests "Re-evaluation"
  - Yellow status (due soon) → Suggests "Re-evaluation"
  - Green status → Defaults to "Follow-up"
- Shows green "Recommended" badge on the suggested option

#### 3. **Re-evaluation Workflow UI**
Enhanced workflow when re-evaluation is selected:
- **Gradient Header**: Purple-to-indigo gradient with workflow title
- **Progress Indicator**: Shows "Step 1 of 2" when loading findings
- **Previous Findings Display**: Clean white card with loading animation
- **Success State**: Green checkmark when findings are loaded
- **Helpful Tips**: Blue info box explaining the workflow

#### 4. **Microphone Monitor Animation**
Smooth transitions when re-evaluation is selected:
- Scales down to 95% with reduced opacity (75%)
- Height limitation to save space (max 120px)
- 500ms transition duration for polish

#### 5. **Dynamic Start Button**
Button adapts based on evaluation type:
- Changes text to "Start Re-evaluation" for re-evaluations
- Uses assessment icon instead of play icon
- Indigo color scheme for re-evaluation mode
- Disabled until previous findings are loaded

#### 6. **Re-evaluation Notice**
Informative notice box that appears in re-evaluation mode:
- Icon-based design with info icon
- Clear messaging about workflow status
- Guides users to load findings before starting

### Implementation Details

#### State Management
```javascript
// Added recommended evaluation type tracking
const [recommendedEvalType, setRecommendedEvalType] = useState(null);

// Auto-detection on patient selection
if (transcripts.length === 0) {
  setEvaluationType('initial');
  setRecommendedEvalType('initial');
} else {
  // Check re-evaluation status and set recommendations
}
```

#### CSS Classes Used
- Transitions: `transition-all duration-200/300/500`
- Shadows: `shadow-lg`, `shadow-md`
- Colors: Indigo theme for re-evaluations, blue for standard
- Animations: `animate-spin` for loading states
- Transforms: `scale()` for microphone monitor

### Future UI Enhancements Planned
1. **Compact Design**: Move evaluation buttons to patient info section
2. **Smart Options**: Show only relevant options based on patient history
3. **Simplified UX**: Remove follow-up option for new patients
4. **Position Optimization**: Better integration with patient selection flow

## Recent Updates (January 2025)

### 1. Minimalist Visit Type Selection UI
The evaluation type selector has been redesigned for a cleaner, more intuitive user experience:

#### **Compact Button Design**
- Moved from large card-based buttons to smaller, inline buttons
- Positioned next to patient information for better workflow
- Removed icons for cleaner appearance
- Added "(Recommended)" text inline instead of separate badges

#### **Smart Option Display**
- **New Patients**: Only shows "Initial Evaluation" option
- **Existing Patients on Follow-up**: Shows current state with option to "Switch to Re-evaluation"
- **Re-evaluation Mode**: Shows locked re-evaluation state
- Prevents confusion by hiding irrelevant options

#### **Implementation Changes**
```javascript
// EvaluationTypeSelector.jsx updates
- Added isNewPatient prop for conditional rendering
- Simplified button styling with smaller padding (px-4 py-2)
- Removed icon-heavy design for text-based clarity
- Added amber color scheme for re-evaluation switch button
```

### 2. Previous Findings Sidebar Persistence
The Previous Findings sidebar now persists across view transitions using Zustand state management:

#### **State Management**
```javascript
// transcriptionSessionStore.js additions
showPreviousFindingsSidebar: false,
setShowPreviousFindingsSidebar: (show) => set({ showPreviousFindingsSidebar: show }),

// Auto-show when findings are loaded
setPreviousFindings: (findings) => set({ 
  previousFindings: findings,
  showPreviousFindingsSidebar: findings && get().evaluationType === 're_evaluation' 
    ? true 
    : get().showPreviousFindingsSidebar
})
```

#### **Cross-Component Persistence**
- Sidebar state maintained when transitioning from RecordingView to TranscriptViewer
- Toggle button available in both views
- Prevents auto-closing when navigating between views
- Manual close action required by user

#### **Implementation**
1. **RecordingView.jsx**: Uses store state instead of local state
2. **TranscriptViewer.jsx**: Added Previous Findings button and sidebar rendering
3. **Store Integration**: Central state management for sidebar visibility

### 3. LLM Prompt Enhancement for Re-evaluations

#### **Automatic Previous Findings Injection**
The system now automatically includes previous findings in the LLM prompt during re-evaluations:

```python
# firestore_endpoints.py - save_session_data_firestore()
if evaluation_type == 're_evaluation' and previous_findings:
    custom_instructions += f"\n\nPrevious Initial Evaluation Findings:\n{json.dumps(previous_findings, indent=2)}"
    logger.info("Added previous findings to LLM context for re-evaluation")
```

#### **Data Flow**
1. **Frontend sends**: evaluation_type, initial_evaluation_id, and previous_findings in request body
2. **Backend processing**: 
   - Extracts previous findings from request (line 344)
   - Appends to LLM instructions if re-evaluation (lines 500-502)
   - Includes in Gemini API call
3. **LLM receives**: Full context with previous findings for comparative analysis

#### **Benefits**
- Automated comparison between initial and current findings
- Consistent note structure for progress tracking
- No manual copy-paste required by doctors
- Contextual awareness for AI-generated notes

### 4. Improved Patient Type Detection
Enhanced logic for automatically detecting patient type:

```javascript
// SetupView.jsx
// For manually entered patients
onChange={(e) => {
  setPatientDetails(e.target.value);
  if (!selectedPatient && e.target.value.trim()) {
    setEvaluationType('initial');
    setIsNewPatient(true);
  }
}}

// For selected patients - API call to check transcript history
if (transcripts.length === 0) {
  setIsNewPatient(true);
  setEvaluationType('initial');
} else {
  setIsNewPatient(false);
  // Check re-evaluation status...
}
```

### 5. Bug Fixes and Improvements
- Fixed unused imports and linting issues
- Added proper API base URL handling for patient status checks
- Improved error handling for re-evaluation status endpoint failures
- Added fallback to follow-up when re-evaluation check fails