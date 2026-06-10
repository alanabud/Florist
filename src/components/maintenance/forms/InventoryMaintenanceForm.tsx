import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { validateInventoryItem } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { normalizeInventoryItem } from '../../../services/normalizers';

interface InventoryMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InventoryMaintenanceForm: React.FC<InventoryMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { updateInventoryItem, deleteInventoryItem, modalPayload, inventory, restockInventoryItem } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeInventoryItem(rawInitial);

  const handleValidate = (values: Record<string, any>) => {
    const res = validateInventoryItem(values);
    return res.errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const finalItem = normalizeInventoryItem(values);
      finalItem.quantityAvailable = Math.max(0, finalItem.quantity - (finalItem.quantityReserved || 0));

      if (mode === 'create') {
        const invId = `inv-${Date.now()}`;
        restockInventoryItem(finalItem.sku, finalItem.quantity); // Seed initial quantity

        await writeAuditLog({
          actor: 'Admin',
          action: 'CREATE_INVENTORY',
          entityType: 'inventory',
          entityId: invId,
          before: null,
          after: { name: finalItem.name, sku: finalItem.sku, qty: finalItem.quantity },
        });

        addToast(`Inventory stock item "${finalItem.name}" created.`, 'success');
      } else {
        const invId = finalItem.id;
        const oldItem = inventory.find((i) => i.id === invId);

        updateInventoryItem(invId, finalItem);

        await writeAuditLog({
          actor: 'Admin',
          action: 'UPDATE_INVENTORY',
          entityType: 'inventory',
          entityId: invId,
          before: oldItem ? { name: oldItem.name, sku: oldItem.sku, qty: oldItem.quantity } : null,
          after: { name: finalItem.name, sku: finalItem.sku, qty: finalItem.quantity },
        });

        addToast(`Inventory stock item "${finalItem.name}" updated.`, 'success');
      }
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Failed to save stock item details.', 'error');
    }
  };

  const handleDelete = async () => {
    if (modalPayload?.id) {
      const invId = modalPayload.id;
      const oldItem = inventory.find((i) => i.id === invId);

      deleteInventoryItem(invId);

      await writeAuditLog({
        actor: 'Admin',
        action: 'DELETE_INVENTORY',
        entityType: 'inventory',
        entityId: invId,
        before: oldItem ? { name: oldItem.name, sku: oldItem.sku } : null,
        after: null,
      });

      addToast('Inventory stock record deleted.', 'success');
      onClose();
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'details',
      label: 'Item Details',
      fields: [
        { name: 'name', label: 'Item Name *', type: 'text', required: true, colSpan: 2 },
        { name: 'sku', label: 'SKU *', type: 'text', required: true, colSpan: 1 },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Flowers', label: 'Flowers' },
            { value: 'Greens', label: 'Greens' },
            { value: 'Supplies', label: 'Supplies' },
            { value: 'Packaging', label: 'Packaging' },
          ],
        },
        { name: 'type', label: 'Item Type (e.g. stem)', type: 'text', colSpan: 1 },
        { name: 'unitOfMeasure', label: 'Unit of Measure', type: 'text', colSpan: 1 },
        { name: 'status', label: 'Active Status', type: 'checkbox', colSpan: 1 },
        { name: 'storageLocation', label: 'Storage Location / Bin', type: 'text', colSpan: 1 },
        { name: 'shelfLifeDays', label: 'Shelf Life (Days)', type: 'number', colSpan: 1 },
      ],
    },
    {
      id: 'stock',
      label: 'Stock levels',
      fields: [
        { name: 'quantity', label: 'Quantity On Hand *', type: 'number', required: true, colSpan: 1 },
        { name: 'quantityReserved', label: 'Quantity Reserved', type: 'number', colSpan: 1 },
        { name: 'quantityAvailable', label: 'Quantity Available', type: 'display', colSpan: 1 },
        { name: 'reorderPoint', label: 'Reorder Point Threshold', type: 'number', colSpan: 1 },
        { name: 'reorderQuantity', label: 'Reorder Quantity Unit', type: 'number', colSpan: 1 },
        { name: 'minimumStock', label: 'Minimum Stock Warning', type: 'number', colSpan: 1 },
        { name: 'maximumStock', label: 'Maximum Storage Cap', type: 'number', colSpan: 1 },
        { name: 'lastCountedDate', label: 'Last Counted Date', type: 'date', colSpan: 1 },
      ],
    },
    {
      id: 'supplier',
      label: 'Supplier / Purchasing',
      fields: [
        { name: 'supplier', label: 'Preferred Supplier Name', type: 'text', colSpan: 1 },
        { name: 'supplierSku', label: 'Supplier SKU Code', type: 'text', colSpan: 1 },
        { name: 'unitCost', label: 'Unit Cost ($) *', type: 'number', required: true, colSpan: 1 },
        { name: 'lastPurchaseCost', label: 'Last Purchase Cost ($)', type: 'number', colSpan: 1 },
        { name: 'leadTimeDays', label: 'Supplier Lead Time (Days)', type: 'number', colSpan: 1 },
        { name: 'purchaseOrderLink', label: 'Purchase Order Link', type: 'text', colSpan: 2 },
        { name: 'lastRestockDate', label: 'Last Restock Date', type: 'date', colSpan: 1 },
      ],
    },
    {
      id: 'quality',
      label: 'Quality / Waste',
      fields: [
        { name: 'expirationDate', label: 'Expiration Date', type: 'date', colSpan: 1 },
        { name: 'condition', label: 'Current Stem Condition', type: 'text', colSpan: 1 },
        { name: 'wasteQuantity', label: 'Wasted Quantity', type: 'number', colSpan: 1 },
        { name: 'wasteReason', label: 'Reason for Waste / Write-off', type: 'text', colSpan: 2 },
        { name: 'qualityNotes', label: 'Quality Audit Notes', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'audit',
      label: 'Audit Log',
      fields: [
        { name: 'createdBy', label: 'Created By', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'createdDate', label: 'Created Date', type: 'date', readOnly: true, colSpan: 1 },
        { name: 'updatedBy', label: 'Last Updated By', type: 'text', readOnly: true, colSpan: 1 },
        {
          name: 'audit_timeline',
          label: 'Audit Timeline',
          type: 'custom',
          colSpan: 3,
          render: (values) => {
            const auditList = values.auditTrail || [];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Stock Audit History</label>
                <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #E8EAE6', borderRadius: '8px', padding: '0.5rem', background: '#FAFAF8', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {auditList.map((log: string, idx: number) => (
                    <div key={idx} style={{ fontSize: '0.75rem', borderBottom: '1px solid #F0EDE6', paddingBottom: '0.25rem' }}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            );
          },
        },
      ],
    },
  ];

  return (
    <MaintenanceModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      onDelete={handleDelete}
      title={mode === 'create' ? 'Add Inventory Stock' : `Inventory Console: ${initialValues.sku}`}
      subtitle="Track floral stems, raw assets, and supplier reorder bounds."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={initialValues.status ? 'active' : 'inactive'}
      statusBadgeClass={initialValues.status ? 'status-delivered' : 'status-draft'}
      validate={handleValidate}
    />
  );
};
