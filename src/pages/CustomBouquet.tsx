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
      name: `${t('ui.custom')} ${state.size} Bouquet`,
      price: state.budget,
      quantity: 1,
      imageUrl: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=800&auto=format&fit=crop',
      isCustom: true,
      customDetails: state
    });
    addToast(t('common.addedToCart').replace('{name}', t('landing.hero.customBouquet')));
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
        <p>{t('custombouquet.artisanDesc')}</p>
      </div>

      <div className={styles.progressContainer}>
        {STEPS.map((step, index) => (
          <div key={step.id} className={`${styles.stepIndicator} ${index <= currentStepIndex ? styles.activeStep : ''}`}>
            <div className={styles.stepCircle}>
              {index < currentStepIndex ? <Check size={14} /> : index + 1}
            </div>
            <span className={styles.stepTitle}>{t(`custombouquet.step${step.id.charAt(0).toUpperCase() + step.id.slice(1)}`)}</span>
            {index < STEPS.length - 1 && <div className={styles.stepLine} />}
          </div>
        ))}
      </div>

      <div className={styles.wizardContent}>
        {currentStepIndex === 0 && (
          <div className={styles.stepPane}>
            <h2>{t('custombouquet.whatsOccasion')}</h2>
            <div className={styles.grid}>
              {['Birthday', 'Anniversary', 'Sympathy', 'Wedding', 'Romance', 'Just Because'].map(occ => {
                const occKey = occ.toLowerCase().replace(' ', '');
                return (
                  <Card 
                    key={occ}
                    className={`${styles.optionCard} ${state.occasion === occ ? styles.selected : ''}`}
                    onClick={() => updateField('occasion', occ)}
                  >
                    {t(`custombouquet.${occKey}`)}
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {currentStepIndex === 1 && (
          <div className={styles.stepPane}>
            <h2>{t('custombouquet.chooseAColorPalette')}</h2>
            <div className={styles.grid}>
              {[
                { name: 'Soft Blush & Cream', color: 'linear-gradient(to right, #fdf5f5, #fdfbf7)', key: 'softBlush' },
                { name: 'Classic Whites & Greens', color: 'linear-gradient(to right, #ffffff, #eef2ec)', key: 'classicWhites' },
                { name: 'Warm Champagne & Peach', color: 'linear-gradient(to right, #f1e5d1, #f9ecec)', key: 'warmChampagne' },
                { name: 'Deep Romance Reds', color: 'linear-gradient(to right, #8b0000, #dfc4c4)', key: 'deepReds' },
                { name: 'Vibrant & Colorful', color: 'linear-gradient(to right, #eab308, #e57373)', key: 'vibrantColor' },
                { name: 'Florist\'s Choice', color: 'linear-gradient(45deg, #fdf5f5, #eef2ec, #f1e5d1)', key: 'floristChoice' }
              ].map(palette => (
                <Card 
                  key={palette.name}
                  className={`${styles.optionCard} ${state.colorPalette === palette.name ? styles.selected : ''}`}
                  onClick={() => updateField('colorPalette', palette.name)}
                >
                  <div className={styles.colorSwatch} style={{ background: palette.color }}></div>
                  {t(`custombouquet.${palette.key}`)}
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
                const flowerKey = flower.toLowerCase();
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
                    {t(`custombouquet.${flowerKey}`)}
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
                { size: 'Standard', price: 75, desc: t('custombouquet.sizeStandardDesc') },
                { size: 'Deluxe', price: 125, desc: t('custombouquet.sizeDeluxeDesc') },
                { size: 'Premium', price: 200, desc: t('custombouquet.sizePremiumDesc') }
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
            <h2>{t('custombouquet.addGiftMessageOptional')}</h2>
            <div className={styles.inputGroup}>
              <label>{t('custombouquet.messageToRecipient')}</label>
              <textarea 
                className={styles.textarea}
                rows={4}
                placeholder={t('custombouquet.writeHeartfeltMessagePlaceholder')}
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
                <span>{t('custombouquet.occasionLabel')}</span>
                <strong>{state.occasion ? t(`custombouquet.${state.occasion.toLowerCase().replace(' ', '')}`) : ''}</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>{t('custombouquet.paletteLabel')}</span>
                <strong>{state.colorPalette ? t(`custombouquet.${
                  state.colorPalette.includes('Blush') ? 'softBlush' :
                  state.colorPalette.includes('Whites') ? 'classicWhites' :
                  state.colorPalette.includes('Champagne') ? 'warmChampagne' :
                  state.colorPalette.includes('Reds') ? 'deepReds' :
                  state.colorPalette.includes('Vibrant') ? 'vibrantColor' : 'floristChoice'
                }`) : ''}</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>{t('custombouquet.flowersLabel')}</span>
                <strong>{state.flowers.map(f => t(`custombouquet.${f.toLowerCase()}`)).join(', ') || t('custombouquet.floristChoice')}</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>{t('custombouquet.sizeLabel')}</span>
                <strong>{state.size} (${state.budget})</strong>
              </div>
              <div className={styles.reviewRow}>
                <span>{t('custombouquet.deliveryDateLabel')}</span>
                <strong>{state.deliveryDate}</strong>
              </div>
              {state.message && (
                <div className={styles.reviewRowMessage}>
                  <span>{t('custombouquet.messageLabel')}</span>
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
          <ChevronLeft size={16} /> {t('custombouquet.back')}
        </Button>
        
        {currentStepIndex < STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={isNextDisabled()}>
            {t('custombouquet.nextStep')} <ChevronRight size={16} />
          </Button>
        ) : (
          <Button size="lg" onClick={handleAddToCart}>
            {t('custombouquet.addToCartWithPrice').replace('{price}', state.budget.toString())}
          </Button>
        )}
      </div>
    </div>
  );
};
