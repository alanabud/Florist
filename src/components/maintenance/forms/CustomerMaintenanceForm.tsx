import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { validateCustomer } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { normalizeCustomer } from '../../../services/normalizers';
import { useI18n } from '../../../i18n/I18nProvider';

interface CustomerMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerMaintenanceForm: React.FC<CustomerMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const addToast = useToastStore((s) => s.addToast);
  const { addCustomer, updateCustomerDetails, deleteCustomer, modalPayload, customers } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeCustomer(rawInitial);

  const handleValidate = (values: Record<string, any>) => {
    const res = validateCustomer(values);
    return res.errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const finalCustomer = normalizeCustomer(values);

      if (mode === 'create') {
        const custId = `cust-${Date.now()}`;
        addCustomer({
          ...finalCustomer,
          id: custId,
        });

        await writeAuditLog({
          actor: 'Admin',
          action: 'CREATE_CUSTOMER',
          entityType: 'customer',
          entityId: custId,
          before: null,
          after: { name: finalCustomer.name, email: finalCustomer.email },
        });

        addToast(`Client dossier created for "${finalCustomer.name}".`, 'success');
      } else {
        const custId = finalCustomer.id;
        const oldCustomer = customers.find((c) => c.id === custId);

        updateCustomerDetails(custId, finalCustomer);

        await writeAuditLog({
          actor: 'Admin',
          action: 'UPDATE_CUSTOMER',
          entityType: 'customer',
          entityId: custId,
          before: oldCustomer ? { name: oldCustomer.name, email: oldCustomer.email } : null,
          after: { name: finalCustomer.name, email: finalCustomer.email },
        });

        addToast(`Client dossier updated for "${finalCustomer.name}".`, 'success');
      }
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Failed to save client dossier.', 'error');
    }
  };

  const handleDelete = async () => {
    if (modalPayload?.id) {
      const custId = modalPayload.id;
      const oldCustomer = customers.find((c) => c.id === custId);

      deleteCustomer(custId);

      await writeAuditLog({
        actor: 'Admin',
        action: 'DELETE_CUSTOMER',
        entityType: 'customer',
        entityId: custId,
        before: oldCustomer ? { name: oldCustomer.name, email: oldCustomer.email } : null,
        after: null,
      });

      addToast('Customer dossier deleted.', 'success');
      onClose();
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'profile',
      label: 'Profile',
      fields: [
        { name: 'name', label: 'Customer Name *', type: 'text', required: true, colSpan: 2 },
        { name: 'email', label: 'Email Address *', type: 'email', required: true, colSpan: 1 },
        { name: 'phone', label: 'Primary Phone', type: 'tel', colSpan: 1 },
        { name: 'secondaryPhone', label: 'Secondary Phone', type: 'tel', colSpan: 1 },
        {
          name: 'preferredContactMethod',
          label: 'Contact Method',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'email', label: 'Email' },
            { value: 'phone', label: 'Phone Call' },
            { value: 'sms', label: 'SMS Text' },
          ],
        },
        {
          name: 'status',
          label: 'Profile Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ],
        },
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
        {
          name: 'loyaltyTier',
          label: 'Loyalty Tier',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'bronze', label: 'Bronze' },
            { value: 'silver', label: 'Silver' },
            { value: 'gold', label: 'Gold' },
            { value: 'platinum', label: 'Platinum' },
          ],
        },
        { name: 'birthday', label: 'Birthday Date', type: 'date', colSpan: 1 },
        { name: 'anniversary', label: 'Anniversary Date', type: 'date', colSpan: 1 },
      ],
    },
    {
      id: 'addresses',
      label: 'Addresses',
      fields: [
        { name: 'billingAddress', label: 'Billing Address', type: 'text', colSpan: 2 },
        { name: 'deliveryAddress', label: 'Default Delivery Address', type: 'text', colSpan: 2 },
        { name: 'city', label: 'City', type: 'text', colSpan: 1 },
        { name: 'state', label: 'State', type: 'text', colSpan: 1 },
        { name: 'zipCode', label: 'ZIP Code', type: 'text', colSpan: 1 },
        { name: 'defaultDeliveryZone', label: 'Delivery Zone', type: 'text', colSpan: 1 },
        { name: 'deliveryInstructions', label: 'Delivery instructions / Safe drop spots', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'sales',
      label: 'Sales / Finance',
      fields: [
        { name: 'lifetimeValue', label: 'Lifetime Value ($)', type: 'display', colSpan: 1 },
        { name: 'totalOrders', label: 'Total Orders', type: 'display', colSpan: 1 },
        { name: 'openBalance', label: 'Open Balance ($)', type: 'number', colSpan: 1 },
        { name: 'creditLimit', label: 'Credit Limit ($)', type: 'number', colSpan: 1 },
        { name: 'paymentTerms', label: 'Payment Terms', type: 'text', colSpan: 1 },
        { name: 'taxExempt', label: 'Tax Exempt Customer', type: 'checkbox', colSpan: 1 },
        { name: 'taxId', label: 'Corporate Tax ID', type: 'text', colSpan: 1 },
        { name: 'preferredPaymentMethod', label: 'Preferred Payment Method', type: 'text', colSpan: 1 },
        { name: 'lastOrderDate', label: 'Last Order Date', type: 'text', readOnly: true, colSpan: 1 },
      ],
    },
    {
      id: 'preferences',
      label: 'Preferences',
      fields: [
        { name: 'favoriteFlowers', label: 'Favorite Flowers', type: 'text', colSpan: 2 },
        { name: 'allergies', label: 'Allergies / Dislikes', type: 'text', colSpan: 2 },
        { name: 'preferredColors', label: 'Preferred Colors', type: 'text', colSpan: 2 },
        { name: 'occasionReminders', label: 'Occasion Reminders Enabled', type: 'checkbox', colSpan: 1 },
        { name: 'marketingOptIn', label: 'Marketing Emails Opt-In', type: 'checkbox', colSpan: 1 },
        { name: 'smsOptIn', label: 'SMS Notifications Opt-In', type: 'checkbox', colSpan: 1 },
        { name: 'notes', label: 'CRM / Arrangement Style preferences', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'audit',
      label: 'Audit Log',
      fields: [
        { name: 'internalNotes', label: 'Internal CRM notes', type: 'textarea', colSpan: 3 },
        { name: 'createdBy', label: 'Created By', type: 'text', readOnly: true, colSpan: 1 },
        { name: 'createdDate', label: 'Created Date', type: 'date', readOnly: true, colSpan: 1 },
        { name: 'lastUpdated', label: 'Last Updated Timestamp', type: 'text', readOnly: true, colSpan: 1 },
        {
          name: 'audit_timeline',
          label: 'Audit Timeline',
          type: 'custom',
          colSpan: 3,
          render: (values) => {
            const auditList = values.auditTrail || [];
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t('maintenance.customerEngagementTimeline')}</label>
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
      title={mode === 'create' ? 'Add CRM Customer' : `Customer Dossier: ${initialValues.name}`}
      subtitle="Track lifetime florist value, addresses, and designer preferences."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={initialValues.status}
      statusBadgeClass={initialValues.status === 'active' ? 'status-delivered' : 'status-draft'}
      validate={handleValidate}
    />
  );
};
