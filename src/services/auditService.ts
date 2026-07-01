import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface AuditRecord {
  id?: string;
  companyId: string;
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
    | 'ORDER_BACKORDER'
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
    | 'REACTIVATE_GL_ACCOUNT'
    | 'CREATE_PURCHASE_ORDER'
    | 'UPDATE_PURCHASE_ORDER'
    | 'APPROVE_PURCHASE_ORDER'
    | 'CANCEL_PURCHASE_ORDER'
    | 'RECEIVE_PURCHASE_ORDER'
    | 'CREATE_VENDOR_BILL'
    | 'POST_VENDOR_BILL'
    | 'VOID_VENDOR_BILL'
    | 'CREATE_VENDOR_PAYMENT'
    | 'VOID_VENDOR_PAYMENT'
    | 'CREATE_VENDOR'
    | 'UPDATE_VENDOR'
    | 'company.updated'
    | 'settings.updated'
    | 'member.invited'
    | 'member.roleChanged'
    | 'member.suspended';

  entityType: 'inventory' | 'order' | 'product' | 'finance' | 'customer' | 'event' | 'subscription' | 'gl_account' | 'purchase_order' | 'inventory_receipt' | 'vendor_bill' | 'vendor_payment' | 'vendor' | 'branch' | 'company' | 'settings' | 'member';
  entityId: string;

  before: any | null;
  after: any | null;

  journalEntryId?: string;
  createdAt?: unknown;
}

export const writeAuditLog = async (record: Omit<AuditRecord, 'id' | 'createdAt' | 'companyId'> & { companyId?: string }) => {
  try {
    const companyId = record.companyId || localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
    const ref = collection(db, 'auditLogs');
    await addDoc(ref, {
      ...record,
      companyId,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error("Failed to write audit log to Firestore:", error);
  }
};

export const getRecentAuditLogs = async (companyId: string, limitCount = 50) => {
  try {
    const q = query(
      collection(db, 'auditLogs'), 
      where('companyId', '==', companyId),
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
