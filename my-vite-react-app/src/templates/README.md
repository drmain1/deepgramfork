# Medical Narrative Templates

This directory contains the organized structure for medical narrative templates used in the transcription application.

## Directory Structure

```
templates/
├── README.md                    # This documentation file
├── templateConfig.js           # Main configuration file that exports all templates
└── llm-instructions/          # Directory containing LLM instruction files
    ├── pain-management-eval.js
    ├── ortho-spine-consult.js
    └── [other specialty files]
```

## How to Add New Templates

### 1. Create LLM Instructions File

Create a new file in `llm-instructions/` directory:

```javascript
// llm-instructions/new-specialty-template.js
export const newSpecialtyInstructions = `Your detailed LLM instructions here...

This can be as long as needed and include:
- Detailed formatting requirements
- Specific medical terminology
- Section requirements
- ICD-10 code instructions
- Any specialty-specific requirements
`;
```

### 2. Update Template Configuration

In `templateConfig.js`:

1. Import your new instructions:
```javascript
import { newSpecialtyInstructions } from './llm-instructions/new-specialty-template.js';
```

2. Add to the appropriate specialty array:
```javascript
'Your Specialty': [
  {
    id: 'unique_template_id',
    name: 'Template Display Name',
    llmInstructions: newSpecialtyInstructions,
    sampleNarrative: `Your sample narrative here...`
  }
]
```

## Benefits of This Structure

1. **Maintainability**: Long LLM instructions are in separate files, making them easier to edit
2. **Readability**: The main component file is cleaner and more focused
3. **Modularity**: Each template's instructions can be developed and tested independently
4. **Version Control**: Changes to specific templates are easier to track
5. **Collaboration**: Multiple developers can work on different templates without conflicts

## Template Object Structure

Each template object should have:

- `id`: Unique identifier (string)
- `name`: Display name for the template (string)
- `llmInstructions`: The LLM instructions (imported from separate file)
- `sampleNarrative`: Example output to show users what to expect (string)

## Best Practices

1. Keep LLM instructions in separate files when they exceed ~200 characters
2. Use descriptive file names that match the template purpose
3. Include comprehensive sample narratives that demonstrate the expected output format
4. Document any specialty-specific requirements in the instructions
5. Test templates thoroughly before adding to production 