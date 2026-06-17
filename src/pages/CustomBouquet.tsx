import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBuilderStore } from '../store/builderStore';
import { useCartStore } from '../store/cartStore';
import { useToastStore } from '../store/toastStore';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Check, ChevronRight, ChevronLeft } from 'lucide-react';
import styles from './CustomBouquet.module.css';
import { useI18n } from '../i18n/I18nProvider';

const STEPS = [
  { id: 'occasion', title: 'Occasion' },
  { id: 'palette', title: 'Color Palette' },
  { id: 'flowers', title: 'Flower Preferences' },
  { id: 'size', title: 'Size & Budget' },
  { id: 'date', title: 'Delivery Date' },
  { id: 'message', title: 'Gift Message' },
  { id: 'review', title: 'Review' }
];

export const CustomBouquet: React.FC = () => {
  const { t } = useI18n();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { state, updateField, reset } = useBuilderStore();
  const { addItem } = useCartStore();
  const { addToast } = useToastStore();
  const navigate = useNavigate();

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleAddToCart = () => {
    addItem({
      productId: 'custom-bouquet',
      name: `Custom ${state.size} Bouquet`,
      price: state.budget,
      quantity: 1,
      imageUrl: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=800&auto=format&fit=crop',
      isCustom: true,
      customDetails: state
    });
    addToast('Custom bouquet added to cart!');
    reset();
    navigate('/cart'); // will open drawer or go to shop
  };

  const isNextDisabled = () => {
    switch (currentStepIndex) {
      case 0: return !state.occasion;
      case 1: return !state.colorPalette;
      case 2: return state.flowers.length === 0;
      case 3: return !state.size || state.budget === 0;
      case 4: return !state.deliveryDate;
      default: return false;
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>{t('custombouquet.designYourCustomBouquet')}</h1>
        <p>Work with our artisans to create a one-of-a-kind arrangement.</p>
      </div>

      <div className={styles.progressContainer}>
        {STEPS.map((step, index) => (
          <div key={step.id} className={`${styles.stepIndicator} ${index <= currentStepIndex ? styles.activeStep : ''}`}>
            <div className={styles.stepCircle}>
              {index < currentStepIndex ? <Check size={14} /> : index + 1}
            </div>
            <span className={styles.stepTitle}>{step.title}</span>
            {index < STEPS.length - 1 && <div className={styles.stepLine} />}
          </div>
        ))}
      </div>

      <div className={styles.wizardContent}>
        {currentStepIndex === 0 && (
          <div className={styles.stepPane}>
            <h2>What's the occasion?</h2>
            <div className={styles.grid}>
              {['Birthday', 'Anniversary', 'Sympathy', 'Wedding', 'Romance', 'Just Because'].map(occ => (
                <Card 
                  key={occ}
                  className={`${styles.optionCard} ${state.occasion === occ ? styles.selected : ''}`}
                  onClick={() => updateField('occasion', occ)}
                >
                  {occ}
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentStepIndex === 1 && (
          <div className={styles.stepPane}>
            <h2>{t('custombouquet.chooseAColorPalette')}</h2>
            <div className={styles.grid}>
              {[
                { name: 'Soft Blush & Cream', color: 'linear-gradient(to right, #fdf5f5, #fdfbf7)' },
                { name: 'Classic Whites & Greens', color: 'linear-gradient(to right, #ffffff, #eef2ec)' },
                { name: 'Warm Champagne & Peach', color: 'linear-gradient(to right, #f1e5d1, #f9ecec)' },
                { name: 'Deep Romance Reds', color: 'linear-gradient(to right, #8b0000, #dfc4c4)' },
                { name: 'Vibrant & Colorful', color: 'linear-gradient(to right, #eab308, #e57373)' },
                { name: 'Florist\'s Choice', color: 'linear-gradient(45deg, #fdf5f5, #eef2ec, #f1e5d1)' }
              ].map(palette => (
                <Card 
                  key={palette.name}
                  className={`${styles.optionCard} ${state.colorPalette === palette.name ? styles.selected : ''}`}
                  onClick={() => updateField('colorPalette', palette.name)}
                >
                  <div className={styles.colorSwatch} style={{ background: palette.color }}></div>
                  {palette.name}
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentStepIndex === 2 && (
          <div className={styles.stepPane}>
            <h2>{t('custombouquet.anySpecificFlowerPreferences')}</h2>
            <p className={styles.helperText}>{t('custombouquet.selectAllThatApplyOrLetUsChooseTheBestSeasonalBlooms')}</p>
            <div className={styles.grid}>
              {['Roses', 'Peonies', 'Lilies', 'Orchids', 'Hydrangeas', 'Tulips', 'Ranunculus', 'Eucalyptus'].map(flower => {
                const isSelected = state.flowers.includes(flower);
                return (
                  <Card 
                    key={flower}
                    className={`${styles.optionCard} ${isSelected ? styles.selected : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        updateField('flowers', state.flowers.filter(f => f !== flower));
                      } else {
                        updateField('flowers', [...state.flowers, flower]);
                      }
                    }}
                  >
                    {flower}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {currentStepIndex === 3 && (
          <div className={styles.stepPane}>
            <h2>{t('custombouquet.selectSizeAndBudget')}</h2>
            <div className={styles.grid3}>
              {([
                { size: 'Standard', price: 75, desc: 'A beautiful, modest arrangement perfect for a desk or side table.' },
                { size: 'Deluxe', price: 125, desc: 'A fuller arrangement with premium blooms. Our most popular choice.' },
                { size: 'Premium', price: 200, desc: 'A show-stopping, luxurious arrangement with our finest seasonal flowers.' }
              ] as const).map(opt => (
                <Card 
                  key={opt.size}
                  className={`${styles.optionCard} ${styles.sizeCard} ${state.size === opt.size ? styles.selected : ''}`}
                  onClick={() => {
                    updateField('size', opt.size);
                    updateField('budget', opt.price);
                  }}
                >
                  <h3>{opt.size}</h3>
                  <div className={styles.price}>${opt.price}</div>
                  <p>{opt.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentStepIndex === 4 && (
          <div className={styles.stepPane}>
            <h2>{t('custombouquet.whenShouldWeDeliver')}</h2>
            <div className={styles.inputGroup}>
              <label>{t('custombouquet.deliveryDate')}</label>
              <input 
                type="date" 
                className={styles.input}
                value={state.deliveryDate}
                onChange={(e) => updateField('deliveryDate', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </div>
        )}

        {currentStepIndex === 5 && (
          <div className={styles.stepPane}>
            <h2>Add a gift message (Optional)</h2>
            <div className={styles.inputGroup}>
              <label>{t('custombouquet.messageToRecipient')}</label>
              <textarea 
                className={styles.textarea}
                rows={4}
                placeholder="Write your heartfelt message here..."
                value={state.message}
                onChange={(e) => updateField('message', e.target.value)}
              />
            </div>
          </div>
        )}

        {currentStepIndex === 6 && (
          <div className={styles.stepPane}>
            <h2>{t('custombouquet.reviewYourCustomBouquet')}</h2>
            <Card className={styles.reviewCard}>
              <div className={styles.reviewRow}>
                <span>Occasion:</span>
                <strong>{state.occasion}</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>Color Palette:</span>
                <strong>{state.colorPalette}</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>Flowers:</span>
                <strong>{state.flowers.join(', ') || 'Florist Choice'}</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>Size:</span>
                <strong>{state.size} (${state.budget})</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>Delivery Date:</span>
                <strong>{state.deliveryDate}</strong>
              </div>
              {state.message && (
                <div className={styles.reviewRowMessage}>
                  <span>Message:</span>
                  <p>"{state.message}"</p>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      <div className={styles.wizardFooter}>
        <Button 
          variant="outline" 
          onClick={handleBack} 
          disabled={currentStepIndex === 0}
        >
          <ChevronLeft size={16} /> Back
        </Button>
        
        {currentStepIndex < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={isNextDisabled()}>
            Next Step <ChevronRight size={16} />
          </Button>
        ) : (
          <Button size="lg" onClick={handleAddToCart}>
            Add to Cart - ${state.budget}
          </Button>
        )}
      </div>
    </div>
  );
};
