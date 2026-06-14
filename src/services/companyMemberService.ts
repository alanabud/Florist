import { 
  collection, doc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, runTransaction
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { writeAuditLog } from './auditService';
import type { CompanyMember } from '../context/CompanyContext';

/**
 * Fetch all members belonging to a company.
 */
export async function fetchCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  const colRef = collection(db, 'companies', companyId, 'members');
  const snap = await getDocs(colRef);
  return snap.docs.map(doc => doc.data() as CompanyMember);
}

/**
 * Invites / Adds a new user to a company.
 */
export async function inviteCompanyMember(
  companyId: string,
  member: Omit<CompanyMember, 'joinedAt'>,
  actor: string
): Promise<void> {
  const docRef = doc(db, 'companies', companyId, 'members', member.userId);
  const newMember = {
    ...member,
    joinedAt: new Date().toISOString(),
    createdAt: serverTimestamp(),
    createdBy: actor
  };
  await setDoc(docRef, newMember);

  await writeAuditLog({
    actor,
    action: 'member.invited',
    entityType: 'member',
    entityId: member.userId,
    before: null,
    after: { companyId, email: member.email, role: member.role }
  });
}

/**
 * Verifies if the member is the last active owner of the company.
 */
async function verifyNotLastOwner(companyId: string, targetUserId: string): Promise<void> {
  const colRef = collection(db, 'companies', companyId, 'members');
  const snap = await getDocs(colRef);
  const members = snap.docs.map(doc => doc.data() as CompanyMember);
  
  const activeOwners = members.filter(m => m.role === 'owner' && m.status === 'active');
  
  if (activeOwners.length === 1 && activeOwners[0].userId === targetUserId) {
    throw new Error("Last Owner Protection: You cannot demote, suspend, or remove the last active owner of this company.");
  }
}

/**
 * Updates a company member's role.
 */
export async function updateCompanyMemberRole(
  companyId: string,
  targetUserId: string,
  newRole: 'owner' | 'admin' | 'manager' | 'designer' | 'sales' | 'accountant' | 'viewer',
  actor: string
): Promise<void> {
  const memberRef = doc(db, 'companies', companyId, 'members', targetUserId);
  
  await runTransaction(db, async (transaction) => {
    // Last active owner check
    if (newRole !== 'owner') {
      const colRef = collection(db, 'companies', companyId, 'members');
      const snap = await getDocs(colRef);
      const members = snap.docs.map(doc => doc.data() as CompanyMember);
      const activeOwners = members.filter(m => m.role === 'owner' && m.status === 'active');
      if (activeOwners.length === 1 && activeOwners[0].userId === targetUserId) {
        throw new Error("Last Owner Protection: You cannot demote the last active owner of this company.");
      }
    }

    transaction.update(memberRef, { 
      role: newRole,
      updatedAt: serverTimestamp(),
      updatedBy: actor
    });
  });

  await writeAuditLog({
    actor,
    action: 'member.roleChanged',
    entityType: 'member',
    entityId: targetUserId,
    before: null,
    after: { companyId, targetUserId, newRole }
  });
}

/**
 * Disables / Suspends a company member.
 */
export async function updateCompanyMemberStatus(
  companyId: string,
  targetUserId: string,
  newStatus: 'active' | 'invited' | 'disabled',
  actor: string
): Promise<void> {
  if (newStatus === 'disabled') {
    await verifyNotLastOwner(companyId, targetUserId);
  }

  const memberRef = doc(db, 'companies', companyId, 'members', targetUserId);
  await updateDoc(memberRef, { 
    status: newStatus,
    updatedAt: serverTimestamp(),
    updatedBy: actor
  });

  await writeAuditLog({
    actor,
    action: 'member.suspended',
    entityType: 'member',
    entityId: targetUserId,
    before: null,
    after: { companyId, targetUserId, status: newStatus }
  });
}

/**
 * Removes a company member completely.
 */
export async function removeCompanyMember(
  companyId: string,
  targetUserId: string,
  actor: string
): Promise<void> {
  await verifyNotLastOwner(companyId, targetUserId);

  const memberRef = doc(db, 'companies', companyId, 'members', targetUserId);
  await deleteDoc(memberRef);

  await writeAuditLog({
    actor,
    action: 'member.suspended', // count as suspension/removal audit log
    entityType: 'member',
    entityId: targetUserId,
    before: { companyId, targetUserId, action: 'removed' },
    after: null
  });
}
