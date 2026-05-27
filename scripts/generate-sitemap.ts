import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let SITE_URL = process.env.VITE_SITE_URL || 'https://merlux.com.au';
if (!SITE_URL.startsWith('http')) {
  SITE_URL = `https://${SITE_URL}`;
}
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DIST_DIR = path.join(process.cwd(), 'dist');

// Load Firebase config from firebase-applet-config.json
let firebaseConfig;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error('⚠️ Could not load firebase-applet-config.json:', err);
}

if (!firebaseConfig) {
  console.error('❌ Firebase configuration not found. Cannot generate sitemap.');
  process.exit(1);
}

// Initialize Firebase Client
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const STATIC_ROUTES = [
  '',
  '/booking',
  '/fleet',
  '/services',
  '/about',
  '/contact',
  '/blog',
  '/faq',
  '/offers',
  '/tours',
  '/login'
];

async function generateSitemap() {
  console.log('🚀 Starting Sitemap Generation using Client SDK...');
  
  const pageSet = new Set<string>(STATIC_ROUTES);

  try {
    // Helper to add page to Set
    const addPage = (page: string) => {
      // Clean up potential double slashes
      const cleanPage = page.replace(/\/+/g, '/');
      pageSet.add(cleanPage);
    };

    // 1. Fetch Blog Posts
    const blogsSnap = await getDocs(query(collection(db, 'blogs'), where('active', '==', true)));
    blogsSnap.forEach(doc => {
      const data = doc.data();
      if (!data.noindex) {
        const slug = data.slug || doc.id;
        addPage(`/blog/${slug}`);
      }
    });
    console.log(`✅ Loaded ${blogsSnap.size} active blog posts`);

    // 2. Fetch Offers (Active only)
    const offersSnap = await getDocs(query(collection(db, 'offers'), where('active', '==', true)));
    offersSnap.forEach(doc => {
      const data = doc.data();
      if (!data.noindex) {
        const slug = data.slug || doc.id;
        addPage(`/offers/${slug}`);
      }
    });
    console.log(`✅ Loaded ${offersSnap.size} active offers`);

    // 3. Fetch Tours (Active only)
    const toursSnap = await getDocs(query(collection(db, 'tours'), where('active', '==', true)));
    toursSnap.forEach(doc => {
      const data = doc.data();
      if (!data.noindex) {
        const slug = data.slug || doc.id;
        addPage(`/tours/${slug}`);
      }
    });
    console.log(`✅ Loaded ${toursSnap.size} active tours`);

    // 4. Fetch Dynamic Pages
    const dynamicSnap = await getDocs(collection(db, 'pages'));
    dynamicSnap.forEach(doc => {
      const data = doc.data();
      if (!data.noindex) {
        const slug = data.slug || doc.id;
        if (slug !== 'home') {
          addPage(`/${slug}`);
        }
      }
    });
    console.log(`✅ Loaded ${dynamicSnap.size} dynamic pages`);

    // Convert Set back to array
    const pages = Array.from(pageSet);

    // Build XML
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(page => `  <url>
    <loc>${SITE_URL}${page}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page === '' ? 'daily' : 'weekly'}</changefreq>
    <priority>${page === '' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

    fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.xml'), sitemapXml);
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemapXml);
    console.log('✨ sitemap.xml generated successfully in public/ and dist/');

    // Generate Robots.txt
    const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${SITE_URL}/sitemap.xml
`;
    fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt);
    fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
    console.log('✨ robots.txt generated successfully in public/ and dist/');

  } catch (error) {
    console.error('❌ Error generating sitemap:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

generateSitemap();
