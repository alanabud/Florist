import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import styles from './KpiCard.module.css';

interface KpiCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend: string;
  trendDirection: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  accentClass: string;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({ title, value, subtitle, trend, trendDirection, icon: Icon, accentClass, onClick }) => {
  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;

  return (
    <div className={`${styles.card} ${onClick ? styles.clickable : ''}`} onClick={onClick}>
      <div className={styles.top}>
        <div className={`${styles.iconWrap} ${styles[accentClass]}`}>
          <Icon size={20} />
        </div>
        <div className={`${styles.trend} ${styles[`trend-${trendDirection}`]}`}>
          <TrendIcon size={14} />
          <span>{trend}</span>
        </div>
      </div>
      <div className={styles.body}>
        <p className={styles.value}>{value}</p>
        <p className={styles.title}>{title}</p>
      </div>
      <p className={styles.subtitle}>{subtitle}</p>
    </div>
  );
};
