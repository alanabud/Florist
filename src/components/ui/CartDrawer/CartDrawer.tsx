import React from 'react';
import { useCartStore } from '../../../store/cartStore';
import { Drawer } from '../Drawer';
import { Button } from '../Button';
import { Trash2, Plus, Minus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import styles from './CartDrawer.module.css';

export const CartDrawer: React.FC = () => {
  const { isDrawerOpen, closeDrawer, items, updateQuantity, removeItem, getSubtotal } = useCartStore();
  const navigate = useNavigate();

  const handleCheckout = () => {
    closeDrawer();
    navigate('/checkout');
  };

  return (
    <Drawer isOpen={isDrawerOpen} onClose={closeDrawer} title="Your Cart" width="450px">
      <div className={styles.container}>
        {items.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🛒</div>
            <h3>Your cart is empty</h3>
            <p>Looks like you haven't added any beautiful arrangements yet.</p>
            <Button onClick={closeDrawer} className={styles.emptyBtn}>
              Continue Shopping
            </Button>
          </div>
        ) : (
          <>
            <div className={styles.itemList}>
              {items.map((item) => (
                <div key={item.id} className={styles.cartItem}>
                    <img src={item.imageUrl} alt={item.name} className={styles.itemImage} />
                  <div className={styles.itemDetails}>
                    <div className={styles.itemHeader}>
                      <h4 className={styles.itemName}>
                        {item.name}
                        {item.isCustom && <span className={styles.customBadge}>Custom</span>}
                      </h4>
                      <button 
                        onClick={() => removeItem(item.id)}
                        className={styles.removeBtn}
                        aria-label="Remove item"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <p className={styles.itemPrice}>${item.price.toFixed(2)}</p>
                    <div className={styles.quantityControl}>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className={styles.qtyBtn}
                      >
                        <Minus size={14} />
                      </button>
                      <span className={styles.qtyValue}>{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className={styles.qtyBtn}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className={styles.footer}>
              <div className={styles.summaryRow}>
                <span>Subtotal</span>
                <span className={styles.subtotalValue}>${getSubtotal().toFixed(2)}</span>
              </div>
              <p className={styles.deliveryNote}>Taxes and delivery calculated at checkout.</p>
              <Button fullWidth size="lg" onClick={handleCheckout}>
                Proceed to Checkout
              </Button>
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
};
