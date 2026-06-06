import React from 'react';
import { Check, X, Info } from 'lucide-react';
import { useToastStore, type ToastMessage } from '../../store/toastStore';
import styles from './Toast.module.css';

const Toast: React.FC<{ toast: ToastMessage }> = ({ toast }) => {
  const removeToast = useToastStore((state) => state.removeToast);

  const icons = {
    success: <Check className={styles.icon} />,
    error: <X className={styles.icon} />,
    info: <Info className={styles.icon} />,
  };

  return (
    <div className={`${styles.toast} ${styles[toast.type || 'success']}`}>
      <div className={styles.iconWrapper}>
        {icons[toast.type || 'success']}
      </div>
      <p className={styles.message}>{toast.message}</p>
      <button onClick={() => removeToast(toast.id)} className={styles.closeBtn}>
        <X size={16} />
      </button>
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
};
