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
    <main className="flex-1 overflow-y-auto bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-semibold text-gray-900">New Encounter</h1>
          <p className="text-base text-gray-500 mt-1">Start a new patient encounter session</p>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="px-8 py-8">
        <div className="max-w-7xl mx-auto">
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Left Column - Patient Information */}
              <div className="xl:col-span-2 space-y-8">
                {/* Patient Details Card */}
                <div className="card p-8">
                  <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                    <span className="material-icons text-primary text-2xl">person</span>
                    Patient Information
                  </h2>
                  
                  <div className="form-group">
                    <label className="form-label text-base" htmlFor="session-title">
                      Patient Name / Session Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      className="input-field text-base py-3"
                      id="session-title"
                      name="session-title"
                      placeholder="Enter patient name or session title"
                      type="text"
                      value={patientDetails}
                      onChange={(e) => setPatientDetails(e.target.value)}
                      required
                    />
                    {error && !patientDetails.trim() && (
                      <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                        <span className="material-icons text-base">error</span>
                        Please enter patient details
                      </p>
                    )}
                  </div>

                  <div className="form-group mb-0">
                    <label className="form-label text-base" htmlFor="patient-context">
                      Clinical Context
                    </label>
                    <textarea
                      className="input-field text-base py-3 resize-none"
                      id="patient-context"
                      name="patient-context"
                      placeholder="e.g., Follow-up for hypertension, Annual check-up, Post-operative visit"
                      rows="5"
                      value={patientContext}
                      onChange={(e) => setPatientContext(e.target.value)}
                    />
                    <p className="text-sm text-gray-500 mt-2">
                      Add any relevant clinical context or chief complaint
                    </p>
                  </div>
                </div>

                {/* Session Settings Card */}
                <div className="card p-8">
                  <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                    <span className="material-icons text-primary text-2xl">tune</span>
                    Session Settings
                  </h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="form-group">
                      <label className="form-label text-base" htmlFor="location">
                        Location
                      </label>
                      <select
                        className="input-field text-base py-3"
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
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label text-base" htmlFor="treatment-session">
                        Treatment Type
                      </label>
                      <select
                        className="input-field text-base py-3"
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
                    </div>
                  </div>

                  <div className="mt-6 p-5 bg-gray-50 rounded-lg">
                    <label className="flex items-center cursor-pointer">
                      <input
                        className="checkbox-custom"
                        id="multilingual-support"
                        name="multilingual-support"
                        type="checkbox"
                        checked={isMultilingual}
                        onChange={(e) => setIsMultilingual(e.target.checked)}
                      />
                      <span className="ml-3">
                        <span className="text-base font-medium text-gray-700">Enable Multilingual Support</span>
                        <span className="block text-sm text-gray-500 mt-1">
                          Automatically detect and transcribe multiple languages
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Right Column - Quick Actions & Info */}
              <div className="space-y-8">
                {/* Start Recording Card */}
                <div className="card p-8 bg-gradient-to-br from-primary to-secondary text-white">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto mb-6 bg-white/20 rounded-full flex items-center justify-center">
                      <span className="material-icons text-5xl">mic</span>
                    </div>
                    <h3 className="text-xl font-semibold mb-3">Ready to Record</h3>
                    <p className="text-base text-white/80 mb-8">
                      Ensure patient information is complete before starting
                    </p>
                    <button
                      className="w-full bg-white text-primary font-semibold text-lg py-4 px-6 rounded-lg hover:bg-gray-50 transition-colors disabled:bg-white/50 disabled:text-primary/50"
                      type="submit"
                      disabled={!patientDetails.trim()}
                    >
                      <span className="flex items-center justify-center gap-3">
                        <span className="material-icons text-2xl">play_arrow</span>
                        Start Encounter
                      </span>
                    </button>
                  </div>
                </div>

                {/* Quick Tips Card */}
                <div className="card p-6 bg-blue-50 border-blue-200">
                  <h3 className="text-base font-semibold text-blue-900 mb-4 flex items-center gap-2">
                    <span className="material-icons text-blue-600 text-xl">lightbulb</span>
                    Quick Tips
                  </h3>
                  <ul className="space-y-3 text-base text-blue-800">
                    <li className="flex items-start gap-2">
                      <span className="material-icons text-base mt-0.5">check_circle</span>
                      <span>Speak clearly and at a normal pace</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-icons text-base mt-0.5">check_circle</span>
                      <span>Minimize background noise</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="material-icons text-base mt-0.5">check_circle</span>
                      <span>Test your microphone before starting</span>
                    </li>
                  </ul>
                </div>

                {/* Recent Activity */}
                <div className="card p-6">
                  <h3 className="text-base font-semibold text-gray-700 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-base">
                      <span className="text-gray-600">Today's Encounters</span>
                      <span className="font-semibold text-gray-900 text-lg">3</span>
                    </div>
                    <div className="flex items-center justify-between text-base">
                      <span className="text-gray-600">This Week</span>
                      <span className="font-semibold text-gray-900 text-lg">12</span>
                    </div>
                    <div className="flex items-center justify-between text-base">
                      <span className="text-gray-600">Average Duration</span>
                      <span className="font-semibold text-gray-900 text-lg">8 min</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}

export default SetupView;