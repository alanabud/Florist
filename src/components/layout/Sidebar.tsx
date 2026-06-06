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
  Flower2
} from 'lucide-react';
import styles from './Sidebar.module.css';

const navigation = [
  { name: 'Dashboard', to: '/admin', icon: LayoutDashboard },
  { name: 'Storefront', to: '/', icon: Store },
  { name: 'Orders', to: '/admin/orders', icon: ShoppingBag },
  { name: 'Deliveries', to: '/admin/deliveries', icon: Truck },
  { name: 'Products', to: '/admin/products', icon: Flower2 },
  { name: 'Inventory', to: '/admin/inventory', icon: Package },
  { name: 'Customers', to: '/admin/customers', icon: Users },
  { name: 'Events', to: '/admin/events', icon: CalendarHeart },
  { name: 'Subscriptions', to: '/admin/subscriptions', icon: Repeat },
  { name: 'Settings', to: '/admin/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className={styles.sidebar}>
      <div className={styles.logoContainer}>
        <Flower2 className={styles.logoIcon} />
        <h1 className={styles.logoText}>BloomPro</h1>
      </div>
      <nav className={styles.nav}>
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            className={({ isActive }) => 
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
            end={item.to === '/admin' || item.to === '/'}
          >
            <item.icon className={styles.navIcon} />
            {item.name}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
