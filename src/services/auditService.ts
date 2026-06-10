import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface AuditRecord {
  id?: string;
  actor: string;
  action:
    | 'RESTOCK_INVENTORY'
    | 'PRICE_CHANGE'
    | 'ORDER_STATUS_CHANGE'
    | 'DELIVERY_STATUS_CHANGE'
    | 'LOG_JOURNAL_ENTRY'
    | 'TAX_ADJUSTMENT'
    | 'CREATE_ORDER'
    | 'UPDATE_ORDER'
    | 'DELETE_ORDER'
    | 'DUPLICATE_ORDER'
    | 'CREATE_PRODUCT'
    | 'UPDATE_PRODUCT'
    | 'DELETE_PRODUCT'
    | 'CREATE_CUSTOMER'
    | 'UPDATE_CUSTOMER'
    | 'DELETE_CUSTOMER'
    | 'CREATE_INVENTORY'
    | 'UPDATE_INVENTORY'
    | 'DELETE_INVENTORY'
    | 'CREATE_SUBSCRIPTION'
    | 'UPDATE_SUBSCRIPTION'
    | 'DELETE_SUBSCRIPTION'
    | 'CREATE_EVENT'
    | 'UPDATE_EVENT'
    | 'DELETE_EVENT'
    | 'UPDATE_DELIVERY_DISPATCH'
    | 'CREATE_GL_ACCOUNT'
    | 'UPDATE_GL_ACCOUNT'
    | 'DEACTIVATE_GL_ACCOUNT'
    | 'REACTIVATE_GL_ACCOUNT';

  entityType: 'inventory' | 'order' | 'product' | 'finance' | 'customer' | 'event' | 'subscription' | 'gl_account';
  entityId: string;

  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;

  journalEntryId?: string;
  createdAt?: unknown;
}

export const writeAuditLog = async (record: Omit<AuditRecord, 'id' | 'createdAt'>) => {
  try {
    const ref = collection(db, 'auditLogs');
    await addDoc(ref, {
      ...record,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write audit log to Firestore:", error);
  }
};

export const getRecentAuditLogs = async (limitCount = 50) => {
  try {
    const q = query(
      collection(db, 'auditLogs'), 
      orderBy('createdAt', 'desc'), 
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditRecord));
  } catch (error) {
    console.error("Failed to get recent audit logs:", error);
    return [];
  }
};
