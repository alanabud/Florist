import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OCCASIONS } from '../data/products';
import { Card } from '../components/ui/Card';
import { ArrowRight } from 'lucide-react';
import styles from './Home.module.css'; // Reusing occasions grid styles from Home
import { useI18n } from '../i18n/I18nProvider';

export const Occasions: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '6rem 2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>{t('landing.occasions.title')}</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '1.125rem' }}>
          {t('occasions.subtitle')}
        </p>
      </div>

      <div className={styles.occasionsGrid}>
        {OCCASIONS.map((occ) => (
          <Card 
            key={occ.id} 
            className={styles.occasionCard}
            style={{ backgroundColor: occ.color }}
            onClick={() => navigate(`/shop?occasion=${occ.name}`)}
          >
            <div className={styles.occasionContent}>
              <h3>{occ.name}</h3>
              <span className={styles.occasionLink}>{t('occasions.shopOccasion').replace('{name}', occ.name)} <ArrowRight size={14} /></span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
