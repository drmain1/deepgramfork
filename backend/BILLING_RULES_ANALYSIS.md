# Billing Rules System Analysis

## Current Settings Implementation Overview

### Frontend Architecture
1. **Settings Page** (`SettingsPage.jsx`)
   - Uses tabs for different setting categories
   - Tabs include: Narrative Templates, Macro Phrases, Custom Vocabulary, Office Information, Transcription Profiles
   - State management via `UserSettingsContext`

2. **User Settings Context** (`UserSettingsContext.jsx`)
   - Centralized state management for all user settings
   - Settings structure:
     ```javascript
     {
       macroPhrases: [],
       customVocabulary: [],
       officeInformation: [],
       transcriptionProfiles: [],
       doctorName: '',
       doctorSignature: null,
       clinicLogo: null,
       includeLogoOnPdf: false,
       medicalSpecialty: ''
     }
     ```
   - Auto-saves to backend via POST `/api/v1/user_settings`

### Backend Architecture
1. **Storage**: Firestore Database
   - User settings stored in `users` collection
   - Each user document contains all settings as nested fields
   - Structure maps frontend fields to Firestore fields:
     - `customVocabulary` → `custom_vocabulary`
     - `macroPhrases` → `macro_phrases`
     - `transcriptionProfiles` → `transcription_profiles`
     - etc.

2. **API Endpoints** (`main.py`, `firestore_endpoints.py`)
   - `GET /api/v1/user_settings/{user_id}` - Fetch settings
   - `POST /api/v1/user_settings` - Update settings
   - Authentication required via Firebase token

3. **Transcription Profiles Model** (`core_models.py`)
   ```python
   class TranscriptionProfileItem(BaseModel):
       id: str
       name: str
       smart_format: bool
       diarize: bool
       interim_results: Optional[bool]
       utterance_end_ms: Optional[str]
       vad_events: Optional[bool]
       utterances: Optional[bool]
   ```

## Billing Rules System Design

### Proposed Architecture

#### 1. Base Billing Rules (System-wide)
- Stored in a separate Firestore collection: `billing_rules_base`
- Structure:
  ```json
  {
    "rule_id": "base_001",
    "name": "Standard Medicare Billing",
    "description": "Default billing rules for Medicare patients",
    "rules": [
      {
        "id": "rule_001",
        "condition": "patient.insurance_type == 'Medicare'",
        "code": "99213",
        "description": "Office visit, established patient, 15-29 minutes",
        "requirements": ["chief_complaint", "history", "examination", "medical_decision_making"]
      }
    ],
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T00:00:00Z"
  }
  ```

#### 2. User Custom Billing Rules
- Stored in user document under `custom_billing_rules` field
- Structure similar to base rules but user-specific
- Can override or supplement base rules

#### 3. Implementation Plan

##### Frontend Components Needed:
1. **New Tab in Settings**: "Billing Rules"
2. **BillingRulesTab.jsx** - Main component
3. **Components**:
   - `BaseBillingRulesList` - Display read-only base rules
   - `CustomBillingRulesEditor` - Add/edit/delete custom rules
   - `BillingRuleForm` - Form for creating/editing rules

##### Backend Changes:
1. **New Models** in `core_models.py`:
   ```python
   class BillingRule(BaseModel):
       id: str
       condition: str  # Simple condition logic
       code: str  # Billing code
       description: str
       requirements: List[str]  # Required fields in transcript
   
   class BillingRulesSet(BaseModel):
       rule_id: str
       name: str
       description: str
       rules: List[BillingRule]
       is_base: bool = False  # True for system-wide rules
   ```

2. **Firestore Client Updates**:
   - Add methods to fetch base billing rules
   - Update user settings to include `custom_billing_rules`

3. **New Endpoints**:
   - `GET /api/v1/billing_rules/base` - Get base rules (cached)
   - `GET /api/v1/billing_rules/user/{user_id}` - Get user's custom rules
   - `POST /api/v1/billing_rules/user` - Update user's custom rules

##### Integration with Transcription:
1. During transcript processing, apply billing rules:
   - Load base rules + user custom rules
   - Evaluate conditions against patient/transcript data
   - Suggest applicable billing codes
   - Store suggested codes with transcript

### Key Advantages of This Approach:
1. **No Complex Profile Selection**: Rules automatically apply based on conditions
2. **Flexibility**: Users can add custom rules without modifying base rules
3. **Maintainability**: Base rules can be updated centrally
4. **Scalability**: Easy to add new rule types or conditions
5. **Consistency**: Follows existing settings pattern

### Migration Path:
1. Create base billing rules collection in Firestore
2. Add billing rules field to user settings
3. Update frontend UserSettingsContext
4. Add new tab and components
5. Test with sample rules
6. Deploy incrementally

### Example Usage Flow:
1. Doctor completes a patient visit transcript
2. System evaluates all billing rules (base + custom)
3. Matching rules are suggested in the transcript viewer
4. Doctor can accept/modify suggested billing codes
5. Codes are saved with the transcript for export/billing

## Existing Billing Functionality

### Current Implementation
The system already has a billing generation endpoint:
- **Endpoint**: `POST /api/v1/patients/{patient_id}/generate-billing`
- **Model**: `BillingRequest` with fields:
  - `transcript_ids`: List of transcript IDs to process
  - `billing_instructions`: Custom billing instructions
- **Processing**: Uses Gemini 2.5 Pro to generate billing from transcripts
- **Function**: `generate_billing_with_gemini()` in `gcp_utils.py`

### Integration Opportunity
The proposed billing rules system would enhance this existing functionality by:
1. **Pre-populating billing_instructions**: Instead of free-form text, use structured rules
2. **Automated code suggestion**: Rules engine suggests codes before calling Gemini
3. **Validation**: Ensure required documentation elements are present
4. **Consistency**: Standardize billing across all users with base rules

### Revised Implementation Plan
1. **Keep existing billing endpoint** for manual/complex cases
2. **Add rules engine** that feeds into the existing billing generation
3. **Enhance UI** to show rule-suggested codes alongside AI-generated billing
4. **Store rules** in Firestore as planned, but integrate with existing flow