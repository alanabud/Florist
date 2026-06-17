/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { FormModal } from '../../ui/FormModal';
import { useAdminStore, type VendorBill, type VendorBillLine } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { createVendorBill, postVendorBill, voidVendorBill } from '../../../services/vendorBillService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useCompany } from '../../../context/CompanyContext';
import modalStyles from '../../ui/FormModal.module.css';
import { useI18n } from '../../../i18n/I18nProvider';

interface VendorBillFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VendorBillForm: React.FC<VendorBillFormProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const { selectedCompanyId } = useCompany();
  const addToast = useToastStore((s) => s.addToast);
  const { modalPayload, vendors, purchaseOrders, fetchVendors, fetchPurchaseOrders } = useAdminStore();

  const isEdit = !!modalPayload?.id;
  const currentBill = isEdit ? (modalPayload as VendorBill) : null;
  const isLocked = currentBill ? currentBill.status !== 'draft' : false;

  const [billType, setBillType] = useState<'po' | 'manual'>('manual');
  const [vendorId, setVendorId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const [poId, setPoId] = useState('');
  
  const [taxAmount, setTaxAmount] = useState('0');
  const [freightAmount, setFreightAmount] = useState('0');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');

  const [lines, setLines] = useState<VendorBillLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load vendors and POs on mount
  useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchPurchaseOrders();
    }
  }, [isOpen, fetchVendors, fetchPurchaseOrders]);

  // Handle default due date based on payment terms and bill date
  useEffect(() => {
    if (billDate) {
      const daysMap: Record<string, number> = {
        'Due on Receipt': 0,
        'Net 15': 15,
        'Net 30': 30,
        'Net 45': 45,
        'Net 60': 60
      };
      const days = daysMap[paymentTerms] || 30;
      const d = new Date(billDate);
      d.setDate(d.getDate() + days);
      setDueDate(d.toISOString().split('T')[0]);
    }
  }, [billDate, paymentTerms]);

  // Load initial values
  useEffect(() => {
    if (isOpen) {
      if (currentBill) {
        setVendorId(currentBill.vendorId);
        setBillNumber(currentBill.billNumber || '');
        setBillDate(currentBill.billDate ? currentBill.billDate.split('T')[0] : '');
        setDueDate(currentBill.dueDate ? currentBill.dueDate.split('T')[0] : '');
        setPaymentTerms(currentBill.paymentTerms || 'Net 30');
        setPoId(currentBill.poId || '');
        setBillType(currentBill.poId ? 'po' : 'manual');
        setTaxAmount(String(currentBill.taxAmount || 0));
        setFreightAmount(String(currentBill.freightAmount || 0));
        setDiscountAmount(String(currentBill.discountAmount || 0));
        setNotes(currentBill.notes || '');
        setLines(currentBill.lines || []);
      } else {
        setVendorId(vendors[0]?.id || '');
        setBillNumber('');
        setBillDate(new Date().toISOString().split('T')[0]);
        setPaymentTerms('Net 30');
        setPoId('');
        setBillType('manual');
        setTaxAmount('0');
        setFreightAmount('0');
        setDiscountAmount('0');
        setNotes('');
        setLines([{ description: '', quantity: 1, unitCost: 0, lineTotal: 0, glAccount: '5200' }]);
      }
    }
  }, [isOpen, currentBill, vendors]);

  // When PO selection changes, populate lines and vendor
  useEffect(() => {
    if (billType === 'po' && poId && !isLocked) {
      const selectedPO = purchaseOrders.find(po => po.id === poId);
      if (selectedPO) {
        setVendorId(selectedPO.vendorId);
        setTaxAmount(String(selectedPO.taxAmount || 0));
        setFreightAmount(String(selectedPO.freightAmount || 0));
        setDiscountAmount(String(selectedPO.discountAmount || 0));
        
        // Populate lines based on received but unbilled PO quantity
        const initialLines = selectedPO.lines
          .filter(poLine => (poLine.quantityReceived || 0) > 0)
          .map(poLine => {
            const qtyReceived = poLine.quantityReceived || 0;
            const qtyBilled = poLine.quantityBilled || 0;
            const remainingToBill = Math.max(0, qtyReceived - qtyBilled);
            return {
              itemId: poLine.itemId,
              sku: poLine.sku,
              description: poLine.description,
              quantity: remainingToBill > 0 ? remainingToBill : qtyReceived,
              unitCost: poLine.unitCost,
              lineTotal: Math.round(((remainingToBill > 0 ? remainingToBill : qtyReceived) * poLine.unitCost) * 100) / 100,
            };
          });

        if (initialLines.length > 0) {
          setLines(initialLines);
        } else {
          // Fallback if PO has no items received yet
          setLines(selectedPO.lines.map(poLine => ({
            itemId: poLine.itemId,
            sku: poLine.sku,
            description: poLine.description,
            quantity: poLine.quantityOrdered,
            unitCost: poLine.unitCost,
            lineTotal: poLine.lineTotal,
          })));
        }
      }
    }
  }, [poId, billType, purchaseOrders, isLocked]);

  // Add line (manual only)
  const handleAddLine = () => {
    if (isLocked) return;
    setLines([
      ...lines,
      { description: '', quantity: 1, unitCost: 0, lineTotal: 0, glAccount: '5200' }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (isLocked) return;
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof VendorBillLine, value: any) => {
    if (isLocked) return;
    const updated = [...lines];
    const item = { ...updated[index], [field]: value };
    
    if (field === 'quantity' || field === 'unitCost') {
      const q = field === 'quantity' ? value : item.quantity;
      const c = field === 'unitCost' ? value : item.unitCost;
      item.lineTotal = Math.round((q * c) * 100) / 100;
    }

    updated[index] = item;
    setLines(updated);
  };

  const subtotal = Math.round(lines.reduce((sum, l) => sum + (l.lineTotal || 0), 0) * 100) / 100;
  const parsedTax = parseFloat(taxAmount) || 0;
  const parsedFreight = parseFloat(freightAmount) || 0;
  const parsedDiscount = parseFloat(discountAmount) || 0;
  const totalAmount = Math.round((subtotal + parsedTax + parsedFreight - parsedDiscount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent, actionType: 'save' | 'post' = 'save') => {
    e.preventDefault();
    if (isSubmitting) return;

    const selectedVendor = vendors.find(v => v.id === vendorId);
    if (!selectedVendor) {
      addToast('A valid vendor must be selected.', 'error');
      return;
    }

    if (!billNumber.trim()) {
      addToast('Vendor Invoice/Bill Number is required.', 'error');
      return;
    }

    const invalidLines = lines.some(l => !l.description.trim() || l.quantity <= 0 || l.unitCost < 0);
    if (invalidLines) {
      addToast('Please ensure all lines have descriptions, quantities > 0, and cost >= 0.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const billPayload = {
        companyId: selectedCompanyId || 'DEFAULT_COMPANY',
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        billNumber: billNumber.trim(),
        billDate: new Date(billDate).toISOString(),
        dueDate: new Date(dueDate).toISOString(),
        paymentTerms,
        poId: billType === 'po' ? poId : undefined,
        poNumber: billType === 'po' ? poId : undefined,
        lines,
        taxAmount: parsedTax,
        freightAmount: parsedFreight,
        discountAmount: parsedDiscount,
        notes,
      };

      if (!isEdit) {
        const createdBill = await createVendorBill(billPayload, 'Admin');
        if (actionType === 'post') {
          await postVendorBill(createdBill.id, 'Admin');
          addToast(`Vendor Bill ${createdBill.id} created and posted to AP ledger.`, 'success');
        } else {
          addToast(`Draft Vendor Bill ${createdBill.id} created.`, 'success');
        }
      } else {
        const billId = currentBill!.id;
        if (currentBill!.status === 'draft') {
          // For edit mode, update first
          // Wait, do we need a separate update function?
          // Since the plan was to post, let's update local store and firebase doc directly
          // or use a central update logic. Let's do a direct Firestore update for edits.
          const billRef = doc(db, 'vendorBills', billId);
          const updatedBill = {
            ...billPayload,
            subtotal,
            totalAmount,
            balanceDue: totalAmount,
            updatedAt: new Date().toISOString()
          };
          await setDoc(billRef, updatedBill, { merge: true });
          useAdminStore.getState().updateVendorBillDetails(billId, updatedBill);

          if (actionType === 'post') {
            await postVendorBill(billId, 'Admin');
            addToast(`Vendor Bill ${billId} updated and posted to AP ledger.`, 'success');
          } else {
            addToast(`Draft Vendor Bill ${billId} updated.`, 'success');
          }
        }
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Failed to save Vendor Bill.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!currentBill || isSubmitting) return;
    if (window.confirm('Are you sure you want to void this bill? Reversal ledger entries will be created.')) {
      setIsSubmitting(true);
      try {
        await voidVendorBill(currentBill.id, 'Admin');
        addToast(`Vendor Bill ${currentBill.id} has been voided. Reversal posted.`, 'success');
        onClose();
      } catch (e: any) {
        console.error(e);
        addToast(e.message || 'Failed to void Vendor Bill.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const activePOs = purchaseOrders.filter(po => po.status === 'ordered' || po.status === 'partially_received' || po.status === 'received');

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title={isEdit ? `Vendor Bill Dossier: ${currentBill?.id}` : 'Create Vendor Bill'}>
      <form style={{ maxWidth: '850px', width: '100%' }}>
        {isLocked && (
          <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: `1px solid ${currentBill?.status === 'voided' ? '#FCA5A5' : '#FECACA'}`, borderRadius: '8px', color: '#991B1B', fontSize: '0.8125rem', marginBottom: '1.25rem', fontWeight: 600 }}>
            ℹ️ This bill is {currentBill?.status.toUpperCase()} and locked. Reversals or payments must clear open liabilities.
          </div>
        )}

        {!isEdit && (
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #E8EAE6', paddingBottom: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              <input type="radio" checked={billType === 'manual'} onChange={() => setBillType('manual')} />
              Manual Expense Bill
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
              <input type="radio" checked={billType === 'po'} onChange={() => setBillType('po')} />
              Inventory PO-Backed Bill
            </label>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          {billType === 'po' && !isEdit ? (
            <div>
              <label className={modalStyles.formLabel}>Link Purchase Order *</label>
              <select
                value={poId}
                onChange={(e) => setPoId(e.target.value)}
                className={modalStyles.formInput}
                required
              >
                <option value="">{t('maintenance.selectAPo')}</option>
                {activePOs.map(po => (
                  <option key={po.id} value={po.id}>{po.id} — {po.vendorName}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className={modalStyles.formLabel}>Supplier / Vendor *</label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className={modalStyles.formInput}
                disabled={isLocked || billType === 'po'}
                required
              >
                <option value="">{t('maintenance.selectAVendor')}</option>
                {vendors.filter(v => v.active).map(v => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className={modalStyles.formLabel}>Invoice / Bill Number *</label>
            <input
              type="text"
              value={billNumber}
              onChange={(e) => setBillNumber(e.target.value)}
              className={modalStyles.formInput}
              placeholder="e.g. INV-98124"
              disabled={isLocked}
              required
            />
          </div>

          <div>
            <label className={modalStyles.formLabel}>{t('maintenance.paymentTerms')}</label>
            <select
              value={paymentTerms}
              onChange={(e) => setPaymentTerms(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
            >
              <option value="Due on Receipt">{t('maintenance.dueOnReceipt')}</option>
              <option value="Net 15">Net 15</option>
              <option value="Net 30">Net 30 (Default)</option>
              <option value="Net 45">Net 45</option>
              <option value="Net 60">Net 60</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label className={modalStyles.formLabel}>Bill Date *</label>
            <input
              type="date"
              value={billDate}
              onChange={(e) => setBillDate(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
              required
            />
          </div>
          <div>
            <label className={modalStyles.formLabel}>Due Date *</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
              required
            />
          </div>
          <div>
            <label className={modalStyles.formLabel}>Freight ($)</label>
            <input
              type="number"
              value={freightAmount}
              onChange={(e) => setFreightAmount(e.target.value)}
              className={modalStyles.formInput}
              placeholder="0.00"
              step="0.01"
              min="0"
              disabled={isLocked}
            />
          </div>
          <div>
            <label className={modalStyles.formLabel}>Tax ($)</label>
            <input
              type="number"
              value={taxAmount}
              onChange={(e) => setTaxAmount(e.target.value)}
              className={modalStyles.formInput}
              placeholder="0.00"
              step="0.01"
              min="0"
              disabled={isLocked}
            />
          </div>
        </div>

        {/* Lines */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: billType === 'manual' ? '3fr 1.5fr 1fr 1fr 1fr 0.5fr' : '3fr 1fr 1fr 1fr 0.5fr', gap: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E8EAE6', fontWeight: 600, fontSize: '0.8125rem', color: '#8a8f8c', textTransform: 'uppercase' }}>
            <span>Line Description / SKU</span>
            {billType === 'manual' && <span>GL Account</span>}
            <span style={{ textAlign: 'right' }}>Qty</span>
            <span style={{ textAlign: 'right' }}>Unit Cost ($)</span>
            <span style={{ textAlign: 'right' }}>{t('maintenance.lineTotal')}</span>
            <span></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
            {lines.map((line, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: billType === 'manual' ? '3fr 1.5fr 1fr 1fr 1fr 0.5fr' : '3fr 1fr 1fr 1fr 0.5fr', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) => handleLineChange(index, 'description', e.target.value)}
                  className={modalStyles.formInput}
                  placeholder="e.g. Box of ribbons or Red Rose Stems"
                  style={{ padding: '0.45rem' }}
                  disabled={isLocked || billType === 'po'}
                  required
                />

                {billType === 'manual' && (
                  <select
                    value={line.glAccount || '5200'}
                    onChange={(e) => handleLineChange(index, 'glAccount', e.target.value)}
                    className={modalStyles.formInput}
                    style={{ padding: '0.45rem' }}
                    disabled={isLocked}
                  >
                    <option value="5200">5200 — Supplies Expense</option>
                    <option value="5300">5300 — Freight-In</option>
                    <option value="5000">5000 — Operating Expense</option>
                  </select>
                )}

                <input
                  type="number"
                  value={line.quantity}
                  onChange={(e) => handleLineChange(index, 'quantity', parseInt(e.target.value) || 0)}
                  className={modalStyles.formInput}
                  style={{ textAlign: 'right', padding: '0.45rem' }}
                  min="1"
                  disabled={isLocked}
                />

                <input
                  type="number"
                  placeholder="0.00"
                  value={line.unitCost}
                  onChange={(e) => handleLineChange(index, 'unitCost', parseFloat(e.target.value) || 0)}
                  className={modalStyles.formInput}
                  style={{ textAlign: 'right', padding: '0.45rem' }}
                  step="0.01"
                  min="0"
                  disabled={isLocked}
                />

                <div style={{ textAlign: 'right', fontWeight: 600, paddingRight: '0.5rem', fontSize: '0.875rem' }}>
                  ${(line.lineTotal || 0).toFixed(2)}
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveLine(index)}
                  disabled={lines.length <= 1 || isLocked || billType === 'po'}
                  style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '1.125rem', cursor: 'pointer', opacity: (lines.length <= 1 || isLocked || billType === 'po') ? 0.3 : 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {billType === 'manual' && !isLocked && (
            <button
              type="button"
              onClick={handleAddLine}
              style={{ marginTop: '0.75rem', background: 'none', border: '1px dashed #4A6B50', color: '#4A6B50', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Bill Line
            </button>
          )}
        </div>

        {/* Totals & Notes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', borderTop: '1px solid #E8EAE6', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
          <div>
            <label className={modalStyles.formLabel}>Bill Notes / Memo</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={modalStyles.formInput}
              style={{ height: '90px' }}
              disabled={isLocked}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: '#FAFAF8', padding: '1rem', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#6b7280' }}>
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#6b7280' }}>
              <span>Freight-In:</span>
              <span>+${parsedFreight.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#6b7280' }}>
              <span>Taxes:</span>
              <span>+${parsedTax.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#6b7280', borderBottom: '1px solid #E8EAE6', paddingBottom: '0.5rem' }}>
              <span>Discounts:</span>
              <span>-${parsedDiscount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
              <span>Total Bill Amount:</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className={modalStyles.formActions} style={{ marginTop: '1.5rem', borderTop: '1px solid #E8EAE6', paddingTop: '1rem' }}>
          <div style={{ marginRight: 'auto' }}>
            {isEdit && currentBill?.status === 'posted' && (
              <button
                type="button"
                className={modalStyles.btnDelete}
                onClick={handleVoid}
                disabled={isSubmitting}
                style={{ background: '#EF4444', color: '#FFFFFF', border: 'none' }}
              >
                Void Bill (Reversal Entry)
              </button>
            )}
          </div>
          
          <button type="button" className={modalStyles.btnCancel} onClick={onClose}>
            {isLocked ? 'Close' : 'Cancel'}
          </button>
          
          {!isLocked && (
            <>
              <button
                type="button"
                className={modalStyles.btnDraft}
                onClick={(e) => handleSubmit(e, 'save')}
                disabled={isSubmitting}
                style={{ marginRight: '0.5rem' }}
              >
                Save Draft
              </button>

              <button
                type="submit"
                className={modalStyles.btnSubmit}
                onClick={(e) => handleSubmit(e, 'post')}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Posting...' : 'Post Bill to AP'}
              </button>
            </>
          )}
        </div>
      </form>
    </FormModal>
  );
};
