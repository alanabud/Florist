import { 
  collection, addDoc, serverTimestamp, query, getDocs, 
  orderBy, limit, FieldValue, Timestamp, where, 
  doc, runTransaction, getDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore } from '../store/adminStore';
import { CHART_OF_ACCOUNTS } from './chartOfAccounts';

export type JournalSourceType =
  | 'order'
  | 'demo_order'
  | 'inventory_restock'
  | 'manual_journal'
  | 'refund'
  | 'tax_adjustment';

export interface JournalLine {
  account: string;
  debit: number;
  credit: number;
  accountId?: string;
  accountName?: string;
}

export interface JournalEntry {
  id?: string;
  orderId: string;
  companyId: string;
  createdBy: string;
  description: string;
  lines: JournalLine[];
  sourceType: JournalSourceType;
  sourceId?: string;
  sourceLabel?: string;
  createdAt?: FieldValue | Timestamp | Date | string;
  
  // Immutability and reversal metadata
  status?: 'draft' | 'posted' | 'reversed';
  reversalOf?: string;
  reversedBy?: string;
  reversedAt?: unknown;
  postedAt?: unknown;
  postedBy?: string;
}

export interface OrderData {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientState: string;
  deliveryType: string;
  deliveryDate: string;
  senderName: string;
  senderEmail: string;
  cardMessage?: string;
  subtotal: number;
  deliveryFee: number;
  taxes: number;
  total: number;
  items?: unknown;
  customerName?: string;
  priority?: string;
  internalNotes?: string;
  assignedStaffId?: string;
}

export const postJournalEntry = async (entry: JournalEntry) => {
  // 1. Validation: Debits must equal Credits
  const totalDebits = entry.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = entry.lines.reduce((sum, line) => sum + line.credit, 0);

  // Use a small epsilon to handle floating point inaccuracies
  if (Math.abs(totalDebits - totalCredits) > 0.001) {
    throw new Error(`Journal entry must balance. Debits: ${totalDebits}, Credits: ${totalCredits}`);
  }

  // 2. Validate required fields
  if (!entry.orderId) throw new Error("Every journal entry must have an orderId");
  if (!entry.companyId) throw new Error("Every journal entry must have a companyId");
  if (!entry.createdBy) throw new Error("Every journal entry must have createdBy");

  // Enrich lines with accountId and accountName if not present
  let coa: any[] = [];
  try {
    const snap = await getDocs(collection(db, 'chartOfAccounts'));
    coa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Could not query chartOfAccounts for journal enrichment:", e);
  }
  if (!coa || coa.length === 0) {
    coa = CHART_OF_ACCOUNTS;
  }

  const enrichedLines = entry.lines.map(line => {
    const matchingAcct = coa.find(a => a.name === line.account || a.code === line.account);
    if (matchingAcct) {
      return {
        ...line,
        accountId: line.accountId || matchingAcct.id || '',
        accountName: line.accountName || matchingAcct.name,
        account: matchingAcct.name
      };
    }
    return line;
  });

  // 3. Post to Firestore
  const journalRef = collection(db, 'journalEntries');
  const docRef = await addDoc(journalRef, {
    ...entry,
    lines: enrichedLines,
    status: entry.status || 'posted',
    postedAt: serverTimestamp(),
    postedBy: entry.postedBy || entry.createdBy || 'system',
    createdAt: entry.createdAt || serverTimestamp()
  });

  return docRef.id;
};

import { writeAuditLog } from './auditService';

export const createOrderAndPostFinancials = async (
  orderData: OrderData, 
  isPaid: boolean, 
  companyId: string = 'DEFAULT_COMPANY', 
  createdBy: string = 'system'
) => {
  try {
    // 1. Create Order in Firestore
    const orderRef = collection(db, 'orders');
    const newOrder = await addDoc(orderRef, {
      ...orderData,
      status: isPaid ? 'paid' : 'pending_payment',
      createdAt: serverTimestamp()
    });

    const orderId = newOrder.id;

    // 2. Create Journal Lines
    const lines: JournalLine[] = [];

    // Debit Cash (if paid) or Accounts Receivable (if unpaid)
    if (isPaid) {
      lines.push({ account: 'Cash', debit: orderData.total, credit: 0 });
    } else {
      lines.push({ account: 'Accounts Receivable', debit: orderData.total, credit: 0 });
    }

    // Credit Revenues and Liabilities
    if (orderData.subtotal > 0) {
      lines.push({ account: 'Sales Revenue', debit: 0, credit: orderData.subtotal });
    }
    
    if (orderData.deliveryFee > 0) {
      lines.push({ account: 'Delivery Revenue', debit: 0, credit: orderData.deliveryFee });
    }
    
    if (orderData.taxes > 0) {
      lines.push({ account: 'Sales Tax Payable', debit: 0, credit: orderData.taxes });
    }

    // 3. Post Journal Entry
    const je: JournalEntry = {
      orderId,
      companyId,
      createdBy,
      description: `Sale for Order #${orderId.substring(0, 8).toUpperCase()}`,
      lines,
      sourceType: 'order',
      sourceId: orderId,
      sourceLabel: `Order #${orderId.substring(0, 8).toUpperCase()}`
    };

    const jeId = await postJournalEntry(je);

    // 4. Write Audit Log after successful mutation
    await writeAuditLog({
      actor: createdBy,
      action: 'ORDER_STATUS_CHANGE',
      entityType: 'order',
      entityId: orderId,
      before: null,
      after: { status: isPaid ? 'paid' : 'pending_payment', total: orderData.total },
      journalEntryId: jeId
    });

    return { orderId, jeId };
  } catch (error) {
    console.error("Failed to post financial transaction:", error);
    throw error;
  }
};

export const postOrderFinancials = async (
  orderId: string,
  companyId: string = 'DEFAULT_COMPANY',
  createdBy: string = 'Admin'
) => {
  try {
    // 1. Fetch order details from Firestore
    const orderDocRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderDocRef);
    if (!orderSnap.exists()) {
      throw new Error(`Order ${orderId} not found`);
    }
    const orderData = orderSnap.data() as OrderData & { 
      glPostingStatus?: string; 
      status?: string; 
      paymentStatus?: string;
      orderNumber?: string;
      amountPaid?: number;
    };

    // Safeguards
    if (orderData.glPostingStatus === 'posted') {
      throw new Error(`Order ${orderId} is already posted to the General Ledger.`);
    }

    if (orderData.status === 'cancelled' || orderData.status === 'refunded') {
      throw new Error(`Cannot post cancelled or refunded orders directly to the General Ledger.`);
    }

    // 2. Resolve Chart of Accounts definitions (Firestore first, fallback to static defaults)
    let coa: any[] = [];
    try {
      const snap = await getDocs(collection(db, 'chartOfAccounts'));
      coa = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Could not query chartOfAccounts for journal enrichment:", e);
    }
    if (!coa || coa.length === 0) {
      coa = CHART_OF_ACCOUNTS;
    }

    const getAccountInfo = (codeOrName: string) => {
      const matched = coa.find(a => a.code === codeOrName || a.name === codeOrName);
      if (matched) {
        return {
          accountId: matched.id || '',
          accountName: matched.name,
          account: matched.name
        };
      }
      return {
        accountId: '',
        accountName: codeOrName,
        account: codeOrName
      };
    };

    const total = orderData.total || 0;
    const amountPaid = orderData.amountPaid || 0;
    const balanceDue = Math.round((total - amountPaid) * 100) / 100;

    // 3. Create Journal Lines using the partial-payment model
    const lines: JournalLine[] = [];

    if (amountPaid >= total || orderData.paymentStatus === 'paid') {
      // Fully paid
      lines.push({ ...getAccountInfo('1010'), debit: total, credit: 0 });
    } else if (amountPaid <= 0 || orderData.paymentStatus === 'unpaid') {
      // Unpaid
      lines.push({ ...getAccountInfo('1200'), debit: total, credit: 0 });
    } else {
      // Partially paid
      lines.push({ ...getAccountInfo('1010'), debit: amountPaid, credit: 0 });
      lines.push({ ...getAccountInfo('1200'), debit: balanceDue, credit: 0 });
    }

    // Credits
    if (orderData.subtotal > 0) {
      lines.push({ ...getAccountInfo('4000'), debit: 0, credit: orderData.subtotal });
    }
    
    if (orderData.deliveryFee > 0) {
      lines.push({ ...getAccountInfo('4100'), debit: 0, credit: orderData.deliveryFee });
    }
    
    if (orderData.taxes > 0) {
      lines.push({ ...getAccountInfo('2100'), debit: 0, credit: orderData.taxes });
    }

    const shortId = orderData.orderNumber || orderId.substring(0, 8).toUpperCase();

    // 4. Post Journal Entry
    const je: JournalEntry = {
      orderId,
      companyId,
      createdBy,
      description: `Sale for Order #${shortId}`,
      lines,
      sourceType: 'order',
      sourceId: orderId,
      sourceLabel: `Order #${shortId}`
    };

    const jeId = await postJournalEntry(je);

    // 5. Update glPostingStatus & journalEntryId in Firestore
    await updateDoc(orderDocRef, {
      glPostingStatus: 'posted',
      journalEntryId: jeId,
      updatedAt: serverTimestamp()
    });

    // 6. Write Audit Log
    await writeAuditLog({
      actor: createdBy,
      action: 'LOG_JOURNAL_ENTRY',
      entityType: 'finance',
      entityId: jeId,
      before: { glPostingStatus: 'unposted' },
      after: { glPostingStatus: 'posted', orderId, journalEntryId: jeId },
      journalEntryId: jeId
    });

    return jeId;
  } catch (error) {
    console.error("Failed to post financials for order:", error);
    throw error;
  }
};

export const restockInventoryAndPostFinancials = async (
  sku: string,
  qty: number,
  unitCost: number,
  companyId: string = 'DEFAULT_COMPANY',
  createdBy: string = 'system'
) => {
  try {
    // 1. Validate item exists in inventory first
    const inventory = useAdminStore.getState().inventory;
    const item = inventory.find(i => i.sku === sku);
    if (!item) {
      throw new Error(`Product SKU ${sku} does not exist in inventory.`);
    }

    const totalCost = qty * unitCost;
    
    // 2. Create and validate balanced journal lines
    const lines: JournalLine[] = [
      { account: 'Inventory', debit: totalCost, credit: 0 },
      { account: 'Cash', debit: 0, credit: totalCost }
    ];

    const je: JournalEntry = {
      orderId: `restock-${sku}-${Date.now().toString(36)}`,
      companyId,
      createdBy,
      description: `Restocked ${qty} units of SKU ${sku}`,
      lines,
      sourceType: 'inventory_restock',
      sourceId: sku,
      sourceLabel: `Restock SKU ${sku}`
    };

    // 3. Post Journal Entry to Firestore first (will fail and throw if network or validation fails)
    const jeId = await postJournalEntry(je);

    const oldQty = item.quantity;

    // 4. Update local admin store safely after Firestore succeeds
    useAdminStore.getState().restockInventoryItem(sku, qty);

    // 5. Write Audit Log after successful mutation
    await writeAuditLog({
      actor: createdBy,
      action: 'RESTOCK_INVENTORY',
      entityType: 'inventory',
      entityId: sku,
      before: { quantity: oldQty },
      after: { quantity: oldQty + qty },
      journalEntryId: jeId
    });

    return { jeId };
  } catch (error) {
    console.error("Failed to post restock financials:", error);
    throw error;
  }
};

export const getRecentJournalEntries = async (limitCount = 50) => {
  const q = query(
    collection(db, 'journalEntries'), 
    orderBy('createdAt', 'desc'), 
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
};

export const seedJournalEntriesFromDemoOrders = async () => {
  const orders = useAdminStore.getState().orders;
  
  for (const order of orders) {
    // Check if entry already exists to ensure idempotency
    const q = query(
      collection(db, 'journalEntries'),
      where('sourceType', '==', 'demo_order'),
      where('sourceId', '==', order.id)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      continue;
    }

    const subtotal = order.subtotal || Math.round(order.total * 0.85 * 100) / 100;
    const taxes = order.taxes || Math.round(subtotal * 0.08875 * 100) / 100;
    const deliveryFee = order.deliveryFee || Math.round((order.total - subtotal - taxes) * 100) / 100;

    const lines: JournalLine[] = [];
    const isPaid = order.status !== 'draft' && order.status !== 'confirmed';

    if (isPaid) {
      lines.push({ account: 'Cash', debit: order.total, credit: 0 });
    } else {
      lines.push({ account: 'Accounts Receivable', debit: order.total, credit: 0 });
    }

    if (subtotal > 0) {
      lines.push({ account: 'Sales Revenue', debit: 0, credit: subtotal });
    }
    if (deliveryFee > 0) {
      lines.push({ account: 'Delivery Revenue', debit: 0, credit: deliveryFee });
    }
    if (taxes > 0) {
      lines.push({ account: 'Sales Tax Payable', debit: 0, credit: taxes });
    }

    const je: JournalEntry = {
      orderId: order.id,
      companyId: 'DEFAULT_COMPANY',
      createdBy: 'system-seed',
      description: `Demo Sale for Order #${order.id.substring(0, 8).toUpperCase()}`,
      lines,
      sourceType: 'demo_order',
      sourceId: order.id,
      sourceLabel: `Demo Order #${order.id.substring(0, 8).toUpperCase()}`
    };

    await addDoc(collection(db, 'journalEntries'), {
      ...je,
      status: 'posted',
      postedAt: new Date(order.createdAt),
      postedBy: 'system-seed',
      createdAt: new Date(order.createdAt)
    });
  }

  await writeAuditLog({
    actor: 'System Seeder',
    action: 'LOG_JOURNAL_ENTRY',
    entityType: 'finance',
    entityId: 'demo-seed',
    before: null,
    after: { count: orders.length }
  });
};

export const reverseJournalEntry = async (entryId: string, actor: string = 'system') => {
  try {
    const originalRef = doc(db, 'journalEntries', entryId);
    
    const jeId = await runTransaction(db, async (transaction) => {
      const originalSnap = await transaction.get(originalRef);
      if (!originalSnap.exists()) {
        throw new Error('Journal entry not found.');
      }
      
      const originalData = originalSnap.data() as JournalEntry;
      
      if (originalData.status !== 'posted') {
        throw new Error('Only posted journal entries can be reversed.');
      }
      
      if (originalData.reversalOf) {
        throw new Error('Reversal entries cannot be reversed directly.');
      }

      // Generate inverting lines (opposite debits and credits)
      const reversedLines: JournalLine[] = originalData.lines.map(line => ({
        account: line.account,
        debit: line.credit,
        credit: line.debit
      }));

      const newEntryRef = doc(collection(db, 'journalEntries'));
      const reversingEntry: JournalEntry = {
        orderId: originalData.orderId,
        companyId: originalData.companyId,
        createdBy: actor,
        description: `Reversal of Entry #${entryId.substring(0, 8).toUpperCase()}`,
        lines: reversedLines,
        sourceType: 'refund',
        sourceId: originalData.sourceId || entryId,
        sourceLabel: `Reversal #${entryId.substring(0, 8).toUpperCase()}`,
        status: 'posted',
        reversalOf: entryId,
        postedAt: serverTimestamp(),
        postedBy: actor,
        createdAt: serverTimestamp()
      };

      // 1. Write the reversing journal entry doc
      transaction.set(newEntryRef, reversingEntry);

      // 2. Update the status and reversal metadata of the original entry
      transaction.update(originalRef, {
        status: 'reversed',
        reversedBy: actor,
        reversedAt: serverTimestamp()
      });

      return newEntryRef.id;
    });

    // Write audit log
    await writeAuditLog({
      actor,
      action: 'LOG_JOURNAL_ENTRY',
      entityType: 'finance',
      entityId: entryId,
      before: { status: 'posted' },
      after: { status: 'reversed', reversalEntryId: jeId }
    });

    return jeId;
  } catch (error) {
    console.error("Failed to reverse journal entry:", error);
    throw error;
  }
};
