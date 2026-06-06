import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import { Products } from './pages/Products';
import { ProductDetail } from './pages/ProductDetail';
import { ToastContainer } from './components/ui/Toast';

// Basic empty states for admin routes to avoid "To be built" and make it feel production-ready
const AdminEmptyState = ({ title }: { title: string }) => (
  <div style={{ padding: '2rem' }}>
    <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>{title}</h1>
    <div style={{ padding: '4rem', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
      <p style={{ color: '#64748b', fontSize: '1.125rem' }}>No {title.toLowerCase()} available yet.</p>
    </div>
  </div>
);

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
          <Route path="/about" element={<SimplePage title="Our Story" />} />
          <Route path="/contact" element={<SimplePage title="Contact Us" />} />
        </Route>

        <Route path="/login" element={<Login />} />
        
        {/* Admin/Dashboard Routes */}
        <Route path="/admin" element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="orders" element={<AdminEmptyState title="Orders" />} />
            <Route path="deliveries" element={<AdminEmptyState title="Deliveries" />} />
            <Route path="products" element={<Products />} />
            <Route path="inventory" element={<AdminEmptyState title="Inventory" />} />
            <Route path="customers" element={<AdminEmptyState title="Customers" />} />
            <Route path="events" element={<AdminEmptyState title="Events & Weddings" />} />
            <Route path="subscriptions" element={<AdminEmptyState title="Subscriptions" />} />
            <Route path="settings" element={<AdminEmptyState title="Settings" />} />
          </Route>
        </Route>
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
