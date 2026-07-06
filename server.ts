import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import twilio from 'twilio';
import nodemailer from 'nodemailer';

dotenv.config();

let currentDirName = '';
try {
  if (typeof __dirname !== 'undefined' && __dirname) {
    currentDirName = __dirname;
  } else {
    currentDirName = path.dirname(fileURLToPath(import.meta.url));
  }
} catch (e) {
  try {
    currentDirName = path.dirname(fileURLToPath(import.meta.url));
  } catch (err) {}
}
const __dirnameResolved = currentDirName || '.';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId;

  console.log(`Initializing Firebase Admin for project: ${projectId}, database: ${databaseId}`);
  
  // CRITICAL: Explicitly clear environment-level Firebase configuration to force SDK 
  // to use the provided project ID instead of environment-detected one.
  delete process.env.FIREBASE_CONFIG;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  
  admin.initializeApp({
    projectId: projectId,
  });
  console.log(`Firebase Admin initialized with project: ${projectId}`);

  if (databaseId) {
    admin.firestore().settings({ databaseId });
  }
}

import { dbAdminClient } from './src/lib/clientDbAdapter.js';
const dbAdmin = dbAdminClient;

// Pre-render Static Site Generation (SSG) metadata cache
let metadataCache: Record<string, any> = {};
const cachePathPublic = path.resolve('./public/metadata-cache.json');
const cachePathDist = path.resolve('./dist/metadata-cache.json');

const loadMetadataCache = () => {
  try {
    if (fs.existsSync(cachePathDist)) {
      metadataCache = JSON.parse(fs.readFileSync(cachePathDist, 'utf8'));
      console.log(`[SSG Cache] Successfully loaded ${Object.keys(metadataCache).length} static metadata entries from dist/metadata-cache.json`);
    } else if (fs.existsSync(cachePathPublic)) {
      metadataCache = JSON.parse(fs.readFileSync(cachePathPublic, 'utf8'));
      console.log(`[SSG Cache] Successfully loaded ${Object.keys(metadataCache).length} static metadata entries from public/metadata-cache.json`);
    } else {
      console.log('[SSG Cache] No pre-rendered metadata cache file found. Falling back to dynamic Firestore fetch.');
    }
  } catch (err) {
    console.error('[SSG Cache] Error reading metadata cache file:', err);
  }
};
loadMetadataCache();

let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not configured.');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

async function startServer() {
  const app = express();
  app.set('trust proxy', true);
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Stripe Checkout Session Endpoint
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { bookingData, vehicleName, cancelUrl } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set');
      }

      const bookingDataString = JSON.stringify(bookingData);

      const description = bookingData.dropoff && bookingData.dropoff !== 'N/A' 
        ? `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup} to ${bookingData.dropoff}`
        : `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup}`;

      const session = await getStripe().checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'aud',
              product_data: {
                name: `Chauffeur Service: ${vehicleName}`,
                description: description,
              },
              unit_amount: Math.round(bookingData.price * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.APP_URL || 'http://localhost:3000'}/booking`,
        metadata: {
          bookingDataChunk1: bookingDataString.substring(0, 450),
          bookingDataChunk2: bookingDataString.substring(450, 900),
          bookingDataChunk3: bookingDataString.substring(900, 1350),
          bookingDataChunk4: bookingDataString.substring(1350, 1800),
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Stripe Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/checkout-session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create User in Auth
  app.post('/api/admin/create-user', async (req, res) => {
    try {
      const { email, password, displayName, role, phone, address } = req.body;
      
      console.log(`Attempting to create user: ${email} in project ${admin.app().options.projectId}`);

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email: email.toLowerCase(),
        password,
        displayName,
        phoneNumber: phone || undefined,
      });

      // Create user document in Firestore
      await dbAdmin.collection('users').doc(userRecord.uid).set({
        id: userRecord.uid,
        name: displayName,
        email: email.toLowerCase(),
        phone: phone || '',
        address: address || '',
        role: role || 'customer',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error('Error creating user:', error);
      const errStr = String(error.message || error);
      
      // Check if it's the Identity Toolkit/Authentication API disabled error
      if (
        errStr.includes('identitytoolkit') || 
        errStr.includes('Identity Toolkit') || 
        errStr.includes('SERVICE_DISABLED') || 
        errStr.includes('PERMISSION_DENIED') || 
        error.code === 'auth/api-error'
      ) {
        console.warn('Identity Toolkit/Auth API is disabled. Bypassing Auth layer and saving to Firestore...');
        try {
          const { email, displayName, role, phone, address } = req.body;
          const fallbackUid = 'local-user-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
          
          await dbAdmin.collection('users').doc(fallbackUid).set({
            id: fallbackUid,
            name: displayName || email.split('@')[0],
            email: email.toLowerCase(),
            phone: phone || '',
            address: address || '',
            role: role || 'customer',
            emailVerified: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            authDisabledFallback: true
          });
          
          return res.json({
            success: true,
            uid: fallbackUid,
            warning: "Identity Toolkit API is disabled in your project. Bypassed authentication layer: user profile created directly in database, so this user can be assigned driver roles or booking references."
          });
        } catch (dbError: any) {
          console.error('Failed to create fallback user in Firestore:', dbError);
          return res.status(500).json({ error: `Database fallback creation failed: ${dbError.message}` });
        }
      }
      
      res.status(500).json({ error: error.message || String(error), code: error.code });
    }
  });

  // Admin: Delete User
  app.post('/api/admin/delete-user', async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      console.log(`Attempting to delete user: ${userId}`);

      // Try to delete from Firebase Auth first
      try {
        await admin.auth().deleteUser(userId);
        console.log(`Deleted user ${userId} from Auth`);
      } catch (authError: any) {
        console.warn(`Auth deletion skipped/failed for user ${userId}:`, authError.message || String(authError));
      }

      // Delete from Firestore
      await dbAdmin.collection('users').doc(userId).delete();
      console.log(`Deleted user document ${userId} from Firestore`);

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error in delete user handler:', error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Twilio SMS Notification Endpoint
  app.post('/api/send-sms', async (req, res) => {
    try {
      const { to, message } = req.body;

      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.warn('Twilio configuration is missing in environment variables.');
        return res.status(400).json({ error: 'Twilio configuration is missing' });
      }

      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      const response = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      res.json({ success: true, sid: response.sid });
    } catch (error: any) {
      if (error.code === 20003) {
        console.error('Twilio Auth Error: Invalid API keys. Please verify your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
        return res.status(401).json({ error: 'Twilio Authentication Failed' });
      }
      console.error('Twilio SMS Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Email Notification Endpoint
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, html } = req.body;

      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
        console.warn('SMTP configuration is missing in environment variables.');
        return res.status(400).json({ error: 'SMTP configuration is missing' });
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error('Email Send Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Manual Sitemap Generation Endpoint
  app.post('/api/admin/generate-sitemap', async (req, res) => {
    try {
      const { exec } = await import('child_process');
      const scriptPath = path.join(process.cwd(), 'scripts', 'generate-sitemap.ts');
      
      console.log(`Manual sitemap trigger executing: npx tsx "${scriptPath}"`);
      
      exec(`npx tsx "${scriptPath}"`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Sitemap generation execution error: ${error.message}`);
          return res.status(500).json({ success: false, error: error.message, stderr: stderr || '' });
        }
        console.log(`Sitemap generation execution success:\n${stdout}`);
        res.json({ success: true, message: 'Sitemap files regenerated successfully.', stdout });
      });
    } catch (err: any) {
      console.error('Error in manual sitemap trigger:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Support real database feedback mirroring in development
  app.post('/api/dev/sync-back', async (req, res) => {
    try {
      const { type, content } = req.body;
      if (!type || !content) {
        return res.status(400).json({ error: 'Missing type or content' });
      }
      const allowedTypes = ['settingsFallback', 'cmsFallback', 'floatingFallback', 'faqFallback'];
      if (!allowedTypes.includes(type)) {
        return res.status(400).json({ error: 'Invalid type' });
      }

      const filePath = path.join(process.cwd(), 'src', 'data', 'fallback', `${type}.ts`);
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`[Sync-Back] Successfully synced dynamic fallback: ${type}.ts`);
      res.json({ success: true, message: `Synced ${type} fallback successfully.` });
    } catch (err: any) {
      console.error('Sync-back error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get Firebase client configuration dynamically (safe for public consumption/service workers)
  app.get('/api/firebase-config', (req, res) => {
    try {
      const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
      res.json({
        apiKey: process.env.VITE_FIREBASE_API_KEY || config.apiKey,
        authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || config.authDomain,
        projectId: process.env.VITE_FIREBASE_PROJECT_ID || config.projectId,
        storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || config.storageBucket,
        messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || config.messagingSenderId,
        appId: process.env.VITE_FIREBASE_APP_ID || config.appId,
        measurementId: process.env.VITE_FIREBASE_MEASUREMENT_ID || config.measurementId,
        firestoreDatabaseId: config.firestoreDatabaseId || ''
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Local FCM tokens persistence registry
  const localFcmPath = path.resolve('./public/fcm-tokens-local.json');
  let localFcmTokens: Array<{ token: string; userId?: string; deviceType?: string }> = [];

  const loadLocalFcmTokens = () => {
    try {
      if (fs.existsSync(localFcmPath)) {
        localFcmTokens = JSON.parse(fs.readFileSync(localFcmPath, 'utf8'));
        console.log(`[FCM Registry] Loaded ${localFcmTokens.length} local FCM tokens from ${localFcmPath}`);
      } else {
        localFcmTokens = [];
        console.log('[FCM Registry] No local FCM token file found, starting with empty list.');
      }
    } catch (err) {
      console.error('[FCM Registry] Error reading local FCM tokens:', err);
    }
  };

  const saveLocalFcmTokens = () => {
    try {
      const dir = path.dirname(localFcmPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(localFcmPath, JSON.stringify(localFcmTokens, null, 2), 'utf8');
    } catch (err) {
      console.error('[FCM Registry] Error saving local FCM tokens:', err);
    }
  };

  loadLocalFcmTokens();

  // Register an FCM token locally on the server (bypassing Firestore security rules)
  app.post('/api/fcm/register', (req, res) => {
    try {
      const { token, userId, deviceType } = req.body;
      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      const existingIndex = localFcmTokens.findIndex(item => item.token === token);
      if (existingIndex > -1) {
        localFcmTokens[existingIndex] = { token, userId, deviceType: deviceType || 'web' };
      } else {
        localFcmTokens.push({ token, userId, deviceType: deviceType || 'web' });
      }

      saveLocalFcmTokens();
      console.log(`[FCM Registry] Registered new token. Total tokens: ${localFcmTokens.length}`);
      res.json({ success: true, count: localFcmTokens.length });
    } catch (err: any) {
      console.error('[FCM Registry] Register error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get FCM total subscriber count
  app.get('/api/campaigns/count', (req, res) => {
    try {
      res.json({ count: localFcmTokens.length });
    } catch (err: any) {
      console.error('[FCM Registry] Count error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Sync an externally created campaign (e.g. from Firebase Console Messaging) into the histories database
  app.post('/api/campaigns/sync-external', async (req, res) => {
    try {
      const { title, message, image, url } = req.body;
      if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required' });
      }

      console.log(`[FCM Sync] Syncing external campaign: "${title}"`);

      // Attempt to check if this campaign already exists in Firestore campaigns collection
      try {
        const existingQuery = await dbAdmin.collection('campaigns')
          .where('title', '==', title)
          .where('message', '==', message)
          .limit(1)
          .get();

        if (existingQuery.empty) {
          // If it doesn't exist, create it via admin client to bypass security rules
          const campaignId = 'camp_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
          await dbAdmin.collection('campaigns').doc(campaignId).set({
            id: campaignId,
            title,
            message,
            image: image || null,
            url: url || '/dashboard',
            status: 'sent',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            sentAt: admin.firestore.FieldValue.serverTimestamp()
          });
          console.log(`[FCM Sync] Successfully created external campaign record for: "${title}"`);
          return res.json({ success: true, synced: true });
        } else {
          console.log(`[FCM Sync] External campaign already exists in histories: "${title}"`);
          return res.json({ success: true, synced: false, reason: 'already_exists' });
        }
      } catch (dbErr: any) {
        console.warn('[FCM Sync] Firestore write restricted or failed during sync:', dbErr.message || dbErr);
        // Even if Firestore sync fails, return success to the client
        return res.json({ success: true, synced: false, error: dbErr.message });
      }
    } catch (err: any) {
      console.error('[FCM Sync] General error during external campaign sync:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Push campaign notifications to all registered device tokens
  app.post('/api/campaigns/push', async (req, res) => {
    try {
      const { title, message, image, url } = req.body;
      if (!title || !message) {
        return res.status(400).json({ error: 'Title and message are required' });
      }

      // Initialize tokens with our local registry
      const tokens: string[] = localFcmTokens.map(item => item.token).filter(Boolean);
      console.log(`[FCM Campaign] Push triggered. Local registered tokens: ${tokens.length}`);

      // Attempt to merge from Firestore if permitted (with graceful catch)
      try {
        console.log('[FCM debug] Attempting Firestore fcm-tokens fetch as secondary source...');
        const tokensSnap = await dbAdmin.collection('fcm-tokens').get();
        tokensSnap.forEach(doc => {
          const data = doc.data();
          if (data.token && !tokens.includes(data.token)) {
            tokens.push(data.token);
          }
        });
        console.log('[FCM debug] Firestore fcm-tokens merged. Total unique tokens:', tokens.length);
      } catch (dbErr: any) {
        console.log('[FCM debug] Firestore token fetch restricted (using local registry only):', dbErr.message || dbErr);
      }

      if (tokens.length === 0) {
        return res.json({ 
          success: true, 
          message: 'Campaign pushed successfully! No registered devices found yet to dispatch push notifications.', 
          sentCount: 0 
        });
      }

      // Payload structure for firebase-admin messaging
      const messagePayload = {
        notification: {
          title: title,
          body: message,
          ...(image ? { imageUrl: image } : {})
        },
        data: {
          title: title,
          body: message,
          image: image || '',
          url: url || '/dashboard',
        },
        android: {
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default'
            }
          }
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            title: title,
            body: message,
            icon: '/favicon.ico',
            ...(image ? { image: image } : {})
          }
        }
      };

      let successCount = 0;
      let failureCount = 0;

      // Split into chunks of 500 tokens (limit for multicast send)
      const chunks = [];
      for (let i = 0; i < tokens.length; i += 500) {
        chunks.push(tokens.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        try {
          console.log('[FCM debug] Sending multicast payload to chunk of size:', chunk.length);
          const response = await admin.messaging().sendEachForMulticast({
            tokens: chunk,
            ...messagePayload
          });
          console.log('[FCM debug] Multicast response successCount:', response.successCount, 'failureCount:', response.failureCount);
          successCount += response.successCount;
          failureCount += response.failureCount;

          // Optional: Clean up expired tokens (unregistered/bad device IDs)
          response.responses.forEach(async (resp, idx) => {
            if (!resp.success && resp.error) {
              const code = resp.error.code;
              if (
                code === 'messaging/invalid-registration-token' ||
                code === 'messaging/registration-token-not-registered'
              ) {
                const badToken = chunk[idx];
                const tokenDocs = await dbAdmin.collection('fcm-tokens').where('token', '==', badToken).get();
                const cleanupBatch = dbAdmin.batch();
                tokenDocs.forEach(d => cleanupBatch.delete(d.ref));
                await cleanupBatch.commit();
                console.log(`Cleaned up obsolete token from database.`);
              }
            }
          });
        } catch (mErr: any) {
          console.error('[FCM Multicast] Failed to send to chunk:', mErr);
          failureCount += chunk.length;
        }
      }

      res.json({
        success: true,
        message: `Campaign pushed successfully. Sent to ${successCount} devices, failed on ${failureCount}.`,
        sentCount: successCount,
        failCount: failureCount
      });
    } catch (error: any) {
      console.error('[FCM Campaign Error]:', error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });

  // Favicon Redirect
  app.get('/favicon.ico', async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection('settings').doc('system').get();
      const favicon = settingsSnap.data()?.seo?.favicon;
      if (favicon) {
        return res.redirect(favicon);
      }
    } catch (e) {}
    next();
  });

  // Logo Redirect
  app.get('/logo.png', async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection('settings').doc('system').get();
      const logo = settingsSnap.data()?.seo?.logo;
      if (logo) {
        return res.redirect(logo);
      }
    } catch (e) {}
    next();
  });

  // Helper to get site URL for sitemaps dynamically
  const getSiteUrl = (req: any) => {
    let SITE_URL = process.env.VITE_SITE_URL || '';
    if (!SITE_URL) {
      const host = req.get('host') || '';
      const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1') || host.includes('0.0.0.0');
      const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' || !isLocalhost ? 'https' : 'http';
      SITE_URL = `${protocol}://${host}`;
    }
    if (SITE_URL.endsWith('/')) {
      SITE_URL = SITE_URL.slice(0, -1);
    }
    return SITE_URL;
  };

  const getFormatDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    try {
      let d: Date;
      if (val.seconds !== undefined) {
        d = new Date(val.seconds * 1000);
      } else if (val._seconds !== undefined) {
        d = new Date(val._seconds * 1000);
      } else if (val.toDate && typeof val.toDate === 'function') {
        d = val.toDate();
      } else {
        d = new Date(val);
      }
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
    return new Date().toISOString().split('T')[0];
  };

  // Serve dynamic sitemap index pointing to sub-sitemaps
  app.get('/sitemap_index.xml', async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const todayString = getFormatDate(null);

      const [pagesSnap, blogsSnap, offersSnap, toursSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection('pages').get(),
        dbAdmin.collection('blogs').get(),
        dbAdmin.collection('offers').get(),
        dbAdmin.collection('tours').get(),
        dbAdmin.collection('metadata').get()
      ]);

      const pages = pagesSnap.docs.map(doc => ({ id: doc.id, type: 'Page', ...doc.data() } as any));
      const blogs = blogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const offers = offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const tours = toursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const staticPages = [
        { title: 'Home', slug: '', path: '/' },
        { title: 'Offers', slug: 'offers', path: '/offers' },
        { title: 'Tours', slug: 'tours', path: '/tours' },
        { title: 'Services', slug: 'services', path: '/services' },
        { title: 'Blog', slug: 'blog', path: '/blog' },
        { title: 'Fleet', slug: 'fleet', path: '/fleet' },
        { title: 'FAQ', slug: 'faq', path: '/faq' },
        { title: 'About', slug: 'about', path: '/about' },
        { title: 'Contact', slug: 'contact', path: '/contact' },
        { title: 'Terms and Conditions', slug: 'terms', path: '/terms' },
      ];

      const getMetadataOverride = (routeSlug: string) => {
        const normSlug = (routeSlug || '').toLowerCase();
        const replaced = normSlug.replace(/\//g, '_');
        let override = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug);
        if (!override && replaced) {
          override = metadataDocs.find((d: any) => d.slug === replaced || d.id === replaced);
        }
        return override;
      };

      let pageCount = 0;
      let blogCount = 0;
      let offerCount = 0;
      let tourCount = 0;

      const registeredPaths = new Set<string>();

      // A. Dynamic Pages Collection
      pages.forEach((p: any) => {
        const routeSlug = p.slug || 'home';
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false));
        const active = p.active !== false;

        if (!noindex && active) {
          const cleanPath = p.slug === 'home' || p.slug === '' ? '/' : `/${p.slug}`;
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            pageCount++;
          }
        }
      });

      // B. Static system pages
      staticPages.forEach((sp: any) => {
        const cleanPath = sp.path || '/';
        const routeSlug = sp.slug || 'home';
        const docOverride = getMetadataOverride(routeSlug);
        if (docOverride?.noindex === true) return;

        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          pageCount++;
        }
      });

      // C. Blogs count
      blogs.forEach((b: any) => {
        const routeSlug = `blog/${b.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false));
        const active = b.active !== false;

        if (!noindex && active) {
          blogCount++;
        }
      });

      // D. Offers count
      offers.forEach((o: any) => {
        const routeSlug = `offers/${o.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false));
        const active = o.active !== false;

        if (!noindex && active) {
          offerCount++;
        }
      });

      // E. Tours count
      tours.forEach((t: any) => {
        const routeSlug = `tours/${t.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false));
        const active = t.active !== false;

        if (!noindex && active) {
          tourCount++;
        }
      });

      const sitemapsToInclude = [
        { name: 'page-sitemap.xml', count: pageCount },
        { name: 'blog-sitemap.xml', count: blogCount },
        { name: 'offer-sitemap.xml', count: offerCount },
        { name: 'tours-sitemap.xml', count: tourCount }
      ];

      const sitemapsXML = sitemapsToInclude
        .filter(s => s.count > 0)
        .map(s => `  <sitemap>
    <loc>${SITE_URL}/${s.name}</loc>
    <lastmod>${todayString}</lastmod>
  </sitemap>`)
        .join('\n');

      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapsXML}
</sitemapindex>`.trim();

      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(indexXml);
    } catch (err: any) {
      console.error('Error generating dynamic sitemap index:', err);
      const indexSitemapPath = path.join(process.cwd(), 'dist', 'sitemap_index.xml');
      if (fs.existsSync(indexSitemapPath)) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.sendFile(indexSitemapPath);
      }
      return res.status(500).send('Error generating sitemap index');
    }
  });

  // Serve dynamic flat fallback sitemap.xml containing all URLs directly
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [pagesSnap, blogsSnap, offersSnap, toursSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection('pages').get(),
        dbAdmin.collection('blogs').get(),
        dbAdmin.collection('offers').get(),
        dbAdmin.collection('tours').get(),
        dbAdmin.collection('metadata').get()
      ]);

      const pages = pagesSnap.docs.map(doc => ({ id: doc.id, type: 'Page', ...doc.data() } as any));
      const blogs = blogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const offers = offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const tours = toursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const staticPages = [
        { title: 'Home', slug: '', path: '/' },
        { title: 'Offers', slug: 'offers', path: '/offers' },
        { title: 'Tours', slug: 'tours', path: '/tours' },
        { title: 'Services', slug: 'services', path: '/services' },
        { title: 'Blog', slug: 'blog', path: '/blog' },
        { title: 'Fleet', slug: 'fleet', path: '/fleet' },
        { title: 'FAQ', slug: 'faq', path: '/faq' },
        { title: 'About', slug: 'about', path: '/about' },
        { title: 'Contact', slug: 'contact', path: '/contact' },
        { title: 'Terms and Conditions', slug: 'terms', path: '/terms' },
      ];

      const getMetadataOverride = (routeSlug: string) => {
        const normSlug = (routeSlug || '').toLowerCase();
        const replaced = normSlug.replace(/\//g, '_');
        let override = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug);
        if (!override && replaced) {
          override = metadataDocs.find((d: any) => d.slug === replaced || d.id === replaced);
        }
        return override;
      };

      const sitemapEntries: any[] = [];
      const registeredPaths = new Set<string>();

      // 1. Pages & Static
      pages.forEach((p: any) => {
        const routeSlug = p.slug || 'home';
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false));
        const active = p.active !== false;

        if (!noindex && active) {
          const cleanPath = p.slug === 'home' || p.slug === '' ? '/' : `/${p.slug}`;
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            const updatedAt = docOverride?.updatedAt || p.updatedAt || p.createdAt || null;
            sitemapEntries.push({
              path: cleanPath,
              lastmod: getFormatDate(updatedAt),
              changefreq: cleanPath === '/' ? 'daily' : 'weekly',
              priority: cleanPath === '/' ? '1.0' : '0.8'
            });
          }
        }
      });

      staticPages.forEach((sp: any) => {
        const cleanPath = sp.path || '/';
        const routeSlug = sp.slug || 'home';
        const docOverride = getMetadataOverride(routeSlug);
        if (docOverride?.noindex === true) return;

        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(docOverride?.updatedAt),
            changefreq: cleanPath === '/' ? 'daily' : 'weekly',
            priority: cleanPath === '/' ? '1.0' : '0.8'
          });
        }
      });

      // 2. Blogs
      blogs.forEach((b: any) => {
        const routeSlug = `blog/${b.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false));
        const active = b.active !== false;

        if (!noindex && active) {
          const cleanPath = `/blog/${b.slug}`;
          const updatedAt = docOverride?.updatedAt || b.updatedAt || b.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: 'weekly',
            priority: '0.8'
          });
        }
      });

      // 3. Offers
      offers.forEach((o: any) => {
        const routeSlug = `offers/${o.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false));
        const active = o.active !== false;

        if (!noindex && active) {
          const cleanPath = `/offers/${o.slug}`;
          const updatedAt = docOverride?.updatedAt || o.updatedAt || o.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: 'weekly',
            priority: '0.8'
          });
        }
      });

      // 4. Tours
      tours.forEach((t: any) => {
        const routeSlug = `tours/${t.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false));
        const active = t.active !== false;

        if (!noindex && active) {
          const cleanPath = `/tours/${t.slug}`;
          const updatedAt = docOverride?.updatedAt || t.updatedAt || t.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: 'weekly',
            priority: '0.8'
          });
        }
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`.trim();

      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xml);
    } catch (err: any) {
      console.error('Error generating dynamic flat sitemap fallback:', err);
      const fallbackPath = path.join(process.cwd(), 'dist', 'sitemap.xml');
      if (fs.existsSync(fallbackPath)) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.sendFile(fallbackPath);
      }
      res.status(500).send('Error generating sitemap');
    }
  });

  // Serve dynamic page sitemap
  app.get('/page-sitemap.xml', async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [pagesSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection('pages').get(),
        dbAdmin.collection('metadata').get()
      ]);

      const pages = pagesSnap.docs.map(doc => ({ id: doc.id, type: 'Page', ...doc.data() } as any));
      const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const staticPages = [
        { title: 'Home', slug: '', path: '/' },
        { title: 'Offers', slug: 'offers', path: '/offers' },
        { title: 'Tours', slug: 'tours', path: '/tours' },
        { title: 'Services', slug: 'services', path: '/services' },
        { title: 'Blog', slug: 'blog', path: '/blog' },
        { title: 'Fleet', slug: 'fleet', path: '/fleet' },
        { title: 'FAQ', slug: 'faq', path: '/faq' },
        { title: 'About', slug: 'about', path: '/about' },
        { title: 'Contact', slug: 'contact', path: '/contact' },
        { title: 'Terms and Conditions', slug: 'terms', path: '/terms' },
      ];

      const getMetadataOverride = (routeSlug: string) => {
        const normSlug = (routeSlug || '').toLowerCase();
        const replaced = normSlug.replace(/\//g, '_');
        let override = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug);
        if (!override && replaced) {
          override = metadataDocs.find((d: any) => d.slug === replaced || d.id === replaced);
        }
        return override;
      };

      const sitemapEntries: any[] = [];
      const registeredPaths = new Set<string>();

      // A. Dynamic Pages Collection
      pages.forEach((p: any) => {
        const routeSlug = p.slug || 'home';
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false));
        const active = p.active !== false;

        if (!noindex && active) {
          const cleanPath = p.slug === 'home' || p.slug === '' ? '/' : `/${p.slug}`;
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            const updatedAt = docOverride?.updatedAt || p.updatedAt || p.createdAt || null;
            sitemapEntries.push({
              path: cleanPath,
              lastmod: getFormatDate(updatedAt),
              changefreq: cleanPath === '/' ? 'daily' : 'weekly',
              priority: cleanPath === '/' ? '1.0' : '0.8'
            });
          }
        }
      });

      // B. Static system pages
      staticPages.forEach((sp: any) => {
        const cleanPath = sp.path || '/';
        const routeSlug = sp.slug || 'home';
        const docOverride = getMetadataOverride(routeSlug);
        if (docOverride?.noindex === true) return;

        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(docOverride?.updatedAt),
            changefreq: cleanPath === '/' ? 'daily' : 'weekly',
            priority: cleanPath === '/' ? '1.0' : '0.8'
          });
        }
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`.trim();

      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xml);
    } catch (err: any) {
      console.error('Error generating page sitemap:', err);
      const sitemapPath = path.join(process.cwd(), 'dist', 'page-sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.sendFile(sitemapPath);
      }
      res.status(500).send('Error generating sitemap');
    }
  });

  // Serve dynamic blog sitemap
  app.get('/blog-sitemap.xml', async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [blogsSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection('blogs').get(),
        dbAdmin.collection('metadata').get()
      ]);

      const blogs = blogsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const sitemapEntries: any[] = [];
      blogs.forEach((b: any) => {
        const routeSlug = `blog/${b.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false));
        const active = b.active !== false;

        if (!noindex && active) {
          const cleanPath = `/blog/${b.slug}`;
          const updatedAt = docOverride?.updatedAt || b.updatedAt || b.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: 'weekly',
            priority: '0.8'
          });
        }
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`.trim();

      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xml);
    } catch (err: any) {
      console.error('Error generating blog sitemap:', err);
      const sitemapPath = path.join(process.cwd(), 'dist', 'blog-sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.sendFile(sitemapPath);
      }
      res.status(500).send('Error generating sitemap');
    }
  });

  // Serve dynamic offer sitemap
  app.get('/offer-sitemap.xml', async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [offersSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection('offers').get(),
        dbAdmin.collection('metadata').get()
      ]);

      const offers = offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const sitemapEntries: any[] = [];
      offers.forEach((o: any) => {
        const routeSlug = `offers/${o.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false));
        const active = o.active !== false;

        if (!noindex && active) {
          const cleanPath = `/offers/${o.slug}`;
          const updatedAt = docOverride?.updatedAt || o.updatedAt || o.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: 'weekly',
            priority: '0.8'
          });
        }
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`.trim();

      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xml);
    } catch (err: any) {
      console.error('Error generating offer sitemap:', err);
      const sitemapPath = path.join(process.cwd(), 'dist', 'offer-sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.sendFile(sitemapPath);
      }
      res.status(500).send('Error generating sitemap');
    }
  });

  // Serve dynamic tours sitemap
  app.get('/tours-sitemap.xml', async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [toursSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection('tours').get(),
        dbAdmin.collection('metadata').get()
      ]);

      const tours = toursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const sitemapEntries: any[] = [];
      tours.forEach((t: any) => {
        const routeSlug = `tours/${t.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
        const noindex = t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false));
        const active = t.active !== false;

        if (!noindex && active) {
          const cleanPath = `/tours/${t.slug}`;
          const updatedAt = docOverride?.updatedAt || t.updatedAt || t.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: 'weekly',
            priority: '0.8'
          });
        }
      });

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`.trim();

      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xml);
    } catch (err: any) {
      console.error('Error generating tours sitemap:', err);
      const sitemapPath = path.join(process.cwd(), 'dist', 'tours-sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        return res.sendFile(sitemapPath);
      }
      res.status(500).send('Error generating tours sitemap');
    }
  });

  // Serve compiled visual HTML sitemap directory
  app.get(['/sitemap', '/sitemap.html'], (req, res) => {
    let sitemapHtmlPath = path.join(process.cwd(), 'dist', 'sitemap.html');
    if (!fs.existsSync(sitemapHtmlPath)) {
      sitemapHtmlPath = path.join(process.cwd(), 'public', 'sitemap.html');
    }
    if (fs.existsSync(sitemapHtmlPath)) {
      res.header('Content-Type', 'text/html');
      return res.sendFile(sitemapHtmlPath);
    }
    res.status(404).send('Sitemap HTML directory not found. Please run build first.');
  });

  // Serve sitemap stats JSON file dynamically or fallback default values to prevent HTML parsing crash
  app.get('/sitemap-stats.json', (req, res) => {
    const statsPathPublic = path.join(process.cwd(), 'public', 'sitemap-stats.json');
    const statsPathDist = path.join(process.cwd(), 'dist', 'sitemap-stats.json');
    let statsPath = statsPathDist;
    if (!fs.existsSync(statsPath)) {
      statsPath = statsPathPublic;
    }
    if (fs.existsSync(statsPath)) {
      try {
        const content = fs.readFileSync(statsPath, 'utf-8');
        res.header('Content-Type', 'application/json');
        return res.send(content);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to read sitemap-stats.json' });
      }
    }
    res.json({
      lastGenerated: null,
      totalUrls: 0,
      pages: 0,
      blogs: 0,
      offers: 0,
      tours: 0
    });
  });

  app.get('/robots.txt', (req, res) => {
    const SITE_URL = getSiteUrl(req);
    const robotsPath = path.join(process.cwd(), 'dist', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      return res.sendFile(robotsPath);
    }
    // Explicitly using the full site URL for better sitemap discovery
    res.send(`User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap_index.xml\nSitemap: ${SITE_URL}/sitemap.xml`);
  });

  // Helper for SEO injection
  const injectSEO = async (html: string, req: any) => {
    // Definining comprehensive inline page fallbacks as a guaranteed safety layer
    const corePageFallback: Record<string, { title: string; desc: string; keywords: string[] }> = {
      'home': {
        title: 'Luxury Merlux Chauffeur Offers Premium Transfers',
        desc: 'Experience unparalleled comfort with Luxury Merlux Chauffeur services for all your travel needs in Melbourne.',
        keywords: ['merlux chauffeur', 'luxury chauffeur melbourne', 'chauffeur service', 'home']
      },
      'offers': {
        title: 'Special Offers for Melbourne Airport Transfers Today',
        desc: 'Book premium Melbourne airport transfers today with Merlux Chauffeur Services — enjoy luxury rides at special discounted rates.',
        keywords: ['merlux chauffeur', 'luxury chauffeur melbourne', 'chauffeur service', 'offers']
      },
      'tours': {
        title: 'Melbourne Luxury Private Tours | Merlux Chauffeurs',
        desc: 'Discover scenic beauty on our luxury private tours. Expert chauffeurs and premium vehicles for winery tours, sightseeing, and more.',
        keywords: ['luxury private tours', 'melbourne day tours', 'winery tours melbourne']
      },
      'services': {
        title: 'Chauffeur Services: Luxury on the Road',
        desc: 'Learn why Chauffeur Services are the perfect choice for business trips and special events. Travel in style and comfort effortlessly.',
        keywords: ['merlux chauffeur', 'luxury chauffeur melbourne', 'chauffeur service', 'services']
      },
      'blog': {
        title: 'Merlux Chauffeur Blog Page: Your Travel Companion',
        desc: 'Read the latest news, travel guides, and luxury chauffeur service insights on our blog.',
        keywords: ['blog', 'chauffeur news', 'melbourne travel tips']
      },
      'fleet': {
        title: 'Luxury Car Fleet – Premium Chauffeur Vehicles in Melbourne',
        desc: 'Explore Merlux Chauffeur’s luxury fleet of sedans, SUVs & vans for airport transfers, corporate travel, weddings & tours in Melbourne.',
        keywords: ['merlux chauffeur', 'luxury chauffeur melbourne', 'chauffeur service', 'fleet']
      },
      'faq': {
        title: 'Frequently Asked Questions | Merlux Chauffeur',
        desc: 'Find answers to common questions about Merlux Chauffeur services, bookings, luxury fleet, and travel arrangements in Melbourne.',
        keywords: ['FAQ', 'About Merlux Questions']
      },
      'about': {
        title: 'Learn About Us: Merlux Chauffeur Quality Service',
        desc: 'Learn about us and Merlux Chauffeurs commitment to excellence. Book your ride today for unparalleled travel service.',
        keywords: ['merlux chauffeur', 'luxury chauffeur melbourne', 'chauffeur service', 'about']
      },
      'contact': {
        title: 'Contact Merlux Chauffeur – Book Luxury Transfers Melbourne',
        desc: 'Contact Merlux Chauffeur for luxury transfers, tours & events in Melbourne. Call or email today to book your premium ride.',
        keywords: ['contact-us', 'merlux helpline']
      },
      'terms': {
        title: 'Merlux Terms and Conditions: Essential Guidelines',
        desc: 'Understand the Merlux Terms and Conditions that govern all bookings for our chauffeuring services to secure a seamless experience.',
        keywords: ['Terms Of Service', 'Merlux Terms']
      },
      'booking': {
        title: 'Book a Luxury Chauffeur Melbourne | Merlux Chauffeurs',
        desc: 'Book your luxury chauffeur service online with Merlux. Real-time pricing, instant confirmation, and premium fleet options.',
        keywords: ['book chauffeur online', 'melbourne chauffeur booking', 'luxury car hire']
      }
    };

    const getDynamicFallbackSEO = (cleanPath: string, slug: string) => {
      const isBlog = cleanPath.startsWith('blog/');
      const isOffer = cleanPath.startsWith('offers/');
      const isTour = cleanPath.startsWith('tours/');

      const capitalize = (str: string) => {
        return str
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      };

      const formattedTitle = capitalize(slug || 'Merlux Chauffeurs');

      if (isBlog) {
        return {
          title: `${formattedTitle} | Merlux Chauffeur Blog`,
          desc: `Read our latest article on "${formattedTitle}". Stay updated with luxury travel news, corporate transfers, and chauffeur insights in Melbourne.`,
          keywords: ['blog', slug, 'chauffeur news', 'melbourne travel']
        };
      }

      if (isOffer) {
        return {
          title: `Special Offer: ${formattedTitle} | Merlux`,
          desc: `Exclusive travel special offer on "${formattedTitle}". Enjoy premium luxury chauffeur rides at promotional rates in Melbourne. Book today!`,
          keywords: ['offers', slug, 'discount chauffeur', 'luxury travel specials']
        };
      }

      if (isTour) {
        return {
          title: `${formattedTitle} - Melbourne Private Tours`,
          desc: `Explore the sights with our premium "${formattedTitle}". Custom private day trips, scenic winery tours, and executive chauffeur services in Melbourne.`,
          keywords: ['tours', slug, 'private tours melbourne', 'winery day trip']
        };
      }

      if (slug) {
        const suffixes = [
          { key: '-airport-transfer', titleSuffix: 'Airport Transfer', descPattern: 'Book reliable %s Airport Transfer services. Comfortable, punctual, and professional private luxury chauffeur transport to and from Melbourne Airport.' },
          { key: '-corporate-trips-or-hire', titleSuffix: 'Corporate Trips & Chauffeur Hire', descPattern: 'Professional %s Corporate Trips and executive Chauffeur Hire services. Punctual, discreet luxury transport tailored for corporate executives and teams.' },
          { key: '-event-transfers', titleSuffix: 'Event Transfers', descPattern: 'Ensure smooth guest transport with dependable %s Event Transfers. Luxury chauffeur sedans and vans tailored for any event or private function.' },
          { key: '-executive-hire', titleSuffix: 'Executive Chauffeur Hire', descPattern: 'Premium %s Executive Chauffeur Hire for corporate meetings, VIP transfers, and events. Experience travel comfort in premium Mercedes, BMW, or Audi vehicles.' },
          { key: '-luxury-private-tour', titleSuffix: 'Luxury Private Tour', descPattern: 'Discover scenic spots in style on a %s Luxury Private Tour. Fully customized itineraries and expert tour chauffeurs with premium sedans and SUVs.' },
          { key: '-private-hire', titleSuffix: 'Private Chauffeur Hire', descPattern: 'Experience outstanding travel with %s Private Chauffeur Hire. Enjoy seamless point-to-point journeys in luxury vehicles with professional chauffeurs.' },
          { key: '-special-event-hire', titleSuffix: 'Special Event Car Hire', descPattern: 'Transform your celebrations with our premium %s Special Event Car Hire. Elegant chauffeured vehicles for formals, parties, and milestones.' },
          { key: '-wedding-hire', titleSuffix: 'Wedding Car Hire', descPattern: 'Plan your perfect day with elegant %s Wedding Car Hire. Stunning luxury wedding transport, red carpet service, and expert wedding chauffeurs.' }
        ];

        for (const suffix of suffixes) {
          if (slug.endsWith(suffix.key)) {
            const suburbSlug = slug.substring(0, slug.length - suffix.key.length);
            const suburbName = capitalize(suburbSlug);
            const pageTitle = `${suburbName} ${suffix.titleSuffix}`;
            const pageDesc = suffix.descPattern.replace(/%s/g, suburbName);
            return {
              title: `${pageTitle} | Merlux Chauffeurs`,
              desc: pageDesc,
              keywords: [slug, suburbName, suffix.titleSuffix.toLowerCase(), 'luxury transfer']
            };
          }
        }
      }

      return {
        title: `${formattedTitle} - Luxury Chauffeur Melbourne | Merlux`,
        desc: `Premium chauffeur service for ${formattedTitle} in Melbourne. Book professional luxury private transfers, airport travel, weddings, and corporate trips.`,
        keywords: [slug, 'merlux chauffeur', 'luxury chauffeur melbourne']
      };
    };

    try {
      const url = req.originalUrl;
      const SITE_URL = getSiteUrl(req);
      
      let globalSettings: any = null;
      try {
        const settingsSnap = await dbAdmin.collection('settings').doc('system').get();
        globalSettings = settingsSnap.exists ? settingsSnap.data() : null;
      } catch (err) {
        console.warn('[SEO Safety] Settings query failed (quota or offline), using system defaults.');
      }
      
      const globalSeo = globalSettings?.seo || {};

      let cleanPath = url.split('?')[0];
      cleanPath = cleanPath.replace(/^\/+|\/+$/g, ''); // Remove leading and trailing slashes
      const parts = cleanPath.split('/');
      let slug = parts[parts.length - 1] || '';

      let isBlog = cleanPath.startsWith('blog/');
      let isOffer = cleanPath.startsWith('offers/');
      let isTour = cleanPath.startsWith('tours/');

      let seoData: any = null;

      try {
        if (isBlog) {
          const snap = await dbAdmin.collection('blogs').where('slug', '==', slug).limit(1).get();
          if (!snap.empty) seoData = snap.docs[0].data();
        } else if (isOffer) {
          const snap = await dbAdmin.collection('offers').where('slug', '==', slug).limit(1).get();
          if (!snap.empty) seoData = snap.docs[0].data();
        } else if (isTour) {
          const snap = await dbAdmin.collection('tours').where('slug', '==', slug).limit(1).get();
          if (!snap.empty) seoData = snap.docs[0].data();
        } else if (slug) {
          const snap = await dbAdmin.collection('pages').where('slug', '==', slug).limit(1).get();
          if (!snap.empty) seoData = snap.docs[0].data();
        } else {
          // Home page or other static pages without dynamic slug
          const snap = await dbAdmin.collection('pages').where('slug', '==', 'home').limit(1).get();
          if (!snap.empty) seoData = snap.docs[0].data();
        }
      } catch (err) {
        console.warn(`[SEO Safety] Firestore page query failed for "${cleanPath}" (offline or quota), proceeding with fallback.`);
      }

      const routeSlug = cleanPath || 'home';

      // 1. Fetch from the unified metadata collection to support direct overrides in real time
      let metadataOverride: any = null;
      if (metadataCache && metadataCache[routeSlug]) {
        metadataOverride = metadataCache[routeSlug];
      } else {
        try {
          const docId = routeSlug.replace(/\//g, '_') || 'home';
          const docSnap = await dbAdmin.collection('metadata').doc(docId).get();
          if (docSnap.exists) {
            metadataOverride = docSnap.data();
          } else {
            // fallback query by 'slug' field
            const qSnap = await dbAdmin.collection('metadata').where('slug', '==', routeSlug).limit(1).get();
            if (!qSnap.empty) {
              metadataOverride = qSnap.docs[0].data();
            }
          }
        } catch (err) {
          console.warn(`[SEO Safety] Firestore metadata overrides fetch failed for "${routeSlug}".`);
        }
      }

      // 2. Resolve fallback data for route slug
      const lookupKey = routeSlug === 'home' ? 'home' : (corePageFallback[routeSlug] ? routeSlug : slug);
      const inlineFallback = corePageFallback[lookupKey] || getDynamicFallbackSEO(cleanPath, slug);

      // Merge native data, metadata overrides, and the ultra-resilient inline fallbacks
      const finalSeoData = {
        metaTitle: metadataOverride?.metaTitle || seoData?.metaTitle || seoData?.title || inlineFallback.title,
        metaDescription: metadataOverride?.metaDescription || seoData?.metaDescription || seoData?.seoDescription || seoData?.description || seoData?.shortDescription || inlineFallback.desc,
        keywords: metadataOverride?.keywords || seoData?.keywords || inlineFallback.keywords || [],
        noindex: metadataOverride?.noindex !== undefined ? metadataOverride.noindex : (seoData?.noindex || false),
        schema: metadataOverride?.structuredData || seoData?.schema || seoData?.structuredData || null,
        ogTitle: metadataOverride?.ogTitle || seoData?.ogTitle || '',
        ogDescription: metadataOverride?.ogDescription || seoData?.ogDescription || '',
        ogImage: metadataOverride?.ogImage || seoData?.ogImage || seoData?.featuredImage || seoData?.image || null,
        ogUrl: metadataOverride?.ogUrl || seoData?.ogUrl || null,
        canonicalUrl: seoData?.canonicalUrl || null,
      };

      const siteName = globalSeo.siteName || 'Merlux Chauffeur Services';
      const defaultTitle = globalSeo.defaultTitle || 'Luxury Chauffeur Melbourne';
      const titleTemplate = globalSeo.titleTemplate || `%s | ${siteName}`;

      let title = finalSeoData.metaTitle || defaultTitle;
      if (title !== defaultTitle && !title.includes(siteName)) {
        title = titleTemplate.replace('%s', title);
      }

      const desc = finalSeoData.metaDescription || globalSeo.defaultDescription || '';
      const seoKeywords = Array.isArray(finalSeoData.keywords) ? finalSeoData.keywords : (typeof finalSeoData.keywords === 'string' ? finalSeoData.keywords.split(',').map((k: string) => k.trim()) : []);
      const defaultKeywords = Array.isArray(globalSeo.defaultKeywords) ? globalSeo.defaultKeywords : (typeof globalSeo.defaultKeywords === 'string' ? globalSeo.defaultKeywords.split(',').map((k: string) => k.trim()) : []);
      const keywords = [...seoKeywords, ...defaultKeywords].filter(k => k !== '').join(', ');
      const favicon = globalSeo.favicon ? `<link rel="icon" href="${globalSeo.favicon}" />` : '';
      const canonical = finalSeoData.canonicalUrl || `${SITE_URL}${url}`;
      
      const ogTitle = finalSeoData.ogTitle || title;
      const ogDesc = finalSeoData.ogDescription || desc || 'Premium chauffeur services in Melbourne.';
      const ogUrl = finalSeoData.ogUrl || canonical;
      const ogImage = finalSeoData.ogImage || globalSeo.ogImage || globalSeo.logo || 'https://merlux.au/images/preview.jpg';

      const noindex = finalSeoData.noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';

      const pageSchema = finalSeoData.schema ? `<script type="application/ld+json">${JSON.stringify(finalSeoData.schema)}</script>` : '';
      const orgSchema = globalSeo.organizationSchema ? `<script type="application/ld+json">${JSON.stringify(globalSeo.organizationSchema)}</script>` : '';
      
      const gaScript = globalSeo.googleAnalyticsId ? `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${globalSeo.googleAnalyticsId}"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${globalSeo.googleAnalyticsId}');
        </script>
      ` : '';

      const scMeta = globalSeo.searchConsoleId ? `<meta name="google-site-verification" content="${globalSeo.searchConsoleId}" />` : '';

      const seoTags = `
    <title data-rh="true">${title}</title>
    <meta data-rh="true" name="description" content="${desc}" />
    <meta data-rh="true" name="keywords" content="${keywords}" />
    <link data-rh="true" rel="canonical" href="${canonical}" />
    <link rel="sitemap" type="application/xml" title="Sitemap" href="${SITE_URL}/sitemap_index.xml" />
    ${favicon.replace('<link', '<link data-rh="true"')}
    ${noindex.replace('<meta', '<meta data-rh="true"')}
    ${scMeta.replace('<meta', '<meta data-rh="true"')}
    <meta data-rh="true" property="og:title" content="${ogTitle}" />
    <meta data-rh="true" property="og:description" content="${ogDesc}" />
    <meta data-rh="true" property="og:type" content="website" />
    <meta data-rh="true" property="og:url" content="${ogUrl}" />
    <meta data-rh="true" property="og:image" content="${ogImage}" />
    <meta data-rh="true" name="twitter:card" content="summary_large_image" />
    ${orgSchema}
    ${pageSchema}
    ${gaScript}
      `;

      // Clean default tags to prevent duplicate meta and title headers
      let cleanHtml = html;
      cleanHtml = cleanHtml.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '');
      cleanHtml = cleanHtml.replace(/<meta[^>]*name=["']description["'][^>]*>/gi, '');
      cleanHtml = cleanHtml.replace(/<meta[^>]*name=["']keywords["'][^>]*>/gi, '');
      cleanHtml = cleanHtml.replace(/<meta[^>]*property=["']og:[^"']+["'][^>]*>/gi, '');
      cleanHtml = cleanHtml.replace(/<meta[^>]*name=["']twitter:[^"']+["'][^>]*>/gi, '');
      cleanHtml = cleanHtml.replace(/<link[^>]*rel=["']canonical["'][^>]*>/gi, '');

      return cleanHtml.replace('</head>', `${seoTags}</head>`);
    } catch (error) {
      console.error('SEO Injection Error:', error);
      return html;
    }
  };

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    // SEO injection in dev mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.includes('.') || url.startsWith('/api/')) return next();

      try {
        let template = fs.readFileSync(path.resolve(__dirnameResolved, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const html = await injectSEO(template, req);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));

    app.get('*', async (req, res) => {
      try {
        const template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const html = await injectSEO(template, req);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        res.status(500).end('Internal Server Error');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
