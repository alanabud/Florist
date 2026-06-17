import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { CheckCircle2, ShoppingBag, Calendar, MapPin, ArrowRight } from 'lucide-react';
import styles from './OrderConfirmation.module.css';
import { useI18n } from '../i18n/I18nProvider';

interface ConfirmationData {
  orderNumber: string;
  deliveryDate: string;
  recipientFirstName: string;
  city: string;
  state: string;
  itemsSummary: string;
}

export const OrderConfirmation: React.FC = () => {
  const { t } = useI18n();
  const { trackingLookupId } = useParams<{ trackingLookupId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [order, setOrder] = useState<ConfirmationData | null>(null);

  useEffect(() => {
    const fetchConfirmation = async () => {
      if (!trackingLookupId) {
        setError(true);
        setIsLoading(false);
        return;
      }

      try {
        const docRef = doc(db, 'publicOrderTracking', trackingLookupId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setOrder(docSnap.data() as ConfirmationData);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load confirmation details:", err);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfirmation();
  }, [trackingLookupId]);

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
        <p>{t('orderconfirmation.weCouldntRetrieveConfirmationDetailsForThisIdentifierIfYouJustPlace')}d an order, please check your email or verify in the tracking console.</p>
        <div className={styles.errorActions}>
          <Button onClick={() => navigate('/')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none' }}>
            Return to Storefront
          </Button>
          <Button variant="outline" onClick={() => navigate('/track-order')} style={{ border: '1px solid #D5D1C8', color: '#2C302E' }}>
            Go to Track Order
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
              We have received your request. Our floral designers will begin handcrafting your arrangements soon.
            </p>
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
                <h3>{t('orderconfirmation.deliveryResidence')}</h3>
                <p>{order.recipientFirstName}'s home</p>
                <p>{order.city}, {order.state}</p>
              </div>
            </div>

            <div className={styles.detailBlock}>
              <Calendar size={20} className={styles.detailIcon} />
              <div>
                <h3>{t('orderconfirmation.deliveryScheduled')}</h3>
                <p>{new Date(order.deliveryDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
              </div>
            </div>
          </div>

          <div className={styles.itemsSummary}>
            <h3>{t('orderconfirmation.arrangementsDetails')}</h3>
            <div className={styles.itemsBlock}>
              <ShoppingBag size={18} className={styles.itemsIcon} />
              <span className={styles.itemsText}>{order.itemsSummary}</span>
            </div>
          </div>

          <div className={styles.emailNotice}>
            <p>A detailed receipt and invoice have been dispatched to your email address.</p>
          </div>

          <div className={styles.actions}>
            <Button 
              size="lg" 
              onClick={() => navigate(`/track-order?order=${order.orderNumber}`)}
              style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', color: '#FFF' }}
            >
              Track Live Status <ArrowRight size={16} style={{ marginLeft: '0.5rem' }} />
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => navigate('/shop')}
              style={{ border: '1px solid #D5D1C8', color: '#2C302E' }}
            >
              Back to Catalog
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
