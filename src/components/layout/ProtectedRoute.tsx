import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';

export const ProtectedRoute: React.FC = () => {
  const { user, loading } = useAuthStore();

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-cream)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>❁</div>
          <p style={{ color: 'var(--color-sage-dark)', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>Loading BloomPro Studio...</p>
        </div>
        <style>
          {`
            @keyframes spin { 100% { transform: rotate(360deg); } }
          `}
        </style>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  // Optional: If you wanted strict owner-only routes, you could check `role === 'owner'` here.
  // Currently, the prompt states any authenticated user can reach the dashboard,
  // but Firestore rules protect the data. We'll allow access to Outlet here.

  return <Outlet />;
};
