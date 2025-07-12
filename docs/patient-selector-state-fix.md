# Patient Selector State Management Fix

## Problem Summary
When editing a patient and adding AI context notes, the Edit Patient dialog doesn't populate correctly on subsequent edits because the parent component holds a stale reference to the patient object.

## Implemented Solution

### 1. Store Enhancement
Added `getPatientById` selector to `patientsStore.js`:
```javascript
getPatientById: (patientId) => {
  const { patients } = get();
  return patients.find(p => p.id === patientId) || null;
}
```

### 2. PatientSelector Component Updates
- Added effect to sync with store updates when editing
- Always fetches fresh patient data from store using `getPatientById`
- Updates form data when store patient changes (avoiding active input disruption)

### 3. Parent Component Pattern (Recommended)
Instead of storing the full patient object, parent components should:
1. Store only the `selectedPatientId`
2. Use the `getPatientById` selector to get fresh data
3. Subscribe to store updates for reactive updates

## Implementation for Parent Components

### Current Pattern (Problematic)
```javascript
// transcriptionSessionStore.js
selectedPatient: null,  // Stores full object - gets stale

// SetupView.jsx
<PatientSelector
  selectedPatient={selectedPatient}  // Passes stale object
  onSelectPatient={(patient) => {
    updatePatientFromSelector(patient);  // Updates with new object
  }}
/>
```

### Recommended Pattern
```javascript
// transcriptionSessionStore.js
selectedPatientId: null,  // Store only ID

// SetupView.jsx
const { getPatientById } = usePatientsStore();
const selectedPatient = selectedPatientId ? getPatientById(selectedPatientId) : null;

<PatientSelector
  selectedPatient={selectedPatient}  // Always fresh from store
  onSelectPatient={(patient) => {
    setSelectedPatientId(patient?.id || null);
  }}
/>
```

## Next Steps

To complete the fix:

1. Update `transcriptionSessionStore.js`:
   - Change `selectedPatient` to `selectedPatientId`
   - Update all methods to work with IDs
   - Add computed getter for patient object

2. Update parent components:
   - SetupView.jsx
   - PatientsPage.jsx
   - Any other components using selectedPatient

3. Benefits:
   - Single source of truth (patientsStore)
   - Automatic updates when patient data changes
   - No stale references
   - Better performance (storing IDs vs objects)

## Testing Checklist
- [ ] Edit patient and add AI context notes
- [ ] Close dialog and re-open edit - should show updated notes
- [ ] Edit from different screens - should always show latest data
- [ ] Multiple rapid edits work correctly
- [ ] No memory leaks from refs or effects