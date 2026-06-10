import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { validateSubscription } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { normalizeSubscription } from '../../../services/normalizers';

interface SubscriptionMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionMaintenanceForm: React.FC<SubscriptionMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { addSubscription, updateSubscriptionDetails, deleteSubscription, modalPayload, subscriptions } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeSubscription(rawInitial);

  const handleValidate = (values: Record<string, any>) => {
    const res = validateSubscription(values);
    return res.errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const finalSub = normalizeSubscription(values);
      finalSub.customerName = finalSub.customer ?? '';
      finalSub.value = finalSub.pricePerCycle ?? 0;
      finalSub.nextDelivery = finalSub.nextDeliveryDate ?? '';

      if (mode === 'create') {
        const subId = `sub-${Date.now()}`;
        addSubscription({
          ...finalSub,
          id: subId,
        });

        await writeAuditLog({
          actor: 'Admin',
          action: 'CREATE_SUBSCRIPTION',
          entityType: 'subscription',
          entityId: subId,
          before: null,
          after: { customer: finalSub.customer, frequency: finalSub.frequency, price: finalSub.pricePerCycle },
        });

        addToast(`Recurring subscription created for "${finalSub.customer}".`, 'success');
      } else {
        const subId = finalSub.id;
        const oldSub = subscriptions.find((s) => s.id === subId);

        updateSubscriptionDetails(subId, finalSub);

        await writeAuditLog({
          actor: 'Admin',
          action: 'UPDATE_SUBSCRIPTION',
          entityType: 'subscription',
          entityId: subId,
          before: oldSub ? { customer: oldSub.customerName, frequency: oldSub.frequency, price: oldSub.value } : null,
          after: { customer: finalSub.customer, frequency: finalSub.frequency, price: finalSub.pricePerCycle },
        });

        addToast(`Recurring subscription updated for "${finalSub.customer}".`, 'success');
      }
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Failed to save subscription details.', 'error');
    }
  };

  const handleDelete = async () => {
    if (modalPayload?.id) {
      const subId = modalPayload.id;
      const oldSub = subscriptions.find((s) => s.id === subId);

      deleteSubscription(subId);

      await writeAuditLog({
        actor: 'Admin',
        action: 'DELETE_SUBSCRIPTION',
        entityType: 'subscription',
        entityId: subId,
        before: oldSub ? { customer: oldSub.customerName, price: oldSub.value } : null,
        after: null,
      });

      addToast('Recurring subscription cancelled and deleted.', 'success');
      onClose();
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'details',
      label: 'Subscription Details',
      fields: [
        { name: 'subscriptionNumber', label: 'Subscription Number *', type: 'text', required: true, colSpan: 1 },
        { name: 'customer', label: 'Customer Name *', type: 'text', required: true, colSpan: 2 },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'cancelled', label: 'Cancelled' },
          ],
        },
        { name: 'planType', label: 'Plan Type', type: 'text', colSpan: 1 },
        {
          name: 'frequency',
          label: 'Frequency',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Weekly', label: 'Weekly' },
            { value: 'Bi-weekly', label: 'Bi-weekly' },
            { value: 'Monthly', label: 'Monthly' },
          ],
        },
        { name: 'startDate', label: 'Start Date', type: 'date', colSpan: 1 },
        { name: 'endDate', label: 'End Date', type: 'date', colSpan: 1 },
        { name: 'nextDeliveryDate', label: 'Next Delivery Date *', type: 'date', required: true, colSpan: 1 },
        { name: 'pauseStatus', label: 'Pause standing orders', type: 'checkbox', colSpan: 1 },
      ],
    },
    {
      id: 'preferences',
      label: 'Preferences',
      fields: [
        { name: 'preferredFlowers', label: 'Preferred Flowers (comma separated)', type: 'text', colSpan: 2 },
        { name: 'preferredColors', label: 'Preferred Colors (comma separated)', type: 'text', colSpan: 1 },
        { name: 'occasionType', label: 'Occasion Type', type: 'text', colSpan: 1 },
        { name: 'exclusions', label: 'Flower Exclusions', type: 'text', colSpan: 2 },
        { name: 'designerNotes', label: 'Designer Instructions', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'billing',
      label: 'Billing',
      fields: [
        { name: 'pricePerCycle', label: 'Price Per Cycle ($) *', type: 'number', required: true, colSpan: 1 },
        { name: 'tax', label: 'Tax per Cycle ($)', type: 'number', colSpan: 1 },
        { name: 'deliveryFee', label: 'Delivery Fee per Cycle ($)', type: 'number', colSpan: 1 },
        { name: 'paymentMethod', label: 'Payment Method', type: 'text', colSpan: 1 },
        {
          name: 'billingStatus',
          label: 'Billing Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'active', label: 'Billing Active' },
            { value: 'failed', label: 'Billing Failed' },
            { value: 'cancelled', label: 'Billing Suspended' },
          ],
        },
        { name: 'lastPaymentDate', label: 'Last Payment Date', type: 'date', colSpan: 1 },
        { name: 'nextBillingDate', label: 'Next Billing Date', type: 'date', colSpan: 1 },
        { name: 'failedPaymentCount', label: 'Failed Payment Count', type: 'number', colSpan: 1 },
      ],
    },
    {
      id: 'schedule',
      label: 'Delivery Schedule',
      fields: [
        {
          name: 'deliveryDay',
          label: 'Delivery Day of Week',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Monday', label: 'Monday' },
            { value: 'Tuesday', label: 'Tuesday' },
            { value: 'Wednesday', label: 'Wednesday' },
            { value: 'Thursday', label: 'Thursday' },
            { value: 'Friday', label: 'Friday' },
            { value: 'Saturday', label: 'Saturday' },
          ],
        },
        { name: 'deliveryWindow', label: 'Delivery Window', type: 'text', colSpan: 1 },
        { name: 'address', label: 'Delivery Address Destination', type: 'text', colSpan: 2 },
        { name: 'route', label: 'Assigned Driver Route', type: 'text', colSpan: 1 },
        { name: 'skipNextDelivery', label: 'Skip Next Period Delivery', type: 'checkbox', colSpan: 1 },
        { name: 'courierNotes', label: 'Courier Dispatch Instructions', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'audit',
      label: 'Audit Log',
      fields: [
        { name: 'internalNotes', label: 'Internal Account Notes', type: 'textarea', colSpan: 3 },
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
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Subscription Operations Timeline</label>
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
      title={mode === 'create' ? 'Setup Recurring Subscription' : `Subscription: #${initialValues.subscriptionNumber}`}
      subtitle="Establish standing corporate accounts and weekly house dispatches."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={initialValues.status}
      statusBadgeClass={initialValues.status === 'active' ? 'status-delivered' : 'status-draft'}
      validate={handleValidate}
    />
  );
};
