# Previous Visit Summary Feature

## Overview
The Previous Visit Summary feature displays patient visit data from previous encounters in a human-readable format. It handles both JSON-structured data and plain text transcripts.

## Location
- **Component**: `/src/components/LastTranscriptModal.jsx`
- **Used in**: `/src/components/SetupView.jsx` (lines 309-373)

## How It Works

### Data Flow
1. User clicks "View Last Visit" button in SetupView
2. System fetches user recordings from `/api/v1/user_recordings/{user_id}`
3. Filters recordings by patient name
4. Fetches full transcript from `/api/v1/transcript/{user_id}/{transcript_id}`
5. Displays formatted data in LastTranscriptModal

### JSON Data Formatting
The component automatically detects and formats JSON data into readable sections:

#### Supported JSON Structure
```json
{
  "patient_info": {
    "patient_name": "Last, First",
    "date_of_birth": "MM/DD/YYYY",
    "date_of_accident": "MM/DD/YYYY",
    "date_of_treatment": "YYYY-MM-DD",
    "provider": "Provider Name"
  },
  "clinic_info": {
    "name": "Clinic Name",
    "address": "Address",
    "phone": "Phone",
    "fax": "Fax"
  },
  "chief_complaint": "Patient's chief complaint",
  "history_of_present_illness": "History details",
  "past_medical_history": "Medical history",
  "past_surgical_history": "Surgical history",
  "current_medications": "Medications list",
  "family_history": "Family history"
}
```

### Key Functions

#### `formatTranscriptContent(content)`
- Detects if content is JSON or plain text
- Parses JSON and calls `formatJsonData()` if applicable
- Returns formatted sections array or original content

#### `formatJsonData(data)`
- Converts JSON data into an array of section objects
- Each section has:
  - `title`: Section heading
  - `content`: Text content (optional)
  - `items`: Array of list items (optional)
- Handles known medical record fields
- Dynamically formats unknown fields

### Display Features
- **Sectioned Layout**: JSON data displayed in organized sections with headers
- **Plain Text Fallback**: Non-JSON content displayed in preformatted text
- **Copy to Context**: Extracts chief complaint or summary for patient context
- **Loading State**: Shows spinner while fetching data
- **Empty State**: Displays message when no previous visits found

## Modifying the Feature

### Adding New JSON Fields
To support additional JSON fields, update the `formatJsonData()` function:

1. Add field to known sections (lines 36-105)
2. Or let dynamic handler process it (lines 112-124)

### Changing Display Format
- Section styling: Modify the render section (lines 184-205)
- Colors/spacing: Update Tailwind classes
- Copy summary logic: Update extraction logic (lines 226-255)

## API Endpoints
- `GET /api/v1/user_recordings/{user_id}` - List all recordings
- `GET /api/v1/transcript/{user_id}/{transcript_id}` - Get transcript details

## Testing
The feature handles:
- Valid JSON transcripts
- Plain text transcripts  
- Mixed content
- Missing/null fields
- Empty transcripts