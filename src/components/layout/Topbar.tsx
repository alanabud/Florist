import React from 'react';
import { Bell, Search, User } from 'lucide-react';
import styles from './Topbar.module.css';

export const Topbar: React.FC = () => {
  return (
    <header className={styles.topbar}>
      <div className={styles.searchContainer}>
        <Search className={styles.searchIcon} />
        <input 
          type="text" 
          placeholder="Search orders, customers, products..." 
          className={styles.searchInput}
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.iconButton}>
          <Bell className={styles.icon} />
          <span className={styles.badge}></span>
        </button>
        <button className={styles.profileButton}>
          <div className={styles.avatar}>
            <User className={styles.avatarIcon} />
          </div>
          <div className={styles.profileInfo}>
            <span className={styles.name}>Admin User</span>
            <span className={styles.role}>Owner</span>
          </div>
        </button>
      </div>
    </header>
  );
};
