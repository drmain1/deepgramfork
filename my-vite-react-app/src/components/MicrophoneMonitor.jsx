import React from 'react';

function MicrophoneMonitor({ micStatus, micLevel, onRetry }) {
  if (micStatus === 'checking') {
    return (
      <div className="space-y-4 text-center">
        <div className="w-12 h-12 mx-auto">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-200 border-t-blue-600"></div>
        </div>
        <p className="text-base text-blue-800">Requesting microphone access...</p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-blue-200 hover:bg-blue-300 text-blue-800 border border-blue-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          Manual Start
        </button>
      </div>
    );
  }
  
  if (micStatus === 'active') {
    return (
      <div className="space-y-4">
        {/* Circular microphone visualization */}
        <div className="flex justify-center mb-6">
          <div className="relative w-24 h-24">
            {/* Outer ring that pulses with audio */}
            <div 
              className="absolute inset-0 rounded-full border-4 transition-all duration-100"
              style={{ 
                transform: `scale(${1 + (micLevel / 150)})`,
                borderColor: micLevel > 20 ? '#2563EB' : micLevel > 5 ? '#3B82F6' : 'rgba(59, 130, 246, 0.3)',
                opacity: 0.4 + (micLevel / 200),
                boxShadow: micLevel > 10 ? `0 0 ${Math.min(20, micLevel / 5)}px rgba(37, 99, 235, 0.5)` : 'none'
              }}
            />
            {/* Middle ring */}
            <div 
              className="absolute inset-3 rounded-full border-2 transition-all duration-75"
              style={{ 
                transform: `scale(${1 + (micLevel / 300)})`,
                borderColor: micLevel > 15 ? '#2563EB' : micLevel > 3 ? '#3B82F6' : 'rgba(59, 130, 246, 0.5)',
                opacity: 0.6 + (micLevel / 250)
              }}
            />
            {/* Inner microphone icon */}
            <div 
              className="absolute inset-5 rounded-full bg-white/20 flex items-center justify-center transition-all duration-100"
              style={{
                backgroundColor: micLevel > 10 ? 'rgba(37, 99, 235, 0.3)' : 'rgba(59, 130, 246, 0.2)',
                transform: `scale(${1 + (micLevel / 500)})`
              }}
            >
              <span 
                className="material-icons text-2xl transition-colors duration-100"
                style={{ color: micLevel > 10 ? '#2563EB' : '#3B82F6' }}
              >
                {micLevel > 25 ? 'mic' : micLevel > 5 ? 'mic_none' : 'mic_off'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Level bars */}
        <div className="space-y-2">
          <div className="flex justify-center gap-1">
            {[...Array(10)].map((_, i) => {
              const threshold = (i + 1) * 8; // More sensitive thresholds (8, 16, 24, etc.)
              const isActive = micLevel > threshold;
              const barHeight = Math.min(20, 8 + (i * 1.5)); // Varying heights
              
              return (
                <div 
                  key={i}
                  className="w-1.5 rounded-full transition-all duration-75"
                  style={{ 
                    height: `${barHeight}px`,
                    backgroundColor: isActive ? 
                      (i < 6 ? '#2563EB' : i < 8 ? '#3B82F6' : '#60A5FA') : // Blue gradient
                      'rgba(59, 130, 246, 0.25)',
                    opacity: isActive ? (0.7 + (micLevel / 200)) : 0.4,
                    transform: isActive ? 'scaleY(1.1)' : 'scaleY(1)'
                  }}
                />
              );
            })}
          </div>
          <div className="text-center">
            <p className="text-sm text-blue-700">
              {micLevel > 10 ? `Audio: ${Math.round(micLevel)}%` : 'Speak to test...'}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  if (micStatus === 'denied') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 text-red-200">
          <span className="material-icons text-2xl">mic_off</span>
        </div>
        <p className="text-base text-blue-800">Microphone access denied</p>
        <p className="text-sm text-blue-600">Please allow microphone access and refresh</p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-blue-200 hover:bg-blue-300 text-blue-800 border border-blue-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          Retry Access
        </button>
      </div>
    );
  }
  
  if (micStatus === 'error') {
    return (
      <div className="space-y-4 text-center">
        <div className="flex items-center justify-center gap-2 text-red-200">
          <span className="material-icons text-2xl">error</span>
        </div>
        <p className="text-base text-blue-800">Microphone error</p>
        <p className="text-sm text-blue-600">Please check your microphone connection</p>
        <button
          type="button"
          onClick={onRetry}
          className="bg-blue-200 hover:bg-blue-300 text-blue-800 border border-blue-300 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }
  
  return null;
}

export default MicrophoneMonitor;