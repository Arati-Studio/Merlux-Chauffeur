import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, orderBy, query } from 'firebase/firestore';
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
  
  const pages = [...STATIC_ROUTES];

  try {
    // 1. Fetch Blog Posts
    const blogsSnap = await getDocs(collection(db, 'blogs'));
    blogsSnap.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      pages.push(`/blog/${slug}`);
    });
    console.log(`✅ Loaded ${blogsSnap.size} blog posts`);

    // 2. Fetch Offers
    const offersSnap = await getDocs(collection(db, 'offers'));
    offersSnap.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      pages.push(`/offers/${slug}`);
    });
    console.log(`✅ Loaded ${offersSnap.size} offers`);

    // 3. Fetch Tours
    const toursSnap = await getDocs(collection(db, 'tours'));
    toursSnap.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      pages.push(`/tours/${slug}`);
    });
    console.log(`✅ Loaded ${toursSnap.size} tours`);

    // 4. Fetch Dynamic Pages
    const dynamicSnap = await getDocs(collection(db, 'pages'));
    dynamicSnap.forEach(doc => {
      const data = doc.data();
      const slug = data.slug || doc.id;
      if (slug !== 'home') {
        pages.push(`/${slug}`);
      }
    });
    console.log(`✅ Loaded ${dynamicSnap.size} dynamic pages`);

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
