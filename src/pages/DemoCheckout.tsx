import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Lock, AlertTriangle } from 'lucide-react';
import {
  readDemoOrderSummary,
  confirmDemoPayment,
  demoSuccessPath,
  DEMO_TEST_CARDS,
} from '../services/demoCheckoutService';
import { useI18n } from '../i18n/I18nProvider';
import styles from './DemoCheckout.module.css';

/**
 * Simulated hosted payment page for DEMO mode (/demo-checkout/:orderId).
 *
 * Stands in for Stripe's hosted checkout page while the store has no
 * real Stripe keys (PAYMENTS_MODE 'demo' — see src/config/stripeConfig.ts).
 * It is labeled as a demo everywhere it matters, accepts only the two
 * well-known test card numbers, and NEVER transmits the entered card
 * number anywhere: a successful test card triggers the client-side demo
 * confirmation (rules-quarantined — see demoCheckoutService.ts and
 * isValidGuestDemoPaymentConfirm in firestore.rules), and the order
 * ends up paymentStatus 'demo_paid' — never 'paid'.
 */
export const DemoCheckout: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { orderId } = useParams<{ orderId: string }>();
  const summary = useMemo(
    () => (orderId ? readDemoOrderSummary(orderId) : null),
    [orderId]
  );

  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!summary || !orderId) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.demoBanner}>
            <AlertTriangle size={18} /> {t('demoCheckout.banner')}
          </div>
          <h1 className={styles.title}>{t('demoCheckout.notFoundTitle')}</h1>
          <p className={styles.note}>{t('demoCheckout.notFoundBody')}</p>
          <button
            type="button"
            className={styles.payBtn}
            onClick={() => navigate('/checkout')}
          >
            {t('demoCheckout.backToCheckout')}
          </button>
        </div>
      </div>
    );
  }

  const formatCardNumber = (value: string): string =>
    value
      .replace(/\D/g, '')
      .slice(0, 19)
      .replace(/(.{4})/g, '$1 ')
      .trim();

  const formatExpiry = (value: string): string => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const isExpiryValid = (value: string): boolean => {
    const m = value.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    const month = Number(m[1]);
    const year = 2000 + Number(m[2]);
    if (month < 1 || month > 12) return false;
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const digits = cardNumber.replace(/\D/g, '');

    if (digits === DEMO_TEST_CARDS.decline) {
      setError(t('demoCheckout.declineError'));
      return;
    }
    if (digits !== DEMO_TEST_CARDS.success || !isExpiryValid(expiry) || !/^\d{3,4}$/.test(cvc)) {
      setError(t('demoCheckout.invalidCardError'));
      return;
    }

    try {
      setIsProcessing(true);
      // The card number never crosses the wire — the confirmation writes
      // only the order's quarantined demo transition + tracking doc.
      await confirmDemoPayment(orderId);
      navigate(demoSuccessPath(summary), { replace: true });
    } catch (err) {
      console.error('Demo payment confirmation failed', err);
      setError(t('demoCheckout.confirmFailed'));
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.demoBanner}>
          <AlertTriangle size={18} /> {t('demoCheckout.banner')}
        </div>

        <div className={styles.brandRow}>
          <span className={styles.brand}>BloomPro</span>
          <span className={styles.secure}>
            <Lock size={14} /> {t('demoCheckout.title')}
          </span>
        </div>

        <p className={styles.note}>{t('demoCheckout.simulatedNote')}</p>

        <div className={styles.summary}>
          <h2>{t('demoCheckout.orderSummary')}</h2>
          <p className={styles.orderLine}>
            {t('demoCheckout.orderLabel')} {summary.orderNumber}
          </p>
          {summary.items.map((item, idx) => (
            <div key={idx} className={styles.summaryRow}>
              <span>
                {item.name} × {item.quantity}
              </span>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
          <div className={styles.summaryRow}>
            <span>{t('checkout.delivery')}</span>
            <span>${summary.deliveryFee.toFixed(2)}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>{t('checkout.taxesEstimated')}</span>
            <span>${summary.taxes.toFixed(2)}</span>
          </div>
          <div className={`${styles.summaryRow} ${styles.totalRow}`}>
            <span>{t('demoCheckout.total')}</span>
            <span>${summary.total.toFixed(2)}</span>
          </div>
        </div>

        <form onSubmit={handlePay} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="demo-card-number">{t('demoCheckout.cardNumber')}</label>
            <input
              id="demo-card-number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={cardNumber}
              onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            />
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="demo-card-expiry">{t('demoCheckout.expiry')}</label>
              <input
                id="demo-card-expiry"
                inputMode="numeric"
                autoComplete="off"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="demo-card-cvc">{t('demoCheckout.cvc')}</label>
              <input
                id="demo-card-cvc"
                inputMode="numeric"
                autoComplete="off"
                placeholder="123"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
            </div>
          </div>

          <p className={styles.hint}>{t('demoCheckout.testCardHint')}</p>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.payBtn} disabled={isProcessing}>
            {isProcessing
              ? t('demoCheckout.processing')
              : t('demoCheckout.payButton').replace('{amount}', `$${summary.total.toFixed(2)}`)}
          </button>
          <button
            type="button"
            className={styles.cancelBtn}
            disabled={isProcessing}
            onClick={() => navigate('/checkout?payment=cancelled')}
          >
            {t('demoCheckout.cancel')}
          </button>
        </form>
      </div>
    </div>
  );
};
