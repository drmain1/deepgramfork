import { createContext, useContext, useState, useEffect } from 'react';

const TemplateContext = createContext();

export function TemplateProvider({ children }) {
  const [macroPhrases, setMacroPhrases] = useState(() => {
    const saved = localStorage.getItem('macroPhrases');
    return saved ? JSON.parse(saved) : [];
  });
  const [customVocabulary, setCustomVocabulary] = useState(() => {
    const saved = localStorage.getItem('customVocabulary');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('macroPhrases', JSON.stringify(macroPhrases));
    localStorage.setItem('customVocabulary', JSON.stringify(customVocabulary));
  }, [macroPhrases, customVocabulary]);

  return (
    <TemplateContext.Provider value={{ macroPhrases, setMacroPhrases, customVocabulary, setCustomVocabulary }}>
      {children}
    </TemplateContext.Provider>
  );
}

export const useTemplate = () => useContext(TemplateContext);
