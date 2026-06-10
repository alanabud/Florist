/* eslint-disable react-hooks/set-state-in-effect */
import React, { useState, useEffect } from 'react';
import { FormModal } from '../../ui/FormModal';
import { useAdminStore, type PurchaseOrder, type PurchaseOrderLine } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { createPurchaseOrder, updatePurchaseOrder, approvePurchaseOrder } from '../../../services/purchaseOrderService';
import modalStyles from '../../ui/FormModal.module.css';

interface PurchaseOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { modalPayload, vendors, inventory, fetchVendors } = useAdminStore();

  const isEdit = !!modalPayload?.id;
  const currentPO = isEdit ? (modalPayload as PurchaseOrder) : null;
  const isLocked = currentPO ? currentPO.status !== 'draft' : false;

  const [vendorId, setVendorId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [location, setLocation] = useState('Main Warehouse');
  const [taxAmount, setTaxAmount] = useState('0');
  const [freightAmount, setFreightAmount] = useState('0');
  const [freightTreatment, setFreightTreatment] = useState<'capitalize' | 'expense'>('expense');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [notes, setNotes] = useState('');
  
  const [lines, setLines] = useState<PurchaseOrderLine[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load vendors on mount
  useEffect(() => {
    fetchVendors();
  }, [fetchVendors]);

  // Load initial values
  useEffect(() => {
    if (isOpen) {
      if (currentPO) {
        setVendorId(currentPO.vendorId);
        setOrderDate(currentPO.orderDate ? currentPO.orderDate.split('T')[0] : '');
        setExpectedDeliveryDate(currentPO.expectedDeliveryDate ? currentPO.expectedDeliveryDate.split('T')[0] : '');
        setLocation(currentPO.location || 'Main Warehouse');
        setTaxAmount(String(currentPO.taxAmount || 0));
        setFreightAmount(String(currentPO.freightAmount || 0));
        setFreightTreatment(currentPO.freightTreatment || 'expense');
        setDiscountAmount(String(currentPO.discountAmount || 0));
        setNotes(currentPO.notes || '');
        setLines(currentPO.lines || []);
      } else {
        setVendorId(vendors[0]?.id || '');
        setOrderDate(new Date().toISOString().split('T')[0]);
        setExpectedDeliveryDate('');
        setLocation('Main Warehouse');
        setTaxAmount('0');
        setFreightAmount('0');
        setFreightTreatment('expense');
        setDiscountAmount('0');
        setNotes('');
        setLines([{ itemId: '', sku: '', description: '', quantityOrdered: 1, quantityReceived: 0, quantityBilled: 0, unitCost: 0, lineTotal: 0 }]);
      }
    }
  }, [isOpen, currentPO, vendors]);

  const handleAddLine = () => {
    if (isLocked) return;
    setLines([
      ...lines,
      { itemId: '', sku: '', description: '', quantityOrdered: 1, quantityReceived: 0, quantityBilled: 0, unitCost: 0, lineTotal: 0 }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (isLocked) return;
    if (lines.length <= 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, itemId: string) => {
    if (isLocked) return;
    const selectedItem = inventory.find(item => item.id === itemId);
    if (!selectedItem) return;

    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      itemId: selectedItem.id,
      sku: selectedItem.sku,
      description: selectedItem.name,
      unitCost: selectedItem.unitCost || 0,
      lineTotal: Math.round((updated[index].quantityOrdered * (selectedItem.unitCost || 0)) * 100) / 100,
    };
    setLines(updated);
  };

  const handleLineQtyCostChange = (index: number, field: 'quantityOrdered' | 'unitCost', value: number) => {
    if (isLocked) return;
    const updated = [...lines];
    const item = updated[index];
    
    const qty = field === 'quantityOrdered' ? value : item.quantityOrdered;
    const cost = field === 'unitCost' ? value : item.unitCost;

    updated[index] = {
      ...item,
      [field]: value,
      lineTotal: Math.round((qty * cost) * 100) / 100,
    };
    setLines(updated);
  };

  // Live Totals
  const subtotal = Math.round(lines.reduce((sum, l) => sum + (l.lineTotal || 0), 0) * 100) / 100;
  const parsedTax = parseFloat(taxAmount) || 0;
  const parsedFreight = parseFloat(freightAmount) || 0;
  const parsedDiscount = parseFloat(discountAmount) || 0;
  const totalCost = Math.round((subtotal + parsedTax + parsedFreight - parsedDiscount) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent, actionType: 'draft' | 'approve' = 'draft') => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validation
    const selectedVendor = vendors.find(v => v.id === vendorId);
    if (!selectedVendor) {
      addToast('A valid vendor must be selected.', 'error');
      return;
    }

    const invalidLines = lines.some(l => !l.itemId || l.quantityOrdered <= 0 || l.unitCost < 0);
    if (invalidLines) {
      addToast('Please ensure all lines have selected items, quantities > 0, and cost >= 0.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const poPayload = {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.name,
        orderDate: new Date(orderDate).toISOString(),
        expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate).toISOString() : undefined,
        location,
        lines,
        taxAmount: parsedTax,
        freightAmount: parsedFreight,
        freightTreatment,
        discountAmount: parsedDiscount,
        notes,
      };

      if (!isEdit) {
        // Create draft PO
        const createdPO = await createPurchaseOrder(poPayload, 'Admin');
        if (actionType === 'approve') {
          await approvePurchaseOrder(createdPO.id, 'Admin');
          addToast(`Purchase Order ${createdPO.id} created and approved.`, 'success');
        } else {
          addToast(`Draft Purchase Order ${createdPO.id} created.`, 'success');
        }
      } else {
        const poId = currentPO!.id;
        if (currentPO!.status === 'draft') {
          await updatePurchaseOrder(poId, poPayload, 'Admin');
          if (actionType === 'approve') {
            await approvePurchaseOrder(poId, 'Admin');
            addToast(`Purchase Order ${poId} updated and approved.`, 'success');
          } else {
            addToast(`Draft Purchase Order ${poId} saved.`, 'success');
          }
        }
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Failed to save Purchase Order.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal isOpen={isOpen} onClose={onClose} title={isEdit ? `Purchase Order Dossier: ${currentPO?.id}` : 'Create Purchase Order'}>
      <form style={{ maxWidth: '850px', width: '100%' }}>
        {isLocked && (
          <div style={{ padding: '0.75rem 1rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '8px', color: '#1E40AF', fontSize: '0.8125rem', marginBottom: '1.25rem', fontWeight: 600 }}>
            ℹ️ This Purchase Order is {currentPO?.status.toUpperCase()} and locked. It cannot be modified.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
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
            <label className={modalStyles.formLabel}>Order Date *</label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
              required
            />
          </div>
          <div>
            <label className={modalStyles.formLabel}>Expected Delivery</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label className={modalStyles.formLabel}>Receiving Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={modalStyles.formInput}
              disabled={isLocked}
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
            <label className={modalStyles.formLabel}>Freight Treatment</label>
            <select
              value={freightTreatment}
              onChange={(e) => setFreightTreatment(e.target.value as any)}
              className={modalStyles.formInput}
              disabled={isLocked}
            >
              <option value="expense">Post to Expense (5300)</option>
              <option value="capitalize">Capitalize (Add to WAC Cost)</option>
            </select>
          </div>
          <div>
            <label className={modalStyles.formLabel}>Est. Tax ($)</label>
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
          <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 0.5fr', gap: '0.75rem', paddingBottom: '0.5rem', borderBottom: '1px solid #E8EAE6', fontWeight: 600, fontSize: '0.8125rem', color: '#8a8f8c', textTransform: 'uppercase' }}>
            <span>Item (Inventory Stock)</span>
            <span style={{ textAlign: 'right' }}>Ordered Qty</span>
            <span style={{ textAlign: 'right' }}>Unit Cost ($)</span>
            <span style={{ textAlign: 'right' }}>Line Total</span>
            <span></span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', maxHeight: '200px', overflowY: 'auto' }}>
            {lines.map((line, index) => (
              <div key={index} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr 1fr 0.5fr', gap: '0.75rem', alignItems: 'center' }}>
                <select
                  value={line.itemId}
                  onChange={(e) => handleLineItemChange(index, e.target.value)}
                  className={modalStyles.formInput}
                  disabled={isLocked}
                  style={{ padding: '0.45rem' }}
                >
                  <option value="">Select item...</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.name} (${item.unitCost?.toFixed(2)})
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  value={line.quantityOrdered}
                  onChange={(e) => handleLineQtyCostChange(index, 'quantityOrdered', parseInt(e.target.value) || 0)}
                  className={modalStyles.formInput}
                  style={{ textAlign: 'right', padding: '0.45rem' }}
                  min="1"
                  disabled={isLocked}
                />

                <input
                  type="number"
                  placeholder="0.00"
                  value={line.unitCost}
                  onChange={(e) => handleLineQtyCostChange(index, 'unitCost', parseFloat(e.target.value) || 0)}
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
                  disabled={lines.length <= 1 || isLocked}
                  style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: '1.125rem', cursor: 'pointer', opacity: (lines.length <= 1 || isLocked) ? 0.3 : 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {!isLocked && (
            <button
              type="button"
              onClick={handleAddLine}
              style={{ marginTop: '0.75rem', background: 'none', border: '1px dashed #4A6B50', color: '#4A6B50', padding: '0.4rem 1rem', borderRadius: '6px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add Line Item
            </button>
          )}
        </div>

        {/* Notes & Totals summary block */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem', borderTop: '1px solid #E8EAE6', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
          <div>
            <label className={modalStyles.formLabel}>PO Notes / Purchase Memo</label>
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
              <span>Total Cost:</span>
              <span>${totalCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className={modalStyles.formActions} style={{ marginTop: '1.5rem', borderTop: '1px solid #E8EAE6', paddingTop: '1rem' }}>
          <button type="button" className={modalStyles.btnCancel} onClick={onClose}>
            {isLocked ? 'Close' : 'Cancel'}
          </button>
          
          {!isLocked && (
            <>
              <button
                type="button"
                className={modalStyles.btnDraft}
                onClick={(e) => handleSubmit(e, 'draft')}
                disabled={isSubmitting}
                style={{ marginRight: '0.5rem' }}
              >
                Save Draft PO
              </button>

              <button
                type="button"
                className={modalStyles.btnSubmit}
                onClick={(e) => handleSubmit(e, 'approve')}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Processing...' : 'Approve & Place PO'}
              </button>
            </>
          )}
        </div>
      </form>
    </FormModal>
  );
};
