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

const dbAdmin = admin.firestore();

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

  // Serve dynamic sitemap matching MetaTab.tsx logic exactly
  app.get('/sitemap.xml', async (req, res) => {
    try {
      let SITE_URL = process.env.VITE_SITE_URL || '';
      if (!SITE_URL) {
        const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
        SITE_URL = `${protocol}://${req.get('host')}`;
      }
      if (SITE_URL.endsWith('/')) {
        SITE_URL = SITE_URL.slice(0, -1);
      }

      // Query collections from dbAdmin
      const [pagesSnap, blogsSnap, offersSnap, toursSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection('pages').get(),
        dbAdmin.collection('blogs').get(),
        dbAdmin.collection('offers').get(),
        dbAdmin.collection('tours').get(),
        dbAdmin.collection('metadata').get()
      ]);

      const pages = pagesSnap.docs.map(doc => ({ id: doc.id, type: 'Page', ...doc.data() } as any));
      const blogs = blogsSnap.docs.map(doc => ({ id: doc.id, type: 'Blog', ...doc.data() } as any));
      const offers = offersSnap.docs.map(doc => ({ id: doc.id, type: 'Offer', ...doc.data() } as any));
      const tours = toursSnap.docs.map(doc => ({ id: doc.id, type: 'Tour', ...doc.data() } as any));
      const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

      const getTimestampSeconds = (val: any): number => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        if (val.seconds !== undefined) return val.seconds;
        if (val._seconds !== undefined) return val._seconds;
        if (val.toDate && typeof val.toDate === 'function') {
          return Math.floor(val.toDate().getTime() / 1000);
        }
        if (val instanceof Date) {
          return Math.floor(val.getTime() / 1000);
        }
        if (typeof val === 'string') {
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : Math.floor(d.getTime() / 1000);
        }
        return 0;
      };

      const sortItems = (arr: any[]) => {
        arr.sort((a, b) => getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt));
      };

      sortItems(pages);
      sortItems(blogs);
      sortItems(offers);
      sortItems(tours);

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
      ];

      const getRouteSlug = (item: any) => {
        if (item.type === 'Page') {
          return item.slug || 'home';
        } else if (item.type === 'Blog') {
          return `blog/${item.slug}`;
        } else if (item.type === 'Offer') {
          return `offers/${item.slug}`;
        } else if (item.type === 'Tour') {
          return `tours/${item.slug}`;
        }
        return item.slug || '';
      };

      const getFullPath = (item: any) => {
        const routeSlug = getRouteSlug(item);
        if (routeSlug === 'home') return '/';
        return `/${routeSlug}`;
      };

      const formatDate = (val: any): string => {
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

      const items: any[] = [];
      const dynamicSlugs = new Set<string>();

      // 1. Pages (dynamic)
      pages.forEach((p: any) => {
        const slugKey = (p.slug || '').toLowerCase();
        dynamicSlugs.add(slugKey);

        const routeSlug = p.slug || 'home';
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

        items.push({
          id: p.id,
          title: p.title,
          slug: p.slug || '',
          type: 'Page',
          noindex: p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false)),
          active: p.active !== false,
          updatedAt: docOverride?.updatedAt || p.updatedAt || p.createdAt || null,
          createdAt: p.createdAt || null
        });
      });

      // 2. Static Pages
      staticPages.forEach((sp: any) => {
        const slugKey = sp.slug.toLowerCase();
        const isCovered = dynamicSlugs.has(slugKey);

        if (!isCovered) {
          const routeSlug = sp.slug || 'home';
          const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

          items.push({
            id: `static-${sp.slug || 'home'}`,
            title: sp.title,
            slug: sp.slug,
            type: 'Page',
            isStaticSystemPage: true,
            isVirtual: true,
            noindex: docOverride?.noindex !== undefined ? docOverride.noindex : false,
            active: true,
            updatedAt: docOverride?.updatedAt || null,
            createdAt: null
          });
        } else {
          const index = items.findIndex((p: any) => p.type === 'Page' && String(p.slug).toLowerCase() === slugKey);
          if (index !== -1) {
            items[index].isStaticSystemPage = true;
            items[index].title = sp.title;
            const routeSlug = sp.slug || 'home';
            const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
            if (docOverride?.updatedAt) {
              items[index].updatedAt = docOverride.updatedAt;
            }
          }
        }
      });

      // 3. Blogs
      blogs.forEach((b: any) => {
        const routeSlug = `blog/${b.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

        items.push({
          id: b.id,
          title: b.title,
          slug: b.slug,
          type: 'Blog',
          noindex: b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false)),
          active: b.active !== false,
          updatedAt: docOverride?.updatedAt || b.updatedAt || b.createdAt || null,
          createdAt: b.createdAt || null
        });
      });

      // 4. Offers
      offers.forEach((o: any) => {
        const routeSlug = `offers/${o.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

        items.push({
          id: o.id,
          title: o.title || o.name || 'Special Offer',
          slug: o.slug,
          type: 'Offer',
          noindex: o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false)),
          active: o.active !== false,
          updatedAt: docOverride?.updatedAt || o.updatedAt || o.createdAt || null,
          createdAt: o.createdAt || null
        });
      });

      // 5. Tours
      tours.forEach((t: any) => {
        const routeSlug = `tours/${t.slug}`;
        const docOverride = metadataDocs.find((d: any) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

        items.push({
          id: t.id,
          title: t.title || t.name || 'Tour',
          slug: t.slug,
          type: 'Tour',
          noindex: t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false)),
          active: t.active !== false,
          updatedAt: docOverride?.updatedAt || t.updatedAt || t.createdAt || null,
          createdAt: t.createdAt || null
        });
      });

      const uniqueItems: any[] = [];
      const seenKeys = new Set<string>();
      items.forEach((item: any) => {
        const itemKey = `${item.type}-${item.id || 'unnamed'}`;
        if (!seenKeys.has(itemKey)) {
          seenKeys.add(itemKey);
          uniqueItems.push(item);
        }
      });

      interface SitemapEntry {
        path: string;
        lastmod: string;
        changefreq: string;
        priority: string;
      }

      const sitemapEntries: SitemapEntry[] = [];
      const registeredPaths = new Set<string>();

      // 1. Process Static Pages
      staticPages.forEach((page: any) => {
        const mergedItem = uniqueItems.find((c: any) => c.type === 'Page' && String(c.slug).toLowerCase() === page.slug.toLowerCase());
        if (mergedItem?.noindex) {
          return;
        }
        const cleanPath = page.path || '/';
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          const lastmod = formatDate(mergedItem?.updatedAt || mergedItem?.createdAt);
          sitemapEntries.push({
            path: cleanPath,
            lastmod,
            changefreq: cleanPath === '/' ? 'daily' : 'weekly',
            priority: cleanPath === '/' ? '1.0' : '0.8',
          });
        }
      });

      // 2. Process Dynamic Content
      const dynamicItems = uniqueItems.filter((c: any) => !c.noindex && !c.isStaticSystemPage);
      dynamicItems.forEach((item: any) => {
        const cleanPath = getFullPath(item);
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          const lastmod = formatDate(item.updatedAt || item.createdAt);
          sitemapEntries.push({
            path: cleanPath,
            lastmod,
            changefreq: cleanPath === '/' ? 'daily' : 'weekly',
            priority: cleanPath === '/' ? '1.0' : '0.8',
          });
        }
      });

      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

      res.header('Content-Type', 'application/xml');
      return res.send(sitemapXml);
    } catch (err: any) {
      console.error('Error generating dynamic sitemap:', err);
      const sitemapPath = path.join(process.cwd(), 'dist', 'sitemap.xml');
      if (fs.existsSync(sitemapPath)) {
        res.header('Content-Type', 'application/xml');
        return res.sendFile(sitemapPath);
      }
      return res.status(500).send('Error generating sitemap');
    }
  });

  app.get('/robots.txt', (req, res) => {
    const robotsPath = path.join(process.cwd(), 'dist', 'robots.txt');
    if (fs.existsSync(robotsPath)) {
      return res.sendFile(robotsPath);
    }
    res.send("User-agent: *\nAllow: /\nSitemap: /sitemap.xml");
  });

  // Helper for SEO injection
  const injectSEO = async (html: string, url: string) => {
    try {
      const settingsSnap = await dbAdmin.collection('settings').doc('system').get();
      const globalSettings = settingsSnap.exists ? settingsSnap.data() : null;
      const globalSeo = globalSettings?.seo || {};

      let slug = url.split('?')[0].split('/').pop() || '';
      let isBlog = url.includes('/blog/');
      let isOffer = url.includes('/offers/');
      let isTour = url.includes('/tours/');

      let seoData: any = null;

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

      const siteName = globalSeo.siteName || 'Merlux Chauffeur Services';
      const defaultTitle = globalSeo.defaultTitle || 'Luxury Chauffeur Melbourne';
      const titleTemplate = globalSeo.titleTemplate || `%s | ${siteName}`;

      let title = seoData?.metaTitle || seoData?.title || defaultTitle;
      if (title !== defaultTitle && !title.includes(siteName)) {
        title = titleTemplate.replace('%s', title);
      }

      const desc = seoData?.metaDescription || globalSeo.defaultDescription || '';
      const seoKeywords = Array.isArray(seoData?.keywords) ? seoData.keywords : (typeof seoData?.keywords === 'string' ? seoData.keywords.split(',').map((k: string) => k.trim()) : []);
      const defaultKeywords = Array.isArray(globalSeo.defaultKeywords) ? globalSeo.defaultKeywords : (typeof globalSeo.defaultKeywords === 'string' ? globalSeo.defaultKeywords.split(',').map((k: string) => k.trim()) : []);
      const keywords = [...seoKeywords, ...defaultKeywords].filter(k => k !== '').join(', ');
      const favicon = globalSeo.favicon ? `<link rel="icon" href="${globalSeo.favicon}" />` : '';
      const ogImage = seoData?.ogImage || seoData?.featuredImage || globalSeo.ogImage || globalSeo.logo || '';
      const canonical = seoData?.canonicalUrl || `${process.env.APP_URL || ''}${url}`;
      const noindex = seoData?.noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';

      const pageSchema = seoData?.schema ? `<script type="application/ld+json">${JSON.stringify(seoData.schema)}</script>` : '';
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
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="keywords" content="${keywords}" />
    <link rel="canonical" href="${canonical}" />
    ${favicon}
    ${noindex}
    ${scMeta}
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${orgSchema}
    ${pageSchema}
    ${gaScript}
      `;

      // Replace default title and add other tags
      return html
        .replace(/<title>.*?<\/title>/, '')
        .replace('</head>', `${seoTags}</head>`);
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
        const html = await injectSEO(template, url);
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
        const html = await injectSEO(template, req.originalUrl);
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
