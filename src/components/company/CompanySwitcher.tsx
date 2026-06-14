import React from 'react';
import { useCompany } from '../../context/CompanyContext';
import { Building } from 'lucide-react';
import styles from './CompanySwitcher.module.css';

export const CompanySwitcher: React.FC = () => {
  const { selectedCompanyId, companiesList, switchCompany, loading } = useCompany();

  if (companiesList.length <= 1) return null;

  return (
    <div className={styles.switcherContainer}>
      <Building size={16} className={styles.icon} />
      <select
        value={selectedCompanyId || ''}
        onChange={(e) => switchCompany(e.target.value)}
        disabled={loading}
        className={styles.select}
      >
        {companiesList.map((comp) => (
          <option key={comp.id} value={comp.id}>
            {comp.displayName || comp.legalName || comp.id}
          </option>
        ))}
      </select>
    </div>
  );
};
