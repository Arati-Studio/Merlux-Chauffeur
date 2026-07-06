import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, collection, getDocs, limit } from 'firebase/firestore';
import fs from 'fs';

async function test() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY || config.apiKey,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId,
    appId: process.env.VITE_FIREBASE_APP_ID || config.appId,
    measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || config.measurementId,
  };

  const firestoreDatabaseId = config.firestoreDatabaseId;

  console.log('Initializing Client SDK on server-side with config:', {
    projectId: firebaseConfig.projectId,
    databaseId: firestoreDatabaseId
  });

  const app = initializeApp(firebaseConfig);
  const db = initializeFirestore(app, {}, firestoreDatabaseId || undefined);

  try {
    console.log('Testing connection to settings/system via client SDK...');
    const snap = await getDoc(doc(db, 'settings', 'system'));
    console.log('SUCCESS! settings/system exists:', snap.exists());
    if (snap.exists()) {
      console.log('Data:', snap.data());
    }
  } catch (err: any) {
    console.error('FAILURE testing settings/system via client SDK:', err);
  }

  try {
    console.log('Testing connection to fcm-tokens via client SDK...');
    const snap = await getDocs(collection(db, 'fcm-tokens'));
    console.log('SUCCESS! fcm-tokens count:', snap.size);
  } catch (err: any) {
    console.error('FAILURE testing fcm-tokens via client SDK:', err);
  }
}

test();
