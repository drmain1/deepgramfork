import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const UserSettingsContext = createContext();

export const useUserSettings = () => useContext(UserSettingsContext);

export const UserSettingsProvider = ({ children }) => {
  const { isAuthenticated, getAccessTokenSilently, user } = useAuth0();
  const [userSettings, setUserSettings] = useState({
    macroPhrases: [],
    customVocabulary: [],
    officeInformation: [],
    transcriptionProfiles: [],
  });
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const fetchUserSettings = async () => {
    if (!isAuthenticated || !user || !user.sub) {
      setSettingsLoading(false);
      return;
    }
    setSettingsLoading(true);
    setSettingsError(null);
    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/v1/user_settings/${user.sub}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );
      if (!response.ok) {
        if (response.status === 404) {
          // Settings not found, use default (empty arrays as per initial state)
          // Or create default settings on backend if that's the desired flow.
          // For now, we assume the backend will create them if they don't exist on a PUT/POST
          // or we just use the default empty state.
          console.log('User settings not found (404), using initial empty/default settings.');
          setUserSettings(prev => ({ ...prev })); // Maintain default structure
        } else {
          throw new Error(`Failed to fetch user settings: ${response.statusText} (Status: ${response.status})`);
        }
      } else {
        const data = await response.json();
        setUserSettings({
          macroPhrases: data.macroPhrases || [],
          customVocabulary: data.customVocabulary || [],
          officeInformation: data.officeInformation || [],
          transcriptionProfiles: data.transcriptionProfiles || [],
        });
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      setSettingsError(error.message);
      // Keep existing state or clear it? For now, keep it.
    } finally {
      setSettingsLoading(false);
    }
  };

  const saveUserSettings = async (newSettings) => {
    if (!isAuthenticated || !user || !user.sub) {
      throw new Error('User not authenticated. Cannot save settings.');
    }
    setSettingsLoading(true); // Indicate saving process
    setSettingsError(null);
    try {
      const accessToken = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/v1/user_settings`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ user_id: user.sub, settings: newSettings }),
        }
      );
      if (!response.ok) {
        throw new Error(`Failed to save user settings: ${response.statusText} (Status: ${response.status})`);
      }
      const savedData = await response.json();
      setUserSettings(savedData); 
      return savedData;
    } catch (error) {
      console.error('Error saving user settings:', error);
      setSettingsError(error.message);
      throw error; // Re-throw to be caught by calling component
    } finally {
      setSettingsLoading(false);
    }
  };
  
  // Effect to load settings when auth state changes
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUserSettings();
    }
  }, [isAuthenticated, user, getAccessTokenSilently]);

  const value = {
    userSettings,
    settingsLoading,
    settingsError,
    fetchUserSettings, // Expose if manual refresh is needed
    saveUserSettings, // Expose to allow saving
    // Specific setters for convenience, they call saveUserSettings internally
    updateOfficeInformation: (newOfficeInfo) => {
      const updatedSettings = { ...userSettings, officeInformation: newOfficeInfo };
      return saveUserSettings(updatedSettings);
    },
    updateTranscriptionProfiles: (newProfiles) => {
      const updatedSettings = { ...userSettings, transcriptionProfiles: newProfiles };
      return saveUserSettings(updatedSettings);
    },
    updateCustomVocabulary: (newVocab) => {
        const updatedSettings = { ...userSettings, customVocabulary: newVocab };
        return saveUserSettings(updatedSettings);
    },
    updateMacroPhrases: (newMacros) => {
        const updatedSettings = { ...userSettings, macroPhrases: newMacros };
        return saveUserSettings(updatedSettings);
    },
  };

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};
