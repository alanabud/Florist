import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { validateDelivery } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { normalizeOrder } from '../../../services/normalizers';

interface DeliveryMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeliveryMaintenanceForm: React.FC<DeliveryMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { orders, updateOrderDetails, modalPayload } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';
  // Deliveries are backed by Orders in the store, so we fetch the order record
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeOrder(rawInitial);

  // Map values from order standard fields to delivery naming specs if necessary
  const deliveryValues = {
    ...initialValues,
    recipientName: initialValues.recipientName || initialValues.customerName,
    courier: initialValues.courier || initialValues.driver,
  };

  const handleValidate = (values: Record<string, any>) => {
    const res = validateDelivery(values);
    return res.errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const orderId = values.id;
      const oldOrder = orders.find((o) => o.id === orderId);

      // Map back fields to order schema
      const updates = {
        recipientName: values.recipientName,
        recipientPhone: values.recipientPhone,
        addressLine1: values.addressLine1,
        addressLine2: values.addressLine2,
        city: values.city,
        state: values.state,
        zipCode: values.zipCode,
        deliveryDate: values.deliveryDate,
        deliveryWindow: values.deliveryWindow,
        status: values.status,
        priority: values.priority,
        driver: values.courier,
        courier: values.courier,
        routeNumber: values.routeNumber,
        deliveryZone: values.deliveryZone,
        gateCode: values.gateCode,
        safeDropAllowed: !!values.safeDropAllowed,
        signatureRequired: !!values.signatureRequired,
        
        // Dispatch fields
        dispatchTime: values.dispatchTime,
        deliveredTime: values.deliveredTime,
        deliveryAttemptCount: parseInt(values.deliveryAttemptCount) || 0,
        failedReason: values.failedReason,
        redeliveryRequired: !!values.redeliveryRequired,
        driverNotes: values.driverNotes,
        customerDeliveryNotes: values.customerDeliveryNotes,
        
        // Proof
        proofOfDelivery: values.proofOfDelivery,
        deliveryPhotoUrl: values.deliveryPhotoUrl,
      };

      updateOrderDetails(orderId, updates);

      await writeAuditLog({
        actor: 'Logistics',
        action: 'UPDATE_DELIVERY_DISPATCH',
        entityType: 'order',
        entityId: orderId,
        before: oldOrder ? { status: oldOrder.status, driver: oldOrder.driver } : null,
        after: { status: values.status, driver: values.courier, route: values.routeNumber },
      });

      addToast(`Delivery status and courier dispatch details updated for order #${orderId.substring(0, 8)}.`, 'success');
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Failed to update delivery dispatch details.', 'error');
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'overview',
      label: 'Delivery Overview',
      fields: [
        { name: 'id', label: 'Delivery ID (Order ID)', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'invoiceNumber', label: 'Related Invoice Number', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'customerName', label: 'Customer (Sender)', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'recipientName', label: 'Recipient Name *', type: 'text', required: true, colSpan: 1 },
        { name: 'recipientPhone', label: 'Recipient Phone', type: 'tel', colSpan: 1 },
        {
          name: 'status',
          label: 'Fulfillment / Delivery Status',
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
        {
          name: 'priority',
          label: 'Delivery Priority',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'normal', label: 'Normal' },
            { value: 'urgent', label: 'Urgent / Rush' },
            { value: 'vip', label: 'VIP Courier' },
          ],
        },
        { name: 'deliveryDate', label: 'Target Delivery Date *', type: 'date', required: true, colSpan: 1 },
        { name: 'deliveryWindow', label: 'Delivery Time Window', type: 'text', colSpan: 1 },
        { name: 'addressLine1', label: 'Address Line 1 *', type: 'text', required: true, colSpan: 2 },
        { name: 'addressLine2', label: 'Address Line 2', type: 'text', colSpan: 1 },
        { name: 'city', label: 'City *', type: 'text', required: true, colSpan: 1 },
        { name: 'state', label: 'State *', type: 'text', required: true, colSpan: 1 },
        { name: 'zipCode', label: 'ZIP Code *', type: 'text', required: true, colSpan: 1 },
        { name: 'deliveryZone', label: 'Delivery Zone', type: 'text', colSpan: 1 },
        { name: 'gateCode', label: 'Gate / Access Code', type: 'text', colSpan: 1 },
        { name: 'safeDropAllowed', label: 'Safe Drop Allowed', type: 'checkbox', colSpan: 1 },
        { name: 'signatureRequired', label: 'Signature Required', type: 'checkbox', colSpan: 1 },
      ],
    },
    {
      id: 'dispatch',
      label: 'Courier Dispatch',
      fields: [
        {
          name: 'courier',
          label: 'Assigned Courier Driver',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Marcus T.', label: 'Marcus T.' },
            { value: 'Elena R.', label: 'Elena R.' },
            { value: 'James K.', label: 'James K.' },
          ],
        },
        { name: 'routeNumber', label: 'Route number', type: 'text', colSpan: 1 },
        { name: 'dispatchTime', label: 'Dispatch Timestamp', type: 'text', colSpan: 1 },
        { name: 'deliveredTime', label: 'Delivered Timestamp', type: 'text', colSpan: 1 },
        { name: 'deliveryAttemptCount', label: 'Delivery Attempt Count', type: 'number', colSpan: 1 },
      ],
    },
    {
      id: 'proof',
      label: 'Proof / Exceptions',
      fields: [
        { name: 'proofOfDelivery', label: 'Proof of Delivery Notes', type: 'text', colSpan: 2 },
        { name: 'deliveryPhotoUrl', label: 'Delivery Photo URL', type: 'text', colSpan: 2 },
        { name: 'failedReason', label: 'Failed Delivery Reason', type: 'text', colSpan: 1 },
        { name: 'redeliveryRequired', label: 'Re-delivery Required', type: 'checkbox', colSpan: 1 },
        { name: 'driverNotes', label: 'Driver Exception Notes', type: 'textarea', colSpan: 3 },
        { name: 'customerDeliveryNotes', label: 'Customer Delivery Instructions', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'audit',
      label: 'Audit Log',
      fields: [
        { name: 'createdBy', label: 'Created By', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'createdDate', label: 'Created Date', type: 'date', readOnly: true, colSpan: 1 },
        { name: 'lastUpdatedBy', label: 'Last Updated By', type: 'text', readOnly: true, colSpan: 1 },
        {
          name: 'audit_timeline',
          label: 'Delivery Timeline logs',
          type: 'custom',
          colSpan: 3,
          render: (values) => {
            const auditList = values.auditTrail || [];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Logistics Audit Timeline</label>
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
      title={mode === 'create' ? 'Dispatch Courier' : `Delivery Console: Order #${deliveryValues.id.substring(0, 8)}`}
      subtitle="Arrange driver paths, route stops, and log photo drop signatures."
      mode={mode}
      initialValues={deliveryValues}
      tabs={tabs}
      statusBadgeText={deliveryValues.status}
      statusBadgeClass={`status-${deliveryValues.status}`}
      validate={handleValidate}
    />
  );
};
