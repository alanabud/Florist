/**
 * One-time repair for order-document id integrity.
 *
 * Background: the legacy admin create path wrote orders with id: '' (patched in
 * a follow-up write) and then ALSO called store.addOrder, which created a full
 * duplicate document whose data.id points at the first document. The legacy
 * storefront checkout stored fabricated 'ord-<n>' ids. All of that is fixed in
 * code (single-write create); this script repairs the documents left behind.
 *
 * Classification per order doc in the company:
 *   OK          data.id === doc.id                       -> untouched
 *   DUPLICATE   data.id === some OTHER doc's id           -> artifact of the
 *               double-write; deleted only with --delete-dupes
 *   BAD_ID      data.id empty or not any real doc id      -> with --apply, set
 *               id/documentId := doc.id (single-field-style repair, idempotent)
 *
 * Usage (credentials of a company staff/owner account via env):
 *   SMOKE_AUTH_EMAIL=... SMOKE_AUTH_PASSWORD=... node scripts/repair-order-ids.mjs            # dry-run report
 *   ... node scripts/repair-order-ids.mjs --apply                                             # repair BAD_ID docs
 *   ... node scripts/repair-order-ids.mjs --apply --delete-dupes                              # also delete DUPLICATE docs
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, collection, query, where, getDocs, updateDoc, deleteDoc, doc, setLogLevel
} from 'firebase/firestore';
import fs from 'fs';

setLogLevel('silent');

const APPLY = process.argv.includes('--apply');
const DELETE_DUPES = process.argv.includes('--delete-dupes');
const COMPANY_ID = process.env.REPAIR_COMPANY_ID || 'DEFAULT_COMPANY';
const EMAIL = process.env.SMOKE_AUTH_EMAIL;
const PASSWORD = process.env.SMOKE_AUTH_PASSWORD;
if (!EMAIL || !PASSWORD) {
  console.error('Set SMOKE_AUTH_EMAIL / SMOKE_AUTH_PASSWORD (a company staff/owner account).');
  process.exit(1);
}

// Firebase web config from .env (same source the app uses)
const env = {};
fs.readFileSync('.env', 'utf8').split(/\r?\n/).forEach((l) => {
  const m = l.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (m) {
    let v = m[2] || '';
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
});
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);
await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);

const snap = await getDocs(query(collection(db, 'orders'), where('companyId', '==', COMPANY_ID)));
const orders = snap.docs.map((d) => ({ docId: d.id, data: d.data() }));
const docIds = new Set(orders.map((o) => o.docId));

const ok = [];
const duplicates = [];
const badIds = [];
for (const o of orders) {
  const storedId = o.data.id || '';
  if (storedId === o.docId) ok.push(o);
  else if (storedId && docIds.has(storedId)) duplicates.push(o); // points at ANOTHER real doc -> double-write artifact
  else badIds.push(o); // empty or fabricated ('ord-…') id
}

const label = (o) =>
  `${o.docId.substring(0, 10)}  storedId="${(o.data.id || '').substring(0, 14)}"  status=${o.data.status}  ` +
  `orderNumber=${o.data.orderNumber || '(none)'}  customer="${(o.data.customerName || '').substring(0, 32)}"`;

console.log(`Company ${COMPANY_ID}: ${orders.length} order docs — OK ${ok.length}, BAD_ID ${badIds.length}, DUPLICATE ${duplicates.length}\n`);
if (badIds.length) {
  console.log('BAD_ID (repairable — id/documentId := docId):');
  badIds.forEach((o) => console.log('  ' + label(o)));
}
if (duplicates.length) {
  console.log('\nDUPLICATE (data.id points at another existing doc — deletable with --delete-dupes):');
  duplicates.forEach((o) => console.log(`  ${label(o)}  -> primary=${o.data.id.substring(0, 10)}`));
}

if (!APPLY) {
  console.log('\nDry-run only. Re-run with --apply to repair BAD_ID docs' + (duplicates.length ? ' (and optionally --delete-dupes).' : '.'));
  process.exit(0);
}

let repaired = 0;
for (const o of badIds) {
  await updateDoc(doc(db, 'orders', o.docId), { id: o.docId, documentId: o.docId });
  repaired++;
}
console.log(`\nRepaired ${repaired} BAD_ID doc(s).`);

if (DELETE_DUPES && duplicates.length) {
  let deleted = 0;
  for (const o of duplicates) {
    await deleteDoc(doc(db, 'orders', o.docId));
    deleted++;
    console.log(`  deleted duplicate ${o.docId.substring(0, 10)} (primary ${o.data.id.substring(0, 10)} kept)`);
  }
  console.log(`Deleted ${deleted} duplicate doc(s).`);
} else if (duplicates.length) {
  console.log(`Left ${duplicates.length} DUPLICATE doc(s) untouched (re-run with --delete-dupes to remove).`);
}
process.exit(0);
