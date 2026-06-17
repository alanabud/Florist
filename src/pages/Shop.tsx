import React, { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { OCCASIONS, type Product } from '../data/products';
import { useAdminStore } from '../store/adminStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { useWishlistStore } from '../store/wishlistStore';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SlidersHorizontal, X, Heart, Search } from 'lucide-react';
import styles from './Shop.module.css';
import { useI18n } from '../i18n/I18nProvider';

type SortOption = 'popular' | 'price-low' | 'price-high' | 'newest';

export const Shop: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { products } = useAdminStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const occasionFilter = searchParams.get('occasion') || 'all';
  const searchQueryParam = searchParams.get('search') || '';
  const deliveryFilter = searchParams.get('delivery') || 'all';
  
  const [activeSort, setActiveSort] = useState<SortOption>('popular');
  const [selectedColor, setSelectedColor] = useState<string>('all');
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(searchQueryParam);

  const { addItem } = useCartStore();
  const { addToast } = useToastStore();
  const { toggleItem, isInWishlist } = useWishlistStore();

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
    addToast(t('common.addedToCart').replace('{name}', product.name));
  };

  const handleToggleWishlist = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    toggleItem(productId);
    const w = isInWishlist(productId);
    addToast(w ? t('productdetail.removedFromWishlist') : t('productdetail.addedToWishlist'));
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      searchParams.set('search', searchInput.trim());
    } else {
      searchParams.delete('search');
    }
    setSearchParams(searchParams);
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (occasionFilter !== 'all') {
      result = result.filter(p => p.occasions.includes(occasionFilter));
    }

    if (selectedColor !== 'all') {
      result = result.filter(p => p.colors.includes(selectedColor));
    }

    if (deliveryFilter === 'sameday') {
      result = result.filter(p => p.isSameDay);
    }

    if (searchQueryParam) {
      const q = searchQueryParam.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    switch (activeSort) {
      case 'price-low':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'popular':
        result.sort((a, b) => (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0));
        break;
    }

    return result;
  }, [occasionFilter, selectedColor, activeSort, searchQueryParam, deliveryFilter, products]);

  const allColors = Array.from(new Set(products.flatMap(p => p.colors)));

  const handleOccasionClick = (occ: string) => {
    if (occ === 'all') {
      searchParams.delete('occasion');
    } else {
      searchParams.set('occasion', occ);
    }
    setSearchParams(searchParams);
  };

  return (
    <div className={styles.shopContainer}>
      <div className={styles.shopHeader}>
        <div className={styles.headerContent}>
          <h1>{searchQueryParam ? t('shop.resultsFor').replace('{query}', searchQueryParam) : occasionFilter !== 'all' ? occasionFilter : t('shop.allArrangements')}</h1>
          <p>{t('shop.handcraftedWithLoveAndDeliveredFreshToYourDoor')}</p>
        </div>
      </div>

      <div className={styles.shopContent}>
        <div className={styles.controlsBar}>
          <button 
            className={styles.mobileFiltersBtn}
            onClick={() => setIsMobileFiltersOpen(true)}
          >
            <SlidersHorizontal size={18} /> {t('shop.filters')}
          </button>

          <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
            <Search size={16} className={styles.searchIcon} />
            <input 
              key={searchQueryParam}
              type="text" 
              placeholder={t('shop.searchProductsPlaceholder')} 
              defaultValue={searchQueryParam}
              onChange={(e) => setSearchInput(e.target.value)}
              className={styles.searchInput}
            />
          </form>

          <div className={styles.resultsCount}>
            {t('shop.showingResultsCount').replace('{count}', filteredProducts.length.toString())}
          </div>
          <div className={styles.sortWrapper}>
            <span className={styles.sortLabel}>{t('shop.sortBy')}</span>
            <select 
              value={activeSort} 
              onChange={(e) => setActiveSort(e.target.value as SortOption)}
              className={styles.sortSelect}
            >
              <option value="popular">{t('shop.sortPopularity')}</option>
              <option value="price-low">{t('shop.sortPriceLow')}</option>
              <option value="price-high">{t('shop.sortPriceHigh')}</option>
              <option value="newest">{t('shop.newestArrivals')}</option>
            </select>
          </div>
        </div>

        <div className={styles.layout}>
          {/* Sidebar Filters */}
          <aside className={`${styles.sidebar} ${isMobileFiltersOpen ? styles.sidebarOpen : ''}`}>
            <div className={styles.sidebarHeader}>
              <h3>{t('shop.filters')}</h3>
              <button className={styles.closeFilters} onClick={() => setIsMobileFiltersOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={styles.filterSection}>
              <h4>{t('shop.occasion')}</h4>
              <ul className={styles.filterList}>
                <li>
                  <button 
                    className={`${styles.filterBtn} ${occasionFilter === 'all' ? styles.activeFilter : ''}`}
                    onClick={() => handleOccasionClick('all')}
                  >
                    {t('shop.allOccasions')}
                  </button>
                </li>
                {OCCASIONS.map(occ => (
                  <li key={occ.id}>
                    <button 
                      className={`${styles.filterBtn} ${occasionFilter === occ.name ? styles.activeFilter : ''}`}
                      onClick={() => handleOccasionClick(occ.name)}
                    >
                      {occ.name}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.filterSection}>
              <h4>{t('shop.colorPalette')}</h4>
              <ul className={styles.filterList}>
                <li>
                  <button 
                    className={`${styles.filterBtn} ${selectedColor === 'all' ? styles.activeFilter : ''}`}
                    onClick={() => setSelectedColor('all')}
                  >
                    {t('shop.allColors')}
                  </button>
                </li>
                {allColors.map(color => (
                  <li key={color}>
                    <button 
                      className={`${styles.filterBtn} ${selectedColor === color ? styles.activeFilter : ''}`}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className={styles.filterSection}>
              <h4>{t('shop.delivery')}</h4>
              <ul className={styles.filterList}>
                <li>
                  <button 
                    className={`${styles.filterBtn} ${deliveryFilter === 'all' ? styles.activeFilter : ''}`}
                    onClick={() => { searchParams.delete('delivery'); setSearchParams(searchParams); }}
                  >
                    {t('shop.allOptions')}
                  </button>
                </li>
                <li>
                  <button 
                    className={`${styles.filterBtn} ${deliveryFilter === 'sameday' ? styles.activeFilter : ''}`}
                    onClick={() => { searchParams.set('delivery', 'sameday'); setSearchParams(searchParams); }}
                  >
                    {t('shop.sameDayDelivery')}
                  </button>
                </li>
              </ul>
            </div>
          </aside>

          {/* Product Grid */}
          <main className={styles.main}>
            {filteredProducts.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}><Search size={48} /></div>
                <h3>{t('shop.noArrangementsFound')}</h3>
                <p>{t('shop.tryAdjustingYourFiltersOrBrowsingOurFullCollection')}</p>
                <Button onClick={() => { 
                  searchParams.delete('occasion');
                  searchParams.delete('search');
                  searchParams.delete('delivery');
                  setSearchParams(searchParams);
                  setSelectedColor('all'); 
                  setSearchInput('');
                }}>
                  {t('shop.clearAllFilters')}
                </Button>
              </div>
            ) : (
              <div className={styles.productGrid}>
                {filteredProducts.map(product => {
                  const isWished = isInWishlist(product.id);
                  return (
                    <Card key={product.id} className={styles.productCard} onClick={() => navigate(`/product/${product.id}`)}>
                      <div className={styles.productImageWrapper}>
                        <img src={product.imageUrl} alt={product.name} loading="lazy" className={styles.productImage} />
                        {product.isSameDay && <div className={styles.tag}>{t('landing.bestsellers.sameDay')}</div>}
                        
                        <button 
                          className={`${styles.wishlistToggle} ${isWished ? styles.wished : ''}`}
                          onClick={(e) => handleToggleWishlist(e, product.id)}
                        >
                          <Heart size={20} fill={isWished ? 'currentColor' : 'none'} />
                        </button>

                        <div className={styles.quickActions}>
                          <Button size="sm" onClick={(e) => handleAddToCart(e, product)}>{t('landing.featured.addToCart')}</Button>
                        </div>
                      </div>
                      <div className={styles.productInfo}>
                        <span className={styles.productCategory}>{product.category}</span>
                        <h3 className={styles.productName}>{product.name}</h3>
                        <div className={styles.productFooter}>
                          <span className={styles.productPrice}>${product.price}</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};
