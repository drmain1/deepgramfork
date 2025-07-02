/**
 * Custom hook for managing transcript selection state
 */

import { useState } from 'react';

export function useTranscriptSelection(transcripts) {
  const [selectedTranscripts, setSelectedTranscripts] = useState(new Set());

  const handleSelectAll = () => {
    if (selectedTranscripts.size === transcripts.length) {
      setSelectedTranscripts(new Set());
    } else {
      setSelectedTranscripts(new Set(transcripts.map(t => t.id)));
    }
  };

  const handleSelectTranscript = (transcriptId) => {
    const newSelected = new Set(selectedTranscripts);
    if (newSelected.has(transcriptId)) {
      newSelected.delete(transcriptId);
    } else {
      newSelected.add(transcriptId);
    }
    setSelectedTranscripts(newSelected);
  };

  const clearSelection = () => {
    setSelectedTranscripts(new Set());
  };

  const getSelectedTranscriptObjects = () => {
    return transcripts.filter(t => selectedTranscripts.has(t.id));
  };

  return {
    selectedTranscripts,
    handleSelectAll,
    handleSelectTranscript,
    clearSelection,
    getSelectedTranscriptObjects,
    hasSelection: selectedTranscripts.size > 0,
    isAllSelected: transcripts.length > 0 && selectedTranscripts.size === transcripts.length,
    isPartiallySelected: selectedTranscripts.size > 0 && selectedTranscripts.size < transcripts.length
  };
}