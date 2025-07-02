import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Paper,
  Chip,
  Tooltip,
  Alert,
  Button,
  Divider,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CompareArrows as CompareIcon,
  Summarize as SummaryIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import FormattedMedicalText from './FormattedMedicalText';
import { 
  convertFindingsToMarkdown, 
  createClinicalSummary,
  generateFindingsComparison 
} from '../utils/findingsFormatter';

const PreviousFindingsEnhanced = ({ findings, onClose, isOpen, patientName }) => {
  const [activeTab, setActiveTab] = useState(0);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedSection, setCopiedSection] = useState(null);

  if (!isOpen || !findings) return null;

  const handleCopy = (text, section) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  // Process findings to get markdown content
  console.log('PreviousFindingsEnhanced - findings object:', findings);
  console.log('PreviousFindingsEnhanced - findings._markdown:', findings._markdown);
  console.log('PreviousFindingsEnhanced - typeof findings._markdown:', typeof findings._markdown);
  
  let markdownContent = '';
  
  // First, check if we have valid markdown in the _markdown field
  if (findings._markdown) {
    const trimmedContent = findings._markdown.trim();
    
    // Check if it's actual markdown (contains markdown indicators)
    if (typeof findings._markdown === 'string' && 
        (trimmedContent.includes('#') || trimmedContent.includes('*') || trimmedContent.includes('-')) &&
        !trimmedContent.startsWith('{') && !trimmedContent.startsWith('[')) {
      // This looks like valid markdown, use it
      console.log('Using pre-generated markdown from _markdown field');
      markdownContent = findings._markdown;
    } else if (typeof findings._markdown === 'string' && 
               (trimmedContent.startsWith('{') || trimmedContent.startsWith('['))) {
      // The markdown field contains JSON data
      console.log('_markdown field contains JSON, will convert to markdown');
      try {
        const parsedData = JSON.parse(findings._markdown);
        markdownContent = convertFindingsToMarkdown(parsedData);
      } catch (e) {
        console.error('Failed to parse JSON from _markdown field:', e);
        // Fall back to converting the findings object
        markdownContent = convertFindingsToMarkdown(findings);
      }
    } else if (typeof findings._markdown === 'object') {
      // The markdown field is an object, convert it
      console.log('_markdown field is an object, converting to markdown');
      markdownContent = convertFindingsToMarkdown(findings._markdown);
    } else {
      // Unknown format in _markdown, convert from findings object
      console.log('_markdown field has unexpected format, converting from findings object');
      markdownContent = convertFindingsToMarkdown(findings);
    }
  } else {
    // No _markdown field, convert from findings object
    console.log('No _markdown field found, converting from findings object');
    markdownContent = convertFindingsToMarkdown(findings);
  }
  
  // Final validation - ensure we have markdown content
  if (!markdownContent || typeof markdownContent !== 'string' || markdownContent.trim().length === 0) {
    console.warn('No valid markdown content generated, using fallback');
    markdownContent = '### Previous Evaluation Findings\n\nNo findings data could be formatted. Please check the raw data view.';
  }
  
  console.log('PreviousFindingsEnhanced - final markdownContent type:', typeof markdownContent);
  console.log('PreviousFindingsEnhanced - final markdownContent preview:', markdownContent.substring(0, 200) + '...');
  const clinicalSummary = createClinicalSummary(findings);

  return (
    <Box
      sx={{
        position: 'fixed',
        right: 0,
        top: 64,
        height: 'calc(100vh - 64px)',
        width: { xs: '100%', sm: 480, md: 520 },
        bgcolor: 'background.paper',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s ease-in-out',
        borderLeft: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'grey.50',
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Previous Findings
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Initial evaluation • {patientName || 'Patient'}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ 
            color: 'text.secondary',
            '&:hover': { bgcolor: 'grey.200' }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Clinical Summary Bar */}
      <Box 
        sx={{ 
          m: 2, 
          mb: 1,
          p: 1.5,
          bgcolor: 'info.lighter',
          border: '1px solid',
          borderColor: 'info.light',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'info.dark' }}>
            Summary
          </Typography>
          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
            {clinicalSummary}
          </Typography>
        </Box>
        <Tooltip title="Copy summary">
          <IconButton
            size="small"
            onClick={() => handleCopy(clinicalSummary, 'summary')}
            sx={{ p: 0.5 }}
          >
            <CopyIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Tab Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab 
            label="Formatted View" 
            icon={<SummaryIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
          />
          <Tab 
            label="Comparison Mode" 
            icon={<CompareIcon sx={{ fontSize: 18 }} />}
            iconPosition="start"
            sx={{ minHeight: 48 }}
            disabled // Enable when current findings are available
          />
        </Tabs>
      </Box>

      {/* Content Area */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        {activeTab === 0 && (
          <>
            {/* Action Buttons */}
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={showRawJson ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setShowRawJson(!showRawJson)}
              >
                {showRawJson ? 'Hide' : 'Show'} Raw Data
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<CopyIcon />}
                onClick={() => handleCopy(markdownContent, 'findings')}
                disabled={copiedSection === 'findings'}
              >
                {copiedSection === 'findings' ? 'Copied!' : 'Copy All'}
              </Button>
            </Box>

            {/* Main Content */}
            <Box 
              sx={{ 
                p: 2, 
                bgcolor: 'background.paper',
                borderRadius: 1,
              }}
            >
              <FormattedMedicalText content={markdownContent} />
            </Box>

            {/* Raw JSON View */}
            {showRawJson && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Raw Data (JSON)
                </Typography>
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: 'grey.900',
                    color: 'grey.100',
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    overflow: 'auto',
                    maxHeight: 400,
                  }}
                >
                  <pre style={{ margin: 0 }}>
                    {JSON.stringify(findings, null, 2)}
                  </pre>
                </Paper>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  This raw data is used for system processing and comparisons
                </Typography>
              </Box>
            )}
          </>
        )}

        {activeTab === 1 && (
          <Alert severity="info">
            Comparison mode will be available during re-evaluation recordings to show changes from this initial evaluation.
          </Alert>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
          Findings will be included in AI processing
        </Typography>
      </Box>
    </Box>
  );
};

export default PreviousFindingsEnhanced;