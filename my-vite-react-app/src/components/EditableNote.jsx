import React, { useState, useEffect, useRef } from 'react';
import { TextField, Button, Box, IconButton, Tooltip, Snackbar, Alert, CircularProgress } from '@mui/material';
import { ContentCopy, Check, Edit as EditIcon, Save as SaveIcon } from '@mui/icons-material';
import { generatePdfFromText } from './pdfUtils';
import FormattedMedicalText from './FormattedMedicalText';
import { useUserSettings } from '../contexts/UserSettingsContext';

function EditableNote({ 
  content, 
  onSave, 
  isLoading, 
  location,
  recordingId,
  isEditingExternal,
  onEditingChange,
  isSigned = false,
  doctorName = "",
  doctorSignature = ""
}) {
  // Debug logging for location
  console.log("EditableNote - location prop:", location);
  console.log("EditableNote - recordingId:", recordingId);
  console.log("EditableNote - isSigned:", isSigned);
  const [editableContent, setEditableContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [lastSyncedContent, setLastSyncedContent] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);
  const isInitialMount = useRef(true);
  
  // Get user settings for logo
  const { userSettings } = useUserSettings();

  // Initialize content when it changes from outside (only if not editing)
  useEffect(() => {
    if (content !== null && content !== lastSyncedContent && !isEditing) {
      const newContent = content || "";
      setEditableContent(newContent);
      setLastSyncedContent(newContent);
    }
  }, [content, lastSyncedContent, isEditing]);

  // Sync external editing state
  useEffect(() => {
    if (isEditingExternal !== undefined && isEditingExternal !== isEditing) {
      setIsEditing(isEditingExternal);
    }
  }, [isEditingExternal]);

  // Handle external editing state changes
  useEffect(() => {
    if (onEditingChange && !isInitialMount.current) {
      onEditingChange(isEditing);
    }
    isInitialMount.current = false;
  }, [isEditing, onEditingChange]);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (onSave) {
      setIsSaving(true);
      setSaveError('');
      try {
        await onSave(editableContent);
        setLastSyncedContent(editableContent);
        setIsEditing(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } catch (error) {
        setSaveError('Failed to save changes. Please try again.');
        console.error('Save error:', error);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditableContent(lastSyncedContent);
    setIsEditing(false);
  };

  const handleContentChange = (e) => {
    setEditableContent(e.target.value);
  };

  const handleQuickPdf = () => {
    const pdfOptions = {
      doctorName,
      doctorSignature,
      isSigned,
      clinicLogo: userSettings.clinicLogo,
      includeLogoOnPdf: userSettings.includeLogoOnPdf,
      useProfessionalFormat: true, // Use professional format for better layout
      usePagedFormat: true // Use paged format for best results
    };
    generatePdfFromText(
      editableContent, 
      `polished-note-${recordingId || 'current'}.pdf`, 
      location,
      pdfOptions
    );
  };

  const handleCopyToClipboard = async () => {
    try {
      // Find the FormattedMedicalText component in the DOM
      const formattedTextElement = document.querySelector('[data-formatted-medical-text]');
      
      if (formattedTextElement) {
        // Copy the formatted content directly from the rendered component
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(formattedTextElement);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Try modern clipboard API first
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            // Get the HTML content
            const htmlContent = formattedTextElement.innerHTML;
            
            // Create clipboard item with both HTML and text
            const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
            const textBlob = new Blob([formattedTextElement.innerText], { type: 'text/plain' });
            
            const clipboardItem = new ClipboardItem({
              'text/html': htmlBlob,
              'text/plain': textBlob
            });
            
            await navigator.clipboard.write([clipboardItem]);
          } catch (clipboardError) {
            // Fallback to execCommand
            document.execCommand('copy');
          }
        } else {
          // Fallback for older browsers
          document.execCommand('copy');
        }
        
        selection.removeAllRanges();
      } else {
        // Fallback to plain text if formatted element not found
        await navigator.clipboard.writeText(editableContent);
      }
      
      setCopySuccess(true);
      setShowCopyFeedback(true);
      
      // Reset the success state after a short delay
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy formatted text: ', err);
      // Final fallback - copy plain text
      try {
        await navigator.clipboard.writeText(editableContent);
        setCopySuccess(true);
        setShowCopyFeedback(true);
        setTimeout(() => {
          setCopySuccess(false);
        }, 2000);
      } catch (fallbackErr) {
        console.error('All copy methods failed: ', fallbackErr);
      }
    }
  };

  const handleCloseCopyFeedback = () => {
    setShowCopyFeedback(false);
  };

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      minHeight: 0 
    }}>
      {isEditing ? (
        <TextField
          multiline
          fullWidth
          variant="outlined"
          value={editableContent}
          onChange={handleContentChange}
          InputProps={{
            readOnly: false,
          }}
          placeholder="Edit polished note..."
          sx={{
            flexGrow: 1,
            height: '100%',
            minHeight: 0,
            '& .MuiOutlinedInput-root': {
              height: '100%',
              padding: 0,
              display: 'flex',
              border: '2px solid',
              borderColor: 'primary.main',
              '&:hover': {
                borderColor: 'primary.dark',
              },
              '& textarea.MuiOutlinedInput-input': {
                padding: '12px',
                height: '100% !important',
                boxSizing: 'border-box',
                overflowY: 'auto !important',
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'text.primary',
                backgroundColor: 'background.paper',
                resize: 'none',
                minHeight: 0,
                flex: 1
              },
              '& textarea.MuiOutlinedInput-input::placeholder': {
                color: 'text.secondary',
                opacity: 1,
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                lineHeight: 1.6,
              }
            }
          }}
        />
      ) : (
        <Box sx={{ 
          position: 'relative',
          flexGrow: 1,
          height: '100%',
          minHeight: 0
        }}>
          <FormattedMedicalText
            content={editableContent || "Edit polished note..."}
            sx={{
              flexGrow: 1,
              height: '100%',
              minHeight: 0,
              padding: '12px',
              backgroundColor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              overflowY: 'auto'
            }}
            data-formatted-medical-text="true"
          />
          
          {/* Copy to Clipboard Button */}
          {editableContent && (
            <Tooltip title={copySuccess ? "Copied!" : "Copy to clipboard"}>
              <IconButton
                onClick={handleCopyToClipboard}
                sx={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  backgroundColor: 'white',
                  boxShadow: 1,
                  '&:hover': {
                    backgroundColor: 'grey.100',
                  },
                  zIndex: 1,
                  width: 32,
                  height: 32
                }}
                size="small"
              >
                {copySuccess ? (
                  <Check sx={{ fontSize: 16, color: 'success.main' }} />
                ) : (
                  <ContentCopy sx={{ fontSize: 16 }} />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
      <Box sx={{ p: 1, mt: 1, flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {/* Editing indicator */}
        {isEditing && (
          <Alert severity="info" sx={{ py: 0.5, px: 2 }}>
            Editing mode - Changes will be saved when you click Save
          </Alert>
        )}
        {!isEditing && <Box />}
        
        {/* Action buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isEditing ? (
            <>
              <Button
                variant="outlined"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSave}
                disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </>
          ) : (
            <Button
              variant="contained"
              color="primary"
              onClick={handleEdit}
              disabled={isLoading}
              startIcon={<EditIcon />}
            >
              Edit Note
            </Button>
          )}
          {(content || editableContent) && !isEditing && (
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleQuickPdf}
              disabled={isLoading}
            >
              Generate PDF
            </Button>
          )}
        </Box>
      </Box>
      
      {/* Copy Success Feedback */}
      <Snackbar
        open={showCopyFeedback}
        autoHideDuration={2000}
        onClose={handleCloseCopyFeedback}
        message="Copied to clipboard!"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
      
      <Snackbar
        open={saveSuccess}
        autoHideDuration={3000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveSuccess(false)} severity="success" sx={{ width: '100%' }}>
          Changes saved successfully!
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!saveError}
        autoHideDuration={5000}
        onClose={() => setSaveError('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSaveError('')} severity="error" sx={{ width: '100%' }}>
          {saveError}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default EditableNote; 