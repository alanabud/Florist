import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/I18nProvider';
import { useCompany } from '../../context/CompanyContext';
import { useAuthStore } from '../../store/authStore';
import { Globe, ChevronDown } from 'lucide-react';
import { db } from '../../firebase/config';
import { doc, updateDoc } from 'firebase/firestore';
import styles from './LanguageSwitcher.module.css';

const LANGUAGE_LABELS = {
  'en-US': 'English',
  'es-US': 'Español',
  'fr-FR': 'Français',
  'nl-NL': 'Nederlands'
};

const LANGUAGE_SHORT = {
  'en-US': 'EN',
  'es-US': 'ES',
  'fr-FR': 'FR',
  'nl-NL': 'NL'
};

export const LanguageSwitcher: React.FC = () => {
  const { language, setLanguage } = useI18n();
  const { selectedCompanyId, refreshContext } = useCompany();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleSelect = async (code: 'en-US' | 'es-US' | 'fr-FR' | 'nl-NL') => {
    setLanguage(code);
    setIsOpen(false);
    
    // Save to Firestore user profile if logged in
    if (selectedCompanyId && user?.uid) {
      try {
        const memberRef = doc(db, 'companies', selectedCompanyId, 'members', user.uid);
        await updateDoc(memberRef, { languagePreference: code });
        
        // Refresh company context membership info
        await refreshContext();
      } catch (err) {
        console.error('Failed to sync language selection to user member preference:', err);
      }
    }
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <button 
        className={styles.trigger} 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        type="button"
      >
        <Globe size={16} className={styles.globeIcon} />
        <span className={styles.label}>{LANGUAGE_SHORT[language]}</span>
        <ChevronDown size={12} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          {Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
            <button
              key={code}
              type="button"
              className={`${styles.option} ${language === code ? styles.optionActive : ''}`}
              onClick={() => handleSelect(code as any)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
