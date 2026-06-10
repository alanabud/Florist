/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { FormModal } from '../../ui/FormModal';
import { useAdminStore, type VendorBill, type VendorPayment } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { createVendorPayment, voidVendorPayment } from '../../../services/vendorPaymentService';
import modalStyles from '../../ui/FormModal.module.css';

interface VendorPaymentFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VendorPaymentForm: React.FC<VendorPaymentFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { modalPayload, vendors, vendorBills, fetchVendors, fetchVendorBills } = useAdminStore();

  const isEdit = !!modalPayload?.id;
  const currentPayment = isEdit ? (modalPayload as VendorPayment) : null;
  const isLocked = currentPayment ? currentPayment.status !== 'draft' : false;

  const [vendorId, setVendorId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'check' | 'cash' | 'bank_transfer' | 'credit_card' | 'other'>('check');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [totalAmountPaid, setTotalAmountPaid] = useState('0');
  
  // Existing prepayment application toggle (Flow 2)
  const [drawFromPrepayments, setDrawFromPrepayments] = useState(false);

  // List of open bills and their applied amounts
  const [openBills, setOpenBills] = useState<Array<{
    bill: VendorBill;
    appliedAmount: number;
    checked: boolean;
  }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load vendors and bills on mount
  useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchVendorBills();
    }
  }, [isOpen, fetchVendors, fetchVendorBills]);

  // Load initial values
  useEffect(() => {
    if (isOpen) {
      if (currentPayment) {
        setVendorId(currentPayment.vendorId);
        setPaymentDate(currentPayment.paymentDate ? currentPayment.paymentDate.split('T')[0] : '');
        setPaymentMethod(currentPayment.paymentMethod);
        setReferenceNumber(currentPayment.referenceNumber || '');
        setNotes(currentPayment.notes || '');
        setTotalAmountPaid(String(currentPayment.amount || 0));
        setDrawFromPrepayments(currentPayment.paymentMethod === 'other' && !!currentPayment.notes?.includes('prepayment'));
        
        // Show historical allocations (read-only)
        const histBills = currentPayment.allocations.map(alloc => ({
          bill: {
            id: alloc.billId,
            billNumber: alloc.billNumber,
            totalAmount: alloc.originalBalance,
            balanceDue: alloc.remainingBalance,
            billDate: '',
            dueDate: '',
            vendorId: currentPayment.vendorId,
            vendorName: currentPayment.vendorName,
            paymentTerms: '',
            lines: [],
            subtotal: 0,
            taxAmount: 0,
            freightAmount: 0,
            discountAmount: 0,
            status: 'paid',
            glPostingStatus: 'posted',
            matchStatus: 'matched',
            createdAt: '',
            updatedAt: '',
            createdBy: '',
          } as VendorBill,
          appliedAmount: alloc.amountApplied,
          checked: true,
        }));
        setOpenBills(histBills);
      } else {
        setVendorId(vendors[0]?.id || '');
        setPaymentDate(new Date().toISOString().split('T')[0]);
        setPaymentMethod('check');
        setReferenceNumber('');
        setNotes('');
        setTotalAmountPaid('0');
        setDrawFromPrepayments(false);
        setOpenBills([]);
      }
    }
  }, [isOpen, currentPayment, vendors]);

  // Update open bills list when vendor changes
  useEffect(() => {
    if (vendorId && !isLocked) {
      const billsForVendor = vendorBills.filter(
        b => b.vendorId === vendorId && (b.status === 'posted' || b.status === 'partially_paid')
      );
      setOpenBills(
        billsForVendor.map(b => ({
          bill: b,
          appliedAmount: 0,
          checked: false,
        }))
      );
    }
  }, [vendorId, vendorBills, isLocked]);

  // Handle bill row check toggle
  const handleCheckToggle = (index: number) => {
    if (isLocked) return;
    const updated = [...openBills];
    const row = updated[index];
    row.checked = !row.checked;
    
    if (row.checked) {
      // Auto-populate applied amount with balance due
      row.appliedAmount = row.bill.balanceDue;
    } else {
      row.appliedAmount = 0;
    }

    updated[index] = row;
    setOpenBills(updated);

    // Update total cash paid to match sum of applied if drawing from cash
    const sum = updated.reduce((sum, r) => sum + r.appliedAmount, 0);
    setTotalAmountPaid(String(Math.round(sum * 100) / 100));
  };

  // Handle applied amount change
  const handleAppliedAmountChange = (index: number, value: number) => {
    if (isLocked) return;
    const updated = [...openBills];
    const row = updated[index];
    row.appliedAmount = Math.min(row.bill.balanceDue, value);
    if (row.appliedAmount > 0) {
      row.checked = true;
    } else {
      row.checked = false;
    }
    updated[index] = row;
    setOpenBills(updated);

    const sum = updated.reduce((sum, r) => sum + r.appliedAmount, 0);
    setTotalAmountPaid(String(Math.round(sum * 100) / 100));
  };

  const appliedTotal = Math.round(openBills.reduce((sum, r) => sum + r.appliedAmount, 0) * 100) / 100;
  const cashPaidNum = parseFloat(totalAmountPaid) || 0;
  const unappliedAmount = drawFromPrepayments ? 0 : Math.max(0, Math.round((cashPaidNum - appliedTotal) * 100) / 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const selectedVendor = vendors.find(v => v.id === vendorId);
    if (!selectedVendor) {
      addToast('A valid vendor must be selected.', 'error');
      return;
    }

    const allocations = openBills
      .filter(r => r.checked && r.appliedAmount > 0)
      .map(r => ({
        billId: r.bill.id,
        billNumber: r.bill.billNumber,
        originalBalance: r.bill.balanceDue,
        amountApplied: r.appliedAmount,
        remainingBalance: Math.round((r.bill.balanceDue - r.appliedAmount) * 100) / 100,
      }));

    if (allocations.length === 0 && cashPaidNum <= 0) {
      addToast('A payment must either have bill allocations or be a vendor deposit/prepayment.', 'error');
      return;
    }



    if (!drawFromPrepayments && cashPaidNum < appliedTotal) {
      addToast('Total Amount Paid cannot be less than the sum of applied amounts.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const paymentPayload = {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMethod: drawFromPrepayments ? ('other' as const) : paymentMethod,
        referenceNumber: referenceNumber.trim() || undefined,
        amount: drawFromPrepayments ? 0 : cashPaidNum,
        unappliedAmount,
        allocations,
        notes: notes.trim() + (drawFromPrepayments ? ' (Applied from Prepayment Balance)' : ''),
        createdBy: 'Admin',
      };

      await createVendorPayment(paymentPayload, { drawFromPrepayments }, 'Admin');
      addToast('Vendor payment posted successfully.', 'success');
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Failed to post Vendor Payment.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoid = async () => {
    if (!currentPayment || isSubmitting) return;
    if (window.confirm('Are you sure you want to void this payment? Reversal ledger entries will be created.')) {
      setIsSubmitting(true);
      try {
        await voidVendorPayment(currentPayment.id, 'Admin');
        addToast(`Vendor Payment ${currentPayment.id} voided. Restored invoice balances.`, 'success');
        onClose();
      } catch (e: any) {
        console.error(e);
        addToast(e.message || 'Failed to void Vendor Payment.', 'error');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title={isEdit ? `Vendor Payment Dossier: ${currentPayment?.paymentNumber}` : 'Record Vendor Payment'}>
      <form onSubmit={handleSubmit} style={{ maxWidth: '800px', width: '100%' }}>
        {isLocked && (
          <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: `1px solid ${currentPayment?.status === 'voided' ? '#FCA5A5' : '#FECACA'}`, borderRadius: '8px', color: '#991B1B', fontSize: '0.8125rem', marginBottom: '1.25rem', fontWeight: 600 }}>
            ℹ️ This payment is {currentPayment?.status.toUpperCase()} and locked. It cannot be edited.
          </div>
        )}

        {!isEdit && (
          <div style={{ padding: '0.75rem 1rem', background: '#F5F1E7', borderRadius: '8px', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-main)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={drawFromPrepayments}
                onChange={(e) => {
                  setDrawFromPrepayments(e.target.checked);
                  if (e.target.checked) {
                    setTotalAmountPaid('0');
                  }
                }}
              />
              Apply Existing Prepayments (Flow 2: Debit AP, Credit Prepayments 1400)
            </label>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.25fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label className={modalStyles.formLabel}>Supplier / Vendor *</label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
              required
            >
              <option value="">Select a Vendor...</option>
              {vendors.filter(v => v.active).map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.id})</option>
              ))}
            </select>
          </div>

          <div>
            <label className={modalStyles.formLabel}>Payment Date *</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
              required
            />
          </div>

          {!drawFromPrepayments ? (
            <div>
              <label className={modalStyles.formLabel}>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className={modalStyles.formInput}
                disabled={isLocked}
              >
                <option value="check">Check / Voucher</option>
                <option value="cash">Cash / Drawer</option>
                <option value="bank_transfer">Bank Transfer / ACH</option>
                <option value="credit_card">Credit Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          ) : (
            <div>
              <label className={modalStyles.formLabel}>Payment Method</label>
              <input
                type="text"
                value="Prepayment Application"
                className={modalStyles.formInput}
                disabled
              />
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <label className={modalStyles.formLabel}>Ref / Check Number</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              className={modalStyles.formInput}
              placeholder="e.g. Check #5021"
              disabled={isLocked}
            />
          </div>

          {!drawFromPrepayments ? (
            <div>
              <label className={modalStyles.formLabel}>Cash Paid ($) * (Overpayment creates Prepayment)</label>
              <input
                type="number"
                value={totalAmountPaid}
                onChange={(e) => setTotalAmountPaid(e.target.value)}
                className={modalStyles.formInput}
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={isLocked}
                required
              />
            </div>
          ) : (
            <div>
              <label className={modalStyles.formLabel}>Prepayment Amount Applied ($)</label>
              <div style={{ padding: '0.55rem', background: '#F5F1E7', border: '1px solid var(--color-border)', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 700 }}>
                ${appliedTotal.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* List of open bills to allocate payment */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '0.3fr 1.5fr 1fr 1fr 1fr 1.5fr', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E8EAE6', fontWeight: 600, fontSize: '0.75rem', color: '#8a8f8c', textTransform: 'uppercase' }}>
            <span></span>
            <span>Bill Number</span>
            <span>Bill Date</span>
            <span style={{ textAlign: 'right' }}>Total Cost</span>
            <span style={{ textAlign: 'right' }}>Balance Due</span>
            <span style={{ textAlign: 'right' }}>Amount Applied</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
            {openBills.length === 0 ? (
              <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8125rem', color: '#6b7280', background: '#FAFAF8', borderRadius: '8px' }}>
                No open bills found for this supplier. Payment will be processed as a prepayment deposit.
              </div>
            ) : (
              openBills.map((row, index) => (
                <div key={row.bill.id} style={{ display: 'grid', gridTemplateColumns: '0.3fr 1.5fr 1fr 1fr 1fr 1.5fr', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={row.checked}
                    onChange={() => handleCheckToggle(index)}
                    disabled={isLocked}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{row.bill.billNumber}</span>
                  <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                    {row.bill.billDate ? new Date(row.bill.billDate).toLocaleDateString() : '—'}
                  </span>
                  <span style={{ textAlign: 'right', fontSize: '0.8125rem' }}>${row.bill.totalAmount.toFixed(2)}</span>
                  <span style={{ textAlign: 'right', fontSize: '0.8125rem', color: '#B91C1C', fontWeight: 600 }}>${row.bill.balanceDue.toFixed(2)}</span>
                  
                  <input
                    type="number"
                    value={row.appliedAmount}
                    onChange={(e) => handleAppliedAmountChange(index, parseFloat(e.target.value) || 0)}
                    className={modalStyles.formInput}
                    style={{ textAlign: 'right', padding: '0.35rem' }}
                    min="0"
                    max={row.bill.balanceDue}
                    disabled={isLocked}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Prepayment Excess Summary */}
        {!drawFromPrepayments && unappliedAmount > 0 && (
          <div style={{ padding: '0.75rem 1rem', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', color: '#047857', fontSize: '0.8125rem', marginBottom: '1.25rem', fontWeight: 600 }}>
            💰 Overpayment detected: <strong>${unappliedAmount.toFixed(2)}</strong> will be logged under <strong>1400 Vendor Prepayments / Deposits</strong> for future billing.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', borderTop: '1px solid #E8EAE6', paddingTop: '1.25rem' }}>
          <label className={modalStyles.formLabel}>Payment Memo / Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={modalStyles.formInput}
            style={{ height: '60px' }}
            placeholder="e.g. Cleared invoice for flowers, paid by bank transfer."
            disabled={isLocked}
          />
        </div>

        <div className={modalStyles.formActions} style={{ marginTop: '1.5rem', borderTop: '1px solid #E8EAE6', paddingTop: '1rem' }}>
          <div style={{ marginRight: 'auto' }}>
            {isEdit && currentPayment?.status === 'posted' && (
              <button
                type="button"
                className={modalStyles.btnDelete}
                onClick={handleVoid}
                disabled={isSubmitting}
                style={{ background: '#EF4444', color: '#FFFFFF', border: 'none' }}
              >
                Void Payment (Reversal Entry)
              </button>
            )}
          </div>

          <button type="button" className={modalStyles.btnCancel} onClick={onClose}>
            {isLocked ? 'Close' : 'Cancel'}
          </button>
          
          {!isLocked && (
            <button type="submit" className={modalStyles.btnSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Posting Payment...' : 'Post Vendor Payment'}
            </button>
          )}
        </div>
      </form>
    </FormModal>
  );
};
