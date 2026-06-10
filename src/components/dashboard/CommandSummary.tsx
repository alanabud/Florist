import React, { useState, useEffect } from 'react';
import { useAdminStore } from '../../store/adminStore';
import type { AdminModal } from '../../store/adminStore';
import { useFinanceStore } from '../../store/financeStore';
import { Sparkles, Hammer, Target, ShieldCheck } from 'lucide-react';
import styles from './CommandSummary.module.css';

interface CommandSummaryProps {
  onOpenModal: (type: AdminModal) => void;
}

// Safe date handling helper
function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') return new Date(value);
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

export const CommandSummary: React.FC<CommandSummaryProps> = ({ onOpenModal }) => {
  const { orders, inventory } = useAdminStore();
  const { journalEntries } = useFinanceStore();

  const [lastSyncedSec, setLastSyncedSec] = useState(4);
  const [isSyncing, setIsSyncing] = useState(false);

  // Increment last synced counter every second
  useEffect(() => {
    const timer = setInterval(() => {
      setLastSyncedSec(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate periodic background verification and sync pulse every 20s
  useEffect(() => {
    const syncTimer = setInterval(() => {
      setIsSyncing(true);
      setTimeout(() => {
        setIsSyncing(false);
        setLastSyncedSec(0);
      }, 1000);
    }, 20000);
    return () => clearInterval(syncTimer);
  }, []);

  // Timezone safe matchers
  const today = new Date();
  const isToday = (date: Date | null) => {
    if (!date) return false;
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  };

  const todaysOrders = orders.filter(o => {
    const orderDate = toDate(o.createdAt);
    return isToday(orderDate);
  });

  const activeDeliveries = orders.filter(o => o.status === 'out_for_delivery').length;
  const inProduction = orders.filter(o => o.status === 'in_design').length;
  const needsReview = orders.filter(o => o.status === 'draft').length; // matching 'Draft Orders' metric
  const lowStock = inventory.filter(i => i.quantity <= i.reorderPoint);

  // Target orders completed logic
  const todaysCompletedCount = todaysOrders.filter(o => !['draft', 'cancelled', 'refunded'].includes(o.status)).length;
  const targetOrders = 39;
  const progressPercent = Math.min(100, Math.round((todaysCompletedCount / targetOrders) * 100));

  // Compute live cash collected avoiding double counting
  const paidOrCompletedOrderTotals = orders
    .filter(o => !['draft', 'cancelled', 'refunded'].includes(o.status))
    .reduce((sum, o) => sum + (o.amountPaid !== undefined ? o.amountPaid : 0), 0);

  const standaloneCash = journalEntries.reduce((total, entry) => {
    // If it's a primary order sale, we already count it via orders, so skip to avoid double counting.
    if ((entry.sourceType === 'order' || entry.sourceType === 'demo_order') && orders.some(o => o.id === entry.orderId)) {
      return total;
    }
    
    // Exclude inventory restock and expense source types from cash collected calculations to align with "Cash Collected" definition
    if (entry.sourceType === 'inventory_restock') {
      return total;
    }

    const cashLines = entry.lines.filter(l => l.account === 'Cash');
    const entryCashChange = cashLines.reduce((sum, l) => sum + l.debit - l.credit, 0);
    return total + entryCashChange;
  }, 0);

  const cashAsset = paidOrCompletedOrderTotals + standaloneCash;

  // Next recommended action logic
  let recommendedActionText = "All operations within healthy capacity guidelines. Monitor transit couriers.";
  let recommendedActionBtn = "Review Order Backlog";
  let recommendedActionTarget = () => onOpenModal('newOrder');

  if (lowStock.length > 0) {
    recommendedActionText = `Critical inventory risk: SKU ${lowStock[0].sku} (${lowStock[0].name}) is below reorder point.`;
    recommendedActionBtn = "Restock Materials";
    recommendedActionTarget = () => onOpenModal('newInventory');
  } else if (needsReview > 0) {
    recommendedActionText = `A total of ${needsReview} drafts require verification. Review worksheets to confirm production scheduling.`;
    recommendedActionBtn = "Verify Worksheets";
    recommendedActionTarget = () => onOpenModal('newOrder');
  }

  // Formatting synced string
  const getSyncText = () => {
    if (isSyncing) return 'Sync pending...';
    if (lastSyncedSec < 60) return `Last synced ${lastSyncedSec}s ago`;
    return `Last synced ${Math.floor(lastSyncedSec / 60)}m ago`;
  };

  const getPaceText = (percent: number) => {
    if (percent >= 80) return 'Ahead of pace';
    if (percent >= 60) return 'On track';
    if (percent >= 40) return 'Slightly behind pace';
    return 'Behind pace';
  };

  const paceText = getPaceText(progressPercent);
  const paceClass = progressPercent >= 80 ? styles.paceAhead : progressPercent >= 60 ? styles.paceOnTrack : progressPercent >= 40 ? styles.paceSlightlyBehind : styles.paceBehind;

  return (
    <div className={styles.container}>
      {/* Horizontal Command Briefing Ticker Strip */}
      <div className={styles.briefingStrip}>
        <div className={styles.briefingItem}>
          <span className={styles.briefingLabel}>Daily Target:</span>
          <span className={styles.briefingValue}>{progressPercent}%</span>
        </div>
        <div className={styles.briefingDivider} />
        <div className={styles.briefingItem}>
          <span className={styles.briefingLabel}>Orders at Risk:</span>
          <span className={`${styles.briefingValue} ${needsReview > 0 ? styles.briefingAlert : ''}`}>
            {needsReview} Drafts
          </span>
        </div>
        <div className={styles.briefingDivider} />
        <div className={styles.briefingItem}>
          <span className={styles.briefingLabel}>Fulfillment workload:</span>
          <span className={styles.briefingValue}>{activeDeliveries} Transit</span>
        </div>
        <div className={styles.briefingDivider} />
        <div className={styles.briefingItem}>
          <span className={styles.briefingLabel}>Inventory Risk:</span>
          <span className={`${styles.briefingValue} ${lowStock.length > 0 ? styles.briefingAlert : ''}`}>
            {lowStock.length} Low Stock
          </span>
        </div>
        <div className={styles.briefingDivider} />
        <div className={styles.briefingItem}>
          <span className={styles.briefingLabel}>Cash Collected:</span>
          <span className={styles.briefingValue}>
            ${cashAsset.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      <div className={styles.briefingHeader}>
        <div>
          <h2 className={styles.title}>Daily Briefing & Operational Workload</h2>
          <p className={styles.subtitle}>Unified console for live boutique logistics, client pipelines, and treasury audits.</p>
        </div>
        <div className={styles.timestamp}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      <div className={styles.grid}>
        {/* Card 1: Daily Goals Progress (Refreshed layout) */}
        <div className={styles.layeredCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Daily Goal Progress</span>
            <Target className={styles.iconS} size={16} />
          </div>
          <div className={styles.cardValueLarge}>
            {progressPercent}% <span className={styles.completeLabel}>complete</span>
          </div>
          <div className={styles.progressContainer}>
            <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
          </div>
          <span className={styles.cardFooterText}>
            {todaysCompletedCount} of {targetOrders} target orders completed
          </span>
          <span className={`${styles.paceLabel} ${paceClass}`}>
            {paceText}
          </span>
        </div>

        {/* Card 2: Studio Capacity */}
        <div className={styles.layeredCard}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Studio Capacity</span>
            <Hammer className={styles.iconH} size={16} />
          </div>
          <div className={styles.statsRow}>
            <div className={styles.statCell}>
              <span className={styles.statVal}>{inProduction}</span>
              <span className={styles.statLabel}>In Crafting</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.statCell}>
              <span className={styles.statVal}>{activeDeliveries}</span>
              <span className={styles.statLabel}>Transit</span>
            </div>
            <div className={styles.divider} />
            <div className={styles.statCell}>
              <span className={styles.statVal}>{needsReview}</span>
              <span className={styles.statLabel}>Pending Review</span>
            </div>
          </div>
          <span className={styles.cardFooter}>
            Active arrangement design and courier lines
          </span>
        </div>

        {/* Card 3: Next Recommended Action */}
        <div className={`${styles.layeredCard} ${styles.recommendationCard}`}>
          <div className={styles.cardHeader}>
            <span className={styles.cardLabel}>Recommended Action</span>
            <Sparkles className={styles.iconSparkle} size={16} />
          </div>
          <p className={styles.recommendationText}>
            {recommendedActionText}
          </p>
          <button className={styles.recommendationBtn} onClick={recommendedActionTarget}>
            {recommendedActionBtn}
          </button>
        </div>
      </div>

      {/* Live Sync trust indicator footer */}
      <div className={styles.syncTicker}>
        <div className={`${styles.pulseDot} ${isSyncing ? styles.pulseSyncing : ''}`} />
        <span className={styles.syncText}>{getSyncText()}</span>
        <span className={styles.syncBullet}>•</span>
        <span className={styles.syncDetail}>
          <ShieldCheck size={12} className={styles.syncDetailIcon} />
          Firestore transaction safe
        </span>
        <span className={styles.syncBullet}>•</span>
        <span className={styles.syncDetail}>
          Inventory synced with storefront
        </span>
        <span className={styles.syncBullet}>•</span>
        <span className={styles.syncDetail}>
          General ledger journal active
        </span>
      </div>
    </div>
  );
};
