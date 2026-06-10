import React from 'react';
import { MaintenanceModal, type TabConfig } from '../MaintenanceModal';
import { useAdminStore } from '../../../store/adminStore';
import { useToastStore } from '../../../store/toastStore';
import { validateEvent } from '../../../services/validators';
import { writeAuditLog } from '../../../services/auditService';
import { normalizeEvent } from '../../../services/normalizers';

interface EventMaintenanceFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EventMaintenanceForm: React.FC<EventMaintenanceFormProps> = ({ isOpen, onClose }) => {
  const addToast = useToastStore((s) => s.addToast);
  const { addEvent, updateEventDetails, deleteEvent, modalPayload, events } = useAdminStore();

  const mode = modalPayload?.id ? 'edit' : 'create';
  const rawInitial = modalPayload?.id ? modalPayload : {};
  const initialValues = normalizeEvent(rawInitial);

  const handleValidate = (values: Record<string, any>) => {
    const res = validateEvent(values);
    return res.errors;
  };

  const handleSave = async (values: Record<string, any>) => {
    try {
      const finalEvent = normalizeEvent(values);
      const estAmount = finalEvent.estimateAmount ?? 0;
      const depPaid = finalEvent.depositPaid ?? 0;
      finalEvent.budget = estAmount;
      finalEvent.total = estAmount;
      finalEvent.balanceDue = Math.max(0, estAmount - depPaid);

      if (mode === 'create') {
        const eventId = `e-${Date.now()}`;
        addEvent({
          ...finalEvent,
          id: eventId,
        });

        await writeAuditLog({
          actor: 'Admin',
          action: 'CREATE_EVENT',
          entityType: 'event',
          entityId: eventId,
          before: null,
          after: { name: finalEvent.name, budget: finalEvent.estimateAmount },
        });

        addToast(`Logged consultation for event: "${finalEvent.name}".`, 'success');
      } else {
        const eventId = finalEvent.id;
        const oldEvent = events.find((e) => e.id === eventId);

        updateEventDetails(eventId, finalEvent);

        await writeAuditLog({
          actor: 'Admin',
          action: 'UPDATE_EVENT',
          entityType: 'event',
          entityId: eventId,
          before: oldEvent ? { name: oldEvent.name, budget: oldEvent.budget } : null,
          after: { name: finalEvent.name, budget: finalEvent.estimateAmount },
        });

        addToast(`Updated event dossier: "${finalEvent.name}".`, 'success');
      }
      onClose();
    } catch (e) {
      console.error(e);
      addToast('Failed to save event consultation.', 'error');
    }
  };

  const handleDelete = async () => {
    if (modalPayload?.id) {
      const eventId = modalPayload.id;
      const oldEvent = events.find((e) => e.id === eventId);

      deleteEvent(eventId);

      await writeAuditLog({
        actor: 'Admin',
        action: 'DELETE_EVENT',
        entityType: 'event',
        entityId: eventId,
        before: oldEvent ? { name: oldEvent.name, budget: oldEvent.budget } : null,
        after: null,
      });

      addToast('Event dossier deleted.', 'success');
      onClose();
    }
  };

  const tabs: TabConfig[] = [
    {
      id: 'overview',
      label: 'Event Overview',
      fields: [
        { name: 'name', label: 'Event Name *', type: 'text', required: true, colSpan: 2 },
        { name: 'client', label: 'Client Contact Name *', type: 'text', required: true, colSpan: 1 },
        {
          name: 'type',
          label: 'Event Type',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'Wedding', label: 'Wedding' },
            { value: 'Corporate', label: 'Corporate' },
            { value: 'Birthday', label: 'Birthday' },
            { value: 'Private', label: 'Private Gala' },
          ],
        },
        { name: 'date', label: 'Event Date *', type: 'date', required: true, colSpan: 1 },
        {
          name: 'status',
          label: 'Consultation Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'planning', label: 'Planning & Quoting' },
            { value: 'confirmed', label: 'Deposit Paid (Confirmed)' },
            { value: 'preparing', label: 'Stems Ordered' },
            { value: 'completed', label: 'Completed' },
          ],
        },
        { name: 'startTime', label: 'Start Time', type: 'text', colSpan: 1 },
        { name: 'endTime', label: 'End Time', type: 'text', colSpan: 1 },
        { name: 'venue', label: 'Venue Destination', type: 'text', colSpan: 1 },
        { name: 'coordinator', label: 'Lead Coordinator', type: 'text', colSpan: 1 },
        {
          name: 'priority',
          label: 'Priority',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'normal', label: 'Normal' },
            { value: 'high', label: 'High Priority' },
            { value: 'vip', label: 'VIP Gala' },
          ],
        },
      ],
    },
    {
      id: 'client',
      label: 'Client / Venue Details',
      fields: [
        { name: 'clientContact', label: 'Alternative Client Contact', type: 'text', colSpan: 1 },
        { name: 'phone', label: 'Client Phone', type: 'tel', colSpan: 1 },
        { name: 'email', label: 'Client Email', type: 'email', colSpan: 1 },
        { name: 'venueAddress', label: 'Venue Street Address', type: 'text', colSpan: 2 },
        { name: 'venueContact', label: 'On-site Venue Contact', type: 'text', colSpan: 1 },
        { name: 'setupAccessTime', label: 'Setup Access Time Window', type: 'text', colSpan: 1 },
        { name: 'parkingNotes', label: 'Parking & Loading Dock Notes', type: 'text', colSpan: 1 },
        { name: 'specialRestrictions', label: 'Special Restrictions (e.g. no open flame)', type: 'text', colSpan: 1 },
      ],
    },
    {
      id: 'floral',
      label: 'Floral Plan',
      fields: [
        { name: 'bridalBouquetCount', label: 'Bridal Bouquets Qty', type: 'number', colSpan: 1 },
        { name: 'centerpieceCount', label: 'Table Centerpieces Qty', type: 'number', colSpan: 1 },
        { name: 'ceremonyArrangements', label: 'Ceremony / Arch arrangements description', type: 'text', colSpan: 2 },
        { name: 'receptionArrangements', label: 'Reception arrangements description', type: 'text', colSpan: 2 },
        { name: 'colorPalette', label: 'Aesthetics Color Palette', type: 'text', colSpan: 1 },
        { name: 'flowerPreferences', label: 'Flower Type Preferences (comma separated)', type: 'text', colSpan: 2 },
        { name: 'rentalItems', label: 'Rental Items (vases, stands, arches)', type: 'text', colSpan: 2 },
        { name: 'designerNotes', label: 'Lead Designer Floral Recipe Instructions', type: 'textarea', colSpan: 3 },
      ],
    },
    {
      id: 'financials',
      label: 'Financials',
      fields: [
        { name: 'estimateAmount', label: 'Total Estimate Amount ($) *', type: 'number', required: true, colSpan: 1 },
        { name: 'depositRequired', label: 'Deposit Required ($)', type: 'number', colSpan: 1 },
        { name: 'depositPaid', label: 'Deposit Paid ($)', type: 'number', colSpan: 1 },
        { name: 'balanceDue', label: 'Balance Due ($)', type: 'display', colSpan: 1 },
        {
          name: 'paymentStatus',
          label: 'Payment Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'unpaid', label: 'Unpaid' },
            { value: 'deposit_paid', label: 'Deposit Paid' },
            { value: 'paid', label: 'Fully Settled' },
          ],
        },
        { name: 'invoiceNumber', label: 'Invoice Reference', type: 'text', colSpan: 1 },
        {
          name: 'contractStatus',
          label: 'Contract Status',
          type: 'select',
          colSpan: 1,
          options: [
            { value: 'draft', label: 'Draft Proposal' },
            { value: 'sent', label: 'Sent to Client' },
            { value: 'signed', label: 'Signed Contract' },
            { value: 'cancelled', label: 'Voided Proposal' },
          ],
        },
        { name: 'marginEstimate', label: 'Margin Estimate ($)', type: 'number', colSpan: 1 },
      ],
    },
    {
      id: 'logistics',
      label: 'Logistics',
      fields: [
        { name: 'deliveryDate', label: 'Delivery Dispatch Date', type: 'date', colSpan: 1 },
        { name: 'deliveryTime', label: 'Delivery Target Time', type: 'text', colSpan: 1 },
        { name: 'setupCrew', label: 'Setup Crew Members (comma separated)', type: 'text', colSpan: 1 },
        { name: 'breakdownCrew', label: 'Breakdown Crew Members (comma separated)', type: 'text', colSpan: 1 },
        { name: 'truckRoute', label: 'Assigned Truck / Route', type: 'text', colSpan: 1 },
        { name: 'checklist', label: 'Logistics Verification Checklist (comma separated)', type: 'text', colSpan: 2 },
        { name: 'riskNotes', label: 'Weather / Timing Logistics Risks', type: 'textarea', colSpan: 3 },
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
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Event Operations Timeline</label>
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
      title={mode === 'create' ? 'Log Event Consultation' : `Event Dossier: ${initialValues.name}`}
      subtitle="Coordinate large artisan wedding contracts and corporate floral accounts."
      mode={mode}
      initialValues={initialValues}
      tabs={tabs}
      statusBadgeText={initialValues.status}
      statusBadgeClass={initialValues.status === 'confirmed' ? 'status-delivered' : 'status-draft'}
      validate={handleValidate}
    />
  );
};
