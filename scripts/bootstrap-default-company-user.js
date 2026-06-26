/**
 * Bootstrap a DEFAULT_COMPANY membership for an existing auth user, by email.
 *
 * Uses the Firebase Admin SDK (privileged) to resolve the user's UID from their
 * email and provision the documents required for the app's company-context
 * hydration. This is the ONLY supported way to grant company access — the
 * client app no longer self-creates memberships.
 *
 * Usage:
 *   node scripts/bootstrap-default-company-user.js user@gmail.com [role]
 *   role defaults to "owner". Valid: owner | admin | manager | dispatcher |
 *   driver | designer | sales | accountant | viewer
 *
 * Credentials (pick one):
 *   1. GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccountKey.json
 *   2. Place serviceAccountKey.json in the project root (gitignored)
 *   3. Application Default Credentials (e.g. `gcloud auth application-default login`)
 *
 * Ensures:
 *   /companies/DEFAULT_COMPANY
 *   /companies/DEFAULT_COMPANY/settings/profile
 *   /companies/DEFAULT_COMPANY/members/{uid}
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ── Read projectId from .env ──
function readEnv() {
  const env = {};
  const envPath = path.join(projectRoot, '.env');
  if (!fs.existsSync(envPath)) return env;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!m) continue;
    let v = m[2] || '';
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

const env = readEnv();
const projectId = env.VITE_FIREBASE_PROJECT_ID;

// ── Resolve Admin credentials ──
function resolveCredential() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }
  const localKey = path.join(projectRoot, 'serviceAccountKey.json');
  if (fs.existsSync(localKey)) {
    const sa = JSON.parse(fs.readFileSync(localKey, 'utf8'));
    return admin.credential.cert(sa);
  }
  // Fall back to ADC (gcloud auth application-default login)
  return admin.credential.applicationDefault();
}

try {
  admin.initializeApp({ credential: resolveCredential(), projectId });
} catch (e) {
  console.error('❌ Failed to initialize Firebase Admin SDK.');
  console.error('   Provide credentials via GOOGLE_APPLICATION_CREDENTIALS,');
  console.error('   a serviceAccountKey.json in the project root, or ADC.');
  console.error('   Underlying error:', e.message || e);
  process.exit(1);
}

const auth = admin.auth();
const db = admin.firestore();

const VALID_ROLES = ['owner', 'admin', 'manager', 'dispatcher', 'driver', 'designer', 'sales', 'accountant', 'viewer'];
const COMPANY_ID = 'DEFAULT_COMPANY';

async function ensureCompany() {
  const ref = db.doc(`companies/${COMPANY_ID}`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`• companies/${COMPANY_ID} already exists`);
    return;
  }
  await ref.set({
    id: COMPANY_ID,
    legalName: 'BloomPro Studio Demo Inc.',
    displayName: 'BloomPro Studio Demo',
    companyCode: 'BPS',
    countryCode: 'US',
    baseCurrencyCode: 'USD',
    defaultLanguage: 'en-US',
    timezone: 'America/New_York',
    fiscalYearStartMonth: 1,
    status: 'active',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    createdBy: 'system-seed',
  });
  console.log(`✅ created companies/${COMPANY_ID}`);
}

async function ensureSettings() {
  const ref = db.doc(`companies/${COMPANY_ID}/settings/profile`);
  const snap = await ref.get();
  if (snap.exists) {
    console.log(`• companies/${COMPANY_ID}/settings/profile already exists`);
    return;
  }
  await ref.set({
    companyId: COMPANY_ID,
    defaultLanguage: 'en-US',
    enabledLanguages: ['en-US', 'es-US', 'fr-FR', 'nl-NL'],
    baseCurrencyCode: 'USD',
    enabledCurrencies: ['USD', 'EUR'],
    timezone: 'America/New_York',
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    numberFormatLocale: 'en-US',
    fiscalYearStartMonth: 1,
    closePeriodPolicy: 'open',
    invoicePrefix: 'INV-BPS',
    orderPrefix: 'ORD-BPS',
    purchaseOrderPrefix: 'PO-BPS',
    paymentPrefix: 'PAY-BPS',
    adjustmentPrefix: 'ADJ-BPS',
    journalEntryPrefix: 'JE-BPS',
    taxLabel: 'Sales Tax',
    defaultTaxRate: 0.08875,
    reportFooterText: 'BloomPro Studio Demo - Executive Ledger Copy',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  console.log(`✅ created companies/${COMPANY_ID}/settings/profile`);
}

async function ensureMembership(userRecord, role) {
  const uid = userRecord.uid;
  const email = userRecord.email;
  const displayName = userRecord.displayName || (email ? email.split('@')[0] : uid);
  const ref = db.doc(`companies/${COMPANY_ID}/members/${uid}`);
  const snap = await ref.get();
  const now = admin.firestore.FieldValue.serverTimestamp();

  const data = {
    uid,
    userId: uid, // app + collectionGroup rules query on userId
    companyId: COMPANY_ID,
    email,
    displayName,
    role,
    status: 'active',
    updatedAt: now,
    ...(snap.exists ? {} : { createdAt: now, joinedAt: new Date().toISOString() }),
  };

  await ref.set(data, { merge: true });
  console.log(`${snap.exists ? '✅ updated' : '✅ created'} companies/${COMPANY_ID}/members/${uid} (role: ${role}, status: active)`);
}

async function main() {
  const email = process.argv[2];
  const role = (process.argv[3] || 'owner').toLowerCase();

  if (!email) {
    console.error('Usage: node scripts/bootstrap-default-company-user.js <email> [role]');
    process.exit(1);
  }
  if (!VALID_ROLES.includes(role)) {
    console.error(`❌ Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
    process.exit(1);
  }
  if (!projectId) {
    console.error('❌ VITE_FIREBASE_PROJECT_ID not found in .env');
    process.exit(1);
  }

  console.log(`\n=== Bootstrap DEFAULT_COMPANY membership ===`);
  console.log(`Project: ${projectId}`);
  console.log(`Email:   ${email}`);
  console.log(`Role:    ${role}\n`);

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    console.log(`✅ Resolved UID: ${userRecord.uid}`);
  } catch (e) {
    if (e.code === 'auth/user-not-found') {
      console.error(`❌ No auth user with email ${email}. Have them sign in once first (Google/email), then re-run.`);
    } else {
      console.error(`❌ Failed to resolve user by email:`, e.message || e);
    }
    process.exit(1);
  }

  await ensureCompany();
  await ensureSettings();
  await ensureMembership(userRecord, role);

  console.log(`\n🎉 Done. ${email} is now an active "${role}" of ${COMPANY_ID}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Unexpected failure:', e.message || e);
  process.exit(1);
});
