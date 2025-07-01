import React from 'react';

function MultilingualSettings({ isMultilingual, setIsMultilingual, targetLanguage, setTargetLanguage }) {
  return (
    <div className="mt-10 p-8 bg-gray-50 rounded-lg">
      <label className="flex items-center cursor-pointer">
        <input
          className="checkbox-custom"
          id="multilingual-support"
          name="multilingual-support"
          type="checkbox"
          checked={isMultilingual}
          onChange={(e) => setIsMultilingual(e.target.checked)}
        />
        <span className="ml-4">
          <span className="text-xl font-medium text-gray-700">Enable Multilingual Support</span>
          <span className="block text-lg text-gray-500 mt-2">
            Automatically detect and transcribe multiple languages
          </span>
        </span>
      </label>
      
      {isMultilingual && (
        <div className="mt-6 p-6 bg-white rounded-lg border border-gray-200">
          <label className="block text-lg font-medium text-gray-700 mb-3">
            Target Language (Optional)
          </label>
          <div className="relative">
            <select
              className="w-full p-4 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              style={{
                position: 'relative',
                zIndex: 10,
                pointerEvents: 'auto',
                cursor: 'pointer',
                appearance: 'menulist',
                WebkitAppearance: 'menulist',
                MozAppearance: 'menulist'
              }}
              value={targetLanguage || ''}
              onChange={(e) => {
                setTargetLanguage(e.target.value);
              }}
            >
              <option value="">Auto-detect (Code-switching)</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="de">German</option>
              <option value="hi">Hindi</option>
              <option value="ru">Russian</option>
              <option value="pt">Portuguese</option>
              <option value="ja">Japanese</option>
              <option value="it">Italian</option>
              <option value="nl">Dutch</option>
            </select>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Select a specific language for pure single-language content, or leave as "Auto-detect" for conversations that switch between languages.
          </p>
        </div>
      )}
    </div>
  );
}

export default MultilingualSettings;