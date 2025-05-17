Let's break down the requirements and think through the frontend implications, keeping in mind the backend capabilities we've started building.

Core User Needs & Goals:

Minimize Repetitive Setup: Doctors shouldn't type instructions repeatedly.
Flexibility: Support simple common formats and highly customized ones.
Clarity: Understand what the note will look like before processing.
Control: Allow fine-grained control over note structure and style.
Conceptual Frontend Structure (Inspired by Screenshots & Requirements):

We can envision a "Note Settings" area, perhaps accessible per-session or as a global preference that can be overridden.

I. LLM Profile/Template Selection & Configuration:

A. "Simple Presets" Pathway:
Note Structure Choice:
Dropdown/Radio buttons: "SOAP", "SOAP (Subjective & Objective Combined, Assessment & Plan Merged)", "APSO", etc.
Frontend Action: Selecting one loads a base set of LLM instructions.
Output Style Choice (Global or Per-Section):
The screenshots show "Section style" (Auto / Bullet points / Paragraph) which is ideal for per-section control. This is more flexible.
Frontend Action: Modifies the LLM instructions for the relevant sections. For example, "For the Subjective section, use bullet points." or "For the Assessment, provide a paragraph."
Additional Toggles (as seen in screenshots):
"Show visit diagnoses suggestions" (Boolean): This would be a flag in the instruction string for Claude.
"Split by problem" (Boolean, likely per-section, e.g., for Assessment/Plan): Modifies instructions to tell Claude how to handle multiple problems.
B. "Custom Templates" Pathway:
Choose from Pre-built Custom Templates:
Dropdown/List: Populated with templates we've designed (e.g., "Cardiology Follow-up SOAP", "Pediatric Well Visit Note").
Frontend Action: Loads a more specific, detailed set of LLM instructions. These could be fetched from the backend or be part of the frontend bundle if fairly static.
Build/Manage User's Own Templates:
This would be a more involved UI section/modal:
Create New Template:
Option to start from scratch or duplicate an existing template (simple preset or another custom one).
Define sections (name, order).
For each section: specify custom title, output style (bullet/paragraph), whether to split by problem, and potentially section-specific instructions.
Add "General Custom Instructions" applicable to the whole note.
Edit Existing Template: Modify the above.
Save Template:
Frontend Action: Sends the template configuration (JSON structure representing all choices) to a backend endpoint (our "Priority 3" task) to be saved (e.g., in S3 under the user's profile). The LLM instruction string itself could be saved, or the frontend/backend could reconstruct it from the JSON config when needed. Saving the config is more flexible for future edits.
List/Select User's Templates: A dropdown to pick one of their saved templates.
C. Ad-hoc "General Custom Instructions" (for the current session):
A text area (as seen in screenshots) allowing the user to add specific instructions for the current note being generated, which appends to or modifies the instructions from the selected preset/template.
Frontend Action: This text is directly incorporated into the final claude_custom_instructions string sent to the backend.
II. Preview Panel (Right Side):

Purpose: Dynamically show a structural representation of the note based on current selections.
Content:
Displays section headers (e.g., "SUBJECTIVE", "ASSESSMENT & PLAN").
Indicates style (e.g., show bullet points or a paragraph icon/placeholder).
Reflects "Split by problem" (e.g., showing "Problem 1", "Problem 2" sub-sections).
Implementation Idea: The frontend would have a function that takes the current settings object and generates a simple HTML/JSX structure for this preview. It's not showing LLM output, just the structure the LLM will be asked to follow.
III. State Management (React Context, Zustand, Redux, etc.):

The frontend will need to manage:

activeProfileSettings: An object representing all the currently selected options (base structure, section styles, custom titles, general instructions, toggles).
userSavedProfiles: A list of profiles/templates the user has created and saved (fetched from the backend).
systemPredefinedProfiles: Our pre-built "simple" and "custom" templates.
IV. Generating claude_custom_instructions:

This is a critical piece of frontend logic. A function will take the activeProfileSettings object and construct the comprehensive text string that gets sent to the backend as claude_custom_instructions.

Example Snippet (Conceptual):
javascript
CopyInsert
function generateClaudeInstructions(settings) {
  let instructions = `Please generate a clinical note based on the provided transcript.\n`;
  instructions += `Use the ${settings.baseStructure} format.\n`; // e.g., "SOAP"

  settings.sections.forEach(section => {
    instructions += `For the ${section.name} section (titled '${section.customTitle || section.name}'):\n`;
    if (section.style === 'bullets') {
      instructions += `- Present the information as bullet points.\n`;
    } else if (section.style === 'paragraph') {
      instructions += `- Present the information as a concise paragraph.\n`;
    }
    if (section.splitByProblem) {
      instructions += `- If multiple problems are discussed, address each one separately within this section.\n`;
    }
    // Add any other section-specific instructions
  });

  if (settings.showDiagnosesSuggestions) {
    instructions += `Incorporate visit diagnosis suggestions appropriately.\n`;
  }
  if (settings.generalCustomInstructions) {
    instructions += `\nAdditionally, please follow these general instructions: ${settings.generalCustomInstructions}\n`;
  }
  instructions += `\nDo NOT add any preamble like 'Here is the note:'. Just output the structured note directly.`;
  return instructions;
}
V. Workflow Integration:

Settings Page/Modal: Doctor configures their desired note profile or selects a saved one.
During/After Recording: The chosen profile's settings are active.
On "Process/Save Note":
The frontend calls generateClaudeInstructions(activeProfileSettings).
It then sends final_transcript_text and the generated claude_custom_instructions string to the backend /api/v1/save_session_data endpoint.
Backend Implications (Reiteration of "Priority 3"):

We will definitely need backend endpoints for:
POST /api/v1/llm_profiles: Create/save a new user-defined LLM profile (takes JSON config).
GET /api/v1/llm_profiles: List user's saved LLM profiles.
GET /api/v1/llm_profiles/{profile_id}: Get details of a specific profile.
PUT /api/v1/llm_profiles/{profile_id}: Update a profile.
DELETE /api/v1/llm_profiles/{profile_id}: Delete a profile.
These profiles would be stored in S3, likely as JSON files under a user-specific prefix (e.g., s3://[BUCKET]/[TENANT_ID]/llm_profiles/{user_id}/{profile_id}.json).
Summary of Frontend Development Phases/Components:

Core UI for "Simple Presets": Dropdowns and toggles for structure, section styles.
Instruction Generation Logic: The generateClaudeInstructions function.
Preview Panel Component.
Integration with API call: Sending the generated instructions.
(Later) UI for Managing Custom Templates: CRUD operations, linking to new backend endpoints.
(Later) State persistence for user preferences and saved templates.
This is a comprehensive feature, and breaking it down will be key. The "Simple Presets" with a dynamic preview and the ability to add "General custom instructions" for the current session would be a great first iteration. Then, layering in the full custom template management.

This plan seems to align well with your vision and the screenshots. The next step would be to start designing the React components for the "Simple Presets" pathway and the logic for generating the initial version of `claude_custom_instructions`.

## VI. Refined UI Structure and Navigation (User Feedback Integration)

Based on further discussion, the frontend UI for managing LLM instructions and note templates will be integrated into a "Settings" area, likely accessible from the main left-hand navigation menu. This settings area will utilize a tabbed interface for clarity and progressive disclosure of complexity.

1.  **Overall Settings Navigation:**
    *   A "Settings" button/icon in the main left-hand menu will navigate the user to a dedicated settings page.

2.  **Tab Structure within Settings Page:**
    *   **`Note` Tab (Default/Current Session Settings):**
        *   **Purpose:** Allows configuration of the note structure for the *current session* or acts as a scratchpad for building a template.
        *   **Content:** Houses the "Simple Presets" pathway options (SOAP, SO+AP, APSO selection), section-specific configurations (custom titles, bullet/paragraph style, split by problem), and the ad-hoc "General custom instructions" text area.
        *   **Preview Panel:** The dynamic preview panel will be visible here, reflecting selections made in this tab.
    *   **`Preset Custom Templates` Tab (New):**
        *   **Purpose:** Allows users to browse and select from a curated list of more detailed, pre-built templates provided by the application (e.g., "Cardiology Follow-up SOAP").
        *   **Functionality:** Selecting a template here would populate the `Note` tab's configuration and preview, allowing further ad-hoc customization for the current session if needed.
    *   **`My Templates` Tab (New - formerly "Create Your Own Template")**
        *   **Purpose:** A dedicated workspace for users to create, view, edit, and manage their own reusable custom note templates.
        *   **Functionality:**
            *   List user's saved templates.
            *   Interface to build a new template from scratch or by modifying an existing one (either a preset or another user template).
            *   Detailed controls for section definition, ordering, titles, styles, and template-specific instructions.

3.  **"Save Current Configuration as Template" Button:**
    *   **Location:** Prominently available, perhaps within the `Note` tab or at a global level within the settings page when a configuration is active.
    *   **Functionality:** When clicked, it prompts the user to name the current configuration (from the `Note` tab) and saves it as a new entry in their `My Templates` list. This allows users to easily promote a finely-tuned session configuration into a reusable template.

4.  **Template Selection During Dictation Initiation:**
    *   When a doctor starts a new encounter or dictation, they should have an option to select from their `My Templates` or the `Preset Custom Templates` to pre-configure the note structure for that session. They can also choose to start with the default/simple presets from the `Note` tab. 

## VII. Dedicated Frontend Helper File for LLM Instruction Logic

To maintain clean component architecture and centralize LLM-related frontend logic, a dedicated helper file will be created.

*   **Proposed Filename:** `my-vite-react-app/src/utils/llmInstructionHelper.js` (or `llmProfileService.js`)
*   **Key Functions and Responsibilities:**
    1.  **`generateClaudeInstructions(settingsObject)`:**
        *   **Input:** A `settingsObject` derived from the current UI selections (across any relevant tab defining the active note structure).
        *   **Output:** A comprehensive string formatted as the `claude_custom_instructions` to be sent to the backend.
        *   **Details:** This function will encapsulate all the logic for translating UI choices (SOAP format, bullet points for section X, custom title for section Y, general instructions, etc.) into the precise text prompt for Claude.
    2.  **LLM Profile API Interaction Functions (for `My Templates`):**
        *   These functions will handle communication with the backend API endpoints (to be built under Priority 3) for managing user-saved templates.
        *   `async saveUserProfile(profileData)`: Sends new/updated template data (likely JSON configuration) to `POST /api/v1/llm_profiles` or `PUT /api/v1/llm_profiles/{id}`.
        *   `async getUserProfiles()`: Fetches the list of user's saved templates from `GET /api/v1/llm_profiles`.
        *   `async getProfileById(profileId)`: Fetches a specific template by ID from `GET /api/v1/llm_profiles/{profile_id}`.
        *   `async deleteUserProfile(profileId)`: Deletes a template via `DELETE /api/v1/llm_profiles/{profile_id}`.
    3.  **Default/Preset Template Definitions:**
        *   May hold the structured definitions for the "Simple Presets" (SOAP, APSO, etc.) and our curated "Preset Custom Templates" if these are primarily managed on the frontend. Alternatively, these could also be fetched from a backend endpoint if they need to be updated without frontend redeployment.
    4.  **Utility Functions:**
        *   Helper functions for validating template data, transforming data structures between UI state and API payloads, etc.