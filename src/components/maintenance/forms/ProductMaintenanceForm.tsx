import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { validateProduct } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { normalizeProduct } from '../../../services/normalizers';
import { useI18n } from '../../../i18n/I18nProvider';

interface ProductMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductMaintenanceForm: React.FC<ProductMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const addToast = useToastStore((s) => s.addToast);
  const { addProduct, updateProductDetails, deleteProduct, modalPayload, products } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeProduct(rawInitial);

  const handleValidate = (values: Record<string, any>) => {
    const res = validateProduct(values);
    return res.errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const finalProduct = normalizeProduct(values);
      const cost = parseFloat(finalProduct.cost as any) || 0;
      const basePrice = parseFloat(finalProduct.basePrice as any) || 0;
      finalProduct.marginPercent = basePrice > 0 ? Math.round(((basePrice - cost) / basePrice) * 10000) / 100 : 0;
      finalProduct.price = basePrice;

      if (mode === 'create') {
        const prodId = `p-${Date.now()}`;
        addProduct({
          ...finalProduct,
          id: prodId,
        });

        await writeAuditLog({
          actor: 'Admin',
          action: 'CREATE_PRODUCT',
          entityType: 'product',
          entityId: prodId,
          before: null,
          after: { name: finalProduct.name, price: finalProduct.basePrice },
        });

        addToast(`Product catalog item "${finalProduct.name}" created.`, 'success');
      } else {
        const prodId = finalProduct.id;
        const oldProduct = products.find((p) => p.id === prodId);

        updateProductDetails(prodId, finalProduct);

        await writeAuditLog({
          actor: 'Admin',
          action: 'UPDATE_PRODUCT',
          entityType: 'product',
          entityId: prodId,
          before: oldProduct ? { name: oldProduct.name, price: oldProduct.price } : null,
          after: { name: finalProduct.name, price: finalProduct.basePrice },
        });

        addToast(`Product catalog item "${finalProduct.name}" updated.`, 'success');
      }
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Failed to save product details.', 'error');
    }
  };

  const handleDelete = async () => {
    if (modalPayload?.id) {
      const prodId = modalPayload.id;
      const oldProduct = products.find((p) => p.id === prodId);

      deleteProduct(prodId);

      await writeAuditLog({
        actor: 'Admin',
        action: 'DELETE_PRODUCT',
        entityType: 'product',
        entityId: prodId,
        before: oldProduct ? { name: oldProduct.name, price: oldProduct.price } : null,
        after: null,
      });

      addToast('Product catalog item deleted.', 'success');
      onClose();
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'details',
      label: 'Product Details',
      fields: [
        { name: 'name', label: 'Product Name *', type: 'text', required: true, colSpan: 2 },
        { name: 'sku', label: 'SKU *', type: 'text', required: true, colSpan: 1 },
        {
          name: 'category',
          label: 'Category',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Roses', label: 'Roses' },
            { value: 'Seasonal', label: 'Seasonal' },
            { value: 'Sympathy', label: 'Sympathy' },
            { value: 'Birthday', label: 'Birthday' },
            { value: 'Romance', label: 'Romance' },
            { value: 'Wedding', label: 'Wedding' },
            { value: 'Thank You', label: 'Thank You' },
            { value: 'Luxury', label: 'Luxury' },
            { value: 'Plants', label: 'Plants' },
            { value: 'Custom', label: 'Custom' },
          ],
        },
        { name: 'collection', label: 'Collection Name', type: 'text', colSpan: 1 },
        { name: 'occasion', label: 'Occasion', type: 'text', colSpan: 1 },
        { name: 'description', label: 'Full Description', type: 'textarea', colSpan: 3 },
        { name: 'shortDescription', label: 'Short Description', type: 'text', colSpan: 2 },
        {
          name: 'productStatus',
          label: 'Product Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'active', label: 'Active' },
            { value: 'draft', label: 'Draft' },
            { value: 'archived', label: 'Archived' },
          ],
        },
        { name: 'featuredProduct', label: 'Featured Product', type: 'checkbox', colSpan: 1 },
        { name: 'seasonalProduct', label: 'Seasonal Product', type: 'checkbox', colSpan: 1 },
        { name: 'tags', label: 'Tags (comma separated)', type: 'text', colSpan: 1 },
      ],
    },
    {
      id: 'pricing',
      label: 'Pricing',
      fields: [
        { name: 'basePrice', label: 'Base Price ($) *', type: 'number', required: true, colSpan: 1 },
        { name: 'salePrice', label: 'Sale Price ($)', type: 'number', colSpan: 1 },
        { name: 'cost', label: 'Material Cost ($)', type: 'number', colSpan: 1 },
        { name: 'marginPercent', label: 'Margin %', type: 'display', colSpan: 1 },
        { name: 'taxable', label: 'Taxable Product', type: 'checkbox', colSpan: 1 },
        { name: 'taxCategory', label: 'Tax Category', type: 'text', colSpan: 1 },
        { name: 'deliveryEligible', label: 'Eligible for Delivery', type: 'checkbox', colSpan: 1 },
        { name: 'subscriptionEligible', label: 'Eligible for Subscription', type: 'checkbox', colSpan: 1 },
      ],
    },
    {
      id: 'inventory',
      label: 'Inventory Bounds',
      fields: [
        { name: 'stockQuantity', label: 'Stock Quantity', type: 'number', colSpan: 1 },
        { name: 'reorderPoint', label: 'Reorder Point', type: 'number', colSpan: 1 },
        { name: 'preferredSupplier', label: 'Preferred Supplier', type: 'text', colSpan: 1 },
        { name: 'leadTimeDays', label: 'Lead Time (Days)', type: 'number', colSpan: 1 },
        { name: 'unitOfMeasure', label: 'Unit of Measure', type: 'text', colSpan: 1 },
        { name: 'storageLocation', label: 'Storage Location', type: 'text', colSpan: 1 },
        { name: 'shelfLifeDays', label: 'Shelf Life (Days)', type: 'number', colSpan: 1 },
        { name: 'substitutionProduct', label: 'Substitution Product (SKU)', type: 'text', colSpan: 1 },
      ],
    },
    {
      id: 'media',
      label: 'Media / Storefront',
      fields: [
        { name: 'imageUrl', label: 'Main Image URL', type: 'text', colSpan: 2 },
        { name: 'productBadge', label: 'Storefront Badge (e.g. NEW)', type: 'text', colSpan: 1 },
        { name: 'storefrontVisibility', label: 'Visible on Storefront', type: 'checkbox', colSpan: 1 },
        { name: 'displayOrder', label: 'Display Order Sequence', type: 'number', colSpan: 1 },
        { name: 'seoTitle', label: 'SEO Title Meta', type: 'text', colSpan: 1 },
        { name: 'seoDescription', label: 'SEO Description Meta', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'audit',
      label: 'Audit Log',
      fields: [
        { name: 'internalNotes', label: 'Internal Arranger Notes', type: 'textarea', colSpan: 3 },
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
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t('maintenance.productAuditHistory')}</label>
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
      title={mode === 'create' ? 'Create Catalog Product' : `Product Console: ${initialValues.name}`}
      subtitle="Handcraft bouquet offerings, pricing matrices, and display media."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={initialValues.productStatus}
      statusBadgeClass={initialValues.productStatus === 'active' ? 'status-delivered' : 'status-draft'}
      validate={handleValidate}
    />
  );
};
