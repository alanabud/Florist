import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ChevronRight, Lock } from 'lucide-react';
import { getTaxConfigForState, STATE_TAX_RATES } from '../data/taxConfig';
import { createGuestOrder } from '../services/publicOrderService';
import styles from './Checkout.module.css';
import { useI18n } from '../i18n/I18nProvider';

export const Checkout: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { items, getSubtotal, getTaxableSubtotal, clearCart } = useCartStore();
  const [step, setStep] = useState(1);
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
    // Payment
    cardNumber: '',
    expiry: '',
    cvc: '',
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

      const result = await createGuestOrder(orderData);
      clearCart();
      navigate(`/order-confirmation/${result.trackingLookupId}`);
    } catch (error) {
      console.error("Failed to process checkout", error);
      alert("Checkout failed. Please try again.");
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
            <Lock size={16} /> Secure Checkout
          </div>
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.mainContent}>
          {/* Breadcrumbs */}
          <div className={styles.breadcrumbs}>
            <span className={step >= 1 ? styles.activeStep : ''}>1. Recipient</span>
            <ChevronRight size={16} />
            <span className={step >= 2 ? styles.activeStep : ''}>2. Delivery</span>
            <ChevronRight size={16} />
            <span className={step >= 3 ? styles.activeStep : ''}>3. Details</span>
            <ChevronRight size={16} />
            <span className={step >= 4 ? styles.activeStep : ''}>4. Payment</span>
          </div>

          <Card className={styles.formCard}>
            <form onSubmit={handleCheckoutSubmit}>
              
              {/* Step 1: Recipient Details */}
              {step === 1 && (
                <div className={styles.stepContent}>
                  <h2>{t('checkout.whoIsThisFor')}</h2>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Recipient's Full Name</label>
                      <input required name="recipientName" value={formData.recipientName} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Recipient's Phone Number</label>
                      <input required name="recipientPhone" type="tel" value={formData.recipientPhone} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <label>{t('checkout.deliveryAddress')}</label>
                      <input required name="recipientAddress" value={formData.recipientAddress} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>City</label>
                      <input required name="recipientCity" value={formData.recipientCity} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>State</label>
                      <select required name="recipientState" value={formData.recipientState} onChange={handleInputChange}>
                        <option value="">{t('checkout.selectState')}</option>
                        {Object.keys(STATE_TAX_RATES).filter(k => k !== 'DEFAULT').map(state => (
                          <option key={state} value={state}>{state}</option>
                        ))}
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label>ZIP Code</label>
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
                        <strong>Standard Delivery ($9.99)</strong>
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
                        <strong>Same-Day Delivery ($19.99)</strong>
                        <p>Delivered today before 6 PM</p>
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
                        <strong>In-Store Pickup (Free)</strong>
                        <p>{t('checkout.collectFromOurDowntownStudio')}</p>
                      </div>
                    </label>
                  </div>
                  
                  <div className={styles.formGroup} style={{ marginTop: '2rem' }}>
                    <label>{t('checkout.requestedDeliveryDate')}</label>
                    <input required type="date" name="deliveryDate" value={formData.deliveryDate} onChange={handleInputChange} />
                  </div>

                  <div className={styles.btnRow}>
                    <Button type="button" variant="ghost" onClick={prevStep}>Back</Button>
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
                      <label>Your Email Address (for receipt)</label>
                      <input required type="email" name="senderEmail" value={formData.senderEmail} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <label>Card Message (Optional)</label>
                      <textarea 
                        name="cardMessage" 
                        rows={4} 
                        placeholder="Write a heartfelt note..."
                        value={formData.cardMessage} 
                        onChange={handleInputChange} 
                      />
                    </div>
                  </div>
                  <div className={styles.btnRow}>
                    <Button type="button" variant="ghost" onClick={prevStep}>Back</Button>
                    <Button type="button" onClick={nextStep}>{t('checkout.continueToPayment')}</Button>
                  </div>
                </div>
              )}

              {/* Step 4: Payment Mock UI */}
              {step === 4 && (
                <div className={styles.stepContent}>
                  <h2>Payment</h2>
                  <div className={styles.paymentMock}>
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <label>{t('checkout.cardNumber')}</label>
                      <input required name="cardNumber" placeholder="0000 0000 0000 0000" value={formData.cardNumber} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>{t('checkout.expiryDate')}</label>
                      <input required name="expiry" placeholder="MM/YY" value={formData.expiry} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>CVC</label>
                      <input required name="cvc" placeholder="123" value={formData.cvc} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className={styles.btnRow}>
                    <Button type="button" variant="ghost" onClick={prevStep}>Back</Button>
                    <Button type="submit" size="lg" className={styles.submitBtn}>
                      Pay ${total.toFixed(2)}
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
                    <span className={styles.itemQty}>Qty: {item.quantity}</span>
                  </div>
                  <span className={styles.itemPrice}>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className={styles.costBreakdown}>
              <div className={styles.costRow}>
                <span>Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className={styles.costRow}>
                <span>Delivery</span>
                <span>${deliveryFee.toFixed(2)}</span>
              </div>
              <div className={styles.costRow}>
                <span>Taxes (Estimated)</span>
                <span>${taxes.toFixed(2)}</span>
              </div>
              <div className={styles.totalRow}>
                <span>Total</span>
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
