import React, { useState } from 'react';
import { FormModal } from '../ui/FormModal';
import { useAdminStore } from '../../store/adminStore';
import { useToastStore } from '../../store/toastStore';
import { useFinanceStore } from '../../store/financeStore';
import { postJournalEntry } from '../../services/financeService';
import { writeAuditLog } from '../../services/auditService';
import modalStyles from '../ui/FormModal.module.css';
import { CHART_OF_ACCOUNTS } from '../../services/chartOfAccounts';

// Import newly split form components
import { OrderMaintenanceForm } from '../maintenance/forms/OrderMaintenanceForm';
import { ProductMaintenanceForm } from '../maintenance/forms/ProductMaintenanceForm';
import { CustomerMaintenanceForm } from '../maintenance/forms/CustomerMaintenanceForm';
import { InventoryMaintenanceForm } from '../maintenance/forms/InventoryMaintenanceForm';
import { SubscriptionMaintenanceForm } from '../maintenance/forms/SubscriptionMaintenanceForm';
import { EventMaintenanceForm } from '../maintenance/forms/EventMaintenanceForm';
import { DeliveryMaintenanceForm } from '../maintenance/forms/DeliveryMaintenanceForm';
import { AccountMaintenanceForm } from '../maintenance/forms/AccountMaintenanceForm';
import { PaymentMaintenanceForm } from '../maintenance/forms/PaymentMaintenanceForm';
import { CustomerStatementForm } from '../maintenance/forms/CustomerStatementForm';

// Helper functions to generate stable IDs outside the render lifecycle to satisfy ESLint purity rules
const generateCustomProductId = () => `p-custom-${Date.now()}`;
const generateManualJournalId = () => `manual-${Date.now().toString(36)}`;

interface ModalFormsProps {
  activeModal: string | null;
  onClose: () => void;
}

export const ModalForms: React.FC<ModalFormsProps> = ({ activeModal, onClose }) => {
  return (
    <>
      {/* Split Premium Maintenance Forms */}
      <OrderMaintenanceForm isOpen={activeModal === 'newOrder'} onClose={onClose} />
      <InventoryMaintenanceForm isOpen={activeModal === 'newInventory'} onClose={onClose} />
      <ProductMaintenanceForm isOpen={activeModal === 'newProduct'} onClose={onClose} />
      <CustomerMaintenanceForm isOpen={activeModal === 'newCustomer'} onClose={onClose} />
      <SubscriptionMaintenanceForm isOpen={activeModal === 'newSubscription'} onClose={onClose} />
      <EventMaintenanceForm isOpen={activeModal === 'newEvent'} onClose={onClose} />
      <DeliveryMaintenanceForm isOpen={activeModal === 'newDelivery'} onClose={onClose} />
      <AccountMaintenanceForm isOpen={activeModal === 'newAccount'} onClose={onClose} />
      <PaymentMaintenanceForm isOpen={activeModal === 'newPayment'} onClose={onClose} />
      <CustomerStatementForm isOpen={activeModal === 'newStatement'} onClose={onClose} />

      {/* Special/Action-oriented Modals remaining in standard FormModal */}
      <CreateCustomBouquetModal isOpen={activeModal === 'customBouquet'} onClose={onClose} />
      <NewJournalModal isOpen={activeModal === 'newJournal'} onClose={onClose} />
      <VipClientModal isOpen={activeModal === 'contactVip'} onClose={onClose} />
    </>
  );
};

/* ==================== CREATE CUSTOM BOUQUET MODAL ==================== */
function CreateCustomBouquetModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const addToast = useToastStore(s => s.addToast);
  const { addProduct, deductStemsFromInventory } = useAdminStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    redRoses: '0',
    whiteRoses: '0',
    peonies: '0',
    eucalyptus: '0',
    ribbon: 'satin',
    packaging: 'kraft',
    cardMessage: '',
    customPrice: ''
  });

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const materials = {
    redRoses: { cost: 1.50, name: 'Red Roses' },
    whiteRoses: { cost: 1.25, name: 'White Roses' },
    peonies: { cost: 4.50, name: 'Pink Peonies' },
    eucalyptus: { cost: 3.00, name: 'Eucalyptus' },
  };

  const ribbons: Record<string, { name: string; price: number; cost: number }> = {
    satin: { name: 'Satin Ribbon', price: 5, cost: 1.00 },
    velvet: { name: 'Velvet Ribbon', price: 8, cost: 2.00 },
    jute: { name: 'Jute Twine', price: 3, cost: 0.50 },
    none: { name: 'None', price: 0, cost: 0.00 }
  };

  const packagings: Record<string, { name: string; price: number; cost: number }> = {
    kraft: { name: 'Kraft Paper', price: 5, cost: 1.00 },
    box: { name: 'Premium Box', price: 15, cost: 3.00 },
    none: { name: 'None', price: 0, cost: 0.00 }
  };

  const redRosesQty = parseInt(form.redRoses) || 0;
  const whiteRosesQty = parseInt(form.whiteRoses) || 0;
  const peoniesQty = parseInt(form.peonies) || 0;
  const eucalyptusQty = parseInt(form.eucalyptus) || 0;

  const ribbonCost = ribbons[form.ribbon].cost;
  const packagingCost = packagings[form.packaging].cost;

  const materialCost = 
    redRosesQty * materials.redRoses.cost +
    whiteRosesQty * materials.whiteRoses.cost +
    peoniesQty * materials.peonies.cost +
    eucalyptusQty * materials.eucalyptus.cost +
    ribbonCost +
    packagingCost;

  const suggestedPrice = Math.round(materialCost * 2.5);
  const displayPrice = form.customPrice ? parseFloat(form.customPrice) : suggestedPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!form.name) {
      addToast('Bouquet name is required.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const stemsDetail = [
        redRosesQty > 0 ? `${redRosesQty}x Red Roses` : '',
        whiteRosesQty > 0 ? `${whiteRosesQty}x White Roses` : '',
        peoniesQty > 0 ? `${peoniesQty}x Pink Peonies` : '',
        eucalyptusQty > 0 ? `${eucalyptusQty}x Eucalyptus` : '',
      ].filter(Boolean).join(', ');

      const desc = `Custom bouquet containing: ${stemsDetail || 'Florist Choice'}. Ribbon: ${ribbons[form.ribbon].name}. Packaging: ${packagings[form.packaging].name}. Notes: ${form.cardMessage || 'None'}`;

      addProduct({
        id: generateCustomProductId(),
        name: form.name,
        price: displayPrice,
        description: desc,
        category: 'Custom',
        occasions: ['Just Because'],
        colors: ['Mixed'],
        imageUrl: 'https://images.unsplash.com/photo-1561181286-d3fee7d55364?q=80&w=800&auto=format&fit=crop',
        isBestSeller: false,
        isSameDay: true,
        isTaxable: true,
        rating: 5.0,
        inStock: true,
        tags: ['custom', 'bouquet']
      });

      deductStemsFromInventory({
        'RR-001': redRosesQty,
        'WR-001': whiteRosesQty,
        'PP-001': peoniesQty,
        'EU-001': eucalyptusQty
      });

      addToast(`Custom bouquet "${form.name}" added to catalog.`, 'success');
      setForm({ name: '', redRoses: '0', whiteRoses: '0', peonies: '0', eucalyptus: '0', ribbon: 'satin', packaging: 'kraft', cardMessage: '', customPrice: '' });
      onClose();
    } catch (err) {
      console.error(err);
      addToast('Failed to create custom bouquet.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="Create Custom Bouquet (Admin Builder)">
      <form onSubmit={handleSubmit}>
        <div className={modalStyles.formGrid}>
          <div className={`${modalStyles.formGroup} ${modalStyles.formGroupFull}`}>
            <label className={modalStyles.formLabel}>Bouquet Name *</label>
            <input name="name" value={form.name} onChange={update} className={modalStyles.formInput} placeholder="e.g. Lavender Fields Arrangement" required />
          </div>
          <div className={modalStyles.formGroup}>
            <label className={modalStyles.formLabel}>Red Roses (Stems)</label>
            <input type="number" name="redRoses" value={form.redRoses} onChange={update} className={modalStyles.formInput} min="0" />
          </div>
          <div className={modalStyles.formGroup}>
            <label className={modalStyles.formLabel}>White Roses (Stems)</label>
            <input type="number" name="whiteRoses" value={form.whiteRoses} onChange={update} className={modalStyles.formInput} min="0" />
          </div>
          <div className={modalStyles.formGroup}>
            <label className={modalStyles.formLabel}>Pink Peonies (Stems)</label>
            <input type="number" name="peonies" value={form.peonies} onChange={update} className={modalStyles.formInput} min="0" />
          </div>
          <div className={modalStyles.formGroup}>
            <label className={modalStyles.formLabel}>Eucalyptus (Bunches)</label>
            <input type="number" name="eucalyptus" value={form.eucalyptus} onChange={update} className={modalStyles.formInput} min="0" />
          </div>
          <div className={modalStyles.formGroup}>
            <label className={modalStyles.formLabel}>Ribbon Selection</label>
            <select name="ribbon" value={form.ribbon} onChange={update} className={modalStyles.formInput}>
              <option value="satin">Satin Ribbon (+$5.00)</option>
              <option value="velvet">Velvet Ribbon (+$8.00)</option>
              <option value="jute">Jute Twine (+$3.00)</option>
              <option value="none">None ($0.00)</option>
            </select>
          </div>
          <div className={modalStyles.formGroup}>
            <label className={modalStyles.formLabel}>Packaging Option</label>
            <select name="packaging" value={form.packaging} onChange={update} className={modalStyles.formInput}>
              <option value="kraft">Kraft Paper Wrap (+$5.00)</option>
              <option value="box">Signature Gift Box (+$15.00)</option>
              <option value="none">None ($0.00)</option>
            </select>
          </div>
          <div className={`${modalStyles.formGroup} ${modalStyles.formGroupFull}`} style={{ background: '#F5F1E7', padding: '1rem', borderRadius: '10px' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>
              Materials Cost: <strong>${materialCost.toFixed(2)}</strong>
            </p>
            <p style={{ margin: '0.25rem 0 0.75rem 0', fontSize: '0.8125rem', color: '#6b7280' }}>
              Suggested Retail Price (2.5x markup): <strong>${suggestedPrice.toFixed(2)}</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className={modalStyles.formLabel} style={{ marginBottom: 0, whiteSpace: 'nowrap' }}>Selling Price ($):</label>
              <input type="number" name="customPrice" value={form.customPrice} onChange={update} placeholder={suggestedPrice.toString()} className={modalStyles.formInput} style={{ width: '120px' }} />
            </div>
          </div>
        </div>
        <div className={modalStyles.formActions}>
          <button type="button" className={modalStyles.btnCancel} onClick={onClose}>Cancel</button>
          <button type="submit" className={modalStyles.btnSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save to Catalog'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}

/* ==================== NEW JOURNAL ENTRY MODAL ==================== */
function NewJournalModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const addToast = useToastStore(s => s.addToast);
  const { fetchJournalEntries, chartOfAccounts, fetchChartOfAccounts } = useFinanceStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      fetchChartOfAccounts();
    }
  }, [isOpen, fetchChartOfAccounts]);

  const activeCOA = chartOfAccounts.length > 0 ? chartOfAccounts : CHART_OF_ACCOUNTS;
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [memo, setMemo] = useState('');
  const [lines, setLines] = useState<Array<{ account: string; debit: string; credit: string }>>([
    { account: 'Cash', debit: '', credit: '' },
    { account: 'Sales Revenue', debit: '', credit: '' }
  ]);

  const handleAddLine = () => {
    setLines([...lines, { account: 'Cash', debit: '', credit: '' }]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: 'account' | 'debit' | 'credit', value: string) => {
    const updated = [...lines];
    if (field === 'account') {
      updated[index].account = value;
    } else if (field === 'debit') {
      updated[index].debit = value;
      if (parseFloat(value) > 0) {
        updated[index].credit = ''; // Clear credit if debit is set
      }
    } else {
      updated[index].credit = value;
      if (parseFloat(value) > 0) {
        updated[index].debit = ''; // Clear debit if credit is set
      }
    }
    setLines(updated);
  };

  // Calculations
  const parsedLines = lines.map(l => ({
    account: l.account,
    debit: parseFloat(l.debit) || 0,
    credit: parseFloat(l.credit) || 0
  }));

  const totalDebits = parsedLines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredits = parsedLines.reduce((sum, l) => sum + l.credit, 0);

  // Validation warnings
  const errors: string[] = [];
  if (!memo.trim()) errors.push('Memo/Description is required.');
  if (!date) errors.push('Date is required.');
  if (lines.length < 2) errors.push('At least 2 lines are required.');
  
  parsedLines.forEach((l, idx) => {
    if (l.debit === 0 && l.credit === 0) {
      errors.push(`Line ${idx + 1}: Either Debit or Credit must be greater than zero.`);
    }
    if (l.debit > 0 && l.credit > 0) {
      errors.push(`Line ${idx + 1}: Cannot have both Debit and Credit on the same line.`);
    }
    const acct = activeCOA.find(a => a.name === l.account);
    if (acct && acct.allowManualPosting === false) {
      errors.push(`Line ${idx + 1}: Account "${acct.name}" (${acct.code}) does not allow manual journal posting.`);
    }
  });

  if (Math.abs(totalDebits - totalCredits) >= 0.01) {
    errors.push(`Out of Balance by $${Math.abs(totalDebits - totalCredits).toFixed(2)} (Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)})`);
  } else if (totalDebits === 0) {
    errors.push('Transaction amount must be greater than zero.');
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (errors.length > 0) {
      addToast(errors[0], 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const journalId = generateManualJournalId();
      const jeId = await postJournalEntry({
        orderId: journalId,
        companyId: 'DEFAULT_COMPANY',
        createdBy: 'Admin',
        description: memo.trim(),
        lines: parsedLines.map(l => {
          const acct = activeCOA.find(a => a.name === l.account);
          return {
            account: l.account as any,
            debit: l.debit,
            credit: l.credit,
            accountId: acct?.id || '',
            accountName: acct?.name || ''
          };
        }),
        sourceType: 'manual_journal',
        sourceId: journalId,
        sourceLabel: 'Manual Journal',
        createdAt: new Date(date)
      });

      await writeAuditLog({
        actor: 'Admin',
        action: 'LOG_JOURNAL_ENTRY',
        entityType: 'finance',
        entityId: jeId,
        before: null,
        after: { description: memo.trim(), date, lines: parsedLines },
        journalEntryId: jeId
      });

      await fetchJournalEntries();
      addToast('Balanced journal entry posted successfully.', 'success');
      setMemo('');
      setDate(new Date().toISOString().split('T')[0]);
      setLines([
        { account: 'Cash', debit: '', credit: '' },
        { account: 'Sales Revenue', debit: '', credit: '' }
      ]);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      addToast('Failed to post journal entry.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="Log Balanced Journal Entry">
      <form onSubmit={handleSubmit} style={{ maxWidth: '750px', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label className={modalStyles.formLabel}>Transaction Memo / Description *</label>
            <input 
              type="text"
              value={memo} 
              onChange={(e) => setMemo(e.target.value)} 
              className={modalStyles.formInput} 
              placeholder="e.g. Adjust physical flower inventory count"
              required 
            />
          </div>
          <div>
            <label className={modalStyles.formLabel}>Posting Date *</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              className={modalStyles.formInput} 
              required 
            />
          </div>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.25fr 1.25fr 0.5fr', gap: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E8EAE6', fontWeight: 600, fontSize: '0.8125rem', color: '#8a8f8c', textTransform: 'uppercase' }}>
            <span>GL Account</span>
            <span style={{ textAlign: 'right' }}>Debit ($)</span>
            <span style={{ textAlign: 'right' }}>Credit ($)</span>
            <span></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '220px', overflowY: 'auto', paddingRight: '0.25rem' }}>
            {lines.map((line, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 1.25fr 1.25fr 0.5fr', gap: '0.75rem', alignItems: 'center' }}>
                <select
                  value={line.account}
                  onChange={(e) => handleLineChange(index, 'account', e.target.value)}
                  className={modalStyles.formInput}
                  style={{ padding: '0.45rem' }}
                >
                  {activeCOA.filter(a => a.active).map(acc => (
                    <option key={acc.code} value={acc.name}>
                      {acc.code} — {acc.name} ({acc.type.toUpperCase()})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  placeholder="0.00"
                  value={line.debit}
                  onChange={(e) => handleLineChange(index, 'debit', e.target.value)}
                  className={modalStyles.formInput}
                  style={{ textAlign: 'right', padding: '0.45rem' }}
                  step="0.01"
                  min="0"
                />

                <input
                  type="number"
                  placeholder="0.00"
                  value={line.credit}
                  onChange={(e) => handleLineChange(index, 'credit', e.target.value)}
                  className={modalStyles.formInput}
                  style={{ textAlign: 'right', padding: '0.45rem' }}
                  step="0.01"
                  min="0"
                />

                <button
                  type="button"
                  onClick={() => handleRemoveLine(index)}
                  disabled={lines.length <= 2}
                  style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '1.125rem', cursor: 'pointer', opacity: lines.length <= 2 ? 0.3 : 1 }}
                  title="Remove Line"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <button
              type="button"
              onClick={handleAddLine}
              style={{ background: 'none', border: '1px dashed #4A6B50', color: '#4A6B50', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Ledger Line
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1.25fr 0.5fr', gap: '0.75rem', width: '310px', textAlign: 'right', fontSize: '0.875rem', fontWeight: 600 }}>
              <div style={{ color: '#2C302E' }}>${totalDebits.toFixed(2)}</div>
              <div style={{ color: '#2C302E' }}>${totalCredits.toFixed(2)}</div>
              <div></div>
            </div>
          </div>
        </div>

        {/* Validation Info / Warnings */}
        {errors.length > 0 ? (
          <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '1.25rem' }}>
            {errors.map((err, i) => <div key={i}>⚠️ {err}</div>)}
          </div>
        ) : (
          <div style={{ padding: '0.75rem 1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', color: '#047857', fontSize: '0.75rem', fontWeight: 600, marginBottom: '1.25rem' }}>
            ✓ Journal entry balances perfectly and is ready to post.
          </div>
        )}

        <div className={modalStyles.formActions} style={{ borderTop: '1px solid #E8EAE6', paddingTop: '1rem', marginTop: '0' }}>
          <button type="button" className={modalStyles.btnCancel} onClick={onClose}>Cancel</button>
          <button 
            type="submit" 
            className={modalStyles.btnSubmit} 
            disabled={isSubmitting || errors.length > 0}
            style={{ opacity: errors.length > 0 ? 0.5 : 1, cursor: errors.length > 0 ? 'not-allowed' : 'pointer' }}
          >
            {isSubmitting ? 'Posting Ledger...' : 'Post Balanced Entry'}
          </button>
        </div>
      </form>
    </FormModal>
  );
}

/* ==================== VIP CLIENT CONTACT CARD MODAL ==================== */
function VipClientModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { orders, modalPayload } = useAdminStore();
  const customerName = (modalPayload?.name as string) || 'Eleanor Vance';
  const customerEmail = (modalPayload?.email as string) || 'eleanor@example.com';
  const customerPhone = (modalPayload?.phone as string) || '555-0101';
  const ltv = (modalPayload?.lifetimeValue !== undefined && modalPayload?.lifetimeValue !== null) ? `$${(modalPayload.lifetimeValue as number).toFixed(2)}` : '$1,250.00';
  const totalOrders = (modalPayload?.totalOrders !== undefined && modalPayload?.totalOrders !== null) ? `${modalPayload.totalOrders as number} Orders` : '8 Orders';
  
  const clientOrders = orders.filter(o => o.customerName === customerName);
  const initials = customerName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="VIP Client Engagement Card">
      <div style={{ padding: '0.5rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid #E8EAE6', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#F5F1E7', color: 'var(--color-sage-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 600 }}>
            {initials}
          </div>
          <div>
            <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--color-text-main)' }}>{customerName}</h3>
            <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.5rem', borderRadius: '999px', background: '#DBEAFE', color: '#1E40AF', fontWeight: 600 }}>VIP Customer</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ background: '#F9ECEC', padding: '0.75rem', borderRadius: '10px' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Lifetime Value</p>
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{ltv}</p>
          </div>
          <div style={{ background: '#EAF0EB', padding: '0.75rem', borderRadius: '10px' }}>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Total Orders</p>
            <p style={{ margin: '0.125rem 0 0 0', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-main)' }}>{totalOrders}</p>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--color-text-main)' }}>Contact Channels</h4>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a href={`mailto:${customerEmail}`} style={{ flex: 1, textDecoration: 'none', textAlign: 'center', padding: '0.5rem', borderRadius: '8px', border: '1px solid #E8EAE6', background: '#FFFFFF', color: 'var(--color-text-main)', fontSize: '0.8125rem', fontWeight: 600, transition: 'all 150ms' }}
               onMouseEnter={e => e.currentTarget.style.background = '#F5F1E7'}
               onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}>
              📧 Email Client
            </a>
            <a href={`tel:${customerPhone}`} style={{ flex: 1, textDecoration: 'none', textAlign: 'center', padding: '0.5rem', borderRadius: '8px', border: '1px solid #E8EAE6', background: '#FFFFFF', color: 'var(--color-text-main)', fontSize: '0.8125rem', fontWeight: 600, transition: 'all 150ms' }}
               onMouseEnter={e => e.currentTarget.style.background = '#F5F1E7'}
               onMouseLeave={e => e.currentTarget.style.background = '#FFFFFF'}>
              📞 Call Client
            </a>
          </div>
        </div>

        <div>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem', color: 'var(--color-text-main)' }}>Recent Order History</h4>
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #E8EAE6', borderRadius: '10px', padding: '0.5rem' }}>
            {clientOrders.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', padding: '1rem' }}>No orders found.</p>
            ) : (
              clientOrders.map(o => (
                <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', borderBottom: '1px solid #F0EDE6', fontSize: '0.75rem' }}>
                  <span>Order #{o.id.substring(0, 8)}</span>
                  <span>{new Date(o.createdAt).toLocaleDateString()}</span>
                  <span style={{ fontWeight: 600 }}>${o.total.toFixed(2)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button type="button" className={modalStyles.btnCancel} onClick={onClose}>Close</button>
        </div>
      </div>
    </FormModal>
  );
}
