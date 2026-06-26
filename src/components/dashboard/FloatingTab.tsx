import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Loader2, Save, MessageCircle, Facebook, Instagram, Linkedin, Mail,
  Phone, Twitter, Youtube, Globe, ArrowUp, ArrowDown, X, Plus,
  ArrowUpCircle, Layout, Eye, EyeOff, Palette, Edit2, Copy, Trash2,
  Calendar, Clock, CheckCircle, Info, Tag
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { floatingFallback } from '../../data/fallback/floatingFallback';

interface FloatingTabProps {
  showDashboardNotice: (type: 'success' | 'error' | 'info' | 'warning', message: string, title?: string) => void;
}

const FloatingTab: React.FC<FloatingTabProps> = ({
  showDashboardNotice
}) => {
  const [floatingSettings, setFloatingSettings] = useState<any>(floatingFallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'floating'), (snap) => {
      const defaultSettings = {
        ...floatingFallback,
        social: { ...floatingFallback.social },
        scrollTop: { ...floatingFallback.scrollTop },
        bars: [...floatingFallback.bars],
        popups: [...floatingFallback.popups]
      };

      if (snap.exists()) {
        const data = snap.data();
        // Handle legacy structure where bars/popups might be nested
        const legacyBars = data.announcement?.bars || data.bar?.items || [];
        const legacyPopups = data.popups?.items || [];
        
        setFloatingSettings({
          ...defaultSettings,
          ...data,
          social: { ...defaultSettings.social, ...(data.social || {}) },
          scrollTop: { ...defaultSettings.scrollTop, ...(data.scrollTop || {}) },
          bars: Array.isArray(data.bars) ? data.bars : (legacyBars.length ? legacyBars : defaultSettings.bars),
          popups: Array.isArray(data.popups) ? data.popups : (legacyPopups.length ? legacyPopups : defaultSettings.popups)
        });
      } else {
        setFloatingSettings(defaultSettings);
      }
      setLoading(false);
    }, (err) => {
      console.warn("Floating settings subscription failed, utilizing static fallback elements:", err);
      setFloatingSettings(floatingFallback);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [isSavingFloatingSettings, setIsSavingFloatingSettings] = useState(false);
  const [editingBarIndex, setEditingBarIndex] = useState<number | null>(null);
  const [showBarModal, setShowBarModal] = useState(false);
  const [editingPopupIndex, setEditingPopupIndex] = useState<number | null>(null);
  const [showPopupModal, setShowPopupModal] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass rounded-3xl border border-white/5">
        <Loader2 size={40} className="text-gold animate-spin mb-4" />
        <p className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Loading Floating Settings...</p>
      </div>
    );
  }

  const handleUpdateFloatingSettings = async (data: any) => {
    setIsSavingFloatingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'floating'), {
        ...data,
        updatedAt: serverTimestamp()
      });
      showDashboardNotice('success', 'Floating elements configuration saved.', 'Settings Saved');
    } catch (err) {
      console.error('Error saving floating settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/floating');
    } finally {
      setIsSavingFloatingSettings(false);
    }
  };
  if (!floatingSettings) {
    return (
      <div className="flex flex-col items-center justify-center p-20 glass rounded-3xl border border-white/5">
        <Loader2 size={40} className="text-gold animate-spin mb-4" />
        <p className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Loading Floating Settings...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-12">
        {/* Section Header */}
        <div className="flex flex-row justify-between items-center gap-6 mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-xl sm:text-2xl font-display text-gold tracking-tight">Floating Elements</h3>
              <p className="text-white/40 text-[10px] uppercase tracking-widest">
                Global Floating Element Controls
              </p>
            </div>
          </div>

          <button
            onClick={() => handleUpdateFloatingSettings(floatingSettings)}
            disabled={isSavingFloatingSettings}
            className="btn-primary flex items-center justify-center gap-2 sm:gap-3 h-10 px-3 sm:px-6 py-2 sm:py-3 group"
          >
            {isSavingFloatingSettings ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Save size={18} />
            )}
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">
              Save All
            </span>
          </button>
        </div>

        {/* Social Icons Section */}
        <div className="glass p-6 sm:p-8 rounded-2xl border border-white/5 space-y-4">
          <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 border-b border-white/5 pb-3">
              <div>
                <h4 className="text-lg sm:text-xl font-display text-white">
                  Floating Social Icons
                </h4>
                <p className="text-xs sm:text-sm text-white/40">
                  Manage your floating contact & social media shortcuts
                </p>
              </div>

              <label className="inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={floatingSettings?.social?.active}
                  onChange={() =>
                    setFloatingSettings((prev: any) => ({
                      ...prev,
                      social: { ...(prev?.social || {}), active: !prev?.social?.active },
                    }))
                  }
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-white/20 rounded-full peer-checked:bg-gold relative transition-colors">
                  <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5/6" />
                </div>
                <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/40 peer-checked:text-gold">
                  {floatingSettings?.social?.active ? "Active" : "Disabled"}
                </span>
              </label>
            </div>

            {/* MAIN GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* ================= LEFT COLUMN ================= */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                    Layout & Placement
                  </span>
                </div>

                <div className="space-y-6 bg-white/[0.02] rounded-2xl border border-white/5 p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Desktop Offset */}
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">
                        Desktop Offset
                      </label>
                      <div className="px-3 py-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">X-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.social?.offsetX || 0}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="1" value={floatingSettings?.social?.offsetX || 0} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, social: { ...(prev?.social || {}), offsetX: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1" style={{ '--value': `${(((floatingSettings?.social?.offsetX || 0) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">Y-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.social?.offsetY || 0}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="1" value={floatingSettings?.social?.offsetY || 0} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, social: { ...(prev?.social || {}), offsetY: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1" style={{ '--value': `${(((floatingSettings?.social?.offsetY || 0) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                      </div>
                    </div>

                    {/* Mobile Offset */}
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">
                        Mobile Offset
                      </label>
                      <div className="px-3 py-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">X-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.social?.mobileOffsetX ?? (floatingSettings?.social?.offsetX || 0)}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="1" value={floatingSettings?.social?.mobileOffsetX ?? (floatingSettings?.social?.offsetX || 0)} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, social: { ...(prev?.social || {}), mobileOffsetX: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1" style={{ '--value': `${(((floatingSettings?.social?.mobileOffsetX ?? (floatingSettings?.social?.offsetX || 0)) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">Y-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.social?.mobileOffsetY ?? (floatingSettings?.social?.offsetY || 0)}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="1" value={floatingSettings?.social?.mobileOffsetY ?? (floatingSettings?.social?.offsetY || 0)} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, social: { ...(prev?.social || {}), mobileOffsetY: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1" style={{ '--value': `${(((floatingSettings?.social?.mobileOffsetY ?? (floatingSettings?.social?.offsetY || 0)) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">
                    Screen Position
                  </label>
                  <select
                    value={floatingSettings?.social?.position || "right-bottom"}
                    onChange={(e) =>
                      setFloatingSettings((prev: any) => ({
                        ...prev,
                        social: {
                          ...(prev?.social || {}),
                          position: e.target.value,
                        },
                      }))
                    }
                    className="custom-select w-full"
                  >
                    <option value="right-bottom">Bottom Right</option>
                    <option value="left-bottom">Bottom Left</option>
                    <option value="right-center">Center Right</option>
                    <option value="left-center">Center Left</option>
                  </select>
                </div>
              </div>

              {/* ================= RIGHT COLUMN ================= */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                    Visibility & Auto Close Rules
                  </span>
                </div>

                <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                    <EyeOff size={12} />
                    Auto Close Timing
                  </label>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest">
                        Close after (seconds)
                      </span>
                      <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-0.5 rounded-lg">
                        {floatingSettings?.social?.autoCloseTime || 0}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="60"
                      step="1"
                      value={floatingSettings?.social?.autoCloseTime || 0}
                      onChange={(e) =>
                        setFloatingSettings((prev: any) => ({
                          ...prev,
                          social: {
                            ...(prev?.social || {}),
                            autoCloseTime: Number(e.target.value),
                          },
                        }))
                      }
                      className="w-full bg-transparent appearance-none cursor-pointer h-1.5"
                      style={{ '--value': `${(((floatingSettings?.social?.autoCloseTime || 0) - 0) / (60 - 0)) * 100}%` } as React.CSSProperties}
                    />
                  </div>
                </div>

                <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                  <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                    <Eye size={12} />
                    Page Visibility Rules
                  </label>
                  <select
                    value={floatingSettings?.social?.displayCondition || "all"}
                    onChange={(e) =>
                      setFloatingSettings((prev: any) => ({
                        ...prev,
                        social: {
                          ...(prev?.social || {}),
                          displayCondition: e.target.value,
                        },
                      }))
                    }
                    className="custom-select w-full"
                  >
                    <option value="all">Show Everywhere</option>
                    <option value="landing">Home Page Only</option>
                    <option value="specific">Specific Pages Only</option>
                    <option value="except">Except Specific Pages</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Icon Editor */}
          <div className="pt-8 border-t border-white/5">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Configuration Details</span>
              </div>
              <button
                onClick={() => {
                  const newIcon = {
                    id: `custom-${Date.now()}`,
                    type: 'whatsapp',
                    label: 'Whatsapp',
                    url: '',
                    active: true,
                    color: '#D4AF37',
                    iconColor: '#ffffff',
                    bgType: 'solid',
                    bgColor: '#D4AF37',
                    bgGradient: 'linear-gradient(45deg, #D4AF37, #F1D483)',
                    padding: 12,
                    iconSize: 20,
                  };
                  setFloatingSettings((prev: any) => ({
                    ...prev,
                    social: {
                      ...prev.social,
                      icons: [...(prev.social.icons || []), newIcon],
                    },
                  }));
                }}
                className="flex items-center justify-center gap-2 sm:gap-3 h-10 px-3 sm:px-4 py-2 bg-gold text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105"
              >
                <Plus size={16} />
                <span className="hidden sm:inline">Add New</span>
              </button>
            </div>

            {(floatingSettings?.social?.icons || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-4">
                  <Plus size={24} />
                </div>
                <p className="text-xs text-white/40">No icons added yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(floatingSettings?.social?.icons || []).map((icon: any, idx: number) => (
                  <div key={`edit-${icon.id || idx}`} className="bg-black/40 border border-white/10 p-5 rounded-2xl flex flex-col gap-5 relative overflow-hidden group/editor">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                          {icon.type === 'whatsapp' ? <MessageCircle size={16} /> :
                            icon.type === 'facebook' ? <Facebook size={16} /> :
                              icon.type === 'instagram' ? <Instagram size={16} /> :
                                icon.type === 'linkedin' ? <Linkedin size={16} /> :
                                  icon.type === 'email' ? <Mail size={16} /> :
                                    icon.type === 'phone' ? <Phone size={16} /> :
                                      icon.type === 'twitter' ? <Twitter size={16} /> :
                                        icon.type === 'youtube' ? <Youtube size={16} /> :
                                          <Globe size={16} />}
                        </div>
                        <input
                          type="text"
                          value={icon.label}
                          onChange={(e) => {
                            setFloatingSettings((prev: any) => {
                              const newIcons = [...prev.social.icons];
                              newIcons[idx].label = e.target.value;
                              return { ...prev, social: { ...prev.social, icons: newIcons } };
                            });
                          }}
                          className="hidden md:block bg-transparent border-none text-sm font-display text-white outline-none focus:ring-0 border-b border-transparent focus:border-gold/30 transition-all px-0 w-32"
                          placeholder="Icon Label"
                        />
                      </div>
                      <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
                        <button
                          onClick={() => {
                            if (idx > 0) {
                              setFloatingSettings((prev: any) => {
                                const newIcons = [...prev.social.icons];
                                [newIcons[idx], newIcons[idx - 1]] = [newIcons[idx - 1], newIcons[idx]];
                                return { ...prev, social: { ...prev.social, icons: newIcons } };
                              });
                            }
                          }}
                          disabled={idx === 0}
                          className="p-1.5 hover:bg-white/10 text-white/40 hover:text-white rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                          title="Move Up"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          onClick={() => {
                            if (idx < (floatingSettings?.social?.icons?.length || 0) - 1) {
                              setFloatingSettings((prev: any) => {
                                const newIcons = [...prev.social.icons];
                                [newIcons[idx], newIcons[idx + 1]] = [newIcons[idx + 1], newIcons[idx]];
                                return { ...prev, social: { ...prev.social, icons: newIcons } };
                              });
                            }
                          }}
                          disabled={idx === (floatingSettings?.social?.icons?.length || 0) - 1}
                          className="p-1.5 hover:bg-white/10 text-white/40 hover:text-white rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                          title="Move Down"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <button
                          onClick={() => {
                            setFloatingSettings((prev: any) => ({
                              ...prev,
                              social: {
                                ...prev.social,
                                icons: prev.social.icons.filter((_: any, i: number) => i !== idx)
                              }
                            }));
                          }}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-all"
                          title="Remove Icon"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-x-4 gap-y-4 relative z-10 scale-[0.98] origin-top">
                      <div className="space-y-1.5">
                        <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30 pl-1">Platform</label>
                        <select
                          value={icon.type}
                          onChange={(e) => {
                            const value = e.target.value;
                            const labelMap: Record<string, string> = {
                              whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
                              twitter: 'Twitter', youtube: 'YouTube', email: 'Email', phone: 'Phone / Call', website: 'Website / Link'
                            };
                            setFloatingSettings((prev: any) => {
                              const newIcons = [...prev.social.icons];
                              newIcons[idx].type = value;
                              newIcons[idx].label = labelMap[value] || value;
                              return { ...prev, social: { ...prev.social, icons: newIcons } };
                            });
                          }}
                          className="custom-select w-full py-2 text-[10px]"
                        >
                          <option value="whatsapp">WhatsApp</option>
                          <option value="facebook">Facebook</option>
                          <option value="instagram">Instagram</option>
                          <option value="linkedin">LinkedIn</option>
                          <option value="twitter">Twitter</option>
                          <option value="youtube">YouTube</option>
                          <option value="email">Email</option>
                          <option value="phone">Phone / Call</option>
                          <option value="website">Website / Link</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30 pl-1">URL / ID</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={icon.url}
                            onChange={(e) => {
                              setFloatingSettings((prev: any) => {
                                const newIcons = [...prev.social.icons];
                                newIcons[idx].url = e.target.value;
                                return { ...prev, social: { ...prev.social, icons: newIcons } };
                              });
                            }}
                            className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white/80 focus:border-gold outline-none transition-all pr-8"
                            placeholder={icon.type === 'phone' ? 'tel:+61...' : 'https://...'}
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30 pl-1">Style</label>
                        <select
                          value={icon.bgType || 'solid'}
                          onChange={(e) => {
                            setFloatingSettings((prev: any) => {
                              const newIcons = [...prev.social.icons];
                              newIcons[idx].bgType = e.target.value;
                              return { ...prev, social: { ...prev.social, icons: newIcons } };
                            });
                          }}
                          className="custom-select w-full py-2 text-[10px]"
                        >
                          <option value="solid">Solid Background</option>
                          <option value="gradient">Gradient Finish</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center pl-1 pr-1">
                          <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">
                            {icon.bgType === 'gradient' ? 'Gradient CSS' : 'BG Color'}
                          </label>
                          {!icon.bgType || icon.bgType === 'solid' ? (
                            <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: icon.bgColor || icon.color || '#D4AF37' }} />
                          ) : (
                            <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: icon.bgGradient }} />
                          )}
                        </div>
                        {icon.bgType === 'gradient' ? (
                          <input
                            type="text"
                            value={icon.bgGradient || 'linear-gradient(45deg, #D4AF37, #F1D483)'}
                            onChange={(e) => {
                              setFloatingSettings((prev: any) => {
                                const newIcons = [...prev.social.icons];
                                newIcons[idx].bgGradient = e.target.value;
                                return { ...prev, social: { ...prev.social, icons: newIcons } };
                              });
                            }}
                            className="w-full h-7 bg-black/40 border border-white/10 rounded-lg text-[8px] font-mono px-2 outline-none focus:border-gold text-white/60"
                          />
                        ) : (
                          <input
                            type="color"
                            value={icon.bgColor || icon.color || '#D4AF37'}
                            onChange={(e) => {
                              setFloatingSettings((prev: any) => {
                                const newIcons = [...prev.social.icons];
                                newIcons[idx].bgColor = e.target.value;
                                newIcons[idx].color = e.target.value;
                                return { ...prev, social: { ...prev.social, icons: newIcons } };
                              });
                            }}
                            className="w-full h-7 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden p-0"
                          />
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-1 border-t border-white/5 relative z-10 scale-[0.98] origin-top">
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">Padding</label>
                          <span className="text-[8px] font-mono text-gold">{icon.padding || 12}px</span>
                        </div>
                        <input
                          type="range"
                          min="4"
                          max="32"
                          value={icon.padding || 12}
                          onChange={(e) => {
                            setFloatingSettings((prev: any) => {
                              const newIcons = [...prev.social.icons];
                              newIcons[idx].padding = parseInt(e.target.value);
                              return { ...prev, social: { ...prev.social, icons: newIcons } };
                            });
                          }}
                          className="w-full bg-transparent appearance-none cursor-pointer h-1"
                          style={{ '--value': `${(((icon.padding || 12) - 4) / (32 - 4)) * 100}%` } as React.CSSProperties}
                        />
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">Size</label>
                          <span className="text-[8px] font-mono text-gold">{icon.iconSize || 20}px</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="48"
                          value={icon.iconSize || 20}
                          onChange={(e) => {
                            setFloatingSettings((prev: any) => {
                              const newIcons = [...prev.social.icons];
                              newIcons[idx].iconSize = parseInt(e.target.value);
                              return { ...prev, social: { ...prev.social, icons: newIcons } };
                            });
                          }}
                          className="w-full bg-transparent appearance-none cursor-pointer h-1"
                          style={{ '--value': `${(((icon.iconSize || 20) - 10) / (48 - 10)) * 100}%` } as React.CSSProperties}
                        />
                      </div>
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">Color</label>
                          <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: icon.iconColor || '#ffffff' }} />
                        </div>
                        <input
                          type="color"
                          value={icon.iconColor || '#ffffff'}
                          onChange={(e) => {
                            setFloatingSettings((prev: any) => {
                              const newIcons = [...prev.social.icons];
                              newIcons[idx].iconColor = e.target.value;
                              return { ...prev, social: { ...prev.social, icons: newIcons } };
                            });
                          }}
                          className="w-full h-4 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden p-0"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scroll To Top Section */}
        <div className="glass p-6 sm:p-8 rounded-2xl border border-white/5 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                <ArrowUpCircle size={22} />
              </div>
              <div>
                <h4 className="text-lg font-display text-gold tracking-tight">Scroll To Top Button</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Automated navigation helper</p>
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer group bg-black/20 self-start sm:self-auto py-2 px-4 rounded-xl border border-white/5 hover:border-gold/30 transition-all">
              <div className={cn("w-10 h-5 rounded-full transition-all relative shrink-0", floatingSettings?.scrollTop?.active ? "bg-gold" : "bg-white/10")}>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={floatingSettings?.scrollTop?.active || false}
                  onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), active: e.target.checked } }))}
                />
                <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all", floatingSettings?.scrollTop?.active ? "right-1" : "left-1")} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Status</span>
            </label>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                  <Layout size={12} />
                  Position & Threshold
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), position: 'right-bottom' } }))}
                    className={cn(
                      "py-3.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm",
                      floatingSettings?.scrollTop?.position === 'right-bottom' ? "bg-gold text-black border-gold" : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                    )}
                  >
                    Bottom Right
                  </button>
                  <button
                    onClick={() => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), position: 'left-bottom' } }))}
                    className={cn(
                      "py-3.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm",
                      floatingSettings?.scrollTop?.position === 'left-bottom' ? "bg-gold text-black border-gold" : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                    )}
                  >
                    Bottom Left
                  </button>
                </div>
                <div className="space-y-6 bg-white/[0.02] rounded-2xl border border-white/5 p-6 mt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">Desktop Offset</label>
                      <div className="px-3 py-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">X-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.scrollTop?.offsetX ?? 24}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="4" value={floatingSettings?.scrollTop?.offsetX ?? 24} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), offsetX: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1.5" style={{ '--value': `${(((floatingSettings?.scrollTop?.offsetX ?? 24) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">Y-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.scrollTop?.offsetY ?? 24}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="4" value={floatingSettings?.scrollTop?.offsetY ?? 24} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), offsetY: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1.5" style={{ '--value': `${(((floatingSettings?.scrollTop?.offsetY ?? 24) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">Mobile Offset</label>
                      <div className="px-3 py-4 bg-black/40 rounded-xl border border-white/5 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">X-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.scrollTop?.mobileOffsetX ?? (floatingSettings?.scrollTop?.offsetX ?? 24)}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="4" value={floatingSettings?.scrollTop?.mobileOffsetX ?? (floatingSettings?.scrollTop?.offsetX ?? 24)} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), mobileOffsetX: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1.5" style={{ '--value': `${(((floatingSettings?.scrollTop?.mobileOffsetX ?? (floatingSettings?.scrollTop?.offsetX ?? 24)) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono text-gold/60">Y-AXIS</span>
                            <span className="text-xs font-mono text-gold">{floatingSettings?.scrollTop?.mobileOffsetY ?? (floatingSettings?.scrollTop?.offsetY ?? 24)}px</span>
                          </div>
                          <input type="range" min="0" max="200" step="4" value={floatingSettings?.scrollTop?.mobileOffsetY ?? (floatingSettings?.scrollTop?.offsetY ?? 24)} onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), mobileOffsetY: Number(e.target.value) } }))} className="w-full bg-transparent appearance-none cursor-pointer h-1.5" style={{ '--value': `${(((floatingSettings?.scrollTop?.mobileOffsetY ?? (floatingSettings?.scrollTop?.offsetY ?? 24)) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-2">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Show after scroll of</span>
                    <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-0.5 rounded-lg border border-gold/20">{floatingSettings?.scrollTop?.offset || 300}px</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="50"
                    value={floatingSettings?.scrollTop?.offset || 300}
                    onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), offset: Number(e.target.value) } }))}
                    className="w-full bg-transparent appearance-none cursor-pointer h-1.5"
                    style={{ '--value': `${(((floatingSettings?.scrollTop?.offset || 300) - 100) / (2000 - 100)) * 100}%` } as React.CSSProperties}
                  />
                </div>
              </div>
              <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                  <Eye size={12} />
                  Page Visibility Rules
                </label>
                <select
                  value={floatingSettings?.scrollTop?.displayCondition || 'all'}
                  onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), displayCondition: e.target.value } }))}
                  className="custom-select w-full"
                >
                  <option value="all">Show Everywhere</option>
                  <option value="landing">Home Page Only</option>
                  <option value="specific">Specific Pages Only</option>
                  <option value="except">Except Specific Pages</option>
                </select>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-black/20 rounded-2xl border border-white/5 space-y-6">
                <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                  <Palette size={12} />
                  Style & Appearance
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest ml-1">Shape</span>
                      <select
                        value={floatingSettings?.scrollTop?.shape || 'circle'}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), shape: e.target.value } }))}
                        className="custom-select w-full"
                      >
                        <option value="circle">Circle</option>
                        <option value="square">Sharp Square</option>
                        <option value="rounded">Modern Rounded</option>
                        <option value="pulse">Pulse Glow Effect</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest ml-1">Icon Style</span>
                      <select
                        value={floatingSettings?.scrollTop?.icon || 'arrow-up'}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), icon: e.target.value } }))}
                        className="custom-select w-full"
                      >
                        <option value="arrow-up">Arrow Simple</option>
                        <option value="chevron-up">Chevron Minimal</option>
                        <option value="arrow-up-circle">Circle Arrow</option>
                        <option value="move-up">Move Up Accent</option>
                        <option value="rocket">Rocket Launcher</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Button Sizing</span>
                        <span className="text-[10px] font-mono text-gold">{floatingSettings?.scrollTop?.padding || 12}px</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="40"
                        value={floatingSettings?.scrollTop?.padding || 12}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), padding: parseInt(e.target.value) } }))}
                        className="w-full bg-transparent appearance-none cursor-pointer h-1"
                        style={{ '--value': `${(((floatingSettings?.scrollTop?.padding || 12) - 4) / (40 - 4)) * 100}%` } as React.CSSProperties}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Icon Scale</span>
                        <span className="text-[10px] font-mono text-gold">{floatingSettings?.scrollTop?.iconSize || 20}px</span>
                      </div>
                      <input
                        type="range"
                        min="12"
                        max="64"
                        value={floatingSettings?.scrollTop?.iconSize || 20}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), iconSize: parseInt(e.target.value) } }))}
                        className="w-full bg-transparent appearance-none cursor-pointer h-1"
                        style={{ '--value': `${(((floatingSettings?.scrollTop?.iconSize || 20) - 12) / (64 - 12)) * 100}%` } as React.CSSProperties}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest block ml-1">Background style</span>
                      <div className="space-y-3">
                        <select
                          value={floatingSettings?.scrollTop?.bgType || 'solid'}
                          onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), bgType: e.target.value } }))}
                          className="custom-select w-full"
                        >
                          <option value="solid">Flat Color</option>
                          <option value="gradient">Premium Gradient</option>
                        </select>
                        {floatingSettings?.scrollTop?.bgType === 'gradient' ? (
                          <input
                            type="text"
                            value={floatingSettings?.scrollTop?.bgGradient || 'linear-gradient(45deg, #D4AF37, #F1D483)'}
                            onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), bgGradient: e.target.value } }))}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-gold outline-none focus:border-gold/50"
                          />
                        ) : (
                          <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                            <input
                              type="color"
                              value={floatingSettings?.scrollTop?.color || '#D4AF37'}
                              onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), color: e.target.value } }))}
                              className="w-10 h-10 rounded-lg overflow-hidden bg-transparent border-none cursor-pointer"
                            />
                            <input
                              type="text"
                              value={floatingSettings?.scrollTop?.color || '#D4AF37'}
                              onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), color: e.target.value } }))}
                              className="flex-1 bg-transparent text-[10px] font-mono text-gold outline-none"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest block ml-1">Icon Color</span>
                      <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                        <input
                          type="color"
                          value={floatingSettings?.scrollTop?.iconColor || '#000000'}
                          onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), iconColor: e.target.value } }))}
                          className="w-10 h-10 rounded-lg overflow-hidden bg-transparent border-none cursor-pointer"
                        />
                        <input
                          type="text"
                          value={floatingSettings?.scrollTop?.iconColor || '#000000'}
                          onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), iconColor: e.target.value } }))}
                          className="flex-1 bg-transparent text-[10px] font-mono text-gold outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Toasts & Notice Section */}
        <div className="glass p-6 sm:p-8 rounded-2xl border border-white/5 space-y-8 mt-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-display text-gold tracking-tight">Notification Settings</h4>
              <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Shared Toast & Form Notice Customizations</p>
            </div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="p-6 bg-black/20 rounded-2xl border border-white/5 space-y-6">
                <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2 border-b border-white/5 pb-2">
                  <Layout size={12} className="text-gold" />
                  Layout & Display
                </label>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Desktop Pos.</span>
                    <select
                      value={floatingSettings?.toast?.position?.desktop || 'top-right'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), position: { ...(prev?.toast?.position || {}), desktop: e.target.value } } }))}
                      className="custom-select w-full"
                    >
                      <option value="top-right">Top Right</option>
                      <option value="top-left">Top Left</option>
                      <option value="top-center">Top Center</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                      <option value="bottom-center">Bottom Center</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Mobile Pos.</span>
                    <select
                      value={floatingSettings?.toast?.position?.mobile || 'top-center'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), position: { ...(prev?.toast?.position || {}), mobile: e.target.value } } }))}
                      className="custom-select w-full"
                    >
                      <option value="top-right">Top Right</option>
                      <option value="top-center">Top Center</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-center">Bottom Center</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Desktop Width</span>
                    <select
                      value={floatingSettings?.toast?.width?.desktop || 'auto'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), width: { ...(prev?.toast?.width || {}), desktop: e.target.value } } }))}
                      className="custom-select w-full"
                    >
                      <option value="auto">Auto (Content)</option>
                      <option value="full-margin">Full width of Device</option>
                      <option value="300px">Fixed 300px</option>
                      <option value="400px">Fixed 400px</option>
                      <option value="33.3%">1/3 Screen</option>
                      <option value="50%">1/2 Screen</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Mobile Width</span>
                    <select
                      value={floatingSettings?.toast?.width?.mobile || 'full-margin'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), width: { ...(prev?.toast?.width || {}), mobile: e.target.value } } }))}
                      className="custom-select w-full"
                    >
                      <option value="auto">Auto (Content)</option>
                      <option value="full-margin">Full width of Device</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Desktop Anim.</span>
                    <select
                      value={floatingSettings?.toast?.animation?.desktop || 'fade-slide'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), animation: { ...(prev?.toast?.animation || {}), desktop: e.target.value } } }))}
                      className="custom-select w-full"
                    >
                      <option value="fade">Fade</option>
                      <option value="fade-slide">Fade & Slide</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Mobile Anim.</span>
                    <select
                      value={floatingSettings?.toast?.animation?.mobile || 'fade-slide'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), animation: { ...(prev?.toast?.animation || {}), mobile: e.target.value } } }))}
                      className="custom-select w-full"
                    >
                      <option value="fade">Fade</option>
                      <option value="fade-slide">Fade & Slide</option>
                      <option value="zoom">Zoom</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Entry Direction</span>
                    <select
                      value={floatingSettings?.toast?.entryDirection || 'bottom'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), entryDirection: e.target.value } }))}
                      className="custom-select w-full"
                    >
                      <option value="bottom">From Bottom</option>
                      <option value="top">From Top</option>
                      <option value="left">From Left</option>
                      <option value="right">From Right</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Exit Direction</span>
                    <select
                      value={floatingSettings?.toast?.exitDirection || 'top'}
                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), exitDirection: e.target.value } }))}
                      className="custom-select w-full"
                    >
                      <option value="bottom">To Bottom</option>
                      <option value="top">To Top</option>
                      <option value="left">To Left</option>
                      <option value="right">To Right</option>
                    </select>
                  </div>
                </div>

                {/* Dimensions & Timing Sub-Card Grid */}
                <div className="pt-4 border-t border-white/5 space-y-4">
                  <span className="text-[10px] text-gold/60 uppercase font-black tracking-widest block">Dimensions & Timing Controls</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Offset Margin (px)</span>
                      <input
                        type="number"
                        step="4"
                        value={floatingSettings?.toast?.offset || 16}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), offset: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold focus:bg-white/[0.08] text-white/80 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Padding Inside (px)</span>
                      <input
                        type="number"
                        step="4"
                        value={floatingSettings?.toast?.padding || 16}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), padding: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold focus:bg-white/[0.08] text-white/80 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Animation Speed (s)</span>
                      <input
                        type="number"
                        step="0.1"
                        value={floatingSettings?.toast?.animationSpeed || 1}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), animationSpeed: parseFloat(e.target.value) || 0 } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold focus:bg-white/[0.08] text-white/80 transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Auto Close (ms)</span>
                      <input
                        type="number"
                        step="500"
                        value={floatingSettings?.toast?.autoCloseDuration || 5000}
                        onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), autoCloseDuration: parseInt(e.target.value) || 0 } }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold focus:bg-white/[0.08] text-white/80 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-black/20 rounded-2xl border border-white/5 space-y-6">
                <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2 border-b border-white/5 pb-2">
                  <Palette size={12} className="text-gold" />
                  Style & Colors
                </label>

                {/* Border Accent Colors group */}
                <div className="space-y-3">
                  <span className="text-[10px] text-white/40 uppercase font-black tracking-widest block border-b border-white/5 pb-1">Border Accent Colors</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'default', label: 'Default' },
                      { id: 'success', label: 'Success' },
                      { id: 'error', label: 'Error' },
                    ].map(item => (
                      <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col items-center gap-2 text-center">
                        <span className="text-[9px] text-white/50 uppercase font-bold tracking-wider">{item.label}</span>
                        <div className="relative w-full h-8 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center group cursor-pointer hover:border-white/25 transition-colors">
                          <input 
                            type="color" 
                            value={floatingSettings?.toast?.colors?.[item.id] || '#D4AF37'} 
                            onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), colors: { ...(prev?.toast?.colors || {}), [item.id]: e.target.value } } }))} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          />
                          <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: floatingSettings?.toast?.colors?.[item.id] || '#D4AF37' }} />
                        </div>
                        <span className="text-[9px] font-mono uppercase text-white/40">{floatingSettings?.toast?.colors?.[item.id] || '#D4AF37'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Background Colors group */}
                <div className="space-y-3">
                  <span className="text-[10px] text-white/40 uppercase font-black tracking-widest block border-b border-white/5 pb-1">Background Colors</span>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'default', label: 'Default' },
                      { id: 'success', label: 'Success' },
                      { id: 'error', label: 'Error' },
                    ].map(item => (
                      <div key={item.id} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col items-center gap-2 text-center">
                        <span className="text-[9px] text-white/50 uppercase font-bold tracking-wider">{item.label}</span>
                        <div className="relative w-full h-8 rounded-lg overflow-hidden border border-white/10 bg-black/40 flex items-center justify-center group cursor-pointer hover:border-white/25 transition-colors">
                          <input 
                            type="color" 
                            value={floatingSettings?.toast?.bgColors?.[item.id] || '#000000'} 
                            onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, toast: { ...(prev?.toast || {}), bgColors: { ...(prev?.toast?.bgColors || {}), [item.id]: e.target.value } } }))} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                          />
                          <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: floatingSettings?.toast?.bgColors?.[item.id] || '#000000' }} />
                        </div>
                        <span className="text-[9px] font-mono uppercase text-white/40">{floatingSettings?.toast?.bgColors?.[item.id] || '#000000'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Promo Bars Area */}
        <div className="space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row items-center md:justify-between group transition-all">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 px-2">
                <div className="w-1.5 h-8 bg-gold/50 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]" />
                <div>
                  <h4 className="text-xl font-display text-white tracking-tight">Promo Bars</h4>
                  <p className="text-[9px] uppercase tracking-[0.2em] font-black text-gold">
                    Create a new floating bar for sales or news
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bars Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(floatingSettings?.bars || []).map((bar: any, bIdx: number) => {
              const today = new Date().toISOString().split('T')[0];
              const isExpired = bar.endDate && bar.endDate < today;
              const isUpcoming = bar.startDate && bar.startDate > today;
              const isWithinDate = (!bar.startDate || bar.startDate <= today) && (!bar.endDate || bar.endDate >= today);

              return (
                <div key={`mgmt-bar-${bar.id || bIdx}`} className="glass p-6 rounded-2xl border border-white/5 space-y-4 relative group hover:border-gold/20 transition-all">
                  <div className="flex justify-between items-start w-full">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-display text-white group-hover:text-gold transition-colors">
                          {bar.name || `Bar #${bIdx + 1}`}
                        </h4>
                        {bar.active && isWithinDate && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded border border-emerald-500/20">
                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            Live
                          </span>
                        )}
                        {!bar.active && (
                          <span className="px-1.5 py-0.5 bg-white/5 text-white/30 text-[8px] font-black uppercase rounded border border-white/10">
                            Inactive
                          </span>
                        )}
                        {bar.active && isExpired && (
                          <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] font-black uppercase rounded border border-red-500/20">
                            Expired
                          </span>
                        )}
                        {bar.active && isUpcoming && (
                          <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase rounded border border-blue-500/20">
                            Scheduled
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/40 line-clamp-1 max-w-[200px]">
                        {bar.content?.replace(/<[^>]*>?/gm, '')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setEditingBarIndex(bIdx);
                          setShowBarModal(true);
                        }}
                        className="p-1.5 bg-white/5 hover:bg-blue-500/10 text-white/40 hover:text-blue-500 rounded transition-all"
                        title="Edit Bar"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          const duplicated = {
                            ...bar,
                            id: `bar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                            name: `${bar.name || 'Bar'} (Copy)`
                          };
                          setFloatingSettings((prev: any) => {
                            const newBars = [...(prev.bars || [])];
                            newBars.splice(bIdx + 1, 0, duplicated);
                            return { ...prev, bars: newBars };
                          });
                        }}
                        className="p-1.5 bg-white/5 hover:bg-gold/10 text-white/40 hover:text-gold rounded transition-all"
                        title="Duplicate"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setFloatingSettings((prev: any) => ({
                            ...prev,
                            bars: (prev.bars || []).filter((_: any, i: number) => i !== bIdx)
                          }));
                        }}
                        className="p-1.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded transition-all"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-3 mt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: bar.bgType === 'gradient' ? '#D4AF37' : (bar.bgColor || '#D4AF37') }} />
                          <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold">{bar.bgType || 'solid'}</span>
                        </div>
                        <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest">
                          {bar.position === 'top' ? 'Header' : 'Footer'}
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[9px] uppercase font-bold text-white/20 tracking-widest">Enabled</span>
                        <div className={cn("w-8 h-4 rounded-full transition-all relative", bar.active ? "bg-emerald-500" : "bg-white/10")}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={bar.active || false}
                            onChange={(e) => {
                              setFloatingSettings((prev: any) => {
                                const newBars = [...(prev.bars || [])];
                                newBars[bIdx].active = e.target.checked;
                                return { ...prev, bars: newBars };
                              });
                            }}
                          />
                          <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", bar.active ? "right-0.5" : "left-0.5")} />
                        </div>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-white/30 font-bold uppercase tracking-widest bg-black/20 p-2 rounded-lg border border-white/5">
                      <div className="flex items-center gap-1.5" title="Visibility Rule">
                        <Eye size={10} className="text-white/40" />
                        {bar.displayCondition === 'all' ? 'Everywhere' : bar.displayCondition === 'landing' ? 'Home' : bar.displayCondition === 'specific' ? 'Specific Pages' : 'Excluded Pages'}
                      </div>
                      <div className="flex items-center gap-1.5" title="Available Dates">
                        <Calendar size={10} className="text-white/40" />
                        {(!bar.startDate && !bar.endDate) ? 'Always Available' : `${bar.startDate || 'Any'} to ${bar.endDate || 'Any'}`}
                      </div>
                      <div className="flex items-center gap-1.5" title="Display Timing">
                        <Clock size={10} className="text-white/40" />
                        Wait <span className="text-gold">{bar.delay || 0}ms</span>
                        {bar.autoCloseTime > 0 && <span className="text-white/20 mx-1">•</span>}
                        {bar.autoCloseTime > 0 && <span>Close <span className="text-gold">{bar.autoCloseTime}s</span></span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => {
                const newBar = {
                  id: `bar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: "New Promo Bar",
                  active: true,
                  content: "New Promo Bar",
                  promoCode: "",
                  bgColor: "#D4AF37",
                  bgType: "solid",
                  bgGradient: "linear-gradient(90deg, #D4AF37, #F1D483)",
                  textColor: "#000000",
                  promoColor: "#000000",
                  promoBg: "rgba(0,0,0,0.1)",
                  closeColor: "#000000",
                  position: "top",
                  showClose: true,
                  animation: "marquee",
                  marqueeSpeed: 20,
                  delay: 0,
                  autoCloseTime: 0,
                  startDate: "",
                  endDate: "",
                  displayCondition: "all",
                  specificPages: [],
                  exceptPages: [],
                  ctaText: "",
                  ctaLink: ""
                };
                setFloatingSettings((prev: any) => ({
                  ...prev,
                  bars: [...(prev.bars || []), newBar]
                }));
                setEditingBarIndex((floatingSettings?.bars || []).length);
                setShowBarModal(true);
              }}
              className="glass p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-gold hover:bg-gold/5 flex flex-col items-center justify-center gap-3 transition-all min-h-[140px] h-full w-full text-white/50 hover:text-gold group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-gold/20 flex items-center justify-center transition-colors">
                <Plus size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Add Promo Bar</span>
            </button>
          </div>

          {/* Popups Management Header */}
          <div className="flex flex-col md:flex-row md:items-center md:gap-6 px-2 pt-8">
            {/* Info Block */}
            <div className="flex items-center gap-4 mb-4 md:mb-0">
              <div className="w-1.5 h-8 bg-gold/50 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]" />
              <div>
                <h4 className="text-xl font-display text-white tracking-tight">
                  Floating Popups
                </h4>
                <p className="text-[9px] uppercase tracking-[0.2em] font-black text-gold/40">
                  Targeted popups for sales, offers or news
                </p>
              </div>
            </div>
          </div>

          {/* Popups Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(floatingSettings?.popups || []).map((popup: any, pIdx: number) => {
              const today = new Date().toISOString().split('T')[0];
              const isExpired = popup.endDate && popup.endDate < today;
              const isWithinDate = (!popup.startDate || popup.startDate <= today) && (!popup.endDate || popup.endDate >= today);

              return (
                <div key={`mgmt-popup-${popup.id || pIdx}`} className="glass p-6 rounded-2xl border border-white/5 space-y-4 relative group hover:border-gold/20 transition-all">
                  <div className="flex justify-between items-start w-full">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-display text-white group-hover:text-gold transition-colors">
                          {popup.name || `Popup #${pIdx + 1}`}
                        </h4>
                        {popup.active && isWithinDate && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded border border-emerald-500/20">
                            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                            Live
                          </span>
                        )}
                        {popup.active && isExpired && (
                          <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] font-black uppercase rounded border border-red-500/20">
                            Expired
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                        Type: {popup.type} • {popup.position}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { setEditingPopupIndex(pIdx); setShowPopupModal(true); }}
                        className="p-1.5 bg-white/5 hover:bg-blue-500/10 text-white/40 hover:text-blue-500 rounded transition-all"
                        title="Edit Popup"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => {
                          const clonedPopup = {
                            ...popup,
                            id: Math.random().toString(36).substr(2, 9),
                            name: `${popup.name || 'Popup'} (Copy)`,
                            active: false
                          };
                          setFloatingSettings((prev: any) => ({
                            ...prev,
                            popups: [...(prev.popups || []), clonedPopup]
                          }));
                        }}
                        className="p-1.5 bg-white/5 hover:bg-gold/10 text-white/40 hover:text-gold rounded transition-all"
                        title="Duplicate Popup"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setFloatingSettings((prev: any) => ({
                            ...prev,
                            popups: (prev.popups || []).filter((_: any, i: number) => i !== pIdx)
                          }));
                        }}
                        className="p-1.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded transition-all"
                        title="Delete Popup"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-3 mt-2 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest">
                          Animation: {popup.animation}
                        </div>
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <span className="text-[9px] uppercase font-bold text-white/20 tracking-widest">Enabled</span>
                        <div className={cn("w-8 h-4 rounded-full transition-all relative", popup.active ? "bg-gold" : "bg-white/10")}>
                          <input
                            type="checkbox"
                            className="hidden"
                            checked={popup.active || false}
                            onChange={(e) => {
                              setFloatingSettings((prev: any) => {
                                const newPopups = [...(prev.popups || [])];
                                newPopups[pIdx].active = e.target.checked;
                                return { ...prev, popups: newPopups };
                              });
                            }}
                          />
                          <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", popup.active ? "right-0.5" : "left-0.5")} />
                        </div>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-white/30 font-bold uppercase tracking-widest bg-black/20 p-2 rounded-lg border border-white/5">
                      <div className="flex items-center gap-1.5" title="Visibility Rule">
                        <Eye size={10} className="text-white/40" />
                        {popup.displayCondition === 'all' ? 'Everywhere' : popup.displayCondition === 'landing' ? 'Home' : popup.displayCondition === 'specific' ? 'Specific Pages' : 'Excluded Pages'}
                      </div>
                      <div className="flex items-center gap-1.5" title="Available Dates">
                        <Calendar size={10} className="text-white/40" />
                        {(!popup.startDate && !popup.endDate) ? 'Always Available' : `${popup.startDate || 'Any'} to ${popup.endDate || 'Any'}`}
                      </div>
                      <div className="flex items-center gap-1.5" title="Display Timing">
                        <Clock size={10} className="text-white/40" />
                        Wait <span className="text-gold">{popup.delay || 0}ms</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <button
              onClick={() => {
                const newPopup = {
                  id: `popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  name: "New Promo Popup",
                  type: "sales",
                  active: true,
                  title: "Summer Offer",
                  subtitle: "Limited Time Only",
                  details: "Get exclusive access to our luxury fleet with 15% discount.",
                  promoCode: "SUMMER15",
                  ctaText: "Get Offer",
                  ctaLink: "/offers",
                  bgType: "gradient",
                  bgGradient: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
                  textColor: "#FFFFFF",
                  accentColor: "#D4AF37",
                  position: "center",
                  animation: "scale",
                  delay: 2000,
                  displayCondition: "all"
                };
                setFloatingSettings((prev: any) => ({
                  ...prev,
                  popups: [...(prev.popups || []), newPopup]
                }));
                setEditingPopupIndex((floatingSettings?.popups || []).length);
                setShowPopupModal(true);
              }}
              className="glass p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-gold hover:bg-gold/5 flex flex-col items-center justify-center gap-3 transition-all min-h-[140px] h-full w-full text-white/50 hover:text-gold group cursor-pointer"
            >
              <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-gold/20 flex items-center justify-center transition-colors">
                <Plus size={24} />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest">Add Popup</span>
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {/* Floating Bar Modal */}
        {showBarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-display text-gold">
                    {editingBarIndex !== null ? 'Configure Floating Bar' : 'New Dynamic Segment'}
                  </h3>
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Visualizer & Real-time configuration</p>
                </div>
                <button onClick={() => setShowBarModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {(() => {
                const bar = editingBarIndex !== null ? floatingSettings?.bars?.[editingBarIndex] : null;
                if (!bar) return null;

                return (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Internal Reference / Label</label>
                        <input
                          type="text"
                          value={bar.name || bar.label || ''}
                          onChange={(e) => {
                            const newItems = [...(floatingSettings?.bars || [])];
                            newItems[editingBarIndex as number].name = e.target.value;
                            setFloatingSettings({ ...floatingSettings, bars: newItems });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Display Text Content (HTML Allowed)</label>
                        <textarea
                          value={bar.content || ''}
                          onChange={(e) => {
                            const newItems = [...(floatingSettings?.bars || [])];
                            newItems[editingBarIndex as number].content = e.target.value;
                            setFloatingSettings({ ...floatingSettings, bars: newItems });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24 resize-none"
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gold/60">Color Logic & Style</label>
                        <div 
                          className="w-8 h-4 rounded border border-white/10" 
                          style={{ 
                            background: bar.bgType === 'gradient' 
                              ? (bar.bgGradient || 'linear-gradient(90deg, #D4AF37, #F1D483)') 
                              : (bar.bgColor || '#D4AF37') 
                          }} 
                        />
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Background Style Type</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = [...(floatingSettings?.bars || [])];
                                newItems[editingBarIndex as number].bgType = 'solid';
                                setFloatingSettings({ ...floatingSettings, bars: newItems });
                              }}
                              className={cn(
                                "py-1.5 px-3 rounded-lg text-xs font-bold border transition-all",
                                (bar.bgType !== 'gradient') 
                                  ? "bg-gold text-black border-gold" 
                                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                              )}
                            >
                              Solid Color
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = [...(floatingSettings?.bars || [])];
                                newItems[editingBarIndex as number].bgType = 'gradient';
                                if (!newItems[editingBarIndex as number].bgGradient) {
                                  newItems[editingBarIndex as number].bgGradient = 'linear-gradient(90deg, #D4AF37, #F1D483)';
                                }
                                setFloatingSettings({ ...floatingSettings, bars: newItems });
                              }}
                              className={cn(
                                "py-1.5 px-3 rounded-lg text-xs font-bold border transition-all",
                                (bar.bgType === 'gradient') 
                                  ? "bg-gold text-black border-gold" 
                                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                              )}
                            >
                              Gradient Color Set
                            </button>
                          </div>
                        </div>

                        {bar.bgType === 'gradient' ? (
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[8px] uppercase tracking-widest text-white/30 mb-1 block">Gradient Color 1</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={bar.gradientColor1 || '#D4AF37'}
                                    onChange={(e) => {
                                      const newItems = [...(floatingSettings?.bars || [])];
                                      const b = newItems[editingBarIndex as number];
                                      b.gradientColor1 = e.target.value;
                                      const c1 = b.gradientColor1 || '#D4AF37';
                                      const c2 = b.gradientColor2 || '#F1D483';
                                      const ang = b.gradientAngle || '90';
                                      b.bgGradient = `linear-gradient(${ang}deg, ${c1} 0%, ${c2} 100%)`;
                                      setFloatingSettings({ ...floatingSettings, bars: newItems });
                                    }}
                                    className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                                  />
                                  <span className="text-[10px] font-mono uppercase text-white/50">{bar.gradientColor1 || '#D4AF37'}</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-[8px] uppercase tracking-widest text-white/30 mb-1 block">Gradient Color 2</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={bar.gradientColor2 || '#F1D483'}
                                    onChange={(e) => {
                                      const newItems = [...(floatingSettings?.bars || [])];
                                      const b = newItems[editingBarIndex as number];
                                      b.gradientColor2 = e.target.value;
                                      const c1 = b.gradientColor1 || '#D4AF37';
                                      const c2 = b.gradientColor2 || '#F1D483';
                                      const ang = b.gradientAngle || '90';
                                      b.bgGradient = `linear-gradient(${ang}deg, ${c1} 0%, ${c2} 100%)`;
                                      setFloatingSettings({ ...floatingSettings, bars: newItems });
                                    }}
                                    className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                                  />
                                  <span className="text-[10px] font-mono uppercase text-white/50">{bar.gradientColor2 || '#F1D483'}</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[8px] uppercase tracking-widest text-white/30 mb-1 block">Gradient Direction / Angle</label>
                              <select
                                value={bar.gradientAngle || '90'}
                                onChange={(e) => {
                                  const newItems = [...(floatingSettings?.bars || [])];
                                  const b = newItems[editingBarIndex as number];
                                  b.gradientAngle = e.target.value;
                                  const c1 = b.gradientColor1 || '#D4AF37';
                                  const c2 = b.gradientColor2 || '#F1D483';
                                  const ang = b.gradientAngle || '90';
                                  b.bgGradient = `linear-gradient(${ang}deg, ${c1} 0%, ${c2} 100%)`;
                                  setFloatingSettings({ ...floatingSettings, bars: newItems });
                                }}
                                className="custom-select w-full py-1 text-[10px]"
                              >
                                <option value="90">Left to Right (90°)</option>
                                <option value="135">Diagonal Top-Left (135°)</option>
                                <option value="45">Diagonal Bottom-Left (45°)</option>
                                <option value="180">Top to Bottom (180°)</option>
                                <option value="270">Right to Left (270°)</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-[8px] uppercase tracking-widest text-white/20 mb-1 block">Solid Background Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={bar.bgColor || '#D4AF37'}
                                onChange={(e) => {
                                  const newItems = [...(floatingSettings?.bars || [])];
                                  newItems[editingBarIndex as number].bgColor = e.target.value;
                                  setFloatingSettings({ ...floatingSettings, bars: newItems });
                                }}
                                className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                              />
                              <span className="text-[10px] font-mono uppercase text-white/50">{bar.bgColor || '#D4AF37'}</span>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-[8px] uppercase tracking-widest text-white/20 mb-1 block">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={bar.textColor || '#000000'}
                              onChange={(e) => {
                                const newItems = [...(floatingSettings?.bars || [])];
                                newItems[editingBarIndex as number].textColor = e.target.value;
                                setFloatingSettings({ ...floatingSettings, bars: newItems });
                              }}
                              className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                            />
                            <span className="text-[10px] font-mono uppercase text-white/50">{bar.textColor || '#000000'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Targeting & Display Rules */}
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                      <h4 className="text-xs font-display text-gold uppercase tracking-wider border-b border-white/5 pb-2">Targeting & Display Rules</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Display Position</label>
                          <select
                            value={bar.position || 'top'}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.bars || [])];
                              newItems[editingBarIndex as number].position = e.target.value;
                              setFloatingSettings({ ...floatingSettings, bars: newItems });
                            }}
                            className="custom-select w-full py-2 px-3 text-xs"
                          >
                            <option value="top">Header (Top)</option>
                            <option value="bottom">Footer (Bottom)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Page Targeting</label>
                          <select
                            value={bar.displayCondition || 'all'}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.bars || [])];
                              newItems[editingBarIndex as number].displayCondition = e.target.value;
                              setFloatingSettings({ ...floatingSettings, bars: newItems });
                            }}
                            className="custom-select w-full py-2 px-3 text-xs"
                          >
                            <option value="all">All Pages</option>
                            <option value="landing">Home/Landing Only</option>
                            <option value="specific">Specific Pages</option>
                            <option value="except">All Except Pages</option>
                          </select>
                        </div>
                      </div>

                      {/* Specific/Except pages inputs */}
                      {(bar.displayCondition === 'specific' || bar.displayCondition === 'except') && (
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                            {bar.displayCondition === 'specific' ? 'Target Pages' : 'Excluded Pages'} (Comma-separated, e.g. /, /blog, /booking)
                          </label>
                          <input
                            type="text"
                            placeholder="/blog, /services, /booking"
                            value={
                              bar.displayCondition === 'specific' 
                                ? (bar.specificPages || []).join(', ') 
                                : (bar.exceptPages || []).join(', ')
                            }
                            onChange={(e) => {
                              const pages = e.target.value.split(',').map(p => p.trim()).filter(p => p.length > 0);
                              const newItems = [...(floatingSettings?.bars || [])];
                              if (bar.displayCondition === 'specific') {
                                newItems[editingBarIndex as number].specificPages = pages;
                              } else {
                                newItems[editingBarIndex as number].exceptPages = pages;
                              }
                              setFloatingSettings({ ...floatingSettings, bars: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all"
                          />
                        </div>
                      )}

                      {/* Timing rules: waiting delay and display auto close duration */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Waiting Delay (ms)</label>
                          <input
                            type="number"
                            step="500"
                            placeholder="0 (Immediate)"
                            value={bar.delay ?? 0}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.bars || [])];
                              newItems[editingBarIndex as number].delay = parseInt(e.target.value) || 0;
                              setFloatingSettings({ ...floatingSettings, bars: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Display Duration (ms)</label>
                          <input
                            type="number"
                            step="500"
                            placeholder="0 (Keep forever)"
                            value={bar.autoCloseTime ?? 0}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.bars || [])];
                              newItems[editingBarIndex as number].autoCloseTime = parseInt(e.target.value) || 0;
                              setFloatingSettings({ ...floatingSettings, bars: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all"
                          />
                        </div>
                      </div>

                      {/* Active Date Range Validity */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Valid From Date</label>
                          <input
                            type="datetime-local"
                            value={bar.startDate || ''}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.bars || [])];
                              newItems[editingBarIndex as number].startDate = e.target.value;
                              setFloatingSettings({ ...floatingSettings, bars: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/60 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Valid Until Date</label>
                          <input
                            type="datetime-local"
                            value={bar.endDate || ''}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.bars || [])];
                              newItems[editingBarIndex as number].endDate = e.target.value;
                              setFloatingSettings({ ...floatingSettings, bars: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/60 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Countdown Target</label>
                        <input
                          type="datetime-local"
                          value={bar.countdownTarget || ''}
                          onChange={(e) => {
                            const newItems = [...(floatingSettings?.bars || [])];
                            newItems[editingBarIndex as number].countdownTarget = e.target.value;
                            setFloatingSettings({ ...floatingSettings, bars: newItems });
                          }}
                          className="w-full bg-black/20 border border-white/5 rounded-lg px-2 py-2 text-[10px] text-white/60 outline-none focus:border-gold transition-colors"
                        />
                        <p className="text-[9px] text-white/30 mt-2 leading-relaxed">
                          Select a target date & time (e.g., for a flash sale or private event). A premium live countdown clock (e.g., <strong>2d 04h 15m 30s</strong>) will automatically display next to your promo content.
                        </p>
                      </div>
                      <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">Status</label>
                          <p className="text-[8px] text-white/20 uppercase tracking-widest">Active Bar</p>
                        </div>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div className={cn("w-10 h-5 rounded-full transition-all relative", bar.active ? "bg-gold" : "bg-white/10")}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={bar.active}
                              onChange={(e) => {
                                const newItems = [...(floatingSettings?.bars || [])];
                                newItems[editingBarIndex as number].active = e.target.checked;
                                setFloatingSettings({ ...floatingSettings, bars: newItems });
                              }}
                            />
                            <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all", bar.active ? "right-1" : "left-1")} />
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <button
                        onClick={() => setShowBarModal(false)}
                        className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-xl text-white/40 hover:text-white transition-all shadow-xl"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowBarModal(false)}
                        className="flex-1 bg-gold text-black py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl"
                      >
                        Confirm Configuration
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}

        {/* Popup Modal */}
        {showPopupModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-display text-gold">
                    {editingPopupIndex !== null ? 'Configure Modal Popup' : 'New Engagement Popup'}
                  </h3>
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Refine conversion & engagement rules</p>
                </div>
                <button onClick={() => setShowPopupModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              {(() => {
                const popup = editingPopupIndex !== null ? floatingSettings?.popups?.[editingPopupIndex] : null;
                if (!popup) return null;

                return (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Title Heading</label>
                        <input
                          type="text"
                          value={popup.title || ''}
                          onChange={(e) => {
                            const newItems = [...(floatingSettings?.popups || [])];
                            newItems[editingPopupIndex as number].title = e.target.value;
                            setFloatingSettings({ ...floatingSettings, popups: newItems });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Body Text / HTML</label>
                        <textarea
                          value={popup.content || ''}
                          onChange={(e) => {
                            const newItems = [...(floatingSettings?.popups || [])];
                            newItems[editingPopupIndex as number].content = e.target.value;
                            setFloatingSettings({ ...floatingSettings, popups: newItems });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-32 resize-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Primary Action Button</label>
                        <input
                          type="text"
                          value={popup.ctaText || popup.buttonText || ''}
                          onChange={(e) => {
                            const newItems = [...(floatingSettings?.popups || [])];
                            newItems[editingPopupIndex as number].ctaText = e.target.value;
                            setFloatingSettings({ ...floatingSettings, popups: newItems });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs"
                          placeholder="Button Label..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Link Target</label>
                        <input
                          type="text"
                          value={popup.ctaLink || popup.buttonLink || ''}
                          onChange={(e) => {
                            const newItems = [...(floatingSettings?.popups || [])];
                            newItems[editingPopupIndex as number].ctaLink = e.target.value;
                            setFloatingSettings({ ...floatingSettings, popups: newItems });
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs"
                          placeholder="/offer/exclusive..."
                        />
                      </div>
                    </div>

                    {/* Popup Background & Color Style Card */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-gold/60">Popup Background & Text Style</label>
                        <div 
                          className="w-8 h-4 rounded border border-white/10" 
                          style={{ 
                            background: popup.bgType === 'gradient' 
                              ? (popup.bgGradient || 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)') 
                              : (popup.bgColor || '#1a1a1a') 
                          }} 
                        />
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Background Style Type</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = [...(floatingSettings?.popups || [])];
                                newItems[editingPopupIndex as number].bgType = 'solid';
                                setFloatingSettings({ ...floatingSettings, popups: newItems });
                              }}
                              className={cn(
                                "py-1.5 px-3 rounded-lg text-xs font-bold border transition-all",
                                (popup.bgType !== 'gradient') 
                                  ? "bg-gold text-black border-gold" 
                                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                              )}
                            >
                              Solid Color
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = [...(floatingSettings?.popups || [])];
                                newItems[editingPopupIndex as number].bgType = 'gradient';
                                if (!newItems[editingPopupIndex as number].bgGradient) {
                                  newItems[editingPopupIndex as number].bgGradient = 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)';
                                }
                                setFloatingSettings({ ...floatingSettings, popups: newItems });
                              }}
                              className={cn(
                                "py-1.5 px-3 rounded-lg text-xs font-bold border transition-all",
                                (popup.bgType === 'gradient') 
                                  ? "bg-gold text-black border-gold" 
                                  : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10"
                              )}
                            >
                              Gradient Color Set
                            </button>
                          </div>
                        </div>

                        {popup.bgType === 'gradient' ? (
                          <div className="p-3 bg-white/[0.01] border border-white/5 rounded-xl space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[8px] uppercase tracking-widest text-white/30 mb-1 block">Gradient Color 1</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={popup.gradientColor1 || '#1a1a1a'}
                                    onChange={(e) => {
                                      const newItems = [...(floatingSettings?.popups || [])];
                                      const p = newItems[editingPopupIndex as number];
                                      p.gradientColor1 = e.target.value;
                                      const c1 = p.gradientColor1 || '#1a1a1a';
                                      const c2 = p.gradientColor2 || '#2a2a2a';
                                      const ang = p.gradientAngle || '135';
                                      p.bgGradient = `linear-gradient(${ang}deg, ${c1} 0%, ${c2} 100%)`;
                                      setFloatingSettings({ ...floatingSettings, popups: newItems });
                                    }}
                                    className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                                  />
                                  <span className="text-[10px] font-mono uppercase text-white/50">{popup.gradientColor1 || '#1a1a1a'}</span>
                                </div>
                              </div>
                              <div>
                                <label className="text-[8px] uppercase tracking-widest text-white/30 mb-1 block">Gradient Color 2</label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={popup.gradientColor2 || '#2a2a2a'}
                                    onChange={(e) => {
                                      const newItems = [...(floatingSettings?.popups || [])];
                                      const p = newItems[editingPopupIndex as number];
                                      p.gradientColor2 = e.target.value;
                                      const c1 = p.gradientColor1 || '#1a1a1a';
                                      const c2 = p.gradientColor2 || '#2a2a2a';
                                      const ang = p.gradientAngle || '135';
                                      p.bgGradient = `linear-gradient(${ang}deg, ${c1} 0%, ${c2} 100%)`;
                                      setFloatingSettings({ ...floatingSettings, popups: newItems });
                                    }}
                                    className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                                  />
                                  <span className="text-[10px] font-mono uppercase text-white/50">{popup.gradientColor2 || '#2a2a2a'}</span>
                                </div>
                              </div>
                            </div>

                            <div>
                              <label className="text-[8px] uppercase tracking-widest text-white/30 mb-1 block">Gradient Direction / Angle</label>
                              <select
                                value={popup.gradientAngle || '135'}
                                onChange={(e) => {
                                  const newItems = [...(floatingSettings?.popups || [])];
                                  const p = newItems[editingPopupIndex as number];
                                  p.gradientAngle = e.target.value;
                                  const c1 = p.gradientColor1 || '#1a1a1a';
                                  const c2 = p.gradientColor2 || '#2a2a2a';
                                  const ang = p.gradientAngle || '135';
                                  p.bgGradient = `linear-gradient(${ang}deg, ${c1} 0%, ${c2} 100%)`;
                                  setFloatingSettings({ ...floatingSettings, popups: newItems });
                                }}
                                className="custom-select w-full py-1 text-[10px]"
                              >
                                <option value="135">Diagonal Top-Left (135°)</option>
                                <option value="45">Diagonal Bottom-Left (45°)</option>
                                <option value="90">Left to Right (90°)</option>
                                <option value="180">Top to Bottom (180°)</option>
                                <option value="270">Right to Left (270°)</option>
                              </select>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="text-[8px] uppercase tracking-widest text-white/20 mb-1 block">Solid Background Color</label>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={popup.bgColor || '#1a1a1a'}
                                onChange={(e) => {
                                  const newItems = [...(floatingSettings?.popups || [])];
                                  newItems[editingPopupIndex as number].bgColor = e.target.value;
                                  setFloatingSettings({ ...floatingSettings, popups: newItems });
                                }}
                                className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                              />
                              <span className="text-[10px] font-mono uppercase text-white/50">{popup.bgColor || '#1a1a1a'}</span>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-[8px] uppercase tracking-widest text-white/20 mb-1 block">Text Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={popup.textColor || '#FFFFFF'}
                              onChange={(e) => {
                                const newItems = [...(floatingSettings?.popups || [])];
                                newItems[editingPopupIndex as number].textColor = e.target.value;
                                setFloatingSettings({ ...floatingSettings, popups: newItems });
                              }}
                              className="w-8 h-8 bg-transparent cursor-pointer border-none p-0 shrink-0"
                            />
                            <span className="text-[10px] font-mono uppercase text-white/50">{popup.textColor || '#FFFFFF'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Targeting & Timing Controls */}
                    <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl space-y-4">
                      <h4 className="text-xs font-display text-gold uppercase tracking-wider border-b border-white/5 pb-2">Targeting & Timing Rules</h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Display Position</label>
                          <select
                            value={popup.position || 'center'}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.popups || [])];
                              newItems[editingPopupIndex as number].position = e.target.value;
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="custom-select w-full py-2 px-3 text-xs"
                          >
                            <option value="center">Center Modal</option>
                            <option value="bottom-right">Bottom Right Banner</option>
                            <option value="bottom-left">Bottom Left Banner</option>
                            <option value="top-right">Top Right Banner</option>
                            <option value="top-left">Top Left Banner</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Trigger Type</label>
                          <select
                            value={popup.trigger || 'timer'}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.popups || [])];
                              newItems[editingPopupIndex as number].trigger = e.target.value;
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="custom-select w-full py-2 px-3 text-xs"
                          >
                            <option value="timer">Automatic Timer</option>
                            <option value="exit">Exit Intent Detection</option>
                            <option value="scroll">Scroll Percentage</option>
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Page Targeting</label>
                          <select
                            value={popup.displayCondition || 'all'}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.popups || [])];
                              newItems[editingPopupIndex as number].displayCondition = e.target.value;
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="custom-select w-full py-2 px-3 text-xs"
                          >
                            <option value="all">All Pages</option>
                            <option value="landing">Home/Landing Only</option>
                            <option value="specific">Specific Pages</option>
                            <option value="except">All Except Pages</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Waiting Delay (ms)</label>
                          <input
                            type="number"
                            step="500"
                            placeholder="5000"
                            value={popup.delay ?? 5000}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.popups || [])];
                              newItems[editingPopupIndex as number].delay = parseInt(e.target.value) || 0;
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-gold transition-all"
                          />
                        </div>
                      </div>

                      {/* Specific/Except pages inputs */}
                      {(popup.displayCondition === 'specific' || popup.displayCondition === 'except') && (
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                            {popup.displayCondition === 'specific' ? 'Target Pages' : 'Excluded Pages'} (Comma-separated, e.g. /, /blog, /booking)
                          </label>
                          <input
                            type="text"
                            placeholder="/blog, /services, /booking"
                            value={
                              popup.displayCondition === 'specific' 
                                ? (popup.specificPages || []).join(', ') 
                                : (popup.exceptPages || []).join(', ')
                            }
                            onChange={(e) => {
                              const pages = e.target.value.split(',').map(p => p.trim()).filter(p => p.length > 0);
                              const newItems = [...(floatingSettings?.popups || [])];
                              if (popup.displayCondition === 'specific') {
                                newItems[editingPopupIndex as number].specificPages = pages;
                              } else {
                                newItems[editingPopupIndex as number].exceptPages = pages;
                              }
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Display Duration (ms)</label>
                          <input
                            type="number"
                            step="1000"
                            placeholder="0 (Keep forever)"
                            value={popup.autoCloseTime ?? 0}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.popups || [])];
                              newItems[editingPopupIndex as number].autoCloseTime = parseInt(e.target.value) || 0;
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs outline-none focus:border-gold transition-all"
                          />
                          <p className="text-[8px] text-white/20 mt-1">0 to show forever, or auto-close.</p>
                        </div>

                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Accent Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={popup.accentColor || '#D4AF37'}
                              onChange={(e) => {
                                const newItems = [...(floatingSettings?.popups || [])];
                                newItems[editingPopupIndex as number].accentColor = e.target.value;
                                setFloatingSettings({ ...floatingSettings, popups: newItems });
                              }}
                              className="h-8 w-12 bg-transparent cursor-pointer border-none p-0"
                            />
                            <span className="text-xs font-mono uppercase text-white/60">{popup.accentColor || '#D4AF37'}</span>
                          </div>
                        </div>
                      </div>

                      {/* Active Date Range Validity */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Valid From Date</label>
                          <input
                            type="datetime-local"
                            value={popup.startDate || ''}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.popups || [])];
                              newItems[editingPopupIndex as number].startDate = e.target.value;
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/60 outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Valid Until Date</label>
                          <input
                            type="datetime-local"
                            value={popup.endDate || ''}
                            onChange={(e) => {
                              const newItems = [...(floatingSettings?.popups || [])];
                              newItems[editingPopupIndex as number].endDate = e.target.value;
                              setFloatingSettings({ ...floatingSettings, popups: newItems });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white/60 outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">Visual Appearance</label>
                      <div className="flex gap-4">
                        <label className="flex-1 flex items-center gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl cursor-pointer group">
                          <div className={cn("w-10 h-5 rounded-full transition-all relative", popup.active ? "bg-gold" : "bg-white/10")}>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={popup.active}
                              onChange={(e) => {
                                const newItems = [...(floatingSettings?.popups || [])];
                                newItems[editingPopupIndex as number].active = e.target.checked;
                                setFloatingSettings({ ...floatingSettings, popups: newItems });
                              }}
                            />
                            <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all", popup.active ? "right-1" : "left-1")} />
                          </div>
                          <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Active</span>
                        </label>
                      </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                      <button
                        onClick={() => setShowPopupModal(false)}
                        className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-xl text-white/40 hover:text-white transition-all shadow-xl"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => setShowPopupModal(false)}
                        className="flex-1 bg-gold text-black py-4 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-gold/10"
                      >
                        Confirm Configuration
                      </button>
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingTab;
