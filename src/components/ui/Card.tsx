import React from 'react';
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ children, className = '', onClick, style }) => {
  return (
    <div 
      className={`${styles.card} ${className} ${onClick ? styles.clickable : ''}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`${styles.header} ${className}`} style={style}>{children}</div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <h3 className={`${styles.title} ${className}`} style={style}>{children}</h3>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`${styles.content} ${className}`} style={style}>{children}</div>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string; style?: React.CSSProperties }> = ({ children, className = '', style }) => (
  <div className={`${styles.footer} ${className}`} style={style}>{children}</div>
);
