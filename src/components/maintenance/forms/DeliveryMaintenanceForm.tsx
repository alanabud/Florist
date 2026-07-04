import React, { useState, useEffect } from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { validateDelivery } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { normalizeOrder } from '../../../services/normalizers';
import { useI18n } from '../../../i18n/I18nProvider';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase/config';
import { useCompany } from '../../../context/CompanyContext';

interface DeliveryMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeliveryMaintenanceForm: React.FC<DeliveryMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const { t } = useI18n();
  const addToast = useToastStore((s) => s.addToast);
  const { orders, updateOrderDetails, modalPayload } = useAdminStore();
  const { selectedCompanyId, memberships } = useCompany();

  const [deliveryRecord, setDeliveryRecord] = useState<any>(null);

  const currentMember = memberships.find((m) => m.companyId === selectedCompanyId);
  const userRole = currentMember?.role || 'viewer';
  const isDriver = userRole === 'driver';

  useEffect(() => {
    if (isOpen && modalPayload?.id) {
      const getDelivery = async () => {
        try {
          const docRef = doc(db, 'deliveries', modalPayload.id);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            setDeliveryRecord(snap.data());
          } else {
            setDeliveryRecord(null);
          }
        } catch (e) {
          console.error(e);
        }
      };
      getDelivery();
    } else {
      setDeliveryRecord(null);
    }
  }, [isOpen, modalPayload]);

  const mode = modalPayload?.id ? 'edit' : 'create';
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeOrder(rawInitial);

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
        
        dispatchTime: values.dispatchTime,
        deliveredTime: values.deliveredTime,
        deliveryAttemptCount: parseInt(values.deliveryAttemptCount) || 0,
        failedReason: values.failedReason,
        redeliveryRequired: !!values.redeliveryRequired,
        driverNotes: values.driverNotes,
        customerDeliveryNotes: values.customerDeliveryNotes,
        
        proofOfDelivery: values.proofOfDelivery,
        deliveryPhotoUrl: values.deliveryPhotoUrl,
      };

      await updateOrderDetails(orderId, updates);

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
            { value: 'Julian V.', label: 'Julian V. (Uber Mock)' },
            { value: 'Local Courier', label: 'Manual Courier' }
          ],
        },
        { name: 'routeNumber', label: 'Route number', type: 'text', colSpan: 1 },
        { name: 'dispatchTime', label: 'Dispatch Timestamp', type: 'text', colSpan: 1 },
        { name: 'deliveredTime', label: 'Delivered Timestamp', type: 'text', colSpan: 1 },
        { name: 'deliveryAttemptCount', label: 'Delivery Attempt Count', type: 'number', colSpan: 1 },
        {
          name: 'dispatch_details',
          label: 'Third-Party Dispatch Operational Data',
          type: 'custom',
          colSpan: 3,
          render: () => {
            if (!deliveryRecord) return null;
            const token = deliveryRecord.providerMetadata?.publicTrackingToken;

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem', padding: '1rem', background: '#FAFAF8', borderRadius: '12px', border: '1px solid #E8EAE6' }}>
                <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0 }}>{t('delivery.dispatchHub.logisticsDispatchDetails')}</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                  <div>
                    <span style={{ color: '#8a8f8c', fontWeight: 600 }}>Provider:</span> {t(`delivery.provider.${deliveryRecord.provider}`)}
                  </div>
                  <div>
                    <span style={{ color: '#8a8f8c', fontWeight: 600 }}>Status:</span> {deliveryRecord.status}
                  </div>
                  {token && (
                    <div style={{ gridColumn: 'span 2' }}>
                      <span style={{ color: '#8a8f8c', fontWeight: 600 }}>Public Tracking Link:</span>{' '}
                      <a href={`/track-delivery/${token}`} target="_blank" rel="noopener noreferrer" style={{ color: '#4A6B50', fontWeight: 600 }}>
                        /track-delivery/{token}
                      </a>
                    </div>
                  )}
                </div>

                {!isDriver && (
                  <div style={{ borderTop: '1px dashed #E8EAE6', paddingTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
                    <div>
                      <span style={{ color: '#8a8f8c', fontWeight: 600 }}>Collected Fee:</span> ${deliveryRecord.quote?.customerDeliveryCharge?.toFixed(2) || '0.00'}
                    </div>
                    <div>
                      <span style={{ color: '#8a8f8c', fontWeight: 600 }}>Provider Cost:</span> ${deliveryRecord.quote?.estimatedProviderCost?.toFixed(2) || '0.00'}
                    </div>
                    <div>
                      <span style={{ color: '#8a8f8c', fontWeight: 600 }}>Margin:</span>{' '}
                      <span style={{ fontWeight: 600, color: (deliveryRecord.quote?.customerDeliveryCharge - deliveryRecord.quote?.estimatedProviderCost) >= 0 ? '#10B981' : '#EF4444' }}>
                        ${(deliveryRecord.quote?.customerDeliveryCharge - deliveryRecord.quote?.estimatedProviderCost).toFixed(2) || '0.00'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          }
        }
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
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t('maintenance.logisticsAuditTimeline')}</label>
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
