import fs from 'fs';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection, addDoc, deleteDoc, query, where, setLogLevel
} from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';

// 1. Read environment variables from .env
const envContent = fs.readFileSync('.env', 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[match[1]] = value;
  }
});

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  measurementId: env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('Initializing Firebase Client SDK...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
// Mute the SDK's expected PERMISSION_DENIED console echoes — every assertFails
// case below intentionally triggers a denied operation. Assertions are unaffected.
setLogLevel('silent');

// Run identity: every fixture this process creates is owned by exactly this
// RUN_ID, so cleanup targets only its own records — never a broad QA/TEST/SMOKE
// name sweep, which could delete a concurrent run's (or a human's) data.
const RUN_ID = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
const rand = RUN_ID;
const testOrderId = `QA_ORDER_RULES_TEST_${rand}`;

/**
 * Explicit ownership manifest. A fixture is registered the moment its creating
 * assertion SUCCEEDS, so cleanup knows exactly what this run put in production.
 */
const OWNED_FIXTURES = [];
const own = (collectionName, docId) => {
  if (!OWNED_FIXTURES.some(f => f.collectionName === collectionName && f.docId === docId)) {
    OWNED_FIXTURES.push({ collectionName, docId });
  }
};
const testOrderNumber = `BLM-QA${rand}`;
const testEmail = `qa-test-${rand}@example.com`;
const testTrackingId = `${testOrderNumber.toLowerCase()}_${testEmail.toLowerCase()}`;
const mismatchedTrackingId = `${testOrderNumber.toLowerCase()}_wrong-email-${rand}@example.com`;

console.log(`Generated Test IDs:`);
console.log(`- Order Doc ID: ${testOrderId}`);
console.log(`- Order Number: ${testOrderNumber}`);
console.log(`- Email: ${testEmail}`);
console.log(`- Tracking Lookup ID: ${testTrackingId}`);
console.log(`- Mismatched Tracking ID: ${mismatchedTrackingId}`);
console.log('----------------------------------------');

let failedTests = 0;

async function assertSucceeds(name, action, ownsFixture) {
  try {
    await action();
    // Register ownership ONLY on a confirmed write — a denied attempt leaves
    // nothing behind, and claiming it would make cleanup chase a phantom.
    if (ownsFixture) own(ownsFixture.collectionName, ownsFixture.docId);
    console.log(`✅ [PASS] ${name}`);
  } catch (error) {
    console.error(`❌ [FAIL] ${name} (Expected success but got error)`);
    console.error(error);
    failedTests++;
  }
}

async function assertFails(name, action) {
  try {
    await action();
    console.error(`❌ [FAIL] ${name} (Expected permission failure but operation succeeded)`);
    failedTests++;
  } catch (error) {
    if (error.code === 'permission-denied') {
      console.log(`✅ [PASS] ${name} (Failed as expected with permission-denied)`);
    } else {
      console.error(`❌ [FAIL] ${name} (Expected permission-denied but got different error)`);
      console.error(error);
      failedTests++;
    }
  }
}

async function runTests() {
  // 1. Guest creates valid order (Allowed)
  await assertSucceeds('Guest creates valid order document', () => {
    return setDoc(doc(db, 'orders', testOrderId), {
      id: testOrderId,
      orderNumber: testOrderNumber,
      orderNumberNormalized: testOrderNumber.toLowerCase(),
      senderEmailNormalized: testEmail.toLowerCase(),
      customerId: 'guest',
      customerName: 'QA Guest Tester',
      customerEmail: testEmail,
      recipientName: 'Recipient QA',
      recipientPhone: '123-456-7890',
      recipientAddress: '123 QA St',
      recipientCity: 'QATown',
      recipientState: 'NY',
      recipientZip: '10001',
      deliveryType: 'standard',
      deliveryDate: '2026-06-15',
      senderName: 'QA Guest Tester',
      senderEmail: testEmail,
      cardMessage: 'Hello QA message',
      items: [
        {
          productId: 'prod-rose',
          name: 'Classic Red Roses',
          price: 59.99,
          quantity: 1,
          imageUrl: 'https://example.com/rose.jpg',
          isCustom: false
        }
      ],
      subtotal: 59.99,
      taxes: 5.32,
      deliveryFee: 9.99,
      total: 75.30,
      status: 'confirmed',
      paymentStatus: 'paid',
      glPostingStatus: 'unposted',
      companyId: 'DEFAULT_COMPANY',
      createdAt: new Date().toISOString()
    });
  }, { collectionName: 'orders', docId: testOrderId });

  // 2. Guest reads the created order (Denied)
  await assertFails('Guest reads order document', () => {
    return getDoc(doc(db, 'orders', testOrderId));
  });

  // 3. Guest lists orders (Denied)
  await assertFails('Guest lists orders collection', () => {
    return getDocs(collection(db, 'orders'));
  });

  // 4. Guest updates order (Denied)
  await assertFails('Guest updates order document', () => {
    return setDoc(doc(db, 'orders', testOrderId), { status: 'preparing' }, { merge: true });
  });

  // 5. Guest creates valid tracking doc (Allowed)
  await assertSucceeds('Guest creates valid publicOrderTracking document', () => {
    return setDoc(doc(db, 'publicOrderTracking', testTrackingId), {
      orderNumber: testOrderNumber,
      orderNumberNormalized: testOrderNumber.toLowerCase(),
      senderEmailNormalized: testEmail.toLowerCase(),
      status: 'placed',
      deliveryDate: '2026-06-15',
      recipientFirstName: 'Recipient',
      city: 'QATown',
      state: 'NY',
      itemsSummary: '1x Classic Red Roses',
      timeline: [
        { status: 'placed', label: 'Order Placed', timestamp: new Date().toISOString() }
      ],
      companyId: 'DEFAULT_COMPANY',
      updatedAt: new Date().toISOString()
    });
  }, { collectionName: 'publicOrderTracking', docId: testTrackingId });

  // 6. Guest creates tracking doc under mismatched ID (Denied)
  await assertFails('Guest creates publicOrderTracking with mismatched document ID', () => {
    return setDoc(doc(db, 'publicOrderTracking', mismatchedTrackingId), {
      orderNumber: testOrderNumber,
      orderNumberNormalized: testOrderNumber.toLowerCase(),
      senderEmailNormalized: testEmail.toLowerCase(),
      status: 'placed',
      deliveryDate: '2026-06-15',
      recipientFirstName: 'Recipient',
      city: 'QATown',
      state: 'NY',
      itemsSummary: '1x Classic Red Roses',
      timeline: [],
      updatedAt: new Date().toISOString()
    });
  });

  // 7. Guest reads known tracking (Allowed)
  await assertSucceeds('Guest reads known publicOrderTracking document', () => {
    return getDoc(doc(db, 'publicOrderTracking', testTrackingId));
  });

  // 8. Guest lists publicOrderTracking (Denied)
  await assertFails('Guest lists publicOrderTracking collection', () => {
    return getDocs(collection(db, 'publicOrderTracking'));
  });

  // 9. Guest writes extra fields to tracking doc (Denied)
  await assertFails('Guest writes forbidden fields to publicOrderTracking', () => {
    return setDoc(doc(db, 'publicOrderTracking', testTrackingId), {
      orderNumber: testOrderNumber,
      orderNumberNormalized: testOrderNumber.toLowerCase(),
      senderEmailNormalized: testEmail.toLowerCase(),
      status: 'placed',
      deliveryDate: '2026-06-15',
      recipientFirstName: 'Recipient',
      city: 'QATown',
      state: 'NY',
      itemsSummary: '1x Classic Red Roses',
      timeline: [],
      updatedAt: new Date().toISOString(),
      internalNotes: 'Forbidden field'
    });
  });

  // 10. Guest reads /chartOfAccounts (Denied)
  await assertFails('Guest reads chartOfAccounts collection', () => {
    return getDocs(collection(db, 'chartOfAccounts'));
  });

  // 11. Guest writes /chartOfAccounts (Denied)
  await assertFails('Guest writes to chartOfAccounts collection', () => {
    return addDoc(collection(db, 'chartOfAccounts'), { name: 'Unauthorized Account' });
  });

  // 12. Guest reads /systemSeeds (Denied)
  await assertFails('Guest reads systemSeeds document', () => {
    return getDoc(doc(db, 'systemSeeds', 'ordersDemoSeed'));
  });

  // 13. Guest reads /payments (Denied)
  await assertFails('Guest reads payments collection', () => {
    return getDocs(collection(db, 'payments'));
  });

  // 14. Guest writes /payments (Denied)
  await assertFails('Guest writes to payments collection', () => {
    return addDoc(collection(db, 'payments'), { amount: 100 });
  });

  // 15. Guest reads /customerStatements (Denied)
  await assertFails('Guest reads customerStatements collection', () => {
    return getDocs(collection(db, 'customerStatements'));
  });

  // 16. Guest writes /customerStatements (Denied)
  await assertFails('Guest writes to customerStatements collection', () => {
    return addDoc(collection(db, 'customerStatements'), { customerName: 'Test' });
  });

  // 17. Guest reads /collectionNotes (Denied)
  await assertFails('Guest reads collectionNotes collection', () => {
    return getDocs(collection(db, 'collectionNotes'));
  });

  // 18. Guest writes /collectionNotes (Denied)
  await assertFails('Guest writes to collectionNotes collection', () => {
    return addDoc(collection(db, 'collectionNotes'), { noteText: 'Test Note' });
  });

  // 19. Guest reads /vendors (Denied)
  await assertFails('Guest reads vendors collection', () => {
    return getDocs(collection(db, 'vendors'));
  });

  // 20. Guest writes /vendors (Denied)
  await assertFails('Guest writes to vendors collection', () => {
    return addDoc(collection(db, 'vendors'), { name: 'Unauthorized Vendor' });
  });

  // 21. Guest reads /purchaseOrders (Denied)
  await assertFails('Guest reads purchaseOrders collection', () => {
    return getDocs(collection(db, 'purchaseOrders'));
  });

  // 22. Guest writes /purchaseOrders (Denied)
  await assertFails('Guest writes to purchaseOrders collection', () => {
    return addDoc(collection(db, 'purchaseOrders'), { totalCost: 100 });
  });

  // 23. Guest reads /inventoryReceipts (Denied)
  await assertFails('Guest reads inventoryReceipts collection', () => {
    return getDocs(collection(db, 'inventoryReceipts'));
  });

  // 24. Guest writes /inventoryReceipts (Denied)
  await assertFails('Guest writes to inventoryReceipts collection', () => {
    return addDoc(collection(db, 'inventoryReceipts'), { receiptDate: '2026-06-10' });
  });

  // 25. Guest reads /vendorBills (Denied)
  await assertFails('Guest reads vendorBills collection', () => {
    return getDocs(collection(db, 'vendorBills'));
  });

  // 26. Guest writes /vendorBills (Denied)
  await assertFails('Guest writes to vendorBills collection', () => {
    return addDoc(collection(db, 'vendorBills'), { billNumber: '123' });
  });

  // 27. Guest reads /vendorPayments (Denied)
  await assertFails('Guest reads vendorPayments collection', () => {
    return getDocs(collection(db, 'vendorPayments'));
  });

  // 28. Guest writes /vendorPayments (Denied)
  await assertFails('Guest writes to vendorPayments collection', () => {
    return addDoc(collection(db, 'vendorPayments'), { amount: 100 });
  });

  // 29. Guest reads /inventoryTransactions (Denied)
  await assertFails('Guest reads inventoryTransactions collection', () => {
    return getDocs(collection(db, 'inventoryTransactions'));
  });

  // 30. Guest writes /inventoryTransactions (Denied)
  await assertFails('Guest writes to inventoryTransactions collection', () => {
    return addDoc(collection(db, 'inventoryTransactions'), { quantityIn: 5 });
  });

  // 31. Guest reads /sequences (Denied)
  await assertFails('Guest reads sequences collection', () => {
    return getDocs(collection(db, 'sequences'));
  });

  // 32. Guest writes /sequences (Denied)
  await assertFails('Guest writes to sequences collection', () => {
    return addDoc(collection(db, 'sequences'), { currentValue: 1 });
  });

}

/**
 * Entry point. Cleanup runs in `finally` so this run's production fixtures are
 * removed even when an assertion throws, and its result is fatal: the process
 * exits nonzero if any owned fixture survives. Assertion failures and cleanup
 * failures are reported separately so a green suite with dirty cleanup can
 * never be mistaken for success.
 */
async function main() {
  let cleanupFailures = 0;
  try {
    await runTests();
  } catch (e) {
    console.error('❌ QA Test Run threw before completing:', e?.message || e);
    failedTests++;
  } finally {
    cleanupFailures = await cleanupOwnedFixtures();
  }

  console.log('----------------------------------------');
  if (failedTests > 0 || cleanupFailures > 0) {
    if (failedTests > 0) console.error(`❌ QA Test Run Failed: ${failedTests} test(s) failed.`);
    if (cleanupFailures > 0) {
      console.error(`❌ QA Test Run Failed: production fixture cleanup did not complete (${cleanupFailures} issue(s)).`);
      console.error('   The gate is RED because this run left data in production.');
    }
    process.exit(1);
  }
  console.log('✅ QA Test Run Succeeded: All security boundaries are correctly enforced, and this run left no production fixtures.');
  process.exit(0);
}

/**
 * FAIL-CLOSED cleanup of this run's own fixtures.
 *
 * This suite writes to PRODUCTION (it must, to assert the guest-checkout rule)
 * and runs unauthenticated, so it cannot delete what it creates without
 * signing in afterwards. Cleanup is therefore mandatory, not best-effort:
 * missing credentials, a failed sign-in, a failed delete, or any fixture still
 * present afterwards all FAIL THE RUN. A "green gate that left pollution" is
 * exactly the failure class that let 88 junk orders accumulate.
 *
 * Deletion is by exact owned document id only — never a QA/TEST/SMOKE name
 * sweep, which could destroy a concurrent run's or a human's records.
 *
 * @returns {Promise<number>} count of cleanup failures (0 = clean)
 */
async function cleanupOwnedFixtures() {
  if (OWNED_FIXTURES.length === 0) {
    console.log('🧹 Cleanup: this run created no production fixtures — nothing to remove.');
    return 0;
  }
  const email = process.env.SMOKE_AUTH_EMAIL;
  const password = process.env.SMOKE_AUTH_PASSWORD;
  const manifest = OWNED_FIXTURES.map(f => `${f.collectionName}/${f.docId}`).join(', ');

  if (!email || !password) {
    console.error(`❌ [CLEANUP] SMOKE_AUTH_EMAIL/SMOKE_AUTH_PASSWORD are required to remove this run's production fixtures.`);
    console.error(`   Leaked fixtures (${OWNED_FIXTURES.length}): ${manifest}`);
    return 1;
  }

  const auth = getAuth();
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (e) {
    console.error(`❌ [CLEANUP] Authentication failed (${e.code || e.message}) — cannot remove this run's fixtures.`);
    console.error(`   Leaked fixtures (${OWNED_FIXTURES.length}): ${manifest}`);
    return 1;
  }

  let failures = 0;
  for (const f of OWNED_FIXTURES) {
    try {
      await deleteDoc(doc(db, f.collectionName, f.docId));
    } catch (e) {
      console.error(`❌ [CLEANUP] Delete failed for ${f.collectionName}/${f.docId}: ${e.code || e.message}`);
      failures++;
    }
  }

  // Independent post-cleanup verification: a successful delete CALL is not
  // proof — absence from the datastore is. Verify by LISTING the collection
  // and checking the id is gone, rather than by getDoc: for company-scoped
  // docs the read rule dereferences resource.data.companyId, which is null for
  // a deleted document, so a get returns permission-denied and cannot
  // distinguish "removed" from "unreadable". A query returns rows that exist.
  let remaining = 0;
  for (const f of OWNED_FIXTURES) {
    try {
      const snap = await getDocs(query(
        collection(db, f.collectionName),
        where('companyId', '==', 'DEFAULT_COMPANY')
      ));
      if (snap.docs.some(d => d.id === f.docId)) {
        console.error(`❌ [CLEANUP] Fixture STILL PRESENT after cleanup: ${f.collectionName}/${f.docId}`);
        remaining++;
      }
    } catch (listErr) {
      // Some collections deny list but allow public get (publicOrderTracking).
      try {
        const one = await getDoc(doc(db, f.collectionName, f.docId));
        if (one.exists()) {
          console.error(`❌ [CLEANUP] Fixture STILL PRESENT after cleanup: ${f.collectionName}/${f.docId}`);
          remaining++;
        }
      } catch (getErr) {
        console.error(`❌ [CLEANUP] Could not verify removal of ${f.collectionName}/${f.docId} (list: ${listErr.code || listErr.message}; get: ${getErr.code || getErr.message}).`);
        remaining++;
      }
    }
  }

  await signOut(auth).catch(() => {});

  if (failures === 0 && remaining === 0) {
    console.log(`🧹 Cleanup: removed and verified ${OWNED_FIXTURES.length}/${OWNED_FIXTURES.length} owned fixture(s) [run ${RUN_ID}] — post-cleanup owned-fixture count = 0.`);
    return 0;
  }
  console.error(`❌ [CLEANUP] ${failures} delete failure(s), ${remaining} fixture(s) still present [run ${RUN_ID}].`);
  return failures + remaining;
}

main();
