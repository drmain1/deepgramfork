# Billing Module Documentation

## Overview

The billing module is a complex system that generates medical billing codes (CPT and ICD-10) from patient transcripts using Google's Gemini AI models. It processes multiple transcripts for a patient and produces a comprehensive billing report with compliance recommendations.

## Architecture Overview

```
Frontend (React) → Backend API → Firestore → Gemini AI → Billing Report
                                     ↓
                                  GCS Storage
```

## Core Components

### 1. Frontend Components

#### `/my-vite-react-app/src/pages/PatientTranscriptList.jsx`
- **Purpose**: Main UI for selecting transcripts and triggering billing generation
- **Key Functions**:
  - `handleGenerateBilling()` - Initiates billing generation for selected transcripts
  - Shows progress dialog with steps
  - Displays billing results in a modal dialog

#### `/my-vite-react-app/src/components/BillingRulesTab.jsx`
- **Purpose**: Settings interface for custom billing rules
- **Key Functions**:
  - Allows clinics to add custom billing rules
  - Rules are saved to user settings and appended to base rules during billing generation

### 2. Backend Components

#### `/backend/main.py`
- **Endpoint**: `POST /api/v1/patients/{patient_id}/generate-billing`
- **Authentication**: Firebase Bearer token required
- **Request Model**: `BillingRequest`
  ```python
  class BillingRequest(BaseModel):
      transcript_ids: List[str]
      billing_instructions: Optional[str] = ""
  ```
- **Key Functions**:
  1. Validates patient ownership
  2. Fetches transcripts (handles both specific IDs and all patient transcripts)
  3. Combines base rules + custom rules + request-specific instructions
  4. Calls `generate_billing_with_gemini()`
  5. Returns billing data with compliance report

#### `/backend/base_billing_rules.py`
- **Purpose**: Contains comprehensive base billing rules for all clinics
- **Content**: 
  - CPT code definitions and billing logic
  - ICD-10 diagnosis hierarchies (waterfall logic)
  - Compliance rules and bundling restrictions
  - Time-based billing calculations (8-minute rule)
  - E/M code documentation requirements
- **Key Function**: `get_base_billing_rules()` - Returns the base rules string

#### `/backend/gcp_utils.py`
- **Function**: `generate_billing_with_gemini()`
- **Parameters**:
  ```python
  def generate_billing_with_gemini(
      transcript: str,
      patient_info: Dict[str, Any],
      billing_instructions: str,
      encounter_type: str,
      service_date: Optional[str] = None,
      model_name: str = "gemini-2.5-pro"
  ) -> Dict[str, Any]
  ```
- **Process**:
  1. Initializes Vertex AI
  2. Constructs prompt with patient info, billing rules, and transcript
  3. Tries multiple model options with fallbacks
  4. Parses and structures the AI response
  5. Returns billing data and compliance report

#### `/backend/firestore_client.py`
- **Functions**:
  - `get_patient_transcripts()` - Fetches all transcripts for a patient
  - `get_transcript()` - Fetches a single transcript by ID
  - `get_custom_billing_rules()` - Retrieves user's custom billing rules

## Data Flow

### 1. Billing Generation Flow

```
1. User selects transcripts in PatientTranscriptList
   ↓
2. Frontend sends POST to /generate-billing with transcript IDs
   ↓
3. Backend validates patient ownership
   ↓
4. Fetches transcripts from Firestore
   - Uses get_patient_transcripts() for bulk fetch
   - Falls back to individual get_transcript() calls
   ↓
5. Extracts transcript content (handles field mapping)
   - Prefers polished transcript over original
   - Handles both raw Firestore fields and mapped fields
   ↓
6. Combines all billing rules:
   - Base rules from base_billing_rules.py
   - Custom clinic rules from user settings
   - Request-specific instructions
   ↓
7. Calls Gemini AI with combined prompt
   ↓
8. Returns structured billing data with:
   - CPT codes array
   - ICD-10 codes with descriptions
   - Compliance recommendations
   - Service dates
```

### 2. Field Mapping Flow

```
Firestore Fields          →  Frontend Expected Fields
transcript_original       →  transcript
transcript_polished       →  polishedTranscript

get_patient_transcripts() performs this mapping
get_transcript() returns raw Firestore fields
```

## Billing Rules Engine

### Base Rules Structure

1. **Primary Diagnostic Engine (Waterfall Logic)**
   - Cervical Spine: Radiculopathy → Sprain/Strain → Regional Pain → Segmental Dysfunction
   - Thoracic Spine: Similar hierarchy
   - Lumbar Spine: Similar hierarchy

2. **Secondary Diagnostic Engine**
   - Scans for specific triggers in transcript
   - Adds supporting ICD-10 codes based on keywords

3. **CPT Code Rules**
   - CMT codes (98940-98942) based on regions adjusted
   - Timed procedures follow 8-minute rule
   - Bundling restrictions (e.g., 97140 with CMT)
   - E/M codes with time documentation requirements

4. **Compliance Rules**
   - Timing violations
   - Bundling violations
   - Missing supporting diagnoses
   - Documentation requirements

### Output Format

```json
{
  "billing_data_ledger": [
    {
      "date_of_service": "2025-06-08",
      "cpt_codes": ["98940", "97124"],
      "icd10_codes": [
        {
          "code": "M54.2",
          "description": "Cervicalgia"
        }
      ]
    }
  ],
  "compliance_report": "Detailed compliance recommendations...",
  "success": true
}
```

## Known Issues and Technical Debt

### 1. Field Mapping Inconsistencies ✅ FIXED
- **Issue**: Mixed field naming between Firestore and frontend
- **Status**: Fixed in main.py billing endpoint
- **Solution**: Code now handles both raw and mapped field names

### 2. Model Availability Issues
- **Issue**: Gemini model names may change or become unavailable
- **Current Solution**: Fallback chain tries multiple model options
- **TODO**: Implement more robust model selection with availability checking

### 3. Transcript Content Quality
- **Issue**: Billing quality depends on transcript quality
- **Risk**: Poor transcription → Poor billing codes
- **TODO**: Add transcript quality validation before billing

### 4. Large Transcript Handling
- **Issue**: Multiple long transcripts may exceed token limits
- **Current Behavior**: No chunking or summarization
- **TODO**: Implement transcript chunking for large documents

### 5. Audit Logging
- **Status**: Basic PHI access logging implemented
- **TODO**: Add more detailed billing-specific audit trails

### 6. Error Handling
- **Issue**: Generic error messages don't help debugging
- **TODO**: Implement specific error types for different failure modes

### 7. Caching
- **Issue**: Re-fetches transcripts for each billing request
- **TODO**: Implement caching layer for recently accessed transcripts

### 8. Billing History
- **Issue**: No storage of generated billing reports
- **TODO**: Save billing reports for audit and reprint capabilities

### 9. Custom Rules Validation
- **Issue**: No validation of custom billing rules syntax
- **Risk**: Invalid rules could break AI processing
- **TODO**: Add rule validation before saving

### 10. Batch Processing
- **Issue**: Sequential transcript processing
- **TODO**: Implement parallel transcript fetching

## Security Considerations

1. **Authentication**: All endpoints require Firebase auth
2. **Authorization**: Users can only access their own patient data
3. **PHI Protection**: Audit logging for HIPAA compliance
4. **Data Isolation**: User data strictly separated in Firestore

## Testing Recommendations

### Unit Tests Needed
1. Field mapping logic
2. Billing rules parsing
3. Transcript content extraction
4. Date parsing and formatting

### Integration Tests Needed
1. Full billing generation flow
2. Error handling scenarios
3. Large transcript handling
4. Model fallback behavior

### Manual Testing Checklist
- [ ] Generate billing for single transcript
- [ ] Generate billing for multiple transcripts
- [ ] Test with empty/missing transcript content
- [ ] Verify custom rules are applied
- [ ] Check compliance report accuracy
- [ ] Test with different encounter types
- [ ] Verify audit logs are created

## Monitoring and Debugging

### Key Log Points
1. `Billing generation requested for transcripts: [IDs]`
2. `Found content of length: X for transcript Y`
3. `No content found in transcript X. Available fields: [...]`
4. `Using model for billing: [model_name]`
5. `Billing generation completed successfully`

### Common Issues and Solutions

1. **"No transcript content available"**
   - Check field mapping in logs
   - Verify transcript has content in Firestore

2. **"Failed to generate billing"**
   - Check Gemini API quotas
   - Verify model availability
   - Check prompt size limits

3. **Incorrect billing codes**
   - Review transcript quality
   - Check custom rules syntax
   - Verify encounter type is correct

## Future Enhancements

1. **Real-time Billing Preview**
   - Show billing codes during transcription
   - Allow manual code adjustment

2. **Billing Templates**
   - Pre-defined billing scenarios
   - Quick-select common procedures

3. **Insurance Integration**
   - Validate codes against payer rules
   - Check prior authorization requirements

4. **Billing Analytics**
   - Track most used codes
   - Identify billing patterns
   - Revenue optimization suggestions

5. **Multi-provider Support**
   - Different rules per provider
   - Provider-specific templates

## Dependencies

### Python Packages
- `google-cloud-aiplatform` - Vertex AI for Gemini
- `firebase-admin` - Authentication and Firestore
- `fastapi` - REST API framework
- `pydantic` - Request/response models

### External Services
- Google Vertex AI (Gemini models)
- Firebase Authentication
- Firestore Database
- Google Cloud Storage (for transcript storage)

### Frontend Dependencies
- React 19 with Vite
- Material-UI for components
- date-fns for date formatting

## Configuration

### Environment Variables
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `GOOGLE_APPLICATION_CREDENTIALS` - Service account path
- Firebase configuration in frontend `.env`

### User Settings
- Custom billing rules stored in Firestore
- Accessible via Settings → Billing Rules tab

## Compliance Notes

1. **HIPAA**: All PHI access is logged
2. **Billing Compliance**: Rules based on CMS guidelines
3. **Documentation**: Follows medical necessity requirements
4. **Audit Trail**: All billing generations are logged

---

*Last Updated: June 2025*
*Version: 1.0*