import { 
  collection, addDoc, serverTimestamp, query, getDocs, 
  orderBy, limit, FieldValue, Timestamp, where, 
  doc, runTransaction, getDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAdminStore, type InventoryItem, type InventoryTransaction } from '../store/adminStore';
import { CHART_OF_ACCOUNTS } from './chartOfAccounts';
import { calculateOrderCOGS } from './cogsService';

export type JournalSourceType =
  | 'order'
  | 'demo_order'
  | 'inventory_restock'
  | 'manual_journal'
  | 'refund'
  | 'tax_adjustment'
  | 'payment'
  | 'payment_reversal'
  | 'purchase_receipt'
  | 'vendor_bill'
  | 'vendor_payment'
  | 'vendor_payment_reversal'
  | 'cogs'
  | 'cogs_reversal'
  | 'inventory_adjustment'
  | 'delivery';

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
  companyId?: string;
}

export async function verifyPeriodNotClosed(date: any, companyId?: string) {
  try {
    const activeCompanyId = companyId || localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
    const settingsRef = doc(db, 'companies', activeCompanyId, 'settings', 'profile');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
      const data = settingsSnap.data();
      if (data.closedPeriodDate) {
        const closedThreshold = new Date(data.closedPeriodDate);
        
        let checkDate: Date;
        if (date instanceof Date) {
          checkDate = date;
        } else if (typeof date === 'string') {
          checkDate = new Date(date);
        } else if (date && typeof date === 'object' && 'toDate' in date) {
          checkDate = date.toDate();
        } else {
          checkDate = new Date();
        }

        // Standardize both to midnight/same format to ensure precision
        const checkTime = checkDate.getTime();
        const closedTime = closedThreshold.getTime();

        if (checkTime <= closedTime) {
          throw new Error(`Posting blocked: Transaction date (${checkDate.toISOString().split('T')[0]}) falls within a closed accounting period (closed through ${data.closedPeriodDate}).`);
        }
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('Posting blocked')) {
      throw err;
    }
    console.warn("Failed to check closed period:", err);
  }
}

export const postJournalEntry = async (entry: JournalEntry) => {
  // 1. Check closed period first
  await verifyPeriodNotClosed(entry.createdAt || new Date(), entry.companyId);

  // 2. Validation: Debits must equal Credits
  const totalDebits = entry.lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredits = entry.lines.reduce((sum, line) => sum + line.credit, 0);

  // Use a small epsilon to handle floating point inaccuracies
  if (Math.abs(totalDebits - totalCredits) > 0.001) {
    throw new Error(`Journal entry must balance. Debits: ${totalDebits}, Credits: ${totalCredits}`);
  }

  // 3. Validate required fields
  if (!entry.orderId) throw new Error("Every journal entry must have an orderId");
  if (!entry.companyId) throw new Error("Every journal entry must have a companyId");
  if (!entry.createdBy) throw new Error("Every journal entry must have createdBy");

  // Enrich lines with accountId and accountName if not present
  let coa: any[] = [];
  try {
    const snap = await getDocs(query(collection(db, 'chartOfAccounts'), where('companyId', '==', entry.companyId)));
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
      companyId,
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
      companyId,
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

    const activeCompanyId = orderData.companyId || companyId || 'DEFAULT_COMPANY';

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
      const snap = await getDocs(query(collection(db, 'chartOfAccounts'), where('companyId', '==', activeCompanyId)));
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

    // The debit base MUST equal the sum of the credit components (revenue +
    // delivery + tax), or the entry cannot balance. The legacy `total` field is
    // a stale summary (it tracks the delivery fee when a line has no unit
    // price) and diverges from the real order total once a line carries a
    // price — which threw "Journal entry must balance" on every priced order
    // (P3.4-DEF-3). Derive the base from the same components we credit.
    const revenueBase = Math.round(
      ((orderData.subtotal || 0) + (orderData.deliveryFee || 0) + (orderData.taxes || 0)) * 100
    ) / 100;
    const total = revenueBase;
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
      companyId: activeCompanyId,
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
      companyId: activeCompanyId,
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
      companyId,
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

export const getRecentJournalEntries = async (companyId?: string, limitCount = 50) => {
  const activeCompanyId = companyId || localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
  const q = query(
    collection(db, 'journalEntries'), 
    where('companyId', '==', activeCompanyId),
    orderBy('createdAt', 'desc'), 
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
};

export const seedJournalEntriesFromDemoOrders = async () => {
  const orders = useAdminStore.getState().orders;
  const activeCompanyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
  
  for (const order of orders) {
    const companyId = order.companyId || activeCompanyId;
    // Check if entry already exists to ensure idempotency
    const q = query(
      collection(db, 'journalEntries'),
      where('companyId', '==', companyId),
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
      companyId,
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
    companyId: activeCompanyId,
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
      
      // Prevent reversals of entries in closed periods
      await verifyPeriodNotClosed(originalData.createdAt, originalData.companyId);
      
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

    // Fetch original entry companyId for audit log
    const originalSnap = await getDoc(originalRef);
    const companyId = originalSnap.exists() ? (originalSnap.data()?.companyId || 'DEFAULT_COMPANY') : 'DEFAULT_COMPANY';

    // Write audit log
    await writeAuditLog({
      companyId,
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

/**
 * Automates COGS calculation and journal posting when an order is delivered.
 * Updates inventory levels and logs inventory transactions.
 */
export async function postCOGSForDeliveredOrder(
  orderId: string,
  actor: string = 'Admin'
): Promise<string> {
  const orderRef = doc(db, 'orders', orderId);
  
  // Use runTransaction to ensure atomicity of reading/writing inventory and orders
  const jeId = await runTransaction(db, async (transaction) => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists()) {
      throw new Error(`Order ${orderId} not found.`);
    }

    const orderData = orderSnap.data() as any;
    const activeCompanyId = orderData.companyId || 'DEFAULT_COMPANY';

    if (orderData.status !== 'delivered') {
      throw new Error(`Cannot post COGS for order that is not delivered (Current status: ${orderData.status}).`);
    }

    // Idempotency: skip if already posted
    if (orderData.cogsPosted === true) {
      return orderData.cogsJournalEntryId || '';
    }

    // Fetch all active inventory to determine current WAC
    const inventorySnap = await getDocs(query(collection(db, 'inventory'), where('companyId', '==', activeCompanyId)));
    const inventoryList = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));

    // Calculate COGS and built snapshot
    const cogsResult = calculateOrderCOGS(orderData, inventoryList);

    if (cogsResult.totalCogs <= 0) {
      // Nothing to cost
      transaction.update(orderRef, {
        cogsPosted: true,
        cogsAmount: 0,
        cogsPostedAt: serverTimestamp(),
        updatedAt: new Date().toISOString()
      });
      return '';
    }

    // Closed period check
    await verifyPeriodNotClosed(orderData.deliveredTime || new Date(), activeCompanyId);

    // 1. Post Journal Entry
    const journalRef = doc(collection(db, 'journalEntries'));
    const shortId = orderData.orderNumber || orderId.substring(0, 8).toUpperCase();
    
    const lines: JournalLine[] = [
      { account: 'Cost of Goods Sold', debit: cogsResult.totalCogs, credit: 0, accountId: '', accountName: 'Cost of Goods Sold' },
      { account: 'Inventory', debit: 0, credit: cogsResult.totalCogs, accountId: '', accountName: 'Inventory' }
    ];

    // Enrich line accounts
    const enrichedLines = lines.map(line => {
      const coaItem = CHART_OF_ACCOUNTS.find(a => a.name === line.account);
      return {
        ...line,
        accountId: coaItem?.code || '',
        accountName: coaItem?.name || line.account
      };
    });

    const newJe: JournalEntry = {
      orderId,
      companyId: activeCompanyId,
      createdBy: actor,
      description: `COGS Posting for Delivered Order #${shortId}`,
      lines: enrichedLines,
      sourceType: 'cogs',
      sourceId: orderId,
      sourceLabel: `COGS Order #${shortId}`,
      status: 'posted',
      postedAt: serverTimestamp(),
      postedBy: actor,
      createdAt: serverTimestamp()
    };

    transaction.set(journalRef, newJe);

    // 2. Deduct inventory levels & write transaction log entries
    for (const cogsLine of cogsResult.lines) {
      const invItem = inventoryList.find(i => i.sku === cogsLine.sku);
      if (!invItem) continue;

      const itemRef = doc(db, 'inventory', invItem.id!);
      const currentQty = invItem.quantity || 0;
      const newQty = Math.max(0, currentQty - cogsLine.quantityConsumed);

      transaction.update(itemRef, {
        quantity: newQty,
        updatedAt: new Date().toISOString(),
        updatedBy: actor
      });

      // Write transaction document
      const txRef = doc(collection(db, 'inventoryTransactions'));
      const newTx: Omit<InventoryTransaction, 'id'> & { companyId: string } = {
        type: 'sale_fulfillment',
        companyId: activeCompanyId,
        itemId: invItem.id!,
        sku: cogsLine.sku,
        quantityIn: 0,
        quantityOut: cogsLine.quantityConsumed,
        unitCost: cogsLine.unitWac,
        location: 'Main Warehouse',
        sourceReference: orderId,
        notes: `Fulfillment of Order #${shortId}`,
        createdAt: new Date().toISOString(),
        createdBy: actor
      };
      transaction.set(txRef, newTx);
    }

    // 3. Update order document with COGS details
    transaction.update(orderRef, {
      cogsPosted: true,
      cogsJournalEntryId: journalRef.id,
      cogsPostedAt: serverTimestamp(),
      cogsAmount: cogsResult.totalCogs,
      cogsSnapshot: cogsResult.lines,
      updatedAt: new Date().toISOString()
    });

    return journalRef.id;
  });

  const orderSnapForCompany = await getDoc(orderRef);
  const activeCompanyId = orderSnapForCompany.exists() ? (orderSnapForCompany.data()?.companyId || 'DEFAULT_COMPANY') : 'DEFAULT_COMPANY';

  if (jeId) {
    // Write audit log
    await writeAuditLog({
      companyId: activeCompanyId,
      actor,
      action: 'LOG_JOURNAL_ENTRY',
      entityType: 'finance',
      entityId: jeId,
      before: null,
      after: { action: 'COGS_POSTING', orderId, amount: jeId }
    });
  }

  // Reload local state
  await useAdminStore.getState().fetchOrders();
  // Fetch inventory
  const inventorySnap = await getDocs(query(collection(db, 'inventory'), where('companyId', '==', activeCompanyId)));
  const updatedInv = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
  useAdminStore.setState({ inventory: updatedInv });

  return jeId;
}

/**
 * Reverses COGS posting if delivery was done in error. Admin-only trigger.
 */
export async function reverseCOGSForOrder(
  orderId: string,
  reason: string,
  actor: string = 'Admin'
): Promise<string> {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  if (!orderSnap.exists()) {
    throw new Error(`Order ${orderId} not found.`);
  }

  const orderData = orderSnap.data() as any;
  const activeCompanyId = orderData.companyId || 'DEFAULT_COMPANY';

  if (orderData.cogsPosted !== true) {
    throw new Error(`Order ${orderId} does not have a posted COGS entry.`);
  }

  if (orderData.cogsReversed === true) {
    return orderData.cogsReversalJournalEntryId || '';
  }

  // Lock closed period check on original posting date
  await verifyPeriodNotClosed(orderData.cogsPostedAt, activeCompanyId);

  const originalJeId = orderData.cogsJournalEntryId;
  const snapshotLines = orderData.cogsSnapshot || [];

  const reversalJeId = await runTransaction(db, async (transaction) => {
    // 1. Reverse the GL entry
    const originalRef = doc(db, 'journalEntries', originalJeId);
    const originalJeSnap = await transaction.get(originalRef);
    if (originalJeSnap.exists()) {
      transaction.update(originalRef, {
        status: 'reversed',
        reversedBy: actor,
        reversedAt: serverTimestamp()
      });
    }

    const shortId = orderData.orderNumber || orderId.substring(0, 8).toUpperCase();
    const reversalRef = doc(collection(db, 'journalEntries'));
    const reversingEntry: JournalEntry = {
      orderId,
      companyId: activeCompanyId,
      createdBy: actor,
      description: `Reversal of COGS for Order #${shortId} - Reason: ${reason}`,
      lines: [
        { account: 'Inventory', debit: orderData.cogsAmount || 0, credit: 0, accountId: '1300', accountName: 'Inventory' },
        { account: 'Cost of Goods Sold', debit: 0, credit: orderData.cogsAmount || 0, accountId: '5100', accountName: 'Cost of Goods Sold' }
      ],
      sourceType: 'cogs_reversal',
      sourceId: orderId,
      sourceLabel: `COGS Reversal #${shortId}`,
      status: 'posted',
      reversalOf: originalJeId,
      postedAt: serverTimestamp(),
      postedBy: actor,
      createdAt: serverTimestamp()
    };

    transaction.set(reversalRef, reversingEntry);

    // 2. Return inventory back to store & log transaction
    for (const cogsLine of snapshotLines) {
      const invQuery = query(collection(db, 'inventory'), where('companyId', '==', activeCompanyId), where('sku', '==', cogsLine.sku));
      const invSnap = await getDocs(invQuery);
      if (!invSnap.empty) {
        const itemDoc = invSnap.docs[0];
        const itemData = itemDoc.data();
        const currentQty = itemData.quantity || 0;
        const newQty = currentQty + cogsLine.quantityConsumed;

        transaction.update(itemDoc.ref, {
          quantity: newQty,
          updatedAt: new Date().toISOString(),
          updatedBy: actor
        });

        const txRef = doc(collection(db, 'inventoryTransactions'));
        const newTx: Omit<InventoryTransaction, 'id'> & { companyId: string } = {
          type: 'manual_adjustment',
          companyId: activeCompanyId,
          itemId: itemDoc.id,
          sku: cogsLine.sku,
          quantityIn: cogsLine.quantityConsumed,
          quantityOut: 0,
          unitCost: cogsLine.unitWac,
          location: 'Main Warehouse',
          sourceReference: orderId,
          notes: `COGS Reversal: ${reason}`,
          createdAt: new Date().toISOString(),
          createdBy: actor
        };
        transaction.set(txRef, newTx);
      }
    }

    // 3. Update Order metadata
    transaction.update(orderRef, {
      cogsPosted: false,
      cogsReversed: true,
      cogsReversalJournalEntryId: reversalRef.id,
      cogsReversalReason: reason,
      cogsReversedAt: serverTimestamp(),
      updatedAt: new Date().toISOString()
    });

    return reversalRef.id;
  });

  // Write audit log
  await writeAuditLog({
    companyId: activeCompanyId,
    actor,
    action: 'LOG_JOURNAL_ENTRY',
    entityType: 'finance',
    entityId: reversalJeId,
    before: { cogsPosted: true },
    after: { cogsPosted: false, cogsReversed: true, cogsReversalJournalEntryId: reversalJeId }
  });

  // Reload local state
  await useAdminStore.getState().fetchOrders();
  // Fetch inventory
  const inventorySnap = await getDocs(query(collection(db, 'inventory'), where('companyId', '==', activeCompanyId)));
  const updatedInv = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
  useAdminStore.setState({ inventory: updatedInv });

  return reversalJeId;
}
