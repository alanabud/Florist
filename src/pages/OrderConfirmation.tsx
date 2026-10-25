import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useCartStore } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CheckCircle2, ShoppingBag, Calendar, MapPin, ArrowRight } from 'lucide-react';
import styles from './OrderConfirmation.module.css';
import { useI18n } from '../i18n/I18nProvider';
import { formatFulfillmentDateLong } from '../services/checkoutValidation';
import { studioPickupDisplayLines } from '../config/siteConfig';

interface ConfirmationData {
  orderNumber: string;
  deliveryDate: string;
  recipientFirstName: string;
  city: string;
  state: string;
  itemsSummary: string;
  deliveryType?: string;
  subtotal?: number;
  deliveryFee?: number;
  taxes?: number;
  total?: number;
  /** 'demo' when the tracking doc was created by the demo payment flow. */
  paymentMode?: string;
}

export const OrderConfirmation: React.FC = () => {
  const { t } = useI18n();
  const { trackingLookupId } = useParams<{ trackingLookupId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clearCart = useCartStore(state => state.clearCart);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [order, setOrder] = useState<ConfirmationData | null>(null);

  useEffect(() => {
    // Arriving from Stripe's hosted checkout (success URL carries the
    // session_id) means the purchase just completed — the cart has done
    // its job. Direct tracking lookups leave the cart untouched.
    if (searchParams.get('session_id')) {
      clearCart();
    }

    const fetchConfirmation = async () => {
      if (!trackingLookupId) {
        setError(true);
        setIsLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'publicOrderTracking', trackingLookupId);
        // The tracking document is created by the Stripe webhook when the
        // payment is confirmed, which can land a few seconds after Stripe
        // redirects back here — poll briefly before declaring it missing.
        for (let attempt = 0; attempt < 8; attempt++) {
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setOrder(docSnap.data() as ConfirmationData);
            setIsLoading(false);
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
        setError(true);
      } catch (err) {
        console.error("Failed to load confirmation details:", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfirmation();
  }, [trackingLookupId, searchParams, clearCart]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}>❁</div>
        <p>{t('orderconfirmation.loadingConfirmationDetails')}</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorIcon}>✕</div>
        <h2>{t('orderconfirmation.confirmationNotFound')}</h2>
        <p>{t('orderconfirmation.notFoundDetailedDesc')}</p>
        <div className={styles.errorActions}>
          <Button onClick={() => navigate('/')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none' }}>
            {t('orderconfirmation.returnToStorefront')}
          </Button>
          <Button variant="outline" onClick={() => navigate('/track-order')} style={{ border: '1px solid #D5D1C8', color: '#2C302E' }}>
            {t('orderconfirmation.goToTrackOrder')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.confirmPage}>
      <div className={styles.container}>
        <Card className={styles.successCard}>
          <div className={styles.successHeader}>
            <CheckCircle2 size={64} className={styles.checkIcon} />
            <span className={styles.thanks}>{t('orderconfirmation.thankYou')}</span>
            <h1 className={styles.pageTitle}>{t('orderconfirmation.yourOrderIsConfirmed')}</h1>
            <p className={styles.subtitle}>
              {t('orderconfirmation.orderConfirmedMessage')}
            </p>
            {(order.paymentMode === 'demo' ||
              (searchParams.get('session_id') ?? '').startsWith('demo_')) && (
              <p className={styles.demoNotice}>{t('orderconfirmation.demoNotice')}</p>
            )}
          </div>

          <div className={styles.orderNumberBox}>
            <span className={styles.label}>{t('orderconfirmation.yourTrackingNumber')}</span>
            <span className={styles.orderNum}>{order.orderNumber}</span>
            <p className={styles.savePrompt}>{t('orderconfirmation.saveThisNumberToTrackYourDeliveryStatusLater')}</p>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailBlock}>
              <MapPin size={20} className={styles.detailIcon} />
              <div>
                {order.deliveryType === 'pickup' ? (
                  <>
                    <h3>{t('orderconfirmation.pickupLocation')}</h3>
                    {studioPickupDisplayLines(t('orderconfirmation.pickupAtStudio')).map((line, index) => (
                      <p key={`${index}-${line}`}>{line}</p>
                    ))}
                  </>
                ) : (
                  <>
                    <h3>{t('orderconfirmation.deliveryResidence')}</h3>
                    <p>{t('orderconfirmation.recipientHome').replace('{name}', order.recipientFirstName)}</p>
                    <p>{order.city}, {order.state}</p>
                  </>
                )}
              </div>
            </div>

            <div className={styles.detailBlock}>
              <Calendar size={20} className={styles.detailIcon} />
              <div>
                <h3>{order.deliveryType === 'pickup' ? t('orderconfirmation.pickupScheduled') : t('orderconfirmation.deliveryScheduled')}</h3>
                <p>{formatFulfillmentDateLong(order.deliveryDate) ?? t('orderconfirmation.fulfillmentDatePending')}</p>
              </div>
            </div>
          </div>

          <div className={styles.itemsSummary}>
            <h3>{t('orderconfirmation.arrangementsDetails')}</h3>
            <div className={styles.itemsBlock}>
              <ShoppingBag size={18} className={styles.itemsIcon} />
              <span className={styles.itemsText}>{order.itemsSummary}</span>
            </div>
            {typeof order.total === 'number' && (
              <div className={styles.totalsBlock}>
                <div className={styles.totalRow}>
                  <span>{t('checkout.subtotal')}</span>
                  <span>${(order.subtotal ?? 0).toFixed(2)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>{t('checkout.delivery')}</span>
                  <span>${(order.deliveryFee ?? 0).toFixed(2)}</span>
                </div>
                <div className={styles.totalRow}>
                  <span>{t('checkout.taxesEstimated')}</span>
                  <span>${(order.taxes ?? 0).toFixed(2)}</span>
                </div>
                <div className={`${styles.totalRow} ${styles.totalGrand}`}>
                  <span>{t('checkout.total')}</span>
                  <span>${order.total.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <div className={styles.emailNotice}>
            <p>{t('orderconfirmation.emailNotice')}</p>
          </div>

          <div className={styles.actions}>
            <Button 
              size="lg" 
              onClick={() => navigate(`/track-order?order=${encodeURIComponent(order.orderNumber)}`)}
              style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', color: '#FFF' }}
            >
              {t('orderconfirmation.trackLiveStatus')} <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => navigate('/shop')}
              style={{ border: '1px solid #D5D1C8', color: '#2C302E' }}
            >
              {t('orderconfirmation.backToCatalog')}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
