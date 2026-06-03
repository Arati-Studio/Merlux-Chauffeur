import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, limit, query, startAfter } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let SITE_URL = process.env.VITE_SITE_URL || 'https://merlux.au';
if (!SITE_URL.startsWith('http')) {
  SITE_URL = `https://${SITE_URL}`;
}
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DIST_DIR = path.join(process.cwd(), 'dist');

// Load Firebase config from firebase-applet-config.json
let firebaseConfig: any;
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

// Initialize Firebase Client SDK with forced HTTP Long Polling for 100% reliable sandbox building
const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);

const STATIC_PAGES = [
  { title: 'Home', slug: '', path: '/' },
  { title: 'Offers', slug: 'offers', path: '/offers' },
  { title: 'Tours', slug: 'tours', path: '/tours' },
  { title: 'Services', slug: 'services', path: '/services' },
  { title: 'Blog', slug: 'blog', path: '/blog' },
  { title: 'Fleet', slug: 'fleet', path: '/fleet' },
  { title: 'About', slug: 'about', path: '/about' },
  { title: 'Contact', slug: 'contact', path: '/contact' },
  { title: 'Faq', slug: 'faq', path: '/faq' },
  { title: 'Terms and Conditions', slug: 'terms', path: '/terms' },
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

// Scalable helper to stream collections in batch segments to optimize memory using Client SDK
async function* streamCollection(collectionName: string, batchSize = 100) {
  const collRef = collection(db, collectionName);
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    const q = lastDoc 
      ? query(collRef, startAfter(lastDoc), limit(batchSize)) 
      : query(collRef, limit(batchSize));
    const snap = await getDocs(q);
    if (snap.empty) {
      hasMore = false;
      break;
    }
    yield snap.docs;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < batchSize) {
      hasMore = false;
    }
  }
}

interface SitemapHtmlEntry {
  url: string;
  path: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  category: 'page' | 'blog' | 'offer' | 'tour';
  title: string;
  isStatic?: boolean;
}

const sitemapHtmlEntries: SitemapHtmlEntry[] = [];

const prettifyTitle = (pathStr: string, currentTitle: string = ''): string => {
  const fallback = currentTitle || '';
  if (fallback && fallback !== 'Special Offer' && fallback !== 'Tour' && fallback !== 'Special VIP Promotions' && fallback !== 'Hotel & Long Stay') {
    return fallback;
  }
  const lastSection = pathStr.split('/').filter(Boolean).pop() || 'Home';
  return lastSection
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

async function generateSitemap() {
  console.log('🚀 Starting Scalable Admin Multiple Sitemap & HTML Generation matches MetaTab.tsx rules...');

  try {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

    const pageTempPath = path.join(PUBLIC_DIR, 'page-sitemap.xml.tmp');
    const blogTempPath = path.join(PUBLIC_DIR, 'blog-sitemap.xml.tmp');
    const offerTempPath = path.join(PUBLIC_DIR, 'offer-sitemap.xml.tmp');
    const toursTempPath = path.join(PUBLIC_DIR, 'tours-sitemap.xml.tmp');

    const pageStream = fs.createWriteStream(pageTempPath, { encoding: 'utf8' });
    const blogStream = fs.createWriteStream(blogTempPath, { encoding: 'utf8' });
    const offerStream = fs.createWriteStream(offerTempPath, { encoding: 'utf8' });
    const toursStream = fs.createWriteStream(toursTempPath, { encoding: 'utf8' });

    const writeHeader = (stream: fs.WriteStream) => {
      stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
      stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
    };

    writeHeader(pageStream);
    writeHeader(blogStream);
    writeHeader(offerStream);
    writeHeader(toursStream);

    let maxLastmodPage = formatDate(null);
    let maxLastmodBlog = formatDate(null);
    let maxLastmodOffer = formatDate(null);
    let maxLastmodTour = formatDate(null);

    let pageCount = 0;
    let blogCount = 0;
    let offerCount = 0;
    let tourCount = 0;

    const writeUrlEntryWithTracking = (
      stream: fs.WriteStream, 
      path: string, 
      lastmod: string, 
      changefreq: string, 
      priority: string,
      category: 'page' | 'blog' | 'offer' | 'tour',
      docTitle: string,
      isStaticFlag = false
    ) => {
      stream.write(`  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`);

      sitemapHtmlEntries.push({
        url: `${SITE_URL}${path}`,
        path: path,
        lastmod,
        changefreq,
        priority,
        category,
        title: prettifyTitle(path, docTitle),
        isStatic: isStaticFlag
      });

      if (category === 'page') {
        pageCount++;
        maxLastmodPage = lastmod > maxLastmodPage ? lastmod : maxLastmodPage;
      } else if (category === 'blog') {
        blogCount++;
        maxLastmodBlog = lastmod > maxLastmodBlog ? lastmod : maxLastmodBlog;
      } else if (category === 'offer') {
        offerCount++;
        maxLastmodOffer = lastmod > maxLastmodOffer ? lastmod : maxLastmodOffer;
      } else if (category === 'tour') {
        tourCount++;
        maxLastmodTour = lastmod > maxLastmodTour ? lastmod : maxLastmodTour;
      }
    };

    // 1. Accumulate metadata overrides in an Administrative Map
    console.log('📦 Loading database metadata overrides incrementally...');
    const metadataMap = new Map<string, { noindex?: boolean; updatedAt?: any }>();
    try {
      for await (const docs of streamCollection('metadata', 200)) {
        (docs as any[]).forEach((doc: any) => {
          const data = doc.data() as any;
          const slugVal = (data.slug || '').toLowerCase();
          const idVal = doc.id.toLowerCase();
          const record = {
            noindex: data.noindex,
            updatedAt: data.updatedAt
          };
          if (slugVal) {
            metadataMap.set(slugVal, record);
          }
          if (idVal) {
            metadataMap.set(idVal, record);
          }
        });
      }
      console.log(`✅ Loaded ${metadataMap.size} database metadata records.`);
    } catch (dbErr) {
      console.warn('⚠️ Could not fetch metadata overrides, continuing with defaults:', dbErr);
    }

    const getMetadataOverride = (routeSlug: string) => {
      const normSlug = (routeSlug || '').toLowerCase();
      const replaced = normSlug.replace(/\//g, '_');
      let override = metadataMap.get(normSlug);
      if (!override && replaced) {
        override = metadataMap.get(replaced);
      }
      return override;
    };

    // Tracking for static pages and already processed paths to guarantee uniqueness
    interface StaticPageStatus {
      isCovered: boolean;
      noindex?: boolean;
      updatedAt?: any;
      createdAt?: any;
    }

    const staticPagesStatus = new Map<string, StaticPageStatus>();
    STATIC_PAGES.forEach(sp => {
      staticPagesStatus.set(sp.slug.toLowerCase(), {
        isCovered: false,
        noindex: false,
        updatedAt: null,
        createdAt: null
      });
    });

    const registeredPaths = new Set<string>();

    // 2. Stream and process the Dynamic 'pages' collection
    console.log('📄 Processing dynamic pages from database...');
    try {
      for await (const docs of streamCollection('pages', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const p = { id: doc.id, type: 'Page', ...(doc.data() as any) } as any;
          const slugKey = (p.slug || '').toLowerCase();
          const routeSlug = p.slug || 'home';
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false));
          const active = p.active !== false;
          const updatedAt = docOverride?.updatedAt || p.updatedAt || p.createdAt || null;
          const createdAt = p.createdAt || null;

          // If this page covers a static system route, record it to merge at the end
          if (staticPagesStatus.has(slugKey)) {
            staticPagesStatus.set(slugKey, {
              isCovered: true,
              noindex,
              updatedAt,
              createdAt
            });
          } else {
            // If purely custom dynamic page, write it immediately
            const cleanPath = getFullPath(p);
            if (!registeredPaths.has(cleanPath)) {
              registeredPaths.add(cleanPath);
              if (!noindex && active) {
                const lastmod = formatDate(updatedAt || createdAt);
                writeUrlEntryWithTracking(pageStream, cleanPath, lastmod, cleanPath === '/' ? 'daily' : 'weekly', cleanPath === '/' ? '1.0' : '0.8', 'page', p.title);
              }
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Pages collection stream failed or empty:', e.message);
    }

    // 3. Stream 'blogs' collection
    console.log('✍️ Processing blog posts from database...');
    try {
      for await (const docs of streamCollection('blogs', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const b = { id: doc.id, type: 'Blog', ...(doc.data() as any) } as any;
          const routeSlug = `blog/${b.slug}`;
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false));
          const active = b.active !== false;
          const updatedAt = docOverride?.updatedAt || b.updatedAt || b.createdAt || null;
          const createdAt = b.createdAt || null;

          const cleanPath = getFullPath(b);
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            if (!noindex && active) {
              const lastmod = formatDate(updatedAt || createdAt);
              writeUrlEntryWithTracking(blogStream, cleanPath, lastmod, 'weekly', '0.8', 'blog', b.title);
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Blogs collection stream failed or empty:', e.message);
    }

    // 4. Stream 'offers' collection
    console.log('🏷️ Processing promo offers from database...');
    try {
      for await (const docs of streamCollection('offers', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const o = { id: doc.id, type: 'Offer', ...(doc.data() as any) } as any;
          const routeSlug = `offers/${o.slug}`;
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false));
          const active = o.active !== false;
          const updatedAt = docOverride?.updatedAt || o.updatedAt || o.createdAt || null;
          const createdAt = o.createdAt || null;

          const cleanPath = getFullPath(o);
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            if (!noindex && active) {
              const lastmod = formatDate(updatedAt || createdAt);
              writeUrlEntryWithTracking(offerStream, cleanPath, lastmod, 'weekly', '0.8', 'offer', o.title || o.name);
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Offers collection stream failed or empty:', e.message);
    }

    // 5. Stream 'tours' collection
    console.log('🗺️ Processing private tours from database...');
    try {
      for await (const docs of streamCollection('tours', 100)) {
        (docs as any[]).forEach((doc: any) => {
          const t = { id: doc.id, type: 'Tour', ...(doc.data() as any) } as any;
          const routeSlug = `tours/${t.slug}`;
          const docOverride = getMetadataOverride(routeSlug);
          const noindex = t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false));
          const active = t.active !== false;
          const updatedAt = docOverride?.updatedAt || t.updatedAt || t.createdAt || null;
          const createdAt = t.createdAt || null;

          const cleanPath = getFullPath(t);
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            if (!noindex && active) {
              const lastmod = formatDate(updatedAt || createdAt);
              writeUrlEntryWithTracking(toursStream, cleanPath, lastmod, 'weekly', '0.8', 'tour', t.title || t.name);
            }
          }
        });
      }
    } catch (e: any) {
      console.warn('⚠️ Tours collection stream failed or empty:', e.message);
    }

    // 6. Process and append STATIC_PAGES with correct merges
    console.log('⚙️ Appending processed static system pages...');
    STATIC_PAGES.forEach((page: any) => {
      const slugKey = page.slug.toLowerCase();
      const status = staticPagesStatus.get(slugKey);
      
      let noindex = false;
      let updatedAt = null;
      let createdAt = null;

      if (status) {
        if (status.isCovered) {
          if (status.noindex) return; // ignore static page if it is marked as noindex via the covering page
          updatedAt = status.updatedAt;
          createdAt = status.createdAt;
        } else {
          // If uncovered virtual static page, see metadata override
          const routeSlug = page.slug || 'home';
          const docOverride = getMetadataOverride(routeSlug);
          if (docOverride?.noindex === true) return;
          updatedAt = docOverride?.updatedAt || null;
        }
      }

      const cleanPath = page.path || '/';
      if (!registeredPaths.has(cleanPath)) {
        registeredPaths.add(cleanPath);
        const lastmod = formatDate(updatedAt || createdAt);
        writeUrlEntryWithTracking(
          pageStream,
          cleanPath,
          lastmod,
          cleanPath === '/' ? 'daily' : 'weekly',
          cleanPath === '/' ? '1.0' : '0.8',
          'page',
          page.title,
          true
        );
      }
    });

    const endSitemapStream = async (stream: fs.WriteStream) => {
      stream.write('</urlset>');
      stream.end();
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
      });
    };

    console.log('💾 Finalizing sub-sitemap files...');
    await Promise.all([
      endSitemapStream(pageStream),
      endSitemapStream(blogStream),
      endSitemapStream(offerStream),
      endSitemapStream(toursStream)
    ]);

    console.log('🗂️ Generating sitemap_index.xml...');
    const indexTempPath = path.join(PUBLIC_DIR, 'sitemap_index.xml.tmp');
    const indexStream = fs.createWriteStream(indexTempPath, { encoding: 'utf8' });
    indexStream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    indexStream.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

    const subSitemapFiles = [
      { name: 'page-sitemap.xml', lastmod: maxLastmodPage, count: pageCount },
      { name: 'blog-sitemap.xml', lastmod: maxLastmodBlog, count: blogCount },
      { name: 'offer-sitemap.xml', lastmod: maxLastmodOffer, count: offerCount },
      { name: 'tours-sitemap.xml', lastmod: maxLastmodTour, count: tourCount }
    ];

    subSitemapFiles.forEach(file => {
      if (file.count > 0) {
        indexStream.write(`  <sitemap>
    <loc>${SITE_URL}/${file.name}</loc>
    <lastmod>${file.lastmod}</lastmod>
  </sitemap>\n`);
      }
    });

    indexStream.write('</sitemapindex>');
    indexStream.end();

    await new Promise<void>((resolve, reject) => {
      indexStream.on('finish', () => resolve());
      indexStream.on('error', (err) => reject(err));
    });

    console.log('📄 Generating a single flat sitemap.xml as direct fallback...');
    const flatSitemapTempPath = path.join(PUBLIC_DIR, 'sitemap.xml.tmp');
    const flatSitemapStream = fs.createWriteStream(flatSitemapTempPath, { encoding: 'utf8' });
    flatSitemapStream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    flatSitemapStream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
    sitemapHtmlEntries.forEach(entry => {
      flatSitemapStream.write(`  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>\n`);
    });
    flatSitemapStream.write('</urlset>');
    flatSitemapStream.end();

    await new Promise<void>((resolve, reject) => {
      flatSitemapStream.on('finish', () => resolve());
      flatSitemapStream.on('error', (err) => reject(err));
    });

    // Move completed sitemaps into public/ and dist/
    const filesToCopy = [
      { temp: pageTempPath, name: 'page-sitemap.xml' },
      { temp: blogTempPath, name: 'blog-sitemap.xml' },
      { temp: offerTempPath, name: 'offer-sitemap.xml' },
      { temp: toursTempPath, name: 'tours-sitemap.xml' },
      { temp: indexTempPath, name: 'sitemap_index.xml' },
      { temp: flatSitemapTempPath, name: 'sitemap.xml' } // Dynamic flat sitemap containing all URLs
    ];

    filesToCopy.forEach(f => {
      fs.copyFileSync(f.temp, path.join(PUBLIC_DIR, f.name));
      fs.copyFileSync(f.temp, path.join(DIST_DIR, f.name));
    });

    // Clean up temporary XML paths
    const uniqueTemps = Array.from(new Set(filesToCopy.map(f => f.temp)));
    uniqueTemps.forEach(tempPath => {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    });

    console.log('✨ All sitemaps (index and sub-sitemaps) generated successfully in public/ and dist/');

    // Generate Robots.txt
    const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${SITE_URL}/sitemap_index.xml
`;
    fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt);
    fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
    console.log('✨ robots.txt generated successfully in public/ and dist/');

    // ----------------------------------------------------
    // NEW: Generate Dynamic Luxury sitemap.html
    // ----------------------------------------------------
    console.log('💎 Generating highly polished interactive luxury-themed sitemap.html...');
    const todayStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    const sitemapHtmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Merlux Luxury Sitemap | Dynamic Index & Interactive Directories</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Inter', sans-serif;
      background-color: #0b0c10;
      color: #e5e7eb;
    }
    .font-display {
      font-family: 'Space Grotesk', sans-serif;
    }
    .font-mono {
      font-family: 'JetBrains Mono', sans-serif;
    }
    
    /* custom-scrollbar class wrapper style constraints override */
    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: rgba(212, 175, 55, 0.3) rgba(255, 255, 255, 0.02);
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(212, 175, 55, 0.3);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(212, 175, 55, 0.6);
    }

    /* custom-select dropdown luxury design overrides */
    .custom-select {
      background-color: #12131a;
      color: #e5e7eb;
      border: 1px solid rgba(212, 175, 55, 0.2);
      border-radius: 0.75rem;
      padding: 0.625rem 2.5rem 0.625rem 1rem;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23d4af37'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1rem;
      cursor: pointer;
      font-size: 0.875rem;
      transition: all 0.2s ease;
    }
    .custom-select:hover {
      border-color: rgba(212, 175, 55, 0.5);
      background-color: #1a1c24;
    }
    .custom-select:focus {
      outline: none;
      border-color: #d4af37;
      box-shadow: 0 0 0 2px rgba(212, 175, 55, 0.2);
    }

    /* Luxury Golden Pulse glow indicators for custom tags */
    .glass-card {
      background: rgba(255, 255, 255, 0.02);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .active-card {
      border-color: #d4af37 !important;
      background: rgba(212, 175, 55, 0.04) !important;
      box-shadow: 0 0 15px rgba(212, 175, 55, 0.1);
    }
  </style>
</head>
<body class="min-h-screen py-10 px-4 sm:px-6 lg:px-8 selection:bg-[#d4af37]/20 selection:text-amber-200">
  <div class="max-w-6xl mx-auto space-y-10">
    
    <!-- Top Navigation Bar (Back to Home) -->
    <div class="flex items-center justify-between border-b border-white/5 pb-4">
      <a href="/" class="inline-flex items-center gap-1.5 font-mono text-xs text-gray-400 hover:text-[#d4af37] transition-all duration-250 group">
        <span class="inline-block transition-transform duration-200 group-hover:-translate-x-1">←</span> Back to Home
      </a>
      <span class="text-[10px] text-gray-500 uppercase tracking-widest font-mono">Merlux Luxury Elite</span>
    </div>

    <!-- Brand Header -->
    <header class="text-center space-y-4">
      <div class="inline-flex items-center gap-1.5 font-mono text-[9px] text-[#d4af37] uppercase tracking-wider bg-[#d4af37]/10 px-3 py-1.5 rounded-full border border-[#d4af37]/20">
        <span class="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
        Sitemap Index Directory • Live Interactive
      </div>
      <h1 class="text-3xl sm:text-5xl font-bold tracking-tight text-white font-display">
        MERLUX SITEMAP <span class="text-[#d4af37] font-medium font-serif italic">DIRECTORY</span>
      </h1>
      <p class="text-sm text-gray-400 max-w-xl mx-auto">
        Stunning representation of dynamic sitemap crawling. Click any index below to filter matches instantly without reloading.
      </p>
    </header>

    <!-- Sub-Sitemaps Grid -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" id="sitemapSelectorGrid">
      <!-- Page Sitemap Link Card -->
      <div id="card-page" onclick="toggleCategoryFilter('page')" class="glass-card cursor-pointer block p-5 rounded-2xl transition-all group hover:bg-white/[0.04] relative">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[10px] font-mono text-[#d4af37] tracking-wider uppercase">Page Indexes</span>
          <a href="/page-sitemap.xml" target="_blank" onclick="event.stopPropagation()" class="text-[10px] text-gray-500 font-mono hover:text-white transition-colors bg-white/5 hover:bg-[#d4af37]/20 px-2 py-0.5 rounded border border-white/5">XML ↗</a>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">page-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Static & Dynamic customized landing page structures.</p>
        <span id="badge-count-page" class="absolute bottom-4 right-4 text-[10px] font-mono text-gray-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded">0 urls</span>
      </div>

      <!-- Blog Sitemap Link Card -->
      <div id="card-blog" onclick="toggleCategoryFilter('blog')" class="glass-card cursor-pointer block p-5 rounded-2xl transition-all group hover:bg-white/[0.04] relative">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[10px] font-mono text-[#d4af37] tracking-wider uppercase">Blog Indexes</span>
          <a href="/blog-sitemap.xml" target="_blank" onclick="event.stopPropagation()" class="text-[10px] text-gray-500 font-mono hover:text-white transition-colors bg-white/5 hover:bg-[#d4af37]/20 px-2 py-0.5 rounded border border-white/5">XML ↗</a>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">blog-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Journal, travel guides, luxury chauffeur insights.</p>
        <span id="badge-count-blog" class="absolute bottom-4 right-4 text-[10px] font-mono text-gray-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded">0 urls</span>
      </div>

      <!-- Offer Sitemap Link Card -->
      <div id="card-offer" onclick="toggleCategoryFilter('offer')" class="glass-card cursor-pointer block p-5 rounded-2xl transition-all group hover:bg-white/[0.04] relative">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[10px] font-mono text-[#d4af37] tracking-wider uppercase">Promo Offers</span>
          <a href="/offer-sitemap.xml" target="_blank" onclick="event.stopPropagation()" class="text-[10px] text-gray-500 font-mono hover:text-white transition-colors bg-white/5 hover:bg-[#d4af37]/20 px-2 py-0.5 rounded border border-white/5">XML ↗</a>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">offer-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Special VIP promotions and airport deal pages.</p>
        <span id="badge-count-offer" class="absolute bottom-4 right-4 text-[10px] font-mono text-gray-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded">0 urls</span>
      </div>

      <!-- Tours Sitemap Link Card -->
      <div id="card-tour" onclick="toggleCategoryFilter('tour')" class="glass-card cursor-pointer block p-5 rounded-2xl transition-all group hover:bg-white/[0.04] relative">
        <div class="flex items-center justify-between mb-3">
          <span class="text-[10px] font-mono text-[#d4af37] tracking-wider uppercase">Tour Indexes</span>
          <a href="/tours-sitemap.xml" target="_blank" onclick="event.stopPropagation()" class="text-[10px] text-gray-500 font-mono hover:text-white transition-colors bg-white/5 hover:bg-[#d4af37]/20 px-2 py-0.5 rounded border border-white/5">XML ↗</a>
        </div>
        <p class="text-lg font-bold text-white group-hover:text-[#d4af37] transition-colors font-display">tours-sitemap.xml</p>
        <p class="text-xs text-gray-400 mt-2">Custom-tailored sightseeing itineraries across Australia.</p>
        <span id="badge-count-tour" class="absolute bottom-4 right-4 text-[10px] font-mono text-gray-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded">0 urls</span>
      </div>
    </section>

    <!-- Main Directory Section -->
    <section class="glass-card p-6 sm:p-8 rounded-3xl border border-white/5 space-y-6">
      
      <!-- Interactive Grid Control Center -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <p class="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Dynamic Interactive Directory</p>
          <h2 class="text-xl font-bold font-display text-white mt-1">Crawled Web Registry</h2>
        </div>
        
        <div class="flex flex-wrap items-center gap-3">
          <!-- Live Interactive search bar -->
          <div class="relative min-w-[200px] sm:min-w-[260px] flex-1 sm:flex-initial">
            <input type="text" id="searchInput" placeholder="Search directory..." class="w-full bg-[#12131a] text-gray-200 border border-white/10 focus:border-[#d4af37] px-4 py-2.5 pl-10 pr-4 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-[#d4af37]/30 transition-all font-mono" />
            <svg class="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </div>

          <!-- Luxury Dropdown (select element) matching instruction "custom-select" -->
          <select class="custom-select" id="categorySelect">
            <option value="all">All Web Indexes</option>
            <option value="page">Pages (Dynamic & Static)</option>
            <option value="blog">Blog Posts</option>
            <option value="offer">VIP Promo Offers</option>
            <option value="tour">Luxury Tours</option>
            <option value="static">System Static Pages Only</option>
          </select>

          <!-- Current Results Status Flag -->
          <span class="text-[10px] font-mono text-[#d4af37] bg-[#d4af37]/10 px-3 py-2 rounded-xl border border-[#d4af37]/20 whitespace-nowrap" id="statusBadgeCount">
             0 Web URLs Active
          </span>
        </div>
      </div>

      <!-- Main Scrollable Directory entries wrapper -->
      <div class="custom-scrollbar max-h-[640px] overflow-y-auto pr-2 space-y-4" id="urlListContainer">
        <!-- Javascript will render results directly inside here -->
        <div class="flex flex-col items-center justify-center py-20 text-center space-y-3">
          <div class="w-8 h-8 rounded-full border-t border-b border-[#d4af37] animate-spin"></div>
          <span class="text-xs font-mono text-gray-400">Synchronizing directory register...</span>
        </div>
      </div>

      <!-- Footer Timestamp Info Section -->
      <div class="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-white/5 text-[10px] text-gray-500 font-mono gap-2">
        <span>Compilation Sync: ${todayStr} UTC</span>
        <span>Generated using Client Firestore SDK (Long-Polling Secure Mode)</span>
      </div>
    </section>
  </div>

  <script>
    // Embedded Live Sitemap Data Register
    window.sitemapEntries = JSON.parse(\`${JSON.stringify(sitemapHtmlEntries).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`);

    // Master filter registers
    let currentCategory = 'all';
    let searchQuery = '';

    const elSearchInput = document.getElementById('searchInput');
    const elCategorySelect = document.getElementById('categorySelect');
    const elUrlListContainer = document.getElementById('urlListContainer');
    const elStatusBadgeCount = document.getElementById('statusBadgeCount');

    // Categorization badge colors
    function getBadgeSpecs(entry) {
      if (entry.isStatic) {
        return {
          name: 'System Static',
          color: 'text-amber-500 bg-amber-500/10 border-amber-500/20'
        };
      }
      switch (entry.category) {
        case 'blog':
          return { name: 'Blog Post', color: 'text-green-400 bg-green-500/10 border-green-500/20' };
        case 'offer':
          return { name: 'VIP Offer', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' };
        case 'tour':
          return { name: 'Luxury Tour', color: 'text-amber-400 bg-[#d4af37]/10 border-[#d4af37]/40' };
        default:
          return { name: 'Dynamic Page', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' };
      }
    }

    // Update individual sitemap card quantities
    function calculateCardCounts() {
      const counts = { page: 0, blog: 0, offer: 0, tour: 0 };
      window.sitemapEntries.forEach(entry => {
        if (entry.isStatic) {
          counts.page += 1;
        } else if (counts[entry.category] !== undefined) {
          counts[entry.category] += 1;
        } else {
          counts.page += 1; // logical fallback for structural / custom types
        }
      });

      document.getElementById('badge-count-page').innerText = counts.page + ' urls';
      document.getElementById('badge-count-blog').innerText = counts.blog + ' urls';
      document.getElementById('badge-count-offer').innerText = counts.offer + ' urls';
      document.getElementById('badge-count-tour').innerText = counts.tour + ' urls';
    }

    // Main Renderer Loop
    function renderEntries() {
      if (!window.sitemapEntries || window.sitemapEntries.length === 0) {
        elUrlListContainer.innerHTML = \`
          <div class="text-center py-16 text-gray-500 text-xs sm:text-sm font-mono space-y-1">
            <p>⚠️ No sitemap entries found in visual index directory.</p>
            <p class="text-[10px] text-gray-600">Please verify database documents in Firestore Collections.</p>
          </div>\`;
        elStatusBadgeCount.innerText = '0 Web URLs Active';
        return;
      }

      // Filter logic
      const filtered = window.sitemapEntries.filter(entry => {
        // Category check
        if (currentCategory !== 'all') {
          if (currentCategory === 'static') {
            if (!entry.isStatic) return false;
          } else if (currentCategory === 'page') {
            // Include both custom dynamic pages and static system pages (since they are both part of page-sitemap.xml)
            if (entry.category !== 'page') return false;
          } else {
            if (entry.isStatic || entry.category !== currentCategory) return false;
          }
        }

        // Search text check
        if (searchQuery) {
          const needle = searchQuery.toLowerCase();
          const matchesTitle = (entry.title || '').toLowerCase().includes(needle);
          const matchesPath = (entry.path || '').toLowerCase().includes(needle);
          const matchesFreq = (entry.changefreq || '').toLowerCase().includes(needle);
          return matchesTitle || matchesPath || matchesFreq;
        }

        return true;
      });

      // Update counters
      elStatusBadgeCount.innerText = filtered.length + ' Web URLs Active';

      if (filtered.length === 0) {
        elUrlListContainer.innerHTML = \`
          <div class="text-center py-16 text-gray-500 text-xs sm:text-sm font-mono space-y-1 bg-white/[0.01] border border-white/5 rounded-2xl">
            <p>🔍 No directory indexes match your filter criteria.</p>
            <p class="text-[10px] text-gray-600">Try modifying your search or clearing active filters.</p>
          </div>\`;
        return;
      }

      // Populate elements
      elUrlListContainer.innerHTML = filtered.map(entry => {
        const badge = getBadgeSpecs(entry);
        return \`
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#d4af37]/30 hover:bg-white/[0.04] transition-all group font-mono text-xs">
            <div class="flex items-center gap-3 truncate min-w-0">
              <span class="text-[#d4af37]/60 shrink-0 group-hover:translate-x-1 transition-transform">→</span>
              <div class="truncate">
                <a href="\${entry.path}" target="_blank" class="text-white hover:text-[#d4af37] font-semibold truncate transition-colors text-xs sm:text-sm block sm:inline">\${entry.title}</a>
                <span class="text-[10px] text-gray-500 block truncate font-mono mt-0.5">\${entry.path}</span>
              </div>
            </div>
            <div class="flex flex-row items-center gap-2 sm:gap-4 shrink-0 justify-between sm:justify-end mt-2 sm:mt-0">
              <div class="flex items-center gap-2">
                <span class="text-[9px] uppercase tracking-wider bg-white/5 border border-white/5 px-2 py-0.5 rounded text-gray-400">↕ \${entry.priority}</span>
                <span class="text-[9px] uppercase tracking-wider \${badge.color} px-2 py-0.5 rounded font-sans font-bold">\${badge.name}</span>
              </div>
              <span class="text-[10px] text-gray-500 font-mono whitespace-nowrap">\${entry.lastmod}</span>
            </div>
          </div>
        \`;
      }).join('');
    }

    // Toggle logic for cards
    function toggleCategoryFilter(cat) {
      const card = document.getElementById('card-' + cat);
      const isCurrentlyActive = card.classList.contains('active-card');

      // Clear all active styling
      ['page', 'blog', 'offer', 'tour'].forEach(c => {
        document.getElementById('card-' + c).classList.remove('active-card');
      });

      if (isCurrentlyActive) {
        currentCategory = 'all';
        elCategorySelect.value = 'all';
      } else {
        currentCategory = cat;
        card.classList.add('active-card');
        elCategorySelect.value = cat;
      }

      renderEntries();
    }

    // Handle dropdown category changes
    elCategorySelect.addEventListener('change', (e) => {
      currentCategory = e.target.value;
      
      // Update grid highlight active-card states
      ['page', 'blog', 'offer', 'tour'].forEach(c => {
        const card = document.getElementById('card-' + c);
        if (c === currentCategory) {
          card.classList.add('active-card');
        } else {
          card.classList.remove('active-card');
        }
      });

      renderEntries();
    });

    // Handle instant keydown searching
    elSearchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderEntries();
    });

    // Initialize application layout and triggers
    calculateCardCounts();
    renderEntries();
  </script>
</body>
</html>`;

    fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.html'), sitemapHtmlBody, { encoding: 'utf8' });
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.html'), sitemapHtmlBody, { encoding: 'utf8' });
    console.log('✨ sitemap.html visual directory successfully compiled in public/ and dist/');

  } catch (error) {
    console.error('❌ Error generating sitemaps:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

generateSitemap();
