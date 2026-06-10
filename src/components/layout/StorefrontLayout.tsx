import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, Menu } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { CartDrawer } from '../ui/CartDrawer/CartDrawer';
import { Drawer } from '../ui/Drawer';
import styles from './StorefrontLayout.module.css';

export const StorefrontLayout: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleDrawer, getTotalItems } = useCartStore();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [prevPath, setPrevPath] = useState(location.pathname);
  if (location.pathname !== prevPath) {
    setPrevPath(location.pathname);
    setIsMobileMenuOpen(false);
  }

  const isActive = (path: string) => location.pathname === path;

  const renderNavLinks = () => (
    <>
      <Link to="/" className={`${styles.navLink} ${isActive('/') ? styles.active : ''}`}>Home</Link>
      <Link to="/shop" className={`${styles.navLink} ${isActive('/shop') ? styles.active : ''}`}>Shop Flowers</Link>
      <Link to="/occasions" className={`${styles.navLink} ${isActive('/occasions') ? styles.active : ''}`}>Occasions</Link>
      <Link to="/contact" className={`${styles.navLink} ${isActive('/contact') ? styles.active : ''}`}>Weddings & Events</Link>
      <Link to="/track-order" className={`${styles.navLink} ${isActive('/track-order') ? styles.active : ''}`}>Track Order</Link>
    </>
  );

  return (
    <div className={styles.layout}>
      <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
        <div className={styles.headerContainer}>
          <div className={styles.mobileLeft}>
            <button 
              className={styles.iconBtn} 
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={24} />
            </button>
          </div>
          
          <Link to="/" className={styles.logo}>
            <span className={styles.logoIcon}>❁</span>
            BloomPro Florals
          </Link>
 
          <nav className={styles.desktopNav}>
            {renderNavLinks()}
          </nav>
 
          <div className={styles.actions}>
            <button 
              className={styles.cartBtn} 
              onClick={toggleDrawer}
              aria-label="Open cart"
            >
              <ShoppingBag size={20} />
              {getTotalItems() > 0 && (
                <span className={styles.cartBadge}>{getTotalItems()}</span>
              )}
            </button>
            <button 
              className={styles.loginBtn}
              onClick={() => navigate('/admin/login')}
            >
              <User size={18} />
              <span>Staff Login</span>
            </button>
          </div>
        </div>
      </header>
 
      {/* Mobile Menu Drawer */}
      <Drawer 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
        position="left"
        width="300px"
      >
        <div className={styles.mobileMenu}>
          <div className={styles.mobileLogo}>
            <span className={styles.logoIcon}>❁</span>
            BloomPro Florals
          </div>
          <nav className={styles.mobileNav}>
            {renderNavLinks()}
          </nav>
          <div className={styles.mobileMenuFooter}>
            <button 
              className={styles.mobileLoginBtn}
              onClick={() => navigate('/admin/login')}
            >
              <User size={18} />
              Staff Login
            </button>
          </div>
        </div>
      </Drawer>
 
      <CartDrawer />
 
      <main className={styles.main}>
        <Outlet />
      </main>
 
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerBrand}>
            <h3><span className={styles.logoIcon}>❁</span> BloomPro Florals</h3>
            <p>Premium, handcrafted floral arrangements delivered with care.</p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <h4>Shop</h4>
              <Link to="/shop">All Products</Link>
              <Link to="/occasions">Occasions</Link>
              <Link to="/custom">Custom Bouquet</Link>
            </div>
            <div>
              <h4>Company</h4>
              <Link to="/about">About Us</Link>
              <Link to="/contact">Contact</Link>
              <Link to="/track-order">Track Order</Link>
            </div>
            <div>
              <h4>Operations</h4>
              <Link to="/admin/login" style={{ fontWeight: 600, color: 'var(--color-sage-dark)' }}>Staff Login</Link>
              <Link to="/about">Terms of Service</Link>
              <Link to="/about">Privacy Policy</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} BloomPro Florals. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};
