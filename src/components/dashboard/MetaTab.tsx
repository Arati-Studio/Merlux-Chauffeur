import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe, Search, Layout, FileText, BookOpen, Tag, MapPin, Pencil, Ban,
  CheckCircle, XCircle, X, AlertCircle, ExternalLink, Save,
  Loader2, Info, ChevronRight, Eye, EyeOff, Code, FileJson,
  FileSearch, Blocks, Settings, ShieldCheck, Database, Server,
  ListChecks, Filter, ChevronsLeft, ChevronLeft, ChevronsRight
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, serverTimestamp, addDoc, setDoc } from 'firebase/firestore';
import { getCachedDocs, clearFsCache } from '../../lib/firestore-cache';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { metadataFallback } from '../../data/fallback/metadataFallback';

interface IndexTabProps {
  showDashboardNotice: (type: any, message: string, title?: string) => void;
}

const SCHEMA_TEMPLATES = {
  WebPage: {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "{{title}}",
    "description": "{{description}}",
    "url": "{{url}}",
    "keywords": "{{keywords}}"
  },
  Article: {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "{{title}}",
    "description": "{{description}}",
    "image": "{{image}}",
    "keywords": "{{keywords}}",
    "author": {
      "@type": "Organization",
      "name": "Merlux Chauffeur"
    }
  },
  Service: {
    "@context": "https://schema.org",
    "@type": "Service",
    "serviceType": "{{title}}",
    "provider": {
      "@type": "LocalBusiness",
      "name": "Merlux Chauffeur"
    },
    "description": "{{description}}",
    "keywords": "{{keywords}}"
  },
  Product: {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "{{title}}",
    "description": "{{description}}",
    "keywords": "{{keywords}}",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "AUD",
      "availability": "https://schema.org/InStock"
    }
  },
  FAQ: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "keywords": "{{keywords}}",
    "mainEntity": [
      {
        "@type": "Question",
        "name": "Question 1",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Answer 1"
        }
      }
    ]
  }
};

const lintJson = (str: string): string | null => {
  try {
    JSON.parse(str);
    return null;
  } catch (err: any) {
    const msg = err.message || '';

    // Check some common culprits
    if (str.includes("'")) {
      return 'Invalid JSON Structure: JSON requires double quotes (") for keys and string values, single quotes (\') are not allowed.';
    }
    if (/[{,]\s*[a-zA-Z0-9_]+\s*:/g.test(str)) {
      return 'Invalid JSON Structure: JSON keys must be wrapped in double quotes (e.g. "key": "value").';
    }
    if (/,(\s*[}\]])/g.test(str)) {
      return 'Invalid JSON Structure: Trailing commas are not allowed in JSON (e.g. check commas before closing braces/brackets).';
    }

    // Balanced brackets check
    const openBraces = (str.match(/{/g) || []).length;
    const closeBraces = (str.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      return `Invalid JSON Structure: Unbalanced curly braces (found ${openBraces} '{' and ${closeBraces} '}').`;
    }

    const openBrackets = (str.match(/\[/g) || []).length;
    const closeBrackets = (str.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
      return `Invalid JSON Structure: Unbalanced square brackets (found ${openBrackets} '[' and ${closeBrackets} ']').`;
    }

    return `Invalid JSON Structure: ${msg}`;
  }
};

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

const IndexTab: React.FC<IndexTabProps> = ({ showDashboardNotice }) => {
  const [pages, setPages] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [metadataDocs, setMetadataDocs] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const updateCacheAndTrigger = () => {
    clearFsCache();
    setRefreshTrigger(prev => prev + 1);
  };
  const [isSaving, setIsSaving] = useState(false);
  const [activeSubSection, setActiveSubSection] = useState<'console' | 'sitemap' | 'robots' | 'schema'>('console');
  const [sitemapStats, setSitemapStats] = useState<any>(null);
  const [sitemapStatsLoading, setSitemapStatsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [orgSchemaEdit, setOrgSchemaEdit] = useState('');
  const [localSchemaEdit, setLocalSchemaEdit] = useState('');
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [previewDevice, setPreviewDevice] = useState<'mobile' | 'desktop'>('desktop');
  const [previewTheme, setPreviewTheme] = useState<'light' | 'dark'>('dark');
  const [editForm, setEditForm] = useState<any>({
    metaTitle: '',
    metaDescription: '',
    keywords: '',
    noindex: false,
    structuredData: ''
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('All');
  const [jsonLdFilter, setJsonLdFilter] = useState('All');
  const [indexingFilter, setIndexingFilter] = useState('All');
  const [metaCompletenessFilter, setMetaCompletenessFilter] = useState('All');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, contentTypeFilter, jsonLdFilter, indexingFilter, metaCompletenessFilter]);
  const [bulkForm, setBulkForm] = useState({
    metaTitleAction: 'keep', // 'keep', 'replace', 'prefix', 'suffix', 'append_brand'
    metaTitleValue: '',
    metaDescriptionAction: 'keep', // 'keep', 'replace', 'append'
    metaDescriptionValue: '',
    keywordsAction: 'keep', // 'keep', 'replace', 'append'
    keywordsValue: '',
    noindexAction: 'keep', // 'keep', 'index', 'noindex'
    schemaAction: 'keep', // 'keep', 'clear', 'WebPage', 'Article', 'Service', 'Product', 'FAQ'
  });

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

  const getSchemaType = (structuredData: any): string => {
    if (!structuredData) return '';
    try {
      const data = typeof structuredData === 'string' ? JSON.parse(structuredData) : structuredData;
      if (data) {
        if (data['@type']) {
          return Array.isArray(data['@type']) ? data['@type'].join(', ') : String(data['@type']);
        }
        if (Array.isArray(data) && data[0] && data[0]['@type']) {
          return String(data[0]['@type']);
        }
      }
    } catch (e) {
      // ignore
    }
    return 'Custom';
  };

  useEffect(() => {
    if (editingItem) {
      setEditForm({
        metaTitle: editingItem.metaTitle || '',
        metaDescription: editingItem.metaDescription || '',
        keywords: Array.isArray(editingItem.keywords) ? editingItem.keywords.join(', ') : (editingItem.keywords || ''),
        noindex: editingItem.noindex || false,
        structuredData: typeof editingItem.structuredData === 'string' ? editingItem.structuredData : JSON.stringify(editingItem.structuredData || '', null, 2)
      });
    }
  }, [editingItem]);

  // Automatic JSON Template synchronizer for editing fields
  useEffect(() => {
    if (!editingItem) return;
    if (!editForm.structuredData || !editForm.structuredData.trim()) return;

    try {
      const obj = JSON.parse(editForm.structuredData);
      let changed = false;

      const updateFields = (node: any, isRoot = false) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
          node.forEach(n => updateFields(n, false));
          return;
        }

        if ('name' in node && typeof node.name === 'string' && node.name !== editForm.metaTitle && !node.name.includes('{{')) {
          node.name = editForm.metaTitle;
          changed = true;
        }
        if ('headline' in node && typeof node.headline === 'string' && node.headline !== editForm.metaTitle && !node.headline.includes('{{')) {
          node.headline = editForm.metaTitle;
          changed = true;
        }
        if ('serviceType' in node && typeof node.serviceType === 'string' && node.serviceType !== editForm.metaTitle && !node.serviceType.includes('{{')) {
          node.serviceType = editForm.metaTitle;
          changed = true;
        }
        if ('description' in node && typeof node.description === 'string' && node.description !== editForm.metaDescription && !node.description.includes('{{')) {
          node.description = editForm.metaDescription;
          changed = true;
        }

        if ('keywords' in node) {
          if (typeof node.keywords === 'string') {
            if (node.keywords !== editForm.keywords) {
              node.keywords = editForm.keywords;
              changed = true;
            }
          } else if (Array.isArray(node.keywords)) {
            const kwsArray = editForm.keywords.split(',').map((k: string) => k.trim()).filter(Boolean);
            if (JSON.stringify(node.keywords) !== JSON.stringify(kwsArray)) {
              node.keywords = kwsArray;
              changed = true;
            }
          }
        } else if (isRoot && editForm.keywords && editForm.keywords.trim()) {
          node.keywords = editForm.keywords;
          changed = true;
        }

        for (const k in node) {
          if (typeof node[k] === 'object') {
            updateFields(node[k], false);
          }
        }
      };

      updateFields(obj, true);

      if (changed) {
        const updatedJson = JSON.stringify(obj, null, 2);
        setEditForm(prev => {
          if (prev.structuredData === updatedJson) return prev;
          return { ...prev, structuredData: updatedJson };
        });
      }
    } catch {
      // Ignore parsing errors during raw edits
    }
  }, [editForm.metaTitle, editForm.metaDescription, editForm.keywords]);

  const handleSaveMetadata = async () => {
    if (!editingItem) return;
    setIsSaving(true);
    const collectionName = editingItem.type === 'Page' ? 'pages' :
      editingItem.type === 'Blog' ? 'blogs' :
        editingItem.type === 'Offer' ? 'offers' : 'tours';

    let structuredDataParsed = null;
    if (editForm.structuredData.trim()) {
      const lintError = lintJson(editForm.structuredData);
      if (lintError) {
        showDashboardNotice('error', lintError);
        setIsSaving(false);
        return;
      }
      try {
        structuredDataParsed = JSON.parse(editForm.structuredData);
      } catch (e: any) {
        showDashboardNotice('error', `Invalid JSON Structure: ${e.message || 'JSON.parse failed'}`);
        setIsSaving(false);
        return;
      }
    }

    try {
      const isVirtualItem = editingItem.isVirtual || editingItem.id.startsWith('static-');
      const keywordsArray = editForm.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k);
      const routeSlug = getRouteSlug(editingItem);
      const docId = routeSlug.replace(/\//g, '_') || 'home';

      // 1. Save to the unified 'metadata' metadata collection
      await setDoc(doc(db, 'metadata', docId), {
        id: docId,
        title: editingItem.title,
        slug: routeSlug,
        type: editingItem.type,
        metaTitle: editForm.metaTitle,
        metaDescription: editForm.metaDescription,
        keywords: keywordsArray,
        noindex: editForm.noindex,
        structuredData: structuredDataParsed,
        updatedAt: serverTimestamp()
      });

      // 2. Synchronize back into native collection doc
      if (!isVirtualItem) {
        await updateDoc(doc(db, collectionName, editingItem.id), {
          metaTitle: editForm.metaTitle,
          metaDescription: editForm.metaDescription,
          keywords: keywordsArray,
          noindex: editForm.noindex,
          structuredData: structuredDataParsed,
          updatedAt: serverTimestamp()
        });
      } else if (editingItem.type === 'Page' && !editingItem.isStaticSystemPage) {
        const { id, isVirtual, isStaticSystemPage, ...cleanItem } = editingItem;
        await addDoc(collection(db, 'pages'), {
          ...cleanItem,
          metaTitle: editForm.metaTitle,
          metaDescription: editForm.metaDescription,
          keywords: keywordsArray,
          noindex: editForm.noindex,
          structuredData: structuredDataParsed,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      showDashboardNotice('success', `Metadata updated for ${editingItem.title}`);
      updateCacheAndTrigger();
      setEditingItem(null);
    } catch (err: any) {
      console.error('Error saving metadata:', err);
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${editingItem.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const applySchemaTemplate = (templateKey: keyof typeof SCHEMA_TEMPLATES) => {
    if (!editingItem) return;
    const template = SCHEMA_TEMPLATES[templateKey];
    const path = getFullPath(editingItem);
    const url = `${window.location.origin}${path}`;

    let jsonString = JSON.stringify(template, null, 2);
    jsonString = jsonString
      .replace(/{{title}}/g, editForm.metaTitle || editingItem.title || '')
      .replace(/{{description}}/g, editForm.metaDescription || '')
      .replace(/{{url}}/g, url)
      .replace(/{{image}}/g, editingItem.featuredImage || editingItem.ogImage || '')
      .replace(/{{keywords}}/g, editForm.keywords || '');

    setEditForm({ ...editForm, structuredData: jsonString });
    showDashboardNotice('success', `${templateKey} template applied.`);
  };

  useEffect(() => {
    let active = true;
    const fetchAllData = async () => {
      try {
        const pagesData = await getCachedDocs(query(collection(db, 'pages')), 'meta_pages');
        if (active) {
          const parsed = pagesData.map(d => ({ id: d.id, type: 'Page', ...d }));
          parsed.sort((a: any, b: any) => {
            const tA = a.createdAt?.seconds || a.createdAt || 0;
            const tB = b.createdAt?.seconds || b.createdAt || 0;
            return tB - tA;
          });
          setPages(parsed);
        }
      } catch (err) {
        console.warn("MetaTab pages load error:", err);
      }

      try {
        const blogsData = await getCachedDocs(query(collection(db, 'blogs')), 'meta_blogs');
        if (active) {
          const parsed = blogsData.map(d => ({ id: d.id, type: 'Blog', ...d }));
          parsed.sort((a: any, b: any) => {
            const tA = a.createdAt?.seconds || a.createdAt || 0;
            const tB = b.createdAt?.seconds || b.createdAt || 0;
            return tB - tA;
          });
          setBlogs(parsed);
        }
      } catch (err) {
        console.warn("MetaTab blogs load error:", err);
      }

      try {
        const offersData = await getCachedDocs(query(collection(db, 'offers')), 'meta_offers');
        if (active) {
          const parsed = offersData.map(d => ({ id: d.id, type: 'Offer', ...d }));
          parsed.sort((a: any, b: any) => {
            const tA = a.createdAt?.seconds || a.createdAt || 0;
            const tB = b.createdAt?.seconds || b.createdAt || 0;
            return tB - tA;
          });
          setOffers(parsed);
        }
      } catch (err) {
        console.warn("MetaTab offers load error:", err);
      }

      try {
        const toursData = await getCachedDocs(query(collection(db, 'tours')), 'meta_tours');
        if (active) {
          const parsed = toursData.map(d => ({ id: d.id, type: 'Tour', ...d }));
          parsed.sort((a: any, b: any) => {
            const tA = a.createdAt?.seconds || a.createdAt || 0;
            const tB = b.createdAt?.seconds || b.createdAt || 0;
            return tB - tA;
          });
          setTours(parsed);
        }
      } catch (err) {
        console.warn("MetaTab tours load error:", err);
      }

      try {
        const metaData = await getCachedDocs(query(collection(db, 'metadata')), 'meta_docs');
        if (active) {
          if (metaData.length > 0) {
            setMetadataDocs(metaData);
          } else {
            setMetadataDocs(metadataFallback);
          }
        }
      } catch (err) {
        console.warn("MetaTab metadata docs load error:", err);
        if (active) setMetadataDocs(metadataFallback);
      }

      try {
        const settingsRef = doc(db, 'settings', 'system');
        const cachedSetting = sessionStorage.getItem('fs_cache_doc_settings/system');
        let systemData = null;
        if (cachedSetting) {
          systemData = JSON.parse(cachedSetting).data;
        } else {
          const { getCachedDoc } = await import('../../lib/firestore-cache');
          systemData = await getCachedDoc(settingsRef);
        }
        if (active && systemData) {
          setSystemSettings(systemData);
          if (systemData.schema) {
            setOrgSchemaEdit(typeof systemData.schema.organization === 'string' ? systemData.schema.organization : JSON.stringify(systemData.schema.organization || '', null, 2));
            setLocalSchemaEdit(typeof systemData.schema.localBusiness === 'string' ? systemData.schema.localBusiness : JSON.stringify(systemData.schema.localBusiness || '', null, 2));
          }
        }
      } catch (err) {
        console.warn("MetaTab system load error:", err);
      }

      if (active) {
        setLoading(false);
      }
    };

    fetchAllData();
    return () => {
      active = false;
    };
  }, [refreshTrigger]);

  const fetchSitemapStats = async () => {
    try {
      const response = await fetch('/sitemap-stats.json');
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          setSitemapStats(data);
        } else {
          console.warn('Sitemap stats response was not JSON:', contentType);
        }
      }
    } catch (err) {
      console.error('Error fetching sitemap stats:', err);
    } finally {
      setSitemapStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchSitemapStats();
  }, []);

  const getMergedContent = () => {
    const items: any[] = [];
    const dynamicSlugs = new Set<string>();

    // 1. Pages (dynamic)
    pages.forEach(p => {
      const slugKey = (p.slug || '').toLowerCase();
      dynamicSlugs.add(slugKey);

      const routeSlug = p.slug || 'home';
      const docOverride = metadataDocs.find(d => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

      items.push({
        id: p.id,
        title: p.title,
        slug: p.slug || '',
        type: 'Page',
        metaTitle: docOverride?.metaTitle !== undefined ? docOverride.metaTitle : (p.metaTitle || ''),
        metaDescription: docOverride?.metaDescription !== undefined ? docOverride.metaDescription : (p.metaDescription || ''),
        keywords: docOverride?.keywords !== undefined ? docOverride.keywords : (p.keywords || []),
        noindex: p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false)),
        structuredData: docOverride?.structuredData !== undefined ? docOverride.structuredData : (p.structuredData || null),
        active: p.active !== false,
        updatedAt: docOverride?.updatedAt || p.updatedAt || p.createdAt || null,
        createdAt: p.createdAt || null
      });
    });

    // 2. Static Pages (add if not already covered by a dynamic page)
    staticPages.forEach(sp => {
      const slugKey = sp.slug.toLowerCase();
      const isCovered = dynamicSlugs.has(slugKey);

      if (!isCovered) {
        const routeSlug = sp.slug || 'home';
        const docOverride = metadataDocs.find(d => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

        items.push({
          id: `static-${sp.slug || 'home'}`,
          title: sp.title,
          slug: sp.slug,
          type: 'Page',
          isStaticSystemPage: true,
          isVirtual: true,
          metaTitle: docOverride?.metaTitle !== undefined ? docOverride.metaTitle : '',
          metaDescription: docOverride?.metaDescription !== undefined ? docOverride.metaDescription : '',
          keywords: docOverride?.keywords !== undefined ? docOverride.keywords : [],
          noindex: docOverride?.noindex !== undefined ? docOverride.noindex : false,
          structuredData: docOverride?.structuredData !== undefined ? docOverride.structuredData : null,
          active: true,
          updatedAt: docOverride?.updatedAt || null,
          createdAt: null
        });
      } else {
        const index = items.findIndex(p => p.type === 'Page' && String(p.slug).toLowerCase() === slugKey);
        if (index !== -1) {
          items[index].isStaticSystemPage = true;
          items[index].title = sp.title;
          const routeSlug = sp.slug || 'home';
          const docOverride = metadataDocs.find(d => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));
          if (docOverride?.updatedAt) {
            items[index].updatedAt = docOverride.updatedAt;
          }
        }
      }
    });

    // 3. Blogs
    blogs.forEach(b => {
      const routeSlug = `blog/${b.slug}`;
      const docOverride = metadataDocs.find(d => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

      items.push({
        id: b.id,
        title: b.title,
        slug: b.slug,
        type: 'Blog',
        metaTitle: docOverride?.metaTitle !== undefined ? docOverride.metaTitle : (b.metaTitle || ''),
        metaDescription: docOverride?.metaDescription !== undefined ? docOverride.metaDescription : (b.metaDescription || ''),
        keywords: docOverride?.keywords !== undefined ? docOverride.keywords : (b.keywords || []),
        noindex: b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false)),
        structuredData: docOverride?.structuredData !== undefined ? docOverride.structuredData : (b.structuredData || null),
        active: b.active !== false,
        updatedAt: docOverride?.updatedAt || b.updatedAt || b.createdAt || null,
        createdAt: b.createdAt || null
      });
    });

    // 4. Offers
    offers.forEach(o => {
      const routeSlug = `offers/${o.slug}`;
      const docOverride = metadataDocs.find(d => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

      items.push({
        id: o.id,
        title: o.title || o.name || 'Special Offer',
        slug: o.slug,
        type: 'Offer',
        metaTitle: docOverride?.metaTitle !== undefined ? docOverride.metaTitle : (o.metaTitle || ''),
        metaDescription: docOverride?.metaDescription !== undefined ? docOverride.metaDescription : (o.metaDescription || ''),
        keywords: docOverride?.keywords !== undefined ? docOverride.keywords : (o.keywords || []),
        noindex: o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false)),
        structuredData: docOverride?.structuredData !== undefined ? docOverride.structuredData : (o.structuredData || null),
        active: o.active !== false,
        updatedAt: docOverride?.updatedAt || o.updatedAt || o.createdAt || null,
        createdAt: o.createdAt || null
      });
    });

    // 5. Tours
    tours.forEach(t => {
      const routeSlug = `tours/${t.slug}`;
      const docOverride = metadataDocs.find(d => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, '_'));

      items.push({
        id: t.id,
        title: t.title || t.name || 'Tour',
        slug: t.slug,
        type: 'Tour',
        metaTitle: docOverride?.metaTitle !== undefined ? docOverride.metaTitle : (t.metaTitle || ''),
        metaDescription: docOverride?.metaDescription !== undefined ? docOverride.metaDescription : (t.metaDescription || ''),
        keywords: docOverride?.keywords !== undefined ? docOverride.keywords : (t.keywords || []),
        noindex: t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false)),
        structuredData: docOverride?.structuredData !== undefined ? docOverride.structuredData : (t.structuredData || null),
        active: t.active !== false,
        updatedAt: docOverride?.updatedAt || t.updatedAt || t.createdAt || null,
        createdAt: t.createdAt || null
      });
    });

    // Deduplicate items based on type-id combination to prevent React key collisions
    const uniqueItems: any[] = [];
    const seenKeys = new Set<string>();
    items.forEach(item => {
      const itemKey = `${item.type}-${item.id || 'unnamed'}`;
      if (!seenKeys.has(itemKey)) {
        seenKeys.add(itemKey);
        uniqueItems.push(item);
      }
    });

    return uniqueItems;
  };

  const allContent = getMergedContent();

  const filteredContent = allContent.filter(item => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesTitle = (item.title || '').toLowerCase().includes(q);
      const matchesSlug = (item.slug || '').toLowerCase().includes(q);
      const matchesFullPath = getFullPath(item).toLowerCase().includes(q);
      if (!matchesTitle && !matchesSlug && !matchesFullPath) return false;
    }

    // Content type
    if (contentTypeFilter !== 'All') {
      if (item.type !== contentTypeFilter) return false;
    }

    // JSON-LD Filter
    if (jsonLdFilter !== 'All') {
      const hasSchema = !!item.structuredData;
      const schemaType = getSchemaType(item.structuredData);

      if (jsonLdFilter === 'NoSchema') {
        if (hasSchema) return false;
      } else if (jsonLdFilter === 'HasSchema') {
        if (!hasSchema) return false;
      } else {
        if (!hasSchema) return false;
        const lowerType = schemaType.toLowerCase();
        const lowerFilter = jsonLdFilter.toLowerCase();
        if (!lowerType.includes(lowerFilter)) return false;
      }
    }

    // Indexing filter
    if (indexingFilter !== 'All') {
      if (indexingFilter === 'Noindex') {
        if (!item.noindex) return false;
      } else if (indexingFilter === 'Index') {
        if (item.noindex) return false;
      }
    }

    // Meta completeness
    if (metaCompletenessFilter !== 'All') {
      const titleVal = (item.metaTitle || '').trim();
      const descVal = (item.metaDescription || '').trim();
      const hasTitle = titleVal.length > 0;
      const hasDesc = descVal.length > 0;

      if (metaCompletenessFilter === 'Empty') {
        if (hasTitle && hasDesc) return false;
      } else if (metaCompletenessFilter === 'Filled') {
        if (!hasTitle || !hasDesc) return false;
      } else if (metaCompletenessFilter === 'MissingTitle') {
        if (hasTitle) return false;
      } else if (metaCompletenessFilter === 'MissingDesc') {
        if (hasDesc) return false;
      }
    }

    return true;
  });

  const totalPages = pageSize === 'All' ? 1 : Math.ceil(filteredContent.length / pageSize);
  const paginatedContent = useMemo(() => {
    if (pageSize === 'All') return filteredContent;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredContent.slice(startIndex, startIndex + pageSize);
  }, [filteredContent, currentPage, pageSize]);

  const [isGeneratingSitemap, setIsGeneratingSitemap] = useState(false);

  const handleGenerateSitemap = async () => {
    setIsGeneratingSitemap(true);
    try {
      const response = await fetch('/api/admin/generate-sitemap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        showDashboardNotice('success', 'Sitemap generated successfully! All XML & HTML files updated in workspace.', 'Sitemap Generated');
        await fetchSitemapStats();
      } else {
        showDashboardNotice('error', `Failed to generate sitemap: ${data.error || 'Server error'}`, 'Generation Failed');
      }
    } catch (err: any) {
      showDashboardNotice('error', `Network error generating sitemap: ${err.message || 'Check connection'}`, 'Generation Failed');
    } finally {
      setIsGeneratingSitemap(false);
    }
  };

  const handleUpdateRobots = async (robotsText: string) => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'settings', 'system'), {
        'seo.robotsTxt': robotsText,
        updatedAt: serverTimestamp()
      });
      showDashboardNotice('success', 'Robots.txt updated successfully.');
      updateCacheAndTrigger();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'settings/system');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGlobalSchemas = async () => {
    setIsSaving(true);
    try {
      const orgLint = orgSchemaEdit ? lintJson(orgSchemaEdit) : null;
      const localLint = localSchemaEdit ? lintJson(localSchemaEdit) : null;

      if (orgLint) {
        showDashboardNotice('error', `Organization Schema: ${orgLint}`);
        setIsSaving(false);
        return;
      }
      if (localLint) {
        showDashboardNotice('error', `Local Business Schema: ${localLint}`);
        setIsSaving(false);
        return;
      }

      const orgData = orgSchemaEdit ? JSON.parse(orgSchemaEdit) : null;
      const localData = localSchemaEdit ? JSON.parse(localSchemaEdit) : null;

      await updateDoc(doc(db, 'settings', 'system'), {
        'schema.organization': orgData,
        'schema.localBusiness': localData,
        updatedAt: serverTimestamp()
      });
      showDashboardNotice('success', 'Global SEO schemas updated and synchronized.');
      updateCacheAndTrigger();
    } catch (err: any) {
      showDashboardNotice('error', `Schema Update Failed: ${err.message || 'Check JSON formatting'}`);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/system');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleNoIndex = async (item: any) => {
    const collectionName = item.type === 'Page' ? 'pages' :
      item.type === 'Blog' ? 'blogs' :
        item.type === 'Offer' ? 'offers' : 'tours';
    try {
      const isVirtualItem = item.isVirtual || item.id.startsWith('static-');
      const routeSlug = getRouteSlug(item);
      const docId = routeSlug.replace(/\//g, '_') || 'home';

      // 1. Toggle in unified 'metadata' collection
      await setDoc(doc(db, 'metadata', docId), {
        id: docId,
        title: item.title,
        slug: routeSlug,
        type: item.type,
        metaTitle: item.metaTitle || '',
        metaDescription: item.metaDescription || '',
        keywords: item.keywords || [],
        noindex: !item.noindex,
        structuredData: item.structuredData || null,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Toggle in native model
      if (!isVirtualItem) {
        await updateDoc(doc(db, collectionName, item.id), {
          noindex: !item.noindex,
          updatedAt: serverTimestamp()
        });
      } else if (item.type === 'Page' && !item.isStaticSystemPage) {
        const { id, isVirtual, isStaticSystemPage, ...cleanItem } = item;
        await addDoc(collection(db, 'pages'), {
          ...cleanItem,
          metaTitle: item.metaTitle || '',
          metaDescription: item.metaDescription || '',
          keywords: [],
          noindex: !item.noindex,
          structuredData: null,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      showDashboardNotice('success', `Indexing status updated for ${item.title}`);
      updateCacheAndTrigger();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${item.id}`);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'N/A';
    try {
      let date: Date;
      if (ts.toDate && typeof ts.toDate === 'function') {
        date = ts.toDate();
      } else if (ts.seconds) {
        date = new Date(ts.seconds * 1000);
      } else {
        date = new Date(ts);
      }
      if (isNaN(date.getTime())) return 'N/A';

      const pad = (num: number) => String(num).padStart(2, '0');
      const yyyy = date.getFullYear();
      const mm = pad(date.getMonth() + 1);
      const dd = pad(date.getDate());

      let hours = date.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const minutes = pad(date.getMinutes());

      return `${yyyy}-${mm}-${dd} ${pad(hours)}:${minutes} ${ampm}`;
    } catch {
      return 'N/A';
    }
  };

  const handleBulkExecute = async () => {
    if (selectedIds.length === 0) {
      showDashboardNotice('error', 'No items selected for bulk modification.');
      return;
    }
    setIsSaving(true);
    let successCount = 0;
    try {
      for (const itemKey of selectedIds) {
        const matchedItem = allContent.find(c => `${c.type}-${c.id}` === itemKey);
        if (!matchedItem) continue;

        const collectionName = matchedItem.type === 'Page' ? 'pages' :
          matchedItem.type === 'Blog' ? 'blogs' :
            matchedItem.type === 'Offer' ? 'offers' : 'tours';

        const isVirtualItem = matchedItem.isVirtual || matchedItem.id.startsWith('static-');
        const routeSlug = getRouteSlug(matchedItem);
        const docId = routeSlug.replace(/\//g, '_') || 'home';

        // Evaluate updates based on bulkForm actions
        let updatedMetaTitle = matchedItem.metaTitle || '';
        if (bulkForm.metaTitleAction === 'replace') {
          updatedMetaTitle = bulkForm.metaTitleValue;
        } else if (bulkForm.metaTitleAction === 'prefix') {
          updatedMetaTitle = bulkForm.metaTitleValue + updatedMetaTitle;
        } else if (bulkForm.metaTitleAction === 'suffix') {
          updatedMetaTitle = updatedMetaTitle + bulkForm.metaTitleValue;
        } else if (bulkForm.metaTitleAction === 'append_brand') {
          updatedMetaTitle = (updatedMetaTitle || matchedItem.title) + " | Merlux Chauffeur";
        }

        let updatedMetaDescription = matchedItem.metaDescription || '';
        if (bulkForm.metaDescriptionAction === 'replace') {
          updatedMetaDescription = bulkForm.metaDescriptionValue;
        } else if (bulkForm.metaDescriptionAction === 'append') {
          updatedMetaDescription = updatedMetaDescription + (updatedMetaDescription ? ' ' : '') + bulkForm.metaDescriptionValue;
        }

        let updatedKeywords = Array.isArray(matchedItem.keywords) ? [...matchedItem.keywords] : [];
        if (bulkForm.keywordsAction === 'replace') {
          updatedKeywords = bulkForm.keywordsValue.split(',').map((k: string) => k.trim()).filter(Boolean);
        } else if (bulkForm.keywordsAction === 'append' && bulkForm.keywordsValue.trim()) {
          const newKws = bulkForm.keywordsValue.split(',').map((k: string) => k.trim()).filter(Boolean);
          updatedKeywords = Array.from(new Set([...updatedKeywords, ...newKws]));
        }

        let updatedNoIndex = matchedItem.noindex || false;
        if (bulkForm.noindexAction === 'noindex') {
          updatedNoIndex = true;
        } else if (bulkForm.noindexAction === 'index') {
          updatedNoIndex = false;
        }

        let updatedStructuredData = matchedItem.structuredData || null;
        if (bulkForm.schemaAction === 'clear') {
          updatedStructuredData = null;
        } else if (bulkForm.schemaAction !== 'keep') {
          const templateKey = bulkForm.schemaAction as keyof typeof SCHEMA_TEMPLATES;
          if (SCHEMA_TEMPLATES[templateKey]) {
            const template = SCHEMA_TEMPLATES[templateKey];
            const pathValue = getFullPath(matchedItem);
            const urlValue = `${window.location.origin}${pathValue}`;

            let jsonString = JSON.stringify(template, null, 2);
            jsonString = jsonString
              .replace(/{{title}}/g, updatedMetaTitle || matchedItem.title || '')
              .replace(/{{description}}/g, updatedMetaDescription || '')
              .replace(/{{url}}/g, urlValue)
              .replace(/{{image}}/g, matchedItem.featuredImage || matchedItem.ogImage || '')
              .replace(/{{keywords}}/g, updatedKeywords.join(', '));

            try {
              updatedStructuredData = JSON.parse(jsonString);
            } catch {
              // fallback ignore
            }
          }
        }

        // 1. Write to metadata
        await setDoc(doc(db, 'metadata', docId), {
          id: docId,
          title: matchedItem.title,
          slug: routeSlug,
          type: matchedItem.type,
          metaTitle: updatedMetaTitle,
          metaDescription: updatedMetaDescription,
          keywords: updatedKeywords,
          noindex: updatedNoIndex,
          structuredData: updatedStructuredData,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Synchronize to native collection doc
        if (!isVirtualItem) {
          await updateDoc(doc(db, collectionName, matchedItem.id), {
            metaTitle: updatedMetaTitle,
            metaDescription: updatedMetaDescription,
            keywords: updatedKeywords,
            noindex: updatedNoIndex,
            structuredData: updatedStructuredData,
            updatedAt: serverTimestamp()
          });
        } else if (matchedItem.type === 'Page' && !matchedItem.isStaticSystemPage) {
          const { id, isVirtual, isStaticSystemPage, ...cleanItem } = matchedItem;
          await addDoc(collection(db, 'pages'), {
            ...cleanItem,
            metaTitle: updatedMetaTitle,
            metaDescription: updatedMetaDescription,
            keywords: updatedKeywords,
            noindex: updatedNoIndex,
            structuredData: updatedStructuredData,
            active: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        }
        successCount++;
      }

      showDashboardNotice('success', `Bulk Actions executed successfully on ${successCount} content pages!`);
      updateCacheAndTrigger();
      setSelectedIds([]);
      setShowBulkPanel(false);
    } catch (err: any) {
      console.error('Error executing bulk activity:', err);
      showDashboardNotice('error', `Failed to execute bulk changes: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass rounded-3xl border border-white/5">
        <Loader2 className="w-8 h-8 text-gold animate-spin mb-4" />
        <p className="text-gold text-[10px] uppercase tracking-widest font-bold">Fetching Index Data...</p>
      </div>
    );
  }

  const indexedCount = allContent.filter(c => !c.noindex).length;
  const noIndexCount = allContent.filter(c => c.noindex).length;

  const maxUpdateTime = allContent.reduce((max, item) => {
    const updatedAtVal = item.updatedAt;
    let t = 0;
    if (updatedAtVal) {
      if (updatedAtVal.seconds !== undefined) {
        t = updatedAtVal.seconds * 1000;
      } else if (updatedAtVal._seconds !== undefined) {
        t = updatedAtVal._seconds * 1000;
      } else if (updatedAtVal.toDate && typeof updatedAtVal.toDate === 'function') {
        t = updatedAtVal.toDate().getTime();
      } else {
        const d = new Date(updatedAtVal);
        t = isNaN(d.getTime()) ? 0 : d.getTime();
      }
    }
    const createdAtVal = item.createdAt;
    let tc = 0;
    if (createdAtVal) {
      if (createdAtVal.seconds !== undefined) {
        tc = createdAtVal.seconds * 1000;
      } else if (createdAtVal._seconds !== undefined) {
        tc = createdAtVal._seconds * 1000;
      } else if (createdAtVal.toDate && typeof createdAtVal.toDate === 'function') {
        tc = createdAtVal.toDate().getTime();
      } else {
        const d = new Date(createdAtVal);
        tc = isNaN(d.getTime()) ? 0 : d.getTime();
      }
    }
    const itemLatest = Math.max(t, tc);
    return itemLatest > max ? itemLatest : max;
  }, 0);

  const isPending = !sitemapStats?.lastGenerated || (maxUpdateTime > new Date(sitemapStats.lastGenerated).getTime());

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gold/10 flex items-center justify-center text-gold">
            <Globe size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/40 font-bold">Total Pages</p>
            <p className="text-2xl font-display text-white">{allContent.length}</p>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center text-green-500">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/40 font-bold">Indexed</p>
            <p className="text-2xl font-display text-white">{indexedCount}</p>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500">
            <XCircle size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/40 font-bold">No-Index</p>
            <p className="text-2xl font-display text-white">{noIndexCount}</p>
          </div>
        </div>
        <div className="glass p-6 rounded-2xl border border-white/5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <FileSearch size={24} />
          </div>
          <div>
            <p className="text-[10px] uppercase text-white/40 font-bold">Ready Sitemap</p>
            <p className="text-2xl font-display text-white">{indexedCount}</p>
          </div>
        </div>
      </div>

      {/* Top Inline Header Navigation */}
      <div className="glass p-2 rounded-lg px-4 border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-left">
          <h3 className="text-lg font-display text-gold flex items-center gap-2">
            {activeSubSection === 'console' && (
              <>
                <Server size={18} className="text-gold" />
                <span>Index Console</span>
              </>
            )}
            {activeSubSection === 'sitemap' && (
              <>
                <Globe size={18} className="text-gold" />
                <span>Sitemap Preview</span>
              </>
            )}
            {activeSubSection === 'robots' && (
              <>
                <ShieldCheck size={18} className="text-gold" />
                <span>Robots.txt Control</span>
              </>
            )}
            {activeSubSection === 'schema' && (
              <>
                <Blocks size={18} className="text-gold" />
                <span>Global Search Schemas</span>
              </>
            )}
          </h3>
          <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1">
            {activeSubSection === 'console' && 'Search engine indexing & metadata overrides'}
            {activeSubSection === 'sitemap' && 'Dynamic & Static route crawl map dictionary'}
            {activeSubSection === 'robots' && 'Search bot accessibility & block directives'}
            {activeSubSection === 'schema' && 'JSON-LD structured data blocks for rich results'}
          </p>
        </div>

        {/* Navigation Toggles (Icon Only) */}
        <div className="flex items-center gap-1.5 bg-black/30 p-1.5 rounded-2xl border border-white/5 self-start sm:self-auto shrink-0">
          {[
            { id: 'console', label: 'Index Console', icon: Server },
            { id: 'sitemap', label: 'Sitemap Preview', icon: Globe },
            { id: 'robots', label: 'Robots.txt', icon: ShieldCheck },
            { id: 'schema', label: 'Global Schema', icon: Blocks },
          ].map((tab) => {
            const IconComponent = tab.icon;
            const isActive = activeSubSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubSection(tab.id as any)}
                className={cn(
                  "p-2.5 rounded-xl transition-all relative group",
                  isActive
                    ? "bg-gold text-black shadow-lg shadow-gold/20"
                    : "text-white/40 hover:text-white hover:bg-white/5"
                )}
                title={tab.label}
              >
                <IconComponent size={16} />

                {/* Micro tooltip */}
                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2.5 py-1 rounded bg-black border border-white/10 text-[8px] font-bold uppercase tracking-widest text-white transition-opacity duration-150 opacity-0 group-hover:opacity-100 z-50 shadow-md">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="w-full">
        <AnimatePresence mode="wait">
          {activeSubSection === 'console' && (
            <motion.div
              key="console"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Search and Filters Bar */}
              <div className="bg-white/5 border border-white/5 rounded-3xl p-5 sm:p-6 space-y-4">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <Filter className="text-gold animate-pulse" size={14} />
                    <h4 className="text-[11px] font-bold text-white/80 uppercase tracking-widest mb-0">Index Console Filter Suite</h4>
                    {filteredContent.length !== allContent.length && (
                      <span className="text-[9px] px-2 py-0.5 rounded bg-gold/10 border border-gold/15 text-gold font-sans font-bold">
                        {filteredContent.length} of {allContent.length} matched
                      </span>
                    )}
                  </div>

                  {(searchQuery || contentTypeFilter !== 'All' || jsonLdFilter !== 'All' || indexingFilter !== 'All' || metaCompletenessFilter !== 'All') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setContentTypeFilter('All');
                        setJsonLdFilter('All');
                        setIndexingFilter('All');
                        setMetaCompletenessFilter('All');
                      }}
                      className="text-[9px] uppercase tracking-wider font-extrabold text-gold hover:text-white transition-colors self-end md:self-auto flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:border-white/10"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
                  {/* Search Input */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] uppercase tracking-widest font-black text-white/40 block">Search Page / Title / Slug</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Type keywords, path..."
                        className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-white/30 font-sans outline-none focus:border-gold transition-colors"
                      />
                      <Search className="absolute left-3 top-3.5 text-white/35" size={12} />
                    </div>
                  </div>

                  {/* Page Content based search */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] uppercase tracking-widest font-black text-white/40 block">Page Content Type</label>
                    <select
                      value={contentTypeFilter}
                      onChange={(e) => setContentTypeFilter(e.target.value)}
                      className="custom-select w-full"
                    >
                      <option value="All">All Content Types</option>
                      <option value="Page">Pages (Static Page)</option>
                      <option value="Blog">Blogs (Dynamic Blog)</option>
                      <option value="Offer">Offers (Dynamic Offer)</option>
                      <option value="Tour">Tours (Dynamic Tour)</option>
                    </select>
                  </div>

                  {/* JSON-LD Structured Type */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] uppercase tracking-widest font-black text-white/40 block">JSON-LD Schema Type</label>
                    <select
                      value={jsonLdFilter}
                      onChange={(e) => setJsonLdFilter(e.target.value)}
                      className="custom-select w-full"
                    >
                      <option value="All">All Schema States</option>
                      <option value="NoSchema">No JSON-LD / Empty</option>
                      <option value="HasSchema">Any Structured Data</option>
                      <option value="WebPage">WebPage Schema</option>
                      <option value="Article">Article Schema</option>
                      <option value="Service">Service Schema</option>
                      <option value="Product">Product/Tour Schema</option>
                      <option value="FAQ">FAQ Schema</option>
                    </select>
                  </div>

                  {/* Indexing status Filter */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] uppercase tracking-widest font-black text-white/40 block">Search Visibility</label>
                    <select
                      value={indexingFilter}
                      onChange={(e) => setIndexingFilter(e.target.value)}
                      className="custom-select w-full"
                    >
                      <option value="All">All Visibility</option>
                      <option value="Index">Indexed (Allow Google)</option>
                      <option value="Noindex">No-Indexed (Blocked)</option>
                    </select>
                  </div>

                  {/* Meta Data Empty/Filled status */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[9px] uppercase tracking-widest font-black text-white/40 block">Meta Completeness</label>
                    <select
                      value={metaCompletenessFilter}
                      onChange={(e) => setMetaCompletenessFilter(e.target.value)}
                      className="custom-select w-full"
                    >
                      <option value="All">All Completeness</option>
                      <option value="Filled">Fully Configured</option>
                      <option value="Empty">Needs Setup (Partially Empty)</option>
                      <option value="MissingTitle">Missing Meta Title</option>
                      <option value="MissingDesc">Missing Meta Description</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Bulk Action Toggle Control Strip */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/5 p-4 px-6 rounded-2xl border border-white/5">
                <div className="flex items-center gap-3">
                  <span className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-300",
                    selectedIds.length > 0 ? "bg-gold animate-pulse" : "bg-white/20"
                  )} />
                  <p className="text-[10px] text-white/60 uppercase font-extrabold tracking-widest leading-none">
                    {selectedIds.length === 0
                      ? "No items selected for bulk modification"
                      : `${selectedIds.length} item${selectedIds.length > 1 ? 's' : ''} queued for bulk operations`
                    }
                  </p>
                </div>

                <div className="flex gap-2 shrink-0">
                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="px-4 py-2 border border-white/10 hover:border-white/20 text-white/60 hover:text-white rounded-xl text-[9px] uppercase tracking-wider font-extrabold transition-all"
                    >
                      Clear Selection
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowBulkPanel(prev => !prev)}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[9px] font-extrabold uppercase tracking-widest transition-all flex items-center gap-2",
                      selectedIds.length > 0
                        ? "bg-gold text-black shadow-lg shadow-gold/20 hover:bg-[#cfa53b]"
                        : "bg-white/25 text-white/40 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <ListChecks size={13} />
                    <span>Configure Bulk Actions</span>
                  </button>
                </div>
              </div>

              <div className="glass rounded-[2rem] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-white/40 w-[50px] text-center">
                          <input
                            type="checkbox"
                            checked={paginatedContent.length > 0 && paginatedContent.every(item => selectedIds.includes(`${item.type}-${item.id}`))}
                            onChange={(e) => {
                              if (e.target.checked) {
                                const newIds = [...selectedIds];
                                paginatedContent.forEach(item => {
                                  const key = `${item.type}-${item.id}`;
                                  if (!newIds.includes(key)) newIds.push(key);
                                });
                                setSelectedIds(newIds);
                              } else {
                                const paginatedKeys = paginatedContent.map(item => `${item.type}-${item.id}`);
                                setSelectedIds(selectedIds.filter(id => !paginatedKeys.includes(id)));
                              }
                            }}
                            className="w-4 h-4 rounded border border-white/10 bg-white/5 text-gold accent-gold focus:ring-1 focus:ring-gold/30 focus:ring-offset-0 cursor-pointer transition-all hover:bg-white/10 hover:border-white/20"
                          />
                        </th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-white/40">Page Content</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-white/40">Meta Check</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-white/40">JSON-LD</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-white/40">Status</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-white/40 text-right">Visibility</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredContent.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center text-white/40">
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20">
                                <Search size={20} className="animate-pulse" />
                              </div>
                              <p className="text-[11px] uppercase tracking-widest font-black text-white/70">No Pages Matched Your Filters</p>
                              <p className="text-[10px] text-white/30 max-w-[280px] font-sans mx-auto leading-relaxed">
                                No content overrides match the active filter criteria. Try resetting the search query or options.
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchQuery('');
                                  setContentTypeFilter('All');
                                  setJsonLdFilter('All');
                                  setIndexingFilter('All');
                                  setMetaCompletenessFilter('All');
                                }}
                                className="mt-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-gold rounded-xl text-[9px] uppercase tracking-wider font-extrabold transition-all border border-white/5"
                              >
                                Clear All Filters
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedContent.map((item, idx) => {
                          const isItemSelected = selectedIds.includes(`${item.type}-${item.id}`);
                          return (
                            <tr
                              key={`${item.type}-${item.id}`}
                              className={cn(
                                "hover:bg-white/[0.02] transition-colors group",
                                isItemSelected && "bg-gold/[0.03] hover:bg-gold/[0.05]"
                              )}
                            >
                              <td className="px-6 py-5 text-center w-[50px]">
                                <input
                                  type="checkbox"
                                  checked={isItemSelected}
                                  onChange={(e) => {
                                    const itemKey = `${item.type}-${item.id}`;
                                    if (e.target.checked) {
                                      setSelectedIds(prev => prev.includes(itemKey) ? prev : [...prev, itemKey]);
                                    } else {
                                      setSelectedIds(prev => prev.filter(id => id !== itemKey));
                                    }
                                  }}
                                  className="w-4 h-4 rounded border border-white/10 bg-white/5 text-gold accent-gold focus:ring-1 focus:ring-gold/30 focus:ring-offset-0 cursor-pointer transition-all hover:bg-white/10 hover:border-white/20"
                                />
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/20 group-hover:text-gold transition-colors">
                                    {item.type === 'Page' ? <FileText size={14} /> :
                                      item.type === 'Blog' ? <BookOpen size={14} /> :
                                        item.type === 'Offer' ? <Tag size={14} /> : <MapPin size={14} />}
                                  </div>
                                  <div>
                                    <p className="text-[12px] font-bold text-white mb-0.5">{item.title}</p>
                                    <p className="text-[9px] text-white/30 font-mono truncate max-w-[150px] tracking-tight">/{item.slug}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    {item.metaTitle ? <CheckCircle size={10} className="text-green-500" /> : <AlertCircle size={10} className="text-red-500" />}
                                    <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Title</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {(item.metaDescription || item.content?.length > 50) ? <CheckCircle size={10} className="text-green-500" /> : <AlertCircle size={10} className="text-red-500" />}
                                    <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">Description</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <div className="flex flex-col gap-1.5 justify-center">
                                  <div className="flex items-center gap-2">
                                    <Code size={12} className={cn(item.structuredData ? "text-blue-500" : "text-white/10")} />
                                    <span className={cn("text-[9px] font-mono", item.structuredData ? "text-blue-500" : "text-white/20")}>
                                      {item.structuredData ? 'VALID' : 'MISSING'}
                                    </span>
                                  </div>
                                  {item.structuredData && (
                                    <span className="text-[8px] font-bold tracking-wider text-gold uppercase bg-gold/10 px-1.5 py-0.5 rounded border border-gold/15 w-fit">
                                      {getSchemaType(item.structuredData)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-5">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-full",
                                  item.noindex ? "bg-red-500/10 text-red-500" : "bg-green-500/10 text-green-500"
                                )}>
                                  {item.noindex ? 'No-Index' : 'Indexed'}
                                </span>
                              </td>
                              <td className="px-6 py-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setPreviewItem(item)}
                                    className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-sm"
                                    title="Live Search Preview"
                                  >
                                    <Eye size={14} />
                                  </button>
                                  <button
                                    onClick={() => setEditingItem(item)}
                                    className="p-2 bg-gold/10 border border-gold/20 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                    title="Edit Meta Data"
                                  >
                                    <Pencil size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleToggleNoIndex(item)}
                                    className={cn(
                                      "p-2 rounded-lg border transition-all",
                                      item.noindex
                                        ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white"
                                        : "bg-green-500/10 border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white"
                                    )}
                                    title={item.noindex ? "Enable Indexing" : "Disable Indexing"}
                                  >
                                    {item.noindex ? <Ban size={14} /> : <Globe size={14} />}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredContent.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-black/40 p-5 rounded-2xl border border-white/5 mt-8">
                  {/* Status info */}
                  <div className="text-[11px] font-mono text-white/50">
                    Showing <span className="text-gold font-bold">
                      {filteredContent.length === 0 ? 0 : (pageSize === 'All' ? 1 : (currentPage - 1) * pageSize + 1)}
                    </span> to <span className="text-gold font-bold">
                      {pageSize === 'All' ? filteredContent.length : Math.min(currentPage * pageSize, filteredContent.length)}
                    </span> of <span className="text-white font-bold">{filteredContent.length}</span> entries
                  </div>

                  {/* Pagination buttons */}
                  {pageSize !== 'All' && totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
                        title="First Page"
                      >
                        <ChevronsLeft size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
                        title="Previous Page"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      
                      {(() => {
                        const pageNumbers = [];
                        const maxButtons = 5;
                        let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                        if (endPage - startPage + 1 < maxButtons) {
                          startPage = Math.max(1, endPage - maxButtons + 1);
                        }
                        for (let i = Math.max(1, startPage); i <= endPage; i++) {
                          pageNumbers.push(i);
                        }
                        return pageNumbers.map(num => (
                          <button
                            key={`page-btn-${num}`}
                            type="button"
                            onClick={() => setCurrentPage(num)}
                            className={cn(
                              "w-8 h-8 flex items-center justify-center text-[10px] rounded-xl font-mono transition-all border font-bold cursor-pointer",
                              currentPage === num
                                ? "bg-gold text-black border-gold shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                                : "bg-white/5 text-white/70 border-white/10 hover:border-gold/30 hover:text-gold"
                            )}
                          >
                            {num}
                          </button>
                        ));
                      })()}

                      <button
                        type="button"
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
                        title="Next Page"
                      >
                        <ChevronRight size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer flex items-center justify-center"
                        title="Last Page"
                      >
                        <ChevronsRight size={14} />
                      </button>
                    </div>
                  )}

                  {/* Page size dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold font-mono">Page Size:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPageSize(val === 'All' ? 'All' : Number(val));
                        setCurrentPage(1);
                      }}
                      className="custom-select bg-black text-gold text-[10px] font-mono border border-white/10 rounded-xl pl-3 pr-10 py-1.5 focus:outline-none focus:border-gold font-bold uppercase cursor-pointer"
                    >
                      <option value={10}>10 Entries</option>
                      <option value={20}>20 Entries</option>
                      <option value={50}>50 Entries</option>
                      <option value="All">All Entries</option>
                    </select>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeSubSection === 'sitemap' && (
            <motion.div
              key="sitemap"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white/5 p-8 rounded-3xl border border-white/5 space-y-6 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Active crawable indexes (static & dynamic)</p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handleGenerateSitemap}
                      disabled={isGeneratingSitemap}
                      className={cn(
                        "flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border transition-all cursor-pointer",
                        isGeneratingSitemap
                          ? "bg-gold/5 border-gold/10 text-gold/40 cursor-not-allowed"
                          : "bg-gold text-black border-gold hover:bg-black hover:text-gold"
                      )}
                    >
                      {isGeneratingSitemap ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Globe size={13} />
                          Generate Sitemap
                        </>
                      )}
                    </button>
                    <div className="flex items-center gap-1.5 font-mono text-[9px] text-gold uppercase tracking-wider bg-gold/10 px-2.5 py-1 rounded border border-gold/15">
                      <CheckCircle size={10} className="text-gold" />
                      Dynamic XML live
                    </div>
                  </div>
                </div>

                {/* Sitemap Status and Build Time visual indicator panel */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-black/30 p-5 rounded-2xl border border-white/5 text-[11px] font-mono">
                  {/* Status Badge */}
                  <div className="flex items-center justify-between md:justify-start gap-4">
                    <span className="text-white/40 uppercase tracking-widest text-[9px]">Sitemap Status:</span>
                    {isPending ? (
                      <span className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 border border-amber-500/10 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Pending
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle size={10} className="text-green-400 animate-bounce" />
                        Generated
                      </span>
                    )}
                  </div>

                  {/* Last Build/Generation Timestamp */}
                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <span className="text-white/40 uppercase tracking-widest text-[9px]">Last Successful Build:</span>
                    <span className="text-gold font-bold bg-white/[0.02] border border-white/5 rounded px-2.5 py-1">
                      {sitemapStatsLoading ? (
                        <span className="opacity-30 animate-pulse">Syncing...</span>
                      ) : sitemapStats?.lastGenerated ? (
                        new Date(sitemapStats.lastGenerated).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      ) : (
                        "Never"
                      )}
                    </span>
                  </div>
                </div>

                <div className="space-y-3 bg-black/40 p-6 rounded-2xl border border-white/5 font-mono text-[11px] max-h-[500px] overflow-y-auto custom-scrollbar">
                  <p className="text-gold opacity-50 mb-4 border-b border-gold/10 pb-2">/sitemap.xml Analysis:</p>

                  <div className="space-y-4">
                    {/* Static Pages */}
                    <div>
                      <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] mb-3 font-bold">Static Infrastructure</p>
                      <div className="space-y-2 pl-2">
                        {staticPages.map((page) => {
                          const mergedItem = allContent.find(c => c.type === 'Page' && String(c.slug).toLowerCase() === page.slug.toLowerCase());
                          if (mergedItem?.noindex) return null; // Hide noindex pages from sitemap crawl
                          const fullPageUrl = `${window.location.origin}${page.path}`;
                          const lastModStr = formatTimestamp(mergedItem?.updatedAt || mergedItem?.createdAt);
                          return (
                            <div
                              key={`static-${page.slug}`}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-gold/20 transition-all group font-mono text-[11px]"
                            >
                              <a
                                href={fullPageUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2.5 text-white/40 hover:text-gold transition-colors truncate min-w-0"
                              >
                                <ChevronRight size={12} className="text-gold/40 group-hover:translate-x-1 transition-transform shrink-0" />
                                <span className="opacity-30 select-none hidden md:inline shrink-0">{window.location.origin}</span>
                                <span className="text-white/80 font-bold truncate">{page.path || '/'}</span>
                              </a>
                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-5 sm:pl-0">
                                <div className="text-[9px] text-white/30 uppercase tracking-wider font-sans font-bold bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                  System Page
                                </div>
                                <span className="text-[10px] text-white/30" title="Last Modified Date & Time">
                                  {lastModStr}
                                </span>
                                <a
                                  href={fullPageUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-white/20 group-hover:text-gold transition-colors"
                                >
                                  <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Dynamic Content */}
                    <div>
                      <p className="text-[10px] text-white/20 uppercase tracking-[0.2em] mb-3 font-bold">Dynamic Entries</p>
                      <div className="space-y-2 pl-2">
                        {allContent.filter(c => !c.noindex && !c.isStaticSystemPage).map((item) => {
                          const fullPath = getFullPath(item);
                          const absoluteUrl = `${window.location.origin}${fullPath}`;
                          const lastModStr = formatTimestamp(item.updatedAt || item.createdAt);

                          return (
                            <div
                              key={`xml-${item.type}-${item.id}`}
                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-xl bg-white/[0.01] hover:bg-white/[0.03] border border-white/5 hover:border-gold/20 transition-all group font-mono text-[11px]"
                            >
                              <a
                                href={absoluteUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2.5 text-white/40 hover:text-gold transition-colors truncate min-w-0"
                              >
                                <ChevronRight size={12} className="text-gold group-hover:translate-x-1 transition-transform shrink-0" />
                                <span className="opacity-30 select-none hidden md:inline shrink-0">{window.location.origin}</span>
                                <span className="text-white/80 font-bold truncate">{fullPath}</span>
                              </a>
                              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pl-5 sm:pl-0">
                                <span className={cn(
                                  "text-[9px] font-sans font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/5",
                                  item.type === 'Blog' ? 'text-blue-400' :
                                    item.type === 'Offer' ? 'text-purple-400' :
                                      item.type === 'Tour' ? 'text-green-400' : 'text-gold'
                                )}>
                                  {item.type}
                                </span>
                                <span className="text-[10px] text-white/30" title="Last Modified Date & Time">
                                  {lastModStr}
                                </span>
                                <a
                                  href={absoluteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-white/20 group-hover:text-gold transition-colors"
                                >
                                  <ExternalLink size={10} />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 rounded-xl bg-gold/5 border border-gold/10">
                  <Info size={16} className="text-gold shrink-0" />
                  <p className="text-[10px] text-white/60 leading-relaxed uppercase tracking-widest">
                    Search engines will crawl these URLs based on your robots.txt configuration and index meta tags automatically.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubSection === 'robots' && (
            <motion.div
              key="robots"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white/5 p-8 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Global Crawler Instructions</p>
                  <button
                    onClick={() => handleUpdateRobots(systemSettings?.seo?.robotsTxt || '')}
                    disabled={isSaving}
                    className="btn-primary px-5 py-2 h-9 text-[9px] uppercase tracking-widest font-black flex items-center justify-center gap-1.5"
                  >
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Update Directives
                  </button>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">Robots Directives</label>
                  <textarea
                    value={systemSettings?.seo?.robotsTxt || 'User-agent: *\nAllow: /\nSitemap: ' + window.location.origin + '/sitemap_index.xml'}
                    onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...(systemSettings?.seo || {}), robotsTxt: e.target.value } })}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 font-mono text-sm text-gold outline-none focus:border-gold transition-all min-h-[300px]"
                    placeholder="User-agent: *..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-[10px] uppercase text-gold font-bold mb-2">Common Directives</h4>
                    <div className="space-y-1 text-[10px] text-white/40 font-mono">
                      <p>User-agent: *</p>
                      <p>Disallow: /admin</p>
                      <p>Disallow: /dashboard</p>
                      <p>Allow: /</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-[10px] uppercase text-gold font-bold mb-2">Bot Support</h4>
                    <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-widest">
                      Standard compliance is guaranteed for Googlebot, Bingbot, and Slurp. Crawler caches may take up to 48h to refresh.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeSubSection === 'schema' && (
            <motion.div
              key="schema"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="bg-white/5 p-8 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="text-left">
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Site-Wide Structured Data</p>
                    <h4 className="text-lg font-display text-white mt-1">Global Schema Management</h4>
                  </div>
                  <button
                    onClick={handleUpdateGlobalSchemas}
                    disabled={isSaving}
                    className="btn-primary px-8 py-2.5 h-10 text-[10px] uppercase tracking-widest font-black flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Sync Global Schemas
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-gold">
                        <Database size={18} />
                        <h4 className="text-[10px] uppercase font-bold tracking-widest">Organization Schema</h4>
                      </div>
                      <span className="text-[8px] text-white/20 font-mono tracking-tighter uppercase">Organization JSON-LD</span>
                    </div>
                    <textarea
                      value={orgSchemaEdit}
                      onChange={(e) => setOrgSchemaEdit(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 font-mono text-[11px] text-blue-400 outline-none focus:border-gold transition-all min-h-[400px] custom-scrollbar"
                      placeholder='{ "@context": "https://schema.org", "@type": "Organization", ... }'
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-gold">
                        <FileJson size={18} />
                        <h4 className="text-[10px] uppercase font-bold tracking-widest">Local Business Schema</h4>
                      </div>
                      <span className="text-[8px] text-white/20 font-mono tracking-tighter uppercase">LocalBusiness JSON-LD</span>
                    </div>
                    <textarea
                      value={localSchemaEdit}
                      onChange={(e) => setLocalSchemaEdit(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 font-mono text-[11px] text-green-500 outline-none focus:border-gold transition-all min-h-[400px] custom-scrollbar"
                      placeholder='{ "@context": "https://schema.org", "@type": "LocalBusiness", ... }'
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 p-5 rounded-2xl bg-blue-500/5 border border-blue-500/10 mt-6">
                  <ShieldCheck size={20} className="text-blue-500 shrink-0" />
                  <p className="text-[10px] text-blue-200/60 leading-relaxed uppercase tracking-widest">
                    Defining these site-wide schemas centrally ensures consistent rich result eligibility across Google and Bing for your primary brand identity and physical location.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Meta Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingItem(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl glass border border-gold/30 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div>
                  <h3 className="text-2xl font-display text-gold">SEO Meta Editor</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-bold mt-1">
                    Assign Indexing & Structured Data for: {editingItem.title}
                  </p>
                </div>
                <button
                  onClick={() => setEditingItem(null)}
                  className="p-3 hover:bg-white/5 rounded-2xl transition-colors text-white/40 hover:text-white"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-6 text-left">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">Meta Title</label>
                    <input
                      type="text"
                      value={editForm.metaTitle}
                      onChange={(e) => setEditForm({ ...editForm, metaTitle: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-all"
                      placeholder="e.g. Best Chauffeur Service in Melbourne"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">Focus Keywords (Comma Separated)</label>
                    <input
                      type="text"
                      value={editForm.keywords}
                      onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-all"
                      placeholder="chauffeur, melbourne, luxury travel"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1">Meta Description</label>
                  <textarea
                    value={editForm.metaDescription}
                    onChange={(e) => setEditForm({ ...editForm, metaDescription: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none transition-all min-h-[100px]"
                    placeholder="Provide a compelling summary for search results..."
                  />
                </div>

                {/* Live Real-time Interactive Google Search Preview inside the Meta Editor */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-6 space-y-4">
                  <div className="flex justify-between items-center border-b border-white/5 pb-3">
                    <h4 className="text-[10px] uppercase font-bold text-gold flex items-center gap-1.5">
                      <Search size={12} className="text-gold" />
                      Live Interactive Google Preview
                    </h4>
                    <div className="flex gap-1.5 bg-black/40 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setPreviewDevice(d => d === 'desktop' ? 'mobile' : 'desktop')}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[7px] text-white/80 font-black uppercase tracking-wider"
                      >
                        {previewDevice === 'desktop' ? 'Switch to Mobile' : 'Switch to Desktop'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTheme(t => t === 'dark' ? 'light' : 'dark')}
                        className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[7px] text-white/80 font-black uppercase tracking-wider"
                      >
                        {previewTheme === 'dark' ? 'Light Theme' : 'Dark Theme'}
                      </button>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "w-full transition-all duration-300 rounded-xl border text-left p-5 font-sans shadow-md mx-auto",
                      previewTheme === 'dark' ? "bg-[#202124] border-zinc-800" : "bg-white border-zinc-200",
                      previewDevice === 'mobile' ? "max-w-[340px]" : "max-w-full"
                    )}
                  >
                    {previewDevice === 'mobile' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold shadow-sm shrink-0",
                            previewTheme === 'dark' ? "bg-zinc-800 text-gold" : "bg-zinc-100 text-gold"
                          )}>
                            M
                          </div>
                          <div className="truncate min-w-0">
                            <p className={cn("text-[9px] truncate leading-tight mt-0.5", previewTheme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                              {window.location.origin}{getFullPath(editingItem)}
                            </p>
                          </div>
                        </div>
                        <h4 className={cn(
                          "text-[16px] font-normal leading-snug cursor-pointer hover:underline",
                          previewTheme === 'dark' ? "text-[#8ab4f8]" : "text-[#1a0dab]"
                        )}>
                          {editForm.metaTitle || editingItem.title || "Untitled Preview Page"}
                        </h4>
                        <p className={cn(
                          "text-[12px] leading-relaxed text-ellipsis overflow-hidden",
                          previewTheme === 'dark' ? "text-zinc-300" : "text-[#4d5156]"
                        )}>
                          {editForm.metaDescription || "Please provide a meta description on the editor fields above to preview search description results."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-[11px] flex items-center gap-1 font-normal opacity-90 truncate leading-tight">
                          <span className={previewTheme === 'dark' ? "text-zinc-300" : "text-[#202124]"}>
                            Merlux Chauffeur
                          </span>
                          <span className={previewTheme === 'dark' ? "text-zinc-500" : "text-zinc-400"}>
                            {window.location.origin}{getFullPath(editingItem)}
                          </span>
                        </div>
                        <h4 className={cn(
                          "text-[18px] font-normal leading-tight cursor-pointer hover:underline -mt-0.5",
                          previewTheme === 'dark' ? "text-[#8ab4f8]" : "text-[#1a0dab]"
                        )}>
                          {editForm.metaTitle || editingItem.title || "Untitled Preview Page"}
                        </h4>
                        <p className={cn(
                          "text-[13px] leading-relaxed max-w-[550px]",
                          previewTheme === 'dark' ? "text-zinc-300" : "text-[#4d5156]"
                        )}>
                          {editForm.metaDescription || "Please provide a meta description on the editor fields above to preview search description results."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 ml-1 flex items-center gap-2 shrink-0">
                      <Code size={14} className="text-gold" />
                      JSON-LD Structured Data
                    </label>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 px-1 custom-scrollbar w-full sm:max-w-[60%]">
                      <span className="text-[7px] text-white/20 uppercase font-bold mr-1 shrink-0">Templates:</span>
                      {(Object.keys(SCHEMA_TEMPLATES) as Array<keyof typeof SCHEMA_TEMPLATES>).map(key => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applySchemaTemplate(key)}
                          className="text-[7px] px-1.5 py-0.5 rounded bg-gold/5 text-gold/60 border border-gold/10 hover:bg-gold hover:text-black hover:border-gold transition-all font-bold uppercase shrink-0"
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={editForm.structuredData}
                    onChange={(e) => setEditForm({ ...editForm, structuredData: e.target.value })}
                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-4 text-xs font-mono text-blue-400 focus:border-blue-500 outline-none transition-all min-h-[180px] custom-scrollbar"
                    placeholder='{ "@context": "https://schema.org", ... }'
                  />
                </div>

                <div className="bg-white/5 p-6 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <h4 className="text-[11px] uppercase font-bold text-white">Search Engine Indexing</h4>
                    <p className="text-[9px] text-white/40 uppercase tracking-widest mt-1">Toggle noindex meta tag for this content</p>
                  </div>
                  <button
                    onClick={() => setEditForm({ ...editForm, noindex: !editForm.noindex })}
                    className={cn(
                      "flex items-center gap-3 px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                      editForm.noindex
                        ? "bg-red-500/10 text-red-500 border border-red-500/20"
                        : "bg-green-500/10 text-green-500 border border-green-500/20"
                    )}
                  >
                    {editForm.noindex ? <Ban size={16} /> : <Globe size={16} />}
                    {editForm.noindex ? 'NO-INDEX' : 'INDEXED'}
                  </button>
                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4">
                <button
                  onClick={() => setEditingItem(null)}
                  className="px-8 py-3 rounded-xl text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveMetadata}
                  disabled={isSaving}
                  className="btn-primary px-10 py-3 rounded-xl h-auto flex items-center justify-center"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  <span className="text-[10px] uppercase font-bold tracking-widest ml-2">Save Metadata</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Authentic Google Search Preview Overlay */}
      <AnimatePresence>
        {previewItem && (
          <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setPreviewItem(null)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full sm:max-w-2xl bg-[#09090b] border border-gold/30 
                 sm:rounded-[2.5rem] rounded-t-[2rem] shadow-2xl overflow-hidden 
                 flex flex-col z-[130] max-h-[92dvh] sm:max-h-[90dvh]"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02] shrink-0">
                {/* Drag handle — mobile only */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20 sm:hidden" />
                <div className="text-left">
                  <h3 className="text-base sm:text-xl font-display text-gold flex items-center gap-2">
                    <Search size={16} className="text-gold shrink-0" />
                    <span>Google SERP Live Preview</span>
                  </h3>
                  <p className="text-[9px] sm:text-[10px] text-white/40 uppercase tracking-[0.2em] mt-1 font-bold truncate max-w-[220px] sm:max-w-none">
                    Crawl Mockup for: {previewItem.title}
                  </p>
                </div>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-2 sm:p-3 hover:bg-white/5 rounded-2xl transition-colors text-white/40 hover:text-white shrink-0"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="p-4 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto overscroll-contain">
                {/* Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-black/40 p-3 sm:p-4 rounded-2xl border border-white/5">
                  {/* Device Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-black w-14 shrink-0">Device:</span>
                    <div className="flex gap-1 bg-zinc-850 p-1 rounded-xl border border-white/5 flex-1 sm:flex-none">
                      <button
                        onClick={() => setPreviewDevice('desktop')}
                        className={cn(
                          "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest font-black transition-all",
                          previewDevice === 'desktop' ? "bg-gold text-black shadow-sm" : "text-white/60 hover:text-white"
                        )}
                      >
                        Desktop
                      </button>
                      <button
                        onClick={() => setPreviewDevice('mobile')}
                        className={cn(
                          "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest font-black transition-all",
                          previewDevice === 'mobile' ? "bg-gold text-black shadow-sm" : "text-white/60 hover:text-white"
                        )}
                      >
                        Mobile
                      </button>
                    </div>
                  </div>

                  {/* Theme Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-black w-14 shrink-0">Theme:</span>
                    <div className="flex gap-1 bg-zinc-850 p-1 rounded-xl border border-white/5 flex-1 sm:flex-none">
                      <button
                        onClick={() => setPreviewTheme('light')}
                        className={cn(
                          "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest font-black transition-all",
                          previewTheme === 'light' ? "bg-gold text-black shadow-sm" : "text-white/60 hover:text-white"
                        )}
                      >
                        Light
                      </button>
                      <button
                        onClick={() => setPreviewTheme('dark')}
                        className={cn(
                          "flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[9px] uppercase tracking-widest font-black transition-all",
                          previewTheme === 'dark' ? "bg-gold text-black shadow-sm" : "text-white/60 hover:text-white"
                        )}
                      >
                        Dark
                      </button>
                    </div>
                  </div>
                </div>

                {/* Device Mockup Stage */}
                <div className="flex justify-center p-3 sm:p-4 bg-black/20 rounded-3xl border border-white/5 overflow-hidden">
                  <div
                    className={cn(
                      "w-full transition-all duration-300 rounded-2xl border text-left p-4 sm:p-6 font-sans shadow-lg",
                      previewTheme === 'dark' ? "bg-[#202124] border-zinc-800" : "bg-white border-zinc-200",
                      previewDevice === 'mobile' ? "max-w-[320px] sm:max-w-[375px]" : "max-w-full"
                    )}
                  >
                    {previewDevice === 'mobile' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm shrink-0",
                            previewTheme === 'dark' ? "bg-zinc-800 text-gold" : "bg-zinc-150 text-gold"
                          )}>
                            M
                          </div>
                          <div className="truncate min-w-0">
                            <p className={cn("text-[11px] sm:text-[12px] font-medium leading-none truncate", previewTheme === 'dark' ? "text-zinc-200" : "text-zinc-800")}>
                              Merlux Chauffeur
                            </p>
                            <p className={cn("text-[9px] sm:text-[10px] truncate leading-tight mt-0.5", previewTheme === 'dark' ? "text-zinc-400" : "text-zinc-500")}>
                              {window.location.origin}{getFullPath(previewItem)}
                            </p>
                          </div>
                        </div>
                        <h4 className={cn(
                          "text-[16px] sm:text-[18px] font-normal leading-snug cursor-pointer hover:underline",
                          previewTheme === 'dark' ? "text-[#8ab4f8]" : "text-[#1a0dab]"
                        )}>
                          {previewItem.metaTitle || previewItem.title || "Untitled Preview Page"}
                        </h4>
                        <p className={cn(
                          "text-[12px] sm:text-[13px] leading-relaxed",
                          previewTheme === 'dark' ? "text-zinc-300" : "text-[#4d5156]"
                        )}>
                          {previewItem.metaDescription || "Please provide a meta description to customize search results."}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="text-[11px] sm:text-[12px] flex items-center gap-1 font-normal opacity-90 truncate leading-tight">
                          <span className={previewTheme === 'dark' ? "text-zinc-300" : "text-[#202124]"}>
                            Merlux Chauffeur
                          </span>
                          <span className={cn("truncate", previewTheme === 'dark' ? "text-zinc-500" : "text-zinc-400")}>
                            {window.location.origin}{getFullPath(previewItem)}
                          </span>
                        </div>
                        <h4 className={cn(
                          "text-[17px] sm:text-[20px] font-normal leading-tight cursor-pointer hover:underline",
                          previewTheme === 'dark' ? "text-[#8ab4f8]" : "text-[#1a0dab]"
                        )}>
                          {previewItem.metaTitle || previewItem.title || "Untitled Preview Page"}
                        </h4>
                        <p className={cn(
                          "text-[13px] sm:text-[14px] leading-relaxed",
                          previewTheme === 'dark' ? "text-zinc-300" : "text-[#4d5156]"
                        )}>
                          {previewItem.metaDescription || "Please provide a meta description to customize search results."}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 sm:p-6 border-t border-white/5 bg-white/[0.02] flex justify-end shrink-0">
                <button
                  onClick={() => setPreviewItem(null)}
                  className="w-full sm:w-auto px-6 py-3 sm:py-2.5 bg-gold/10 border border-gold/20 text-gold rounded-xl hover:bg-gold hover:text-black transition-all text-[10px] font-bold uppercase tracking-widest"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Actions Sliding Bottom Sheet */}
      <AnimatePresence>
        {showBulkPanel && (
          <div className="fixed inset-0 z-[140] flex items-end justify-center">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowBulkPanel(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />

            {/* Slide up panel */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="relative w-full max-w-4xl bg-[#09090b] border-t border-gold/40 rounded-t-[2.5rem] shadow-2xl flex flex-col z-[150] h-[85vh] max-h-[800px]"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.01] shrink-0">
                <div className="text-left">
                  <h3 className="text-lg font-display text-gold flex items-center gap-2 mb-0">
                    <ListChecks size={20} className="text-gold" />
                    <span>SEO Bulk Meta Configurator</span>
                  </h3>
                  <p className="text-[9px] text-white/40 uppercase tracking-[0.2em] mt-1 font-bold">
                    Apply targeted batch changes onto {selectedIds.length} chosen content item{selectedIds.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button
                  onClick={() => setShowBulkPanel(false)}
                  className="p-3 hover:bg-white/5 rounded-2xl transition-colors text-white/40 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Main Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-8 space-y-6">

                {/* Visual indicator of targeted items */}
                <div className="bg-white/[0.01] border border-white/5 rounded-2xl p-4 text-left">
                  <p className="text-[10px] text-gold uppercase tracking-[0.15em] font-black mb-3">Currently Targeted ({selectedIds.length} items):</p>
                  <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto custom-scrollbar p-1.5 rounded-lg bg-black/30">
                    {selectedIds.length === 0 ? (
                      <span className="text-[10px] text-white/30 uppercase font-bold tracking-wider p-1">No items selected in the table list</span>
                    ) : (
                      selectedIds.map(key => {
                        const matchedItem = allContent.find(c => `${c.type}-${c.id}` === key);
                        if (!matchedItem) return null;
                        return (
                          <span key={key} className="text-[9px] px-2.5 py-1 rounded bg-white/5 border border-white/5 text-white/80 uppercase font-bold tracking-wider">
                            {matchedItem.title} <span className="opacity-40 font-mono text-[8px]">({matchedItem.type})</span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                  {/* Left Column Controls */}
                  <div className="space-y-5">

                    {/* Meta Title Bulk operation */}
                    <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <label className="text-[10px] uppercase tracking-widest font-black text-white/60 block mb-1">Batch Meta Title Rules</label>
                      <select
                        value={bulkForm.metaTitleAction}
                        onChange={(e) => setBulkForm({ ...bulkForm, metaTitleAction: e.target.value })}
                        className="custom-select w-full"
                      >
                        <option value="keep">Keep Existing Titles</option>
                        <option value="replace">Fully Replace Title</option>
                        <option value="prefix">Insert Prefix</option>
                        <option value="suffix">Append Suffix</option>
                        <option value="append_brand">Auto-Append Brand Name</option>
                      </select>
                      {bulkForm.metaTitleAction !== 'keep' && bulkForm.metaTitleAction !== 'append_brand' && (
                        <input
                          type="text"
                          value={bulkForm.metaTitleValue}
                          onChange={(e) => setBulkForm({ ...bulkForm, metaTitleValue: e.target.value })}
                          placeholder={bulkForm.metaTitleAction === 'replace' ? "New exact meta title..." : "Text prefix/suffix..."}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-sans mt-2 outline-none focus:border-gold transition-colors"
                        />
                      )}
                    </div>

                    {/* Meta Description bulk operation */}
                    <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <label className="text-[10px] uppercase tracking-widest font-black text-white/60 block mb-1">Batch Meta Description Rules</label>
                      <select
                        value={bulkForm.metaDescriptionAction}
                        onChange={(e) => setBulkForm({ ...bulkForm, metaDescriptionAction: e.target.value })}
                        className="custom-select w-full"
                      >
                        <option value="keep">Keep Existing Descriptions</option>
                        <option value="replace">Fully Replace Description</option>
                        <option value="append">Append Description Text</option>
                      </select>
                      {bulkForm.metaDescriptionAction !== 'keep' && (
                        <textarea
                          value={bulkForm.metaDescriptionValue}
                          onChange={(e) => setBulkForm({ ...bulkForm, metaDescriptionValue: e.target.value })}
                          placeholder={bulkForm.metaDescriptionAction === 'replace' ? "New full batch description..." : "Append suffix description string..."}
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder-white/30 font-sans mt-2 outline-none focus:border-gold transition-colors h-20 custom-scrollbar"
                        />
                      )}
                    </div>
                  </div>

                  {/* Right Column Controls */}
                  <div className="space-y-5">

                    {/* Keywords bulk operation */}
                    <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                      <label className="text-[10px] uppercase tracking-widest font-black text-white/60 block mb-1">Batch Keyword Tags</label>
                      <select
                        value={bulkForm.keywordsAction}
                        onChange={(e) => setBulkForm({ ...bulkForm, keywordsAction: e.target.value })}
                        className="custom-select w-full"
                      >
                        <option value="keep">Keep Existing Keywords</option>
                        <option value="replace">Overwrite with New Keywords</option>
                        <option value="append">Append New Keywords</option>
                      </select>
                      {bulkForm.keywordsAction !== 'keep' && (
                        <input
                          type="text"
                          value={bulkForm.keywordsValue}
                          onChange={(e) => setBulkForm({ ...bulkForm, keywordsValue: e.target.value })}
                          placeholder="VIP, Luxury, Chauffeured, Travel (comma-separated)..."
                          className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 font-sans mt-2 outline-none focus:border-gold transition-colors"
                        />
                      )}
                    </div>

                    {/* Crawler Visibility & Schema Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                      <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/60 block mb-1">Search Indexing</label>
                        <select
                          value={bulkForm.noindexAction}
                          onChange={(e) => setBulkForm({ ...bulkForm, noindexAction: e.target.value })}
                          className="custom-select w-full"
                        >
                          <option value="keep">Inherit Existing</option>
                          <option value="index">Force Index (Allow Google)</option>
                          <option value="noindex">Force No-Index (Disallow)</option>
                        </select>
                      </div>

                      <div className="space-y-2 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <label className="text-[10px] uppercase tracking-widest font-black text-white/60 block mb-1">JSON-LD Templates</label>
                        <select
                          value={bulkForm.schemaAction}
                          onChange={(e) => setBulkForm({ ...bulkForm, schemaAction: e.target.value })}
                          className="custom-select w-full"
                        >
                          <option value="keep">Inherit Existing</option>
                          <option value="clear">Wipe Schemas</option>
                          <option value="WebPage">Apply WebPage Schema</option>
                          <option value="Article">Apply Article Schema</option>
                          <option value="Service">Apply Service Schema</option>
                          <option value="Product">Apply Product Schema</option>
                          <option value="FAQ">Apply FAQ Schema</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-6 border-t border-white/5 bg-white/[0.02] flex justify-end gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowBulkPanel(false)}
                  className="px-6 py-3 rounded-xl text-[10px] uppercase font-bold tracking-widest text-white/40 hover:text-white transition-all"
                >
                  Close Settings
                </button>
                <button
                  type="button"
                  onClick={handleBulkExecute}
                  disabled={isSaving || selectedIds.length === 0}
                  className={cn(
                    "px-8 py-3 rounded-xl text-[10px] uppercase font-bold tracking-widest transition-all inline-flex items-center gap-2 border",
                    selectedIds.length > 0
                      ? "bg-gold text-black border-gold shadow-lg shadow-gold/25 hover:bg-[#cfa53b]"
                      : "bg-white/5 text-white/20 border-white/5 cursor-not-allowed"
                  )}
                >
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
                  <span>Execute Bulk Changes</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default IndexTab;
