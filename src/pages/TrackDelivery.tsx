import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useI18n } from '../i18n/I18nProvider';
import { Truck, CheckCircle2, Clock, ShieldAlert, ArrowLeft } from 'lucide-react';

export const TrackDelivery: React.FC = () => {
  const { t } = useI18n();
  const { publicTrackingToken } = useParams<{ publicTrackingToken: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<any>(null);

  useEffect(() => {
    const fetchTracking = async () => {
      if (!publicTrackingToken) {
        setError(t('delivery.errors.expiredToken'));
        setLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'publicDeliveryTracking', publicTrackingToken);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
          setError(t('delivery.errors.expiredToken'));
          setLoading(false);
          return;
        }

        const data = snap.data();

        // Expired check (48h limit)
        const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
        if (expiresAt && expiresAt.getTime() < Date.now()) {
          setError(t('delivery.errors.expiredToken'));
          setLoading(false);
          return;
        }

        setTrackingData(data);
      } catch (err: any) {
        console.error(err);
        setError(t('delivery.errors.expiredToken'));
      } finally {
        setLoading(false);
      }
    };

    fetchTracking();
  }, [publicTrackingToken]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', background: '#FDFCFA' }}>
        <div style={{ fontSize: '3rem', animation: 'spin 2s linear infinite', color: '#4A6B50', marginBottom: '1.5rem' }}>❁</div>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: '#2C302E' }}>{t('common.loading')}</div>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', padding: '2rem', background: '#FDFCFA', textAlign: 'center' }}>
        <ShieldAlert size={64} style={{ color: '#EF4444', marginBottom: '1.5rem' }} />
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', fontWeight: 600, color: '#2C302E', margin: '0 0 0.5rem 0' }}>
          {t('delivery.tracking.trackingExpiredOrInvalid')}
        </h2>
        <p style={{ color: '#6b7280', fontSize: '0.95rem', maxWidth: '400px', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {error}
        </p>
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#4A6B50', fontWeight: 600, textDecoration: 'none' }}>
          <ArrowLeft size={16} /> {t('orderconfirmation.returnToStorefront')}
        </Link>
      </div>
    );
  }

  // Resolve active steps
  const steps = [
    { key: 'dispatch_requested', label: t('delivery.status.dispatch_requested') },
    { key: 'courier_assigned', label: t('delivery.status.courier_assigned') },
    { key: 'in_transit', label: t('delivery.status.in_transit') },
    { key: 'delivered', label: t('delivery.status.delivered') }
  ];

  const getStepStatus = (stepKey: string) => {
    const statusOrder = ['draft', 'quote_requested', 'quoted', 'dispatch_requested', 'courier_assigned', 'pickup_ready', 'picked_up', 'in_transit', 'delivered'];
    const currentIdx = statusOrder.indexOf(trackingData.status);
    
    if (stepKey === 'dispatch_requested') {
      return currentIdx >= 3 ? 'completed' : 'pending';
    }
    if (stepKey === 'courier_assigned') {
      return currentIdx >= 4 ? 'completed' : 'pending';
    }
    if (stepKey === 'in_transit') {
      return currentIdx >= 6 ? 'completed' : 'pending';
    }
    if (stepKey === 'delivered') {
      return currentIdx >= 8 ? 'completed' : 'pending';
    }
    return 'pending';
  };

  return (
    <div style={{ background: '#FDFCFA', minHeight: '100vh', padding: '3rem 2rem', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '640px' }}>
        
        {/* Header card */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.25rem', color: '#2C302E', margin: 0, fontWeight: 600 }}>
            {t('delivery.tracking.title')}
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.5rem' }}>
            {t('delivery.tracking.subtitle')}
          </p>
        </div>

        {/* Info Box */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '1.5rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>
                {t('orders.orderId')}
              </span>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: '#2C302E', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                #{trackingData.orderDisplayNumber}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>
                {t('delivery.tracking.destination')}
              </span>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#2C302E', marginTop: '0.25rem' }}>
                {t('delivery.tracking.recipient')}: {trackingData.recipientFirstName}
              </div>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #F0EDE6', margin: '1.25rem 0' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>
                {t('delivery.tracking.carrier')}
              </span>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#2C302E', marginTop: '0.25rem' }}>
                {trackingData.courierFirstName || t('delivery.tracking.assignedCourier')}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.125rem' }}>
                {t('delivery.tracking.vehicle')}: {trackingData.courierVehicleLabel || t('delivery.tracking.car')}
              </div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#8a8f8c', fontWeight: 700, letterSpacing: '0.05em' }}>
                {t('delivery.tracking.eta')}
              </span>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#4A6B50', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Clock size={16} /> {trackingData.etaWindowEnd ? new Date(trackingData.etaWindowEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : t('delivery.tracking.flexibleEta')}
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E8EAE6', borderRadius: '16px', padding: '2rem', boxShadow: '0 4px 20px rgba(44, 48, 46, 0.03)', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: '#8a8f8c', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
            {t('delivery.tracking.progress')}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
            {/* Connector Line */}
            <div style={{ position: 'absolute', left: '11px', top: '10px', bottom: '10px', width: '2px', background: '#E8EAE6', zIndex: 1 }} />
            
            {steps.map((step) => {
              const status = getStepStatus(step.key);
              const isCompleted = status === 'completed';

              return (
                <div key={step.key} style={{ display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 2 }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: isCompleted ? '#4A6B50' : '#FFFFFF',
                    border: `2px solid ${isCompleted ? '#4A6B50' : '#E8EAE6'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: isCompleted ? '#FFFFFF' : '#8a8f8c'
                  }}>
                    {isCompleted ? <CheckCircle2 size={14} /> : <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#8a8f8c' }} />}
                  </div>
                  <div>
                    <span style={{
                      fontSize: '0.9375rem',
                      fontWeight: isCompleted ? 600 : 500,
                      color: isCompleted ? '#2C302E' : '#9ca3af'
                    }}>
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live tracking link */}
        {trackingData.trackingUrl && trackingData.trackingUrl !== `/track-delivery/${publicTrackingToken}` && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <a href={trackingData.trackingUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#4A6B50', fontWeight: 600, textDecoration: 'underline' }}>
              <Truck size={16} /> {t('delivery.tracking.liveMapRoute')}
            </a>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
            {t('delivery.tracking.footerMessage')}
          </p>
        </div>

      </div>
    </div>
  );
};
