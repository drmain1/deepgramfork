## UI Refactoring Attempts for AudioRecorder.jsx (Issue: Text Jumping and Readability) - May 22, 2025

The following attempts were made to address text jumping when switching between "Original Transcript" and "Polished Note" tabs, and to improve text readability.

### Attempt 1: Structural Consistency & Basic Readability

*   **Action**:
    *   Ensured the "Original Transcript" tab's internal structure (`Box` with `display: 'flex', flexDirection: 'column', height: '100%'`) matched the "Polished Note" tab.
    *   Increased `fontSize` in transcript views to `1rem`.
    *   Set `color` to `text.primary`.
*   **File**: `my-vite-react-app/src/components/AudioRecorder.jsx` (around lines 601-611 of the file at that time)
*   **Outcome**: Text jumping persisted. Readability slightly improved.

### Attempt 2: Overflow Adjustment & Further Readability

*   **Action**:
    *   Removed `overflowY: 'auto'` from the inner `Box component="pre"` elements in both tabs, relying on `TabPanel` for scrolling.
    *   Increased `fontSize` to `1.1rem`.
    *   Added `lineHeight: 1.6`.
*   **File**: `my-vite-react-app/src/components/AudioRecorder.jsx` (around lines 603, 610 of the file at that time)
*   **Outcome**: Text jumping persisted. Readability further improved.

### Attempt 3: Simplifying TabPanel Children Structure

*   **Action**:
    *   Removed the intermediate `Box` wrapper (e.g., `<Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>`) inside each `TabPanel`.
    *   This made the `Box component="pre"` (and the button's `Box` in the second tab) direct children of the `TabPanel`'s internal scrolling `Box`.
*   **File**: `my-vite-react-app/src/components/AudioRecorder.jsx` (around lines 601-623 of the file at that time)
*   **Outcome**: Text jumping persisted.

### Attempt 4: Simplifying TabPanel Component Internals

*   **Action**:
    *   Modified the `TabPanel` component's main `div` style: changed `overflow: 'hidden'` to `overflowY: 'auto'`.
    *   Removed the nested `Box` from within the `TabPanel` component.
    *   Rendered `TabPanel`'s `children` directly inside its main `div` (if the tab is active).
*   **File**: `my-vite-react-app/src/components/AudioRecorder.jsx` (around lines 553-560 for `TabPanel` definition, based on file state at that time)
*   **Outcome**: Text jumping persisted.

### Attempt 5: Applying `minHeight: 0` to Flex Containers

*   **Action**:
    *   Added `minHeight: 0` to the `style` prop of the `TabPanel` component's root `div`. This `div` is a column flex container (`display: 'flex', flexDirection: 'column'`) with `flexGrow: 1` and `overflowY: 'auto'`.
    *   Added `minHeight: 0` to the `sx` prop of the parent `Box` that contains the `Tabs` and `TabPanel`s. This `Box` is also a column flex container with `flexGrow: 1` and `overflow: 'hidden'`.
*   **File**: `my-vite-react-app/src/components/AudioRecorder.jsx` (around line 553 for `TabPanel` and line 593 for the parent `Box`, based on file state at that time)
*   **Outcome**: Text jumping slightly improved but still present.
---
