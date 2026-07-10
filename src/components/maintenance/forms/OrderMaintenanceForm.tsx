import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useFinanceStore } from '../../../store/financeStore';
import { useToastStore } from '../../../store/toastStore';
import { calculateOrderTotals } from '../../../services/orderCalculationService';
import { validateOrder } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { reverseCOGSForOrder } from '../../../services/financeService';
import { useAuthStore } from '../../../store/authStore';
import { normalizeOrder } from '../../../services/normalizers';
import {
  BACKORDER_REASON_CODES, getAvailableQtyForLine, applyBackorderDerivation,
  validateBackorderLines, orderHasBackorder
} from '../../../services/backorderService';
import { Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { useI18n } from '../../../i18n/I18nProvider';


interface OrderMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrderMaintenanceForm: React.FC<OrderMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const addToast = useToastStore((s) => s.addToast);
  const { role, user } = useAuthStore();
  const { orders, products, inventory, customers, fetchInventory, fetchCustomers, addOrder, updateOrderDetails, deleteOrder, modalPayload, postOrderFinancialsAction } = useAdminStore();
  const fetchJournalEntries = useFinanceStore((s) => s.fetchJournalEntries);

  // Availability data for backorder detection + customer directory for
  // customerId linkage — load once if not present yet.
  React.useEffect(() => {
    if (isOpen && inventory.length === 0) fetchInventory();
    if (isOpen && customers.length === 0) fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const mode = modalPayload?.id ? 'edit' : 'create';
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeOrder(rawInitial);

  // Validate wrapper
  const handleValidate = (values: Record<string, any>) => {
    const res = validateOrder(values);

    // Backorder gate: leaving 'draft' requires a reason on every backordered
    // line ('other' additionally needs free text). Keyed to the line-items
    // custom field so the modal blocks save and jumps to the Items tab.
    const issues = validateBackorderLines(values.lineItems || [], values.status || 'draft');
    if (issues.length > 0) {
      const first = issues[0];
      res.errors['line_items_editor'] = first.code === 'missing_reason'
        ? t('orders.backorder.confirmBlockedReason', { line: first.index + 1 })
        : t('orders.backorder.confirmBlockedOther', { line: first.index + 1 });
    }
    return res.errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const normalized = normalizeOrder(values);
      // Recalculate totals
      const totals = calculateOrderTotals(normalized);
      // Customer linkage (P3.4-DEF-1): payment allocation and statements match
      // orders by customerId, but the form captures the customer by NAME. When
      // the entered name exactly matches a customer dossier, link its real id;
      // otherwise keep the existing/default id (walk-in behavior unchanged).
      const matchedCustomer = customers.find(
        (c) => (c.name || '').trim().toLowerCase() === (normalized.customerName || '').trim().toLowerCase()
      );
      const finalOrder = {
        ...normalized,
        ...totals,
        customerId: matchedCustomer?.id || normalized.customerId || 'c1',
        hasBackorder: orderHasBackorder(normalized.lineItems || []),
      };

      // Audit detail for backordered lines (written only after a successful
      // non-draft save — never on failed validation/save).
      const backorderedLines = (normalized.lineItems || [])
        .filter((l: any) => (l.backorderedQty || 0) > 0)
        .map((l: any) => ({
          sku: l.sku || null,
          description: l.description || null,
          backorderedQty: l.backorderedQty,
          reason: l.backorderReasonCode || null,
          expectedRestockDate: l.expectedRestockDate || null,
        }));

      if (mode === 'create') {
        // Single write: addOrder pre-allocates the doc ref so the stored id,
        // documentId and orderNumber are correct from the first (only) write.
        // No create-then-patch window, no duplicate document.
        const newId = await addOrder({
          ...finalOrder,
          orderNumber: '',
          orderNumberNormalized: '',
          glPostingStatus: 'unposted',
          journalEntryId: '',
          createdBy: 'Admin'
        });

        let jeId = '';
        try {
          jeId = await postOrderFinancialsAction(newId);
        } catch (e: any) {
          console.error("Failed to post financials on create:", e);
          addToast("Order created, but GL posting failed: " + e.message, "error");
        }

        await fetchJournalEntries();

        // Audit Trail
        await writeAuditLog({
          actor: 'Admin',
          action: 'CREATE_ORDER',
          entityType: 'order',
          entityId: newId,
          before: null,
          after: { status: finalOrder.status, total: finalOrder.grandTotal, journalEntryId: jeId },
        });

        if (finalOrder.status !== 'draft' && finalOrder.hasBackorder) {
          await writeAuditLog({
            actor: 'Admin',
            action: 'ORDER_BACKORDER',
            entityType: 'order',
            entityId: newId,
            before: null,
            after: { status: finalOrder.status, backorderedLines },
          });
        }

        addToast('New order created successfully & General Ledger updated.', 'success');
      } else {
        const orderId = finalOrder.id;
        const oldOrder = orders.find((o) => o.id === orderId);

        await updateOrderDetails(orderId, finalOrder);

        // Audit Trail
        await writeAuditLog({
          actor: 'Admin',
          action: 'UPDATE_ORDER',
          entityType: 'order',
          entityId: orderId,
          before: oldOrder ? { status: oldOrder.status, total: oldOrder.total } : null,
          after: { status: finalOrder.status, total: finalOrder.grandTotal },
        });

        if (finalOrder.status !== 'draft' && finalOrder.hasBackorder) {
          await writeAuditLog({
            actor: 'Admin',
            action: 'ORDER_BACKORDER',
            entityType: 'order',
            entityId: orderId,
            before: oldOrder ? { status: oldOrder.status } : null,
            after: { status: finalOrder.status, backorderedLines },
          });
        }

        addToast(`Order ${orderId.substring(0, 8)} updated successfully.`, 'success');
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast(`Failed to save order details: ${e.message || e}`, 'error');
    }
  };

  const handleDuplicate = async (values: Record<string, any>) => {
    try {
      const normalized = normalizeOrder(values);
      const totals = calculateOrderTotals(normalized);
      const duplicateOrder = {
        ...normalized,
        ...totals,
        // id/documentId/orderNumber are assigned by addOrder from the real doc
        // ref; a duplicate must not inherit the source's number or GL linkage.
        id: '',
        documentId: '',
        orderNumber: '',
        orderNumberNormalized: '',
        invoiceNumber: `INV-${Date.now()}`,
        status: 'draft' as const,
        paymentStatus: 'unpaid',
        amountPaid: 0,
        balanceDue: totals.grandTotal,
        glPostingStatus: 'unposted',
        journalEntryId: '',
        reversalJournalEntryId: '',
        reversalReason: '',
        reversalDate: '',
        hasBackorder: orderHasBackorder(normalized.lineItems || []),
        createdAt: new Date().toISOString(),
        createdBy: 'Admin',
        auditTrail: [`Order duplicated from ${normalized.id} on ${new Date().toLocaleDateString()}`],
      };

      const dupId = await addOrder(duplicateOrder);

      await writeAuditLog({
        actor: 'Admin',
        action: 'DUPLICATE_ORDER',
        entityType: 'order',
        entityId: dupId,
        before: { originalId: normalized.id },
        after: { duplicateId: dupId },
      });

      addToast(`Order duplicated successfully as draft #${dupId.substring(0, 8)}`, 'success');
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Failed to duplicate order.', 'error');
    }
  };

  const handleDelete = async () => {
    if (modalPayload?.id) {
      const orderId = modalPayload.id;
      const oldOrder = orders.find((o) => o.id === orderId);

      try {
        await deleteOrder(orderId);
      } catch (e: any) {
        addToast(`Failed to delete order: ${e.message || e}`, 'error');
        return;
      }

      await writeAuditLog({
        actor: 'Admin',
        action: 'DELETE_ORDER',
        entityType: 'order',
        entityId: orderId,
        before: oldOrder ? { status: oldOrder.status, total: oldOrder.total } : null,
        after: null,
      });

      addToast('Order successfully removed from store.', 'success');
      onClose();
    }
  };

  // Build Tabs Config
  const tabs: TabConfig[] = [
    {
      id: 'order',
      label: 'Order',
      fields: [
        { name: 'id', label: 'Order Number', type: 'text', readOnly: true, colSpan: 1 },
        {
          name: 'status',
          label: 'Order Status *',
          type: 'select',
          required: true,
          colSpan: 1,
          options: [
            { value: 'draft', label: 'Draft' },
            { value: 'confirmed', label: 'Confirmed' },
            { value: 'scheduled', label: 'Scheduled' },
            { value: 'in_design', label: 'In Design' },
            { value: 'ready', label: 'Ready for Dispatch' },
            { value: 'out_for_delivery', label: 'Out for Delivery' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'refunded', label: 'Refunded' },
          ],
        },
        { name: 'sourceType', label: 'Order Source', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'internalOrderType', label: 'Internal Order Type', type: 'text', colSpan: 1 },
        {
          name: 'priority',
          label: 'Priority Level',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'low', label: 'Low' },
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High' },
            { value: 'critical', label: 'Critical' },
          ],
        },
        { name: 'salesChannel', label: 'Sales Channel', type: 'text', colSpan: 1 },
        { name: 'storeLocation', label: 'Store Location / Branch', type: 'text', colSpan: 1 },
        { name: 'occasion', label: 'Occasion', type: 'text', colSpan: 1 },
        { name: 'tags', label: 'Tags (comma separated)', type: 'text', colSpan: 1 },
      ],
    },
    {
      id: 'customer',
      label: 'Customer',
      fields: [
        { name: 'customerName', label: 'Customer Name (Sender) *', type: 'text', required: true, colSpan: 1 },
        { name: 'customerEmail', label: 'Customer Email', type: 'email', colSpan: 1 },
        { name: 'customerPhone', label: 'Customer Phone', type: 'tel', colSpan: 1 },
        {
          name: 'customerType',
          label: 'Customer Type',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'retail', label: 'Retail' },
            { value: 'corporate', label: 'Corporate' },
          ],
        },
        { name: 'accountNumber', label: 'Account Number', type: 'text', colSpan: 1 },
        { name: 'loyaltyStatus', label: 'Loyalty Status', type: 'text', colSpan: 1 },
        { name: 'preferredContactMethod', label: 'Preferred Contact Method', type: 'text', colSpan: 1 },
        { name: 'recipientName', label: 'Recipient Name *', type: 'text', required: true, colSpan: 1 },
        { name: 'recipientPhone', label: 'Recipient Phone', type: 'tel', colSpan: 1 },
        { name: 'relationshipToSender', label: 'Relationship to Sender', type: 'text', colSpan: 1 },
      ],
    },
    {
      id: 'delivery',
      label: 'Delivery',
      fields: [
        { name: 'deliveryDate', label: 'Delivery Date *', type: 'date', required: true, colSpan: 1 },
        { name: 'dueDate', label: 'Due Date *', type: 'date', required: true, colSpan: 1 },
        {
          name: 'deliveryWindow',
          label: 'Delivery Window',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'morning', label: 'Morning (8am-12pm)' },
            { value: 'afternoon', label: 'Afternoon (12pm-5pm)' },
            { value: 'evening', label: 'Evening (5pm-8pm)' },
          ],
        },
        { name: 'addressLine1', label: 'Address Line 1 *', type: 'text', required: true, colSpan: 2 },
        { name: 'addressLine2', label: 'Address Line 2', type: 'text', colSpan: 1 },
        { name: 'city', label: 'City *', type: 'text', required: true, colSpan: 1 },
        { name: 'state', label: 'State *', type: 'text', required: true, colSpan: 1 },
        { name: 'zipCode', label: 'ZIP Code *', type: 'text', required: true, colSpan: 1 },
        { name: 'deliveryInstructions', label: 'Delivery Instructions', type: 'textarea', colSpan: 3 },
        { name: 'gateCode', label: 'Gate / Access Code', type: 'text', colSpan: 1 },
        { name: 'safeDropAllowed', label: 'Safe Drop Allowed', type: 'checkbox', colSpan: 1 },
        { name: 'signatureRequired', label: 'Signature Required', type: 'checkbox', colSpan: 1 },
      ],
    },
    {
      id: 'items',
      label: 'Items',
      fields: [
        {
          name: 'line_items_editor',
          label: 'Line Item Configurator',
          type: 'custom',
          colSpan: 3,
          render: (values, onChange) => {
            const lineItems = values.lineItems || [];
            const totals = calculateOrderTotals(values);

            const handleAddLine = () => {
              const newLine = {
                productId: products[0]?.id || 'p1',
                sku: products[0]?.sku || 'WR-001',
                description: products[0]?.name || 'Juliet Rose',
                quantity: 1,
                unitPrice: products[0]?.price || 85.00,
                discount: 0,
                taxable: true,
                lineTotal: products[0]?.price || 85.00,
                substitutionAllowed: true,
                designerNotes: '',
              };
              onChange('lineItems', [...lineItems, applyBackorderDerivation(newLine, products, inventory)]);
            };

            const handleRemoveLine = (index: number) => {
              const updated = lineItems.filter((_: any, i: number) => i !== index);
              onChange('lineItems', updated);
            };

            const handleLineChange = (index: number, fieldName: string, value: any) => {
              const updated = lineItems.map((item: any, i: number) => {
                if (i !== index) return item;
                const newItem = { ...item, [fieldName]: value };
                if (fieldName === 'productId') {
                  const matched = products.find((p) => p.id === value);
                  if (matched) {
                    newItem.description = matched.name;
                    newItem.unitPrice = matched.price;
                    if (matched.sku) newItem.sku = matched.sku; // keep sku in sync for availability lookups
                  }
                }
                const qty = parseInt(newItem.quantity) || 0;
                const price = parseFloat(newItem.unitPrice) || 0;
                const disc = parseFloat(newItem.discount) || 0;
                newItem.lineTotal = Math.max(0, qty * price - disc);
                // Re-derive backorderedQty (clears stale reason fields when resolved).
                return applyBackorderDerivation(newItem, products, inventory);
              });
              onChange('lineItems', updated);
            };

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%' }}>
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #E8EAE6', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
                    <thead style={{ background: '#FAFAF8', position: 'sticky', top: 0, borderBottom: '1px solid #E8EAE6' }}>
                      <tr>
                        <th style={{ padding: '0.5rem' }}>Product</th>
                        <th style={{ padding: '0.5rem', width: '70px' }}>Qty</th>
                        <th style={{ padding: '0.5rem', width: '90px' }}>Price</th>
                        <th style={{ padding: '0.5rem', width: '80px' }}>Disc.</th>
                        <th style={{ padding: '0.5rem', width: '50px' }}>Tax</th>
                        <th style={{ padding: '0.5rem', width: '90px' }}>Total</th>
                        <th style={{ padding: '0.5rem', width: '50px' }}>Sub.</th>
                        <th style={{ padding: '0.5rem' }}>Notes</th>
                        <th style={{ padding: '0.5rem', width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item: any, idx: number) => (
                        <React.Fragment key={idx}>
                        <tr style={{ borderBottom: (item.backorderedQty || 0) > 0 ? 'none' : '1px solid #E8EAE6' }}>
                           <td style={{ padding: '0.25rem' }}>
                            <select
                              value={item.productId}
                              onChange={(e) => handleLineChange(idx, 'productId', e.target.value)}
                              style={{ width: '100%', padding: '0.25rem', border: '1px solid #E8EAE6', borderRadius: '4px' }}
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} (${p.price})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input
                              type="number"
                              value={item.quantity}
                              min="1"
                              onChange={(e) => handleLineChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                              style={{ width: '100%', padding: '0.25rem', border: '1px solid #E8EAE6', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={(e) => handleLineChange(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '0.25rem', border: '1px solid #E8EAE6', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input
                              type="number"
                              value={item.discount}
                              onChange={(e) => handleLineChange(idx, 'discount', parseFloat(e.target.value) || 0)}
                              style={{ width: '100%', padding: '0.25rem', border: '1px solid #E8EAE6', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!item.taxable}
                              onChange={(e) => handleLineChange(idx, 'taxable', e.target.checked)}
                            />
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 600 }}>
                            ${item.lineTotal.toFixed(2)}
                          </td>
                          <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={!!item.substitutionAllowed}
                              onChange={(e) => handleLineChange(idx, 'substitutionAllowed', e.target.checked)}
                            />
                          </td>
                          <td style={{ padding: '0.25rem' }}>
                            <input
                              type="text"
                              value={item.designerNotes || ''}
                              placeholder="e.g. Keep pink"
                              onChange={(e) => handleLineChange(idx, 'designerNotes', e.target.value)}
                              style={{ width: '100%', padding: '0.25rem', border: '1px solid #E8EAE6', borderRadius: '4px' }}
                            />
                          </td>
                          <td style={{ padding: '0.25rem', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveLine(idx)}
                              style={{ color: '#EF4444', border: 'none', background: 'none', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                        {(item.backorderedQty || 0) > 0 && (() => {
                          const available = getAvailableQtyForLine(item, products, inventory) ?? 0;
                          const missingReason = !item.backorderReasonCode;
                          const missingOtherText = item.backorderReasonCode === 'other' && !(item.backorderReasonText || '').trim();
                          const inputStyle = { width: '100%', padding: '0.35rem', border: '1px solid #FCD34D', borderRadius: '4px', fontSize: '0.8125rem', background: '#FFFFFF' };
                          const labelStyle = { display: 'block', fontSize: '0.6875rem', fontWeight: 600 as const, color: '#92400E', marginBottom: '0.2rem' };
                          return (
                            <tr style={{ borderBottom: '1px solid #E8EAE6' }}>
                              <td colSpan={9} style={{ padding: '0.5rem' }}>
                                <div role="alert" style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '8px', padding: '0.75rem' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: '#92400E', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
                                    <AlertTriangle size={15} />
                                    {t('orders.backorder.detected')}
                                    <span style={{ fontWeight: 500, marginLeft: 'auto', fontSize: '0.75rem' }}>
                                      {t('orders.backorder.available')}: <strong>{available}</strong>
                                      {' · '}{t('orders.backorder.ordered')}: <strong>{item.quantity}</strong>
                                      {' · '}{t('orders.backorder.qty')}: <strong>{item.backorderedQty}</strong>
                                    </span>
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: item.backorderReasonCode === 'other' ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)', gap: '0.5rem' }}>
                                    <div>
                                      <label style={labelStyle}>{t('orders.backorder.reason')}</label>
                                      <select
                                        value={item.backorderReasonCode || ''}
                                        onChange={(e) => handleLineChange(idx, 'backorderReasonCode', e.target.value)}
                                        style={inputStyle}
                                      >
                                        <option value="">{t('orders.backorder.selectReason')}</option>
                                        {BACKORDER_REASON_CODES.map((code) => (
                                          <option key={code} value={code}>{t(`orders.backorder.reasons.${code}`)}</option>
                                        ))}
                                      </select>
                                    </div>
                                    {item.backorderReasonCode === 'other' && (
                                      <div>
                                        <label style={labelStyle}>{t('orders.backorder.otherDetail')}</label>
                                        <input
                                          type="text"
                                          value={item.backorderReasonText || ''}
                                          onChange={(e) => handleLineChange(idx, 'backorderReasonText', e.target.value)}
                                          style={inputStyle}
                                        />
                                      </div>
                                    )}
                                    <div>
                                      <label style={labelStyle}>{t('orders.backorder.expectedRestock')}</label>
                                      <input
                                        type="date"
                                        value={item.expectedRestockDate || ''}
                                        onChange={(e) => handleLineChange(idx, 'expectedRestockDate', e.target.value)}
                                        style={inputStyle}
                                      />
                                    </div>
                                    <div>
                                      <label style={labelStyle}>{t('orders.backorder.customerNote')}</label>
                                      <input
                                        type="text"
                                        value={item.customerBackorderNote || ''}
                                        placeholder={t('orders.backorder.customerNotePlaceholder')}
                                        onChange={(e) => handleLineChange(idx, 'customerBackorderNote', e.target.value)}
                                        style={inputStyle}
                                      />
                                    </div>
                                  </div>
                                  {(missingReason || missingOtherText) && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: values.status === 'draft' ? '#92400E' : '#B91C1C' }}>
                                      {values.status === 'draft'
                                        ? t('orders.backorder.draftHint')
                                        : t('orders.backorder.reasonRequired')}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })()}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.35rem 0.75rem',
                      fontSize: '0.75rem',
                      background: '#F0F5F1',
                      border: '1px dashed #B4C5B6',
                      borderRadius: '6px',
                      color: '#4A6B50',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={14} /> Add Product Line
                  </button>
                </div>

                {/* Recalculated totals view */}
                <div style={{ background: '#FDFCFA', border: '1px solid #E8EAE6', borderRadius: '10px', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Subtotal:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>${totals.subtotal.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Discount:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>${totals.discount.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Taxes:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>${totals.tax.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Delivery Fee:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600 }}>${totals.deliveryFee.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Grand Total:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-sage-dark)' }}>${totals.grandTotal.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Estimated Margin:</div>
                    <div style={{ fontSize: '1rem', fontWeight: 600, color: '#047857' }}>${totals.estimatedMargin.toFixed(2)} ({totals.marginPercentage}%)</div>
                  </div>
                </div>
              </div>
            );
          },
        },
      ],
    },
    {
      id: 'payment',
      label: 'Payment',
      fields: [
        {
          name: 'paymentStatus',
          label: 'Payment Status *',
          type: 'select',
          required: true,
          colSpan: 1,
          options: [
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'partial', label: 'Partially Paid' },
            { value: 'paid', label: 'Fully Paid' },
            { value: 'refunded', label: 'Refunded' },
          ],
        },
        {
          name: 'paymentMethod',
          label: 'Payment Method',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'cash', label: 'Cash' },
            { value: 'check', label: 'Check' },
            { value: 'credit_card', label: 'Credit Card' },
            { value: 'stripe', label: 'Stripe' },
            { value: 'other', label: 'Other' },
          ],
        },
        { name: 'amountPaid', label: 'Amount Paid ($)', type: 'number', colSpan: 1 },
        { name: 'balanceDue', label: 'Balance Due ($)', type: 'display', colSpan: 1 },
        { name: 'paymentReference', label: 'Payment Reference (e.g. Check #, Card ref)', type: 'text', colSpan: 1 },
        { name: 'stripeId', label: 'Stripe Reference / Transaction ID', type: 'text', colSpan: 1 },
        { name: 'invoiceNumber', label: 'Invoice Number', type: 'text', colSpan: 1 },
        { name: 'taxJurisdiction', label: 'Tax Jurisdiction', type: 'text', colSpan: 1 },
        { name: 'taxRate', label: 'Tax Rate (%)', type: 'number', colSpan: 1 },
        { name: 'refundStatus', label: 'Refund Status', type: 'text', colSpan: 1 },
        { name: 'refundAmount', label: 'Refund Amount ($)', type: 'number', colSpan: 1 },
        { name: 'financeNotes', label: 'Finance Notes', type: 'textarea', colSpan: 3 },
        {
          name: 'finance_warnings',
          label: 'Finance Warnings',
          type: 'custom',
          colSpan: 3,
          render: (values) => {
            const totals = calculateOrderTotals(values);
            const warnings = [];

            if (values.status === 'delivered' && totals.balanceDue > 0) {
              warnings.push('⚠️ Order is marked DELIVERED but has an unpaid balance.');
            }
            if (values.paymentStatus === 'paid' && values.glPostingStatus === 'unposted') {
              warnings.push('⚠️ Order is paid but has not been posted to the General Ledger.');
            }
            if (totals.balanceDue < 0) {
              warnings.push('⚠️ Negative balance due (Customer has overpaid).');
            }
            if (values.isTaxable !== false && totals.tax === 0) {
              warnings.push('⚠️ Tax is missing for a taxable order.');
            }

            if (warnings.length === 0) return null;

            return (
              <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8125rem', color: '#B45309' }}>
                {warnings.map((w, idx) => (
                  <div key={idx}>{w}</div>
                ))}
              </div>
            );
          },
        },
      ],
    },
    {
      id: 'fulfillment',
      label: 'Fulfillment',
      fields: [
        {
          name: 'designer',
          label: 'Assigned Designer',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Elena R.', label: 'Elena R. (Arranger)' },
            { value: 'James K.', label: 'James K. (Director)' },
          ]
        },
        {
          name: 'courier',
          label: 'Assigned Courier Driver',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Marcus T.', label: 'Marcus T. (Courier)' },
            { value: 'Elena R.', label: 'Elena R. (Arranger)' },
          ]
        },
        {
          name: 'fulfillmentStatus',
          label: 'Fulfillment / Delivery Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'unfulfilled', label: 'Unfulfilled' },
            { value: 'preparing', label: 'Preparing' },
            { value: 'fulfilled', label: 'Fulfilled' },
            { value: 'returned', label: 'Returned' },
          ],
        },
        { name: 'deliveryMethod', label: 'Delivery Method', type: 'text', colSpan: 1 },
        { name: 'routeNumber', label: 'Route Number', type: 'text', colSpan: 1 },
        { name: 'deliveryZone', label: 'Delivery Zone', type: 'text', colSpan: 1 },
        { name: 'pickupWindow', label: 'Pickup/Delivery Window', type: 'text', colSpan: 1 },
        { name: 'dispatchTime', label: 'Dispatch Timestamp', type: 'text', colSpan: 1 },
        { name: 'deliveredTime', label: 'Delivered Timestamp', type: 'text', colSpan: 1 },
        { name: 'proofOfDelivery', label: 'Proof of Delivery Notes', type: 'text', colSpan: 1 },
        { name: 'deliveryPhotoUrl', label: 'Delivery Photo URL', type: 'text', colSpan: 2 },
        { name: 'deliveryAttemptCount', label: 'Delivery Attempts', type: 'number', colSpan: 1 },
        { name: 'failedReason', label: 'Failed Attempt Reason', type: 'text', colSpan: 1 },
        { name: 'redeliveryRequired', label: 'Redelivery Required', type: 'checkbox', colSpan: 1 },
        { name: 'driverNotes', label: 'Driver Exception Notes', type: 'textarea', colSpan: 3 },
        { name: 'customerDeliveryNotes', label: 'Customer Delivery Notes', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'gl_audit',
      label: 'GL / Audit',
      fields: [
        {
          name: 'glPostingStatus',
          label: 'GL Posting Status',
          type: 'display',
          colSpan: 1,
        },
        { name: 'journalEntryId', label: 'Journal Entry ID', type: 'display', colSpan: 1 },
        { name: 'reversalJournalEntryId', label: 'Reversal Entry ID', type: 'display', colSpan: 1 },
        { name: 'reversalReason', label: 'Reversal Reason', type: 'display', colSpan: 1 },
        { name: 'reversalDate', label: 'Reversal Date', type: 'display', colSpan: 1 },
        { name: 'createdBy', label: 'Created By', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'createdAt', label: 'Created Date', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'lastUpdatedBy', label: 'Last Updated By', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'lastUpdatedDate', label: 'Last Updated Date', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'internalNotes', label: 'Internal Office Notes', type: 'textarea', colSpan: 3 },
        { name: 'floristNotes', label: 'Florist Notes / Card Message', type: 'textarea', colSpan: 3 },
        {
          name: 'cogs_details',
          label: 'COGS & Inventory Costing Details',
          type: 'custom',
          colSpan: 3,
          render: (values) => {
            const cogsPosted = values.cogsPosted === true;
            const cogsReversed = values.cogsReversed === true;
            const amount = values.cogsAmount || 0;
            const jeId = values.cogsJournalEntryId || '';
            const postedAt = values.cogsPostedAt;
            const snapshot = values.cogsSnapshot || [];
            
            const formatTimestamp = (ts: any) => {
              if (!ts) return 'N/A';
              if (ts.seconds) return new Date(ts.seconds * 1000).toLocaleString();
              if (typeof ts === 'string') return new Date(ts).toLocaleString();
              if (ts instanceof Date) return ts.toLocaleString();
              return String(ts);
            };

            const handleReverseCOGS = async () => {
              const reason = window.prompt("Enter reason for reversing COGS:");
              if (!reason || !reason.trim()) {
                if (reason !== null) {
                  addToast("A reason is required to reverse COGS.", "error");
                }
                return;
              }
              try {
                const revId = await reverseCOGSForOrder(values.id, reason, user?.email || 'Admin');
                addToast(`COGS reversed successfully. Reversal entry: ${revId}`, "success");
                onClose();
              } catch (err: any) {
                addToast(`Failed to reverse COGS: ${err.message}`, "error");
              }
            };

            const canReverse = cogsPosted && !cogsReversed && (role === 'admin' || role === 'owner');

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem', border: '1px solid #E8EAE6', borderRadius: '12px', padding: '1rem', background: '#FAFAF8' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#2C302E' }}>COGS Valuation Snapshot</span>
                  {cogsPosted && !cogsReversed && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '6px', background: '#DEF7EC', color: '#03543F' }}>
                      POSTED INSTANTLY
                    </span>
                  )}
                  {cogsReversed && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '6px', background: '#FDE8E8', color: '#9B1C1C' }}>
                      REVERSED
                    </span>
                  )}
                  {!cogsPosted && !cogsReversed && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: '6px', background: '#E5E7EB', color: '#4B5563' }}>
                      UNPOSTED
                    </span>
                  )}
                </div>

                {cogsPosted && (
                  <div style={{ fontSize: '0.8125rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', padding: '0.5rem', borderBottom: '1px solid #E8EAE6' }}>
                    <div><strong>COGS Amount:</strong> ${amount.toFixed(2)}</div>
                    <div><strong>Posting Date:</strong> {formatTimestamp(postedAt)}</div>
                    <div><strong>Journal Entry ID:</strong> {jeId || 'N/A'}</div>
                    {canReverse && (
                      <button
                        type="button"
                        onClick={handleReverseCOGS}
                        style={{
                          gridColumn: 'span 2',
                          marginTop: '0.5rem',
                          padding: '0.4rem 0.75rem',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          backgroundColor: '#FEF2F2',
                          border: '1px solid #FCA5A5',
                          borderRadius: '6px',
                          color: '#991B1B',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <RefreshCw size={12} /> Reverse COGS Posting (Admin correction)
                      </button>
                    )}
                  </div>
                )}

                {cogsReversed && (
                  <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.5rem', borderBottom: '1px solid #E8EAE6', color: '#9B1C1C', backgroundColor: '#FDF2F2', borderRadius: '8px' }}>
                    <div><strong>Reversal JE:</strong> {values.cogsReversalJournalEntryId || 'N/A'}</div>
                    <div><strong>Reversal Date:</strong> {formatTimestamp(values.cogsReversedAt)}</div>
                    <div><strong>Reversal Reason:</strong> "{values.cogsReversalReason || 'N/A'}"</div>
                  </div>
                )}

                {snapshot.length > 0 ? (
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: '0.25rem' }}>Raw Materials Consumed (WAC frozen at delivery)</label>
                    <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #E8EAE6', color: '#6B7280', textAlign: 'left' }}>
                          <th style={{ padding: '0.25rem 0' }}>SKU</th>
                          <th style={{ padding: '0.25rem 0' }}>Item</th>
                          <th style={{ padding: '0.25rem 0', textAlign: 'right' }}>Qty</th>
                          <th style={{ padding: '0.25rem 0', textAlign: 'right' }}>WAC</th>
                          <th style={{ padding: '0.25rem 0', textAlign: 'right' }}>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {snapshot.map((line: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6', textDecoration: cogsReversed ? 'line-through' : 'none' }}>
                            <td style={{ padding: '0.25rem 0', fontWeight: 500 }}>{line.sku}</td>
                            <td style={{ padding: '0.25rem 0' }}>{line.name}</td>
                            <td style={{ padding: '0.25rem 0', textAlign: 'right' }}>{line.quantityConsumed}</td>
                            <td style={{ padding: '0.25rem 0', textAlign: 'right' }}>${(line.unitWac || 0).toFixed(2)}</td>
                            <td style={{ padding: '0.25rem 0', textAlign: 'right', fontWeight: 600 }}>${(line.extendedCost || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.75rem', color: '#6B7280', fontStyle: 'italic' }}>
                    {values.status === 'delivered' 
                      ? 'No recipe components consumed (verify product configs).'
                      : 'Recipe configuration and Weighted Average Cost will freeze when this order is marked Delivered.'
                    }
                  </div>
                )}
              </div>
            );
          }
        },
        {
          name: 'audit_timeline',
          label: 'System Audit Trail',
          type: 'custom',
          colSpan: 3,
          render: (values) => {
            const auditList = values.auditTrail || [];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t('maintenance.systemAuditTimeline')}</label>
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #E8EAE6', borderRadius: '8px', padding: '0.75rem', background: '#FAFAF8', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {auditList.length === 0 ? (
                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{t('maintenance.noLogsRecordedYet')}</div>
                  ) : (
                    auditList.map((log: string, i: number) => (
                      <div key={i} style={{ display: 'flex', gap: '0.5rem', fontSize: '0.75rem', borderBottom: '1px solid #F0EDE6', paddingBottom: '0.25rem' }}>
                        <span style={{ color: '#4A6B50', fontWeight: 600 }}>⏱</span>
                        <span>{log}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          },
        },
      ],
    },
  ];

  // Dynamically calculate status text for ribbon
  const statusBadgeText = initialValues.status || 'draft';
  const statusBadgeClass = `status-${statusBadgeText}`;

  return (
    <MaintenanceModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      onDelete={handleDelete}
      title={mode === 'create' ? 'Create New Order' : `Order Console: #${initialValues.id.substring(0, 8)}`}
      subtitle="Complete client sales and schedule courier dispatch."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={statusBadgeText}
      statusBadgeClass={statusBadgeClass}
      showDraftButton={mode === 'create'}
      onSaveDraft={handleSave}
      validate={handleValidate}
    >
      {/* Duplicate & Post Actions */}
      {mode === 'edit' && (
        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => handleDuplicate(initialValues)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '10px',
              border: '1px solid #D5D1C8',
              background: '#FFFFFF',
              fontSize: '0.8125rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Duplicate Order
          </button>
          {initialValues.glPostingStatus === 'unposted' && (
            <button
              type="button"
              onClick={async () => {
                try {
                  await postOrderFinancialsAction(initialValues.id);
                  await fetchJournalEntries();
                  addToast(`Order #${initialValues.orderNumber || initialValues.id.substring(0, 8).toUpperCase()} posted to General Ledger.`, 'success');
                  onClose();
                } catch (err: any) {
                  addToast(`GL Posting failed: ${err.message}`, 'error');
                }
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '10px',
                border: '1px solid #4A6B50',
                background: '#F0F5F1',
                color: '#4A6B50',
                fontSize: '0.8125rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Post to Ledger
            </button>
          )}
        </div>
      )}
    </MaintenanceModal>
  );
};
