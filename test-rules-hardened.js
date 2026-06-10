import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, doc, setDoc, getDoc, getDocs, collection, addDoc 
} from 'firebase/firestore';

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

const rand = Math.floor(Math.random() * 90000) + 10000;
const testOrderId = `QA_ORDER_RULES_TEST_${rand}`;
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

async function assertSucceeds(name, action) {
  try {
    await action();
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
      createdAt: new Date().toISOString()
    });
  });

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
      updatedAt: new Date().toISOString()
    });
  });

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

  console.log('----------------------------------------');
  if (failedTests > 0) {
    console.error(`❌ QA Test Run Failed: ${failedTests} test(s) failed.`);
    process.exit(1);
  } else {
    console.log('✅ QA Test Run Succeeded: All security boundaries are correctly enforced!');
    process.exit(0);
  }
}

runTests();
