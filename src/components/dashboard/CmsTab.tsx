import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { 
  Globe, Save, Loader2, Phone, BarChart3, Upload, Monitor, Layout, Search,
  Compass, ArrowRight, Briefcase, Plus, Edit2, Trash2, Power, Eye, Info, List,
  Code2, Copy, Trash, X, ArrowUp, ArrowDown, ChevronDown, CheckCircle, ChevronRight,
  MoreHorizontal, GitMerge, Target, Blocks, Tag, MapPin, BookOpen, ChevronUp,
  Settings, Menu, Check, HelpCircle
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { format } from 'date-fns';
import { db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, updateDoc, serverTimestamp, collection, addDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cmsFallback } from '../../data/fallback/cmsFallback';
import { settingsFallback } from '../../data/fallback/settingsFallback';

interface CmsTabProps {
  showDashboardNotice: (type: any, message: string, title?: string) => void;
}

const CmsTab: React.FC<CmsTabProps> = ({
  showDashboardNotice
}) => {
  const [systemSettings, setSystemSettings] = useState<any>({
    ...settingsFallback,
    menus: cmsFallback.menus,
    seo: cmsFallback.seo,
    categories: cmsFallback.categories,
    tags: cmsFallback.tags
  });
  const [blogs, setBlogs] = useState<any[]>([]);
  const [pages, setPages] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const defaultSettings = {
      ...settingsFallback,
      menus: cmsFallback.menus,
      seo: cmsFallback.seo,
      categories: cmsFallback.categories,
      tags: cmsFallback.tags
    };

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
      if (snap.exists()) {
        const dbData = snap.data();
        setSystemSettings({
          ...defaultSettings,
          ...dbData,
          menus: { ...defaultSettings.menus, ...(dbData.menus || {}) },
          seo: { ...defaultSettings.seo, ...(dbData.seo || {}) }
        });
      } else {
        setSystemSettings(defaultSettings);
      }
    }, (err) => {
      console.warn("CMS settings subscription failed, utilizing static settings fallback:", err);
      setSystemSettings(defaultSettings);
    });

    const unsubscribeBlogs = onSnapshot(query(collection(db, 'blogs'), orderBy('createdAt', 'desc')), (snapshot) => {
      setBlogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("CMS blogs loaded from state:", err);
    });

    const unsubscribePages = onSnapshot(query(collection(db, 'pages'), orderBy('createdAt', 'desc')), (snapshot) => {
      setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("CMS pages loaded from state:", err);
    });

    const unsubscribeOffers = onSnapshot(query(collection(db, 'offers'), orderBy('createdAt', 'desc')), (snapshot) => {
      setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("CMS offers loaded from state:", err);
    });

    const unsubscribeTours = onSnapshot(query(collection(db, 'tours'), orderBy('createdAt', 'desc')), (snapshot) => {
      setTours(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("CMS tours loaded from state:", err);
    });

    setLoading(false);

    return () => {
      unsubscribeSettings();
      unsubscribeBlogs();
      unsubscribePages();
      unsubscribeOffers();
      unsubscribeTours();
    };
  }, []);
  const [newMenuLabel, setNewMenuLabel] = useState('');
  const [newMenuUrl, setNewMenuUrl] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Menu States Localized
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuType, setEditingMenuType] = useState<'header' | 'footer' | 'services'>('header');
  const [tempMenuItems, setTempMenuItems] = useState<any[]>([]);
  const [targetedMenuIdx, setTargetedMenuIdx] = useState<number | null>(null);
  const [targetedSubIdx, setTargetedSubIdx] = useState<number | null>(null);
  const [isSavingMenus, setIsSavingMenus] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [paletteTab, setPaletteTab] = useState<'nodes' | 'pages' | 'blogs'>('nodes');
  const [selectedPaletteItems, setSelectedPaletteItems] = useState<any[]>([]);
  const [collapsedNodes, setCollapsedNodes] = useState<string[]>([]);

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes(prev => 
      prev.includes(nodeId) ? prev.filter(id => id !== nodeId) : [...prev, nodeId]
    );
  };

  // New states for internal modals logic if needed
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [editingBlog, setEditingBlog] = useState<any>(null);

  const handleUpdateSettings = async (data: any) => {
    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, 'settings', 'system'), {
        ...data,
        updatedAt: serverTimestamp()
      });
      showDashboardNotice('success', 'System settings updated successfully.', 'Settings Saved');
    } catch (err) {
      console.error('Error saving settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/system');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `assets/logo_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, logo: url } });
    } catch (err) {
      console.error('Logo upload error:', err);
      showDashboardNotice('error', 'Failed to upload brand logo.', 'Upload Error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `assets/favicon_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, favicon: url } });
    } catch (err) {
      console.error('Favicon upload error:', err);
      showDashboardNotice('error', 'Failed to upload site favicon.', 'Upload Error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggleBlogActive = async (blog: any) => {
    try {
      await updateDoc(doc(db, 'blogs', blog.id), {
        active: !blog.active,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `blogs/${blog.id}`);
    }
  };

  const handleDuplicateBlog = async (blog: any) => {
    try {
      const { id, ...data } = blog;
      await addDoc(collection(db, 'blogs'), {
        ...data,
        title: `${data.title} (Copy)`,
        active: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showDashboardNotice('success', 'Blog duplicated successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'blogs');
    }
  };

  const handleDeleteBlog = async (id: string | undefined) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this blog post?')) return;
    try {
      await deleteDoc(doc(db, 'blogs', id));
      showDashboardNotice('success', 'Blog post deleted successfully.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `blogs/${id}`);
    }
  };

  if (!systemSettings) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center glass rounded-3xl border border-white/5">
        <Loader2 className="w-8 h-8 text-gold animate-spin mb-4" />
        <p className="text-gold text-[10px] uppercase tracking-widest font-bold">Synchronizing Engine...</p>
      </div>
    );
  }

  const moveMenuItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...tempMenuItems];
    if (direction === 'up' && index > 0) {
      [newItems[index], newItems[index - 1]] = [newItems[index - 1], newItems[index]];
    } else if (direction === 'down' && index < newItems.length - 1) {
      [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    }
    setTempMenuItems(newItems);
  };

  const updateRootLabel = (idx: number, label: string) => {
    const next = [...tempMenuItems];
    next[idx] = { ...next[idx], label };
    setTempMenuItems(next);
  };

  const updateRootUrl = (idx: number, url: string) => {
    const next = [...tempMenuItems];
    next[idx] = { ...next[idx], url };
    setTempMenuItems(next);
  };

  const deleteRoot = (idx: number) => {
    setTempMenuItems(tempMenuItems.filter((_, i) => i !== idx));
    if (targetedMenuIdx === idx) setTargetedMenuIdx(null);
  };

  const updateSubLabel = (rootIdx: number, subIdx: number, label: string) => {
    const next = [...tempMenuItems];
    const items = [...(next[rootIdx].items || [])];
    items[subIdx] = { ...items[subIdx], label };
    next[rootIdx] = { ...next[rootIdx], items };
    setTempMenuItems(next);
  };

  const updateSubUrl = (rootIdx: number, subIdx: number, url: string) => {
    const next = [...tempMenuItems];
    const items = [...(next[rootIdx].items || [])];
    items[subIdx] = { ...items[subIdx], url };
    next[rootIdx] = { ...next[rootIdx], items };
    setTempMenuItems(next);
  };

  const deleteSub = (rootIdx: number, subIdx: number) => {
    const next = [...tempMenuItems];
    const items = (next[rootIdx].items || []).filter((_, i) => i !== subIdx);
    next[rootIdx] = { ...next[rootIdx], items };
    setTempMenuItems(next);
  };

  const moveSubItem = (rootIdx: number, subIdx: number, direction: 'up' | 'down') => {
    const next = [...tempMenuItems];
    const items = [...(next[rootIdx].items || [])];
    if (direction === 'up' && subIdx > 0) {
      [items[subIdx], items[subIdx - 1]] = [items[subIdx - 1], items[subIdx]];
    } else if (direction === 'down' && subIdx < items.length - 1) {
      [items[subIdx], items[subIdx + 1]] = [items[subIdx + 1], items[subIdx]];
    }
    next[rootIdx] = { ...next[rootIdx], items };
    setTempMenuItems(next);
  };

  const addItemTo = (items: { label: string; url: string } | { label: string; url: string }[]) => {
    const newItems = Array.isArray(items) ? items : [items];
    
    setTempMenuItems(prev => {
      if (targetedMenuIdx !== null) {
        const next = [...prev];
        const rootItem = { ...next[targetedMenuIdx] };

        if (targetedSubIdx !== null && rootItem.items?.[targetedSubIdx]) {
          const subItems = [...(rootItem.items || [])];
          const subItem = { ...subItems[targetedSubIdx] };
          subItem.items = [...(subItem.items || []), ...newItems];
          subItems[targetedSubIdx] = subItem;
          rootItem.items = subItems;
        } else {
          rootItem.items = [...(rootItem.items || []), ...newItems];
        }

        next[targetedMenuIdx] = rootItem;
        return next;
      } else {
        return [...prev, ...newItems];
      }
    });
  };

  const handleUpdateMenus = async () => {
    setIsSavingMenus(true);
    try {
      const field = `menus.${editingMenuType}`;
      const systemRef = doc(db, 'settings', 'system');
      await updateDoc(systemRef, { [field]: tempMenuItems });

      const updated = {
        ...systemSettings,
        menus: {
          ...(systemSettings?.menus || {}),
          [editingMenuType]: tempMenuItems
        }
      };
      setSystemSettings(updated);

      showDashboardNotice('success', `${editingMenuType.charAt(0).toUpperCase() + editingMenuType.slice(1)} Menu Updated`, 'Synchronization Successful');
      setShowMenuModal(false);
    } catch (err: any) {
      console.error(err);
      showDashboardNotice('error', 'Critical synchronization failure', 'Update Error');
    } finally {
      setIsSavingMenus(false);
    }
  };

  return (
    <>
      <div className="space-y-12">
      {/* 1st: Global SEO Section */}
      <div className="space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold decoration-gold/30">Global SEO & Content</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">Global SEO Setup</p>
          </div>
          <button
            onClick={() => handleUpdateSettings(systemSettings)}
            disabled={isSavingSettings}
            className="btn-primary flex items-center justify-center gap-2 h-10 sm:h-10 px-3 sm:px-4 py-2"
          >
            {isSavingSettings ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">
              Save Changes
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Contact Details */}
          <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
            <h4 className="text-sm font-bold text-gold uppercase tracking-widest flex items-center gap-2">
              <Phone size={16} /> Contact Details
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Website Address</label>
                <input
                  type="text"
                  value={systemSettings?.contact?.address || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...(systemSettings?.contact || {}), address: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  placeholder="123 Luxury Way, Melbourne VIC 3000"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Phone Number</label>
                <input
                  type="text"
                  value={systemSettings?.contact?.phone || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...(systemSettings?.contact || {}), phone: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  placeholder="+61 400 000 000"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Contact Email</label>
                  <input
                    type="email"
                    value={systemSettings?.contact?.email || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...(systemSettings?.contact || {}), email: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="info@merlux.com.au"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Booking Email</label>
                  <input
                    type="email"
                    value={systemSettings?.contact?.bookingEmail || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...(systemSettings?.contact || {}), bookingEmail: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="bookings@merlux.com.au"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Latitude (Maps)</label>
                  <input
                    type="text"
                    value={systemSettings?.contact?.lat || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...(systemSettings?.contact || {}), lat: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="-37.8172"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Longitude (Maps)</label>
                  <input
                    type="text"
                    value={systemSettings?.contact?.lng || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...(systemSettings?.contact || {}), lng: e.target.value } })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="144.9625"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Global SEO Details */}
          <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
            <h4 className="text-sm font-bold text-gold uppercase tracking-widest flex items-center gap-2">
              <Globe size={16} /> Global SEO
            </h4>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Site Logo</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={systemSettings?.seo?.logo || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...(systemSettings?.seo || {}), logo: e.target.value } })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Logo URL..."
                  />
                  <label className="cursor-pointer bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-xl px-4 flex items-center justify-center transition-all">
                    <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploading} />
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Favicon (.ico/png)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={systemSettings?.seo?.favicon || ''}
                    onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...(systemSettings?.seo || {}), favicon: e.target.value } })}
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Favicon URL..."
                  />
                  <label className="cursor-pointer bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-xl px-4 flex items-center justify-center transition-all">
                    <input type="file" className="hidden" accept="image/*" onChange={handleFaviconUpload} disabled={isUploading} />
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  </label>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Site Name</label>
                <input
                  type="text"
                  value={systemSettings?.seo?.siteName || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...(systemSettings?.seo || {}), siteName: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  placeholder="Merlux Chauffeur Services"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Default Meta Title</label>
                <input
                  type="text"
                  value={systemSettings?.seo?.defaultTitle || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...(systemSettings?.seo || {}), defaultTitle: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  placeholder="Luxury Chauffeur Melbourne | Merlux"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Default Meta Description</label>
                <textarea
                  value={systemSettings?.seo?.defaultDescription || ''}
                  onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...(systemSettings?.seo || {}), defaultDescription: e.target.value } })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24"
                  placeholder="Book luxury chauffeur services in Melbourne..."
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Default Keywords (comma separated)</label>
                <input
                  type="text"
                  value={Array.isArray(systemSettings?.seo?.defaultKeywords) ? systemSettings.seo.defaultKeywords.join(', ') : systemSettings?.seo?.defaultKeywords || ''}
                  onChange={(e) => {
                    const keywords = e.target.value.split(',').map((k: string) => k.trim()).filter((k: string) => k !== '');
                    setSystemSettings({ ...systemSettings, seo: { ...(systemSettings?.seo || {}), defaultKeywords: keywords } });
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  placeholder="chauffeur, melbourne, luxury travel"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu Section */}
      <div className="space-y-8 border-t border-white/5 pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-display text-gold">Navigation Control</h3>
            <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">Design header and footer navigation menu</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Header Menu Card */}
          <div className="glass relative group overflow-hidden rounded-[32px] border border-white/5 hover:border-gold/30 transition-all duration-700 flex flex-col h-[480px]">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

            <div className="p-8 border-b border-white/5 relative bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-gold transition-colors shadow-lg shadow-black">
                    <Monitor size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-display text-white tracking-tight truncate">Main Header</h4>
                    <p className="text-[8px] uppercase font-black text-gold/40 truncate">Primary customer journey</p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const newStatus = !systemSettings?.menus?.headerActive;
                    const updated = {
                      ...systemSettings,
                      menus: {
                        ...(systemSettings?.menus || {}),
                        headerActive: newStatus
                      }
                    };
                    setSystemSettings(updated);
                    try {
                      const systemRef = doc(db, 'settings', 'system');
                      await updateDoc(systemRef, { 'menus.headerActive': newStatus });
                      showDashboardNotice('success', `Header ${newStatus ? 'Activated' : 'Deactivated'}`, 'Status Updated');
                    } catch (e) {
                      console.error(e);
                      showDashboardNotice('error', 'Failed to update status', 'Update Error');
                    }
                  }}
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-all duration-500",
                    systemSettings?.menus?.headerActive ? "bg-gold" : "bg-white/5 border border-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full transition-all duration-500",
                    systemSettings?.menus?.headerActive ? "right-1 bg-black" : "left-1 bg-white/20"
                  )} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6 space-y-3 relative">
              {((systemSettings?.menus?.header as any[]) || []).length > 0 ? (
                ((systemSettings?.menus?.header as any[]) || []).map((item: any, idx: number) => (
                  <div key={`head-view-${item.id || idx}`} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 group/row hover:border-gold/20 transition-all">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-white/90 group-hover/row:text-gold transition-colors">{item.label}</span>
                      {item.items && item.items.length > 0 && (
                        <span className="text-[8px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                          {item.items.length} Sub-links
                        </span>
                      )}
                    </div>
                    <ArrowRight size={12} className="text-white/10 group-hover/row:text-gold group-hover/row:translate-x-1 transition-all" />
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <Compass size={40} className="mb-4" />
                  <p className="text-[10px] uppercase tracking-widest font-black">Blueprint Empty</p>
                </div>
              )}
            </div>

            <div className="bg-white/[0.01] p-4 border-t border-white/10 relative z-20">
              <button
                onClick={() => {
                  setEditingMenuType('header');
                  setTempMenuItems(systemSettings?.menus?.header || []);
                  setShowMenuModal(true);
                }}
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-black text-white hover:bg-gold hover:text-black transition-all duration-500 hover:scale-[1.02] active:scale-95"
              >
                Edit Header
              </button>
            </div>
          </div>

          {/* Quick Links Card */}
          <div className="glass relative group overflow-hidden rounded-[32px] border border-white/5 hover:border-gold/30 transition-all duration-700 flex flex-col h-[480px]">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

            <div className="p-8 border-b border-white/5 relative bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-gold transition-colors shadow-lg shadow-black">
                    <Layout size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-display text-white tracking-tight truncate">Quick Links</h4>
                    <p className="text-[8px] uppercase font-black text-gold/40 truncate">Footer sitemap & SEO</p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const newStatus = !systemSettings?.menus?.footerActive;
                    const updated = {
                      ...systemSettings,
                      menus: {
                        ...(systemSettings?.menus || {}),
                        footerActive: newStatus
                      }
                    };
                    setSystemSettings(updated);
                    try {
                      const systemRef = doc(db, 'settings', 'system');
                      await updateDoc(systemRef, { 'menus.footerActive': newStatus });
                      showDashboardNotice('success', `Footer ${newStatus ? 'Activated' : 'Deactivated'}`, 'Status Updated');
                    } catch (e) {
                      console.error(e);
                      showDashboardNotice('error', 'Failed to update status', 'Update Error');
                    }
                  }}
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-all duration-500",
                    systemSettings?.menus?.footerActive ? "bg-gold" : "bg-white/5 border border-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full transition-all duration-500",
                    systemSettings?.menus?.footerActive ? "right-1 bg-black" : "left-1 bg-white/20"
                  )} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6 space-y-3 relative">
              {((systemSettings?.menus?.footer as any[]) || []).length > 0 ? (
                ((systemSettings?.menus?.footer as any[]) || []).map((item: any, idx: number) => (
                  <div key={`foot-view-${item.id || idx}`} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 group/row hover:border-gold/20 transition-all">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-white/90 group-hover/row:text-gold transition-colors">{item.label}</span>
                      {item.items && item.items.length > 0 && (
                        <span className="text-[8px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                          {item.items.length} Sub-links
                        </span>
                      )}
                    </div>
                    <ArrowRight size={12} className="text-white/10 group-hover/row:text-gold group-hover/row:translate-x-1 transition-all" />
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <Layout size={40} className="mb-4" />
                  <p className="text-[10px] uppercase tracking-widest font-black">Blueprint Empty</p>
                </div>
              )}
            </div>

            <div className="bg-white/[0.01] p-4 border-t border-white/10 relative z-20">
              <button
                onClick={() => {
                  setEditingMenuType('footer');
                  setTempMenuItems(systemSettings?.menus?.footer || []);
                  setShowMenuModal(true);
                }}
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-black text-white hover:bg-gold hover:text-black transition-all duration-500 hover:scale-[1.02] active:scale-95"
              >
                Edit Quick Links
              </button>
            </div>
          </div>

          {/* Services Column Card */}
          <div className="glass relative group overflow-hidden rounded-[32px] border border-white/5 hover:border-gold/30 transition-all duration-700 flex flex-col h-[480px]">
            <div className="absolute inset-0 bg-gradient-to-br from-gold/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />

            <div className="p-8 border-b border-white/5 relative bg-white/[0.01]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 group-hover:text-gold transition-colors shadow-lg shadow-black">
                    <Briefcase size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xl font-display text-white tracking-tight truncate">Service Assets</h4>
                    <p className="text-[8px] uppercase font-black text-gold/40 truncate">Sub services</p>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    const newStatus = !systemSettings?.menus?.servicesActive;
                    const updated = {
                      ...systemSettings,
                      menus: {
                        ...(systemSettings?.menus || {}),
                        servicesActive: newStatus
                      }
                    };
                    setSystemSettings(updated);
                    try {
                      const systemRef = doc(db, 'settings', 'system');
                      await updateDoc(systemRef, { 'menus.servicesActive': newStatus });
                      showDashboardNotice('success', `Services Column ${newStatus ? 'Activated' : 'Deactivated'}`, 'Status Updated');
                    } catch (e) {
                      console.error(e);
                      showDashboardNotice('error', 'Failed to update status', 'Update Error');
                    }
                  }}
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-all duration-500",
                    systemSettings?.menus?.servicesActive ? "bg-gold" : "bg-white/5 border border-white/10"
                  )}
                >
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full transition-all duration-500",
                    systemSettings?.menus?.servicesActive ? "right-1 bg-black" : "left-1 bg-white/20"
                  )} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6 space-y-3 relative">
              {((systemSettings?.menus?.services as any[]) || []).length > 0 ? (
                ((systemSettings?.menus?.services as any[]) || []).map((item: any, idx: number) => (
                  <div key={`serv-view-${item.id || idx}`} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 group/row hover:border-gold/20 transition-all">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-white/90 group-hover/row:text-gold transition-colors">{item.label}</span>
                      {item.items && item.items.length > 0 && (
                        <span className="text-[8px] text-white/30 uppercase tracking-widest font-bold mt-0.5">
                          {item.items.length} Sub-links
                        </span>
                      )}
                    </div>
                    <ArrowRight size={12} className="text-white/10 group-hover/row:text-gold group-hover/row:translate-x-1 transition-all" />
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                  <Briefcase size={40} className="mb-4" />
                  <p className="text-[10px] uppercase tracking-widest font-black">Blueprint Empty</p>
                </div>
              )}
            </div>

            <div className="bg-white/[0.01] p-4 border-t border-white/10 relative z-20">
              <button
                onClick={() => {
                  setEditingMenuType('services');
                  setTempMenuItems(systemSettings?.menus?.services || []);
                  setShowMenuModal(true);
                }}
                className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] uppercase tracking-[0.2em] font-black text-white hover:bg-gold hover:text-black transition-all duration-500 hover:scale-[1.02] active:scale-95"
              >
                Edit Sub Service
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>

      <AnimatePresence>
        {showMenuModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center px-3 py-6 md:p-6 lg:p-10"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/95 backdrop-blur-3xl"
              onClick={() => setShowMenuModal(false)}
            />

            {/* Modal panel */}
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 16 }}
              className="glass relative flex flex-col w-full max-h-[90dvh] overflow-hidden md:max-w-5xl border border-white/10 rounded-lg overflow-hidden shadow-lg"
            >

              {/* ── Header ─────────────────────────────────────────────────── */}
              <div className="shrink-0 px-4 py-3 md:p-8 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                <div className="flex items-center gap-3 md:gap-6">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold shadow-lg shadow-gold/5">
                    <Compass size={14} className="md:w-5 md:h-5" />
                  </div>
                  <div>
                    <h2 className="text-base md:text-lg font-display text-white tracking-tight">
                      <span className="text-gold capitalize">{editingMenuType}</span> Menu
                    </h2>
                    <p className="text-gold/60 text-[9px] uppercase tracking-widest font-black mt-0.5">
                      {editingMenuType} Menu Editor
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMenuModal(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              {/* ── Body (Structure + Palette) ──────────────────────────────── */}
              {/* FIX 3: min-h-0 on this flex container is critical so children
                       can scroll independently without overflowing the modal. */}
              <div className="flex-1 min-h-0 flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-white/5 overflow-hidden">

                {/* Left — Structure */}
                <div className="flex-1 min-h-0 flex flex-col bg-black/20">
                  {/* Section header */}
                  <div className="shrink-0 p-2 md:p-4 flex items-center justify-between bg-white/[0.01] border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-gold/20 rounded">
                        <List size={12} className="text-gold" />
                      </div>
                      <h4 className="text-[9px] uppercase tracking-[0.2em] font-black text-white">Structure</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          const nodesWithItems = tempMenuItems
                            .map((item, i) => (item.items?.length ?? 0) > 0 ? `node-${i}` : null)
                            .filter(Boolean) as string[];
                          
                          if (collapsedNodes.length === nodesWithItems.length) {
                            setCollapsedNodes([]);
                          } else {
                            setCollapsedNodes(nodesWithItems);
                          }
                        }}
                        className="text-[8px] uppercase tracking-widest font-black text-gold/40 hover:text-gold transition-colors mr-2 px-2 py-1 rounded-lg border border-white/5 hover:border-gold/20"
                      >
                        {collapsedNodes.length > 0 ? 'Expand All' : 'Collapse All'}
                      </button>
                      <span className="w-1 h-1 rounded-full bg-gold" />
                      <span className="text-[9px] font-mono text-white/40">{tempMenuItems.length} Root Nodes</span>
                    </div>
                  </div>

                  {/* FIX 4: overflow-y-auto here, with pb-4 — not pb-24.
                           The action bar is outside this scroll region so it
                           no longer overlaps the content. */}
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4 space-y-3">
                    {tempMenuItems.map((item, idx) => (
                      <div key={`menu-item-${idx}-${item.url}`} className="relative group/node">
                        {/* Root node card */}
                        <div
                          onClick={() => {
                            if (targetedMenuIdx === idx) {
                              setTargetedMenuIdx(null);
                              setTargetedSubIdx(null);
                            } else {
                              setTargetedMenuIdx(idx);
                              setTargetedSubIdx(null);
                            }
                          }}
                          className={cn(
                            "relative z-10 p-2 border rounded-[1rem] transition-all duration-300 cursor-pointer",
                            targetedMenuIdx === idx
                              ? "border-gold ring-1 ring-gold/40 bg-gold/[0.03] shadow-xl shadow-gold/5"
                              : "bg-white/[0.03] border-white/5 hover:border-white/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            {/* Move controls */}
                            <div
                              className="flex flex-col gap-0.5 shrink-0"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                onClick={() => moveMenuItem(idx, "up")}
                                disabled={idx === 0}
                                className="text-white/40 hover:text-gold disabled:opacity-20 transition-colors p-1"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button
                                onClick={() => moveMenuItem(idx, "down")}
                                disabled={idx === tempMenuItems.length - 1}
                                className="text-white/40 hover:text-gold disabled:opacity-20 transition-colors p-1"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>

                            {/* Fields */}
                            <div className="flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-2 mb-1">
                                {(item.items?.length ?? 0) > 0 && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleNode(`node-${idx}`); }}
                                    className={cn(
                                      "w-7 h-7 rounded-lg border flex items-center justify-center transition-all shrink-0",
                                      collapsedNodes.includes(`node-${idx}`) 
                                        ? "bg-white/10 text-gold border-gold/30" 
                                        : "bg-white/5 text-white/40 border-white/10 hover:border-white/20"
                                    )}
                                  >
                                    <ChevronDown size={12} className={cn("transition-transform duration-300", collapsedNodes.includes(`node-${idx}`) && "-rotate-90")} />
                                  </button>
                                )}
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={e => updateRootLabel(idx, e.target.value)}
                                  className="bg-transparent border-none text-[14px] font-bold text-white w-full focus:ring-0 p-0 placeholder:text-white/20"
                                  placeholder="Link Label"
                                />
                                {editingMenuType === 'header' && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const next = [...tempMenuItems];
                                      const isMore = !next[idx].isMore;
                                      next[idx] = { ...next[idx], isMore };
                                      setTempMenuItems(next);
                                    }}
                                    className={cn(
                                      "w-7 h-7 rounded-lg border flex items-center justify-center transition-all shadow-sm shrink-0",
                                      item.isMore
                                        ? "bg-purple-500/20 text-purple-400 border-purple-500/30 font-black ring-1 ring-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                                        : "bg-white/5 text-white/20 border-white/10 hover:border-white/30"
                                    )}
                                    title={item.isMore ? "In 'More' Menu" : "Add to 'More' Menu"}
                                  >
                                    <MoreHorizontal size={12} className={cn(item.isMore && "animate-pulse")} />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = [...tempMenuItems];
                                    next[idx] = {
                                      ...next[idx],
                                      items: [...(next[idx].items ?? []), { label: "New Link", url: "/" }],
                                    };
                                    setTempMenuItems(next);
                                    setTargetedMenuIdx(idx);
                                    setTargetedSubIdx(null);
                                  }}
                                  className={cn(
                                    "w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
                                    targetedMenuIdx === idx && targetedSubIdx === null
                                      ? "bg-gold text-black border-gold shadow-gold/20 font-black"
                                      : "bg-gold/10 text-gold border-gold/20 hover:bg-gold hover:text-black font-bold"
                                  )}
                                >
                                  <GitMerge size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (targetedMenuIdx === idx && targetedSubIdx === null) {
                                      setTargetedMenuIdx(null);
                                      setTargetedSubIdx(null);
                                    } else {
                                      setTargetedMenuIdx(idx);
                                      setTargetedSubIdx(null);
                                    }
                                  }}
                                  className={cn(
                                    "w-7 h-7 rounded-lg border flex items-center justify-center transition-all shadow-sm",
                                    targetedMenuIdx === idx && targetedSubIdx === null
                                      ? "bg-gold text-black border-gold shadow-gold/20"
                                      : "bg-gold/5 text-gold border-gold/10 hover:bg-gold/20 hover:border-gold/30"
                                  )}
                                  title="Target for injection"
                                >
                                  <Target size={12} />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteRoot(idx); }}
                                  className="h-7 w-7 rounded-lg bg-red-500/5 text-red-500/40 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <Globe size={9} className="text-white/20 shrink-0" />
                                <input
                                  type="text"
                                  value={item.url}
                                  onChange={e => updateRootUrl(idx, e.target.value)}
                                  className="bg-transparent border-none text-[10px] font-mono text-white/30 w-full focus:ring-0 p-0 placeholder:text-white/10"
                                  placeholder="/destination-path"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Sub-items */}
                        <AnimatePresence>
                          {!collapsedNodes.includes(`node-${idx}`) && (item.items?.length ?? 0) > 0 && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-10 mt-2 space-y-2 pb-1 relative">
                                {/* Vertical connector line */}
                                <div className="absolute left-[-16px] top-0 bottom-4 w-px bg-white/10" />

                                {item.items!.map((subItem, sIdx) => (
                                  <div key={`sub-${idx}-${sIdx}`} className="relative pl-6">
                                    {/* Horizontal connector */}
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-px bg-white/10" />

                                    <div className="p-2 bg-white/[0.02] border border-white/5 rounded-xl hover:border-gold/20 transition-all">
                                      <div className="flex items-center gap-3">
                                        {/* FIX 5: Sub-item move controls are always visible,
                                                 not hidden until hover — essential for touch. */}
                                        <div className="flex flex-col gap-0.5 shrink-0">
                                          <button
                                            onClick={() => moveSubItem(idx, sIdx, "up")}
                                            disabled={sIdx === 0}
                                            className="text-white/30 hover:text-gold disabled:opacity-20 transition-colors p-0.5"
                                          >
                                            <ChevronUp size={11} />
                                          </button>
                                          {/* FIX 6: Added missing "move down" for sub-items */}
                                          <button
                                            onClick={() => moveSubItem(idx, sIdx, "down")}
                                            disabled={sIdx === (item.items?.length ?? 1) - 1}
                                            className="text-white/30 hover:text-gold disabled:opacity-20 transition-colors p-0.5"
                                          >
                                            <ChevronDown size={11} />
                                          </button>
                                        </div>

                                        <div className="flex-1 min-w-0">
                                          <input
                                            type="text"
                                            value={subItem.label}
                                            onChange={e => updateSubLabel(idx, sIdx, e.target.value)}
                                            className="bg-transparent border-none text-[12px] font-bold text-white/80 w-full focus:ring-0 p-0 mb-0.5 placeholder:text-white/10"
                                            placeholder="Sub-item Label"
                                          />
                                          <input
                                            type="text"
                                            value={subItem.url}
                                            onChange={e => updateSubUrl(idx, sIdx, e.target.value)}
                                            className="bg-transparent border-none text-[9px] font-mono text-white/30 w-full focus:ring-0 p-0"
                                            placeholder="/sub-path"
                                          />
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setTargetedMenuIdx(idx);
                                              setTargetedSubIdx(targetedSubIdx === sIdx ? null : sIdx);
                                            }}
                                            className={cn(
                                              "w-7 h-7 rounded-lg border flex items-center justify-center transition-all",
                                              targetedMenuIdx === idx && targetedSubIdx === sIdx
                                                ? "bg-gold text-black border-gold shadow-lg shadow-gold/20"
                                                : "bg-gold/5 text-gold border-gold/10 hover:bg-gold/20 hover:border-gold/30"
                                            )}
                                            title="Target for injection"
                                          >
                                            <Target size={11} />
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); deleteSub(idx, sIdx); }}
                                            className="w-7 h-7 rounded-lg bg-red-500/5 text-red-500/30 border border-red-500/10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm"
                                          >
                                            <Trash2 size={11} />
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}

                    {/* Empty state — FIX 7: removed animate-pulse (not a loader) */}
                    {tempMenuItems.length === 0 && (
                      <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                        <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-5">
                          <Plus size={28} className="text-white/10" />
                        </div>
                        <p className="text-white/30 text-xs font-black uppercase tracking-[0.2em]">The canvas is silent</p>
                        <p className="text-white/10 text-[10px] uppercase tracking-widest mt-2 font-bold">
                          Inject items from the component palette
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right — Palette */}
                <div className="w-full lg:w-[380px] flex flex-col min-h-0 max-h-[50vh] lg:max-h-none bg-white/[0.01]">
                  {/* Palette header */}
                  <div className="shrink-0 px-4 md:px-6 pt-4 md:pt-6 pb-3 border-b border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1 bg-gold/10 rounded">
                          <Blocks size={12} className="text-gold" />
                        </div>
                        <h4 className="text-[9px] uppercase tracking-[0.2em] font-black text-white">Palette</h4>
                      </div>
                      <button
                        onClick={() => addItemTo({ label: "New Link", url: "/" })}
                        className="text-gold text-[8px] uppercase tracking-widest font-black hover:underline underline-offset-4"
                      >
                        + Manual
                      </button>
                    </div>

                    {/* Search bar */}
                    <div className="relative">
                      <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
                      <input 
                        type="text"
                        placeholder="Search assets..."
                        value={paletteSearch}
                        onChange={(e) => setPaletteSearch(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-[11px] text-white outline-none focus:border-gold/50 transition-all placeholder:text-white/10"
                      />
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/5">
                      {(['nodes', 'pages', 'blogs'] as const).map((tab) => {
                        const count = 
                          tab === 'nodes' ? 8 : 
                          tab === 'pages' ? pages.length : 
                          blogs.length;
                        return (
                          <button
                            key={tab}
                            onClick={() => {
                              setPaletteTab(tab);
                              setSelectedPaletteItems([]);
                            }}
                            className={cn(
                              "flex-1 py-1.5 px-2 rounded-lg text-[8px] uppercase tracking-widest font-black transition-all flex flex-col items-center gap-0.5",
                              paletteTab === tab 
                                ? "bg-gold text-black shadow-lg shadow-gold/10" 
                                : "text-white/40 hover:text-white hover:bg-white/5"
                            )}
                          >
                            <span>{tab}</span>
                            <span className={cn(
                              "text-[7px]",
                              paletteTab === tab ? "text-black/60" : "text-white/20"
                            )}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {targetedMenuIdx !== null && (
                        <motion.div
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          className="p-3 bg-gold/10 border border-gold/30 rounded-2xl flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full bg-gold shadow-[0_0_8px_#d4af37] animate-pulse" />
                            <div className="flex flex-col">
                              <span className="text-[7px] uppercase tracking-widest font-black text-gold/60 mb-0.5">Injecting into</span>
                              <span className="text-[9px] uppercase tracking-widest font-black text-gold line-clamp-1">
                                {targetedSubIdx !== null
                                  ? `${tempMenuItems[targetedMenuIdx]?.label} > ${tempMenuItems[targetedMenuIdx]?.items?.[targetedSubIdx]?.label}`
                                  : tempMenuItems[targetedMenuIdx]?.label
                                }
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setTargetedMenuIdx(null);
                              setTargetedSubIdx(null);
                            }}
                            className="w-7 h-7 rounded-xl bg-gold/10 text-gold flex items-center justify-center hover:bg-gold hover:text-black transition-all"
                          >
                            <X size={11} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Scrollable palette content */}
                  <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 md:px-6 py-4 space-y-6">
                    {/* Bulk Selection Tool */}
                    <div className="flex items-center justify-between px-1">
                      <button 
                        onClick={() => {
                          const currentItems = 
                            paletteTab === 'nodes' ? [
                              { label: "Home", url: "/" },
                              { label: "Fleet", url: "/fleet" },
                              { label: "Services", url: "/services" },
                              { label: "Offers", url: "/offers" },
                              { label: "Tours", url: "/tours" },
                              { label: "About", url: "/about" },
                              { label: "Contact", url: "/contact" },
                              { label: "Blog", url: "/blog" }
                            ].filter(i => i.label.toLowerCase().includes(paletteSearch.toLowerCase())) :
                            paletteTab === 'pages' ? pages.filter(p => p.title.toLowerCase().includes(paletteSearch.toLowerCase()))
                              .map(p => ({ label: p.title, url: `/${p.slug}`, id: p.id })) :
                            blogs.filter(b => b.title.toLowerCase().includes(paletteSearch.toLowerCase()))
                              .map(b => ({ label: b.title, url: `/blog/${b.slug}`, id: b.id }));

                          if (selectedPaletteItems.length === currentItems.length && currentItems.length > 0) {
                            setSelectedPaletteItems([]);
                          } else {
                            setSelectedPaletteItems(currentItems);
                          }
                        }}
                        className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gold/60 hover:text-gold transition-colors"
                      >
                        <div className={cn(
                          "w-3 h-3 rounded flex items-center justify-center border transition-all",
                          selectedPaletteItems.length > 0 && selectedPaletteItems.length === (
                            paletteTab === 'nodes' ? 8 : (paletteTab === 'pages' ? pages.length : blogs.length)
                          ) ? "bg-gold border-gold text-black" : "border-white/20"
                        )}>
                          {selectedPaletteItems.length > 0 && <Check size={8} />}
                        </div>
                        Select All
                      </button>

                      {selectedPaletteItems.length > 0 && (
                        <button 
                          onClick={() => {
                            addItemTo(selectedPaletteItems);
                            setSelectedPaletteItems([]);
                          }}
                          className="px-3 py-1 bg-gold text-black rounded-lg text-[9px] font-black uppercase tracking-widest animate-fade-in"
                        >
                          Add {selectedPaletteItems.length} Items
                        </button>
                      )}
                    </div>

                    {/* Nodes Tab */}
                    {paletteTab === 'nodes' && (
                      <div className="grid grid-cols-1 gap-2">
                        {[
                          { label: "Home", url: "/" },
                          { label: "Fleet", url: "/fleet" },
                          { label: "Services", url: "/services" },
                          { label: "Offers", url: "/offers" },
                          { label: "Tours", url: "/tours" },
                          { label: "About", url: "/about" },
                          { label: "Contact", url: "/contact" },
                          { label: "Blog", url: "/blog" },
                        ].filter(i => i.label.toLowerCase().includes(paletteSearch.toLowerCase())).map(core => {
                          const isSelected = selectedPaletteItems.some(si => si.url === core.url);
                          return (
                            <div 
                              key={`core-${core.url}`}
                              className="group flex items-center gap-2"
                            >
                              <button 
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedPaletteItems(selectedPaletteItems.filter(si => si.url !== core.url));
                                  } else {
                                    setSelectedPaletteItems([...selectedPaletteItems, core]);
                                  }
                                }}
                                className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                  isSelected ? "bg-gold border-gold text-black" : "border-white/10 group-hover:border-white/30"
                                )}
                              >
                                {isSelected && <Check size={10} />}
                              </button>
                              <button
                                onClick={() => addItemTo(core)}
                                className="flex-1 flex items-center justify-between p-3 bg-white/5 rounded-2xl hover:bg-gold/10 hover:border-gold/30 border border-white/5 transition-all text-left"
                              >
                                <span className="text-[10px] font-bold text-white/80 transition-colors">
                                  {core.label}
                                </span>
                                <Plus size={10} className="text-gold shrink-0" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Pages Tab */}
                    {paletteTab === 'pages' && (
                      <div className="space-y-2">
                        {pages.filter(i => i.title.toLowerCase().includes(paletteSearch.toLowerCase())).map(p => {
                          const item = { label: p.title, url: `/${p.slug}`, id: p.id };
                          const isSelected = selectedPaletteItems.some(si => si.id === p.id);
                          return (
                            <div key={`palette-page-${p.id}`} className="group flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedPaletteItems(selectedPaletteItems.filter(si => si.id !== p.id));
                                  } else {
                                    setSelectedPaletteItems([...selectedPaletteItems, item]);
                                  }
                                }}
                                className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                  isSelected ? "bg-gold border-gold text-black" : "border-white/10 group-hover:border-white/30"
                                )}
                              >
                                {isSelected && <Check size={10} />}
                              </button>
                              <button
                                onClick={() => addItemTo(item)}
                                className="flex-1 flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-left border border-transparent hover:border-white/10"
                              >
                                <span className="text-[10px] font-medium text-white/60 line-clamp-1 group-hover:text-white transition-colors">
                                  {p.title}
                                </span>
                                <Plus size={10} className="text-gold opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Blogs Tab */}
                    {paletteTab === 'blogs' && (
                      <div className="space-y-2">
                        {blogs.filter(i => i.title.toLowerCase().includes(paletteSearch.toLowerCase())).map(b => {
                          const item = { label: b.title, url: `/blog/${b.slug}`, id: b.id };
                          const isSelected = selectedPaletteItems.some(si => si.id === b.id);
                          return (
                            <div key={`palette-blog-${b.id}`} className="group flex items-center gap-2">
                              <button 
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedPaletteItems(selectedPaletteItems.filter(si => si.id !== b.id));
                                  } else {
                                    setSelectedPaletteItems([...selectedPaletteItems, item]);
                                  }
                                }}
                                className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center transition-all shrink-0",
                                  isSelected ? "bg-gold border-gold text-black" : "border-white/10 group-hover:border-white/30"
                                )}
                              >
                                {isSelected && <Check size={10} />}
                              </button>
                              <button
                                onClick={() => addItemTo(item)}
                                className="flex-1 flex items-center justify-between p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all text-left border border-transparent hover:border-white/10"
                              >
                                <span className="text-[10px] font-medium text-white/60 line-clamp-1 group-hover:text-white transition-colors">
                                  {b.title}
                                </span>
                                <Plus size={10} className="text-gold opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Action Bar ─────────────────────────────────────────────── */}
              <div className="shrink-0 p-3 md:p-4 border-t border-white/5 bg-white/[0.03] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="hidden md:flex items-center gap-6">
                  <div className="flex flex-col">
                    <span className="text-[7px] uppercase tracking-widest font-black text-white/20">Sync Status</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-1 h-1 rounded-full bg-gold animate-pulse" />
                      <span className="text-[9px] text-white font-mono uppercase tracking-widest">Live Preview</span>
                    </div>
                  </div>
                  <div className="w-px h-8 bg-white/10" />
                  <p className="text-[8px] max-w-[180px] font-bold uppercase tracking-[0.2em] text-white/30 leading-relaxed">
                    Deploying instantly reconfigures the global lattice.
                  </p>
                </div>

                <div className="flex items-stretch md:items-center gap-2 w-full md:w-auto">
                  <button
                    onClick={() => setShowMenuModal(false)}
                    className="flex-1 md:flex-none px-2 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  >
                    Discard
                  </button>
                  <button
                    onClick={handleUpdateMenus}
                    disabled={isSavingMenus}
                    className="flex-1 md:flex-none px-2 py-3 bg-gold text-black rounded-xl text-[9px] font-black uppercase tracking-[0.2em] hover:scale-105 active:scale-95 transition-all shadow-[0_10px_30px_rgba(212,175,55,0.2)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100"
                  >
                    {isSavingMenus
                      ? <><Loader2 size={13} className="animate-spin" /> Committing...</>
                      : <><Save size={13} />Save Changes</>
                    }
                  </button>
                </div>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CmsTab;
