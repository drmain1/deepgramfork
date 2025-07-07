# State Management Refactoring Plan

## 🎉 COMPLETED CHANGES (Phase 1)

### ✅ High Priority Tasks Completed
1. **UserSettingsContext → userSettingsStore** - COMPLETED
   - Created `src/stores/userSettingsStore.js` with Zustand store
   - Created `src/services/userSettingsService.js` for API calls
   - Created `src/hooks/useUserSettings.js` for backward compatibility
   - Removed UserSettingsProvider from RootApp.jsx
   - All existing components continue to work without changes

2. **AudioRecorder Component Deprecation** - COMPLETED
   - Confirmed component is not used anywhere in active codebase
   - Added deprecation notice and moved to `src/deprecated/AudioRecorder.jsx`
   - Safe to delete (see [Deprecated Components](#deprecated-components) section)

3. **transcriptionSessionStore Extension** - COMPLETED
   - Extended with recording session state (sessionId, transcripts, recording status)
   - Added recording-specific actions and getters
   - Maintained HIPAA compliance with proper data clearing
   - RecordingView can now use centralized state management

### 🚀 Benefits Achieved
- **Performance**: Eliminated UserSettingsContext prop drilling
- **Maintainability**: Centralized state management with clear separation of concerns
- **HIPAA Compliance**: All stores properly clear sensitive data on unload
- **Backward Compatibility**: All existing components continue to work unchanged

## Executive Summary

This document outlines a comprehensive plan to refactor the application's state management from React Context and local state to Zustand stores. The refactoring will improve performance, reduce prop drilling, and maintain HIPAA compliance throughout.

## Table of Contents

1. [Completed Changes (Phase 1)](#-completed-changes-phase-1)
2. [Deprecated Components](#deprecated-components)
3. [Current State Analysis](#current-state-analysis)
4. [HIPAA Compliance Requirements](#hipaa-compliance-requirements)
5. [Proposed Zustand Stores](#proposed-zustand-stores)
6. [Dependencies and Breaking Changes](#dependencies-and-breaking-changes)
7. [Implementation Phases](#implementation-phases)
8. [Risk Mitigation](#risk-mitigation)
9. [Testing Strategy](#testing-strategy)

## Deprecated Components

### 🗑️ Safe to Delete

The following components have been deprecated and can be safely removed from the codebase:

#### 1. AudioRecorder Component
- **Location**: `src/deprecated/AudioRecorder.jsx` (moved from `src/components/AudioRecorder.jsx`)
- **Status**: ✅ **SAFE TO DELETE**
- **Reason**: Legacy component that's no longer used anywhere in the application
- **Replacement**: Current architecture uses `TranscriptionPage` → `SetupView` → `RecordingView` flow
- **Dependencies**: None - not imported or referenced anywhere
- **Impact**: No breaking changes - component is completely unused

#### 2. UserSettingsContext (Legacy Parts)
- **Location**: `src/contexts/UserSettingsContext.jsx`
- **Status**: ⚠️ **PARTIALLY DEPRECATED**
- **Safe to Remove**:
  - `UserSettingsProvider` component (lines 12-199)
  - `useUserSettingsLegacy` hook (line 7)
  - All internal context logic
- **Keep**:
  - Re-export of new `useUserSettings` hook (line 10)
- **Impact**: Breaking change if components still use the provider directly

### 🔍 Additional Cleanup Candidates

Based on comprehensive codebase analysis, the following components are unused and can be safely removed:

#### 1. Authentication Components (Unused)
- `src/components/AuthLoading.jsx` - No imports found
- `src/components/LoginButton.jsx` - Replaced by FirebaseAuthenticator
- `src/components/LogoutButton.jsx` - Replaced by FirebaseAuthenticator

#### 2. Setup Modal Components (Unused)
- `src/components/EasySetupModal.jsx` - No imports found
- `src/components/AdvancedSetupModal.jsx` - No imports found

#### 3. Utility Functions (Unused)
- `src/utils/requestDeduplicator.js` - No imports found

#### 4. Test Components (Conditional)
- `src/components/PdfTestComponent.jsx` - Only used for `/pdf-test` route
- `src/templates/llm-instructions/test-gcp-template.js` - Test template

#### 5. Legacy Hooks
- `useUserSettingsLegacy` in `src/contexts/UserSettingsContext.jsx` - Deprecated

### 🛠️ Cleanup Commands

```bash
# ===== PHASE 1: Safe deletions (no breaking changes) =====

# Remove explicitly deprecated components
rm src/deprecated/AudioRecorder.jsx
rmdir src/deprecated  # if empty

# Remove unused authentication components
rm src/components/AuthLoading.jsx
rm src/components/LoginButton.jsx
rm src/components/LogoutButton.jsx

# Remove unused modal components  
rm src/components/EasySetupModal.jsx
rm src/components/AdvancedSetupModal.jsx

# Remove unused utilities
rm src/utils/requestDeduplicator.js

# ===== PHASE 2: Optional deletions (test/debug components) =====

# Remove test components (if testing is complete)
rm src/components/PdfTestComponent.jsx
# Note: Also remove route from App.jsx: <Route path="/pdf-test" element={<PdfTestComponent />} />

rm src/templates/llm-instructions/test-gcp-template.js
# Note: Also remove from templateConfig.js if present

# ===== PHASE 3: Context cleanup (after verification) =====

# Clean up UserSettingsContext (keep only re-export)
# Edit src/contexts/UserSettingsContext.jsx manually to keep only:
# export { useUserSettings } from '../hooks/useUserSettings';
```

### 📊 Cleanup Impact Summary

**Files to Remove**: 8-10 files
**Estimated Size Reduction**: ~15-20% of unused code
**Breaking Changes**: None (all removed components are unused)
**Testing Required**: Basic smoke tests after cleanup

### 📋 Deprecation Checklist

Before deleting any component:
- [ ] Confirm no imports in codebase (`grep -r "ComponentName" src/`)
- [ ] Check for route references in router files
- [ ] Verify no dynamic imports or lazy loading
- [ ] Check for string references in configuration files
- [ ] Run build to ensure no compilation errors
- [ ] Test critical user flows

## Current State Analysis

### Components Currently NOT Using Zustand

| Component/Context | Current State Management | Issues | Priority | Status |
|-------------------|-------------------------|---------|----------|---------|
| ~~UserSettingsContext~~ | ~~React Context + useState~~ | ~~Heavy prop drilling, complex nested state, performance issues~~ | ~~HIGH~~ | ✅ **COMPLETED** |
| Settings Page Components | Props passed through 3+ levels | Prop drilling, difficult to maintain | HIGH | ✅ **RESOLVED** (via userSettingsStore) |
| ~~RecordingView~~ | ~~Mixed (Zustand + local state)~~ | ~~State fragmentation, inconsistency~~ | ~~HIGH~~ | ✅ **COMPLETED** |
| BillingStatement | Local useState | No persistence, complex edits lost on navigation | MEDIUM | 🔄 **PENDING** |
| ~~AudioRecorder~~ | ~~Local useState (duplicates Zustand)~~ | ~~Redundant, deprecated pattern~~ | ~~HIGH~~ | ✅ **DEPRECATED** |
| PatientTranscriptList | Local state + custom hook | No caching, repeated API calls | MEDIUM | 🔄 **PENDING** |
| PDF Generation | Local state in multiple components | Duplicated state, no central tracking | MEDIUM | 🔄 **PENDING** |
| Microphone Monitor | Hook with local state | Multiple instances possible | LOW | 🔄 **PENDING** |

### Existing Zustand Stores

1. **transcriptionSessionStore.js**
   - Manages patient selection, session settings, evaluation data
   - HIPAA compliant (no localStorage)
   - Auto-clears on page unload

2. **patientsStore.js**
   - Patient CRUD operations
   - 30-second cache for performance
   - Token-based authentication

3. **transcriptsStore.js**
   - Transcript management
   - Optimistic updates
   - API integration

## HIPAA Compliance Requirements

### Critical Security Considerations

1. **No PHI in localStorage/sessionStorage**
   - All patient data must be in-memory only
   - Clear on page unload/navigation
   - No persistence between sessions

2. **Automatic Data Clearing**
   ```javascript
   // Required for all stores with PHI
   window.addEventListener('beforeunload', () => {
     store.getState().resetStore();
   });
   ```

3. **Sensitive Data Fields**
   - Patient names, DOB, DOA
   - Clinical notes and contexts
   - Transcription content
   - Billing information
   - Treatment records

4. **Access Control**
   - Token validation before data access
   - User-scoped data only
   - No cross-patient data leakage

## Proposed Zustand Stores

### 1. userSettingsStore (Replace UserSettingsContext)

```javascript
// stores/userSettingsStore.js
const useUserSettingsStore = create(
  subscribeWithSelector((set, get) => ({
    // State
    doctorInfo: {},
    officeInformation: [],
    transcriptionProfiles: [],
    macroPhrases: [],
    customVocabulary: [],
    medicalSpecialty: '',
    billingRules: [],
    cptFees: [],
    noteStructure: {},
    narrativeTemplates: [],
    
    // Actions
    updateDoctorInfo: (info) => set({ doctorInfo: info }),
    updateOfficeInformation: (offices) => set({ officeInformation: offices }),
    // ... other actions
    
    // Batch updates for settings page
    updateAllSettings: (settings) => set(settings),
    
    // No localStorage - settings fetched from backend on login
  }))
);
```

### 2. billingStore

```javascript
// stores/billingStore.js
const useBillingStore = create((set, get) => ({
  // State
  currentBillingLedger: null,
  editableLedger: null,
  isEditing: false,
  hasUnsavedChanges: false,
  
  // Actions
  loadBillingData: (transcriptId, billingData) => set({
    currentBillingLedger: billingData,
    editableLedger: cloneDeep(billingData),
    isEditing: false,
    hasUnsavedChanges: false
  }),
  
  updateLedgerItem: (index, updates) => set((state) => ({
    editableLedger: updateItemAtIndex(state.editableLedger, index, updates),
    hasUnsavedChanges: true
  })),
  
  clearBillingData: () => set({
    currentBillingLedger: null,
    editableLedger: null,
    isEditing: false,
    hasUnsavedChanges: false
  })
}));

// HIPAA: Clear on unload
window.addEventListener('beforeunload', () => {
  useBillingStore.getState().clearBillingData();
});
```

### 3. patientTranscriptsStore

```javascript
// stores/patientTranscriptsStore.js
const usePatientTranscriptsStore = create((set, get) => ({
  // State
  transcriptsByPatient: {}, // { patientId: { transcripts: [], lastFetched: Date } }
  loadingStates: {}, // { patientId: boolean }
  
  // Actions
  setTranscripts: (patientId, transcripts) => set((state) => ({
    transcriptsByPatient: {
      ...state.transcriptsByPatient,
      [patientId]: {
        transcripts,
        lastFetched: Date.now()
      }
    }
  })),
  
  // Cache invalidation after 5 minutes
  getTranscripts: (patientId) => {
    const cached = get().transcriptsByPatient[patientId];
    if (cached && Date.now() - cached.lastFetched < 300000) {
      return cached.transcripts;
    }
    return null;
  },
  
  clearCache: () => set({ transcriptsByPatient: {}, loadingStates: {} })
}));
```

### 4. sessionRecordingStore (Extend transcriptionSessionStore)

```javascript
// Additional state for RecordingView
const sessionRecordingState = {
  // Recording session state
  sessionId: null,
  hasStreamedOnce: false,
  finalTranscript: '',
  currentInterimTranscript: '',
  isSessionSaved: false,
  recordingStartTime: null,
  recordingDuration: 0,
  
  // Actions
  initializeRecording: (sessionId) => set({
    sessionId,
    hasStreamedOnce: false,
    finalTranscript: '',
    currentInterimTranscript: '',
    isSessionSaved: false,
    recordingStartTime: Date.now()
  }),
  
  updateTranscript: (final, interim) => set({
    finalTranscript: final,
    currentInterimTranscript: interim,
    hasStreamedOnce: true
  }),
  
  markSessionSaved: () => set({ isSessionSaved: true }),
  
  clearRecordingSession: () => set({
    sessionId: null,
    hasStreamedOnce: false,
    finalTranscript: '',
    currentInterimTranscript: '',
    isSessionSaved: false,
    recordingStartTime: null,
    recordingDuration: 0
  })
};
```

### 5. pdfGenerationStore

```javascript
// stores/pdfGenerationStore.js
const usePdfGenerationStore = create((set) => ({
  // State by transcriptId
  generationStates: {}, // { transcriptId: { loading: boolean, error: string, pdfUrl: string } }
  
  // Actions
  startGeneration: (transcriptId) => set((state) => ({
    generationStates: {
      ...state.generationStates,
      [transcriptId]: { loading: true, error: null, pdfUrl: null }
    }
  })),
  
  setGenerationComplete: (transcriptId, pdfUrl) => set((state) => ({
    generationStates: {
      ...state.generationStates,
      [transcriptId]: { loading: false, error: null, pdfUrl }
    }
  })),
  
  setGenerationError: (transcriptId, error) => set((state) => ({
    generationStates: {
      ...state.generationStates,
      [transcriptId]: { loading: false, error, pdfUrl: null }
    }
  })),
  
  clearPdfStates: () => set({ generationStates: {} })
}));
```

### 6. uiStore (Global UI State)

```javascript
// stores/uiStore.js
const useUiStore = create((set) => ({
  // Global loading states
  globalLoading: false,
  globalError: null,
  notifications: [],
  
  // Modals
  activeModal: null,
  modalProps: {},
  
  // Actions
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  setGlobalError: (error) => set({ globalError: error }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, { ...notification, id: Date.now() }]
  })),
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  })),
  
  openModal: (modalName, props = {}) => set({
    activeModal: modalName,
    modalProps: props
  }),
  
  closeModal: () => set({ activeModal: null, modalProps: {} })
}));
```

## Dependencies and Breaking Changes

### Component Updates Required

1. **UserSettingsContext Removal**
   - Update all imports from `useUserSettings` to `useUserSettingsStore`
   - Remove UserSettingsProvider wrapper from App.jsx
   - Update all consuming components (30+ files)

2. **Settings Page Refactor**
   ```javascript
   // Before
   <MacroPhrasesTab 
     macroPhrases={macroPhrases}
     onSave={handleSaveMacroPhrases}
     userSettings={userSettings}
   />
   
   // After
   <MacroPhrasesTab /> // Uses store directly
   ```

3. **RecordingView State Migration**
   - Move all local state to stores
   - Update WebSocket handlers
   - Update save/draft functions

4. **AudioRecorder Deprecation**
   - Remove component entirely
   - Update any imports/routes
   - Ensure no legacy code references

### API Integration Changes

1. **Settings Loading**
   ```javascript
   // New pattern in App.jsx or auth handler
   useEffect(() => {
     if (user) {
       loadUserSettings(user.uid);
       loadUserPatients(user.uid);
     }
   }, [user]);
   ```

2. **Billing Data Flow**
   - Update transcript viewer to use billingStore
   - Modify save endpoints to update store

3. **PDF Generation**
   - Centralize all PDF requests through store
   - Update progress tracking

### Testing Considerations

1. **Store Testing**
   ```javascript
   // Example test for HIPAA compliance
   describe('billingStore HIPAA compliance', () => {
     it('should clear all data on beforeunload', () => {
       const { loadBillingData, clearBillingData } = useBillingStore.getState();
       loadBillingData('123', mockBillingData);
       
       window.dispatchEvent(new Event('beforeunload'));
       
       expect(useBillingStore.getState().currentBillingLedger).toBeNull();
     });
   });
   ```

2. **Component Testing**
   - Mock Zustand stores in tests
   - Test store subscriptions
   - Verify no localStorage usage

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Create base store structure
2. Implement HIPAA compliance utilities
3. Set up store devtools
4. Create migration utilities

### Phase 2: High Priority Stores (Week 2)
1. Convert UserSettingsContext to userSettingsStore
2. Deprecate AudioRecorder component
3. Extend transcriptionSessionStore for RecordingView
4. Update all affected components

### Phase 3: Medium Priority Stores (Week 3)
1. Implement billingStore
2. Create patientTranscriptsStore
3. Implement pdfGenerationStore
4. Update consuming components

### Phase 4: Cleanup and Optimization (Week 4)
1. Implement uiStore for global states
2. Remove all prop drilling
3. Performance optimization
4. Documentation updates

## Risk Mitigation

### 1. Data Loss Prevention
- Implement auto-save drafts
- Add unsaved changes warnings
- Create backup save mechanisms

### 2. Migration Rollback Plan
- Keep Context providers temporarily
- Use feature flags for gradual rollout
- Maintain backwards compatibility

### 3. HIPAA Compliance Verification
- Audit all stores for PHI
- Verify no localStorage usage
- Test data clearing mechanisms
- Security review before deployment

### 4. Performance Monitoring
- Add performance metrics
- Monitor re-render counts
- Track store update frequency
- Optimize subscriptions

## Testing Strategy

### Unit Tests
```javascript
// Store isolation tests
describe('userSettingsStore', () => {
  beforeEach(() => {
    useUserSettingsStore.setState(initialState);
  });
  
  it('should update doctor info', () => {
    const { updateDoctorInfo } = useUserSettingsStore.getState();
    updateDoctorInfo({ name: 'Dr. Smith' });
    
    expect(useUserSettingsStore.getState().doctorInfo.name).toBe('Dr. Smith');
  });
});
```

### Integration Tests
```javascript
// Component + Store tests
describe('SettingsPage with Zustand', () => {
  it('should save settings through store', async () => {
    render(<SettingsPage />);
    
    // Update settings
    fireEvent.change(screen.getByLabelText('Doctor Name'), {
      target: { value: 'Dr. Jones' }
    });
    
    fireEvent.click(screen.getByText('Save'));
    
    await waitFor(() => {
      expect(useUserSettingsStore.getState().doctorInfo.name).toBe('Dr. Jones');
    });
  });
});
```

### E2E Tests
- Test full user flows
- Verify data persistence
- Check HIPAA compliance
- Test error scenarios

## Success Metrics

1. **Performance**
   - 50% reduction in unnecessary re-renders
   - Faster settings page load time
   - Reduced memory usage

2. **Developer Experience**
   - Eliminated prop drilling
   - Cleaner component code
   - Better debugging with devtools

3. **User Experience**
   - Faster UI updates
   - Consistent state across views
   - No lost data on navigation

4. **Security**
   - 100% HIPAA compliance maintained
   - No PHI in browser storage
   - Secure data clearing

## Conclusion

This refactoring will significantly improve the application's architecture while maintaining strict HIPAA compliance. The phased approach minimizes risk and allows for gradual migration with proper testing at each stage.