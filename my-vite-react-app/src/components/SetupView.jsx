import React from 'react';

function SetupView({
  patientDetails,
  setPatientDetails,
  patientContext,
  setPatientContext,
  selectedLocation,
  setSelectedLocation,
  selectedProfileId,
  setSelectedProfileId,
  isMultilingual,
  setIsMultilingual,
  userSettings,
  settingsLoading,
  error,
  onStartEncounter
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!patientDetails.trim()) {
      return;
    }
    onStartEncounter();
  };

  return (
    <main className="flex-1 p-8 overflow-y-auto" style={{ backgroundColor: '#f3f4f6' }}>
      <header className="mb-8">
        <h1 className="text-3xl font-semibold text-gray-800">Encounter</h1>
      </header>
      
      <div className="main-content p-8 rounded-lg shadow-lg max-w-2xl mx-auto">
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label 
              className="block text-sm font-medium label-text mb-1" 
              htmlFor="session-title"
            >
              Patient Name / Session Title <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-4 py-2.5 rounded-md border input-field focus:ring-0"
              id="session-title"
              name="session-title"
              placeholder="Enter patient name or session title"
              type="text"
              value={patientDetails}
              onChange={(e) => setPatientDetails(e.target.value)}
              required
            />
            {error && !patientDetails.trim() && (
              <p className="text-red-500 text-sm mt-1">Please enter patient details</p>
            )}
          </div>

          <div className="mb-6">
            <label 
              className="block text-sm font-medium label-text mb-1" 
              htmlFor="patient-context"
            >
              Add patient context (optional)
            </label>
            <textarea
              className="w-full px-4 py-2.5 rounded-md border input-field focus:ring-0 resize-none"
              id="patient-context"
              name="patient-context"
              placeholder="e.g., Follow-up for hypertension, Annual check-up"
              rows="3"
              value={patientContext}
              onChange={(e) => setPatientContext(e.target.value)}
            />
          </div>

          <div className="mb-6">
            <label 
              className="block text-sm font-medium label-text mb-1" 
              htmlFor="location"
            >
              Location
            </label>
            <select
              className="w-full px-4 py-2.5 rounded-md border input-field focus:ring-0"
              id="location"
              name="location"
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              disabled={settingsLoading || (!userSettings.officeInformation && !settingsLoading)}
            >
              <option value="">Select a location...</option>
              {settingsLoading && !userSettings.officeInformation ? (
                <option value="" disabled>Loading locations...</option>
              ) : (
                userSettings.officeInformation && userSettings.officeInformation.map((loc, index) => (
                  <option key={index} value={loc}>
                    {loc.length > 50 ? `${loc.substring(0, 50)}...` : loc}
                  </option>
                ))
              )}
              <option value="add-new">Add New Location...</option>
            </select>
          </div>

          <div className="mb-8">
            <label 
              className="block text-sm font-medium label-text mb-2" 
              htmlFor="treatment-session"
            >
              Treatment Type
            </label>
            <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-4 space-y-4 lg:space-y-0">
              <select
                className="flex-grow px-4 py-2.5 rounded-md border input-field focus:ring-0"
                id="treatment-session"
                name="treatment-session"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                disabled={settingsLoading || (!userSettings.transcriptionProfiles && !settingsLoading)}
              >
                {settingsLoading && !userSettings.transcriptionProfiles ? (
                  <option value="" disabled>Loading profiles...</option>
                ) : (
                  userSettings.transcriptionProfiles &&
                  userSettings.transcriptionProfiles
                    .filter(profile => profile.name !== 'Default/General summary')
                    .map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))
                )}
              </select>
              <div className="flex items-center">
                <input
                  className="h-4 w-4 checkbox-custom"
                  id="multilingual-support"
                  name="multilingual-support"
                  type="checkbox"
                  checked={isMultilingual}
                  onChange={(e) => setIsMultilingual(e.target.checked)}
                />
                <label 
                  className="ml-2 block text-sm text-gray-700" 
                  htmlFor="multilingual-support"
                >
                  Enable Multilingual Support
                </label>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 text-red-500 text-center">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              className="btn-primary font-medium py-3 px-6 rounded-lg flex items-center space-x-2 disabled:opacity-50"
              type="submit"
              disabled={!patientDetails.trim()}
            >
              <span className="material-icons">play_arrow</span>
              <span>Start Encounter</span>
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default SetupView; 