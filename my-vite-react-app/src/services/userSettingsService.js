import useUserSettingsStore from '../stores/userSettingsStore';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

class UserSettingsService {
  constructor() {
    this.currentUser = null;
    this.getToken = null;
    this.fetchInProgress = false;
    this.lastFetchedUserId = null;
  }

  // Initialize with auth context
  init(currentUser, getToken) {
    // Reset fetch state if user changed
    if (this.currentUser?.uid !== currentUser?.uid) {
      this.fetchInProgress = false;
      this.lastFetchedUserId = null;
    }
    this.currentUser = currentUser;
    this.getToken = getToken;
  }

  // Fetch user settings from API
  async fetchUserSettings() {
    if (!this.currentUser || !this.currentUser.uid) {
      useUserSettingsStore.getState().setLoading(false);
      return;
    }

    // Prevent multiple concurrent fetches for the same user
    if (this.fetchInProgress && this.lastFetchedUserId === this.currentUser.uid) {
      console.log('Fetch already in progress for user:', this.currentUser.uid);
      return;
    }

    // Check if settings were already fetched for this user
    if (this.lastFetchedUserId === this.currentUser.uid) {
      console.log('Settings already fetched for user:', this.currentUser.uid);
      return;
    }

    this.fetchInProgress = true;
    this.lastFetchedUserId = this.currentUser.uid;
    
    useUserSettingsStore.getState().setLoading(true);
    useUserSettingsStore.getState().setError(null);

    try {
      console.log('Fetching settings for user:', this.currentUser.uid);
      const accessToken = await this.getToken();
      const response = await fetch(`${API_BASE_URL}/api/v1/user_settings/${this.currentUser.uid}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          // Settings not found, use default (empty arrays as per initial state)
          console.log('User settings not found (404), using initial empty/default settings.');
          useUserSettingsStore.getState().initializeSettings({});
        } else {
          throw new Error(`Failed to fetch user settings: ${response.statusText} (Status: ${response.status})`);
        }
      } else {
        const data = await response.json();
        console.log('Settings fetched successfully:', data);
        useUserSettingsStore.getState().initializeSettings(data);
      }
    } catch (error) {
      console.error('Error fetching user settings:', error);
      useUserSettingsStore.getState().setError(error.message);
      // Reset fetch state on error so we can retry
      this.lastFetchedUserId = null;
    } finally {
      this.fetchInProgress = false;
      useUserSettingsStore.getState().setLoading(false);
    }
  }

  // Save user settings to API
  async saveUserSettings(settings, skipLoadingState = false) {
    if (!this.currentUser || !this.currentUser.uid) {
      throw new Error('User not authenticated. Cannot save settings.');
    }

    console.log('UserSettingsService - Attempting to save settings:', settings);
    
    if (!skipLoadingState) {
      useUserSettingsStore.getState().setLoading(true);
    }
    useUserSettingsStore.getState().setError(null);

    try {
      const accessToken = await this.getToken();
      console.log('UserSettingsService - Got access token, making API call...');
      
      const response = await fetch(`${API_BASE_URL}/api/v1/user_settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ user_id: this.currentUser.uid, settings }),
      });

      console.log('UserSettingsService - API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('UserSettingsService - API error response:', errorText);
        throw new Error(`Failed to save user settings: ${response.statusText} (Status: ${response.status}). Details: ${errorText}`);
      }

      const savedData = await response.json();
      console.log('UserSettingsService - Settings saved successfully:', savedData);
      
      // Update store with saved settings
      useUserSettingsStore.getState().updateAllSettings(settings);
      
      return savedData;
    } catch (error) {
      console.error('Error saving user settings:', error);
      useUserSettingsStore.getState().setError(error.message);
      throw error;
    } finally {
      if (!skipLoadingState) {
        useUserSettingsStore.getState().setLoading(false);
      }
    }
  }

  // Convenience methods that mirror the old context API
  async updateOfficeInformation(newOfficeInfo) {
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { ...currentSettings, officeInformation: newOfficeInfo };
    return this.saveUserSettings(updatedSettings);
  }

  async updateTranscriptionProfiles(newProfiles) {
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { ...currentSettings, transcriptionProfiles: newProfiles };
    return this.saveUserSettings(updatedSettings);
  }

  async updateCustomVocabulary(newVocab) {
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { ...currentSettings, customVocabulary: newVocab };
    return this.saveUserSettings(updatedSettings);
  }

  async updateMacroPhrases(newMacros) {
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { ...currentSettings, macroPhrases: newMacros };
    return this.saveUserSettings(updatedSettings);
  }

  async updateDoctorInformation(doctorName, doctorSignature, clinicLogo, includeLogoOnPdf, medicalSpecialty) {
    console.log('updateDoctorInformation called with:', { 
      doctorName, 
      doctorSignature: doctorSignature ? 'present' : 'null',
      clinicLogo: clinicLogo ? 'present' : 'null',
      includeLogoOnPdf,
      medicalSpecialty 
    });

    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { 
      ...currentSettings, 
      doctorName, 
      doctorSignature,
      clinicLogo: clinicLogo !== undefined ? clinicLogo : currentSettings.clinicLogo,
      includeLogoOnPdf: includeLogoOnPdf !== undefined ? includeLogoOnPdf : currentSettings.includeLogoOnPdf,
      medicalSpecialty: medicalSpecialty !== undefined ? medicalSpecialty : currentSettings.medicalSpecialty
    };
    
    console.log('updateDoctorInformation - Updated settings:', updatedSettings);
    return this.saveUserSettings(updatedSettings);
  }

  async updateMedicalSpecialty(medicalSpecialty) {
    console.log('updateMedicalSpecialty called with:', medicalSpecialty);
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    console.log('Current settings:', currentSettings);
    const updatedSettings = { ...currentSettings, medicalSpecialty };
    console.log('Updated settings to save:', updatedSettings);
    return this.saveUserSettings(updatedSettings, true); // Skip loading state to prevent UI refresh
  }

  async updateCustomBillingRules(customBillingRules) {
    console.log('updateCustomBillingRules called with:', customBillingRules?.substring(0, 100) + '...');
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { ...currentSettings, customBillingRules };
    return this.saveUserSettings(updatedSettings);
  }

  async updateCptFees(cptFees) {
    console.log('updateCptFees called with:', cptFees);
    const currentSettings = useUserSettingsStore.getState().getSettingsForAPI();
    const updatedSettings = { ...currentSettings, cptFees };
    return this.saveUserSettings(updatedSettings);
  }
}

// Export singleton instance
export const userSettingsService = new UserSettingsService();
export default userSettingsService;