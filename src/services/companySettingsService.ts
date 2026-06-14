import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { writeAuditLog } from './auditService';
import type { Company, CompanySettings } from '../context/CompanyContext';

export async function updateCompanyProfile(
  companyId: string,
  updates: Partial<Company>,
  actor: string
): Promise<void> {
  const docRef = doc(db, 'companies', companyId);
  const freshUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: actor
  };
  await updateDoc(docRef, freshUpdates);

  await writeAuditLog({
    actor,
    action: 'company.updated',
    entityType: 'company',
    entityId: companyId,
    before: null,
    after: freshUpdates
  });
}

export async function updateCompanySettings(
  companyId: string,
  updates: Partial<CompanySettings>,
  actor: string
): Promise<void> {
  const docRef = doc(db, 'companies', companyId, 'settings', 'profile');
  const freshUpdates = {
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: actor
  };
  await updateDoc(docRef, freshUpdates);

  await writeAuditLog({
    actor,
    action: 'settings.updated',
    entityType: 'settings',
    entityId: companyId,
    before: null,
    after: freshUpdates
  });
}
