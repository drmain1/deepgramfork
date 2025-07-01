import React from 'react';

function EvaluationTypeSelector({ evaluationType, setEvaluationType, recommendedEvalType, onTypeChange }) {
  const handleTypeChange = (type) => {
    setEvaluationType(type);
    if (onTypeChange) {
      onTypeChange(type);
    }
  };

  return (
    <div className="mt-10">
      <h3 className="text-xl font-medium text-gray-800 mb-4">
        Visit Type
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Initial Evaluation Button */}
        <button
          type="button"
          onClick={() => handleTypeChange('initial')}
          className={`p-6 rounded-xl border-2 transition-all duration-200 relative ${
            evaluationType === 'initial'
              ? 'border-indigo-600 bg-indigo-50 shadow-lg'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
          }`}
        >
          {recommendedEvalType === 'initial' && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
              Recommended
            </span>
          )}
          <div className="flex flex-col items-center text-center">
            <span className={`material-icons text-3xl mb-3 ${
              evaluationType === 'initial' ? 'text-indigo-600' : 'text-gray-400'
            }`}>
              article
            </span>
            <h4 className={`font-semibold text-lg mb-2 ${
              evaluationType === 'initial' ? 'text-indigo-900' : 'text-gray-700'
            }`}>
              Initial Evaluation
            </h4>
            <p className={`text-sm ${
              evaluationType === 'initial' ? 'text-indigo-700' : 'text-gray-500'
            }`}>
              First comprehensive assessment
            </p>
          </div>
        </button>

        {/* Follow-up Visit Button */}
        <button
          type="button"
          onClick={() => handleTypeChange('follow_up')}
          className={`p-6 rounded-xl border-2 transition-all duration-200 relative ${
            evaluationType === 'follow_up'
              ? 'border-indigo-600 bg-indigo-50 shadow-lg'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
          }`}
        >
          {recommendedEvalType === 'follow_up' && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
              Recommended
            </span>
          )}
          <div className="flex flex-col items-center text-center">
            <span className={`material-icons text-3xl mb-3 ${
              evaluationType === 'follow_up' ? 'text-indigo-600' : 'text-gray-400'
            }`}>
              update
            </span>
            <h4 className={`font-semibold text-lg mb-2 ${
              evaluationType === 'follow_up' ? 'text-indigo-900' : 'text-gray-700'
            }`}>
              Follow-up Visit
            </h4>
            <p className={`text-sm ${
              evaluationType === 'follow_up' ? 'text-indigo-700' : 'text-gray-500'
            }`}>
              Routine treatment session
            </p>
          </div>
        </button>

        {/* Re-evaluation Button */}
        <button
          type="button"
          onClick={() => handleTypeChange('re_evaluation')}
          className={`p-6 rounded-xl border-2 transition-all duration-200 relative ${
            evaluationType === 're_evaluation'
              ? 'border-indigo-600 bg-indigo-50 shadow-lg'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
          }`}
        >
          {recommendedEvalType === 're_evaluation' && (
            <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-sm">
              Recommended
            </span>
          )}
          <div className="flex flex-col items-center text-center">
            <span className={`material-icons text-3xl mb-3 ${
              evaluationType === 're_evaluation' ? 'text-indigo-600' : 'text-gray-400'
            }`}>
              assessment
            </span>
            <h4 className={`font-semibold text-lg mb-2 ${
              evaluationType === 're_evaluation' ? 'text-indigo-900' : 'text-gray-700'
            }`}>
              Re-evaluation
            </h4>
            <p className={`text-sm ${
              evaluationType === 're_evaluation' ? 'text-indigo-700' : 'text-gray-500'
            }`}>
              Progress assessment
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}

export default EvaluationTypeSelector;