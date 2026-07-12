import { doc, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

export type SequenceType = 'vendors' | 'purchaseOrders' | 'vendorBills' | 'vendorPayments' | 'inventoryReceipts';

const SEQUENCE_CONFIG = {
  vendors: { prefix: 'VND', start: 10001 },
  purchaseOrders: { prefix: 'PO', start: 20001 },
  vendorBills: { prefix: 'VBL', start: 30001 },
  vendorPayments: { prefix: 'VPM', start: 40001 },
  inventoryReceipts: { prefix: 'REC', start: 50001 },
};

/**
 * Gets the next sequence number for a given document type.
 * Uses a Firestore transaction to ensure atomic increment and prevent duplicate numbers.
 */
export async function getNextSequenceNumber(type: SequenceType): Promise<string> {
  // Sequences are COMPANY-SCOPED (P3.6-DEF-1): the legacy global
  // sequences/{type} doc carried no companyId, so the security rules —
  // which correctly require company membership on the doc's companyId —
  // denied every increment, breaking vendor/PO/receipt/bill/payment creation.
  // Scoped ids also give each company its own numbering, as multi-tenant
  // numbering should behave.
  const companyId = localStorage.getItem('bloompro-selected-company') || 'DEFAULT_COMPANY';
  const sequenceDocRef = doc(db, 'sequences', `${companyId}_${type}`);
  const config = SEQUENCE_CONFIG[type];

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(sequenceDocRef);
    let nextVal = config.start;

    if (snap.exists()) {
      const data = snap.data();
      if (typeof data.currentValue === 'number') {
        nextVal = data.currentValue + 1;
      }
    }

    transaction.set(sequenceDocRef, { currentValue: nextVal, companyId }, { merge: true });
    return `${config.prefix}-${nextVal}`;
  });
}
