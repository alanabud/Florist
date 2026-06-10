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
  FileText
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import styles from './Sidebar.module.css';

const navGroups = [
  {
    label: 'Operations',
    items: [
      { name: 'Dashboard', to: '/admin', icon: LayoutDashboard },
      { name: 'Orders', to: '/admin/orders', icon: ShoppingBag },
      { name: 'Deliveries', to: '/admin/deliveries', icon: Truck },
      { name: 'Events', to: '/admin/events', icon: CalendarHeart },
    ]
  },
  {
    label: 'Commerce',
    items: [
      { name: 'Storefront', to: '/', icon: Store },
      { name: 'Products', to: '/admin/products', icon: Flower2 },
      { name: 'Customers', to: '/admin/customers', icon: Users },
      { name: 'Subscriptions', to: '/admin/subscriptions', icon: Repeat },
    ]
  },
  {
    label: 'Business',
    items: [
      { name: 'Inventory', to: '/admin/inventory', icon: Package },
      { name: 'Finance', to: '/admin/finance', icon: Landmark },
      { name: 'Receivables', to: '/admin/receivables', icon: FileText },
      { name: 'Purchasing', to: '/admin/purchasing', icon: Truck },
      { name: 'Reports', to: '/admin/reports', icon: BarChart3 },
      { name: 'Operational QA', to: '/admin/qa', icon: ShieldCheck },
      { name: 'Settings', to: '/admin/settings', icon: Settings },
    ]
  }
];

export const Sidebar: React.FC = () => {
  const { role } = useAuthStore();

  const filteredGroups = navGroups.map(group => {
    const items = group.items.filter(item => {
      if (role === 'staff') {
        if (
          item.name === 'Finance' || 
          item.name === 'Receivables' || 
          item.name === 'Purchasing' || 
          item.name === 'QA Checks'
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
          <div key={group.label} className={styles.navGroup}>
            <span className={styles.groupLabel}>{group.label}</span>
            {group.items.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) => 
                  `${styles.navItem} ${isActive ? styles.active : ''}`
                }
                end={item.to === '/admin' || item.to === '/'}
              >
                <div className={styles.navIconWrap}>
                  <item.icon className={styles.navIcon} />
                </div>
                <span>{item.name}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.sidebarFooter}>
        <div className={styles.footerAccent}></div>
        <p className={styles.footerText}>BloomPro v2.1 — Premium Maintenance Revamp</p>
      </div>
    </aside>
  );
};
