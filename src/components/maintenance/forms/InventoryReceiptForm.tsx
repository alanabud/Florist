import React, { useState, useEffect } from 'react';
import { FormModal } from '../../ui/FormModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { receivePurchaseOrder } from '../../../services/receivingService';
import modalStyles from '../../ui/FormModal.module.css';

interface InventoryReceiptFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InventoryReceiptForm: React.FC<InventoryReceiptFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { purchaseOrders, fetchPurchaseOrders } = useAdminStore();

  const [poId, setPoId] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [freightAmount, setFreightAmount] = useState('0');
  const [freightTreatment, setFreightTreatment] = useState<'capitalize' | 'expense'>('expense');
  const [notes, setNotes] = useState('');
  
  const [lines, setLines] = useState<Array<{
    itemId: string;
    sku: string;
    description: string;
    quantityOrdered: number;
    quantityAlreadyReceived: number;
    quantityReceived: number;
    quantityDamaged: number;
    quantityRejected: number;
    unitCost: number;
  }>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load POs on open
  useEffect(() => {
    if (isOpen) {
      fetchPurchaseOrders();
    }
  }, [isOpen, fetchPurchaseOrders]);

  // When PO changes, load lines
  useEffect(() => {
    if (poId) {
      const selectedPO = purchaseOrders.find(po => po.id === poId);
      if (selectedPO) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFreightAmount(String(selectedPO.freightAmount || 0));
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFreightTreatment(selectedPO.freightTreatment || 'expense');
        
        const initialLines = selectedPO.lines.map(poLine => {
          const alreadyReceived = poLine.quantityReceived || 0;
          const remaining = Math.max(0, poLine.quantityOrdered - alreadyReceived);
          return {
            itemId: poLine.itemId,
            sku: poLine.sku,
            description: poLine.description,
            quantityOrdered: poLine.quantityOrdered,
            quantityAlreadyReceived: alreadyReceived,
            quantityReceived: remaining, // default to remaining
            quantityDamaged: 0,
            quantityRejected: 0,
            unitCost: poLine.unitCost,
          };
        });
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLines(initialLines);
      }
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLines([]);
    }
  }, [poId, purchaseOrders]);

  const handleLineQtyChange = (
    index: number,
    field: 'quantityReceived' | 'quantityDamaged' | 'quantityRejected',
    value: number
  ) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    setLines(updated);
  };

  // Filter purchase orders that are in a status that allows receiving
  const activePOs = purchaseOrders.filter(po => po.status === 'ordered' || po.status === 'partially_received');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!poId) {
      addToast('Please select a Purchase Order to receive.', 'error');
      return;
    }

    if (lines.length === 0) {
      addToast('No items to receive.', 'error');
      return;
    }

    const noQtyReceived = lines.every(l => l.quantityReceived <= 0);
    if (noQtyReceived) {
      addToast('Please enter a received quantity greater than zero for at least one item.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const receiptPayload = {
        poId,
        receiptDate: new Date(receiptDate).toISOString(),
        freightAmount: parseFloat(freightAmount) || 0,
        freightTreatment,
        notes,
        lines: lines.map(l => ({
          itemId: l.itemId,
          sku: l.sku,
          quantityReceived: l.quantityReceived,
          quantityDamaged: l.quantityDamaged,
          quantityRejected: l.quantityRejected,
          unitCost: l.unitCost,
        })),
      };

      await receivePurchaseOrder(receiptPayload, 'Admin');
      addToast('Inventory receipt recorded and accrued. Stock counts and average costs updated.', 'success');
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Failed to post inventory receipt.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title="Log Inventory Receipt">
      <form onSubmit={handleSubmit} style={{ maxWidth: '850px', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
          <div>
            <label className={modalStyles.formLabel}>Link Purchase Order *</label>
            <select
              value={poId}
              onChange={(e) => setPoId(e.target.value)}
              className={modalStyles.formInput}
              required
            >
              <option value="">Select an Ordered PO...</option>
              {activePOs.map(po => (
                <option key={po.id} value={po.id}>
                  {po.id} — {po.vendorName} (Ordered: {new Date(po.orderDate).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={modalStyles.formLabel}>Receipt Date *</label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className={modalStyles.formInput}
              required
            />
          </div>
        </div>

        {poId && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: '#FAFAF8', padding: '1rem', borderRadius: '10px' }}>
            <div>
              <label className={modalStyles.formLabel}>Actual Freight Incurred ($)</label>
              <input
                type="number"
                value={freightAmount}
                onChange={(e) => setFreightAmount(e.target.value)}
                className={modalStyles.formInput}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            <div>
              <label className={modalStyles.formLabel}>Freight Accounting Treatment</label>
              <select
                value={freightTreatment}
                onChange={(e) => setFreightTreatment(e.target.value as any)}
                className={modalStyles.formInput}
              >
                <option value="expense">Post to Expense (5300)</option>
                <option value="capitalize">Capitalize (Add to WAC Cost)</option>
              </select>
            </div>
          </div>
        )}

        {/* Lines */}
        {poId && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E8EAE6', fontWeight: 600, fontSize: '0.75rem', color: '#8a8f8c', textTransform: 'uppercase', textAlign: 'right' }}>
              <span style={{ textAlign: 'left' }}>Item description</span>
              <span>PO Qty</span>
              <span>Prev Recd</span>
              <span>Delivered</span>
              <span>Damaged</span>
              <span>Rejected</span>
              <span style={{ color: '#4A6B50', fontWeight: 700 }}>Accepted</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '220px', overflowY: 'auto' }}>
              {lines.map((line, index) => {
                const accepted = line.quantityReceived - line.quantityDamaged - line.quantityRejected;
                return (
                  <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr 0.8fr', gap: '0.5rem', alignItems: 'center', textAlign: 'right' }}>
                    <div style={{ textAlign: 'left', fontSize: '0.8125rem', color: '#111827', fontWeight: 500 }}>
                      {line.sku} — {line.description}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{line.quantityOrdered}</div>
                    <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{line.quantityAlreadyReceived}</div>
                    
                    <input
                      type="number"
                      value={line.quantityReceived}
                      onChange={(e) => handleLineQtyChange(index, 'quantityReceived', parseInt(e.target.value) || 0)}
                      className={modalStyles.formInput}
                      style={{ textAlign: 'right', padding: '0.35rem' }}
                      min="0"
                    />

                    <input
                      type="number"
                      value={line.quantityDamaged}
                      onChange={(e) => handleLineQtyChange(index, 'quantityDamaged', parseInt(e.target.value) || 0)}
                      className={modalStyles.formInput}
                      style={{ textAlign: 'right', padding: '0.35rem', color: '#EF4444' }}
                      min="0"
                    />

                    <input
                      type="number"
                      value={line.quantityRejected}
                      onChange={(e) => handleLineQtyChange(index, 'quantityRejected', parseInt(e.target.value) || 0)}
                      className={modalStyles.formInput}
                      style={{ textAlign: 'right', padding: '0.35rem', color: '#D97706' }}
                      min="0"
                    />

                    <div style={{ fontSize: '0.875rem', fontWeight: 700, color: accepted > 0 ? '#4A6B50' : '#6b7280', paddingRight: '0.25rem' }}>
                      {accepted}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {poId && (
          <div style={{ marginBottom: '1.25rem' }}>
            <label className={modalStyles.formLabel}>Receipt Notes / Delivery Discrepancies</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={modalStyles.formInput}
              placeholder="e.g. Cardboard box wet, rejected 3 damaged rose stems."
              style={{ height: '70px' }}
            />
          </div>
        )}

        <div className={modalStyles.formActions} style={{ borderTop: '1px solid #E8EAE6', paddingTop: '1rem' }}>
          <button type="button" className={modalStyles.btnCancel} onClick={onClose}>Cancel</button>
          {poId && (
            <button type="submit" className={modalStyles.btnSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Posting Receipt...' : 'Post Inventory Receipt'}
            </button>
          )}
        </div>
      </form>
    </FormModal>
  );
};
