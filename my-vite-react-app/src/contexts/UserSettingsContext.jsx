import React, { createContext, useState, useEffect, useContext } from 'react';
import { useAuth } from './AuthContext';

const UserSettingsContext = createContext();

export const useUserSettings = () => useContext(UserSettingsContext);

export const UserSettingsProvider = ({ children }) => {
  const { isAuthenticated, getAccessTokenSilently, user } = useAuth();
  const [userSettings, setUserSettings] = useState({
    macroPhrases: [],
    customVocabulary: [],
    officeInformation: [],
    transcriptionProfiles: [],
    doctorName: '',
    doctorSignature: null,
    clinicLogo: null,
    includeLogoOnPdf: false,
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
          doctorName: data.doctorName || '',
          doctorSignature: data.doctorSignature || null,
          clinicLogo: data.clinicLogo || null,
          includeLogoOnPdf: data.includeLogoOnPdf || false,
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
    console.log('UserSettingsContext - Attempting to save settings:', newSettings);
    setSettingsLoading(true); // Indicate saving process
    setSettingsError(null);
    try {
      const accessToken = await getAccessTokenSilently();
      console.log('UserSettingsContext - Got access token, making API call...');
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
      console.log('UserSettingsContext - API response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('UserSettingsContext - API error response:', errorText);
        throw new Error(`Failed to save user settings: ${response.statusText} (Status: ${response.status}). Details: ${errorText}`);
      }
      const savedData = await response.json();
      console.log('UserSettingsContext - Settings saved successfully:', savedData);
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
    updateDoctorInformation: (doctorName, doctorSignature, clinicLogo, includeLogoOnPdf) => {
        console.log('updateDoctorInformation called with:', { 
          doctorName, 
          doctorSignature: doctorSignature ? 'present' : 'null',
          clinicLogo: clinicLogo ? 'present' : 'null',
          includeLogoOnPdf 
        });
        const updatedSettings = { 
          ...userSettings, 
          doctorName, 
          doctorSignature,
          clinicLogo: clinicLogo !== undefined ? clinicLogo : userSettings.clinicLogo,
          includeLogoOnPdf: includeLogoOnPdf !== undefined ? includeLogoOnPdf : userSettings.includeLogoOnPdf
        };
        console.log('updateDoctorInformation - Updated settings:', updatedSettings);
        return saveUserSettings(updatedSettings);
    },
  };

  return (
    <UserSettingsContext.Provider value={value}>
      {children}
    </UserSettingsContext.Provider>
  );
};
