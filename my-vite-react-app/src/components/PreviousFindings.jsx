import React from 'react';
import { Box, Typography, Card, CardContent, Accordion, AccordionSummary, AccordionDetails, Chip, List, ListItem, ListItemText, Divider } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { format } from 'date-fns';

function PreviousFindings({ findings, evaluationDate }) {
  if (!findings) return null;

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return format(date, 'MMMM d, yyyy');
    } catch {
      return dateStr || 'Unknown date';
    }
  };

  const renderSection = (title, content, icon) => {
    if (!content || (Array.isArray(content) && content.length === 0) || (typeof content === 'object' && Object.keys(content).length === 0)) {
      return null;
    }

    return (
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box display="flex" alignItems="center" gap={1}>
            <span className="material-icons text-indigo-600">{icon}</span>
            <Typography variant="h6">{title}</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          {typeof content === 'string' ? (
            <Typography>{content}</Typography>
          ) : Array.isArray(content) ? (
            <List dense>
              {content.map((item, index) => (
                <ListItem key={index}>
                  <ListItemText primary={item} />
                </ListItem>
              ))}
            </List>
          ) : (
            <Box>
              {Object.entries(content).map(([key, value]) => (
                <Box key={key} mb={2}>
                  <Typography variant="subtitle2" color="textSecondary" gutterBottom>
                    {key.replace(/_/g, ' ').toUpperCase()}
                  </Typography>
                  {typeof value === 'object' ? (
                    <Typography variant="body2">{JSON.stringify(value, null, 2)}</Typography>
                  ) : (
                    <Typography>{value}</Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderPainLevels = (painLevels) => {
    if (!painLevels || typeof painLevels !== 'object') return null;

    return (
      <Box mt={2}>
        {Object.entries(painLevels).map(([location, level]) => (
          <Box key={location} display="flex" alignItems="center" gap={2} mb={1}>
            <Typography variant="body2" sx={{ minWidth: 120 }}>
              {location}:
            </Typography>
            <Box display="flex" alignItems="center" gap={1}>
              <Box
                sx={{
                  width: 200,
                  height: 8,
                  bgcolor: 'grey.300',
                  borderRadius: 1,
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box
                  sx={{
                    width: `${(level / 10) * 100}%`,
                    height: '100%',
                    bgcolor: level > 7 ? 'error.main' : level > 4 ? 'warning.main' : 'success.main',
                    position: 'absolute'
                  }}
                />
              </Box>
              <Chip 
                label={`${level}/10`} 
                size="small" 
                color={level > 7 ? 'error' : level > 4 ? 'warning' : 'success'}
              />
            </Box>
          </Box>
        ))}
      </Box>
    );
  };

  return (
    <Card sx={{ height: '100%', overflow: 'auto' }}>
      <CardContent>
        <Box mb={3}>
          <Typography variant="h5" gutterBottom>
            Previous Initial Evaluation
          </Typography>
          <Typography variant="subtitle1" color="textSecondary">
            {formatDate(evaluationDate)}
          </Typography>
        </Box>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {findings.chief_complaint && (
            <Card variant="outlined" sx={{ bgcolor: 'primary.50' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  Chief Complaint
                </Typography>
                <Typography>{findings.chief_complaint}</Typography>
              </CardContent>
            </Card>
          )}

          {findings.pain_levels && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Pain Levels
                </Typography>
                {renderPainLevels(findings.pain_levels)}
              </CardContent>
            </Card>
          )}

          {renderSection('Range of Motion', findings.range_of_motion, 'accessibility_new')}
          {renderSection('Positive Tests', findings.positive_tests, 'assignment_turned_in')}
          {renderSection('Palpation Findings', findings.palpation_findings, 'touch_app')}
          {renderSection('Diagnoses', findings.diagnoses, 'medical_services')}
          {renderSection('Other Findings', findings.other_findings || findings.raw_findings, 'description')}
        </Box>
      </CardContent>
    </Card>
  );
}

export default PreviousFindings;