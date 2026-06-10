import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import styles from './MetricCard.module.css';

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
  accentClass: string;
  onClick?: () => void;
  progress?: number; // Optional progress percentage (0 - 100)
  isWarning?: boolean; // Highlight as warning
  badgeText?: string; // e.g. "Peak", "Healthy", "Reorder"
  sparklineData?: number[]; // Simple numeric values for sparkline chart
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendDirection = 'neutral',
  icon: Icon,
  accentClass,
  onClick,
  progress,
  isWarning = false,
  badgeText,
  sparklineData
}) => {
  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : Minus;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  const renderSparkline = (data: number[]) => {
    if (data.length < 2) return null;
    const width = 70;
    const height = 20;
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min === 0 ? 1 : max - min;
    const points = data.map((val, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width={width} height={height} className={styles.sparkline} aria-hidden="true">
        <polyline
          fill="none"
          stroke={isWarning ? "#B05A5A" : "#6C8271"}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  return (
    <div 
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${isWarning ? styles.warningCard : ''}`} 
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={onClick ? `Explore ${title} ledger details` : undefined}
    >
      <div className={styles.top}>
        <div className={`${styles.iconWrap} ${styles[accentClass]} ${isWarning ? styles.warningIconWrap : ''}`}>
          <Icon size={18} />
        </div>
        
        <div className={styles.rightBadgeRow}>
          {sparklineData && renderSparkline(sparklineData)}
          {badgeText && (
            <span className={`${styles.badge} ${isWarning ? styles.badgeAlert : styles.badgeInfo}`}>
              {isWarning && <AlertCircle size={10} style={{ marginRight: '2px' }} />}
              {badgeText}
            </span>
          )}
          {trend && (
            <span className={`${styles.trend} ${styles[`trend-${trendDirection}`]}`}>
              <TrendIcon size={12} />
              <span>{trend}</span>
            </span>
          )}
        </div>
      </div>

      <div className={styles.body}>
        <h4 className={styles.title}>{title}</h4>
        <div className={styles.valueRow}>
          <span className={styles.value}>{value}</span>
        </div>
      </div>

      {progress !== undefined && (
        <div className={styles.progressSection}>
          <div className={styles.progressTrack}>
            <div 
              className={styles.progressBar} 
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} 
            />
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <span className={styles.subtitle}>{subtitle}</span>
      </div>
    </div>
  );
};
