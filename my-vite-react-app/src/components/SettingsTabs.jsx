import NoteStructureTab from './NoteStructureTab';
import NarrativeTemplatesTab from './NarrativeTemplatesTab';
import MacroPhrasesTab from './MacroPhrasesTab';
import CustomVocabularyTab from './CustomVocabularyTab';
import TranscriptionProfilesTab from './TranscriptionProfilesTab';

function SettingsTabs({ tabValue, transcriptionProfiles, addTranscriptionProfile, deleteTranscriptionProfile }) { 
  return (
    <>
      {tabValue === 0 && <NoteStructureTab />}
      {tabValue === 1 && <NarrativeTemplatesTab addTranscriptionProfile={addTranscriptionProfile} />} 
      {tabValue === 2 && <MacroPhrasesTab />}
      {tabValue === 3 && <CustomVocabularyTab />}
      {tabValue === 4 && <TranscriptionProfilesTab transcriptionProfiles={transcriptionProfiles} deleteTranscriptionProfile={deleteTranscriptionProfile} />} 
    </>
  );
}

export default SettingsTabs;
