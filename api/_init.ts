import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig = { projectId: '', firestoreDatabaseId: '' };

try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (error: any) {
  console.error('Failed to load firebase-applet-config.json:', error?.message || error);
}

if (!admin.apps.length) {
  delete process.env.FIREBASE_CONFIG;
  delete process.env.GOOGLE_CLOUD_PROJECT;

  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });

  if (firebaseConfig.firestoreDatabaseId) {
    admin.firestore().settings({ databaseId: firebaseConfig.firestoreDatabaseId });
  }
}

const dbAdmin = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2022-11-15',
});

export { dbAdmin, stripe };
export const getAppUrl = () => process.env.APP_URL || 'http://localhost:3000';
export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
