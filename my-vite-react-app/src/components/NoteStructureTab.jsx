import { useState } from 'react';
import { Box, FormControl, FormControlLabel, Radio, RadioGroup, TextField, Button, Card, CardContent, Switch } from '@mui/material';
import { useTemplate } from '../contexts/TemplateContext';
import { generateLLMInstructions } from '../utils/generateLLMInstructions';

function NoteStructureTab() {
  const [structure, setStructure] = useState('SOAP');
  const [customInstructions, setCustomInstructions] = useState('');
  const [showDiagnoses, setShowDiagnoses] = useState(false);
  const { macroPhrases, customVocabulary } = useTemplate();

  const handleSave = () => {
    const template = {
      structure,
      customInstructions,
      macroPhrases,
      customVocabulary,
    };
    const llmInstructions = generateLLMInstructions(template);
    alert(`Template saved:\n${llmInstructions}`);
    // TODO: Send to backend
  };

  return (
    <Card>
      <CardContent>
        <Box>
          <FormControl component="fieldset">
            <RadioGroup value={structure} onChange={(e) => setStructure(e.target.value)}>
              <FormControlLabel value="SOAP" control={<Radio />} label="SOAP" />
              <FormControlLabel value="SOAP_Combined" control={<Radio />} label="SOAP (Assessment & Plan Combined)" />
              <FormControlLabel value="Narrative" control={<Radio />} label="Narrative" />
              <FormControlLabel value="DAP" control={<Radio />} label="DAP" />
              <FormControlLabel value="BIRP" control={<Radio />} label="BIRP" />
            </RadioGroup>
          </FormControl>
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={<Switch checked={showDiagnoses} onChange={(e) => setShowDiagnoses(e.target.checked)} />}
              label="Show visit diagnoses suggestions"
            />
          </Box>
          <TextField
            label="Custom Instructions"
            multiline
            rows={4}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            fullWidth
            sx={{ mt: 2 }}
          />
          <Button variant="contained" onClick={handleSave} sx={{ mt: 2 }}>
            Save to Template
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}

export default NoteStructureTab;
