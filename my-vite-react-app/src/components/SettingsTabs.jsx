import NoteStructureTab from './NoteStructureTab';
import NarrativeTemplatesTab from './NarrativeTemplatesTab';
import MacroPhrasesTab from './MacroPhrasesTab';
import CustomVocabularyTab from './CustomVocabularyTab';
import TranscriptionProfilesTab from './TranscriptionProfilesTab';
import OfficeInformationTab from './OfficeInformationTab';
import BillingRulesTab from './BillingRulesTab';
import CPTFeesTab from './CPTFeesTab';
import SecurityTab from './SecurityTab';

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
  customBillingRules,
  saveCustomBillingRules,
  cptFees,
  saveCptFees,
  settingsLoading,
  onOpenMFA
}) { 
  return (
    <>
      {/* Standard Templates tab hidden but functionality preserved */}
      {/* {tabValue === -1 && <NoteStructureTab settingsLoading={settingsLoading} />} */}
      {tabValue === 0 && <NarrativeTemplatesTab addTranscriptionProfile={addTranscriptionProfile} settingsLoading={settingsLoading} />} 
      {tabValue === 1 && <MacroPhrasesTab macroPhrases={macroPhrases} saveMacroPhrases={saveMacroPhrases} settingsLoading={settingsLoading} />}
      {tabValue === 2 && <CustomVocabularyTab customVocabulary={customVocabulary} saveCustomVocabulary={saveCustomVocabulary} settingsLoading={settingsLoading} />}
      {tabValue === 3 && <OfficeInformationTab officeInformation={officeInformation} saveOfficeInformation={saveOfficeInformation} settingsLoading={settingsLoading} />}
      {tabValue === 4 && <TranscriptionProfilesTab transcriptionProfiles={transcriptionProfiles} deleteTranscriptionProfile={deleteTranscriptionProfile} settingsLoading={settingsLoading} />}
      {tabValue === 5 && <BillingRulesTab customBillingRules={customBillingRules} saveCustomBillingRules={saveCustomBillingRules} settingsLoading={settingsLoading} />}
      {tabValue === 6 && <CPTFeesTab cptFees={cptFees} saveCptFees={saveCptFees} settingsLoading={settingsLoading} />}
      {tabValue === 7 && <SecurityTab onOpenMFA={onOpenMFA} />}
    </>
  );
}

export default SettingsTabs;
