/**
 * Authenticated cross-company Firestore rules isolation tests.
 *
 * Runs against the Firestore EMULATOR via @firebase/rules-unit-testing so it is
 * deterministic and isolated (no live data, no Admin-provisioned accounts).
 * Auth contexts are realistic authenticated users; the admin (rules-disabled)
 * context is used ONLY to seed fixtures, never for assertions.
 *
 * Run with:  firebase emulators:exec --only firestore "node test-cross-company-rules.mjs"
 *
 * NOTE ON OUTPUT: the Firestore emulator verbosely logs every DENIED operation
 * (Java "WARNING: ... evaluation error ... false ... @ L485" stack traces). Those
 * are EXPECTED — each corresponds to an assertFails() below (a cross-company /
 * spoof / role-escalation write the rules correctly reject). A "Connection reset"
 * SocketException at the end is just the emulator shutting down. Neither is a
 * failure; this script reports its own pass/fail tally and sets the exit code.
 *
 * Proves:
 *   1. A member of company A can read/write allowed company A docs
 *   2. A member of company A cannot read company B docs
 *   3. A member of company A cannot write/update/delete company B docs
 *   4. Unauthenticated access is denied
 *   5. companyId spoofing (create/update into another company) is denied
 *   6. Role/member boundaries hold (viewer vs admin; member-roster access)
 */
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, setLogLevel } from 'firebase/firestore';

// Silence the client SDK's expected PERMISSION_DENIED console noise — every
// assertFails() below triggers a denied write the SDK would otherwise log.
// Assertions still work (only logging is muted, not the thrown errors).
setLogLevel('silent');

const COMPANY_A = 'company-a';
const COMPANY_B = 'company-b';

let passed = 0;
let failed = 0;
const allow = async (label, op) => {
  try { await assertSucceeds(op()); console.log(`  ✅ ALLOW  ${label}`); passed++; }
  catch (e) { console.log(`  ❌ ALLOW  ${label} — expected success: ${e.message}`); failed++; }
};
const deny = async (label, op) => {
  try { await assertFails(op()); console.log(`  ✅ DENY   ${label}`); passed++; }
  catch (e) { console.log(`  ❌ DENY   ${label} — expected denial: ${e.message}`); failed++; }
};

const testEnv = await initializeTestEnvironment({
  projectId: 'florist-rules-test',
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

// ── Seed fixtures with rules disabled (setup only) ──
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, `companies/${COMPANY_A}`), { id: COMPANY_A, companyId: COMPANY_A, status: 'active', createdBy: 'seed' });
  await setDoc(doc(db, `companies/${COMPANY_B}`), { id: COMPANY_B, companyId: COMPANY_B, status: 'active', createdBy: 'seed' });
  await setDoc(doc(db, `companies/${COMPANY_A}/members/userA`), { userId: 'userA', companyId: COMPANY_A, role: 'admin', status: 'active' });
  await setDoc(doc(db, `companies/${COMPANY_A}/members/userViewer`), { userId: 'userViewer', companyId: COMPANY_A, role: 'viewer', status: 'active' });
  await setDoc(doc(db, `companies/${COMPANY_B}/members/userB`), { userId: 'userB', companyId: COMPANY_B, role: 'admin', status: 'active' });
  await setDoc(doc(db, 'orders/orderA'), { companyId: COMPANY_A, status: 'confirmed', total: 10 });
  await setDoc(doc(db, 'orders/orderB'), { companyId: COMPANY_B, status: 'confirmed', total: 20 });
  await setDoc(doc(db, 'branches/branchA'), { companyId: COMPANY_A, branchCode: 'A1', displayName: 'A One', status: 'active', createdAt: new Date().toISOString(), createdBy: 'seed' });
  await setDoc(doc(db, 'branches/branchB'), { companyId: COMPANY_B, branchCode: 'B1', displayName: 'B One', status: 'active', createdAt: new Date().toISOString(), createdBy: 'seed' });
});

const aDb = testEnv.authenticatedContext('userA').firestore();          // admin of company A
const viewerDb = testEnv.authenticatedContext('userViewer').firestore(); // viewer of company A
const unauthDb = testEnv.unauthenticatedContext().firestore();

console.log('\n=== AUTHENTICATED CROSS-COMPANY RULES ISOLATION ===\n');

console.log('[1] Company A member can access company A data');
await allow('A reads own company doc', () => getDoc(doc(aDb, `companies/${COMPANY_A}`)));
await allow('A reads company A order', () => getDoc(doc(aDb, 'orders/orderA')));
await allow('A creates company A order', () => setDoc(doc(aDb, 'orders/newA'), { companyId: COMPANY_A, status: 'confirmed', total: 5 }));
await allow('A updates company A order (companyId unchanged)', () => updateDoc(doc(aDb, 'orders/orderA'), { status: 'scheduled' }));
await allow('A reads own membership doc', () => getDoc(doc(aDb, `companies/${COMPANY_A}/members/userA`)));

console.log('\n[2] Company A member CANNOT read company B data');
await deny('A reads company B doc', () => getDoc(doc(aDb, `companies/${COMPANY_B}`)));
await deny('A reads company B order', () => getDoc(doc(aDb, 'orders/orderB')));
await deny("A reads company B member's doc", () => getDoc(doc(aDb, `companies/${COMPANY_B}/members/userB`)));

console.log('\n[3] Company A member CANNOT write/update/delete company B data');
await deny('A updates company B order', () => updateDoc(doc(aDb, 'orders/orderB'), { status: 'cancelled' }));
await deny('A deletes company B order', () => deleteDoc(doc(aDb, 'orders/orderB')));
await deny('A creates order in company B', () => setDoc(doc(aDb, 'orders/intoB'), { companyId: COMPANY_B, status: 'confirmed', total: 5 }));

console.log('\n[4] Unauthenticated access is denied');
await deny('Guest reads company A order', () => getDoc(doc(unauthDb, 'orders/orderA')));
await deny('Guest reads company A doc', () => getDoc(doc(unauthDb, `companies/${COMPANY_A}`)));

console.log('\n[5] companyId spoofing is denied');
await deny('A creates doc tagged company B (create spoof)', () => setDoc(doc(aDb, 'orders/spoofB'), { companyId: COMPANY_B, status: 'confirmed', total: 5 }));
await deny('A re-tags own order to company B (update spoof)', () => updateDoc(doc(aDb, 'orders/orderA'), { companyId: COMPANY_B }));

console.log('\n[6] Role / member boundaries hold');
await allow('A (admin) creates a journal entry in company A', () => setDoc(doc(aDb, 'journalEntries/jeA'), { companyId: COMPANY_A, status: 'posted', sourceType: 'order', lines: [{ account: 'Cash', debit: 1, credit: 0 }, { account: 'Sales Revenue', debit: 0, credit: 1 }] }));
await deny('Viewer (non-staff) creates a journal entry in company A', () => setDoc(doc(viewerDb, 'journalEntries/jeV'), { companyId: COMPANY_A, status: 'posted', sourceType: 'order', lines: [{ account: 'Cash', debit: 1, credit: 0 }, { account: 'Sales Revenue', debit: 0, credit: 1 }] }));
await deny('Viewer (non-admin) adds a member to company A', () => setDoc(doc(viewerDb, `companies/${COMPANY_A}/members/hacker`), { userId: 'hacker', companyId: COMPANY_A, role: 'admin', status: 'active' }));
await deny('A (admin of A) adds a member to company B', () => setDoc(doc(aDb, `companies/${COMPANY_B}/members/hacker`), { userId: 'hacker', companyId: COMPANY_B, role: 'admin', status: 'active' }));

console.log('\n[7] Branch operations respect company isolation');
const branch = (companyId, code) => ({ companyId, branchCode: code, displayName: code, status: 'active', createdAt: new Date().toISOString(), createdBy: 'userA' });
await allow('A reads a company A branch', () => getDoc(doc(aDb, 'branches/branchA')));
await deny('A reads a company B branch', () => getDoc(doc(aDb, 'branches/branchB')));
await allow('A (staff) creates a company A branch', () => setDoc(doc(aDb, 'branches/newBranchA'), branch(COMPANY_A, 'NYC')));
await deny('A creates a branch tagged company B (spoof)', () => setDoc(doc(aDb, 'branches/spoofBranchB'), branch(COMPANY_B, 'XXX')));
await deny('Viewer (non-staff) creates a company A branch', () => setDoc(doc(viewerDb, 'branches/viewerBranch'), { ...branch(COMPANY_A, 'VVV'), createdBy: 'userViewer' }));
await deny('Guest reads a company A branch', () => getDoc(doc(unauthDb, 'branches/branchA')));

await testEnv.cleanup();

console.log('\n==================================================');
if (failed > 0) {
  console.error(`❌ Cross-company isolation tests FAILED: ${failed} failed, ${passed} passed.`);
  process.exit(1);
} else {
  console.log(`✅ Cross-company isolation: all ${passed} assertions passed.`);
  process.exit(0);
}
