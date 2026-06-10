import React, { useState } from 'react';
import { useAdminStore } from '../../store/adminStore';
import type { AdminModal } from '../../store/adminStore';
import { useFinanceStore } from '../../store/financeStore';
import { useToastStore } from '../../store/toastStore';
import { restockInventoryAndPostFinancials } from '../../services/financeService';
import { writeAuditLog } from '../../services/auditService';
import { Sparkles, AlertTriangle, TrendingUp, Users } from 'lucide-react';
import styles from './AiInsightsPanel.module.css';

interface AiInsightsPanelProps {
  onOpenModal: (type: AdminModal) => void;
}

export const AiInsightsPanel: React.FC<AiInsightsPanelProps> = ({ onOpenModal }) => {
  const { adjustRosePrices, inventory } = useAdminStore();
  const fetchJournalEntries = useFinanceStore(s => s.fetchJournalEntries);
  const addToast = useToastStore(s => s.addToast);
  
  const [isRestocking, setIsRestocking] = useState(false);
  const [roseAdjusted, setRoseAdjusted] = useState(false);

  const eucItem = inventory.find(i => i.sku === 'EU-001');
  const eucQty = eucItem ? eucItem.quantity : 15;

  const handleRestockEucalyptus = async () => {
    setIsRestocking(true);
    try {
      // Eucalyptus unit cost is $3.00, reordering 50 units = $150.00
      await restockInventoryAndPostFinancials('EU-001', 50, 3.00, 'DEFAULT_COMPANY', 'AI Insights');
      await fetchJournalEntries();
      addToast('Restocked 50 units of Eucalyptus. Cash deducted and transaction logged to General Ledger.', 'success');
    } catch (e) {
      console.error(e);
      addToast('Failed to restock Eucalyptus.', 'error');
    } finally {
      setIsRestocking(false);
    }
  };

  const handleAdjustRoses = async () => {
    adjustRosePrices();
    setRoseAdjusted(true);

    await writeAuditLog({
      actor: 'AI Insights System',
      action: 'PRICE_CHANGE',
      entityType: 'product',
      entityId: 'rose-category',
      before: { markup: 0 },
      after: { markup: 0.15 }
    });

    addToast('Rose prices increased by 15% across catalog.', 'success');
  };

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.headerLeft}>
          <Sparkles size={18} className={styles.sparkle} />
          <h3>AI Insights</h3>
        </div>
      </div>
      <div className={styles.insightsList}>
        {/* Insight 1: Eucalyptus */}
        <div className={styles.insightCard}>
          <div className={styles.insightIcon} style={{ backgroundColor: '#FEF3C7' }}>
            <AlertTriangle size={18} style={{ color: '#F59E0B' }} />
          </div>
          <div className={styles.insightContent}>
            <p className={styles.insightTitle}>Inventory Risk: Restock Eucalyptus</p>
            <p className={styles.insightText}>
              Eucalyptus is below the critical reorder point ({eucQty} remaining). Reordering will purchase 50 units, posting a $150 transaction to the General Ledger.
            </p>
            <button 
              className={styles.actionButton || styles.reviewBtn} 
              onClick={handleRestockEucalyptus}
              disabled={isRestocking}
              style={{
                marginTop: '0.5rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                backgroundColor: 'var(--color-sage)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {isRestocking ? 'Restocking...' : 'Restock Eucalyptus'}
            </button>
          </div>
        </div>

        {/* Insight 2: Rose Price Adjustments */}
        <div className={styles.insightCard}>
          <div className={styles.insightIcon} style={{ backgroundColor: '#D1FAE5' }}>
            <TrendingUp size={18} style={{ color: '#10B981' }} />
          </div>
          <div className={styles.insightContent}>
            <p className={styles.insightTitle}>Pricing Opportunity: Adjust Rose Prices</p>
            <p className={styles.insightText}>
              Mother's Day rush is driving high demand for Red Roses. Automatically increase prices in catalog by 15% to capture premium margins.
            </p>
            <button 
              className={styles.actionButton || styles.reviewBtn} 
              onClick={handleAdjustRoses}
              disabled={roseAdjusted}
              style={{
                marginTop: '0.5rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                backgroundColor: roseAdjusted ? '#94A3B8' : 'var(--color-sage)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: roseAdjusted ? 'not-allowed' : 'pointer',
                fontWeight: 600
              }}
            >
              {roseAdjusted ? 'Prices Adjusted' : 'Adjust Rose Prices (15%)'}
            </button>
          </div>
        </div>

        {/* Insight 3: Contact VIP Client */}
        <div className={styles.insightCard}>
          <div className={styles.insightIcon} style={{ backgroundColor: '#DBEAFE' }}>
            <Users size={18} style={{ color: '#3B82F6' }} />
          </div>
          <div className={styles.insightContent}>
            <p className={styles.insightTitle}>VIP Engagement: Contact VIP Client</p>
            <p className={styles.insightText}>
              Eleanor Vance (Lifetime Value: $1,250) has an upcoming anniversary next week. Reach out with a personalized catalog proposal.
            </p>
            <button 
              className={styles.actionButton || styles.reviewBtn} 
              onClick={() => onOpenModal('contactVip')}
              style={{
                marginTop: '0.5rem',
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                backgroundColor: 'var(--color-sage)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Contact VIP Client
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
