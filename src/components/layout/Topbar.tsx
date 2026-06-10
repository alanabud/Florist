import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Bell, Search, User, LogOut, Settings, ListCollapse, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { logout } from '../../services/authService';
import { useToastStore } from '../../store/toastStore';
import { useAdminStore } from '../../store/adminStore';
import styles from './Topbar.module.css';

export const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role } = useAuthStore();
  const { inventory, orders, customers, products } = useAdminStore();
  const addToast = useToastStore((state) => state.addToast);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const searchablePaths = ['/admin/orders', '/admin/products', '/admin/inventory', '/admin/customers', '/admin/finance'];
    if (!searchablePaths.includes(location.pathname)) return;

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      const currentVal = searchParams.get('search') || '';
      if (val !== currentVal) {
        if (val) {
          searchParams.set('search', val);
        } else {
          searchParams.delete('search');
        }
        setSearchParams(searchParams);
      }
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = e.currentTarget.value.trim();
      if (!val) {
        navigate('/admin');
        return;
      }

      const lowerVal = val.toLowerCase();

      // 1. Customer record check
      const hasCustomerMatch = customers.some(c => 
        c.name.toLowerCase().includes(lowerVal) ||
        c.email.toLowerCase().includes(lowerVal) ||
        c.phone.toLowerCase().includes(lowerVal)
      );
      if (hasCustomerMatch) {
        navigate(`/admin/customers?search=${encodeURIComponent(val)}`);
        return;
      }

      // 2. Product catalog check
      const hasProductMatch = products.some(p => 
        p.name.toLowerCase().includes(lowerVal) ||
        p.category.toLowerCase().includes(lowerVal) ||
        p.tags.some(t => t.toLowerCase().includes(lowerVal))
      );
      if (hasProductMatch) {
        navigate(`/admin/products?search=${encodeURIComponent(val)}`);
        return;
      }

      // 3. SKU / Inventory check
      const hasInventoryMatch = inventory.some(i => 
        i.sku.toLowerCase().includes(lowerVal) ||
        i.name.toLowerCase().includes(lowerVal) ||
        i.category.toLowerCase().includes(lowerVal)
      );
      if (hasInventoryMatch) {
        navigate(`/admin/inventory?search=${encodeURIComponent(val)}`);
        return;
      }

      // 4. Ledger/journal keyword check
      const ledgerKeywords = ['ledger', 'journal', 'revenue', 'tax', 'cash', 'ar', 'debit', 'credit', 'finance', 'audit'];
      const hasLedgerMatch = ledgerKeywords.some(k => lowerVal.includes(k));
      if (hasLedgerMatch) {
        navigate(`/admin/finance?search=${encodeURIComponent(val)}`);
        return;
      }

      // 5. Fallback to Orders
      navigate(`/admin/orders?search=${encodeURIComponent(val)}`);
    }
  };

  // Deriving notifications from actual store warnings/alerts
  const lowStock = inventory.filter(i => i.quantity <= i.reorderPoint);
  const pendingOrders = orders.filter(o => o.status === 'draft');

  const notifications = [
    ...lowStock.map(item => ({
      id: `stock-${item.sku}`,
      title: 'Low Stock Alert',
      desc: `${item.name} is running low (${item.quantity} stems remaining).`,
      type: 'warning',
      action: () => navigate('/admin/inventory?filter=low')
    })),
    ...pendingOrders.map(order => ({
      id: `order-${order.id}`,
      title: 'New Order Draft',
      desc: `High priority draft for ${order.customerName} needs verification.`,
      type: 'info',
      action: () => navigate('/admin/orders?filter=today')
    }))
  ];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (notifRef.current && !notifRef.current.contains(target)) {
        setIsNotifOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsNotifOpen(false);
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleNotifAction = (action: () => void) => {
    setIsNotifOpen(false);
    action();
  };

  const handleProfileLink = (path: string) => {
    setIsProfileOpen(false);
    navigate(path);
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);
    try {
      await logout();
      addToast('Logged out successfully.', 'info');
      navigate('/admin/login');
    } catch (err: unknown) {
      const errMsg = (err as { message?: string })?.message || 'Logout failed.';
      addToast(errMsg, 'error');
    }
  };

  return (
    <header className={styles.topbar}>
      <div className={styles.searchContainer}>
        <Search className={styles.searchIcon} />
        <input 
          key={location.pathname}
          type="text" 
          placeholder="Search orders, clients, general ledger..." 
          className={styles.searchInput}
          defaultValue={searchParams.get('search') || ''}
          onChange={handleSearchChange}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className={styles.actions}>
        {/* Notifications Popover */}
        <div className={styles.popoverContainer} ref={notifRef}>
          <button 
            className={`${styles.iconButton} ${isNotifOpen ? styles.activeButton : ''}`} 
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsProfileOpen(false);
            }}
          >
            <Bell className={styles.icon} />
            {notifications.length > 0 && <span className={styles.badge}></span>}
          </button>

          {isNotifOpen && (
            <div className={styles.popoverMenu}>
              <div className={styles.popoverHeader}>
                <span className={styles.popoverTitle}>Notifications</span>
                <span className={styles.popoverCount}>{notifications.length} Unresolved</span>
              </div>
              <div className={styles.popoverList}>
                {notifications.length === 0 ? (
                  <div className={styles.emptyState}>
                    <ShieldCheck size={20} className={styles.emptyIcon} />
                    <p>Studio status normal. All lines reporting clear.</p>
                  </div>
                ) : (
                  notifications.map(item => (
                    <button 
                      key={item.id} 
                      className={styles.notifItem}
                      onClick={() => handleNotifAction(item.action)}
                    >
                      <div className={styles.notifIconWrap}>
                        {item.type === 'warning' ? (
                          <AlertTriangle className={styles.notifIconWarning} size={14} />
                        ) : (
                          <Settings className={styles.notifIconInfo} size={14} />
                        )}
                      </div>
                      <div className={styles.notifText}>
                        <p className={styles.notifTitle}>{item.title}</p>
                        <p className={styles.notifDesc}>{item.desc}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className={styles.divider}></div>

        {/* Profile Dropdown Popover */}
        <div className={styles.popoverContainer} ref={profileRef}>
          <button 
            className={styles.profileButton} 
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotifOpen(false);
            }}
          >
            <div className={styles.avatar}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className={styles.avatarImg} />
              ) : (
                <User className={styles.avatarIcon} />
              )}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.name}>{user?.displayName || user?.email || 'Studio Director'}</span>
              <span className={styles.role}>{role || 'Staff'}</span>
            </div>
          </button>

          {isProfileOpen && (
            <div className={`${styles.popoverMenu} ${styles.profileMenuWidth}`}>
              <div className={styles.profileMenuHeader}>
                <p className={styles.profileName}>{user?.displayName || 'BloomPro Operator'}</p>
                <p className={styles.profileEmail}>{user?.email || 'admin@bloompro.studio'}</p>
              </div>

              <div className={styles.popoverList}>
                <button 
                  className={styles.profileItem}
                  onClick={() => handleProfileLink('/admin/orders')}
                >
                  <ListCollapse size={14} />
                  <span>Orders Master Log</span>
                </button>
                <button 
                  className={styles.profileItem}
                  onClick={() => handleProfileLink('/admin/reports')}
                >
                  <Settings size={14} />
                  <span>Executive Reports</span>
                </button>
                
                <div className={styles.menuDivider}></div>

                <button 
                  className={`${styles.profileItem} ${styles.logoutItem}`}
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
