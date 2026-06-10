import { collection, doc, setDoc, updateDoc, getDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore, type InventoryReceipt, type InventoryReceiptLine, type PurchaseOrder, type InventoryItem, type InventoryTransaction } from '../store/adminStore';
import { getNextSequenceNumber } from './sequenceService';
import { writeAuditLog } from './auditService';
import { postJournalEntry, type JournalLine, type JournalEntry } from './financeService';

const RECEIPTS_COLLECTION = 'inventoryReceipts';
const PO_COLLECTION = 'purchaseOrders';
const INVENTORY_COLLECTION = 'inventory';
const TRANSACTIONS_COLLECTION = 'inventoryTransactions';

/**
 * Receives items against a Purchase Order.
 * Handles accepted/damaged/rejected inventory, WAC recalculation, and GRNI GL posting.
 */
export async function receivePurchaseOrder(
  receiptData: {
    poId: string;
    receiptDate: string;
    freightAmount: number;
    freightTreatment: 'capitalize' | 'expense';
    lines: {
      itemId: string;
      sku: string;
      quantityReceived: number;
      quantityDamaged: number;
      quantityRejected: number;
      unitCost: number;
    }[];
    notes?: string;
  },
  actor: string = 'Admin'
): Promise<InventoryReceipt> {
  const poRef = doc(db, PO_COLLECTION, receiptData.poId);
  const poSnap = await getDoc(poRef);
  if (!poSnap.exists()) {
    throw new Error(`Purchase Order ${receiptData.poId} not found.`);
  }
  const currentPO = poSnap.data() as PurchaseOrder;

  if (currentPO.status === 'cancelled' || currentPO.status === 'closed') {
    throw new Error(`Cannot receive items against a ${currentPO.status} Purchase Order.`);
  }

  const receiptId = await getNextSequenceNumber('inventoryReceipts');
  const now = new Date().toISOString();

  // 1. Calculate accepted quantities and allocate freight if capitalized
  const processedLines: InventoryReceiptLine[] = [];
  let totalAcceptedCost = 0;
  let totalAcceptedQty = 0;

  for (const line of receiptData.lines) {
    const acceptedQty = line.quantityReceived - line.quantityDamaged - line.quantityRejected;
    const lineTotal = acceptedQty * line.unitCost;
    
    processedLines.push({
      itemId: line.itemId,
      sku: line.sku,
      quantityReceived: line.quantityReceived,
      quantityDamaged: line.quantityDamaged,
      quantityRejected: line.quantityRejected,
      quantityAccepted: acceptedQty,
      unitCost: line.unitCost,
    });

    if (acceptedQty > 0) {
      totalAcceptedCost += lineTotal;
      totalAcceptedQty += acceptedQty;
    }
  }

  // Calculate Net Received Unit Cost per item for WAC
  const linesWithNetCost = processedLines.map(line => {
    let allocatedFreight = 0;
    if (receiptData.freightTreatment === 'capitalize' && receiptData.freightAmount > 0 && line.quantityAccepted > 0) {
      if (totalAcceptedCost > 0) {
        allocatedFreight = ((line.quantityAccepted * line.unitCost) / totalAcceptedCost) * receiptData.freightAmount;
      } else {
        allocatedFreight = (line.quantityAccepted / totalAcceptedQty) * receiptData.freightAmount;
      }
    }
    const unitFreight = line.quantityAccepted > 0 ? (allocatedFreight / line.quantityAccepted) : 0;
    return {
      ...line,
      netReceivedUnitCost: line.unitCost + unitFreight,
    };
  });

  // 2. Perform Inventory Updates (Recalculate Weighted-Average Cost)
  // Fetch active inventory from Firestore/store to update counts
  for (const line of linesWithNetCost) {
    if (line.quantityAccepted <= 0) continue;

    const itemRef = doc(db, INVENTORY_COLLECTION, line.itemId);
    const itemSnap = await getDoc(itemRef);
    if (itemSnap.exists()) {
      const itemData = itemSnap.data() as InventoryItem;
      const currentQty = itemData.quantity || 0;
      const currentCost = itemData.unitCost || 0;
      const newQty = currentQty + line.quantityAccepted;

      // WAC Algorithm: (Q_curr * C_curr + Q_new * C_net_new) / (Q_curr + Q_new)
      const newCost = newQty > 0 ? ((currentQty * currentCost) + (line.quantityAccepted * line.netReceivedUnitCost)) / newQty : 0;

      const itemUpdates: Partial<InventoryItem> = {
        quantity: newQty,
        unitCost: Math.round(newCost * 10000) / 10000, // keep high precision for WAC
        lastPurchaseCost: line.unitCost,
        lastRestockDate: receiptData.receiptDate,
        updatedBy: actor,
      };

      await updateDoc(itemRef, itemUpdates);
      
      // Update local store
      useAdminStore.getState().updateInventoryItem(line.itemId, itemUpdates);
    }
  }

  // 3. Write Inventory Transactions log
  for (const line of processedLines) {
    if (line.quantityReceived <= 0) continue;

    const txRef = collection(db, TRANSACTIONS_COLLECTION);
    const newTx: Omit<InventoryTransaction, 'id'> = {
      type: 'purchase_receipt',
      itemId: line.itemId,
      sku: line.sku,
      quantityIn: line.quantityAccepted,
      quantityOut: 0,
      unitCost: line.unitCost,
      location: currentPO.location || 'Main Warehouse',
      sourceReference: receiptId,
      notes: `Received from PO ${currentPO.id}. Damaged: ${line.quantityDamaged}, Rejected: ${line.quantityRejected}`,
      createdAt: now,
      createdBy: actor,
    };
    
    await addDoc(txRef, newTx);
  }

  // 4. Update PO line quantityReceived and overall status
  const updatedPOLines = currentPO.lines.map(poLine => {
    const receiptLine = processedLines.find(rl => rl.sku === poLine.sku);
    if (receiptLine) {
      const quantityReceived = (poLine.quantityReceived || 0) + receiptLine.quantityAccepted;
      return {
        ...poLine,
        quantityReceived,
      };
    }
    return poLine;
  });

  // Determine PO status
  let allReceived = true;
  let partialReceived = false;

  for (const line of updatedPOLines) {
    if (line.quantityReceived < line.quantityOrdered) {
      allReceived = false;
    }
    if (line.quantityReceived > 0) {
      partialReceived = true;
    }
  }

  const newPOStatus = allReceived ? 'received' : (partialReceived ? 'partially_received' : currentPO.status);

  await updateDoc(poRef, {
    lines: updatedPOLines,
    status: newPOStatus,
    updatedAt: now,
  });

  useAdminStore.getState().updatePurchaseOrderDetails(currentPO.id, {
    lines: updatedPOLines,
    status: newPOStatus,
    updatedAt: now,
  });

  // 5. Post to GL (Accrued Purchases GRNI model)
  // Debit 1300 Inventory: total accepted cost + capitalized freight
  // Debit 5300 Freight-In (Expense): if expensed
  // Credit 2050 Accrued Purchases: total accepted cost + freightAmount
  const glLines: JournalLine[] = [];
  const costOfAcceptedGoods = processedLines.reduce((sum, line) => sum + (line.quantityAccepted * line.unitCost), 0);
  const totalReceivedValue = costOfAcceptedGoods + receiptData.freightAmount;

  if (totalReceivedValue > 0) {
    const inventoryDebit = costOfAcceptedGoods + (receiptData.freightTreatment === 'capitalize' ? receiptData.freightAmount : 0);
    const freightExpenseDebit = receiptData.freightTreatment === 'expense' ? receiptData.freightAmount : 0;

    if (inventoryDebit > 0) {
      glLines.push({
        account: 'Inventory',
        accountId: '',
        accountName: 'Inventory',
        debit: Math.round(inventoryDebit * 100) / 100,
        credit: 0,
      });
    }

    if (freightExpenseDebit > 0) {
      glLines.push({
        account: 'Freight-In',
        accountId: '',
        accountName: 'Freight-In',
        debit: Math.round(freightExpenseDebit * 100) / 100,
        credit: 0,
      });
    }

    glLines.push({
      account: 'Accrued Purchases / GRNI',
      accountId: '',
      accountName: 'Accrued Purchases / GRNI',
      debit: 0,
      credit: Math.round(totalReceivedValue * 100) / 100,
    });
  }

  let jeId = '';
  if (glLines.length > 0) {
    const journalEntry: JournalEntry = {
      orderId: currentPO.id,
      companyId: 'DEFAULT_COMPANY',
      createdBy: actor,
      description: `Inventory Receipt ${receiptId} for PO ${currentPO.id}`,
      lines: glLines,
      sourceType: 'purchase_receipt',
      sourceId: receiptId,
      sourceLabel: `Receipt #${receiptId}`,
    };
    jeId = await postJournalEntry(journalEntry);
  }

  // 6. Write Inventory Receipt document
  const finalReceipt: InventoryReceipt = {
    id: receiptId,
    poId: currentPO.id,
    poNumber: currentPO.id,
    vendorId: currentPO.vendorId,
    vendorName: currentPO.vendorName,
    receiptDate: receiptData.receiptDate,
    lines: processedLines,
    freightAmount: receiptData.freightAmount,
    freightTreatment: receiptData.freightTreatment,
    notes: receiptData.notes || '',
    glPostingStatus: jeId ? 'posted' : 'unposted',
    journalEntryId: jeId || undefined,
    createdAt: now,
    createdBy: actor,
  };

  const receiptRef = doc(db, RECEIPTS_COLLECTION, receiptId);
  await setDoc(receiptRef, finalReceipt);

  await writeAuditLog({
    actor,
    action: 'RECEIVE_PURCHASE_ORDER',
    entityType: 'inventory_receipt',
    entityId: receiptId,
    before: null,
    after: { poId: currentPO.id, totalAcceptedQty, journalEntryId: jeId },
  });

  // Sync to local store
  useAdminStore.getState().addInventoryReceipt(finalReceipt);

  return finalReceipt;
}
