import admin from 'firebase-admin';
import fs from 'fs';

async function test() {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId;

  console.log(`Testing environment variables solution for project: ${projectId}, database: ${databaseId}`);

  // Try setting environment variables
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  if (databaseId) {
    process.env.FIRESTORE_DB = databaseId;
    process.env.FIRESTORE_DATABASE = databaseId;
  }

  admin.initializeApp({
    projectId: projectId,
  });

  if (databaseId) {
    admin.firestore().settings({ databaseId });
  }

  const dbAdmin = admin.firestore();

  try {
    console.log('Attempting to fetch fcm-tokens...');
    const snap = await dbAdmin.collection('fcm-tokens').limit(1).get();
    console.log('SUCCESS! Fetched tokens count:', snap.size);
  } catch (err: any) {
    console.error('FAILURE fetching fcm-tokens:', err);
  }

  try {
    console.log('Attempting to fetch settings/system...');
    const snap = await dbAdmin.collection('settings').doc('system').get();
    console.log('SUCCESS! settings/system exists:', snap.exists);
  } catch (err: any) {
    console.error('FAILURE fetching settings/system:', err);
  }
}

test();
