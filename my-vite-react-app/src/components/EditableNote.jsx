import React, { useState, useEffect, useRef } from 'react';
import { TextField, Button, Box } from '@mui/material';
import { generatePdfFromText } from './pdfUtils';
import PdfPreviewModal from './PdfPreviewModal';
import FormattedMedicalText from './FormattedMedicalText';

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
  const [showPdfModal, setShowPdfModal] = useState(false);
  const isInitialMount = useRef(true);

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

  const handleSave = () => {
    if (onSave) {
      onSave(editableContent);
    }
    setLastSyncedContent(editableContent);
    setIsEditing(false);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleContentChange = (e) => {
    setEditableContent(e.target.value);
  };

  const handleGeneratePdf = () => {
    setShowPdfModal(true);
  };

  const handleQuickPdf = () => {
    const pdfOptions = {
      doctorName,
      doctorSignature,
      isSigned,
      useProfessionalFormat: false // Use simple format for quick PDF
    };
    generatePdfFromText(
      editableContent, 
      `polished-note-${recordingId || 'current'}.pdf`, 
      location,
      pdfOptions
    );
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
                backgroundColor: 'grey.50',
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
            overflowY: 'auto',
            cursor: 'pointer'
          }}
          onClick={handleEdit}
        />
      )}
      <Box sx={{ p: 1, mt: 1, flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        {isEditing ? (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
          >
            Save Changes
          </Button>
        ) : (
          <Button
            variant="outlined"
            onClick={handleEdit}
            disabled={isLoading}
          >
            Edit Note
          </Button>
        )}
        {(content || editableContent) && !isEditing && (
          <>
            <Button
              variant="outlined"
              color="secondary"
              onClick={handleQuickPdf}
              disabled={isLoading}
              size="small"
            >
              Quick PDF
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleGeneratePdf}
              disabled={isLoading}
            >
              Professional PDF
            </Button>
          </>
        )}
      </Box>
      
      <PdfPreviewModal
        open={showPdfModal}
        onClose={() => setShowPdfModal(false)}
        content={editableContent}
        location={location}
        recordingId={recordingId}
        doctorName={doctorName}
        doctorSignature={doctorSignature}
        isSigned={isSigned}
      />
    </Box>
  );
}

export default EditableNote; 