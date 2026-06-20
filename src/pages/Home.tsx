import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ArrowRight, Star, Heart, ShieldCheck, Search, Truck, Camera, Leaf } from 'lucide-react';
import { OCCASIONS, type Product } from '../data/products';
import { useAdminStore } from '../store/adminStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useI18n } from '../i18n/I18nProvider';
import styles from './Home.module.css';

// Local licensed floral photography
import heroRoseBouquet from '../assets/storefront/hero-rose-bouquet.jpg';
import pinkRoses from '../assets/flowers/pink_roses.jpg';
import mixedPastel from '../assets/flowers/mixed_pastel.jpg';
import redRoses from '../assets/flowers/red_roses.jpg';
import whiteRoses from '../assets/flowers/white_roses.jpg';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const { products } = useAdminStore();
  const { addItem } = useCartStore();
  const { addToast } = useToastStore();
  const [searchQuery, setSearchQuery] = useState('');
  const { t, formatCurrency } = useI18n();

  const bestSellers = products.filter(p => p.isBestSeller).slice(0, 4);
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
    addToast(t('common.addedToCart', { name: product.name }));
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
            <div className={styles.badge}>{t('landing.hero.badge')}</div>
            <h1 className={styles.heroTitle}>{t('landing.hero.title')}</h1>
            <div className={styles.heroDivider}></div>
            <p className={styles.heroSubtitle}>
              {t('landing.hero.subtitle')}
            </p>
            <div className={styles.heroActions}>
              <button className={styles.primaryBtn} onClick={() => navigate('/shop')}>
                {t('landing.hero.shopCollection')} <span className={styles.arrowInline}>→</span>
              </button>
              <button className={styles.secondaryBtn} onClick={() => navigate('/custom')}>
                {t('landing.hero.customBouquet')} <span className={styles.flowerInline}>❁</span>
              </button>
            </div>
            
            <div className={styles.trustIndicators}>
              <div className={styles.trustItem}>
                <div className={styles.trustIconContainer}>
                  <Truck size={24} strokeWidth={1.5} />
                </div>
                <div className={styles.trustText}>
                  <span className={styles.trustTitle}>{t('landing.trust.sameDay')}</span>
                  <span className={styles.trustDesc}>{t('landing.trust.sameDaySub')}</span>
                </div>
              </div>
              
              <div className={styles.trustItem}>
                <div className={styles.trustIconContainer}>
                  <Heart size={24} strokeWidth={1.5} />
                </div>
                <div className={styles.trustText}>
                  <span className={styles.trustTitle}>{t('landing.trust.handcrafted')}</span>
                  <span className={styles.trustDesc}>{t('landing.trust.handcraftedSub')}</span>
                </div>
              </div>
              
              <div className={styles.trustItem}>
                <div className={styles.trustIconContainer}>
                  <ShieldCheck size={24} strokeWidth={1.5} />
                </div>
                <div className={styles.trustText}>
                  <span className={styles.trustTitle}>{t('landing.trust.freshness')}</span>
                  <span className={styles.trustDesc}>{t('landing.trust.freshnessSub')}</span>
                </div>
              </div>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <img 
              src={heroRoseBouquet} 
              alt="Premium fresh rose bouquet on table"
              className={styles.heroImage}
              loading="eager"
            />
          </div>
        </div>
      </section>

      {/* 2. Quick Order / Search Bar */}
      <section className={styles.searchSection}>
        <div className={styles.searchContainer}>
          <h2>{t('landing.search.title')}</h2>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <div className={styles.searchInputWrapper}>
              <Search size={20} className={styles.searchIcon} />
              <input 
                type="text" 
                placeholder={t('landing.search.placeholder')} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <Button type="submit" size="lg">{t('landing.search.button')}</Button>
          </form>
        </div>
      </section>

      {/* 3. Shop by Occasion */}
      <section className={styles.occasionsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('landing.occasions.title')}</h2>
          <Button variant="ghost" onClick={() => navigate('/occasions')}>
            {t('landing.occasions.viewAll')} <ArrowRight size={16} />
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
                <span className={styles.occasionLink}>{t('landing.occasions.shopOccasion', { name: occ.name })} <ArrowRight size={14} /></span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 4. Most Loved Collections Section */}
      <section className={styles.collectionsSection}>
        <div className={styles.collectionsHeader}>
          <span className={styles.collectionsSubtitle}>FRESH PICKS</span>
          <h2 className={styles.collectionsTitle}>Our Most Loved Collections</h2>
          <p className={styles.collectionsDesc}>Curated arrangements for every moment that matters.</p>
        </div>
        
        <div className={styles.carouselContainer}>
          <div className={styles.collectionsGrid}>
            <div className={styles.collectionCard} onClick={() => navigate('/shop?category=Roses')}>
              <div className={styles.collectionImageWrapper}>
                <img src={pinkRoses} alt="Delicate pink rose arrangement" className={styles.collectionImage} />
              </div>
            </div>
            <div className={styles.collectionCard} onClick={() => navigate('/shop?category=Seasonal')}>
              <div className={styles.collectionImageWrapper}>
                <img src={mixedPastel} alt="Mixed pastel garden roses" className={styles.collectionImage} />
              </div>
            </div>
            <div className={styles.collectionCard} onClick={() => navigate('/shop?category=Romance')}>
              <div className={styles.collectionImageWrapper}>
                <img src={redRoses} alt="Crimson red rose bouquet" className={styles.collectionImage} />
              </div>
            </div>
            <div className={styles.collectionCard} onClick={() => navigate('/shop?category=Wedding')}>
              <div className={styles.collectionImageWrapper}>
                <img src={whiteRoses} alt="Elegant white roses and hydrangea" className={styles.collectionImage} />
              </div>
            </div>
          </div>
          
          <button className={styles.carouselArrow} onClick={() => navigate('/shop')} aria-label="View all collections">
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* 5. Best Sellers */}
      <section className={styles.featuredSection} style={{ backgroundColor: 'var(--color-ivory)', padding: '6rem 2rem' }}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t('landing.bestsellers.title')}</h2>
        </div>
        <div className={styles.productGrid}>
          {bestSellers.map(product => (
            <Card key={product.id} className={styles.productCard} onClick={() => navigate(`/product/${product.id}`)}>
              <div className={styles.productImageWrapper}>
                <img src={product.imageUrl} alt={product.name} loading="lazy" className={styles.productImage} />
                {product.isSameDay && <div className={styles.tag}>{t('landing.bestsellers.sameDay')}</div>}
                <div className={styles.quickActions}>
                  <Button size="sm" onClick={(e) => handleAddToCart(e, product)}>{t('landing.featured.addToCart')}</Button>
                </div>
              </div>
              <div className={styles.productInfo}>
                <span className={styles.productCategory}>{product.category}</span>
                <h3 className={styles.productName}>{product.name}</h3>
                <span className={styles.productPrice}>{formatCurrency(product.price)}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 6. Same-Day Delivery Panel */}
      <section className={styles.sameDayPanel}>
        <div className={styles.sameDayContainer}>
          <div className={styles.sameDayText}>
            <h2>{t('landing.sameday.title')}</h2>
            <p>{t('landing.sameday.desc')}</p>
            <Button variant="outline" style={{ borderColor: 'white', color: 'white' }} onClick={() => navigate('/shop?delivery=sameday')}>
              {t('landing.sameday.button')}
            </Button>
          </div>
          <div className={styles.sameDayGrid}>
            {sameDay.slice(0, 2).map(product => (
              <div key={product.id} className={styles.miniCard} onClick={() => navigate(`/product/${product.id}`)}>
                <img src={product.imageUrl} alt={product.name} loading="lazy" />
                <div className={styles.miniInfo}>
                  <h4>{product.name}</h4>
                  <span>{formatCurrency(product.price)}</span>
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
            <h2>{t('landing.custom.title')}</h2>
            <p>{t('landing.custom.desc')}</p>
            <ul className={styles.customFeatures}>
              <li><CheckIcon /> {t('landing.custom.palette')}</li>
              <li><CheckIcon /> {t('landing.custom.flowers')}</li>
              <li><CheckIcon /> {t('landing.custom.message')}</li>
            </ul>
            <Button size="lg" onClick={() => navigate('/custom')}>{t('landing.custom.button')}</Button>
          </div>
          <div className={styles.customVisual}>
            <img src="https://images.unsplash.com/photo-1507290439931-a861b5a38200?q=80&w=800&auto=format&fit=crop" alt="Florist designing bouquet" loading="lazy" />
          </div>
        </div>
      </section>

      {/* 8. How it works */}
      <section className={styles.howItWorks}>
        <div className={styles.howHeader}>
          <h2>{t('landing.how.title')}</h2>
          <p>{t('landing.how.subtitle')}</p>
        </div>
        <div className={styles.howGrid}>
          <div className={styles.howStep}>
            <div className={styles.stepIcon}><Leaf size={32} /></div>
            <h3>{t('landing.how.step1Title')}</h3>
            <p>{t('landing.how.step1Desc')}</p>
          </div>
          <div className={styles.howStep}>
            <div className={styles.stepIcon}><Heart size={32} /></div>
            <h3>{t('landing.how.step2Title')}</h3>
            <p>{t('landing.how.step2Desc')}</p>
          </div>
          <div className={styles.howStep}>
            <div className={styles.stepIcon}><Truck size={32} /></div>
            <h3>{t('landing.how.step3Title')}</h3>
            <p>{t('landing.how.step3Desc')}</p>
          </div>
        </div>
      </section>

      {/* 9. Testimonials */}
      <section className={styles.reviewsSection}>
        <div className={styles.reviewsHeader}>
          <h2>{t('landing.reviews.title')}</h2>
          <div className={styles.stars}>
            {[1, 2, 3, 4, 5].map(i => <Star key={i} fill="currentColor" color="var(--color-warning)" size={20} />)}
            <span>{t('landing.reviews.countText')}</span>
          </div>
        </div>
        <div className={styles.reviewsGrid}>
          {[
            { name: 'Sarah M.', text: t('landing.reviews.review1') },
            { name: 'David L.', text: t('landing.reviews.review2') },
            { name: 'Emma T.', text: t('landing.reviews.review3') }
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
          <h2>{t('landing.guarantee.title')}</h2>
          <p>{t('landing.guarantee.desc')}</p>
        </div>
      </section>

      {/* 11. Instagram Gallery */}
      <section className={styles.igSection}>
        <div className={styles.igHeader}>
          <Camera size={24} />
          <h2>@BloomProStudio</h2>
          <Button variant="ghost">{t('landing.ig.follow')}</Button>
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
            <p>{t('landing.footer.brandDesc')}</p>
          </div>
          <div className={styles.footerLinks}>
            <div>
              <h4>{t('landing.footer.shop')}</h4>
              <ul>
                <li><button onClick={() => navigate('/shop')}>{t('landing.footer.allProducts')}</button></li>
                <li><button onClick={() => navigate('/shop?filter=bestsellers')}>{t('landing.footer.bestSellers')}</button></li>
                <li><button onClick={() => navigate('/occasions')}>{t('storefront.occasions')}</button></li>
                <li><button onClick={() => navigate('/custom')}>{t('landing.hero.customBouquet')}</button></li>
              </ul>
            </div>
            <div>
              <h4>{t('landing.footer.about')}</h4>
              <ul>
                <li><button onClick={() => navigate('/about')}>{t('landing.footer.ourStory')}</button></li>
                <li><button onClick={() => navigate('/contact')}>{t('landing.footer.contact')}</button></li>
                <li><button onClick={() => navigate('/faq')}>{t('landing.footer.faq')}</button></li>
              </ul>
            </div>
            <div>
              <h4>{t('landing.footer.policies')}</h4>
              <ul>
                <li><button onClick={() => navigate('/terms')}>{t('landing.footer.terms')}</button></li>
                <li><button onClick={() => navigate('/privacy')}>{t('landing.footer.privacy')}</button></li>
                <li><button onClick={() => navigate('/delivery')}>{t('landing.footer.deliveryPolicy')}</button></li>
              </ul>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>&copy; {new Date().getFullYear()} BloomPro Studio. {t('landing.footer.rightsReserved')}</p>
        </div>
      </footer>
    </div>
  );
};

const CheckIcon = () => <span style={{ color: 'var(--color-success)', marginRight: '8px' }}>✓</span>;
