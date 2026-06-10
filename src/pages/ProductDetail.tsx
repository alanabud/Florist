import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAdminStore } from '../store/adminStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useWishlistStore } from '../store/wishlistStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Heart, Truck, ShieldCheck, ChevronLeft, Star } from 'lucide-react';
import styles from './ProductDetail.module.css';

export const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { products } = useAdminStore();
  const { addItem } = useCartStore();
  const { addToast } = useToastStore();
  const { toggleItem, isInWishlist } = useWishlistStore();

  const [quantity, setQuantity] = useState(1);
  const product = products.find(p => p.id === id);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!product) {
    return (
      <div className={styles.notFound}>
        <h2>Product not found</h2>
        <Button onClick={() => navigate('/shop')}>Back to Shop</Button>
      </div>
    );
  }

  const isWished = isInWishlist(product.id);

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
      imageUrl: product.imageUrl,
      isCustom: false
    });
    addToast(`${quantity}x ${product.name} added to cart!`);
  };

  const handleToggleWishlist = () => {
    toggleItem(product.id);
    addToast(isWished ? 'Removed from wishlist' : 'Added to wishlist');
  };

  const relatedProducts = products.filter(p => p.category === product.category && p.id !== product.id).slice(0, 3);

  return (
    <div className={styles.container}>
      <button className={styles.backBtn} onClick={() => navigate('/shop')}>
        <ChevronLeft size={20} /> Back to Catalog
      </button>

      <div className={styles.grid}>
        {/* Images */}
        <div className={styles.imageGallery}>
          <img 
            src={product.imageUrl} 
            alt={product.name} 
            className={styles.mainImage} 
            loading="eager"
          />
        </div>

        {/* Details */}
        <div className={styles.productInfo}>
          <div className={styles.header}>
            <span className={styles.category}>{product.category}</span>
            <div className={styles.titleRow}>
              <h1>{product.name}</h1>
              <button 
                className={`${styles.wishlistBtn} ${isWished ? styles.wished : ''}`}
                onClick={handleToggleWishlist}
                aria-label="Toggle Wishlist"
              >
                <Heart size={28} fill={isWished ? 'currentColor' : 'none'} />
              </button>
            </div>
            <div className={styles.reviews}>
              <Star size={16} fill="var(--color-warning)" color="var(--color-warning)" />
              <span>{product.rating} / 5.0</span>
            </div>
          </div>

          <div className={styles.priceRow}>
            <span className={styles.price}>${product.price.toFixed(2)}</span>
            {product.isSameDay && <span className={styles.badge}>Same-Day Delivery</span>}
          </div>

          <p className={styles.description}>{product.description}</p>

          <div className={styles.metaData}>
            <div className={styles.metaItem}>
              <strong>Occasions:</strong> {product.occasions.join(', ')}
            </div>
            <div className={styles.metaItem}>
              <strong>Color Palette:</strong> {product.colors.join(', ')}
            </div>
            <div className={styles.metaItem}>
              <strong>Tags:</strong> {product.tags.map(t => `#${t}`).join(' ')}
            </div>
          </div>

          <div className={styles.actions}>
            <div className={styles.quantity}>
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)}>+</button>
            </div>
            <Button size="lg" className={styles.addBtn} onClick={handleAddToCart} disabled={!product.inStock}>
              {product.inStock ? 'Add to Cart' : 'Out of Stock'}
            </Button>
          </div>

          <div className={styles.trustBox}>
            <div className={styles.trustItem}>
              <Truck size={20} />
              <div>
                <strong>Delivery Options</strong>
                <p>{product.isSameDay ? 'Eligible for Same-Day delivery if ordered before 2 PM.' : 'Standard 2-day delivery available.'}</p>
              </div>
            </div>
            <div className={styles.trustItem}>
              <ShieldCheck size={20} />
              <div>
                <strong>7-Day Freshness</strong>
                <p>Guaranteed to stay beautiful and fresh for a full week.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className={styles.relatedSection}>
          <h2>You might also like</h2>
          <div className={styles.relatedGrid}>
            {relatedProducts.map(p => (
              <Card key={p.id} className={styles.relatedCard} onClick={() => navigate(`/product/${p.id}`)}>
                <img src={p.imageUrl} alt={p.name} loading="lazy" />
                <div className={styles.relatedInfo}>
                  <h3>{p.name}</h3>
                  <span>${p.price}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
