import { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper,
  Divider,
  Alert,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Save as SaveIcon,
  Info as InfoIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';

function BillingRulesTab({ customBillingRules, saveCustomBillingRules, settingsLoading }) {
  const [rules, setRules] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);

  useEffect(() => {
    // Initialize with existing custom billing rules
    setRules(customBillingRules || '');
  }, [customBillingRules]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus(null);
    
    try {
      await saveCustomBillingRules(rules);
      setSaveStatus('success');
      // Clear success message after 3 seconds
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (error) {
      console.error('Failed to save billing rules:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const exampleRules = `Example custom rules:

## Specialty-Specific Rules

### Orthopedic Surgery
- Major joint injections (20610): Document joint, laterality, and medication used
- Fracture care codes: Include type, location, and whether manipulation was performed

### Physical Therapy
- Always document total treatment time for 8-minute rule calculations
- For 97140 (Manual therapy): Specify techniques used (e.g., mobilization, manipulation)

### Workers' Compensation
- Include employer information and claim number
- Document work status and restrictions
- Use WC-specific modifiers when applicable`;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        Billing Rules Configuration
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Your custom billing rules will be appended to the standard billing rules used by all clinics. 
          These rules help the AI generate more accurate billing codes specific to your practice.
        </Typography>
      </Alert>

      <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Custom Billing Rules
          </Typography>
          <Tooltip title="Copy example rules to clipboard">
            <IconButton
              onClick={() => {
                navigator.clipboard.writeText(exampleRules);
                alert('Example rules copied to clipboard!');
              }}
              size="small"
              sx={{ mr: 1 }}
            >
              <CopyIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="View example rules">
            <IconButton
              onClick={() => alert(exampleRules)}
              size="small"
            >
              <InfoIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add your clinic-specific billing rules, specialty considerations, or local insurance requirements below.
          These will be used in addition to the standard billing rules.
        </Typography>

        <TextField
          multiline
          rows={15}
          fullWidth
          variant="outlined"
          placeholder={`Enter your custom billing rules here. For example:

## [Your Specialty] Specific Rules
- Special billing considerations for your practice
- Insurance-specific requirements
- Local billing guidelines
- Frequently used procedure codes and their requirements`}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          disabled={settingsLoading || isSaving}
          sx={{ 
            fontFamily: 'monospace',
            fontSize: '0.9rem',
            '& .MuiInputBase-input': {
              fontFamily: 'monospace',
            }
          }}
        />
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          {saveStatus === 'success' && (
            <Alert severity="success" sx={{ display: 'inline-flex' }}>
              Billing rules saved successfully!
            </Alert>
          )}
          {saveStatus === 'error' && (
            <Alert severity="error" sx={{ display: 'inline-flex' }}>
              Failed to save billing rules. Please try again.
            </Alert>
          )}
        </Box>
        
        <Button
          variant="contained"
          color="primary"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={settingsLoading || isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Billing Rules'}
        </Button>
      </Box>

      <Divider sx={{ my: 4 }} />

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          About Billing Rules
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          The billing generation system uses a comprehensive set of base rules that include:
        </Typography>
        <ul style={{ marginLeft: 20, color: 'rgba(0, 0, 0, 0.6)' }}>
          <li>CPT code selection guidelines for office visits</li>
          <li>Time-based billing calculations</li>
          <li>Modifier usage rules</li>
          <li>ICD-10 diagnosis code requirements</li>
          <li>Documentation requirements for reimbursement</li>
          <li>Insurance-specific considerations</li>
        </ul>
        <Typography variant="body2" color="text.secondary" paragraph sx={{ mt: 2 }}>
          Your custom rules supplement these base rules to handle specialty-specific scenarios, 
          local requirements, or unique billing situations in your practice.
        </Typography>
      </Box>
    </Box>
  );
}

export default BillingRulesTab;