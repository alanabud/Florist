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
  const sequenceDocRef = doc(db, 'sequences', type);
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

    transaction.set(sequenceDocRef, { currentValue: nextVal }, { merge: true });
    return `${config.prefix}-${nextVal}`;
  });
}
