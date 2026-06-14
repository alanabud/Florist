import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

// 1. Load project ID from .env
let projectId = 'florist-d5026';
try {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
      const match = line.match(/^\s*VITE_FIREBASE_PROJECT_ID\s*=\s*(.*)?\s*$/);
      if (match) {
        let val = match[1] || '';
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.substring(1, val.length - 1);
        }
        projectId = val.trim();
      }
    });
  }
} catch (err) {
  console.warn('Could not read .env file, using default projectId:', projectId);
}

// 2. Parse command arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || !args.includes('--apply');
const isApply = args.includes('--apply');

console.log('==================================================');
console.log(`Florist SaaS Multi-Company Migration & Backfill`);
console.log(`Project ID: ${projectId}`);
console.log(`Mode: ${isApply ? 'APPLY (Mutating Database)' : 'DRY RUN (Read-Only Preview)'}`);
console.log('==================================================');

// 3. Resolve credentials
let credential;
const saFlagIndex = args.indexOf('--service-account');
let saPath = '';

if (saFlagIndex !== -1 && args[saFlagIndex + 1]) {
  saPath = path.resolve(process.cwd(), args[saFlagIndex + 1]);
} else if (fs.existsSync(path.resolve(process.cwd(), 'service-account.json'))) {
  saPath = path.resolve(process.cwd(), 'service-account.json');
}

if (saPath) {
  try {
    if (fs.existsSync(saPath)) {
      const saContent = JSON.parse(fs.readFileSync(saPath, 'utf8'));
      credential = admin.credential.cert(saContent);
      console.log(`Using service account from: ${saPath}`);
    } else {
      console.error(`❌ Service account file not found at: ${saPath}`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`❌ Failed to load service account:`, err.message);
    process.exit(1);
  }
} else {
  try {
    credential = admin.credential.applicationDefault();
    console.log('Using Application Default Credentials (ADC)');
  } catch (err) {
    console.error('==================================================');
    console.error('❌ Google Application Default Credentials not found.');
    console.error('To run this script, please do one of the following:');
    console.error('  1. Place a service account credentials JSON file as "service-account.json" in the root directory.');
    console.error('  2. Run the script specifying a service account file:');
    console.error('     node scripts/backfill-company-id.js --service-account <path-to-service-account.json>');
    console.error('  3. Log in with Google Cloud SDK:');
    console.error('     gcloud auth application-default login');
    console.error('==================================================');
    process.exit(1);
  }
}

// Initialize admin SDK
try {
  admin.initializeApp({
    credential,
    projectId: projectId
  });
} catch (err) {
  console.error('❌ Failed to initialize Firebase Admin SDK:', err.message);
  process.exit(1);
}
const db = getFirestore();

const collectionsToBackfill = [
  'orders',
  'payments',
  'inventory',
  'products_admin',
  'customers',
  'events',
  'subscriptions',
  'vendors',
  'purchaseOrders',
  'vendorBills',
  'vendorPayments',
  'customerStatements',
  'collectionNotes',
  'inventoryTransactions',
  'journalEntries',
  'chartOfAccounts',
  'inventoryAdjustments',
  'inventoryReceipts',
  'sequences',
  'branches'
];

async function runBackfill() {
  let totalScanned = 0;
  let totalModified = 0;
  let totalSkipped = 0;

  for (const colName of collectionsToBackfill) {
    console.log(`Processing collection: "${colName}"...`);
    const colRef = db.collection(colName);
    
    try {
      const snapshot = await colRef.get();
      if (snapshot.empty) {
        console.log(`  - Collection is empty or does not exist. Skipping.`);
        continue;
      }

      let scanned = 0;
      let modified = 0;
      let skipped = 0;
      let batch = db.batch();
      let batchCount = 0;

      for (const doc of snapshot.docs) {
        scanned++;
        const data = doc.data();
        
        if (!data.companyId) {
          modified++;
          if (isApply) {
            batch.update(doc.ref, { companyId: 'DEFAULT_COMPANY' });
            batchCount++;
            
            // Commit batch if it reaches the Firestore limit of 500
            if (batchCount >= 400) {
              await batch.commit();
              batch = db.batch();
              batchCount = 0;
            }
          }
        } else {
          skipped++;
        }
      }

      // Commit remaining updates in batch
      if (isApply && batchCount > 0) {
        await batch.commit();
      }

      console.log(`  - Results for "${colName}": Scanned ${scanned}, To Modify: ${modified}, Skipped: ${skipped}`);
      
      totalScanned += scanned;
      totalModified += modified;
      totalSkipped += skipped;

    } catch (err) {
      console.error(`  ❌ Error processing collection "${colName}":`, err.message);
    }
  }

  console.log('==================================================');
  console.log('Migration Backfill Completed');
  console.log(`Total Documents Scanned:  ${totalScanned}`);
  console.log(`Total To Be Modified:     ${totalModified}`);
  console.log(`Total Already Scoped:     ${totalSkipped}`);
  console.log('==================================================');
  
  if (isDryRun) {
    console.log('Dry run completed. Run with --apply to write changes to Firestore.');
  } else {
    console.log('Database updates applied successfully.');
  }
  process.exit(0);
}

runBackfill().catch(err => {
  console.error('Migration failed with fatal error:', err);
  process.exit(1);
});
