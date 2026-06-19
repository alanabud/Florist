import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collectionGroup, query, where, getDocs 
} from 'firebase/firestore';

// Read .env
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
  appId: env.VITE_FIREBASE_APP_ID
};

console.log('Initializing Firebase Client SDK...');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testQuery() {
  try {
    console.log('Running collectionGroup("members") query for a dummy userId...');
    const q = query(collectionGroup(db, 'members'), where('userId', '==', 'dummy-uid-12345'));
    const snap = await getDocs(q);
    console.log(`Query succeeded! Found ${snap.size} documents.`);
  } catch (error) {
    console.error('Query failed with error:');
    console.error(error);
  }
}

testQuery();
