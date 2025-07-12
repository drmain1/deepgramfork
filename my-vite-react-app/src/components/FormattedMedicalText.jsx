import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Divider } from '@mui/material';

const FormattedMedicalText = ({ content, sx = {}, ...props }) => {
  if (!content) {
    return (
      <Typography variant="body2" color="text.secondary" sx={sx} {...props}>
        No content available
      </Typography>
    );
  }

  // Check if content is structured JSON
  let structuredData = null;
  let textContent = content;
  
  if (typeof content === 'string') {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(content);
      if (parsed.patient_info && parsed.sections) {
        structuredData = parsed;
      }
    } catch (e) {
      // Not JSON, treat as regular text
    }
  } else if (typeof content === 'object' && content.patient_info && content.sections) {
    // Already parsed JSON
    structuredData = content;
  }

  // If we have structured data, render it nicely
  if (structuredData) {
    return (
      <Box sx={{ ...sx, fontFamily: 'Arial, sans-serif' }} {...props} data-formatted-medical-text>
        {/* Header with patient info */}
        {structuredData.clinic_info && (
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {structuredData.clinic_info.name}
            </Typography>
            {structuredData.clinic_info.address && (
              <Typography variant="body2">{structuredData.clinic_info.address}</Typography>
            )}
            {(structuredData.clinic_info.phone || structuredData.clinic_info.fax) && (
              <Typography variant="body2">
                {structuredData.clinic_info.phone && `Tel: ${structuredData.clinic_info.phone}`}
                {structuredData.clinic_info.phone && structuredData.clinic_info.fax && ' | '}
                {structuredData.clinic_info.fax && `Fax: ${structuredData.clinic_info.fax}`}
              </Typography>
            )}
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Patient Information */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            COMPREHENSIVE PAIN MANAGEMENT EVALUATION
          </Typography>
          <Typography>Patient Name: {structuredData.patient_info.patient_name}</Typography>
          {structuredData.patient_info.date_of_birth && (
            <Typography>Date of Birth: {structuredData.patient_info.date_of_birth}</Typography>
          )}
          {structuredData.patient_info.date_of_accident && (
            <Typography>Date of Accident: {structuredData.patient_info.date_of_accident}</Typography>
          )}
          {structuredData.patient_info.date_of_treatment && (
            <Typography>Date of Consultation: {structuredData.patient_info.date_of_treatment}</Typography>
          )}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Render sections (excluding assessment, plan, treatment_performed_today, and diagnostic_imaging_review - they'll be rendered in specific order) */}
        {Object.entries(structuredData.sections).map(([key, value]) => {
          if (!value || value === 'null' || 
              key === 'assessment' || 
              key === 'plan' || 
              key === 'treatment_performed_today' ||
              key === 'diagnostic_imaging_review') return null;
          
          const sectionTitle = key
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          
          return (
            <Box key={key} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                {sectionTitle.toUpperCase()}:
              </Typography>
              <Typography sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
                {value}
              </Typography>
            </Box>
          );
        })}

        {/* Motor Examination Table */}
        {structuredData.motor_exam && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              NEUROLOGIC ASSESSMENT: MOTOR EXAMINATION
            </Typography>
            
            {structuredData.motor_exam.upper_extremity && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Upper Extremity
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    {(() => {
                      // Check if this is a re-evaluation by looking for pipe characters
                      const isReEval = structuredData.motor_exam.upper_extremity.some(exam => 
                        (exam.right && exam.right.includes('|')) || (exam.left && exam.left.includes('|'))
                      );
                      
                      if (isReEval) {
                        return (
                          <>
                            <TableHead>
                              <TableRow>
                                <TableCell>MUSCLE GROUP</TableCell>
                                <TableCell align="center" colSpan={2}>RIGHT</TableCell>
                                <TableCell align="center" colSpan={2}>LEFT</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell></TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Previous</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Current</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Previous</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Current</TableCell>
                              </TableRow>
                            </TableHead>
                          </>
                        );
                      } else {
                        return (
                          <TableHead>
                            <TableRow>
                              <TableCell>MUSCLE GROUP</TableCell>
                              <TableCell align="center">RIGHT</TableCell>
                              <TableCell align="center">LEFT</TableCell>
                            </TableRow>
                          </TableHead>
                        );
                      }
                    })()}
                    <TableBody>
                      {structuredData.motor_exam.upper_extremity.map((exam, idx) => {
                        // Check if this is a re-evaluation
                        const isReEval = (exam.right && exam.right.includes('|')) || (exam.left && exam.left.includes('|'));
                        
                        if (isReEval) {
                          // Parse for re-evaluation format
                          let rightPrev = 'Not performed';
                          let rightCurr = 'Not performed';
                          if (exam.right && exam.right.includes('|')) {
                            const parts = exam.right.split('|');
                            rightPrev = parts[0].replace('Previously', '').trim();
                            rightCurr = parts[1].replace('Currently', '').trim();
                          }
                          
                          let leftPrev = 'Not performed';
                          let leftCurr = 'Not performed';
                          if (exam.left && exam.left.includes('|')) {
                            const parts = exam.left.split('|');
                            leftPrev = parts[0].replace('Previously', '').trim();
                            leftCurr = parts[1].replace('Currently', '').trim();
                          }
                          
                          return (
                            <TableRow key={idx}>
                              <TableCell>{exam.muscle}</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                {rightPrev}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                                {rightCurr}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                {leftPrev}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                                {leftCurr}
                              </TableCell>
                            </TableRow>
                          );
                        } else {
                          // Initial evaluation format - simple values only
                          return (
                            <TableRow key={idx}>
                              <TableCell>{exam.muscle}</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>
                                {exam.right || 'Not performed'}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>
                                {exam.left || 'Not performed'}
                              </TableCell>
                            </TableRow>
                          );
                        }
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {structuredData.motor_exam.lower_extremity && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Lower Extremity
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    {(() => {
                      // Check if this is a re-evaluation by looking for pipe characters
                      const isReEval = structuredData.motor_exam.lower_extremity.some(exam => 
                        (exam.right && exam.right.includes('|')) || (exam.left && exam.left.includes('|'))
                      );
                      
                      if (isReEval) {
                        return (
                          <>
                            <TableHead>
                              <TableRow>
                                <TableCell>MUSCLE GROUP</TableCell>
                                <TableCell align="center" colSpan={2}>RIGHT</TableCell>
                                <TableCell align="center" colSpan={2}>LEFT</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell></TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Previous</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Current</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Previous</TableCell>
                                <TableCell align="center" sx={{ fontSize: '0.75rem' }}>Current</TableCell>
                              </TableRow>
                            </TableHead>
                          </>
                        );
                      } else {
                        return (
                          <TableHead>
                            <TableRow>
                              <TableCell>MUSCLE GROUP</TableCell>
                              <TableCell align="center">RIGHT</TableCell>
                              <TableCell align="center">LEFT</TableCell>
                            </TableRow>
                          </TableHead>
                        );
                      }
                    })()}
                    <TableBody>
                      {structuredData.motor_exam.lower_extremity.map((exam, idx) => {
                        // Check if this is a re-evaluation
                        const isReEval = (exam.right && exam.right.includes('|')) || (exam.left && exam.left.includes('|'));
                        
                        if (isReEval) {
                          // Parse for re-evaluation format
                          let rightPrev = 'Not performed';
                          let rightCurr = 'Not performed';
                          if (exam.right && exam.right.includes('|')) {
                            const parts = exam.right.split('|');
                            rightPrev = parts[0].replace('Previously', '').trim();
                            rightCurr = parts[1].replace('Currently', '').trim();
                          }
                          
                          let leftPrev = 'Not performed';
                          let leftCurr = 'Not performed';
                          if (exam.left && exam.left.includes('|')) {
                            const parts = exam.left.split('|');
                            leftPrev = parts[0].replace('Previously', '').trim();
                            leftCurr = parts[1].replace('Currently', '').trim();
                          }
                          
                          return (
                            <TableRow key={idx}>
                              <TableCell>{exam.muscle}</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                {rightPrev}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                                {rightCurr}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                                {leftPrev}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                                {leftCurr}
                              </TableCell>
                            </TableRow>
                          );
                        } else {
                          // Initial evaluation format - simple values only
                          return (
                            <TableRow key={idx}>
                              <TableCell>{exam.muscle}</TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>
                                {exam.right || 'Not performed'}
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: '0.875rem' }}>
                                {exam.left || 'Not performed'}
                              </TableCell>
                            </TableRow>
                          );
                        }
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        )}

        {/* Reflexes Table */}
        {structuredData.reflexes && (
          <Box sx={{ mb: 3 }}>
            {structuredData.reflexes.deep_tendon && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Deep Tendon Reflexes:
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>REFLEX</TableCell>
                        <TableCell align="center">RIGHT</TableCell>
                        <TableCell align="center">LEFT</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {structuredData.reflexes.deep_tendon.map((reflex, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{reflex.reflex}</TableCell>
                          <TableCell align="center">{reflex.right}</TableCell>
                          <TableCell align="center">{reflex.left}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}

            {structuredData.reflexes.pathological && (
              <>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                  Pathological Reflexes:
                </Typography>
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>REFLEX</TableCell>
                        <TableCell align="center">RIGHT</TableCell>
                        <TableCell align="center">LEFT</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {structuredData.reflexes.pathological.map((reflex, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{reflex.reflex}</TableCell>
                          <TableCell align="center">{reflex.right}</TableCell>
                          <TableCell align="center">{reflex.left}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </Box>
        )}

        {/* Cranial Nerve Examination */}
        {structuredData.cranial_nerve_examination && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
              CRANIAL NERVE EXAMINATION
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>CRANIAL NERVE</TableCell>
                    <TableCell align="center">FINDING</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {structuredData.cranial_nerve_examination.map((nerve, idx) => {
                    // Check if this is a re-evaluation with comparison format
                    const isReEval = nerve.finding && nerve.finding.includes('|');
                    
                    if (isReEval) {
                      // Parse re-evaluation format
                      const parts = nerve.finding.split('|');
                      const previous = parts[0].replace('Previously', '').trim();
                      const current = parts[1].replace('currently', '').trim();
                      
                      return (
                        <TableRow key={idx}>
                          <TableCell>{nerve.nerve || nerve['cranial nerve']}</TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                Previous: {previous}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                                Current: {current}
                              </Typography>
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      // Initial evaluation format
                      return (
                        <TableRow key={idx}>
                          <TableCell>{nerve.nerve || nerve['cranial nerve']}</TableCell>
                          <TableCell align="center">{nerve.finding || 'Not tested'}</TableCell>
                        </TableRow>
                      );
                    }
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Diagnostic Imaging Review */}
        {structuredData.sections?.diagnostic_imaging_review && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              DIAGNOSTIC IMAGING REVIEW:
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
              {structuredData.sections.diagnostic_imaging_review}
            </Typography>
          </Box>
        )}

        {/* Assessment - after all examination tables */}
        {structuredData.sections?.assessment && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              ASSESSMENT:
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
              {structuredData.sections.assessment}
            </Typography>
          </Box>
        )}

        {/* Plan - after assessment */}
        {structuredData.sections?.plan && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              PLAN:
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
              {structuredData.sections.plan}
            </Typography>
          </Box>
        )}

        {/* Treatment Performed Today - after plan */}
        {structuredData.sections?.treatment_performed_today && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              TREATMENT PERFORMED TODAY:
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', pl: 2 }}>
              {structuredData.sections.treatment_performed_today}
            </Typography>
          </Box>
        )}

        {/* Provider signature if available */}
        {structuredData.patient_info.provider && (
          <Box sx={{ mt: 4 }}>
            <Typography>Electronically signed by:</Typography>
            <Typography sx={{ fontWeight: 'bold' }}>
              {structuredData.patient_info.provider}
            </Typography>
          </Box>
        )}
      </Box>
    );
  }

  // Original markdown formatting code for non-structured content
  const formatMedicalText = (text) => {
    // Split text into lines
    const lines = text.split('\n');
    const formattedElements = [];

    // Function to detect if a group of lines forms a table
    const detectTable = (startIndex) => {
      const tableLines = [];
      let currentIndex = startIndex;
      
      // Look for lines that contain | characters (potential table rows)
      while (currentIndex < lines.length) {
        const line = lines[currentIndex].trim();
        
        // Skip empty lines at the start
        if (line === '' && tableLines.length === 0) {
          currentIndex++;
          continue;
        }
        
        // If we hit an empty line after finding table content, end the table
        if (line === '' && tableLines.length > 0) {
          break;
        }
        
        // Check if line looks like a table row (contains |)
        if (line.includes('|')) {
          tableLines.push(line);
          currentIndex++;
        } else {
          // If we have table content and hit a non-table line, end the table
          if (tableLines.length > 0) {
            break;
          } else {
            // Not a table, return null
            return null;
          }
        }
      }
      
      // Need at least 2 lines to make a table (header + data or separator + data)
      if (tableLines.length < 2) {
        return null;
      }
      
      return {
        lines: tableLines,
        endIndex: currentIndex - 1
      };
    };

    // Function to parse table lines into structured data
    const parseTable = (tableLines) => {
      const rows = [];
      let headerRow = null;
      
      tableLines.forEach((line, index) => {
        // Skip separator lines (lines with mostly dashes and |)
        if (/^[\s\-|]+$/.test(line)) {
          return;
        }
        
        // Split by | and clean up cells
        const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell !== '');
        
        if (cells.length > 0) {
          if (headerRow === null && index < tableLines.length / 2) {
            // First non-separator row is likely the header
            headerRow = cells;
          } else {
            rows.push(cells);
          }
        }
      });
      
      return { header: headerRow, rows };
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if this starts a table
      const tableData = detectTable(i);
      if (tableData) {
        const { header, rows } = parseTable(tableData.lines);
        
        if (header && rows.length > 0) {
          formattedElements.push(
            <TableContainer key={`table-${i}`} component={Paper} sx={{ my: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {header.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} align={cellIndex > 0 ? 'center' : 'left'}>
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <TableCell key={cellIndex} align={cellIndex > 0 ? 'center' : 'left'}>
                          {cell}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          );
        }
        
        i = tableData.endIndex + 1;
        continue;
      }

      // Check for headers (lines that are all caps or end with ':')
      if ((trimmedLine.match(/^[A-Z\s]+:?$/) && trimmedLine.length > 3) || 
          (trimmedLine.endsWith(':') && !trimmedLine.startsWith('  '))) {
        formattedElements.push(
          <Typography key={`header-${i}`} variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2, mb: 1 }}>
            {trimmedLine}
          </Typography>
        );
      }
      // Check for bulleted lists
      else if (trimmedLine.match(/^[•\-\*]\s+/)) {
        const bulletPoints = [];
        while (i < lines.length && lines[i].trim().match(/^[•\-\*]\s+/)) {
          bulletPoints.push(
            <Typography key={`bullet-${i}`} sx={{ pl: 2, mb: 0.5 }}>
              {lines[i].trim()}
            </Typography>
          );
          i++;
        }
        formattedElements.push(
          <Box key={`list-${i}`} sx={{ mb: 1 }}>
            {bulletPoints}
          </Box>
        );
        continue;
      }
      // Check for numbered lists
      else if (trimmedLine.match(/^\d+\.\s+/)) {
        const numberedPoints = [];
        while (i < lines.length && lines[i].trim().match(/^\d+\.\s+/)) {
          numberedPoints.push(
            <Typography key={`number-${i}`} sx={{ pl: 2, mb: 0.5 }}>
              {lines[i].trim()}
            </Typography>
          );
          i++;
        }
        formattedElements.push(
          <Box key={`numlist-${i}`} sx={{ mb: 1 }}>
            {numberedPoints}
          </Box>
        );
        continue;
      }
      // Regular paragraph
      else if (trimmedLine.length > 0) {
        // Collect consecutive non-empty lines as a paragraph
        const paragraphLines = [];
        while (i < lines.length && lines[i].trim().length > 0 && 
               !lines[i].trim().match(/^[A-Z\s]+:?$/) &&
               !lines[i].trim().match(/^[•\-\*\d]\s+/)) {
          paragraphLines.push(lines[i]);
          i++;
        }
        
        if (paragraphLines.length > 0) {
          formattedElements.push(
            <Typography key={`para-${i}`} sx={{ mb: 1.5, lineHeight: 1.6 }}>
              {paragraphLines.join(' ')}
            </Typography>
          );
        }
        continue;
      }
      
      i++;
    }

    return formattedElements;
  };

  return (
    <Box sx={{ ...sx, fontFamily: 'Arial, sans-serif' }} {...props} data-formatted-medical-text>
      {formatMedicalText(textContent)}
    </Box>
  );
};

export default FormattedMedicalText;