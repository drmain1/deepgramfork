import NoteStructureTab from './NoteStructureTab';
import NarrativeTemplatesTab from './NarrativeTemplatesTab';
import MacroPhrasesTab from './MacroPhrasesTab';
import CustomVocabularyTab from './CustomVocabularyTab';
import TranscriptionProfilesTab from './TranscriptionProfilesTab';
import OfficeInformationTab from './OfficeInformationTab';

function SettingsTabs({ 
  tabValue, 
  transcriptionProfiles, 
  addTranscriptionProfile, 
  deleteTranscriptionProfile, 
  macroPhrases, 
  saveMacroPhrases, 
  customVocabulary, 
  saveCustomVocabulary, 
  officeInformation, 
  saveOfficeInformation, 
  settingsLoading 
}) { 
  return (
    <>
      {tabValue === 0 && <NoteStructureTab addTranscriptionProfile={addTranscriptionProfile} settingsLoading={settingsLoading} />} 
      {tabValue === 1 && <NarrativeTemplatesTab addTranscriptionProfile={addTranscriptionProfile} settingsLoading={settingsLoading} />} 
      {tabValue === 2 && <MacroPhrasesTab macroPhrases={macroPhrases} saveMacroPhrases={saveMacroPhrases} settingsLoading={settingsLoading} />}
      {tabValue === 3 && <CustomVocabularyTab customVocabulary={customVocabulary} saveCustomVocabulary={saveCustomVocabulary} settingsLoading={settingsLoading} />}
      {tabValue === 4 && <OfficeInformationTab officeInformation={officeInformation} saveOfficeInformation={saveOfficeInformation} settingsLoading={settingsLoading} />}
      {tabValue === 5 && <TranscriptionProfilesTab transcriptionProfiles={transcriptionProfiles} deleteTranscriptionProfile={deleteTranscriptionProfile} settingsLoading={settingsLoading} />} 
    </>
  );
}

export default SettingsTabs;
