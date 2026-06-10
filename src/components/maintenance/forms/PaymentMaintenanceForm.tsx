import React, { useState, useEffect } from 'react';
import { FormModal } from '../../ui/FormModal';
import { useAdminStore } from '../../../store/adminStore';
import { useFinanceStore } from '../../../store/financeStore';
import { useToastStore } from '../../../store/toastStore';
import { validatePayment } from '../../../services/validators';
import { 
  autoAllocatePaymentOldestFirst, 
  createPaymentDraft, 
  postPaymentToLedger, 
  voidPostedPayment, 
  refundPayment 
} from '../../../services/paymentService';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import styles from '../../ui/FormModal.module.css';

interface PaymentMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PaymentMaintenanceForm: React.FC<PaymentMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { customers, orders, modalPayload, fetchPayments, fetchOrders, updatePaymentDetails } = useAdminStore();
  const fetchJournalEntries = useFinanceStore((s) => s.fetchJournalEntries);

  const [activeTab, setActiveTab] = useState<'payment' | 'allocation' | 'method' | 'gl'>('payment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerOpenOrders, setCustomerOpenOrders] = useState<any[]>([]);

  // Local Form state
  const [formValues, setFormValues] = useState<Record<string, any>>({
    customerId: '',
    customerName: '',
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    referenceNumber: '',
    amount: 0,
    unappliedAmount: 0,
    allocations: [],
    notes: '',
    status: 'draft',
    glPostingStatus: 'unposted'
  });

  const isEdit = !!modalPayload?.id;
  const isReadOnly = formValues.glPostingStatus === 'posted' || formValues.glPostingStatus === 'reversed';

  // Load modal payload
  useEffect(() => {
    if (isOpen) {
      // Intended: reset form active tab to 'payment' when the modal is opened.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActiveTab('payment');
      if (isEdit) {
        setFormValues({ ...modalPayload });
      } else {
        const payloadCustomerId = modalPayload?.customerId || '';
        const matchingCustomer = customers.find(c => c.id === payloadCustomerId);
        setFormValues({
          customerId: payloadCustomerId,
          customerName: matchingCustomer?.name || '',
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMethod: 'cash',
          referenceNumber: '',
          amount: 0,
          unappliedAmount: 0,
          allocations: [],
          notes: '',
          status: 'draft',
          glPostingStatus: 'unposted'
        });
      }
    }
  }, [isOpen, modalPayload, isEdit, customers]);

  // Load open orders for chosen customer
  useEffect(() => {
    if (isOpen && formValues.customerId) {
      // Find all posted orders for this customer that have balance due
      const customerOrders = orders.filter(o => 
        o.customerId === formValues.customerId &&
        o.glPostingStatus === 'posted' &&
        o.status !== 'draft' && o.status !== 'cancelled' && o.status !== 'refunded'
      );
      // Intended: populate customer's open orders in list state when the customer ID is changed or loaded.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomerOpenOrders(customerOrders);
    } else {
      setCustomerOpenOrders([]);
    }
  }, [isOpen, formValues.customerId, orders]);

  // Handle Field Updates
  const handleFieldChange = (name: string, value: any) => {
    if (isReadOnly && name !== 'notes' && name !== 'referenceNumber') {
      return; // Lock financials
    }
    setFormValues(prev => {
      const next = { ...prev, [name]: value };
      if (name === 'customerId') {
        const c = customers.find(cust => cust.id === value);
        next.customerName = c ? c.name : '';
        next.allocations = [];
      }
      if (name === 'amount') {
        const totalAlloc = (next.allocations || []).reduce((sum: number, a: any) => sum + (parseFloat(a.amountApplied) || 0), 0);
        next.unappliedAmount = Math.max(0, Math.round((parseFloat(value) - totalAlloc) * 100) / 100);
      }
      return next;
    });
  };

  // Helper: Auto-allocate Oldest First
  const handleAutoAllocate = async () => {
    if (!formValues.customerId) {
      addToast('Please select a customer first.', 'error');
      return;
    }
    const amt = parseFloat(formValues.amount);
    if (isNaN(amt) || amt <= 0) {
      addToast('Please enter a payment amount greater than zero.', 'error');
      return;
    }
    try {
      const allocations = await autoAllocatePaymentOldestFirst(formValues.customerId, amt);
      const allocationTotal = allocations.reduce((sum, a) => sum + a.amountApplied, 0);
      const unappliedAmount = Math.max(0, Math.round((amt - allocationTotal) * 100) / 100);
      
      setFormValues(prev => ({
        ...prev,
        allocations,
        unappliedAmount
      }));
      addToast(`Allocated $${allocationTotal.toFixed(2)} across outstanding invoices.`, 'success');
    } catch (e: any) {
      console.error(e);
      addToast('Auto-allocation failed: ' + e.message, 'error');
    }
  };

  // Handle allocation grid inputs
  const handleAllocationAmtChange = (orderId: string, value: string) => {
    if (isReadOnly) return;
    const amtApplied = parseFloat(value) || 0;
    const order = customerOpenOrders.find(o => o.id === orderId);
    if (!order) return;

    const balanceDue = order.balanceDue !== undefined ? order.balanceDue : (order.total - (order.amountPaid || 0));

    setFormValues(prev => {
      const currentAllocs = [...(prev.allocations || [])];
      const existingIdx = currentAllocs.findIndex(a => a.orderId === orderId);

      if (amtApplied <= 0) {
        // remove allocation
        if (existingIdx >= 0) currentAllocs.splice(existingIdx, 1);
      } else {
        const allocItem = {
          orderId,
          orderNumber: order.orderNumber || order.id.substring(0, 8).toUpperCase(),
          originalBalance: balanceDue,
          amountApplied: amtApplied,
          remainingBalance: Math.max(0, Math.round((balanceDue - amtApplied) * 100) / 100)
        };
        if (existingIdx >= 0) {
          currentAllocs[existingIdx] = allocItem;
        } else {
          currentAllocs.push(allocItem);
        }
      }

      const totalAlloc = currentAllocs.reduce((sum, a) => sum + a.amountApplied, 0);
      const unappliedAmount = Math.max(0, Math.round((prev.amount - totalAlloc) * 100) / 100);

      return {
        ...prev,
        allocations: currentAllocs,
        unappliedAmount
      };
    });
  };

  // Validate form
  const validateForm = () => {
    const res = validatePayment(formValues, customerOpenOrders);
    return res;
  };

  // Save Draft
  const handleSaveDraft = async () => {
    if (isReadOnly) {
      // Just save notes/ref updates
      try {
        setIsSubmitting(true);
        const paymentRef = doc(db, 'payments', formValues.id);
        await updateDoc(paymentRef, {
          notes: formValues.notes || '',
          referenceNumber: formValues.referenceNumber || '',
          updatedAt: new Date().toISOString()
        });
        updatePaymentDetails(formValues.id, {
          notes: formValues.notes,
          referenceNumber: formValues.referenceNumber
        });
        addToast('Payment notes/reference updated successfully.', 'success');
        onClose();
      } catch (err: any) {
        addToast('Failed to update: ' + err.message, 'error');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const val = validateForm();
    if (Object.keys(val.errors).length > 0) {
      addToast(Object.values(val.errors)[0], 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEdit) {
        // Update draft in firestore
        const paymentRef = doc(db, 'payments', formValues.id);
        const totalAlloc = (formValues.allocations || []).reduce((sum: number, a: any) => sum + a.amountApplied, 0);
        const unappliedAmount = Math.max(0, Math.round((formValues.amount - totalAlloc) * 100) / 100);
        const updates = {
          ...formValues,
          unappliedAmount,
          updatedAt: new Date().toISOString()
        };
        await updateDoc(paymentRef, updates);
        updatePaymentDetails(formValues.id, updates);
        addToast('Payment draft updated.', 'success');
      } else {
        await createPaymentDraft(formValues as any);
        await fetchPayments();
        addToast('Payment draft created.', 'success');
      }
      onClose();
    } catch (e: any) {
      addToast('Error saving: ' + e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Post to GL
  const handlePostGL = async () => {
    const val = validateForm();
    if (Object.keys(val.errors).length > 0) {
      addToast(Object.values(val.errors)[0], 'error');
      return;
    }

    if (!window.confirm('Are you sure you want to post this payment to the General Ledger? Once posted, financial amounts cannot be edited.')) {
      return;
    }

    try {
      setIsSubmitting(true);
      let targetId = formValues.id;
      if (!targetId) {
        // Save first if not in Firestore
        targetId = await createPaymentDraft(formValues as any);
      } else {
        // Update draft in firestore first
        const paymentRef = doc(db, 'payments', targetId);
        const totalAlloc = (formValues.allocations || []).reduce((sum: number, a: any) => sum + a.amountApplied, 0);
        const unappliedAmount = Math.max(0, Math.round((formValues.amount - totalAlloc) * 100) / 100);
        await updateDoc(paymentRef, {
          ...formValues,
          unappliedAmount,
          updatedAt: new Date().toISOString()
        });
      }

      await postPaymentToLedger(targetId, 'Admin');
      await fetchPayments();
      await fetchOrders();
      await fetchJournalEntries();
      
      // Update local customers cache
      const custRef = doc(db, 'customers', formValues.customerId);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        useAdminStore.getState().updateCustomerDetails(formValues.customerId, custSnap.data());
      }

      addToast('Payment posted successfully to General Ledger.', 'success');
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast('Failed to post payment: ' + e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Void posted payment
  const handleVoidPayment = async () => {
    if (!window.confirm('WARNING: Are you sure you want to VOID this posted payment? This will create reversing journal entries in the ledger and restore order balances due.')) {
      return;
    }
    try {
      setIsSubmitting(true);
      await voidPostedPayment(formValues.id, 'Admin');
      await fetchPayments();
      await fetchOrders();
      await fetchJournalEntries();
      
      // Update customer cache
      const custRef = doc(db, 'customers', formValues.customerId);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        useAdminStore.getState().updateCustomerDetails(formValues.customerId, custSnap.data());
      }

      addToast('Payment voided successfully. Balanced reversal journal posted.', 'success');
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast('Failed to void payment: ' + e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Refund unapplied cash
  const handleRefundCredit = async () => {
    const unapplied = parseFloat(formValues.unappliedAmount) || 0;
    if (unapplied <= 0) {
      addToast('No unapplied credits to refund.', 'error');
      return;
    }
    const val = window.prompt(`Enter amount to refund customer credits (Max: $${unapplied.toFixed(2)}):`, unapplied.toString());
    if (val === null) return;

    const amt = parseFloat(val);
    if (isNaN(amt) || amt <= 0) {
      addToast('Invalid refund amount.', 'error');
      return;
    }
    if (amt > unapplied) {
      addToast('Refund amount cannot exceed unapplied balance.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      await refundPayment(formValues.id, amt, 'Admin');
      await fetchPayments();
      await fetchOrders();
      await fetchJournalEntries();

      // Update customer cache
      const custRef = doc(db, 'customers', formValues.customerId);
      const custSnap = await getDoc(custRef);
      if (custSnap.exists()) {
        useAdminStore.getState().updateCustomerDetails(formValues.customerId, custSnap.data());
      }

      addToast(`Refunded $${amt.toFixed(2)} back to customer. Cash credited and Credits debited.`, 'success');
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast('Failed to refund credit: ' + e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={isEdit ? `Payment Capture: ${formValues.paymentNumber}` : 'New Customer Payment Receipt'}
    >
      <div style={{ width: '700px', maxWidth: '100%' }}>
        
        {/* Sub-tab Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8EAE6', marginBottom: '1.25rem', gap: '0.5rem' }}>
          <button type="button" onClick={() => setActiveTab('payment')} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'payment' ? '2px solid #4A6B50' : 'none', color: activeTab === 'payment' ? '#4A6B50' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Payment</button>
          <button type="button" onClick={() => setActiveTab('allocation')} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'allocation' ? '2px solid #4A6B50' : 'none', color: activeTab === 'allocation' ? '#4A6B50' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Order Allocation</button>
          <button type="button" onClick={() => setActiveTab('method')} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'method' ? '2px solid #4A6B50' : 'none', color: activeTab === 'method' ? '#4A6B50' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>Method Details</button>
          <button type="button" onClick={() => setActiveTab('gl')} style={{ padding: '0.5rem 1rem', background: 'none', border: 'none', borderBottom: activeTab === 'gl' ? '2px solid #4A6B50' : 'none', color: activeTab === 'gl' ? '#4A6B50' : '#6b7280', fontWeight: 600, cursor: 'pointer' }}>GL / Audit</button>
        </div>

        {/* Tab 1: Payment Details */}
        {activeTab === 'payment' && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Customer Name *</label>
              {isReadOnly ? (
                <div style={{ padding: '0.5rem', background: '#FAFAF8', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.875rem' }}>
                  {formValues.customerName}
                </div>
              ) : (
                <select 
                  value={formValues.customerId} 
                  onChange={(e) => handleFieldChange('customerId', e.target.value)}
                  className={styles.formInput}
                  disabled={isReadOnly}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (AR Bal: $${(c.arBalance || 0).toFixed(2)})</option>
                  ))}
                </select>
              )}
            </div>
            
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Payment Date *</label>
              <input 
                type="date" 
                value={formValues.paymentDate} 
                onChange={(e) => handleFieldChange('paymentDate', e.target.value)}
                className={styles.formInput}
                disabled={isReadOnly}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Amount Received ($) *</label>
              <input 
                type="number" 
                value={formValues.amount || ''} 
                onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value) || 0)}
                className={styles.formInput}
                placeholder="0.00"
                step="0.01"
                min="0"
                disabled={isReadOnly}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Unapplied Credit Balance ($)</label>
              <div style={{ padding: '0.5rem', background: '#F5F1E7', border: '1px solid #E8EAE6', borderRadius: '8px', fontSize: '0.9375rem', fontWeight: 700, color: formValues.unappliedAmount > 0 ? '#4A6B50' : '#2C302E' }}>
                ${(formValues.unappliedAmount || 0).toFixed(2)}
              </div>
            </div>

            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className={styles.formLabel}>Reference Notes</label>
              <textarea 
                value={formValues.notes || ''} 
                onChange={(e) => handleFieldChange('notes', e.target.value)}
                className={`${styles.formInput} ${styles.formTextarea}`}
                placeholder="Audit notes or transaction comments..."
              />
            </div>
          </div>
        )}

        {/* Tab 2: Allocation Grid */}
        {activeTab === 'allocation' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>
                Split payment amount across outstanding customer orders:
              </span>
              {!isReadOnly && (
                <button 
                  type="button" 
                  onClick={handleAutoAllocate}
                  style={{ padding: '0.4rem 0.8rem', background: '#F5F1E7', border: '1px solid #E8EAE6', color: '#4A6B50', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Auto-Allocate (Oldest First)
                </button>
              )}
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #E8EAE6', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ background: '#FAFAF8', borderBottom: '1px solid #E8EAE6', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px' }}>Order #</th>
                    <th style={{ padding: '8px 12px' }}>Due Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Balance Due</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', width: '140px' }}>Apply Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOpenOrders.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: '#8a8f8c' }}>
                        No outstanding posted orders found for this customer.
                      </td>
                    </tr>
                  ) : (
                    customerOpenOrders.map(o => {
                      const bal = o.balanceDue !== undefined ? o.balanceDue : (o.total - (o.amountPaid || 0));
                      const alloc = (formValues.allocations || []).find((a: any) => a.orderId === o.id);
                      const currentApplied = alloc ? alloc.amountApplied : '';

                      return (
                        <tr key={o.id} style={{ borderBottom: '1px dashed #E8EAE6' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600 }}>{o.orderNumber || o.id.substring(0, 8).toUpperCase()}</td>
                          <td style={{ padding: '8px 12px' }}>{o.dueDate ? new Date(o.dueDate).toLocaleDateString() : 'N/A'}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>${o.total.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>${bal.toFixed(2)}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                            <input 
                              type="number"
                              value={currentApplied}
                              onChange={(e) => handleAllocationAmtChange(o.id, e.target.value)}
                              placeholder="0.00"
                              disabled={isReadOnly}
                              style={{ width: '100%', textAlign: 'right', padding: '4px 8px', borderRadius: '4px', border: '1px solid #E8EAE6', outline: 'none' }}
                              step="0.01"
                              min="0"
                              max={bal}
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Overpayment Warning */}
            {formValues.unappliedAmount > 0 && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#FAF9F5', border: '1px solid #E8EAE6', borderRadius: '8px', color: '#4A6B50', fontSize: '0.75rem', fontWeight: 600 }}>
                💡 Overpayment Alert: $${formValues.unappliedAmount.toFixed(2)} of the payment remains unapplied. This will be added to the customer's Credit Balance (posted as Customer Credits Liability) for future orders.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Method Details */}
        {activeTab === 'method' && (
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Payment Method *</label>
              <select 
                value={formValues.paymentMethod} 
                onChange={(e) => handleFieldChange('paymentMethod', e.target.value)}
                className={styles.formInput}
                disabled={isReadOnly}
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="credit_card">Credit Card</option>
                <option value="stripe">Stripe Integration</option>
                <option value="bank_transfer">ACH/Bank Transfer</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Reference Code / Check #</label>
              <input 
                type="text" 
                value={formValues.referenceNumber || ''} 
                onChange={(e) => handleFieldChange('referenceNumber', e.target.value)}
                className={styles.formInput}
                placeholder="Check number, transaction ID, stripe ref..."
              />
            </div>
          </div>
        )}

        {/* Tab 4: GL / Audit */}
        {activeTab === 'gl' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ padding: '0.75rem', background: '#FAFAF8', borderRadius: '8px', border: '1px solid #E8EAE6' }}>
                <span style={{ fontSize: '0.75rem', color: '#8a8f8c', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>GL Posting Status</span>
                <strong style={{ 
                  color: formValues.glPostingStatus === 'posted' ? '#10b981' : 
                         formValues.glPostingStatus === 'reversed' ? '#EF4444' : '#6b7280', 
                  fontSize: '0.9375rem',
                  textTransform: 'uppercase'
                }}>
                  {formValues.glPostingStatus}
                </strong>
              </div>
              <div style={{ padding: '0.75rem', background: '#FAFAF8', borderRadius: '8px', border: '1px solid #E8EAE6' }}>
                <span style={{ fontSize: '0.75rem', color: '#8a8f8c', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Journal Entry ID</span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {formValues.journalEntryId || 'UNPOSTED'}
                </span>
              </div>
            </div>

            {/* Refund Logs if any */}
            {formValues.refunds && formValues.refunds.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#8a8f8c', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Refund History</span>
                <div style={{ border: '1px solid #E8EAE6', borderRadius: '6px', background: '#FAFAF8', padding: '0.5rem' }}>
                  {formValues.refunds.map((ref: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', borderBottom: idx < formValues.refunds.length - 1 ? '1px dashed #E8EAE6' : 'none', fontSize: '0.75rem' }}>
                      <span>Refund amount: <strong>${ref.refundAmount.toFixed(2)}</strong></span>
                      <span>Date: {new Date(ref.refundDate).toLocaleDateString()}</span>
                      <span style={{ fontFamily: 'monospace' }}>JE: {ref.journalEntryId?.substring(0,8).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons based on status */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {formValues.glPostingStatus === 'unposted' && (
                <button 
                  type="button" 
                  onClick={handlePostGL}
                  disabled={isSubmitting}
                  style={{ padding: '0.5rem 1.25rem', background: 'linear-gradient(135deg, #4A6B50, #6C8271)', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Post to Ledger
                </button>
              )}
              {formValues.glPostingStatus === 'posted' && (
                <>
                  <button 
                    type="button" 
                    onClick={handleVoidPayment}
                    disabled={isSubmitting}
                    style={{ padding: '0.5rem 1.25rem', background: '#EF4444', border: 'none', color: '#fff', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Void Payment (Full Reversal)
                  </button>
                  {formValues.unappliedAmount > 0 && (
                    <button 
                      type="button" 
                      onClick={handleRefundCredit}
                      disabled={isSubmitting}
                      style={{ padding: '0.5rem 1.25rem', background: '#F5F1E7', border: '1px solid #E8EAE6', color: '#4A6B50', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Refund Credit Cash Out
                    </button>
                  )}
                </>
              )}
              {formValues.glPostingStatus === 'reversed' && (
                <div style={{ padding: '0.75rem', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: '8px', fontSize: '0.75rem', width: '100%' }}>
                  🛑 Voided/Reversed: This payment receipt was officially voided. Reversal journal Entry <strong>{formValues.reversalJournalEntryId}</strong> was logged. Order balances have been restored and unapplied customer credits were adjusted.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className={styles.formActions}>
          <button type="button" className={styles.btnCancel} onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          {!isReadOnly && (
            <button 
              type="button" 
              className={styles.btnSubmit} 
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : isEdit ? 'Update Draft' : 'Save Draft'}
            </button>
          )}
          {isReadOnly && (formValues.notes !== modalPayload?.notes || formValues.referenceNumber !== modalPayload?.referenceNumber) && (
            <button 
              type="button" 
              className={styles.btnSubmit} 
              onClick={handleSaveDraft}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Updating...' : 'Save Notes'}
            </button>
          )}
        </div>
      </div>
    </FormModal>
  );
};
