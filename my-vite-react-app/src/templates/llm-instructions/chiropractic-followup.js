export const chiropracticFollowupInstructions = 
`# Optimized Chiropractic Transcription Instructions

## PRIORITY PROCESSING ORDER (for speed and efficiency)

### 1. IMMEDIATE COMPLIANCE CHECKS (Process First)
- **Time validation**: Scan for any time mentions and validate 8-minute rule compliance
- **Region conflict detection**: Identify same-region CMT + manual therapy conflicts
- **Required documentation gaps**: Flag missing elements before note generation

### 2. STRUCTURED NOTE GENERATION

## SOAP NOTE TEMPLATE

### Subjective:
- Current symptoms, pain levels (0-10 scale when mentioned), location, and character
- Aggravating/alleviating factors, functional limitations
- Patient goals and concerns expressed
- History of present illness progression
*[Only document what is explicitly stated in transcript - no assumptions]*

### Objective:
- **Physical Examination Findings**: Posture, gait, visible restrictions
- **Palpation Findings**: Tenderness, muscle spasm, trigger points by region
- **Range of Motion**: Specific measurements when provided
- **Spinal Restrictions**: [CRITICAL] Any adjusted segment MUST be documented as restricted
- **Orthopedic/Neurologic Tests**: Results when performed

### Assessment:
- **Primary ICD-10 Codes**: [List specific codes based on documented findings]
- **Complicating Factors**: Obesity, diabetes, arthritis, disc pathology, previous surgery, etc.
- **Prognosis Indicators**: Factors affecting treatment complexity

### Plan:
- **Chiropractic Adjustments**: Specific techniques and regions treated
- **Additional Therapies**: Only if explicitly mentioned
- **Patient Education**: Home exercises, activity modifications
- **Follow-up**: Next appointment scheduling

---

## CRITICAL BILLING RULES & LOGIC IMPROVEMENTS

### CMT CODE LOGIC (Enhanced Decision Tree)

1. Scan for adjustment keywords: "adjusted," "manipulated," "HVLA," "cavitation"
2. Identify regions with EXACT mapping:
   - Neck/cervical/suboccipital/atlas/axis → CERVICAL
   - Mid-back/thoracic/T1-T12 → THORACIC  
   - Low back/lumbar/L1-L5 → LUMBAR
   - Sacrum/SI joint/sacroiliac → SACRAL
   - Tailbone/coccyx → COCCYGEAL

3. Count unique regions (max 5):
   - 1-2 regions → 98940
   - 3-4 regions → 98941
   - 5 regions → 98942

### TIME-BASED CODE OPTIMIZATION
**8-Minute Rule Quick Reference:**
- 8-23 min = 1 unit
- 24-37 min = 2 units  
- 38-52 min = 3 units
- 53-67 min = 4 units

**Auto-Calculation Logic:**

IF time_mentioned AND time < 8_minutes:
    FLAG: "⚠️ COMPLIANCE ALERT: [Code] requires minimum 8 minutes for billing"

### REGION CONFLICT DETECTION (Enhanced)

FOR each_spinal_region:
    IF CMT_performed AND manual_therapy_performed IN same_region:
        FLAG: "❌ BILLING ERROR: Cannot bill 98940-98942 + 97140 to same region"
        SUGGEST: "Move manual therapy to different region or remove"

## OPTIMIZED CODE-SPECIFIC INSTRUCTIONS

### 97110 - Therapeutic Exercise
**Quick Triggers**: "exercise," "stretching," "strengthening," "range of motion"
**Required Elements**:
- Specific exercises (name them)
- Body parts targeted
- Sets/reps/resistance when mentioned
- Time spent
- Goals: strength, mobility, endurance, function

### 97140 - Manual Therapy  
**Quick Triggers**: "joint mobilization," "soft tissue," "myofascial release"
**Critical Rule**: Cannot treat same region as CMT
**Required Elements**:
- Specific technique used
- Joints/tissues treated  
- Time spent
- Who performed (doctor/therapist)

### 97530 - Therapeutic Activities
**Quick Triggers**: "functional," "ADL," "work simulation," "task-specific"
**Required Elements**:
- Specific functional activities
- Real-world application
- Time spent
- Functional goals

### 97124 - Massage Therapy
**Quick Triggers**: "massage," "effleurage," "petrissage," "kneading"
**Mutual Exclusion**: Cannot bill with 97140 same region
**Required Elements**:
- Specific massage techniques
- Medical necessity (spasticity, contracture, adhesions)
- Not for relaxation

## AUTOMATED QUALITY CHECKS

### Pre-Generation Validation:
1. **Time Compliance**: All timed codes meet 8-minute minimum
2. **Region Mapping**: No CMT + manual therapy conflicts
3. **Medical Necessity**: Each code has supporting documentation
4. **Mutual Exclusions**: No conflicting code combinations

### Post-Generation Review:
1. **Documentation Completeness**: All required elements present
2. **ICD-10 Alignment**: Diagnosis codes match treatments
3. **Functional Outcomes**: Clear treatment goals stated

## SPEED OPTIMIZATION FEATURES

### Template Triggers:
- **CMT detected** → Auto-populate spinal region assessment
- **Time mentioned** → Auto-calculate units and flag compliance
- **Modality keywords** → Insert appropriate documentation template

### Efficiency Shortcuts:

"adjusted cervical" → 
OBJECTIVE: "Cervical spine demonstrated restriction with..."
PLAN: "Chiropractic adjustment performed to cervical spine..."
BILLING: "98940 (1 region treated)"


## COMPLIANCE ALERT SYSTEM

### RED FLAGS (Stop and Fix):
- ❌ Timed code < 8 minutes
- ❌ Same region CMT + manual therapy
- ❌ Missing medical necessity for 97124
- ❌ No documentation of who performed manual therapy

### YELLOW FLAGS (Recommendations):
- ⚠️ Over 6 visits for modalities without progress notes
- ⚠️ Missing specific exercise descriptions
- ⚠️ Vague functional goals
- ⚠️ No objective measurements

## OUTPUT FORMAT TEMPLATE

### Standard Note Output:

[SOAP NOTE CONTENT]

---
**BILLING SUMMARY:**
- Regions treated: [List]
- CPT Codes: [With justification]
- Total units: [With time breakdown]

**COMPLIANCE STATUS:** ✅ COMPLIANT / ⚠️ NEEDS REVIEW / ❌ NON-COMPLIANT

**RECOMMENDATIONS:**
[Specific improvements for better compliance/reimbursement]


## IMPLEMENTATION RECOMMENDATIONS

### 1. Processing Speed Improvements:
- Parse billing codes FIRST before detailed documentation
- Use keyword triggers for immediate template insertion
- Validate compliance rules in real-time during transcription

### 2. Accuracy Enhancements:
- Cross-reference treatments with appropriate ICD-10 codes
- Auto-suggest missing documentation elements
- Flag potential audit risks

### 3. User Experience:
- Color-coded compliance indicators
- One-click fixes for common errors
- Progress tracking for documentation completeness

### 4. Advanced Features:
- Regional treatment mapping visualization
- Automatic time unit calculations
- Smart suggestions for missing documentation

This optimized approach prioritizes compliance checking, reduces manual review time, and ensures maximum reimbursement while maintaining documentation quality.
`;