import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Globe, Plus, Power, Eye, Code2, Copy, Edit2, Trash2, X, CheckCircle, Loader2, Save, Ban, Info,
  Check, CheckSquare, Square, Trash, Clock, Search, Calendar, Tag, ChevronDown, ShieldAlert,
  Monitor, Smartphone, Tablet, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { cn, getLocalDatetimeString } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc, query, onSnapshot, orderBy, writeBatch } from 'firebase/firestore';
import { getCachedDocs, clearFsCache } from '../../lib/firestore-cache';

interface DynamicPageTabProps {
  isAdmin: boolean;
  showDashboardNotice: (type: any, message: string, title?: string) => void;
  setConfirmDelete: (config: any) => void;
}

const DynamicPageTab: React.FC<DynamicPageTabProps> = ({
  isAdmin,
  showDashboardNotice,
  setConfirmDelete,
}) => {
  const [pages, setPages] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(12);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let active = true;
    const fetchPagesAndSettings = async () => {
      try {
        const q = query(collection(db, 'pages'));
        const fetchedPages = await getCachedDocs(q, 'dashboard_pages');
        if (active) {
          setPages(fetchedPages);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error loading dashboard pages:", error);
        handleFirestoreError(error, OperationType.GET, 'pages');
        if (active) {
          setLoading(false);
        }
      }

      try {
        // Since settings are cached as doc under settings/system in SettingsContext, let's get that cached doc
        const settingsRef = doc(db, 'settings', 'system');
        const snap = await doc(db, 'settings', 'system');
        // Let's do a fast fetch
        const cachedSetting = sessionStorage.getItem('fs_cache_doc_settings/system');
        if (cachedSetting) {
          const entry = JSON.parse(cachedSetting);
          setSystemSettings(entry.data);
        } else {
          const { getCachedDoc } = await import('../../lib/firestore-cache');
          const data = await getCachedDoc(settingsRef);
          if (active && data) {
            setSystemSettings(data);
          }
        }
      } catch (err) {
        console.warn("Unable to fetch settings for dashboard:", err);
      }
    };

    fetchPagesAndSettings();
    return () => {
      active = false;
    };
  }, [refreshTrigger]);
  useEffect(() => {
    if (!pages.length) return;
    
    const now = new Date();
    const needsUpdate = pages.filter(page => {
      // Skip core pages
      if (['home', 'fleet', 'services', 'about', 'contact', 'booking', 'offers', 'tours'].includes(page.slug)) return false;
      
      const publishAt = page.publishAt;
      if (!publishAt) return false;
      
      const publishDate = new Date(publishAt);
      const isFuture = publishDate > now;
      const isActive = page.active !== false;
      const isNoIndex = page.noindex === true;
      
      if (isFuture) {
        return isActive || !isNoIndex;
      } else {
        return !isActive || isNoIndex;
      }
    });

    if (needsUpdate.length > 0) {
      const batch = writeBatch(db);
      needsUpdate.forEach(page => {
        const isFuture = new Date(page.publishAt) > now;
        batch.update(doc(db, 'pages', page.id), {
          active: !isFuture,
          noindex: isFuture,
          updatedAt: serverTimestamp()
        });
      });
      batch.commit().catch(err => console.error("Auto-status update failed:", err));
    }
  }, [pages]);

  const [showHtmlPreviewModal, setShowHtmlPreviewModal] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [editingPage, setEditingPage] = useState<any>(null);
  const [showPageModal, setShowPageModal] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedContent, setLastSavedContent] = useState<string>('');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  // CSS State
  const [showCssModal, setShowCssModal] = useState(false);
  const [cssEditingLoading, setCssEditingLoading] = useState(false);
  const [cssConfig, setCssConfig] = useState<{
    type: 'global' | 'page' | 'blog';
    id?: string;
    content: string;
    isActive: boolean;
    title?: string;
    itemContent?: string;
    slug?: string;
    featuredImage?: string;
  }>({ type: 'global', content: '', isActive: true });

  const updateCacheAndTrigger = () => {
    clearFsCache();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSaveCss = async () => {
    setCssEditingLoading(true);
    try {
      if (cssConfig.type === 'global') {
        const settingsRef = doc(db, "settings", "system");
        await setDoc(settingsRef, {
          seo: {
            globalCmsCss: cssConfig.content,
            isGlobalCssActive: cssConfig.isActive
          }
        }, { merge: true });

        setSystemSettings({
          ...systemSettings,
          seo: {
            ...systemSettings?.seo,
            globalCmsCss: cssConfig.content,
            isGlobalCssActive: cssConfig.isActive
          }
        });
      } else if (cssConfig.type === 'page' && cssConfig.id) {
        const pageRef = doc(db, "pages", cssConfig.id);
        await updateDoc(pageRef, {
          customCss: cssConfig.content,
          isCustomCssActive: cssConfig.isActive,
          updatedAt: serverTimestamp()
        });
        setPages(pages.map(p => p.id === cssConfig.id ? { ...p, customCss: cssConfig.content, isCustomCssActive: cssConfig.isActive } : p));
      }
      updateCacheAndTrigger();
      setShowCssModal(false);
      showDashboardNotice('success', 'CSS updated successfully');
    } catch (err) {
      console.error("Error saving CSS:", err);
      handleFirestoreError(err, OperationType.UPDATE, `save-css-${cssConfig.type}`);
    } finally {
      setCssEditingLoading(false);
    }
  };

  const handleUpdatePage = async (id: string | null, data: any, isAutoSave = false) => {
    if (isAutoSave) setAutoSaveStatus('saving');
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;
      
      const publishAtValue = rest.publishAt || (data.createdAt ? getLocalDatetimeString(data.createdAt) : getLocalDatetimeString());
      const isFuture = new Date(publishAtValue) > new Date();

      const processedData = {
        ...rest,
        active: !isFuture,
        noindex: isFuture,
        publishAt: publishAtValue
      };

      if (id && id !== 'new') {
        await updateDoc(doc(db, 'pages', id), {
          ...processedData,
          updatedAt: serverTimestamp()
        });
        updateCacheAndTrigger();
        if (!isAutoSave) showDashboardNotice('success', 'Page updated');
      } else {
        // For new posts, we only auto-save if they have a title at least
        if (isAutoSave && !data.title) {
          setAutoSaveStatus('idle');
          return;
        }

        const newDocRef = await addDoc(collection(db, 'pages'), {
          ...processedData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        // Update editingPage with the new ID so subsequent auto-saves use updateDoc
        setEditingPage((prev: any) => ({ ...prev, id: newDocRef.id }));
        updateCacheAndTrigger();

        if (!isAutoSave) showDashboardNotice('success', 'Page created');
      }

      if (!isAutoSave) {
        setShowPageModal(false);
        setEditingPage(null);
      } else {
        setAutoSaveStatus('saved');
        setLastSavedTime(new Date());
        setTimeout(() => setAutoSaveStatus('idle'), 3000);
      }
    } catch (err) {
      console.error('Error updating page:', err);
      if (isAutoSave) {
        setAutoSaveStatus('error');
      } else {
        handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'pages');
      }
    }
  };

  // Auto-save logic
  useEffect(() => {
    if (!showPageModal || !editingPage) return;

    // Don't auto-save if content hasn't changed or it's a fresh load
    const currentContent = JSON.stringify(editingPage);
    if (currentContent === lastSavedContent) return;

    const timer = setTimeout(() => {
      handleUpdatePage(editingPage.id || 'new', editingPage, true);
      setLastSavedContent(currentContent);
    }, 5000); // Debounce for 5 seconds

    return () => clearTimeout(timer);
  }, [editingPage, showPageModal, lastSavedContent]);

  useEffect(() => {
    if (showPageModal && editingPage) {
      setLastSavedContent(JSON.stringify(editingPage));
    }
  }, [showPageModal]);

  const handleDeletePage = (id: string) => {
    const page = pages.find(p => p.id === id);
    setConfirmDelete({
      title: 'Delete Page?',
      message: `Are you sure you want to delete "${page?.title || 'this page'}"?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'pages', id));
          updateCacheAndTrigger();
          showDashboardNotice('success', 'Page deleted');
        } catch (err) {
          console.error('Error deleting page:', err);
          handleFirestoreError(err, OperationType.DELETE, `pages/${id}`);
        }
      }
    });
  };

  const handleTogglePageActive = async (page: any) => {
    try {
      await updateDoc(doc(db, 'pages', page.id), {
        active: !page.active,
        updatedAt: serverTimestamp()
      });
      updateCacheAndTrigger();
    } catch (err) {
      console.error('Error toggling page status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `pages/${page.id}`);
    }
  };

  const handleDuplicatePage = async (page: any) => {
    try {
      const { id, createdAt, updatedAt, ...rest } = page;
      await addDoc(collection(db, 'pages'), {
        ...rest,
        title: `${rest.title} (Copy)`,
        slug: `${rest.slug}-copy`,
        active: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      updateCacheAndTrigger();
    } catch (err) {
      console.error('Error duplicating page:', err);
      handleFirestoreError(err, OperationType.CREATE, 'pages');
    }
  };
  const customPages = (pages || []).filter(p => p && !['home', 'fleet', 'services', 'about', 'contact', 'booking', 'offers', 'tours'].includes(p.slug));

  const uniqueCategories = Array.from(new Set(customPages.map(p => p.category).filter(Boolean)));
  const allPageCategories = ["All", ...Array.from(new Set(['Services', 'Suburbs', 'Airport', ...uniqueCategories]))];

  const filteredPages = useMemo(() => {
    let result = customPages.filter(page => {
      // Category match
      const categoryMatches = categoryFilter === "All" || page.category === categoryFilter;

      // Status match
      let statusMatches = true;
      if (statusFilter !== "All") {
        const isActive = page.active !== false;
        const publishDate = page.publishAt ? new Date(page.publishAt) : null;
        const isFuture = publishDate && publishDate > new Date();

        if (statusFilter === "Active") {
          statusMatches = isActive && (!isFuture);
        } else if (statusFilter === "Scheduled") {
          statusMatches = isActive && isFuture;
        } else if (statusFilter === "Inactive") {
          statusMatches = !isActive;
        }
      }

      // Search match
      const searchMatches = searchQuery === "" || 
        page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (page.excerpt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        page.slug.toLowerCase().includes(searchQuery.toLowerCase());

      return categoryMatches && statusMatches && searchMatches;
    });

    // Sort by date
    return result.sort((a, b) => {
      const dateA = new Date(a.publishAt || (a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt) || 0).getTime();
      const dateB = new Date(b.publishAt || (b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt) || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [pages, categoryFilter, statusFilter, searchQuery, sortOrder]);

  // Reset page when filters or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [categoryFilter, statusFilter, searchQuery, sortOrder, pageSize]);

  // Paginated Pages
  const paginatedPages = useMemo(() => {
    if (pageSize === 'All') return filteredPages;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredPages.slice(startIndex, startIndex + pageSize);
  }, [filteredPages, currentPage, pageSize]);

  const totalPages = useMemo(() => {
    if (pageSize === 'All') return 1;
    return Math.ceil(filteredPages.length / pageSize) || 1;
  }, [filteredPages, pageSize]);

  // Bulk Selection and Edit States
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [bulkScheduleOpen, setBulkScheduleOpen] = useState(false);
  const [bulkScheduleDate, setBulkScheduleDate] = useState(getLocalDatetimeString());

  const allCurrentSelected = useMemo(() => {
    if (paginatedPages.length === 0) return false;
    return paginatedPages.every(p => selectedPages.includes(p.id));
  }, [paginatedPages, selectedPages]);

  const handleToggleSelectPage = (id: string | undefined) => {
    if (!id) return;
    setSelectedPages(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllPages = () => {
    const currentIds = paginatedPages.map(p => p.id).filter(Boolean);
    if (allCurrentSelected) {
      setSelectedPages(prev => prev.filter(id => !currentIds.includes(id)));
    } else {
      setSelectedPages(prev => {
        const unique = new Set([...prev, ...currentIds]);
        return Array.from(unique);
      });
    }
  };

  const executeBulkDeletePages = async (ids: string[]) => {
    setConfirmDelete({
      title: 'Delete Selected Pages?',
      message: `Are you sure you want to permanently delete ${ids.length} selected pages? This action is irreversible.`,
      onConfirm: async () => {
        try {
          const batch = writeBatch(db);
          ids.forEach(id => {
            batch.delete(doc(db, 'pages', id));
          });
          await batch.commit();
          setSelectedPages([]);
          updateCacheAndTrigger();
          showDashboardNotice('success', `Successfully deleted ${ids.length} pages.`, 'Bulk Success');
        } catch (err: any) {
          console.error("Bulk delete pages failed:", err);
          handleFirestoreError(err, OperationType.DELETE, 'pages-bulk');
        }
      }
    });
  };

  const executeBulkUpdatePagesStatus = async (ids: string[], active: boolean) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.update(doc(db, 'pages', id), { active, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedPages([]);
      updateCacheAndTrigger();
      showDashboardNotice('success', `Updated active status of ${ids.length} pages to ${active ? 'Active' : 'Inactive'}.`, 'Bulk Success');
    } catch (err: any) {
      console.error("Bulk status update failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'pages-bulk');
    }
  };

  const executeBulkUpdatePageInSitemap = async (ids: string[], includeInSitemap: boolean) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.update(doc(db, 'pages', id), { includeInSitemap, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedPages([]);
      updateCacheAndTrigger();
      showDashboardNotice('success', `Updated sitemap inclusion of ${ids.length} pages to ${includeInSitemap ? 'Included' : 'Sitemaped'}.`, 'Bulk Success');
    } catch (err: any) {
      console.error("Bulk sitemap update failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'pages-bulk');
    }
  };

  const executeBulkUpdatePagesIndex = async (ids: string[], noindex: boolean) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.update(doc(db, 'pages', id), { noindex, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedPages([]);
      updateCacheAndTrigger();
      showDashboardNotice('success', `Updated search indexing of ${ids.length} pages to ${noindex ? 'No Index' : 'Index'}.`, 'Bulk Success');
    } catch (err: any) {
      console.error("Bulk indexing update failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'pages-bulk');
    }
  };

  const executeBulkUpdatePagesCategory = async (ids: string[], category: string) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.update(doc(db, 'pages', id), { category, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedPages([]);
      setBulkCategoryOpen(false);
      updateCacheAndTrigger();
      showDashboardNotice('success', `Updated category of ${ids.length} pages to "${category}".`, 'Bulk Success');
    } catch (err: any) {
      console.error("Bulk category update failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'pages-bulk');
    }
  };

  const executeBulkUpdatePagesPublishAt = async (ids: string[], publishAt: string) => {
    try {
      const batch = writeBatch(db);
      ids.forEach(id => {
        batch.update(doc(db, 'pages', id), { publishAt, updatedAt: serverTimestamp() });
      });
      await batch.commit();
      setSelectedPages([]);
      setBulkScheduleOpen(false);
      updateCacheAndTrigger();
      showDashboardNotice('success', `Scheduled publication of ${ids.length} pages.`, 'Bulk Success');
    } catch (err: any) {
      console.error("Bulk scheduling update failed:", err);
      handleFirestoreError(err, OperationType.UPDATE, 'pages-bulk');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="text-left">
          <h3 className="text-xl sm:text-2xl font-display text-gold">Dynamic Pages</h3>
          <p className="text-white/40 text-[10px] uppercase tracking-widest">
            Manage custom landing pages
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {paginatedPages.length > 0 && (
            <button
              onClick={handleSelectAllPages}
              className={cn(
                "border px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all text-xs font-bold uppercase tracking-widest leading-none w-full sm:w-auto whitespace-nowrap",
                allCurrentSelected
                  ? "bg-gold border-gold text-black hover:bg-gold/80"
                  : "bg-white/5 border-white/10 text-white/60 hover:text-gold hover:border-gold"
              )}
            >
              <CheckSquare size={14} className="shrink-0" />
              <span>
                {allCurrentSelected ? 'Deselect Page' : `Select Page (${paginatedPages.length})`}
              </span>
            </button>
          )}

          <button
            onClick={() => {
              setCssConfig({
                type: 'global',
                content: systemSettings?.seo?.globalCmsCss || '',
                isActive: systemSettings?.seo?.isGlobalCssActive !== false,
                title: 'Global CMS CSS'
              });
              setShowCssModal(true);
            }}
            className="bg-white/5 border border-white/10 text-white/60 hover:text-gold hover:border-gold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all w-full sm:w-auto whitespace-nowrap text-xs font-bold uppercase tracking-widest leading-none"
          >
            <Globe size={14} className="shrink-0" />
            <span>Global CSS</span>
          </button>

          <button
            onClick={() => {
              setEditingPage({
                title: '',
                slug: '',
                category: 'Services',
                excerpt: '',
                content: '',
                featuredImage: '',
                featuredImageAlt: '',
                metaTitle: '',
                metaDescription: '',
                keywords: '',
                includeInSitemap: true,
                noindex: false,
                active: true,
                publishAt: getLocalDatetimeString()
              });
              setShowPageModal(true);
            }}
            className="btn-primary px-4 py-2 flex items-center justify-center gap-2 w-full sm:w-auto overflow-hidden whitespace-nowrap"
          >
            <Plus size={14} className="shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest leading-none">Add Page</span>
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4 bg-white/[0.02] border border-white/5 rounded-2xl p-4 xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-4 items-stretch sm:items-center flex-1">
          <div className="flex flex-col gap-1 w-full sm:w-64 lg:w-72">
            <span className="text-[9px] uppercase tracking-widest font-bold text-white/40 leading-none mb-1">Search Pages</span>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                placeholder="Search title, slug or excerpt..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white outline-none focus:border-gold transition-all h-10"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[160px] lg:max-w-[200px]">
            <span className="text-[9px] uppercase tracking-widest font-bold text-white/40 leading-none mb-1">Filter Type/Category</span>
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="custom-select w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gold outline-none focus:border-gold transition-all cursor-pointer h-10"
              >
                {allPageCategories.map(cat => {
                  const count = cat === "All" ? customPages.length : customPages.filter(p => p.category === cat).length;
                  return (
                    <option key={cat} value={cat} className="bg-[#111111] text-white py-1">
                      {cat} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full sm:flex-1 sm:min-w-[160px] lg:max-w-[200px]">
            <span className="text-[9px] uppercase tracking-widest font-bold text-white/40 leading-none mb-1">Filter Status</span>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="custom-select w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-gold outline-none focus:border-gold transition-all cursor-pointer h-10"
              >
                <option value="All" className="bg-[#111111] text-white py-1">All Statuses ({customPages.length})</option>
                <option value="Active" className="bg-[#111111] text-white py-1">
                  Active ({customPages.filter(p => p.active !== false && (!p.publishAt || new Date(p.publishAt) <= new Date())).length})
                </option>
                <option value="Inactive" className="bg-[#111111] text-white py-1">
                  Inactive ({customPages.filter(p => p.active === false).length})
                </option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1 w-full sm:w-auto">
            <span className="text-[9px] uppercase tracking-widest font-bold text-white/40 leading-none mb-1">Sort Date</span>
            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className={cn(
                "h-10 px-4 bg-black/40 border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-all hover:border-gold group",
                sortOrder === 'asc' ? "text-gold" : "text-white/60"
              )}
              title={sortOrder === 'desc' ? "Sorted Newest First" : "Sorted Oldest First"}
            >
              <Calendar size={14} className={cn("transition-transform", sortOrder === 'asc' && "rotate-180")} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between xl:justify-end gap-4 border-t border-white/5 pt-4 xl:border-0 xl:pt-0">
          <div className="text-[10px] uppercase tracking-wider font-bold text-white/40">
            Showing <span className="text-gold">{filteredPages.length}</span> of <span className="text-white">{customPages.length}</span>
          </div>
          {(categoryFilter !== "All" || statusFilter !== "All" || searchQuery !== "" || sortOrder !== 'desc') && (
            <button
              onClick={() => {
                setCategoryFilter("All");
                setStatusFilter("All");
                setSearchQuery("");
                setSortOrder('desc');
              }}
              className="text-red-400 hover:text-red-300 transition-colors uppercase font-bold tracking-widest text-[9px] border border-red-500/10 px-2.5 py-1 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(paginatedPages || []).length > 0 ? (
          (paginatedPages || []).map((page, idx) => (
            <div
              key={page.id || `page-${idx}`}
              className={cn(
                "glass rounded-2xl overflow-hidden border transition-all flex flex-col relative group",
                selectedPages.includes(page.id)
                  ? "border-gold bg-gold/[0.03] shadow-[0_0_15px_rgba(212,175,55,0.1)]"
                  : "border-white/5 hover:border-gold/30"
              )}
            >
              {(page.publishAt && new Date(page.publishAt) > new Date()) ? (
                <div className="absolute top-0 right-0 bg-amber-600 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                  Scheduled
                </div>
              ) : page.active !== false ? (
                <div className="absolute top-0 right-0 bg-green-600 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                  Active
                </div>
              ) : (
                <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl z-10">
                  Inactive
                </div>
              )}
              <div className="h-40 relative overflow-hidden">
                <img 
                  src={page.featuredImage || 'https://picsum.photos/seed/page/800/400'} 
                  alt={page.featuredImageAlt || page.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4">
                  <h4 className="text-lg font-display text-white line-clamp-1 leading-tight mb-2">{page.title}</h4>
                  <div className="flex flex-wrap items-center gap-y-1 gap-x-3">
                    {page.category && (
                      <span className="text-[8px] bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded uppercase font-black tracking-widest leading-none whitespace-nowrap">
                        {page.category}
                      </span>
                    )}
                    <span className="w-1 h-1 bg-white/20 rounded-full hidden sm:block"></span>
                    <div className="flex items-center gap-1 shrink-0">
                      <Clock size={10} className="text-white/40" />
                      <p className="text-[9px] text-white/40 uppercase font-bold tracking-widest">
                        {page.publishAt ? new Date(page.publishAt).toLocaleDateString() : (page.createdAt?.toDate ? page.createdAt.toDate().toLocaleDateString() : 'Draft')}
                      </p>
                    </div>
                  </div>
                  {page.publishAt && new Date(page.publishAt) > new Date() && (
                    <div className="flex items-center gap-1.5 mt-2 text-[8px] font-bold text-amber-400 uppercase tracking-widest">
                      <Clock size={10} className="shrink-0" />
                      <span>Scheduled: {new Date(page.publishAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-4 flex-1 flex flex-col bg-white/[0.02] border-t border-white/5">
                {page.excerpt && (
                  <p className="text-[11px] text-white/50 line-clamp-2 italic leading-relaxed">
                    {page.excerpt}
                  </p>
                )}

                <div className="flex-1" />

                <div className="flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleSelectPage(page.id);
                    }}
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all border",
                      selectedPages.includes(page.id)
                        ? "bg-gold border-gold text-black"
                        : "bg-white/5 border-white/10 text-white/20 hover:border-gold/50 hover:text-gold"
                    )}
                    title={selectedPages.includes(page.id) ? "Deselect Page" : "Select Page"}
                  >
                    {selectedPages.includes(page.id) ? (
                      <CheckSquare size={14} />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                  <div className="flex gap-1.5 justify-end">
                    <button
                      onClick={() => handleTogglePageActive(page)}
                      className={cn(
                        "p-2 rounded-xl transition-all border",
                        page.active === false 
                          ? "bg-white/5 text-red-500 hover:bg-red-500 hover:text-white border-white/5" 
                          : (page.publishAt && new Date(page.publishAt) > new Date() 
                              ? "bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white border-amber-500/20" 
                              : "bg-white/5 text-green-400 hover:bg-green-500 hover:text-white border-white/5")
                      )}
                      title={page.active !== false ? (page.publishAt && new Date(page.publishAt) > new Date() ? "Scheduled (Hidden from public)" : "Set as Inactive") : "Set as Active"}
                    >
                      <Power size={14} />
                    </button>
                    <button
                      onClick={() => window.open(`/${page.slug}`, '_blank')}
                      className="p-2 bg-white/5 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-white/5"
                      title="View Page"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setCssConfig({
                          type: 'page',
                          id: page.id,
                          content: page.customCss || '',
                          isActive: page.isCustomCssActive !== false,
                          title: `CSS: ${page.title}`,
                          itemContent: page.content,
                          slug: page.slug,
                          featuredImage: page.featuredImage
                        });
                        setShowCssModal(true);
                      }}
                      className="p-2 bg-white/5 text-purple-400 rounded-xl hover:bg-purple-500 hover:text-white transition-all border border-white/5"
                      title="Custom CSS"
                    >
                      <Code2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDuplicatePage(page)}
                      className="p-2 bg-white/5 text-white/60 rounded-xl hover:bg-white hover:text-black transition-all border border-white/5"
                      title="Duplicate Page"
                    >
                      <Copy size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const pageWithKeywordString = {
                          ...page,
                          keywords: Array.isArray(page.keywords) ? page.keywords.join(', ') : (page.keywords || '')
                        };
                        setEditingPage(pageWithKeywordString);
                        setShowPageModal(true);
                      }}
                      className="p-2 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-black transition-all border border-gold/10"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeletePage(page.id)}
                      className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/10"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-20 glass rounded-3xl border border-dashed border-white/10">
            <Globe size={48} className="text-white/10 mx-auto mb-4" />
            <h4 className="text-lg font-display text-white/40 italic">No dynamic pages created yet</h4>
            <p className="text-xs text-white/20 mt-1 uppercase tracking-widest font-bold">Launch your first page with the 'Add Page' button</p>
          </div>
        )}
      </div>

      {filteredPages.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-black/40 p-5 rounded-2xl border border-white/5 mt-8 mb-6">
          {/* Status info */}
          <div className="text-[11px] font-mono text-white/50">
            Showing <span className="text-gold font-bold">
              {filteredPages.length === 0 ? 0 : (pageSize === 'All' ? 1 : (currentPage - 1) * pageSize + 1)}
            </span> to <span className="text-gold font-bold">
              {pageSize === 'All' ? filteredPages.length : Math.min(currentPage * pageSize, filteredPages.length)}
            </span> of <span className="text-white font-bold">{filteredPages.length}</span> entries
          </div>

          {/* Pagination buttons */}
          {pageSize !== 'All' && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                title="First Page"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
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
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                title="Next Page"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
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
              className="custom-select bg-black text-gold text-[10px] font-mono border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none focus:border-gold font-bold uppercase cursor-pointer"
            >
              <option value={12}>12 Pages</option>
              <option value={24}>24 Pages</option>
              <option value={48}>48 Pages</option>
              <option value="All">Show All</option>
            </select>
          </div>
        </div>
      )}

      {/* Floating Bulk Management Bar */}
      <AnimatePresence>
        {selectedPages.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-3xl px-4"
          >
            <div className="glass border border-gold/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 w-full md:w-auto">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/20 shrink-0">
                  <span className="text-gold font-display font-bold">{selectedPages.length}</span>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-gold leading-none mb-1">Bulk Page Management</h4>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Manage {selectedPages.length} selected pages</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-end gap-2 w-full md:w-auto">
                <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-0.5">
                  <button
                    onClick={() => executeBulkUpdatePagesStatus(selectedPages, true)}
                    className="p-2 text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                    title="Set as Active"
                  >
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => executeBulkUpdatePagesStatus(selectedPages, false)}
                    className="p-2 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                    title="Set as Inactive"
                  >
                    <Ban size={14} />
                  </button>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setBulkCategoryOpen(!bulkCategoryOpen)}
                    className="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500 hover:text-white transition-all flex items-center gap-1 h-8.5"
                    title="Change Category"
                  >
                    <Tag size={13} />
                    <span className="text-[9px] font-bold uppercase tracking-widest ml-1 hidden sm:inline">Category</span>
                    <ChevronDown size={10} />
                  </button>

                  <AnimatePresence>
                    {bulkCategoryOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setBulkCategoryOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute bottom-full right-0 mb-3 w-48 bg-black/95 p-2 rounded-2xl border border-gold/30 shadow-2xl z-20 flex flex-col gap-1 max-h-[250px] overflow-y-auto custom-scrollbar backdrop-blur-xl"
                        >
                          <div className="text-[8px] uppercase tracking-[0.15em] text-gold px-2 py-1 font-bold border-b border-white/5 mb-1">Set Category</div>
                          {['Services', 'Suburbs', 'Airport', ...uniqueCategories].map((cat, idx) => (
                            <button
                              key={`bulk-page-cat-${cat}-${idx}`}
                              onClick={() => executeBulkUpdatePagesCategory(selectedPages, cat)}
                              className="text-left px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-white/70 hover:bg-gold/10 hover:text-gold rounded-xl transition-all"
                            >
                              {cat}
                            </button>
                          ))}
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setBulkScheduleOpen(!bulkScheduleOpen)}
                    className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1 h-8.5"
                    title="Schedule Publication"
                  >
                    <Calendar size={13} />
                    <span className="text-[9px] font-bold uppercase tracking-widest ml-1 hidden sm:inline">Schedule</span>
                    <ChevronDown size={10} />
                  </button>

                  <AnimatePresence>
                    {bulkScheduleOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setBulkScheduleOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute bottom-full right-0 mb-3 w-64 bg-black/95 p-4 rounded-2xl border border-gold/30 shadow-2xl z-20 flex flex-col gap-3 backdrop-blur-xl text-left"
                        >
                          <div className="text-[8px] uppercase tracking-[0.15em] text-gold font-bold border-b border-white/5 pb-1">Set Publish Date/Time</div>
                          
                          <div className="space-y-1">
                            <label className="text-[9px] uppercase tracking-wider text-white/40 block">Publication Date & Time</label>
                            <input 
                              type="datetime-local" 
                              className="w-full text-[11px] bg-white/5 border border-white/10 rounded-xl p-2 font-mono text-white focus:outline-none focus:border-gold"
                              value={bulkScheduleDate}
                              onChange={(e) => setBulkScheduleDate(e.target.value)}
                            />
                          </div>

                          <button
                            onClick={() => executeBulkUpdatePagesPublishAt(selectedPages, bulkScheduleDate)}
                            className="w-full py-2 bg-gold text-black hover:bg-black hover:text-gold border border-gold rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer text-center"
                          >
                            Apply Schedule
                          </button>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  onClick={() => executeBulkDeletePages(selectedPages)}
                  className="p-2 bg-red-600 hover:bg-red-700 text-white border border-red-500/30 rounded-xl transition-all flex items-center gap-1 shadow-lg shadow-red-500/10"
                  title="Bulk Delete"
                >
                  <Trash2 size={14} />
                </button>

                <button
                  onClick={() => setSelectedPages([])}
                  className="p-2 bg-white/5 text-white/55 border border-white/10 hover:border-white/30 rounded-xl transition-all text-xs font-bold uppercase tracking-widest"
                  title="Clear Selection"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                  <h3 className="text-xl font-display text-gold">
                    {editingPage?.id ? 'Edit Page' : 'Add Dynamic Page'}
                  </h3>
                </div>
                <button onClick={() => setShowPageModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6 pb-16 relative">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Page Title</label>
                    <input
                      type="text"
                      value={editingPage?.title || ''}
                      onChange={(e) => {
                        const title = e.target.value;
                        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        setEditingPage({ ...editingPage, title, slug: editingPage.id ? editingPage.slug : slug });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Airport Transfers Melbourne"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Category</label>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <select
                          value={['Services', 'Suburbs', 'Airport'].includes(editingPage?.category) ? editingPage.category : 'Manual add'}
                          onChange={(e) => {
                            if (e.target.value !== 'Manual add') {
                              setEditingPage({ ...editingPage, category: e.target.value });
                            } else {
                              if (['Services', 'Suburbs', 'Airport'].includes(editingPage?.category)) {
                                setEditingPage({ ...editingPage, category: '' });
                              }
                            }
                          }}
                          className="custom-select w-full"
                        >
                          <option value="Services">Services</option>
                          <option value="Suburbs">Suburbs</option>
                          <option value="Airport">Airport</option>
                          <option value="Manual add">Manual add (Custom)</option>
                        </select>
                      </div>
                      {(!['Services', 'Suburbs', 'Airport'].includes(editingPage?.category)) && (
                        <div className="flex-1">
                          <input
                            type="text"
                            value={editingPage?.category || ''}
                            onChange={(e) => setEditingPage({ ...editingPage, category: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="Custom Category name..."
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">URL Slug</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm">/</span>
                      <input
                        type="text"
                        value={editingPage?.slug || ''}
                        onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder="airport-transfers-melbourne"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Excerpt / Summary</label>
                    <input
                      type="text"
                      value={editingPage?.excerpt || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, excerpt: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Short summary for listings..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Featured Image URL</label>
                    <input
                      type="text"
                      value={editingPage?.featuredImage || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, featuredImage: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Image Alt Text</label>
                    <input
                      type="text"
                      value={editingPage?.featuredImageAlt || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, featuredImageAlt: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Luxury car at Melbourne airport"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">Page Content (HTML)</label>
                    <button 
                      onClick={() => setShowHtmlPreviewModal(true)}
                      className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-gold hover:text-white transition-colors"
                    >
                      <Eye size={12} />
                      Preview Content
                    </button>
                  </div>
                  <textarea
                    value={editingPage?.content || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-48 font-mono"
                    placeholder="<section>...</section>"
                  />
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                    <Info size={16} className="text-gold" />
                    <h4 className="text-xs font-black text-gold uppercase tracking-[0.2em]">Centralized SEO Settings</h4>
                  </div>

                  <div className="bg-gold/5 border border-gold/15 rounded-xl p-4.5 space-y-2 text-left mb-4">
                    <p className="text-[10px] text-gold font-bold uppercase tracking-wider">
                      Managed Globally via Index Console
                    </p>
                    <p className="text-[10px] text-white/50 leading-relaxed font-sans">
                      To prevent SEO conflict and data drift, all Meta titles, descriptions, focus keywords, indexing permissions (noindex), and JSON-LD Rich Schema Markups are centrally maintained under the **SEO → Index Console** tab of your primary dashboard.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 pt-1 mb-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Scheduled Publication Date & Time (Optional)</label>
                      <input
                        type="datetime-local"
                        value={editingPage?.publishAt || ''}
                        onChange={(e) => setEditingPage({ ...editingPage, publishAt: e.target.value })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold text-white/90 transition-all font-sans"
                      />
                      <p className="text-[9px] text-white/30 tracking-wide mt-1 uppercase font-semibold">
                        Leave blank to publish immediately once Status is Active. If set, page is auto-hidden on website until target date/time.
                      </p>
                    </div>
                  </div>

                  {false && (<>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Meta Title</label>
                    <input
                      type="text"
                      value={editingPage?.metaTitle || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, metaTitle: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Best Chauffeur Service in Melbourne | Merlux"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Meta Description</label>
                    <textarea
                      value={editingPage?.metaDescription || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, metaDescription: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24"
                      placeholder="Book luxury chauffeur services in Melbourne..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Keywords (comma separated)</label>
                    <input
                      type="text"
                      value={editingPage?.keywords || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, keywords: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="chauffeur, melbourne, airport transfer"
                    />
                  </div>

                  </>)}

                  <div className="flex flex-wrap gap-6 pt-1">
                    {false && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingPage?.noindex ? "bg-red-500 border-red-500" : "border-white/20 group-hover:border-gold")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingPage?.noindex || false}
                          onChange={(e) => setEditingPage({ ...editingPage, noindex: e.target.checked })}
                        />
                        {editingPage?.noindex && <CheckCircle size={14} className="text-white" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">No Index</span>
                    </label>
                    )}

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingPage?.includeInSitemap ? "bg-gold border-gold" : "border-white/20 group-hover:border-gold")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingPage?.includeInSitemap || false}
                          onChange={(e) => setEditingPage({ ...editingPage, includeInSitemap: e.target.checked })}
                        />
                        {editingPage?.includeInSitemap && <CheckCircle size={14} className="text-black" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">Include in Sitemap</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingPage?.active !== false ? "bg-green-600 border-green-600" : "bg-red-500/20 border-red-500/50 group-hover:border-red-500")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingPage?.active !== false}
                          onChange={(e) => setEditingPage({ ...editingPage, active: e.target.checked })}
                        />
                        {editingPage?.active !== false && <CheckCircle size={14} className="text-white" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">Published / Active</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowPageModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdatePage(editingPage.id || 'new', editingPage)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all shadow-lg shadow-gold/10"
                  >
                    {editingPage?.id ? 'Save Changes' : 'Create Page'}
                  </button>
                </div>
              </div>

              {/* Fixed Auto-save Indicator at the bottom */}
              <div className="absolute bottom-5 left-8 right-8 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-3">
                  <AnimatePresence mode="wait">
                    {autoSaveStatus !== 'idle' && (
                      <motion.div
                        key={autoSaveStatus}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md shadow-xl border",
                          autoSaveStatus === 'saving' ? "bg-gold/10 text-gold border-gold/20 animate-pulse" : 
                          autoSaveStatus === 'saved' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : 
                          "bg-red-500/10 text-red-500 border-red-500/20"
                        )}
                      >
                        {autoSaveStatus === 'saving' && <Loader2 size={10} className="animate-spin" />}
                        {autoSaveStatus === 'saved' && <Check size={10} />}
                        {autoSaveStatus === 'error' && <ShieldAlert size={10} />}
                        <span>{autoSaveStatus === 'saving' ? 'Saving Progress...' : autoSaveStatus === 'saved' ? 'Changes Protected' : 'Sync Error'}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  
                  {lastSavedTime && autoSaveStatus === 'idle' && (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[9px] uppercase tracking-[0.2em] font-black text-white/20"
                    >
                      Last Saved At {lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </motion.span>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Page HTML Preview Modal */}
        {showHtmlPreviewModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[110] flex items-center justify-center p-4 sm:p-10"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-5xl h-full glass border border-gold/20 rounded-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-display text-gold">Live HTML Content Preview</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold mt-1">
                    Visualizing with Global CMS CSS and custom content styling
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setPreviewDevice('desktop')}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-2",
                      previewDevice === 'desktop' ? "bg-gold text-black shadow-lg" : "text-white/40 hover:text-white"
                    )}
                    title="Desktop View"
                  >
                    <Monitor size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Desktop</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice('tablet')}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-2",
                      previewDevice === 'tablet' ? "bg-gold text-black shadow-lg" : "text-white/40 hover:text-white"
                    )}
                    title="Tablet View"
                  >
                    <Tablet size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Tablet</span>
                  </button>
                  <button
                    onClick={() => setPreviewDevice('mobile')}
                    className={cn(
                      "p-2 rounded-lg transition-all flex items-center gap-2",
                      previewDevice === 'mobile' ? "bg-gold text-black shadow-lg" : "text-white/40 hover:text-white"
                    )}
                    title="Mobile View"
                  >
                    <Smartphone size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Mobile</span>
                  </button>
                </div>

                <button 
                  onClick={() => setShowHtmlPreviewModal(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 bg-[#050505] relative overflow-hidden flex items-center justify-center p-4">
                <div className={cn(
                  "h-full w-full transition-all duration-500 bg-[#0c0c0c] shadow-2xl relative overflow-hidden rounded-sm",
                  previewDevice === 'desktop' ? "max-w-full" : 
                  previewDevice === 'tablet' ? "max-w-[768px] border-[12px] border-black rounded-[40px]" : 
                  "max-w-[375px] border-[12px] border-black rounded-[40px]"
                )}>
                  {/* Device-specific camera/notch for mobile/tablet */}
                  {(previewDevice === 'mobile' || previewDevice === 'tablet') && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-6 bg-black rounded-b-2xl z-20 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white/10" />
                    </div>
                  )}
                  <iframe
                    title="Content Preview"
                    className="w-full h-full border-none"
                  srcDoc={`
                    <!DOCTYPE html>
                    <html>
                      <head>
                        <meta charset="utf-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1">
                        <script src="https://cdn.tailwindcss.com"></script>
                        <script>
                          tailwind.config = {
                            theme: {
                              extend: {
                                colors: {
                                  gold: '#D4AF37',
                                }
                              }
                            }
                          }
                        </script>
                        <link rel="preconnect" href="https://fonts.googleapis.com">
                        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
                        <style>
                          body {
                            background-color: #0c0c0c;
                            color: #ffffff;
                            font-family: 'Inter', sans-serif;
                            margin: 0;
                            padding: 20px;
                            line-height: 1.6;
                            box-sizing: border-box;
                          }
                          @media (min-width: 768px) {
                            body { padding: 40px; }
                          }
                          .cms-rendered-content {
                            max-width: 800px;
                            margin: 0 auto;
                          }
                          ${systemSettings?.seo?.isGlobalCssActive ? systemSettings?.seo?.globalCmsCss : ''}
                          ${editingPage?.customCss || ''}
                        </style>
                        <style>
                          /* Additional baseline content styles if Global CSS is empty */
                          .cms-rendered-content h1, .cms-rendered-content h2, .cms-rendered-content h3 { font-family: 'Outfit', sans-serif; color: #D4AF37; }
                          .cms-rendered-content img { max-width: 100%; border-radius: 12px; margin: 20px 0; }
                        </style>
                      </head>
                      <body>
                        <div class="cms-rendered-content">
                          ${editingPage?.content || '<p class="text-white/20 italic text-center py-20 uppercase tracking-[0.2em]">No content to preview...</p>'}
                        </div>
                      </body>
                    </html>
                  `}
                />
              </div>
            </div>

            <div className="p-4 bg-black/40 border-t border-white/5 flex justify-end items-center gap-4">
                <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest font-bold mr-auto px-4">
                  <div className={cn("w-2 h-2 rounded-full", systemSettings?.seo?.isGlobalCssActive ? "bg-green-500" : "bg-red-500")} />
                  Global CSS: {systemSettings?.seo?.isGlobalCssActive ? 'Applied' : 'Disabled'}
                </div>
                <button
                  onClick={() => setShowHtmlPreviewModal(false)}
                  className="px-8 py-2.5 bg-gold text-black rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-lg"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

      {/* CSS Editor Modal */}
      <AnimatePresence>
        {showCssModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCssModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl glass p-4 sm:p-8 rounded-xl border border-white/10 shadow-2xl max-h-[95vh] overflow-y-auto custom-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-display text-gold">{cssConfig.title}</h3>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                    {cssConfig.type === 'global' ? 'Applies to all CMS pages/blogs' : 'Applies to this specific item only'}
                  </p>
                </div>
                <button onClick={() => setShowCssModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors shrink-0">
                  <X size={24} />
                </button>
              </div>

              <div className="max-w-3xl mx-auto space-y-6">
                <div className="space-y-6">
                  {/* Status Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div className="pr-4">
                      <p className="text-sm font-bold">CSS Status</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">
                        {cssConfig.isActive ? 'Active and applying styles' : 'Inactive (styles ignored)'}
                      </p>
                    </div>
                    <button
                      onClick={() => setCssConfig({ ...cssConfig, isActive: !cssConfig.isActive })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative shrink-0",
                        cssConfig.isActive ? "bg-gold" : "bg-white/10"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          cssConfig.isActive ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  </div>

                  {/* Editor */}
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">CSS Content</label>
                    <div className="relative group">
                      <textarea
                        value={cssConfig.content}
                        onChange={e => setCssConfig({ ...cssConfig, content: e.target.value })}
                        className="w-full h-[300px] xl:h-[500px] bg-black/50 border border-white/10 rounded-2xl p-6 font-mono text-xs sm:text-sm focus:border-gold outline-none transition-all resize-none shadow-inner custom-scrollbar"
                        placeholder=".custom-class { color: gold; }"
                      />
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Code2 size={16} className="text-white/20" />
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30 italic font-medium">
                      Individual CSS overwrites Global CSS. Use unique selectors to avoid conflicts.
                    </p>
                  </div>

                  <button
                    onClick={handleSaveCss}
                    disabled={cssEditingLoading}
                    className="w-full btn-primary py-4 flex items-center justify-center gap-2"
                  >
                    {cssEditingLoading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                    <span className="text-xs font-bold uppercase tracking-widest">Save CSS Profile</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DynamicPageTab;
