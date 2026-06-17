import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../store/cartStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Trash2, Plus, Minus, ArrowLeft, ShoppingBag } from 'lucide-react';
import styles from './Cart.module.css';
import { useI18n } from '../i18n/I18nProvider';

export const Cart: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, getSubtotal } = useCartStore();

  const handleQuantityChange = (id: string, currentQty: number, delta: number) => {
    const newQty = currentQty + delta;
    if (newQty > 0) {
      updateQuantity(id, newQty);
    }
  };

  const subtotal = getSubtotal();
  const deliveryEstimate = 9.99;
  const taxEstimate = subtotal * 0.08875; // 8.875% NYC tax estimate for summary
  const estimatedTotal = subtotal + deliveryEstimate + taxEstimate;

  if (items.length === 0) {
    return (
      <div className={styles.emptyCart}>
        <div className={styles.emptyIcon}>
          <ShoppingBag size={48} />
        </div>
        <h2>{t('cart.yourFlowerCartIsEmpty')}</h2>
        <p>{t('cart.exploreOurSeasonalCurationsAndArtisanArrangementsToSayItBeautifully')}</p>
        <Button onClick={() => navigate('/shop')} style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none' }}>
          {t('cart.browseShop')}
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.cartPage}>
      <div className={styles.container}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => navigate('/shop')}>
            <ArrowLeft size={16} /> {t('cart.continueShopping')}
          </button>
          <h1 className={styles.title}>{t('cart.yourShoppingCart')}</h1>
        </div>

        <div className={styles.cartGrid}>
          <div className={styles.itemsSection}>
            {items.map((item) => (
              <Card key={item.id} className={styles.itemCard}>
                <div className={styles.itemFlex}>
                  <img src={item.imageUrl} alt={item.name} className={styles.itemImage} />
                  <div className={styles.itemDetails}>
                    <div className={styles.itemMeta}>
                      <h3 className={styles.itemName}>{item.name}</h3>
                      {item.isCustom && <span className={styles.customBadge}>{t('landing.hero.customBouquet')}</span>}
                    </div>
                    <div className={styles.itemPricing}>
                      <span className={styles.unitPrice}>${item.price.toFixed(2)} {t('cart.each')}</span>
                      <span className={styles.lineTotal}>${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    
                    <div className={styles.itemActions}>
                      <div className={styles.quantitySelector}>
                        <button 
                          className={styles.qtyBtn} 
                          onClick={() => handleQuantityChange(item.id, item.quantity, -1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} />
                        </button>
                        <span className={styles.qtyVal}>{item.quantity}</span>
                        <button 
                          className={styles.qtyBtn} 
                          onClick={() => handleQuantityChange(item.id, item.quantity, 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      <button className={styles.removeBtn} onClick={() => removeItem(item.id)}>
                        <Trash2 size={16} /> {t('cart.remove')}
                      </button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <aside className={styles.summarySection}>
            <Card className={styles.summaryCard}>
              <h2>{t('cart.orderSummary')}</h2>
              
              <div className={styles.summaryRows}>
                <div className={styles.summaryRow}>
                  <span>{t('cart.subtotal')}</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>{t('cart.standardDeliveryEst')}</span>
                  <span>${deliveryEstimate.toFixed(2)}</span>
                </div>
                <div className={styles.summaryRow}>
                  <span>{t('cart.salesTaxEst')}</span>
                  <span>${taxEstimate.toFixed(2)}</span>
                </div>
                <div className={`${styles.summaryRow} ${styles.totalRow}`}>
                  <span>{t('cart.estimatedTotal')}</span>
                  <span>${estimatedTotal.toFixed(2)}</span>
                </div>
              </div>

              <div className={styles.checkoutNotice}>
                <p>{t('cart.checkoutNotice')}</p>
              </div>

              <Button 
                fullWidth 
                size="lg" 
                onClick={() => navigate('/checkout')}
                style={{ background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', color: '#FFF', padding: '0.85rem' }}
              >
                {t('cart.proceedToGuestCheckout')}
              </Button>
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
};
