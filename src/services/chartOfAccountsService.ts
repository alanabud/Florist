import {
  collection, addDoc, getDocs, doc, updateDoc, query,
  serverTimestamp, orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { CHART_OF_ACCOUNTS, getExpectedNormalBalance, type AccountDefinition } from './chartOfAccounts';
import { writeAuditLog } from './auditService';

const COA_COLLECTION = 'chartOfAccounts';

/**
 * Fetch all chart of accounts from Firestore.
 * If the collection is empty, auto-seed the default accounts.
 */
export async function fetchChartOfAccounts(): Promise<AccountDefinition[]> {
  const q = query(collection(db, COA_COLLECTION), orderBy('displayOrder', 'asc'));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    // Auto-seed defaults
    const seeded: AccountDefinition[] = [];
    for (const acct of CHART_OF_ACCOUNTS) {
      const docRef = await addDoc(collection(db, COA_COLLECTION), {
        ...acct,
        createdBy: 'system-seed',
        createdAt: serverTimestamp(),
        lastModifiedBy: 'system-seed',
        lastModifiedAt: serverTimestamp(),
        journalUsageCount: 0,
      });
      seeded.push({ ...acct, id: docRef.id });
    }
    return seeded;
  }

  const dbAccounts = snapshot.docs.map(d => ({
    ...d.data(),
    id: d.id,
  } as AccountDefinition));

  // Sync default system accounts if missing critical posting/protection fields
  for (const defaultAcct of CHART_OF_ACCOUNTS) {
    if (defaultAcct.isSystem) {
      const dbAcct = dbAccounts.find(a => a.code === defaultAcct.code);
      if (dbAcct) {
        const needsUpdate = 
          dbAcct.isSystem !== defaultAcct.isSystem ||
          dbAcct.allowManualPosting !== defaultAcct.allowManualPosting ||
          dbAcct.allowSystemPosting !== defaultAcct.allowSystemPosting ||
          dbAcct.isCashAccount !== defaultAcct.isCashAccount ||
          dbAcct.isControlAccount !== defaultAcct.isControlAccount ||
          dbAcct.allowManualJournals !== defaultAcct.allowManualPosting ||
          dbAcct.allowSystemPostings !== defaultAcct.allowSystemPosting ||
          dbAcct.cashAccount !== defaultAcct.isCashAccount ||
          dbAcct.controlAccount !== defaultAcct.isControlAccount;
          
        if (needsUpdate) {
          try {
            const docRef = doc(db, COA_COLLECTION, dbAcct.id!);
            await updateDoc(docRef, {
              isSystem: defaultAcct.isSystem,
              allowManualPosting: defaultAcct.allowManualPosting,
              allowSystemPosting: defaultAcct.allowSystemPosting,
              isCashAccount: defaultAcct.isCashAccount,
              isControlAccount: defaultAcct.isControlAccount,
              allowManualJournals: defaultAcct.allowManualPosting,
              allowSystemPostings: defaultAcct.allowSystemPosting,
              cashAccount: defaultAcct.isCashAccount,
              controlAccount: defaultAcct.isControlAccount,
            });
            // Update local representation
            dbAcct.isSystem = defaultAcct.isSystem;
            dbAcct.allowManualPosting = defaultAcct.allowManualPosting;
            dbAcct.allowSystemPosting = defaultAcct.allowSystemPosting;
            dbAcct.isCashAccount = defaultAcct.isCashAccount;
            dbAcct.isControlAccount = defaultAcct.isControlAccount;
            dbAcct.allowManualJournals = defaultAcct.allowManualPosting;
            dbAcct.allowSystemPostings = defaultAcct.allowSystemPosting;
            dbAcct.cashAccount = defaultAcct.isCashAccount;
            dbAcct.controlAccount = defaultAcct.isControlAccount;
          } catch (e) {
            console.warn(`Failed to auto-update system account ${defaultAcct.code} in COA:`, e);
          }
        }
      }
    }
  }

  return dbAccounts;
}

/**
 * Validate a GL account before create or update.
 */
export function validateGLAccount(
  account: Partial<AccountDefinition>,
  existingAccounts: AccountDefinition[],
  editId?: string
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!account.code?.trim()) {
    errors.code = 'GL Code is required.';
  } else {
    const duplicate = existingAccounts.find(
      a => a.code === account.code?.trim() && a.id !== editId
    );
    if (duplicate) {
      errors.code = `GL Code "${account.code}" is already in use by "${duplicate.name}".`;
    }
  }

  if (!account.name?.trim()) {
    errors.name = 'Account Name is required.';
  }

  if (!account.type) {
    errors.type = 'Account Type is required.';
  }

  if (!account.normalBalance) {
    errors.normalBalance = 'Normal Balance is required.';
  } else if (account.type) {
    const expected = getExpectedNormalBalance(account.type);
    if (account.normalBalance !== expected) {
      errors.normalBalance = `Normal balance for ${account.type} accounts should be "${expected}". Override only if intentional.`;
    }
  }

  // Parent account validation
  if (account.parentAccount) {
    if (account.parentAccount === account.name) {
      errors.parentAccount = 'An account cannot be its own parent (self-parenting).';
    } else {
      const parentObj = existingAccounts.find(a => a.name === account.parentAccount);
      if (parentObj) {
        if (parentObj.active === false) {
          errors.parentAccount = `Parent account "${parentObj.name}" is inactive. Active accounts must have active parent accounts.`;
        }
        if (parentObj.type !== account.type) {
          errors.parentAccount = `Parent account type must match. Cannot place a "${account.type}" account under a "${parentObj.type}" parent account.`;
        }

        // Circular hierarchy check
        let currentParentName = account.parentAccount;
        const visited = new Set<string>();
        while (currentParentName) {
          if (account.name && currentParentName === account.name) {
            errors.parentAccount = 'Circular reference detected: Proposed parent is a child or descendant of this account.';
            break;
          }
          if (visited.has(currentParentName)) {
            break;
          }
          visited.add(currentParentName);
          const parentOfParent = existingAccounts.find(a => a.name === currentParentName);
          currentParentName = parentOfParent?.parentAccount || '';
        }
      }
    }
  }

  return errors;
}

/**
 * Add a new GL Account to Firestore.
 */
export async function addGLAccount(
  account: Omit<AccountDefinition, 'id'>,
  existingAccounts: AccountDefinition[],
  actor: string = 'Admin'
): Promise<AccountDefinition> {
  // Validate
  const errors = validateGLAccount(account, existingAccounts);
  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors).join(' '));
  }

  const docData = {
    ...account,
    active: account.active !== false,
    isSystem: false,
    createdBy: actor,
    createdAt: serverTimestamp(),
    lastModifiedBy: actor,
    lastModifiedAt: serverTimestamp(),
    journalUsageCount: 0,
  };

  const docRef = await addDoc(collection(db, COA_COLLECTION), docData);

  await writeAuditLog({
    actor,
    action: 'CREATE_GL_ACCOUNT',
    entityType: 'gl_account',
    entityId: docRef.id,
    before: null,
    after: { code: account.code, name: account.name, type: account.type },
  });

  return { ...account, id: docRef.id, isSystem: false } as AccountDefinition;
}

/**
 * Update an existing GL Account in Firestore.
 */
export async function updateGLAccount(
  id: string,
  updates: Partial<AccountDefinition>,
  existingAccounts: AccountDefinition[],
  actor: string = 'Admin'
): Promise<void> {
  const existing = existingAccounts.find(a => a.id === id);
  if (!existing) throw new Error('Account not found.');

  const safeUpdates = { ...updates };
  if (existing.isSystem) {
    // Enforce protection on core system fields
    delete safeUpdates.code;
    delete safeUpdates.name;
    delete safeUpdates.type;
    delete safeUpdates.normalBalance;
    delete safeUpdates.isSystem;

    // Protect statement mapping & posting controls for system accounts
    delete safeUpdates.statementType;
    delete safeUpdates.statementSection;
    delete safeUpdates.reportLineGroup;
    delete safeUpdates.cashFlowCategory;
    delete safeUpdates.displayOrder;
    delete safeUpdates.isPostingAccount;
    delete safeUpdates.allowManualPosting;
    delete safeUpdates.allowSystemPosting;
    delete safeUpdates.isCashAccount;
    delete safeUpdates.isControlAccount;

    // Legacy fields
    delete safeUpdates.reportingSection;
    delete safeUpdates.statementGrouping;
    delete safeUpdates.allowManualJournals;
    delete safeUpdates.allowSystemPostings;
    delete safeUpdates.cashAccount;
    delete safeUpdates.controlAccount;
  }

  // Validate
  const merged = { ...existing, ...safeUpdates };
  const errors = validateGLAccount(merged, existingAccounts, id);
  // Allow normal balance override for edits (remove that warning)
  delete errors.normalBalance;

  if (Object.keys(errors).length > 0) {
    throw new Error(Object.values(errors).join(' '));
  }

  const docRef = doc(db, COA_COLLECTION, id);
  await updateDoc(docRef, {
    ...safeUpdates,
    lastModifiedBy: actor,
    lastModifiedAt: serverTimestamp(),
  });

  await writeAuditLog({
    actor,
    action: 'UPDATE_GL_ACCOUNT',
    entityType: 'gl_account',
    entityId: id,
    before: { code: existing.code, name: existing.name, type: existing.type },
    after: { code: merged.code, name: merged.name, type: merged.type },
  });
}

/**
 * Deactivate a GL Account.
 * System accounts cannot be deleted but can be deactivated.
 * Accounts with journal history can only be deactivated, not deleted.
 */
export async function deactivateGLAccount(
  id: string,
  existingAccounts: AccountDefinition[],
  actor: string = 'Admin'
): Promise<void> {
  const existing = existingAccounts.find(a => a.id === id);
  if (!existing) throw new Error('Account not found.');

  const docRef = doc(db, COA_COLLECTION, id);
  await updateDoc(docRef, {
    active: false,
    lastModifiedBy: actor,
    lastModifiedAt: serverTimestamp(),
  });

  await writeAuditLog({
    actor,
    action: 'DEACTIVATE_GL_ACCOUNT',
    entityType: 'gl_account',
    entityId: id,
    before: { active: true },
    after: { active: false },
  });
}

/**
 * Reactivate a deactivated GL Account.
 */
export async function reactivateGLAccount(
  id: string,
  actor: string = 'Admin'
): Promise<void> {
  const docRef = doc(db, COA_COLLECTION, id);
  await updateDoc(docRef, {
    active: true,
    lastModifiedBy: actor,
    lastModifiedAt: serverTimestamp(),
  });

  await writeAuditLog({
    actor,
    action: 'REACTIVATE_GL_ACCOUNT',
    entityType: 'gl_account',
    entityId: id,
    before: { active: false },
    after: { active: true },
  });
}

/**
 * Count how many journal entries reference a given account name.
 */
export async function getAccountJournalUsageCount(accountName: string): Promise<number> {
  // Since journal entry lines are embedded arrays, we can't do a direct Firestore
  // array-contains query on nested fields. Instead we fetch all and count client-side.
  // For production scale this would use a Cloud Function or denormalized counter.
  try {
    const snapshot = await getDocs(collection(db, 'journalEntries'));
    let count = 0;
    snapshot.docs.forEach(d => {
      const data = d.data();
      if (data.lines?.some((l: any) => l.account === accountName)) {
        count++;
      }
    });
    return count;
  } catch {
    return 0;
  }
}
