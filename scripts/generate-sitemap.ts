import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, orderBy, query, where, limit, startAfter } from 'firebase/firestore';
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
  { title: 'Faq', slug: 'faq', path: '/faq' },
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

// Scalable helper to stream collections in batch segments to optimize memory
async function* streamCollection(collectionName: string, batchSize = 100) {
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    let q;
    if (lastDoc) {
      q = query(collection(db, collectionName), startAfter(lastDoc), limit(batchSize));
    } else {
      q = query(collection(db, collectionName), limit(batchSize));
    }
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

async function generateSitemap() {
  console.log('🚀 Starting Scalable Streaming Multiple Sitemap Generation matching MetaTab.tsx rules...');

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

    const writeUrlEntryWithTracking = (
      stream: fs.WriteStream, 
      path: string, 
      lastmod: string, 
      changefreq: string, 
      priority: string,
      category: 'page' | 'blog' | 'offer' | 'tour'
    ) => {
      stream.write(`  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`);

      if (category === 'page') {
        maxLastmodPage = lastmod > maxLastmodPage ? lastmod : maxLastmodPage;
      } else if (category === 'blog') {
        maxLastmodBlog = lastmod > maxLastmodBlog ? lastmod : maxLastmodBlog;
      } else if (category === 'offer') {
        maxLastmodOffer = lastmod > maxLastmodOffer ? lastmod : maxLastmodOffer;
      } else if (category === 'tour') {
        maxLastmodTour = lastmod > maxLastmodTour ? lastmod : maxLastmodTour;
      }
    };

    // 1. Accumulate metadata overrides in a memory-efficient Map
    console.log('📦 Loading metadata overrides incrementally...');
    const metadataMap = new Map<string, { noindex?: boolean; updatedAt?: any }>();
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
    console.log('📄 Processing dynamic pages streaming...');
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
              writeUrlEntryWithTracking(pageStream, cleanPath, lastmod, cleanPath === '/' ? 'daily' : 'weekly', cleanPath === '/' ? '1.0' : '0.8', 'page');
            }
          }
        }
      });
    }

    // 3. Stream 'blogs' collection
    console.log('✍️ Processing blog posts streaming...');
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
            writeUrlEntryWithTracking(blogStream, cleanPath, lastmod, 'weekly', '0.8', 'blog');
          }
        }
      });
    }

    // 4. Stream 'offers' collection
    console.log('🏷️ Processing promo offers streaming...');
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
            writeUrlEntryWithTracking(offerStream, cleanPath, lastmod, 'weekly', '0.8', 'offer');
          }
        }
      });
    }

    // 5. Stream 'tours' collection
    console.log('🗺️ Processing private tours streaming...');
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
            writeUrlEntryWithTracking(toursStream, cleanPath, lastmod, 'weekly', '0.8', 'tour');
          }
        }
      });
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
          'page'
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
      { name: 'page-sitemap.xml', lastmod: maxLastmodPage },
      { name: 'blog-sitemap.xml', lastmod: maxLastmodBlog },
      { name: 'offer-sitemap.xml', lastmod: maxLastmodOffer },
      { name: 'tours-sitemap.xml', lastmod: maxLastmodTour }
    ];

    subSitemapFiles.forEach(file => {
      indexStream.write(`  <sitemap>
    <loc>${SITE_URL}/${file.name}</loc>
    <lastmod>${file.lastmod}</lastmod>
  </sitemap>\n`);
    });

    indexStream.write('</sitemapindex>');
    indexStream.end();

    await new Promise<void>((resolve, reject) => {
      indexStream.on('finish', () => resolve());
      indexStream.on('error', (err) => reject(err));
    });

    // Move completed sitemaps into public/ and dist/
    const filesToCopy = [
      { temp: pageTempPath, name: 'page-sitemap.xml' },
      { temp: blogTempPath, name: 'blog-sitemap.xml' },
      { temp: offerTempPath, name: 'offer-sitemap.xml' },
      { temp: toursTempPath, name: 'tours-sitemap.xml' },
      { temp: indexTempPath, name: 'sitemap_index.xml' },
      { temp: indexTempPath, name: 'sitemap.xml' } // Copy index as sitemap.xml for legacy compatibility
    ];

    filesToCopy.forEach(f => {
      fs.copyFileSync(f.temp, path.join(PUBLIC_DIR, f.name));
      fs.copyFileSync(f.temp, path.join(DIST_DIR, f.name));
    });

    // Clean up temporary files unique paths at the end
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

  } catch (error) {
    console.error('❌ Error generating sitemaps:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

generateSitemap();
