import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronRight, Lock, AlertTriangle } from 'lucide-react';
import { getTaxConfigForState, STATE_TAX_RATES } from '../data/taxConfig';
import { createGuestOrder } from '../services/publicOrderService';
import { startStripeCheckout } from '../services/stripeCheckoutService';
import { PAYMENTS_MODE } from '../config/stripeConfig';
import { stashDemoOrderSummary } from '../services/demoCheckoutService';
import styles from './Checkout.module.css';
import { useI18n } from '../i18n/I18nProvider';

export const Checkout: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const paymentCancelled = searchParams.get('payment') === 'cancelled';
  const { items, getSubtotal, getTaxableSubtotal } = useCartStore();
  const [step, setStep] = useState(1);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [formData, setFormData] = useState({
    // Recipient
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    recipientCity: '',
    recipientState: '',
    recipientZip: '',
    // Delivery Details
    deliveryType: 'standard', // standard, sameday, pickup
    deliveryDate: '',
    // Sender/Contact
    senderName: '',
    senderEmail: '',
    // Gift Note
    cardMessage: '',
    // Payment is collected by Stripe's hosted checkout — no card fields
    // are ever collected by this app.
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      nextStep();
      return;
    }
    if (isSubmittingPayment) return; // ignore double-submits

    // Enter the submitting state BEFORE the order-creation write —
    // previously it was only set after createGuestOrder resolved, so
    // the button gave no feedback during the write and a second click
    // could create a duplicate order (found in click-through QA,
    // 2026-10-18).
    setIsSubmittingPayment(true);
    try {
      const subtotal = getSubtotal();
      const taxableSubtotal = getTaxableSubtotal();
      const deliveryFee = formData.deliveryType === 'sameday' ? 19.99 : (formData.deliveryType === 'pickup' ? 0 : 9.99);
      
      const taxConfig = getTaxConfigForState(formData.recipientState);
      let taxableAmount = taxableSubtotal;
      if (taxConfig.isDeliveryTaxable) {
        taxableAmount += deliveryFee;
      }
      const taxes = taxableAmount * taxConfig.rate;
      const total = subtotal + deliveryFee + taxes;

      const orderData = {
        recipientName: formData.recipientName,
        recipientPhone: formData.recipientPhone,
        recipientAddress: formData.recipientAddress,
        recipientCity: formData.recipientCity,
        recipientState: formData.recipientState,
        recipientZip: formData.recipientZip,
        deliveryType: formData.deliveryType,
        deliveryDate: formData.deliveryDate,
        senderName: formData.senderName,
        senderEmail: formData.senderEmail,
        cardMessage: formData.cardMessage,
        items: items.map(item => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
          isCustom: item.isCustom || false
        })),
        subtotal,
        deliveryFee,
        taxes,
        total,
      };

      // 1. Create the order in its PENDING payment state.
      const result = await createGuestOrder(orderData);
      // 2. Hand off to the active payments mode (see stripeConfig.ts —
      //    the mode is derived fail-closed from key presence):
      //    - 'stripe': redirect to Stripe's hosted checkout. The order
      //      is marked paid ONLY by the Stripe webhook; on cancel the
      //      customer returns here with the cart intact and the order
      //      simply stays pending.
      //    - 'demo': route to the simulated hosted page, which confirms
      //      client-side under the Firestore-rules quarantine (Spark
      //      rework — no Cloud Functions on the free plan) into the
      //      distinct 'demo_paid' state (never 'paid').
      //    - 'unconfigured': no key and demo disabled — refuse rather
      //      than silently falling back to any mock behaviour.
      if (PAYMENTS_MODE === 'demo') {
        stashDemoOrderSummary({
          orderId: result.orderId,
          orderNumber: result.orderNumber,
          trackingLookupId: result.trackingLookupId,
          items: orderData.items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          subtotal,
          deliveryFee,
          taxes,
          total,
          // Tracking-doc fields for the client-side demo confirmation
          // (Spark rework): normalized forms derived exactly as
          // createGuestOrder derives them.
          orderNumberNormalized: result.orderNumber.toLowerCase().trim(),
          senderEmailNormalized: orderData.senderEmail.toLowerCase().trim(),
          recipientFirstName: (orderData.recipientName ?? '').split(' ')[0],
          recipientCity: orderData.recipientCity,
          recipientState: orderData.recipientState,
          deliveryDate: orderData.deliveryDate,
        });
        navigate(`/demo-checkout/${result.orderId}`);
        return;
      }
      if (PAYMENTS_MODE !== 'stripe') {
        setIsSubmittingPayment(false);
        alert(t('checkout.paymentsNotConfigured'));
        return;
      }
      await startStripeCheckout(result.orderId);
    } catch (error) {
      console.error("Failed to process checkout", error);
      setIsSubmittingPayment(false);
      alert(t(PAYMENTS_MODE === 'demo' ? 'checkout.demoStartFailed' : 'checkout.stripeStartFailed'));
    }
  };

  if (items.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <h2>{t('storefront.cartEmpty')}</h2>
        <p>{t('checkout.youNeedToAddItemsToYourCartBeforeProceedingToCheckout')}</p>
        <Button onClick={() => navigate('/shop')}>{t('checkout.returnToShop')}</Button>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const taxableSubtotal = getTaxableSubtotal();
  const deliveryFee = formData.deliveryType === 'sameday' ? 19.99 : (formData.deliveryType === 'pickup' ? 0 : 9.99);
  
  const taxConfig = getTaxConfigForState(formData.recipientState);
  let taxableAmount = taxableSubtotal;
  if (taxConfig.isDeliveryTaxable) {
    taxableAmount += deliveryFee;
  }
  const taxes = taxableAmount * taxConfig.rate;
  const total = subtotal + deliveryFee + taxes;

  return (
    <div className={styles.checkoutPage}>
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>BloomPro</h1>
          <div className={styles.secureText}>
            <Lock size={16} /> {t('checkout.secureCheckout')}
          </div>
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.mainContent}>
          {PAYMENTS_MODE === 'demo' && (
            <div className={styles.demoBanner}>
              <AlertTriangle size={18} />
              <span>
                <strong>{t('checkout.demoBannerTitle')}</strong> — {t('checkout.demoBannerBody')}
              </span>
            </div>
          )}
          {paymentCancelled && (
            <div className={styles.cancelNotice}>{t('checkout.paymentCancelled')}</div>
          )}
          {/* Breadcrumbs */}
          <div className={styles.breadcrumbs}>
            <span className={step >= 1 ? styles.activeStep : ''}>{t('checkout.stepRecipient')}</span>
            <ChevronRight size={16} />
            <span className={step >= 2 ? styles.activeStep : ''}>{t('checkout.stepDelivery')}</span>
            <ChevronRight size={16} />
            <span className={step >= 3 ? styles.activeStep : ''}>{t('checkout.stepDetails')}</span>
            <ChevronRight size={16} />
            <span className={step >= 4 ? styles.activeStep : ''}>{t('checkout.stepPayment')}</span>
          </div>

          <Card className={styles.formCard}>
            <form onSubmit={handleCheckoutSubmit}>
              
              {/* Step 1: Recipient Details */}
              {step === 1 && (
                <div className={styles.stepContent}>
                  <h2>{t('checkout.whoIsThisFor')}</h2>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.recipientFullName')}</label>
                      <input required name="recipientName" value={formData.recipientName} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.recipientPhone')}</label>
                      <input required name="recipientPhone" type="tel" value={formData.recipientPhone} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <label>{t('checkout.deliveryAddress')}</label>
                      <input required name="recipientAddress" value={formData.recipientAddress} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.city')}</label>
                      <input required name="recipientCity" value={formData.recipientCity} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.state')}</label>
                      <select required name="recipientState" value={formData.recipientState} onChange={handleInputChange}>
                        <option value="">{t('checkout.selectState')}</option>
                        {Object.keys(STATE_TAX_RATES).filter(k => k !== 'DEFAULT').map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.zipCode')}</label>
                      <input required name="recipientZip" value={formData.recipientZip} onChange={handleInputChange} />
                    </div>
                  </div>
                  <Button type="button" onClick={nextStep} className={styles.nextBtn}>{t('checkout.continueToDelivery')}</Button>
                </div>
              )}

              {/* Step 2: Delivery/Pickup Choice & Date */}
              {step === 2 && (
                <div className={styles.stepContent}>
                  <h2>{t('checkout.deliveryOptions')}</h2>
                  <div className={styles.deliveryOptions}>
                    <label className={styles.radioLabel}>
                      <input 
                        type="radio" 
                        name="deliveryType" 
                        value="standard" 
                        checked={formData.deliveryType === 'standard'} 
                        onChange={handleInputChange} 
                      />
                      <div className={styles.radioContent}>
                        <strong>{t('checkout.standardDeliveryPrice')}</strong>
                        <p>{t('checkout.arrivesOnYourSelectedDate')}</p>
                      </div>
                    </label>
                    <label className={styles.radioLabel}>
                      <input 
                        type="radio" 
                        name="deliveryType" 
                        value="sameday" 
                        checked={formData.deliveryType === 'sameday'} 
                        onChange={handleInputChange} 
                      />
                      <div className={styles.radioContent}>
                        <strong>{t('checkout.sameDayDeliveryPrice')}</strong>
                        <p>{t('checkout.deliveredTodayLimit')}</p>
                      </div>
                    </label>
                    <label className={styles.radioLabel}>
                      <input 
                        type="radio" 
                        name="deliveryType" 
                        value="pickup" 
                        checked={formData.deliveryType === 'pickup'} 
                        onChange={handleInputChange} 
                      />
                      <div className={styles.radioContent}>
                        <strong>{t('checkout.inStorePickupFree')}</strong>
                        <p>{t('checkout.collectFromOurDowntownStudio')}</p>
                      </div>
                    </label>
                  </div>
                  
                  <div className={styles.formGroup} style={{ marginTop: '2rem' }}>
                    <label>{t('checkout.requestedDeliveryDate')}</label>
                    <input required type="date" name="deliveryDate" value={formData.deliveryDate} onChange={handleInputChange} />
                  </div>

                  <div className={styles.btnRow}>
                    <Button type="button" variant="ghost" onClick={prevStep}>{t('checkout.back')}</Button>
                    <Button type="button" onClick={nextStep}>{t('checkout.continueToDetails')}</Button>
                  </div>
                </div>
              )}

              {/* Step 3: Sender Details & Gift Note */}
              {step === 3 && (
                <div className={styles.stepContent}>
                  <h2>{t('checkout.yourDetailsGiftMessage')}</h2>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.yourFullName')}</label>
                      <input required name="senderName" value={formData.senderName} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.emailForReceipt')}</label>
                      <input required type="email" name="senderEmail" value={formData.senderEmail} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <label>{t('checkout.cardMessageOptional')}</label>
                      <textarea 
                        name="cardMessage" 
                        rows={4} 
                        placeholder={t('checkout.cardMessagePlaceholder')}
                        value={formData.cardMessage} 
                        onChange={handleInputChange} 
                      />
                    </div>
                  </div>
                  <div className={styles.btnRow}>
                    <Button type="button" variant="ghost" onClick={prevStep}>{t('checkout.back')}</Button>
                    <Button type="button" onClick={nextStep}>{t('checkout.continueToPayment')}</Button>
                  </div>
                </div>
              )}

              {/* Step 4: Payment. In 'stripe' mode the customer is sent to
                  Stripe's hosted page (card details never touch this
                  app); in 'demo' mode they go to the labeled simulated
                  page instead; in 'unconfigured' mode checkout cannot
                  complete and says so. */}
              {step === 4 && (
                <div className={styles.stepContent}>
                  <h2>{t('checkout.payment')}</h2>
                  {PAYMENTS_MODE === 'stripe' && <p>{t('checkout.stripeSecureNote')}</p>}
                  {PAYMENTS_MODE === 'demo' && (
                    <div className={styles.demoBanner}>
                      <AlertTriangle size={18} />
                      <span>
                        <strong>{t('checkout.demoBannerTitle')}</strong> — {t('checkout.demoBannerBody')}
                      </span>
                    </div>
                  )}
                  {PAYMENTS_MODE === 'unconfigured' && <p>{t('checkout.paymentsNotConfigured')}</p>}
                  <div className={styles.btnRow}>
                    <Button type="button" variant="ghost" onClick={prevStep}>{t('checkout.back')}</Button>
                    <Button
                      type="submit"
                      size="lg"
                      className={styles.submitBtn}
                      disabled={isSubmittingPayment || PAYMENTS_MODE === 'unconfigured'}
                    >
                      {isSubmittingPayment
                        ? t('checkout.redirectingToPayment')
                        : PAYMENTS_MODE === 'demo'
                          ? t('checkout.payDemo').replace('{amount}', `$${total.toFixed(2)}`)
                          : t('checkout.payWithStripe').replace('{amount}', total.toFixed(2))}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </Card>
        </div>

        {/* Sidebar: Order Summary */}
        <aside className={styles.sidebar}>
          <Card className={styles.summaryCard}>
            <h3>{t('checkout.orderSummary')}</h3>
            <div className={styles.itemsList}>
              {items.map(item => (
                <div key={item.id} className={styles.summaryItem}>
                  <img src={item.imageUrl} alt={item.name} className={styles.itemImage} />
                  <div className={styles.itemInfo}>
                    <h4>{item.name}</h4>
                    <span className={styles.itemQty}>{t('checkout.qty')}: {item.quantity}</span>
                  </div>
                  <span className={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className={styles.costBreakdown}>
              <div className={styles.costRow}>
                <span>{t('checkout.subtotal')}</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className={styles.costRow}>
                <span>{t('checkout.delivery')}</span>
                <span>${deliveryFee.toFixed(2)}</span>
              </div>
              <div className={styles.costRow}>
                <span>{t('checkout.taxesEstimated')}</span>
                <span>${taxes.toFixed(2)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>{t('checkout.total')}</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        </aside>
      </div>

      {/* Success Modal removed, user is redirected to confirmation page */}
    </div>
  );
};
