import NoteStructureTab from './NoteStructureTab';
import MacroPhrasesTab from './MacroPhrasesTab';
import CustomVocabularyTab from './CustomVocabularyTab';

function SettingsTabs({ tabValue }) {
  return (
    <>
      {tabValue === 0 && <NoteStructureTab />}
      {tabValue === 1 && <MacroPhrasesTab />}
      {tabValue === 2 && <CustomVocabularyTab />}
    </>
  );
}

export default SettingsTabs;
