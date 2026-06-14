import { 
  collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy, deleteDoc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { writeAuditLog } from './auditService';

const COLLECTION_NAME = 'branches';

export interface Branch {
  id?: string;
  companyId: string;
  branchCode: string;
  displayName: string;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export async function fetchBranches(companyId: string): Promise<Branch[]> {
  const q = query(
    collection(db, COLLECTION_NAME), 
    where('companyId', '==', companyId),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
}

export async function addBranch(branch: Omit<Branch, 'id' | 'createdAt' | 'createdBy'>, actor: string): Promise<string> {
  const newDoc = {
    ...branch,
    createdAt: new Date().toISOString(),
    createdBy: actor
  };
  const docRef = await addDoc(collection(db, COLLECTION_NAME), newDoc);
  
  await writeAuditLog({
    actor,
    action: 'company.updated', // matching audit actions
    entityType: 'branch',
    entityId: docRef.id,
    before: null,
    after: { branchCode: branch.branchCode, displayName: branch.displayName }
  });

  return docRef.id;
}

export async function updateBranch(branchId: string, updates: Partial<Branch>, actor: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, branchId);
  const freshUpdates = {
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: actor
  };
  await updateDoc(docRef, freshUpdates);
  
  await writeAuditLog({
    actor,
    action: 'company.updated',
    entityType: 'branch',
    entityId: branchId,
    before: null,
    after: freshUpdates
  });
}

export async function deleteBranch(branchId: string, actor: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, branchId);
  await deleteDoc(docRef);
  
  await writeAuditLog({
    actor,
    action: 'company.updated',
    entityType: 'branch',
    entityId: branchId,
    before: { deleted: true },
    after: null
  });
}
