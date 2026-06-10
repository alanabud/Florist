import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ArrowRight, Star, Clock, Heart, ShieldCheck, Search, Truck, Camera, Leaf } from 'lucide-react';
import { OCCASIONS, type Product } from '../data/products';
import { useAdminStore } from '../store/adminStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import styles from './Home.module.css';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { products } = useAdminStore();
  const { addItem } = useCartStore();
  const { addToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');

  const bestSellers = products.filter(p => p.isBestSeller).slice(0, 4);
  const featured = products.filter(p => !p.isBestSeller).slice(0, 3);
  const sameDay = products.filter(p => p.isSameDay).slice(0, 3);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      isCustom: false
    });
    addToast(`${product.name} added to cart!`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <div className={styles.home}>
      {/* 1. Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContainer}>
          <div className={styles.heroContent}>
            <div className={styles.badge}>Artisan Florals</div>
            <h1 className={styles.heroTitle}>Say it beautifully with fresh flowers</h1>
            <p className={styles.heroSubtitle}>
              Premium, handcrafted floral arrangements delivered to your door. Freshness guaranteed.
            </p>
            <div className={styles.heroActions}>
              <Button size="lg" onClick={() => navigate('/shop')}>
                Shop Collection
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/custom')}>
                Custom Bouquet
              </Button>
            </div>
            
            <div className={styles.trustIndicators}>
              <div className={styles.trustItem}>
                <Clock size={16} /> Same-day delivery
              </div>
              <div className={styles.trustItem}>
                <Heart size={16} /> Handcrafted
              </div>
              <div className={styles.trustItem}>
                <ShieldCheck size={16} /> 7-Day Freshness
              </div>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <img 
              src="https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=1000&auto=format&fit=crop" 
              alt="Premium floral arrangement"
              className={styles.heroImage}
              loading="eager"
            />
            <div className={styles.visualCard}>
              <Star size={16} fill="var(--color-warning)" color="var(--color-warning)" />
              <p>Curated with love</p>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Order / Search Bar */}
      <section className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <h2>Find the perfect arrangement</h2>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <div className={styles.searchInputWrapper}>
              <Search size={20} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder="Search by flower, occasion, or color..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <Button type="submit" size="lg">Search</Button>
          </form>
        </div>
      </section>

      {/* 3. Shop by Occasion */}
      <section className={styles.occasionsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Shop by Occasion</h2>
          <Button variant="ghost" onClick={() => navigate('/occasions')}>
            View All <ArrowRight size={16} />
          </Button>
        </div>
        <div className={styles.occasionsGrid}>
          {OCCASIONS.slice(0, 4).map((occ) => (
            <Card 
              key={occ.id} 
              className={styles.occasionCard}
              onClick={() => navigate(`/shop?occasion=${occ.name}`)}
            >
              <img src={occ.imageUrl} alt={occ.name} loading="lazy" className={styles.occasionBg} />
              <div className={styles.occasionOverlay}></div>
              <div className={styles.occasionContent}>
                <h3>{occ.name}</h3>
                <span className={styles.occasionLink}>Shop {occ.name} <ArrowRight size={14} /></span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Featured Arrangements */}
      <section className={styles.featuredSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Featured Curations</h2>
          <Button variant="ghost" onClick={() => navigate('/shop')}>
            Shop All <ArrowRight size={16} />
          </Button>
        </div>
        <div className={styles.productGrid}>
          {featured.map(product => (
            <Card key={product.id} className={styles.productCard} onClick={() => navigate(`/product/${product.id}`)}>
              <div className={styles.productImageWrapper}>
                <img src={product.imageUrl} alt={product.name} loading="lazy" className={styles.productImage} />
                <div className={styles.quickActions}>
                  <Button size="sm" onClick={(e) => handleAddToCart(e, product)}>Add to Cart</Button>
                </div>
              </div>
              <div className={styles.productInfo}>
                <span className={styles.productCategory}>{product.category}</span>
                <h3 className={styles.productName}>{product.name}</h3>
                <span className={styles.productPrice}>${product.price}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 5. Best Sellers */}
      <section className={styles.featuredSection} style={{ backgroundColor: 'var(--color-ivory)', padding: '6rem 2rem' }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Best Sellers</h2>
        </div>
        <div className={styles.productGrid}>
          {bestSellers.map(product => (
            <Card key={product.id} className={styles.productCard} onClick={() => navigate(`/product/${product.id}`)}>
              <div className={styles.productImageWrapper}>
                <img src={product.imageUrl} alt={product.name} loading="lazy" className={styles.productImage} />
                {product.isSameDay && <div className={styles.tag}>Same Day</div>}
                <div className={styles.quickActions}>
                  <Button size="sm" onClick={(e) => handleAddToCart(e, product)}>Add to Cart</Button>
                </div>
              </div>
              <div className={styles.productInfo}>
                <span className={styles.productCategory}>{product.category}</span>
                <h3 className={styles.productName}>{product.name}</h3>
                <span className={styles.productPrice}>${product.price}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 6. Same-Day Delivery Panel */}
      <section className={styles.sameDayPanel}>
        <div className={styles.sameDayContainer}>
          <div className={styles.sameDayText}>
            <h2>Need it today?</h2>
            <p>Order before 2 PM for guaranteed same-day delivery on these select premium arrangements.</p>
            <Button variant="outline" style={{ borderColor: 'white', color: 'white' }} onClick={() => navigate('/shop?delivery=sameday')}>
              Shop Same-Day
            </Button>
          </div>
          <div className={styles.sameDayGrid}>
            {sameDay.slice(0, 2).map(product => (
              <div key={product.id} className={styles.miniCard} onClick={() => navigate(`/product/${product.id}`)}>
                <img src={product.imageUrl} alt={product.name} loading="lazy" />
                <div className={styles.miniInfo}>
                  <h4>{product.name}</h4>
                  <span>${product.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Custom Bouquet Builder Preview */}
      <section className={styles.customSection}>
        <div className={styles.customContainer}>
          <div className={styles.customContent}>
            <h2>Create Something Unique</h2>
            <p>Work with our artisan florists to design a custom bouquet that perfectly matches your vision, occasion, and budget.</p>
            <ul className={styles.customFeatures}>
              <li><CheckIcon /> Choose your color palette</li>
              <li><CheckIcon /> Select specific flowers</li>
              <li><CheckIcon /> Personalize your message</li>
            </ul>
            <Button size="lg" onClick={() => navigate('/custom')}>Start Building</Button>
          </div>
          <div className={styles.customVisual}>
            <img src="https://images.unsplash.com/photo-1507290439931-a861b5a38200?q=80&w=800&auto=format&fit=crop" alt="Florist designing bouquet" loading="lazy" />
          </div>
        </div>
      </section>

      {/* 8. How it works */}
      <section className={styles.howItWorks}>
        <div className={styles.howHeader}>
          <h2>How BloomPro Works</h2>
          <p>From our artisan studio to your recipient's hands</p>
        </div>
        <div className={styles.howGrid}>
          <div className={styles.howStep}>
            <div className={styles.stepIcon}><Leaf size={32} /></div>
            <h3>1. Curated Blooms</h3>
            <p>We source the freshest, highest quality flowers from sustainable farms.</p>
          </div>
          <div className={styles.howStep}>
            <div className={styles.stepIcon}><Heart size={32} /></div>
            <h3>2. Artisan Design</h3>
            <p>Every arrangement is uniquely handcrafted by our expert floral designers.</p>
          </div>
          <div className={styles.howStep}>
            <div className={styles.stepIcon}><Truck size={32} /></div>
            <h3>3. Hand Delivery</h3>
            <p>Safely hand-delivered to ensure pristine condition upon arrival.</p>
          </div>
        </div>
      </section>

      {/* 9. Testimonials */}
      <section className={styles.reviewsSection}>
        <div className={styles.reviewsHeader}>
          <h2>Loved by our customers</h2>
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map(i => <Star key={i} fill="currentColor" color="var(--color-warning)" size={20} />)}
            <span>4.9/5 based on 2,000+ reviews</span>
          </div>
        </div>
        <div className={styles.reviewsGrid}>
          {[
            { name: 'Sarah M.', text: 'The most beautiful arrangement I have ever received. The packaging was stunning.' },
            { name: 'David L.', text: 'Customer service was exceptional, and the same-day delivery saved my anniversary!' },
            { name: 'Emma T.', text: 'I love the custom bouquet builder. It felt so personal and the result was breathtaking.' }
          ].map((review, i) => (
            <Card key={i} className={styles.reviewCard}>
              <div className={styles.reviewStars}>
                {[1, 2, 3, 4, 5].map(i => <Star key={i} fill="currentColor" color="var(--color-warning)" size={16} />)}
              </div>
              <p className={styles.reviewText}>"{review.text}"</p>
              <span className={styles.reviewAuthor}>— {review.name}</span>
            </Card>
          ))}
        </div>
      </section>

      {/* 10. Floral Care Guarantee */}
      <section className={styles.guaranteeSection}>
        <div className={styles.guaranteeContainer}>
          <ShieldCheck size={48} className={styles.guaranteeIcon} />
          <h2>Our 7-Day Freshness Guarantee</h2>
          <p>We stand behind the quality of every bloom. If your arrangement doesn't stay fresh for at least 7 days, we'll replace it. No questions asked.</p>
        </div>
      </section>

      {/* 11. Instagram Gallery */}
      <section className={styles.igSection}>
        <div className={styles.igHeader}>
          <Camera size={24} />
          <h2>@BloomProStudio</h2>
          <Button variant="ghost">Follow Us</Button>
        </div>
        <div className={styles.igGrid}>
          <img src="https://images.unsplash.com/photo-1534073828943-f801091bb18c?q=80&w=400&auto=format&fit=crop" alt="IG 1" loading="lazy" />
          <img src="https://images.unsplash.com/photo-1502977249166-e81148925f13?q=80&w=400&auto=format&fit=crop" alt="IG 2" loading="lazy" />
          <img src="https://images.unsplash.com/photo-1528698827591-e19ccd7bc23d?q=80&w=400&auto=format&fit=crop" alt="IG 3" loading="lazy" />
          <img src="https://images.unsplash.com/photo-1490750967868-88cb44cb271b?q=80&w=400&auto=format&fit=crop" alt="IG 4" loading="lazy" />
        </div>
      </section>

      {/* 12. Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContainer}>
          <div className={styles.footerBrand}>
            <h3>BloomPro Studio</h3>
            <p>Premium floral arrangements, handcrafted with love.</p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <h4>Shop</h4>
              <ul>
                <li><button onClick={() => navigate('/shop')}>All Products</button></li>
                <li><button onClick={() => navigate('/shop?filter=bestsellers')}>Best Sellers</button></li>
                <li><button onClick={() => navigate('/occasions')}>Occasions</button></li>
                <li><button onClick={() => navigate('/custom')}>Custom Bouquet</button></li>
              </ul>
            </div>
            <div>
              <h4>About</h4>
              <ul>
                <li><button onClick={() => navigate('/about')}>Our Story</button></li>
                <li><button onClick={() => navigate('/contact')}>Contact</button></li>
                <li><button onClick={() => navigate('/faq')}>FAQ</button></li>
              </ul>
            </div>
            <div>
              <h4>Policies</h4>
              <ul>
                <li><button onClick={() => navigate('/terms')}>Terms of Service</button></li>
                <li><button onClick={() => navigate('/privacy')}>Privacy Policy</button></li>
                <li><button onClick={() => navigate('/delivery')}>Delivery Policy</button></li>
              </ul>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} BloomPro Studio. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const CheckIcon = () => <span style={{ color: 'var(--color-success)', marginRight: '8px' }}>✓</span>;
