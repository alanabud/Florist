import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ModalForms } from '../dashboard/ModalForms';
import { useAdminStore } from '../../store/adminStore';
import styles from './MainLayout.module.css';

export const MainLayout: React.FC = () => {
  const { activeModal, closeModal } = useAdminStore();

  return (
    <div className={styles.layout}>
      <Sidebar />
      <div className={styles.mainWrapper}>
        <Topbar />
        <main className={styles.mainContent}>
          <div className={styles.container}>
            <Outlet />
          </div>
        </main>
      </div>
      <ModalForms activeModal={activeModal} onClose={closeModal} />
    </div>
  );
};
