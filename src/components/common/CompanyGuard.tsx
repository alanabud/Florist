import React from 'react';
import { useCompany, isValidCompanyId } from '../../context/CompanyContext';
import { useI18n } from '../../i18n/I18nProvider';
import { Building, AlertCircle, RefreshCw } from 'lucide-react';

export const CompanyGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useI18n();
  const {
    activeCompanyId,
    isCompanyLoading,
    companyContextError,
    refreshCompanyContext,
    companies,
    setActiveCompany
  } = useCompany();

  if (isCompanyLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        width: '100%',
        color: '#6c8271',
        fontFamily: 'var(--font-sans)'
      }}>
        <RefreshCw size={36} className="animate-spin-helper" style={{ color: '#6C8271', marginBottom: '1rem' }} />
        <p style={{ fontSize: '0.9375rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
          {t('layout.loadingCompanyContext') || 'Loading company context...'}
        </p>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin-helper {
            100% { transform: rotate(360deg); }
          }
          .animate-spin-helper {
            animation: spin-helper 2s linear infinite;
          }
        `}} />
      </div>
    );
  }

  if (companyContextError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        width: '100%',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)'
      }}>
        <div style={{
          background: '#FEF2F2',
          border: '1px solid #FCA5A5',
          borderRadius: '16px',
          padding: '2.5rem',
          maxWidth: '480px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          <div style={{ background: '#FEE2E2', color: '#EF4444', padding: '0.75rem', borderRadius: '50%' }}>
            <AlertCircle size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#991B1B', margin: 0 }}>
            Company Context Hydration Failed
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#7f1d1d', lineHeight: '1.6', margin: 0 }}>
            {companyContextError.message || 'An unexpected error occurred while resolving company memberships.'}
          </p>
          <button
            onClick={() => refreshCompanyContext()}
            style={{
              marginTop: '0.5rem',
              background: '#DC2626',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              padding: '0.625rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#B91C1C'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#DC2626'}
          >
            Retry company context
          </button>
        </div>
      </div>
    );
  }

  if (!isValidCompanyId(activeCompanyId)) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        width: '100%',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: 'var(--font-sans)'
      }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E8EAE6',
          borderRadius: '16px',
          padding: '2.5rem',
          maxWidth: '480px',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          <div style={{ background: '#FAF9F5', color: '#6C8271', padding: '0.75rem', borderRadius: '50%', border: '1px solid #E8EAE6' }}>
            <Building size={32} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#2C302E', margin: 0 }}>
            Active Company Context Required
          </h3>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.6', margin: 0 }}>
            You must select an active company context before you can view or perform transactions in this module.
          </p>
          
          {companies.length > 0 ? (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#4b5563', textAlign: 'left' }}>
                Select Available Company:
              </label>
              <select
                onChange={(e) => setActiveCompany(e.target.value)}
                defaultValue=""
                style={{
                  width: '100%',
                  padding: '0.625rem',
                  borderRadius: '8px',
                  border: '1px solid #D1D5DB',
                  background: '#FFFFFF',
                  fontSize: '0.875rem',
                  color: '#374151',
                  outline: 'none'
                }}
              >
                <option value="" disabled>-- Choose a company --</option>
                {companies.map((comp) => (
                  <option key={comp.id} value={comp.id}>
                    {comp.displayName || comp.legalName}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginTop: '0.5rem' }}>
              <p style={{ fontSize: '0.8125rem', color: '#991B1B', fontWeight: 500 }}>
                No registered company memberships found for your account.
              </p>
              <button
                onClick={() => refreshCompanyContext()}
                style={{
                  marginTop: '1rem',
                  background: '#6C8271',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Refresh Account
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
