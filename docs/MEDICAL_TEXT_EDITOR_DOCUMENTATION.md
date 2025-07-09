# Medical Text Editor Documentation

## Overview
This documentation covers the Plain Text editing mode for medical dictation data, which allows doctors to edit structured JSON medical data in a human-readable format.

## Problem Solved
- **Original Issue**: Doctors had to edit raw JSON data, which was difficult and error-prone
- **Solution**: Toggle between JSON and Plain Text editing modes with automatic conversion

## Files Modified/Created

### 1. `/src/utils/medicalTextConversion.js`
**New utility file** containing conversion functions between JSON and plain text formats.

### 2. `/src/components/EditableNote.jsx`
**Modified** to add plain text editing capability with mode switching.

## Dependencies
The following MUI components were added to the imports:
- `ToggleButton`
- `ToggleButtonGroup`
- `Code as CodeIcon`
- `TextFields as TextIcon`

## Core Functions

### `jsonToPlainText(jsonData)`
Converts structured JSON medical data to readable plain text format.

**Input**: JSON object or JSON string
**Output**: Formatted plain text string

**Example Output**:
```
=== RE-EVALUATION ===

PATIENT INFORMATION
Name: DEF, ABC
DOB: 1/1/1983
Accident Date: 1/1/2001
Treatment Date: 07/08/2025
Provider: [Not specified]

CLINIC INFORMATION
Name: Efficient Chiropractic
Address: 1234 Main St Los Angeles, CA 90024
Phone: 3106340443

CHIEF COMPLAINT
1. Neck pain, radiating to arm: Previously present | Currently persists
2. Thoracic pain: Previously present | Currently persists
3. Right knee sprain: Previously present | Currently resolved

HISTORY OF PRESENT ILLNESS
Patient presents for follow-up today. Patient is progressing well with treatment.

PHYSICAL EXAMINATION
Cervical spine right rotation: Previously restricted, with pain | Currently normal
Cervical spine extension: Previously restricted, with pain | Currently normal
```

### `plainTextToJson(plainText)`
Parses plain text back to structured JSON format.

**Input**: Plain text string (formatted as above)
**Output**: JSON string (properly formatted)

**Error Handling**: Throws error if parsing fails

## UI Components

### Toggle Button Group
- **Plain Text Mode**: Shows user-friendly text editor
- **JSON Mode**: Shows traditional JSON editor with syntax highlighting

### Error Display
- Shows conversion errors as inline alerts
- Prevents mode switching if conversion fails
- Validates JSON structure before saving

## Usage Flow

1. **Edit Mode**: Click "Edit Note" button
2. **Mode Selection**: Toggle between "Plain Text" and "JSON" modes
3. **Content Editing**: Edit in preferred format
4. **Auto-Conversion**: System converts between formats automatically
5. **Save**: Always saves as JSON regardless of editing mode

## Plain Text Format Structure

### Section Headers
All section headers are in ALL CAPS format:
- `PATIENT INFORMATION`
- `CLINIC INFORMATION`
- `CHIEF COMPLAINT`
- `HISTORY OF PRESENT ILLNESS`
- `PAST MEDICAL HISTORY`
- `PHYSICAL EXAMINATION`
- `ASSESSMENT/DIAGNOSIS`
- `PLAN`
- etc.

### Field Format
Patient/Clinic information uses `Field Name: Value` format:
```
Name: John Doe
DOB: 1/1/1990
Phone: 555-1234
```

### Special Formatting
- Chief complaints with comparisons use numbered lists
- Progress comparisons use "Previously X | Currently Y" format
- Empty fields show as `[Not specified]`

## Error Handling

### Conversion Errors
- Invalid plain text format shows error message
- JSON parsing errors are caught and displayed
- Mode switching blocked if conversion fails

### Save Validation
- Plain text is converted to JSON before saving
- JSON validation ensures proper structure
- Error messages guide user to fix formatting issues

## Testing

### Manual Testing Steps
1. Load a re-evaluation with JSON data
2. Click "Edit Note"
3. Switch to "Plain Text" mode
4. Verify content is readable and formatted
5. Make edits to patient information
6. Switch back to "JSON" mode
7. Verify JSON structure is maintained
8. Save changes and verify they persist

### Sample Test Data
```javascript
const sampleJson = {
  "evaluation_type": "re_evaluation",
  "patient_info": {
    "patient_name": "DEF, ABC",
    "date_of_birth": "1/1/1983",
    "date_of_accident": "1/1/2001",
    "date_of_treatment": "07/08/2025"
  },
  "sections": {
    "chief_complaint": "1. Neck pain: Previously present | Currently persists",
    "history_of_present_illness": "Patient presents for follow-up today."
  }
};
```

## Troubleshooting

### Common Issues

1. **Conversion Fails**
   - Check plain text formatting matches expected structure
   - Ensure section headers are in ALL CAPS
   - Verify field format: `Field Name: Value`

2. **Save Errors**
   - Usually indicates invalid JSON structure
   - Check for missing required fields
   - Verify evaluation_type is set correctly

3. **Mode Toggle Doesn't Work**
   - Check for conversion errors in console
   - Verify content is valid before switching modes

### Recovery Steps
1. Click "Cancel" to reset to last saved version
2. Switch to JSON mode to see raw data
3. Manually fix JSON structure if needed
4. Contact developer if persistent issues

## Future Enhancements

### Potential Improvements
- Auto-save during editing
- Spell check for medical terms
- Template shortcuts for common sections
- Validation for medical data formats (dates, phone numbers)
- Export to different formats (Word, PDF)

### Known Limitations
- Complex nested structures may not convert perfectly
- Some formatting nuances may be lost in conversion
- Requires manual section header formatting in plain text mode

## Developer Notes

### Code Structure
- Conversion functions are pure functions (no side effects)
- Error handling uses try/catch with user-friendly messages
- State management keeps JSON and plain text in sync
- UI components follow Material-UI patterns

### Performance Considerations
- Conversion happens on mode switch and save only
- Large documents may have slight delay during conversion
- Consider debouncing for future real-time conversion

### Security Notes
- No user input is executed as code
- JSON parsing uses native JSON.parse (safe)
- No external API calls in conversion functions

## Support
For issues or questions, refer to:
1. This documentation
2. Console errors for debugging
3. Test the conversion functions directly in browser console
4. Check Material-UI documentation for UI component issues