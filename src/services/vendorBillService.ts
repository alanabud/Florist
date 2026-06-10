import { doc, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore, type VendorBill, type VendorBillLine, type PurchaseOrder } from '../store/adminStore';
import { getNextSequenceNumber } from './sequenceService';
import { writeAuditLog } from './auditService';
import { postJournalEntry, type JournalLine, type JournalEntry, reverseJournalEntry } from './financeService';
import { recalculateVendorBalances } from './vendorService';

const BILLS_COLLECTION = 'vendorBills';
const PO_COLLECTION = 'purchaseOrders';

/**
 * Evaluates the 3-way match status of a bill against its source PO.
 */
export function evaluate3WayMatch(
  billLines: VendorBillLine[],
  po: PurchaseOrder
): 'unmatched' | 'matched' | 'variance' | 'blocked' {
  let hasVariance = false;
  let hasBlock = false;

  for (const billLine of billLines) {
    if (!billLine.sku) continue;

    const poLine = po.lines.find(pl => pl.sku === billLine.sku);
    if (!poLine) {
      // Billed an item not on the PO
      hasVariance = true;
      continue;
    }

    // Price variance check
    if (Math.abs(billLine.unitCost - poLine.unitCost) > 0.001) {
      hasVariance = true;
    }

    // Quantity variance check
    // If billing exceeds ordered quantity or received quantity, mark as variance
    if (billLine.quantity > poLine.quantityOrdered || billLine.quantity > (poLine.quantityReceived || 0)) {
      hasVariance = true;
      // If billing exceeds received quantity by a large margin, we could set blocked status
      if (billLine.quantity > (poLine.quantityReceived || 0)) {
        hasBlock = true;
      }
    } else if (billLine.quantity < poLine.quantityReceived) {
      // Partial billing
      hasVariance = true;
    }
  }

  if (hasBlock) return 'blocked';
  if (hasVariance) return 'variance';
  return 'matched';
}

/**
 * Creates a new draft or posted Vendor Bill.
 */
export async function createVendorBill(
  billData: Omit<VendorBill, 'id' | 'balanceDue' | 'status' | 'glPostingStatus' | 'createdAt' | 'updatedAt' | 'matchStatus' | 'subtotal' | 'totalAmount' | 'createdBy'>,
  actor: string = 'Admin'
): Promise<VendorBill> {
  const sequenceId = await getNextSequenceNumber('vendorBills');
  const now = new Date().toISOString();

  // Calculate totals
  const subtotal = billData.lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const totalAmount = Math.round((subtotal + billData.taxAmount + billData.freightAmount - billData.discountAmount) * 100) / 100;

  // Determine match status if PO is linked
  let matchStatus: 'unmatched' | 'matched' | 'variance' | 'blocked' = 'unmatched';
  if (billData.poId) {
    const poSnap = await getDoc(doc(db, PO_COLLECTION, billData.poId));
    if (poSnap.exists()) {
      matchStatus = evaluate3WayMatch(billData.lines, poSnap.data() as PurchaseOrder);
    }
  } else {
    // Non-inventory manual bills are default matched
    matchStatus = 'matched';
  }

  const newBill: VendorBill = {
    ...billData,
    id: sequenceId,
    subtotal: Math.round(subtotal * 100) / 100,
    totalAmount,
    balanceDue: totalAmount,
    status: 'draft',
    glPostingStatus: 'unposted',
    matchStatus,
    createdAt: now,
    updatedAt: now,
    createdBy: actor,
  };

  const docRef = doc(db, BILLS_COLLECTION, sequenceId);
  await setDoc(docRef, newBill);

  await writeAuditLog({
    actor,
    action: 'CREATE_VENDOR_BILL',
    entityType: 'vendor_bill',
    entityId: sequenceId,
    before: null,
    after: { totalAmount, vendorName: billData.vendorName, matchStatus },
  });

  // Sync to local store
  useAdminStore.getState().addVendorBill(newBill);

  return newBill;
}

/**
 * Post a Vendor Bill to the General Ledger.
 * Locks the bill from edits, creates journal entries, updates vendor balances, and updates PO billing progress.
 */
export async function postVendorBill(id: string, actor: string = 'Admin'): Promise<void> {
  const billRef = doc(db, BILLS_COLLECTION, id);
  const billSnap = await getDoc(billRef);
  if (!billSnap.exists()) {
    throw new Error(`Vendor Bill ${id} not found.`);
  }

  const bill = billSnap.data() as VendorBill;
  if (bill.status !== 'draft') {
    throw new Error(`Only draft bills can be posted.`);
  }

  const now = new Date().toISOString();
  
  // 1. Double-Entry Posting to General Ledger
  const glLines: JournalLine[] = [];
  let po: PurchaseOrder | null = null;

  if (bill.poId) {
    const poSnap = await getDoc(doc(db, PO_COLLECTION, bill.poId));
    if (poSnap.exists()) {
      po = poSnap.data() as PurchaseOrder;
    }
  }

  if (po) {
    // Inventory-Backed: clear Accrued Purchases (GRNI) at PO cost, post PPV for difference
    let grniDebit = 0;
    let ppvDebit = 0;

    for (const billLine of bill.lines) {
      if (!billLine.sku) continue;

      const poLine = po.lines.find(pl => pl.sku === billLine.sku);
      if (poLine) {
        // Accrued value was: quantityBilled * PO unit cost
        const lineGrniVal = billLine.quantity * poLine.unitCost;
        grniDebit += lineGrniVal;

        // PPV = billed value - accrued value
        const varianceVal = (billLine.quantity * billLine.unitCost) - lineGrniVal;
        ppvDebit += varianceVal;
      } else {
        // Billed item that is not in PO - debit supplies expense or general expense
        const unlinkedVal = billLine.quantity * billLine.unitCost;
        glLines.push({
          account: 'Supplies Expense',
          accountId: '',
          accountName: 'Supplies Expense',
          debit: Math.round(unlinkedVal * 100) / 100,
          credit: 0,
        });
      }
    }

    // Freight clearance
    grniDebit += bill.freightAmount;

    // Post GRNI debit
    if (grniDebit > 0) {
      glLines.push({
        account: 'Accrued Purchases / GRNI',
        accountId: '',
        accountName: 'Accrued Purchases / GRNI',
        debit: Math.round(grniDebit * 100) / 100,
        credit: 0,
      });
    }

    // Post Purchase Price Variance
    if (Math.abs(ppvDebit) > 0.001) {
      glLines.push({
        account: 'Purchase Price Variance',
        accountId: '',
        accountName: 'Purchase Price Variance',
        debit: Math.round(ppvDebit * 100) / 100,
        credit: 0,
      });
    }
  } else {
    // Non-Inventory Manual Expense Bill
    for (const line of bill.lines) {
      const glAccount = line.glAccount || 'Supplies Expense';
      glLines.push({
        account: glAccount,
        accountId: '',
        accountName: glAccount,
        debit: Math.round(line.lineTotal * 100) / 100,
        credit: 0,
      });
    }

    // Manual freight & tax expenses
    if (bill.freightAmount > 0) {
      glLines.push({
        account: 'Freight-In',
        accountId: '',
        accountName: 'Freight-In',
        debit: Math.round(bill.freightAmount * 100) / 100,
        credit: 0,
      });
    }
  }

  // Tax treatment: Debit Supplies Expense for Tax
  if (bill.taxAmount > 0) {
    glLines.push({
      account: 'Supplies Expense',
      accountId: '',
      accountName: 'Supplies Expense',
      debit: Math.round(bill.taxAmount * 100) / 100,
      credit: 0,
    });
  }

  // Credit Accounts Payable
  glLines.push({
    account: 'Accounts Payable',
    accountId: '',
    accountName: 'Accounts Payable',
    debit: 0,
    credit: Math.round(bill.totalAmount * 100) / 100,
  });

  // Post Journal
  const journalEntry: JournalEntry = {
    orderId: bill.poId || 'MANUAL_AP_BILL',
    companyId: 'DEFAULT_COMPANY',
    createdBy: actor,
    description: `Vendor Bill ${bill.id} - ${bill.vendorName}`,
    lines: glLines,
    sourceType: 'vendor_bill',
    sourceId: bill.id,
    sourceLabel: `Bill #${bill.id}`,
  };

  const jeId = await postJournalEntry(journalEntry);

  // 2. Increment PO line quantityBilled
  if (po) {
    const poRef = doc(db, PO_COLLECTION, po.id);
    const updatedLines = po.lines.map(poLine => {
      const billLine = bill.lines.find(bl => bl.sku === poLine.sku);
      if (billLine) {
        return {
          ...poLine,
          quantityBilled: (poLine.quantityBilled || 0) + billLine.quantity,
        };
      }
      return poLine;
    });

    await updateDoc(poRef, {
      lines: updatedLines,
      updatedAt: now,
    });

    useAdminStore.getState().updatePurchaseOrderDetails(po.id, {
      lines: updatedLines,
      updatedAt: now,
    });
  }

  // 3. Update Bill status to posted
  const billUpdates: Partial<VendorBill> = {
    status: 'posted',
    glPostingStatus: 'posted',
    journalEntryId: jeId,
    updatedAt: now,
  };

  await updateDoc(billRef, billUpdates);
  
  // Update local store
  useAdminStore.getState().updateVendorBillDetails(id, billUpdates);

  // 4. Recalculate Vendor Balance and Aging
  await recalculateVendorBalances(bill.vendorId);

  await writeAuditLog({
    actor,
    action: 'POST_VENDOR_BILL',
    entityType: 'vendor_bill',
    entityId: id,
    before: { status: bill.status },
    after: { status: 'posted', journalEntryId: jeId },
  });
}

/**
 * Reverses a posted Vendor Bill.
 * Creates balanced reversal entries in GL, restores PO quantities, and updates vendor balances.
 */
export async function voidVendorBill(id: string, actor: string = 'Admin'): Promise<void> {
  const billRef = doc(db, BILLS_COLLECTION, id);
  const billSnap = await getDoc(billRef);
  if (!billSnap.exists()) {
    throw new Error(`Vendor Bill ${id} not found.`);
  }

  const bill = billSnap.data() as VendorBill;
  if (bill.status !== 'posted') {
    throw new Error(`Only posted bills can be voided.`);
  }
  if (bill.balanceDue < bill.totalAmount) {
    throw new Error(`Cannot void a bill that has payments applied. Void the payments first.`);
  }

  const now = new Date().toISOString();

  // 1. Reverse GL entry
  let revJeId = '';
  if (bill.journalEntryId) {
    revJeId = await reverseJournalEntry(bill.journalEntryId, actor);
  }

  // 2. Revert PO quantityBilled if linked
  if (bill.poId) {
    const poRef = doc(db, PO_COLLECTION, bill.poId);
    const poSnap = await getDoc(poRef);
    if (poSnap.exists()) {
      const po = poSnap.data() as PurchaseOrder;
      const revertedLines = po.lines.map(poLine => {
        const billLine = bill.lines.find(bl => bl.sku === poLine.sku);
        if (billLine) {
          return {
            ...poLine,
            quantityBilled: Math.max(0, (poLine.quantityBilled || 0) - billLine.quantity),
          };
        }
        return poLine;
      });

      await updateDoc(poRef, {
        lines: revertedLines,
        updatedAt: now,
      });

      useAdminStore.getState().updatePurchaseOrderDetails(po.id, {
        lines: revertedLines,
        updatedAt: now,
      });
    }
  }

  // 3. Mark bill as voided
  const billUpdates: Partial<VendorBill> = {
    status: 'voided',
    glPostingStatus: 'reversed',
    reversalJournalEntryId: revJeId,
    balanceDue: 0,
    updatedAt: now,
  };

  await updateDoc(billRef, billUpdates);
  useAdminStore.getState().updateVendorBillDetails(id, billUpdates);

  // 4. Recalculate Vendor Balance and Aging
  await recalculateVendorBalances(bill.vendorId);

  await writeAuditLog({
    actor,
    action: 'VOID_VENDOR_BILL',
    entityType: 'vendor_bill',
    entityId: id,
    before: { status: bill.status },
    after: { status: 'voided', reversalJournalEntryId: revJeId },
  });
}
