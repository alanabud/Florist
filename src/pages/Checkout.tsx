import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { CheckCircle2, ChevronRight, Lock } from 'lucide-react';
import styles from './Checkout.module.css';

export const Checkout: React.FC = () => {
  const navigate = useNavigate();
  const { items, getSubtotal, clearCart } = useCartStore();
  const [step, setStep] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    // Recipient
    recipientName: '',
    recipientPhone: '',
    recipientAddress: '',
    recipientCity: '',
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

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      nextStep();
      return;
    }
    
    // Simulate order placement
    setTimeout(() => {
      clearCart();
      setIsModalOpen(true);
    }, 1000);
  };

  if (items.length === 0 && !isModalOpen) {
    return (
      <div className={styles.emptyContainer}>
        <h2>Your cart is empty</h2>
        <p>You need to add items to your cart before proceeding to checkout.</p>
        <Button onClick={() => navigate('/shop')}>Return to Shop</Button>
      </div>
    );
  }

  const subtotal = getSubtotal();
  const deliveryFee = formData.deliveryType === 'sameday' ? 19.99 : (formData.deliveryType === 'pickup' ? 0 : 9.99);
  const taxes = subtotal * 0.08;
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
                  <h2>Who is this for?</h2>
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
                      <label>Delivery Address</label>
                      <input required name="recipientAddress" value={formData.recipientAddress} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>City</label>
                      <input required name="recipientCity" value={formData.recipientCity} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>ZIP Code</label>
                      <input required name="recipientZip" value={formData.recipientZip} onChange={handleInputChange} />
                    </div>
                  </div>
                  <Button type="button" onClick={nextStep} className={styles.nextBtn}>Continue to Delivery</Button>
                </div>
              )}

              {/* Step 2: Delivery/Pickup Choice & Date */}
              {step === 2 && (
                <div className={styles.stepContent}>
                  <h2>Delivery Options</h2>
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
                        <p>Arrives on your selected date</p>
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
                        <p>Collect from our downtown studio</p>
                      </div>
                    </label>
                  </div>
                  
                  <div className={styles.formGroup} style={{ marginTop: '2rem' }}>
                    <label>Requested Delivery Date</label>
                    <input required type="date" name="deliveryDate" value={formData.deliveryDate} onChange={handleInputChange} />
                  </div>

                  <div className={styles.btnRow}>
                    <Button type="button" variant="ghost" onClick={prevStep}>Back</Button>
                    <Button type="button" onClick={nextStep}>Continue to Details</Button>
                  </div>
                </div>
              )}

              {/* Step 3: Sender Details & Gift Note */}
              {step === 3 && (
                <div className={styles.stepContent}>
                  <h2>Your Details & Gift Message</h2>
                  <div className={styles.formGrid}>
                    <div className={styles.formGroup}>
                      <label>Your Full Name</label>
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
                    <Button type="button" onClick={nextStep}>Continue to Payment</Button>
                  </div>
                </div>
              )}

              {/* Step 4: Payment Mock UI */}
              {step === 4 && (
                <div className={styles.stepContent}>
                  <h2>Payment</h2>
                  <div className={styles.paymentMock}>
                    <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                      <label>Card Number</label>
                      <input required name="cardNumber" placeholder="0000 0000 0000 0000" value={formData.cardNumber} onChange={handleInputChange} />
                    </div>
                    <div className={styles.formGroup}>
                      <label>Expiry Date</label>
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
            <h3>Order Summary</h3>
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

      <Modal isOpen={isModalOpen} onClose={() => {}} title="" maxWidth="500px">
        <div className={styles.successModal}>
          <CheckCircle2 size={64} className={styles.successIcon} />
          <h2>Order Confirmed!</h2>
          <p>Thank you, {formData.senderName || 'Customer'}. Your order has been placed successfully and is being processed.</p>
          <div className={styles.successDetails}>
            <p><strong>Order Number:</strong> #BLM-{Math.floor(Math.random() * 100000)}</p>
            <p><strong>Delivery Date:</strong> {formData.deliveryDate || 'TBD'}</p>
            <p>A confirmation email has been sent to {formData.senderEmail || 'your email'}.</p>
          </div>
          <Button fullWidth size="lg" onClick={() => navigate('/')}>
            Return to Home
          </Button>
        </div>
      </Modal>
    </div>
  );
};
