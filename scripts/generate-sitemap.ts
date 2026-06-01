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

const STATIC_PAGES = [
  { title: 'Home', slug: '', path: '/' },
  { title: 'Offers', slug: 'offers', path: '/offers' },
  { title: 'Tours', slug: 'tours', path: '/tours' },
  { title: 'Services', slug: 'services', path: '/services' },
  { title: 'Blog', slug: 'blog', path: '/blog' },
  { title: 'Fleet', slug: 'fleet', path: '/fleet' },
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

async function generateSitemap() {
  console.log('🚀 Starting Sitemap Generation matching MetaTab.tsx logic exactly...');
  
  try {
    // 1. Fetch collections from Firestore
    const [pagesSnap, blogsSnap, offersSnap, toursSnap, metadataSnap] = await Promise.all([
      getDocs(collection(db, 'pages')),
      getDocs(collection(db, 'blogs')),
      getDocs(collection(db, 'offers')),
      getDocs(collection(db, 'tours')),
      getDocs(collection(db, 'metadata'))
    ]);

    const pages = pagesSnap.docs.map(doc => ({ id: doc.id, type: 'Page', ...doc.data() } as any));
    const blogs = blogsSnap.docs.map(doc => ({ id: doc.id, type: 'Blog', ...doc.data() } as any));
    const offers = offersSnap.docs.map(doc => ({ id: doc.id, type: 'Offer', ...doc.data() } as any));
    const tours = toursSnap.docs.map(doc => ({ id: doc.id, type: 'Tour', ...doc.data() } as any));
    const metadataDocs = metadataSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));

    const sortItems = (arr: any[]) => {
      arr.sort((a, b) => getTimestampSeconds(b.createdAt) - getTimestampSeconds(a.createdAt));
    };

    sortItems(pages);
    sortItems(blogs);
    sortItems(offers);
    sortItems(tours);

    console.log(`📊 Loaded counts - Pages: ${pages.length}, Blogs: ${blogs.length}, Offers: ${offers.length}, Tours: ${tours.length}`);

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
    STATIC_PAGES.forEach((sp: any) => {
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
    STATIC_PAGES.forEach((page: any) => {
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

    // Build XML
    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map(entry => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
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
