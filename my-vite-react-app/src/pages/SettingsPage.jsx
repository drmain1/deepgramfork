import { useState } from 'react';
import { useAuth } from '../contexts/FirebaseAuthContext';
import SettingsTabs from '../components/SettingsTabs';
import { useUserSettings } from '../contexts/UserSettingsContext';
import MFASetup from '../components/MFASetup';

function SettingsPage() {
  const [tabValue, setTabValue] = useState(0);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const {
    userSettings,
    settingsLoading,
    settingsError,
    updateOfficeInformation,
    updateTranscriptionProfiles,
    updateCustomVocabulary,
    updateMacroPhrases,
    updateCustomBillingRules,
    updateCptFees
  } = useUserSettings();

  const handleTabChange = (newValue) => {
    setTabValue(newValue);
  };

  const addTranscriptionProfile = async (newProfile) => {
    let status = 'success';
    let updatedProfiles = userSettings.transcriptionProfiles || [];

    if (updatedProfiles.find(profile => profile.id === newProfile.id)) {
      status = 'duplicate';
      console.warn('Attempted to add duplicate transcription profile ID:', newProfile.id);
      return status;
    } else {
      updatedProfiles = [...updatedProfiles, newProfile];
    }
    
    try {
      await updateTranscriptionProfiles(updatedProfiles);
      console.log("Transcription profiles updated successfully via context.");
    } catch (error) {
      console.error("Failed to update transcription profiles via context:", error);
      status = 'error';
    }
    return status;
  };

  const deleteTranscriptionProfile = async (profileIdToDelete) => {
    const updatedProfiles = (userSettings.transcriptionProfiles || []).filter(profile => profile.id !== profileIdToDelete);
    try {
      await updateTranscriptionProfiles(updatedProfiles);
      console.log("Transcription profile deleted successfully via context.");
    } catch (error) {
      console.error("Failed to delete transcription profile via context:", error);
    }
  };

  const tabs = [
    'Narrative Templates', 
    'Macro Phrases',
    'Custom Vocabulary',
    'Office Information',
    'Transcription Profiles',
    'Billing Rules',
    'CPT Fees',
    'Security'
  ];

  if (authLoading || settingsLoading) {
    return (
      <main className="flex-1 p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Loading settings...</div>
        </div>
      </main>
    );
  }

  if (settingsError) {
    return (
      <main className="flex-1 p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-red-600">Error loading settings: {settingsError}. Please try again later.</div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="flex-1 p-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-600">Please log in to manage your settings.</div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-800">Settings</h1>
      </header>
      
      <div className="main-content p-8 rounded-lg shadow-lg">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => handleTabChange(index)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                  tabValue === index
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                aria-current={tabValue === index ? 'page' : undefined}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <SettingsTabs 
          tabValue={tabValue} 
          transcriptionProfiles={userSettings.transcriptionProfiles}
          addTranscriptionProfile={addTranscriptionProfile} 
          deleteTranscriptionProfile={deleteTranscriptionProfile} 
          macroPhrases={userSettings.macroPhrases}
          saveMacroPhrases={updateMacroPhrases}
          customVocabulary={userSettings.customVocabulary}
          saveCustomVocabulary={updateCustomVocabulary}
          officeInformation={userSettings.officeInformation}
          saveOfficeInformation={updateOfficeInformation}
          customBillingRules={userSettings.customBillingRules}
          saveCustomBillingRules={updateCustomBillingRules}
          cptFees={userSettings.cptFees}
          saveCptFees={updateCptFees}
          settingsLoading={settingsLoading}
          onOpenMFA={() => setMfaDialogOpen(true)}
        />
      </div>
      
      {/* MFA Setup Dialog */}
      <MFASetup 
        open={mfaDialogOpen} 
        onClose={() => setMfaDialogOpen(false)} 
      />
    </main>
  );
}

export default SettingsPage;
