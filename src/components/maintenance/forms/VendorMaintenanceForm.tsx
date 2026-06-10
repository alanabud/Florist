import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore, type Vendor } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { createVendor, updateVendor } from '../../../services/vendorService';

interface VendorMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VendorMaintenanceForm: React.FC<VendorMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { modalPayload } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';
  const initialValues = modalPayload?.id
    ? (modalPayload as Vendor)
    : {
        name: '',
        contactName: '',
        email: '',
        phone: '',
        billingAddress: '',
        paymentTerms: 'Net 30',
        taxId: '',
        active: true,
        defaultGlAccount: '5200', // Supplies Expense default
        defaultPaymentMethod: 'check',
        notes: '',
        balance: 0,
        openBillsCount: 0,
      };

  const handleValidate = (values: Record<string, any>) => {
    const errors: Record<string, string> = {};
    if (!values.name?.trim()) {
      errors.name = 'Vendor Name is required';
    }
    if (!values.email?.trim()) {
      errors.email = 'Email Address is required';
    }
    return errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      if (mode === 'create') {
        const vendorData = {
          name: values.name,
          contactName: values.contactName || '',
          email: values.email,
          phone: values.phone || '',
          billingAddress: values.billingAddress || '',
          paymentTerms: values.paymentTerms || 'Net 30',
          taxId: values.taxId || '',
          active: values.active !== false,
          defaultGlAccount: values.defaultGlAccount || '5200',
          defaultPaymentMethod: values.defaultPaymentMethod || 'check',
          notes: values.notes || '',
        };

        const newVendor = await createVendor(vendorData);
        addToast(`Vendor profile created for "${newVendor.name}" (${newVendor.id}).`, 'success');
      } else {
        const vendorId = values.id;
        const vendorData = {
          name: values.name,
          contactName: values.contactName || '',
          email: values.email,
          phone: values.phone || '',
          billingAddress: values.billingAddress || '',
          paymentTerms: values.paymentTerms || 'Net 30',
          taxId: values.taxId || '',
          active: values.active !== false,
          defaultGlAccount: values.defaultGlAccount || '5200',
          defaultPaymentMethod: values.defaultPaymentMethod || 'check',
          notes: values.notes || '',
        };

        await updateVendor(vendorId, vendorData);
        addToast(`Vendor profile updated for "${values.name}".`, 'success');
      }
      onClose();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || 'Failed to save vendor profile.', 'error');
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'profile',
      label: 'Profile',
      fields: [
        { name: 'name', label: 'Vendor Name *', type: 'text', required: true, colSpan: 2 },
        { name: 'contactName', label: 'Contact Person Name', type: 'text', colSpan: 1 },
        { name: 'email', label: 'Email Address *', type: 'email', required: true, colSpan: 1 },
        { name: 'phone', label: 'Primary Phone', type: 'tel', colSpan: 1 },
        { name: 'taxId', label: 'Tax ID / EIN', type: 'text', colSpan: 1 },
        {
          name: 'active',
          label: 'Active Status',
          type: 'checkbox',
          colSpan: 1,
        },
      ],
    },
    {
      id: 'accounting',
      label: 'Accounting & Terms',
      fields: [
        { name: 'billingAddress', label: 'Billing Address', type: 'textarea', colSpan: 3 },
        {
          name: 'paymentTerms',
          label: 'Payment Terms',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Due on Receipt', label: 'Due on Receipt' },
            { value: 'Net 15', label: 'Net 15 (15 Days)' },
            { value: 'Net 30', label: 'Net 30 (30 Days)' },
            { value: 'Net 45', label: 'Net 45 (45 Days)' },
            { value: 'Net 60', label: 'Net 60 (60 Days)' },
          ],
        },
        {
          name: 'defaultPaymentMethod',
          label: 'Default Payment Method',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'check', label: 'Check' },
            { value: 'cash', label: 'Cash' },
            { value: 'bank_transfer', label: 'Bank Transfer' },
            { value: 'credit_card', label: 'Credit Card' },
            { value: 'other', label: 'Other / Custom' },
          ],
        },
        {
          name: 'defaultGlAccount',
          label: 'Default GL Expense Account',
          type: 'select',
          colSpan: 1,
          options: [
            { value: '5200', label: '5200 — Supplies Expense' },
            { value: '5300', label: '5300 — Freight-In' },
            { value: '5000', label: '5000 — Operating Expense' },
          ],
        },
      ],
    },
    {
      id: 'financials',
      label: 'Balances',
      fields: [
        { name: 'balance', label: 'Total Open Payables ($)', type: 'display', colSpan: 1 },
        { name: 'openBillsCount', label: 'Open Bills Count', type: 'display', colSpan: 1 },
        { name: 'lastPaymentDate', label: 'Last Payment Date', type: 'display', colSpan: 1 },
      ],
    },
    {
      id: 'notes',
      label: 'Notes',
      fields: [
        { name: 'notes', label: 'Vendor Notes & Agreement Details', type: 'textarea', colSpan: 3 },
      ],
    },
  ];

  return (
    <MaintenanceModal
      isOpen={isOpen}
      onClose={onClose}
      onSave={handleSave}
      title={mode === 'create' ? 'Add New Vendor' : `Vendor Dossier: ${initialValues.name}`}
      subtitle="Track purchasing terms, balances, and contact details."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={initialValues.active ? 'active' : 'inactive'}
      statusBadgeClass={initialValues.active ? 'status-delivered' : 'status-draft'}
      validate={handleValidate}
    />
  );
};
