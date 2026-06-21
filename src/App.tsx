import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { StorefrontLayout } from './components/layout/StorefrontLayout';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { Occasions } from './pages/Occasions';
import { CustomBouquet } from './pages/CustomBouquet';
import { Checkout } from './pages/Checkout';
import { Cart } from './pages/Cart';
import { TrackOrder } from './pages/TrackOrder';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { Products } from './pages/Products';
import { ProductDetail } from './pages/ProductDetail';
import { FinanceAdmin } from './pages/FinanceAdmin';
import { Orders } from './pages/Orders';
import { Deliveries } from './pages/Deliveries';
import { Inventory } from './pages/Inventory';
import { Customers } from './pages/Customers';
import { Events } from './pages/Events';
import { Subscriptions } from './pages/Subscriptions';
import { Settings } from './pages/Settings';
import { Reports } from './pages/Reports';
import { QA } from './pages/QA';
import { AccountsReceivable } from './pages/AccountsReceivable';
import { PurchasingConsole } from './pages/PurchasingConsole';
import { ReconciliationCenter } from './pages/ReconciliationCenter';
import { TrackDelivery } from './pages/TrackDelivery';
import { CompanyGuard } from './components/common/CompanyGuard';
import { ToastContainer } from './components/ui/Toast';
import { useI18n } from './i18n/I18nProvider';

// Placeholder pages for about/contact
const SimplePage = ({ title }: { title: string }) => (
  <div style={{ maxWidth: '800px', margin: '4rem auto', textAlign: 'center', padding: '0 2rem' }}>
    <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>{title}</h1>
    <p style={{ fontSize: '1.125rem', color: '#64748b', lineHeight: '1.8' }}>
      This page is part of our upcoming content expansion. Check back soon for our full {title.toLowerCase()} details.
    </p>
  </div>
);

function App() {
  const { t } = useI18n();
  return (
    <Router>
      <Routes>
        {/* Public Routes with Storefront Layout */}
        <Route element={<StorefrontLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/occasions" element={<Occasions />} />
          <Route path="/custom" element={<CustomBouquet />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/track-order" element={<TrackOrder />} />
          <Route path="/track-delivery/:publicTrackingToken" element={<TrackDelivery />} />
          <Route path="/order-confirmation/:trackingLookupId" element={<OrderConfirmation />} />
          <Route path="/about" element={<SimplePage title={t('landing.footer.ourStory')} />} />
          <Route path="/contact" element={<SimplePage title={t('common.contactUs')} />} />
        </Route>

        <Route path="/admin/login" element={<Login />} />
        
        {/* Admin/Dashboard Routes */}
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="orders" element={<Orders />} />
            <Route path="deliveries" element={<Deliveries />} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<CompanyGuard><Inventory /></CompanyGuard>} />
            <Route path="customers" element={<Customers />} />
            <Route path="events" element={<Events />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="finance" element={<CompanyGuard><FinanceAdmin /></CompanyGuard>} />
            <Route path="receivables" element={<CompanyGuard><AccountsReceivable /></CompanyGuard>} />
            <Route path="purchasing" element={<CompanyGuard><PurchasingConsole /></CompanyGuard>} />
            <Route path="reconciliation" element={<CompanyGuard><ReconciliationCenter /></CompanyGuard>} />
            <Route path="reports" element={<CompanyGuard><Reports /></CompanyGuard>} />
            <Route path="qa" element={<CompanyGuard><QA /></CompanyGuard>} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
