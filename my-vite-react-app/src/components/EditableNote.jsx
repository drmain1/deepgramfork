import React, { useState, useEffect, useRef } from 'react';
import { TextField, Button, Box } from '@mui/material';
import { generatePdfFromText } from './pdfUtils';

function EditableNote({ 
  content, 
  onSave, 
  isLoading, 
  location,
  recordingId,
  isEditingExternal,
  onEditingChange 
}) {
  const [editableContent, setEditableContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [lastSyncedContent, setLastSyncedContent] = useState('');
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

  return (
    <>
      <TextField
        multiline
        fullWidth
        variant="outlined"
        value={editableContent}
        onChange={handleContentChange}
        InputProps={{
          readOnly: !isEditing,
        }}
        placeholder="Edit polished note..."
        sx={{
          flexGrow: 1,
          '& .MuiOutlinedInput-root': {
            height: '100%',
            padding: 0,
            '& textarea.MuiOutlinedInput-input': {
              padding: '12px',
              height: '100% !important',
              boxSizing: 'border-box',
              overflowY: 'auto',
              fontFamily: 'monospace',
              fontSize: '1.1rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: 'text.primary',
              backgroundColor: 'grey.50',
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
          <Button
            variant="contained"
            color="secondary"
            onClick={() => generatePdfFromText(editableContent, `polished-note-${recordingId || 'current'}.pdf`, location)}
            disabled={isLoading}
          >
            Save as PDF
          </Button>
        )}
      </Box>
    </>
  );
}

export default EditableNote; 