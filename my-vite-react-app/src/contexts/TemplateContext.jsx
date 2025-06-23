import { createContext, useContext } from 'react';
import { useUserSettings } from './UserSettingsContext';

const TemplateContext = createContext();

// Thin wrapper around UserSettings for backward compatibility
export function TemplateProvider({ children }) {
  const { userSettings, updateUserSettings } = useUserSettings();
  
  // Extract template-related settings
  const macroPhrases = userSettings.macroPhrases || [];
  const customVocabulary = userSettings.customVocabulary || [];
  
  // Wrapper functions to maintain API compatibility
  const setMacroPhrases = (newPhrases) => {
    updateUserSettings({ ...userSettings, macroPhrases: newPhrases });
  };
  
  const setCustomVocabulary = (newVocabulary) => {
    updateUserSettings({ ...userSettings, customVocabulary: newVocabulary });
  };

  return (
    <TemplateContext.Provider value={{ 
      macroPhrases, 
      setMacroPhrases, 
      customVocabulary, 
      setCustomVocabulary 
    }}>
      {children}
    </TemplateContext.Provider>
  );
}

export const useTemplate = () => useContext(TemplateContext);
