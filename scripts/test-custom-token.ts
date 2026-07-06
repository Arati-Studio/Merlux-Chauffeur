import admin from 'firebase-admin';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithCustomToken } from 'firebase/auth';
import fs from 'fs';

async function test() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId;

  console.log('Initializing admin SDK locally...');
  // Initialize admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: projectId,
    });
  }

  // Generate a custom token for the admin user ID
  const adminUid = '66vvTKMyaxYasRt1dpNjJuXm7zq1';
  console.log('Generating custom token for admin UID:', adminUid);
  const customToken = await admin.auth().createCustomToken(adminUid);
  console.log('Custom token generated successfully!');

  // Initialize client SDK
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || config.apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
    projectId: projectId,
    storageBucket: config.storageBucket,
    messagingSenderId: config.messagingSenderId,
    appId: config.appId,
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = initializeFirestore(app, {}, databaseId || undefined);

  console.log('Signing in with custom token...');
  await signInWithCustomToken(auth, customToken);
  console.log('Successfully signed in to Client SDK as:', auth.currentUser?.uid);

  try {
    console.log('Attempting to fetch fcm-tokens collection...');
    const snap = await getDocs(collection(db, 'fcm-tokens'));
    console.log('SUCCESS! fcm-tokens size:', snap.size);
  } catch (err: any) {
    console.error('FAILURE fetching fcm-tokens:', err);
  }
}

test().catch(console.error);
