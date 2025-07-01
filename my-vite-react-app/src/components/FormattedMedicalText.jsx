import React from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

const FormattedMedicalText = ({ content, sx = {}, ...props }) => {
  if (!content) {
    return (
      <Typography variant="body2" color="text.secondary" sx={sx} {...props}>
        No content available
      </Typography>
    );
  }

  // Ensure content is a string
  let textContent = content;
  if (typeof content !== 'string') {
    console.warn('FormattedMedicalText received non-string content:', content);
    // Try to convert to string
    if (typeof content === 'object') {
      textContent = JSON.stringify(content, null, 2);
    } else {
      textContent = String(content);
    }
  }

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

    // Function to render a table
    const renderTable = (tableData, index) => {
      const { header, rows } = tableData;
      
      return (
        <TableContainer component={Paper} key={`table-${index}`} sx={{ my: 2, maxWidth: '100%' }}>
          <Table size="small" sx={{ minWidth: 300 }}>
            {header && (
              <TableHead>
                <TableRow>
                  {header.map((cell, cellIndex) => (
                    <TableCell 
                      key={cellIndex}
                      sx={{ 
                        fontWeight: 'bold',
                        backgroundColor: 'grey.100',
                        fontFamily: 'monospace',
                        fontSize: '0.9rem'
                      }}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
            )}
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell 
                      key={cellIndex}
                      sx={{ 
                        fontFamily: 'monospace',
                        fontSize: '0.9rem',
                        padding: '8px 12px'
                      }}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      );
    };

    // Function to parse inline markdown formatting
    const parseInlineFormatting = (text) => {
      const parts = [];
      let lastIndex = 0;
      const boldPattern = /\*\*(.*?)\*\*/g;
      let match;

      while ((match = boldPattern.exec(text)) !== null) {
        // Add text before the bold part
        if (match.index > lastIndex) {
          parts.push(
            <Typography
              component="span"
              key={`text-${lastIndex}`}
              sx={{ 
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                color: 'text.primary'
              }}
            >
              {text.slice(lastIndex, match.index)}
            </Typography>
          );
        }

        // Add the bold part
        parts.push(
          <Typography
            component="span"
            key={`bold-${match.index}`}
            sx={{ 
              fontWeight: 'bold',
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              lineHeight: 1.6,
              color: 'text.primary'
            }}
          >
            {match[1]}
          </Typography>
        );

        lastIndex = match.index + match[0].length;
      }

      // Add remaining text
      if (lastIndex < text.length) {
        parts.push(
          <Typography
            component="span"
            key={`text-${lastIndex}`}
            sx={{ 
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              lineHeight: 1.6,
              color: 'text.primary'
            }}
          >
            {text.slice(lastIndex)}
          </Typography>
        );
      }

      return parts.length > 0 ? parts : [
        <Typography
          component="span"
          key="text-full"
          sx={{ 
            fontFamily: 'monospace',
            fontSize: '1.1rem',
            lineHeight: 1.6,
            color: 'text.primary'
          }}
        >
          {text}
        </Typography>
      ];
    };

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // Check for table at current position
      const tableResult = detectTable(i);
      if (tableResult) {
        const tableData = parseTable(tableResult.lines);
        if (tableData.header || tableData.rows.length > 0) {
          formattedElements.push(renderTable(tableData, i));
          i = tableResult.endIndex + 1;
          continue;
        }
      }

      // Regular line processing
      // Check for markdown-style headers (**HEADER:**)
      const markdownHeaderPattern = /^\*\*([A-Z][A-Z\s&,()/-]*:)\*\*\s*(.*)/;
      // Check if line is a medical header (all caps ending with colon, or common medical headers)
      const headerPattern = /^([A-Z][A-Z\s&,()/-]*:)\s*(.*)/;
      // Check for numbered lists (1., 2., etc.)
      const numberedListPattern = /^(\s*)(\d+\.\s+)(.*)/;
      // Check for bullet points (-, •, *, etc.)
      const bulletPattern = /^(\s*)([-•*]\s+)(.*)/;
      // Check for common medical section headers (may not be all caps)
      const sectionHeaderPattern = /^(Chief Complaint|History of Present Illness|Past Medical History|Current Medications|Past Surgical History|Family History|Social History|Allergies|Review of Systems|Physical Examination|Assessment|Plan|Impression|Recommendations):\s*(.*)/i;
      
      const markdownMatch = line.match(markdownHeaderPattern);
      const headerMatch = line.match(headerPattern);
      const sectionMatch = line.match(sectionHeaderPattern);
      const numberedMatch = line.match(numberedListPattern);
      const bulletMatch = line.match(bulletPattern);

      if (markdownMatch || headerMatch || sectionMatch) {
        const match = markdownMatch || headerMatch || sectionMatch;
        const [, header, content] = match;
        formattedElements.push(
          <React.Fragment key={i}>
            <Typography
              component="span"
              sx={{ 
                fontWeight: 'bold', 
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                color: 'text.primary'
              }}
            >
              {header}{(headerMatch && !markdownMatch) ? '' : ''}
            </Typography>
            {content && (
              <Typography
                component="span"
                sx={{ 
                  fontFamily: 'monospace',
                  fontSize: '1.1rem',
                  lineHeight: 1.6,
                  color: 'text.primary',
                  marginLeft: '0.5ch'
                }}
              >
                {content}
              </Typography>
            )}
            <br />
          </React.Fragment>
        );
      } else if (numberedMatch) {
        const [, indent, number, content] = numberedMatch;
        formattedElements.push(
          <React.Fragment key={i}>
            <Typography
              component="span"
              sx={{ 
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                color: 'text.primary',
                marginLeft: indent ? `${indent.length * 0.5}ch` : 0
              }}
            >
              {indent}
            </Typography>
            <Typography
              component="span"
              sx={{ 
                fontWeight: 'bold',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                color: 'text.primary'
              }}
            >
              {number}
            </Typography>
            {parseInlineFormatting(content)}
            <br />
          </React.Fragment>
        );
      } else if (bulletMatch) {
        const [, indent, bullet, content] = bulletMatch;
        formattedElements.push(
          <React.Fragment key={i}>
            <Typography
              component="span"
              sx={{ 
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                color: 'text.primary',
                marginLeft: indent ? `${indent.length * 0.5}ch` : 0
              }}
            >
              {indent}
            </Typography>
            <Typography
              component="span"
              sx={{ 
                fontWeight: 'bold',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                color: 'text.primary'
              }}
            >
              {bullet}
            </Typography>
            {parseInlineFormatting(content)}
            <br />
          </React.Fragment>
        );
      } else if (line.trim() === '') {
        // Empty line - add spacing
        formattedElements.push(<br key={i} />);
      } else {
        // Regular content line - parse for inline formatting
        formattedElements.push(
          <React.Fragment key={i}>
            {parseInlineFormatting(line)}
            <br />
          </React.Fragment>
        );
      }
      
      i++;
    }

    return formattedElements;
  };

  return (
    <Box
      sx={{
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...sx
      }}
      {...props}
    >
      {formatMedicalText(textContent)}
    </Box>
  );
};

export default FormattedMedicalText; 