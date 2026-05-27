import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Globe, Plus, Power, Eye, Code2, Copy, Edit2, Trash2, X, CheckCircle, Loader2, Save, Ban, Info
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, setDoc, query, onSnapshot, orderBy } from 'firebase/firestore';

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
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribePages = onSnapshot(query(collection(db, 'pages'), orderBy('createdAt', 'desc')), (snapshot) => {
      setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
      if (snap.exists()) setSystemSettings(snap.data());
    });

    return () => {
      unsubscribePages();
      unsubscribeSettings();
    };
  }, []);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [showPageModal, setShowPageModal] = useState(false);

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
      setShowCssModal(false);
      showDashboardNotice('success', 'CSS updated successfully');
    } catch (err) {
      console.error("Error saving CSS:", err);
      handleFirestoreError(err, OperationType.UPDATE, `save-css-${cssConfig.type}`);
    } finally {
      setCssEditingLoading(false);
    }
  };

  const handleUpdatePage = async (id: string | null, data: any) => {
    try {
      if (id && id !== 'new') {
        await updateDoc(doc(db, 'pages', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
        showDashboardNotice('success', 'Page updated');
      } else {
        await addDoc(collection(db, 'pages'), {
          ...data,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        showDashboardNotice('success', 'Page created');
      }
      setShowPageModal(false);
      setEditingPage(null);
    } catch (err) {
      console.error('Error updating page:', err);
      handleFirestoreError(err, id ? OperationType.UPDATE : OperationType.CREATE, 'pages');
    }
  };

  const handleDeletePage = (id: string) => {
    const page = pages.find(p => p.id === id);
    setConfirmDelete({
      title: 'Delete Page?',
      message: `Are you sure you want to delete "${page?.title || 'this page'}"?`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'pages', id));
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
    } catch (err) {
      console.error('Error duplicating page:', err);
      handleFirestoreError(err, OperationType.CREATE, 'pages');
    }
  };
  const customPages = (pages || []).filter(p => p && !['home', 'fleet', 'services', 'about', 'contact', 'booking', 'offers', 'tours'].includes(p.slug));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="text-left">
          <h3 className="text-xl sm:text-2xl font-display text-gold">Dynamic Pages</h3>
          <p className="text-white/40 text-[10px] uppercase tracking-widest">
            Manage custom landing pages
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-row sm:w-auto items-center">
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
            className="bg-white/5 border border-white/10 text-white/60 hover:text-gold hover:border-gold px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all w-full whitespace-nowrap"
          >
            <Globe size={14} className="shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-widest leading-none">Global CSS</span>
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
                active: true
              });
              setShowPageModal(true);
            }}
            className="btn-primary px-4 py-2 flex items-center justify-center gap-2 w-full whitespace-nowrap"
          >
            <Plus size={14} className="shrink-0" />
            <span className="text-xs font-bold uppercase tracking-widest leading-none">Add Page</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(customPages || []).length > 0 ? (
          (customPages || []).map((page, idx) => (
            <div
              key={page.id || `page-${idx}`}
              className="glass rounded-2xl overflow-hidden border border-white/5 group hover:border-gold/30 transition-all flex flex-col relative"
            >
              {page.active !== false ? (
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
                <div className="absolute top-3 left-4 flex flex-col gap-1 z-10">
                  <span className={cn("text-[8px] uppercase font-bold px-2 py-0.5 rounded w-fit border", page.noindex ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-green-500/10 text-green-400 border-green-500/20")}>
                    {page.noindex ? 'No Index' : 'Index'}
                  </span>
                  <span className={cn("text-[8px] uppercase font-bold px-2 py-0.5 rounded w-fit border", page.includeInSitemap ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-white/5 text-white/40 border-white/10")}>
                    {page.includeInSitemap ? 'In Sitemap' : 'Hidden'}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <h4 className="text-lg font-display text-white line-clamp-1 leading-tight mb-2">{page.title}</h4>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gold uppercase tracking-[0.2em] font-bold">/{page.slug}</p>
                    {page.category && (
                      <span className="text-[8px] bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded uppercase font-black tracking-widest">
                        {page.category}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4 flex-1 flex flex-col bg-white/[0.02] border-t border-white/5">
                {page.excerpt && (
                  <p className="text-[11px] text-white/50 line-clamp-2 italic leading-relaxed">
                    {page.excerpt}
                  </p>
                )}

                <div className="flex-1" />

                <div className="flex gap-1.5 justify-end">
                  <button
                    onClick={() => handleTogglePageActive(page)}
                    className={cn(
                      "p-2.5 rounded-xl transition-all border",
                      page.active !== false ? "bg-white/5 text-green-400 hover:bg-green-500 hover:text-white border-white/5" : "bg-white/5 text-red-500 hover:bg-red-500 hover:text-white border-white/5"
                    )}
                    title={page.active !== false ? "Set as Inactive" : "Set as Active"}
                  >
                    <Power size={18} />
                  </button>
                  <button
                    onClick={() => window.open(`/${page.slug}`, '_blank')}
                    className="p-2.5 bg-white/5 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all border border-white/5"
                    title="View Page"
                  >
                    <Eye size={18} />
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
                    className="p-2.5 bg-white/5 text-purple-400 rounded-xl hover:bg-purple-500 hover:text-white transition-all border border-white/5"
                    title="Custom CSS"
                  >
                    <Code2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDuplicatePage(page)}
                    className="p-2.5 bg-white/5 text-white/60 rounded-xl hover:bg-white hover:text-black transition-all border border-white/5"
                    title="Duplicate Page"
                  >
                    <Copy size={18} />
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
                    className="p-2.5 bg-gold/10 text-gold rounded-xl hover:bg-gold hover:text-black transition-all border border-gold/10"
                  >
                    <Edit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeletePage(page.id)}
                    className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all border border-red-500/10"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-20 glass rounded-3xl border border-dashed border-white/10">
            <Globe size={48} className="text-white/10 mx-auto mb-4" />
            <h4 className="text-lg font-display text-white/40 italic">No dynamic pages created yet</h4>
            <p className="text-xs text-white/20 mt-1 uppercase tracking-widest font-bold font-bold">Launch your first page with the 'Add Page' button</p>
          </div>
        )}
      </div>

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
                <h3 className="text-xl font-display text-gold">
                  {editingPage?.id ? 'Edit Page' : 'Add Dynamic Page'}
                </h3>
                <button onClick={() => setShowPageModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
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

                <div className='custom-scrollbar'>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Page Content (HTML)</label>
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
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingPage?.id ? 'Save Changes' : 'Create Page'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="relative w-full max-w-5xl glass p-8 rounded-xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl sm:text-2xl font-display text-gold">{cssConfig.title}</h3>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest">
                    {cssConfig.type === 'global' ? 'Applies to all CMS pages/blogs' : 'Applies to this specific item only'}
                  </p>
                </div>
                <button onClick={() => setShowCssModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  {/* Status Toggle */}
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                    <div>
                      <p className="text-sm font-bold">CSS Status</p>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">
                        {cssConfig.isActive ? 'Active and applying styles' : 'Inactive (styles ignored)'}
                      </p>
                    </div>
                    <button
                      onClick={() => setCssConfig({ ...cssConfig, isActive: !cssConfig.isActive })}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
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
                  <div className="space-y-2 custom-scrollbar">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">CSS Content</label>
                    <div className="relative group">
                      <textarea
                        value={cssConfig.content}
                        onChange={e => setCssConfig({ ...cssConfig, content: e.target.value })}
                        className="w-full h-80 bg-black/50 border border-white/10 rounded-2xl p-6 font-mono text-sm focus:border-gold outline-none transition-all resize-none shadow-inner"
                        placeholder=".custom-class { color: gold; }"
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Code2 size={16} className="text-white/20" />
                      </div>
                    </div>
                    <p className="text-[9px] text-white/30 italic">
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

                {/* Preview Section */}
                <div className="space-y-4 flex flex-col h-full">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">SEO Live Style Preview</label>
                    <button
                      onClick={() => {
                        const slug = cssConfig.slug || cssConfig.title?.replace('CSS: ', '').toLowerCase().replace(/\s+/g, '-');
                        const prefix = cssConfig.type === 'blog' ? '/blog/' : '/';
                        window.open(`${prefix}${slug}`, '_blank');
                      }}
                      className="text-[10px] text-gold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest font-bold"
                    >
                      <Eye size={12} />
                      View Live Site
                    </button>
                  </div>
                  <div className="flex-1 min-h-[500px] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden relative shadow-2xl">
                    <iframe
                      title="SEO Preview"
                      className="w-full h-full min-h-[500px] border-none"
                      srcDoc={`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <script src="https://cdn.tailwindcss.com"></script>
                              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
                              <script>
                                tailwind.config = {
                                  theme: {
                                    extend: {
                                      colors: {
                                        gold: '#D4AF37',
                                      },
                                      fontFamily: {
                                        display: ['Playfair Display', 'serif'],
                                        sans: ['Inter', 'sans-serif'],
                                      }
                                    }
                                  }
                                }
                              </script>
                              <style type="text/css">
                                body { 
                                  margin: 0; 
                                  padding: 0; 
                                  background: #0a0a0a; 
                                  color: white; 
                                  font-family: 'Inter', sans-serif;
                                  min-height: 100vh;
                                  overflow-x: hidden;
                                }
                                .glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.03); }
                                
                                /* Site Branding Overlays (Simplified Merlux Look) */
                                .nav-shadow { background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); }
                                .footer-shadow { background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); }
                                
                                .content-area h1, .content-area h2, .content-area h3 { font-family: 'Playfair Display', serif; color: #D4AF37; margin-top: 1.5rem; margin-bottom: 1rem; }
                                .content-area p { margin-bottom: 1rem; line-height: 1.8; color: rgba(255,255,255,0.8); }
                                .content-area ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; color: rgba(255,255,255,0.7); }
                                .content-area strong { color: white; }

                                /* Scrollbar */
                                ::-webkit-scrollbar { width: 4px; }
                                ::-webkit-scrollbar-track { background: transparent; }
                                ::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 10px; }

                                /* Global SEO CSS */
                                ${systemSettings?.seo?.isGlobalCssActive ? systemSettings?.seo?.globalCmsCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m) => m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')) : ''}
                                
                                /* Current Active CSS (Scoped to this Preview) */
                                ${cssConfig.isActive ? cssConfig.content.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m) => m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')) : ''}
                              </style>
                            </head>
                            <body>
                              <div class="max-w-4xl mx-auto p-8 sm:p-12 space-y-12 animate-fade-in">
                                ${cssConfig.type === 'global' ? `
                                  <div class="cms-rendered-content preview-container space-y-8">
                                    <div class="space-y-4">
                                      <h1 class="preview-title text-5xl font-display text-gold leading-tight">Elite Travel Refined</h1>
                                      <p class="preview-text text-xl text-white/40 font-light max-w-2xl">
                                        This Global CSS preview showcases how your styles affect the entire Merlux CMS ecosystem. 
                                        Target classes like <span class="text-gold font-bold">.preview-title</span> or 
                                        <span class="text-gold font-bold">.preview-card</span> below.
                                      </p>
                                    </div>
                                    
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div class="preview-card glass p-8 rounded-3xl border border-white/10 hover:border-gold/30 transition-all">
                                        <div class="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center mb-6">
                                          <div class="w-6 h-6 border-2 border-gold rounded-lg"></div>
                                        </div>
                                        <h3 class="text-xl text-white font-bold mb-3">Service Mastery</h3>
                                        <p class="text-sm text-white/50 leading-relaxed">Experience a new standard in luxury transportation across Melbourne and beyond.</p>
                                      </div>
                                      <div class="preview-card glass p-8 rounded-3xl border border-white/10">
                                        <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                                          <div class="w-2 h-6 bg-white/20"></div>
                                        </div>
                                        <h3 class="text-xl text-white font-bold mb-3">Bespoke Design</h3>
                                        <p class="text-sm text-white/50 leading-relaxed">Every detail of your journey is crafted to ensure comfort, privacy, and punctuality.</p>
                                      </div>
                                    </div>

                                    <button class="preview-button w-full sm:w-auto px-12 py-5 bg-gold text-black rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-white transition-all shadow-2xl shadow-gold/20">
                                      Reserve Your Route
                                    </button>
                                  </div>
                                ` : `
                                  <div class="cms-rendered-content actual-content-preview">
                                    <div class="mb-12">
                                      <div class="flex items-center gap-3 text-[10px] text-gold uppercase tracking-[0.3em] font-bold mb-4">
                                        <span class="w-8 h-[1px] bg-gold"></span>
                                        ${cssConfig.type.toUpperCase()} PREVIEW
                                      </div>
                                      <h1 class="text-4xl sm:text-6xl font-display text-white leading-tight mb-6">
                                        ${cssConfig.title?.replace('CSS: ', '')}
                                      </h1>
                                      <div class="flex items-center gap-4 text-white/30 text-xs py-6 border-y border-white/5 uppercase tracking-widest">
                                        <span>BY Merlux Editorial</span>
                                        <span class="w-1 h-1 bg-white/10 rounded-full"></span>
                                        <span>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                      </div>
                                    </div>

                                    ${(cssConfig.type === 'page' || cssConfig.type === 'blog') ? `
                                      <div class="rounded-[2rem] overflow-hidden aspect-[21/9] mb-12 border border-white/10">
                                        <img src="\${cssConfig.featuredImage || (cssConfig.type === 'page' ? 'https://picsum.photos/seed/page/1200/600' : 'https://picsum.photos/seed/blog/1200/600')}" class="w-full h-full object-cover opacity-80" />
                                      </div>
                                    ` : ''}

                                    <div class="content-area text-lg text-white/80 leading-relaxed font-light">
                                      ${cssConfig.itemContent || '<p class="italic opacity-20 text-center py-20 border border-dashed border-white/10 rounded-3xl">No content available to preview. Add text in the main blog/page editor to see it here.</p>'}
                                    </div>

                                    <div class="mt-20 p-8 glass rounded-3xl border border-white/10 text-center">
                                      <h4 class="text-gold font-display text-2xl mb-4 italic">Experience the Merlux standard.</h4>
                                      <p class="text-white/40 text-[10px] uppercase tracking-widest font-bold">Professional Chauffeur Services Melbourne</p>
                                    </div>
                                  </div>
                                `}

                                <div class="mt-20 pt-8 border-t border-white/5">
                                  <p class="text-[8px] uppercase tracking-widest font-black text-gold/30 mb-2">Technical Meta Information</p>
                                  <div class="grid grid-cols-2 gap-4 text-[9px] text-white/20 font-bold uppercase tracking-widest">
                                    <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                                      TYPE: ${cssConfig.type}
                                    </div>
                                    <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                                      REF: ${cssConfig.id || 'GLOBAL_ROOT'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </body>
                          </html>
                        `}
                    />

                    {!cssConfig.isActive && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                        <div className="text-center p-6 glass rounded-2xl border border-white/10">
                          <Ban className="text-red-500 mx-auto mb-2" size={24} />
                          <p className="text-xs font-bold uppercase tracking-widest text-white/60">Preview Disabled</p>
                          <p className="text-[9px] text-white/30 mt-1">Activate CSS to see preview</p>
                        </div>
                      </div>
                    )}
                  </div>
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
