import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, User, Menu, Search } from 'lucide-react';
import { useCartStore } from '../../store/cartStore';
import { CartDrawer } from '../ui/CartDrawer/CartDrawer';
import { Drawer } from '../ui/Drawer';
import { useI18n } from '../../i18n/I18nProvider';
import { LanguageSwitcher } from '../common/LanguageSwitcher';
import styles from './StorefrontLayout.module.css';

export const StorefrontLayout: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toggleDrawer, getTotalItems } = useCartStore();
  const { t } = useI18n();

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
      <Link to="/shop" className={`${styles.navLink} ${isActive('/shop') ? styles.active : ''}`}>
        {t('storefront.shopFlowers')} <span className={styles.chevronInline}>˅</span>
      </Link>
      <Link to="/occasions" className={`${styles.navLink} ${isActive('/occasions') ? styles.active : ''}`}>
        {t('storefront.occasions')} <span className={styles.chevronInline}>˅</span>
      </Link>
      <Link to="/contact" className={`${styles.navLink} ${isActive('/contact') ? styles.active : ''}`}>
        {t('storefront.weddingsEvents')}
      </Link>
      <Link to="/shop?category=Plants" className={`${styles.navLink} ${isActive('/shop?category=Plants') ? styles.active : ''}`}>
        {t('storefront.plants')}
      </Link>
      <Link to="/track-order" className={`${styles.navLink} ${isActive('/track-order') ? styles.active : ''}`}>
        {t('storefront.trackOrder')}
      </Link>
    </>
  );

  return (
    <div className={styles.layout}>
      {/* Announcement Bar */}
      <div className={styles.announcementBar}>
        <span className={styles.announcementIcon}>❁</span>
        <span>{t('storefront.announcement')}</span>
      </div>

      <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
        <div className={styles.headerContainer}>
          <div className={styles.mobileLeft}>
            <button 
              className={styles.iconBtn} 
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label={t('layout.openMenu')}
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
            <div className={styles.headerLang}>
              <LanguageSwitcher />
            </div>
            <button 
              className={styles.iconBtnAction}
              onClick={() => navigate('/shop')}
              aria-label={t('common.search')}
            >
              <Search size={20} />
            </button>
            <button 
              className={`${styles.iconBtnAction} ${styles.headerUser}`}
              onClick={() => navigate('/admin/login')}
              aria-label={t('storefront.staffLogin')}
            >
              <User size={20} />
            </button>
            <button 
              className={styles.cartBtn} 
              onClick={toggleDrawer}
              aria-label={t('layout.openCart')}
            >
              <ShoppingBag size={20} />
              <span className={styles.cartBadge}>{getTotalItems()}</span>
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <LanguageSwitcher />
            </div>
            <button 
              className={styles.mobileLoginBtn}
              onClick={() => navigate('/admin/login')}
            >
              <User size={18} />
              {t('storefront.staffLogin')}
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
            <p>{t('landing.footer.brandDesc')}</p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <h4>{t('landing.footer.shop')}</h4>
              <Link to="/shop">{t('landing.footer.allProducts')}</Link>
              <Link to="/occasions">{t('storefront.occasions')}</Link>
              <Link to="/custom">{t('landing.hero.customBouquet')}</Link>
            </div>
            <div>
              <h4>{t('landing.footer.about')}</h4>
              <Link to="/about">{t('landing.footer.ourStory')}</Link>
              <Link to="/contact">{t('landing.footer.contact')}</Link>
              <Link to="/track-order">{t('storefront.trackOrder')}</Link>
            </div>
            <div>
              <h4>{t('landing.footer.policies')}</h4>
              <Link to="/admin/login" style={{ fontWeight: 600, color: 'var(--color-sage-dark)' }}>{t('storefront.staffLogin')}</Link>
              <Link to="/about">{t('landing.footer.terms')}</Link>
              <Link to="/about">{t('landing.footer.privacy')}</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} BloomPro Florals. {t('landing.footer.rightsReserved')}</p>
        </div>
      </footer>
    </div>
  );
};
