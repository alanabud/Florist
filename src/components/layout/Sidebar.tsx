import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  ShoppingBag, 
  Truck, 
  Users, 
  CalendarHeart, 
  Repeat, 
  Settings,
  Flower2,
  Landmark,
  BarChart3,
  ShieldCheck,
  FileText,
  Scale
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useCompany } from '../../context/CompanyContext';
import { useI18n } from '../../i18n/I18nProvider';
import { buildInfo, buildLabel } from '../../config/buildInfo';
import styles from './Sidebar.module.css';

const navGroups = [
  {
    id: 'operations',
    labelKey: 'navigation.operations',
    items: [
      { id: 'dashboard', labelKey: 'navigation.dashboard', to: '/admin', icon: LayoutDashboard },
      { id: 'orders', labelKey: 'navigation.orders', to: '/admin/orders', icon: ShoppingBag },
      { id: 'deliveries', labelKey: 'navigation.deliveries', to: '/admin/deliveries', icon: Truck },
      { id: 'events', labelKey: 'navigation.events', to: '/admin/events', icon: CalendarHeart },
    ]
  },
  {
    id: 'commerce',
    labelKey: 'navigation.commerce',
    items: [
      { id: 'storefront', labelKey: 'navigation.storefront', to: '/', icon: Store },
      { id: 'products', labelKey: 'navigation.products', to: '/admin/products', icon: Flower2 },
      { id: 'customers', labelKey: 'navigation.customers', to: '/admin/customers', icon: Users },
      { id: 'subscriptions', labelKey: 'navigation.subscriptions', to: '/admin/subscriptions', icon: Repeat },
    ]
  },
  {
    id: 'business',
    labelKey: 'navigation.business',
    items: [
      { id: 'inventory', labelKey: 'navigation.inventory', to: '/admin/inventory', icon: Package },
      { id: 'finance', labelKey: 'navigation.finance', to: '/admin/finance', icon: Landmark },
      { id: 'receivables', labelKey: 'navigation.receivables', to: '/admin/receivables', icon: FileText },
      { id: 'purchasing', labelKey: 'navigation.purchasing', to: '/admin/purchasing', icon: Truck },
      { id: 'reconciliation', labelKey: 'navigation.reconciliation', to: '/admin/reconciliation', icon: Scale },
      { id: 'reports', labelKey: 'navigation.reports', to: '/admin/reports', icon: BarChart3 },
      { id: 'qa', labelKey: 'navigation.qa', to: '/admin/qa', icon: ShieldCheck },
      { id: 'settings', labelKey: 'navigation.settings', to: '/admin/settings', icon: Settings },
    ]
  }
];

export const Sidebar: React.FC = () => {
  const { role } = useAuthStore();
  const { userRole } = useCompany();
  const { t } = useI18n();

  const filteredGroups = navGroups.map(group => {
    const items = group.items.filter(item => {
      // Effective role: the ACTIVE COMPANY membership role wins; the global
      // role is only a fallback (P3.4-DEF-2 — gating on the global role hid
      // business modules from legitimate company admins).
      if ((userRole || role) === 'staff') {
        if (
          item.id === 'finance' || 
          item.id === 'receivables' || 
          item.id === 'purchasing' || 
          item.id === 'reconciliation' ||
          item.id === 'qa'
        ) {
          return false;
        }
      }
      return true;
    });
    return { ...group, items };
  }).filter(group => group.items.length > 0);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <div className={styles.logoMark}>
          <Flower2 className={styles.logoIcon} />
        </div>
        <div className={styles.logoTextWrap}>
          <h1 className={styles.logoText}>BloomPro</h1>
          <span className={styles.logoSub}>Studio</span>
        </div>
      </div>
      
      <nav className={styles.nav}>
        {filteredGroups.map((group) => (
          <div key={group.id} className={styles.navGroup}>
            <span className={styles.groupLabel}>{t(group.labelKey)}</span>
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                className={({ isActive }) => 
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
                end={item.to === '/admin' || item.to === '/'}
              >
                <div className={styles.navIconWrap}>
                  <item.icon className={styles.navIcon} />
                </div>
                <span>{t(item.labelKey)}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.footerAccent}></div>
        <p className={styles.footerText} title={buildInfo.builtAt}>BloomPro Studio · {buildLabel()}</p>
      </div>
    </aside>
  );
};
