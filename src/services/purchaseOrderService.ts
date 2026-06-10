import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore, type PurchaseOrder, type PurchaseOrderLine } from '../store/adminStore';
import { getNextSequenceNumber } from './sequenceService';
import { writeAuditLog } from './auditService';

const PO_COLLECTION = 'purchaseOrders';

/**
 * Calculates totals for a PO based on its lines and additional costs.
 */
export function calculatePOTotals(
  lines: PurchaseOrderLine[],
  taxAmount: number = 0,
  freightAmount: number = 0,
  discountAmount: number = 0
) {
  const processedLines = lines.map(line => ({
    ...line,
    lineTotal: Math.round((line.quantityOrdered * line.unitCost) * 100) / 100,
    quantityReceived: line.quantityReceived || 0,
    quantityBilled: line.quantityBilled || 0,
  }));

  const subtotal = processedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  const totalCost = Math.round((subtotal + taxAmount + freightAmount - discountAmount) * 100) / 100;

  return {
    lines: processedLines,
    subtotal: Math.round(subtotal * 100) / 100,
    totalCost,
  };
}

/**
 * Create a new Purchase Order in draft status.
 */
export async function createPurchaseOrder(
  poData: Omit<PurchaseOrder, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'subtotal' | 'totalCost'>,
  actor: string = 'Admin'
): Promise<PurchaseOrder> {
  const sequenceId = await getNextSequenceNumber('purchaseOrders');
  const now = new Date().toISOString();

  const { lines, subtotal, totalCost } = calculatePOTotals(
    poData.lines,
    poData.taxAmount,
    poData.freightAmount,
    poData.discountAmount
  );

  const newPO: PurchaseOrder = {
    ...poData,
    id: sequenceId,
    lines,
    subtotal,
    totalCost,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const docRef = doc(db, PO_COLLECTION, sequenceId);
  await setDoc(docRef, newPO);

  await writeAuditLog({
    actor,
    action: 'CREATE_PURCHASE_ORDER',
    entityType: 'purchase_order',
    entityId: sequenceId,
    before: null,
    after: { totalCost, vendorName: poData.vendorName },
  });

  // Sync to local Zustand store
  useAdminStore.getState().addPurchaseOrder(newPO);

  return newPO;
}

/**
 * Update an existing draft Purchase Order.
 */
export async function updatePurchaseOrder(
  id: string,
  updates: Partial<Omit<PurchaseOrder, 'id' | 'createdAt' | 'updatedAt'>>,
  actor: string = 'Admin'
): Promise<void> {
  const poRef = doc(db, PO_COLLECTION, id);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) {
    throw new Error(`Purchase Order ${id} not found.`);
  }

  const currentPO = poSnap.data() as PurchaseOrder;

  if (currentPO.status !== 'draft') {
    throw new Error(`Cannot modify an approved, ordered, or closed Purchase Order.`);
  }

  const now = new Date().toISOString();
  
  // Merge lines and other cost inputs for totals calculation
  const lines = updates.lines || currentPO.lines;
  const taxAmount = updates.taxAmount !== undefined ? updates.taxAmount : currentPO.taxAmount;
  const freightAmount = updates.freightAmount !== undefined ? updates.freightAmount : currentPO.freightAmount;
  const discountAmount = updates.discountAmount !== undefined ? updates.discountAmount : currentPO.discountAmount;

  const totals = calculatePOTotals(lines, taxAmount, freightAmount, discountAmount);

  const cleanUpdates = {
    ...updates,
    lines: totals.lines,
    subtotal: totals.subtotal,
    totalCost: totals.totalCost,
    updatedAt: now,
  };

  await updateDoc(poRef, cleanUpdates);

  await writeAuditLog({
    actor,
    action: 'UPDATE_PURCHASE_ORDER',
    entityType: 'purchase_order',
    entityId: id,
    before: currentPO,
    after: cleanUpdates,
  });

  // Sync to local store
  useAdminStore.getState().updatePurchaseOrderDetails(id, cleanUpdates);
}

/**
 * Approve and place the Purchase Order.
 */
export async function approvePurchaseOrder(id: string, actor: string = 'Admin'): Promise<void> {
  const poRef = doc(db, PO_COLLECTION, id);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) {
    throw new Error(`Purchase Order ${id} not found.`);
  }

  const currentPO = poSnap.data() as PurchaseOrder;

  if (currentPO.status !== 'draft') {
    throw new Error(`Only draft Purchase Orders can be approved.`);
  }

  const now = new Date().toISOString();
  const updates: Partial<PurchaseOrder> = {
    status: 'ordered',
    approvedAt: now,
    approvedBy: actor,
    updatedAt: now,
  };

  await updateDoc(poRef, updates);

  await writeAuditLog({
    actor,
    action: 'APPROVE_PURCHASE_ORDER',
    entityType: 'purchase_order',
    entityId: id,
    before: { status: currentPO.status },
    after: { status: 'ordered', approvedBy: actor },
  });

  // Sync to local store
  useAdminStore.getState().updatePurchaseOrderDetails(id, updates);
}

/**
 * Cancel a Purchase Order.
 */
export async function cancelPurchaseOrder(id: string, actor: string = 'Admin'): Promise<void> {
  const poRef = doc(db, PO_COLLECTION, id);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) {
    throw new Error(`Purchase Order ${id} not found.`);
  }

  const currentPO = poSnap.data() as PurchaseOrder;

  if (currentPO.status === 'cancelled') {
    throw new Error('Purchase Order is already cancelled.');
  }

  // Check if any goods have been received
  const hasReceived = currentPO.lines.some(l => (l.quantityReceived || 0) > 0);
  if (hasReceived) {
    throw new Error('Cannot cancel a Purchase Order that has already received inventory.');
  }

  const now = new Date().toISOString();
  const updates: Partial<PurchaseOrder> = {
    status: 'cancelled',
    updatedAt: now,
  };

  await updateDoc(poRef, updates);

  await writeAuditLog({
    actor,
    action: 'CANCEL_PURCHASE_ORDER',
    entityType: 'purchase_order',
    entityId: id,
    before: { status: currentPO.status },
    after: { status: 'cancelled' },
  });

  // Sync to local store
  useAdminStore.getState().updatePurchaseOrderDetails(id, updates);
}
