import { useState, useEffect } from 'react';
import { 
  TextField, 
  Button, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Typography,
  InputAdornment,
  CircularProgress,
  Alert
} from '@mui/material';
import { CPT_DESCRIPTIONS } from '../utils/billingFormatter';

function CPTFeesTab({ cptFees, saveCptFees, settingsLoading }) {
  const [localFees, setLocalFees] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' });

  useEffect(() => {
    // Initialize with user's custom fees or empty values
    const initialFees = {};
    // Initialize all CPT codes with empty string or user's value
    Object.keys(CPT_DESCRIPTIONS).forEach(code => {
      initialFees[code] = '';
    });
    
    if (cptFees && typeof cptFees === 'object') {
      Object.keys(cptFees).forEach(code => {
        if (code in CPT_DESCRIPTIONS) {
          initialFees[code] = cptFees[code].toString();
        }
      });
    }
    setLocalFees(initialFees);
  }, [cptFees]);

  const handleFeeChange = (code, value) => {
    // Allow empty string for editing, but validate on blur
    if (value === '' || (!isNaN(value) && parseFloat(value) >= 0)) {
      setLocalFees(prev => ({
        ...prev,
        [code]: value
      }));
    }
  };

  const handleFeeBlur = (code) => {
    // On blur, if not empty, ensure it's stored as a number with 2 decimal places
    const currentValue = localFees[code];
    if (currentValue !== '' && !isNaN(currentValue)) {
      setLocalFees(prev => ({
        ...prev,
        [code]: parseFloat(currentValue).toFixed(2)
      }));
    }
  };


  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus({ type: '', message: '' });
    
    try {
      // Convert all values to numbers before saving, only save non-empty values
      const feesToSave = {};
      Object.keys(localFees).forEach(code => {
        const value = localFees[code];
        if (value !== '' && !isNaN(value)) {
          feesToSave[code] = parseFloat(value);
        }
      });
      
      await saveCptFees(feesToSave);
      setSaveStatus({ type: 'success', message: 'CPT fees saved successfully!' });
    } catch (error) {
      console.error('Error saving CPT fees:', error);
      setSaveStatus({ type: 'error', message: 'Failed to save CPT fees. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  if (settingsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <CircularProgress />
      </div>
    );
  }

  const sortedCodes = Object.keys(CPT_DESCRIPTIONS).sort();

  return (
    <div className="space-y-6">
      <div>
        <Typography variant="h5" gutterBottom>
          CPT Fee Schedule
        </Typography>
        <Typography variant="body2" color="textSecondary">
          Set your practice's fees for each CPT code. These fees will be used in billing statements.
        </Typography>
      </div>

      {saveStatus.message && (
        <Alert severity={saveStatus.type} onClose={() => setSaveStatus({ type: '', message: '' })}>
          {saveStatus.message}
        </Alert>
      )}

      <TableContainer component={Paper} elevation={2}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell><strong>CPT Code</strong></TableCell>
              <TableCell><strong>Description</strong></TableCell>
              <TableCell align="right"><strong>Fee</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedCodes.map((code) => {
              return (
                <TableRow key={code} hover>
                  <TableCell>
                    <Typography variant="body1" fontFamily="monospace">
                      {code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {CPT_DESCRIPTIONS[code]}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <TextField
                      value={localFees[code] || ''}
                      onChange={(e) => handleFeeChange(code, e.target.value)}
                      onBlur={() => handleFeeBlur(code)}
                      size="small"
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                        style: { 
                          width: '120px'
                        }
                      }}
                      type="number"
                      inputProps={{
                        min: 0,
                        step: 0.01,
                        style: { textAlign: 'right' }
                      }}
                      placeholder="0.00"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <div className="flex justify-end space-x-4">
        <Button
          variant="contained"
          color="primary"
          onClick={handleSave}
          disabled={isSaving || settingsLoading}
        >
          {isSaving ? 'Saving...' : 'Save CPT Fees'}
        </Button>
      </div>

      <Typography variant="caption" color="textSecondary" display="block" className="mt-4">
        Note: These fees are used for generating billing statements. Leave blank if you don't use a particular CPT code.
      </Typography>
    </div>
  );
}

export default CPTFeesTab;