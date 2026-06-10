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
import { ToastContainer } from './components/ui/Toast';

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
          <Route path="/order-confirmation/:trackingLookupId" element={<OrderConfirmation />} />
          <Route path="/about" element={<SimplePage title="Our Story" />} />
          <Route path="/contact" element={<SimplePage title="Contact Us" />} />
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
            <Route path="inventory" element={<Inventory />} />
            <Route path="customers" element={<Customers />} />
            <Route path="events" element={<Events />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="finance" element={<FinanceAdmin />} />
            <Route path="receivables" element={<AccountsReceivable />} />
            <Route path="purchasing" element={<PurchasingConsole />} />
            <Route path="reports" element={<Reports />} />
            <Route path="qa" element={<QA />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
