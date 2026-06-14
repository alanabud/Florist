import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, Flower2, Truck, CalendarHeart, Users, 
  Repeat, Boxes, BookOpen, FileDown, FileSpreadsheet, Store,
  ChevronDown, Landmark
} from 'lucide-react';
import { useToastStore } from '../../store/toastStore';
import { useAdminStore } from '../../store/adminStore';
import { useFinanceStore } from '../../store/financeStore';
import { exportExecutivePDF } from '../../services/pdfExportService';
import { exportDetailedExcel } from '../../services/excelExportService';
import { QUICK_ACTIONS, type QuickAction } from '../../config/quickActions';
import { useCompany } from '../../context/CompanyContext';
import { useI18n } from '../../i18n/I18nProvider';
import styles from './QuickActionsMenu.module.css';

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  ShoppingBag,
  Flower2,
  Truck,
  CalendarHeart,
  Users,
  Repeat,
  Boxes,
  BookOpen,
  FileDown,
  FileSpreadsheet,
  Store,
  Landmark
};

interface QuickActionsMenuProps {
  onOpenModal: (type: any) => void;
}

export const QuickActionsMenu: React.FC<QuickActionsMenuProps> = ({ onOpenModal }) => {
  const { selectedCompany, companySettings } = useCompany();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const addToast = useToastStore(s => s.addToast);
  const { orders, inventory, products, customers } = useAdminStore();
  const { getTotalTaxPayable, getTotalCash, getTotalAR } = useFinanceStore();
  const { t, language } = useI18n();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleActionClick = (item: QuickAction) => {
    setIsOpen(false);
    if (item.toast?.success) {
      addToast(item.toast.success, 'info');
    }

    if (item.type === 'route') {
      navigate(item.target);
    } else if (item.type === 'storeAction') {
      if (item.target === 'exportPDF') {
        const revenue = orders.reduce((s, o) => s + o.total, 0);
        const ordersCount = orders.length;
        const aov = ordersCount > 0 ? revenue / ordersCount : 0;
        const taxCollected = getTotalTaxPayable();
        const cashBalance = getTotalCash() + revenue;
        const accountsReceivable = getTotalAR();
        const inventoryValue = inventory.reduce((s, i) => s + i.quantity * i.unitCost, 0);

        const ledger = [
          { account: 'Cash', balance: cashBalance, type: 'Asset' },
          { account: 'Accounts Receivable', balance: accountsReceivable, type: 'Asset' },
          { account: 'Inventory Valuation', balance: inventoryValue, type: 'Asset' },
          { account: 'Sales Tax Payable', balance: taxCollected, type: 'Liability' },
          { account: 'Sales Revenue', balance: revenue, type: 'Revenue' }
        ];

        exportExecutivePDF({
          revenue,
          ordersCount,
          aov,
          taxCollected,
          cashBalance,
          accountsReceivable,
          inventoryValue,
          ledger,
          orders,
          inventory,
          products
        }, {
          companyName: selectedCompany?.displayName,
          currencyCode: companySettings?.baseCurrencyCode,
          locale: language,
          reportFooterText: companySettings?.reportFooterText
        });
        addToast('Executive business PDF generated.', 'success');
      } else if (item.target === 'exportExcel') {
        const revenue = orders.reduce((s, o) => s + o.total, 0);
        const ordersCount = orders.length;
        const aov = ordersCount > 0 ? revenue / ordersCount : 0;
        const taxCollected = getTotalTaxPayable();
        const cashBalance = getTotalCash() + revenue;
        const accountsReceivable = getTotalAR();
        const inventoryValue = inventory.reduce((s, i) => s + i.quantity * i.unitCost, 0);

        const ledger = [
          { account: 'Cash', balance: cashBalance, type: 'Asset' },
          { account: 'Accounts Receivable', balance: accountsReceivable, type: 'Asset' },
          { account: 'Inventory Valuation', balance: inventoryValue, type: 'Asset' },
          { account: 'Sales Tax Payable', balance: taxCollected, type: 'Liability' },
          { account: 'Sales Revenue', balance: revenue, type: 'Revenue' }
        ];

        exportDetailedExcel({
          revenue,
          ordersCount,
          aov,
          taxCollected,
          cashBalance,
          accountsReceivable,
          inventoryValue,
          ledger,
          orders,
          inventory,
          products,
          customers
        }, {
          companyName: selectedCompany?.displayName,
          currencyCode: companySettings?.baseCurrencyCode,
          locale: language,
          reportFooterText: companySettings?.reportFooterText
        });
        addToast('Detailed multi-sheet Excel generated.', 'success');
      }
    } else {
      onOpenModal(item.target);
    }
  };

  // Group actions by group field
  const groups: Record<string, QuickAction[]> = {
    Create: [],
    Business: []
  };

  QUICK_ACTIONS.forEach(action => {
    if (groups[action.group]) {
      groups[action.group].push(action);
    }
  });

  return (
    <div className={styles.container} ref={containerRef}>
      <button className={styles.trigger} onClick={() => setIsOpen(!isOpen)}>
        <span>{t('quickActions.trigger')}</span>
        <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.popover}>
          {Object.keys(groups).map(groupName => {
            const items = groups[groupName];
            if (items.length === 0) return null;
            return (
              <div key={groupName} className={styles.group}>
                <span className={styles.groupLabel}>{t('quickActions.group.' + groupName.toLowerCase())}</span>
                {items.map(item => {
                  const IconComponent = iconMap[item.icon] || Store;
                  return (
                    <button 
                      key={item.id} 
                      className={styles.item} 
                      onClick={() => handleActionClick(item)}
                    >
                      <div className={styles.itemIconWrap}>
                        <IconComponent size={16} className={styles.itemIcon} />
                      </div>
                      <div className={styles.itemTextWrap}>
                        <div className={styles.itemHeader}>
                          <span className={styles.itemLabel}>{t('quickActions.' + item.id + '.label')}</span>
                          {item.shortcut && <span className={styles.itemShortcut}>{item.shortcut}</span>}
                        </div>
                        <span className={styles.itemDesc}>{t('quickActions.' + item.id + '.desc')}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
