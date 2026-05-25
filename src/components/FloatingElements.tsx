import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Copy, Check, MessageCircle, Facebook, Instagram, 
  Linkedin, Mail, Phone, ArrowUp, Twitter, Youtube, 
  Globe, Link as LinkIcon, ExternalLink, ChevronUp,
  ArrowUpCircle, MoveUp, Rocket, Gift, Bell, Info, MessageSquare, Tag
} from 'lucide-react';
import { useSettings } from '../lib/SettingsContext';
import { cn } from '../lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';

export default function FloatingElements() {
  const { floatingSettings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [closedBars, setClosedBars] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [closedPopups, setClosedPopups] = useState<string[]>([]);
  const [visiblePopups, setVisiblePopups] = useState<string[]>([]);
  const [visibleBars, setVisibleBars] = useState<string[]>([]);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const { bars = [], social, scrollTop, popups = [] } = floatingSettings || {};
  const activeBars = bars.length > 0 ? bars : (floatingSettings?.bar ? [floatingSettings.bar] : []);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Reset visibility states on path change to trigger reappearance/delays
    setVisiblePopups([]);
    setVisibleBars([]);
    
    // Clear path-specific closes to allow "Every time" reappearance on navigation
    setClosedPopups(prev => prev.filter(id => !id.includes(':')));
    setClosedBars(prev => prev.filter(id => !id.includes(':')));
  }, [location.pathname]);

  useEffect(() => {
    const handleScroll = () => {
      const threshold = scrollTop?.offset || 300;
      setShowScrollTop(window.scrollY > threshold);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollTop?.offset]);

  useEffect(() => {
    if (!floatingSettings) return;

    // Handle Popups
    (floatingSettings.popups || []).forEach((popup: any) => {
      const isCurrentlyVisible = isPopupVisible(popup);
      const isAlreadyInState = visiblePopups.includes(popup.id);

      // Entry Delay
      if (isCurrentlyVisible && !isAlreadyInState && !timers.current[popup.id]) {
        timers.current[popup.id] = setTimeout(() => {
          setVisiblePopups(prev => [...new Set([...prev, popup.id])]);
          delete timers.current[popup.id];
        }, popup.delay || 0);
      }
      
      // Clear if no longer visible
      if (!isCurrentlyVisible) {
        if (timers.current[popup.id]) {
          clearTimeout(timers.current[popup.id]);
          delete timers.current[popup.id];
        }
        if (isAlreadyInState) {
          setVisiblePopups(prev => prev.filter(id => id !== popup.id));
        }
      }
      
      // Auto Close
      const autoCloseKey = `autoclose-${popup.id}`;
      const pathKey = `${popup.id}:${location.pathname}`;
      if (isAlreadyInState && popup.autoCloseTime > 0 && !closedPopups.includes(pathKey) && !closedPopups.includes(popup.id) && !timers.current[autoCloseKey]) {
        timers.current[autoCloseKey] = setTimeout(() => {
          setClosedPopups(prev => [...new Set([...prev, pathKey])]);
          delete timers.current[autoCloseKey];
        }, popup.autoCloseTime);
      }
    });

    // Handle Bars
    const activeBarList = floatingSettings.bars?.length > 0 ? floatingSettings.bars : (floatingSettings.bar ? [floatingSettings.bar] : []);
    
    activeBarList.forEach((bar: any) => {
      const isCurrentlyVisible = isBarVisible(bar);
      const isAlreadyInState = visibleBars.includes(bar.id);

      // Entry Delay
      if (isCurrentlyVisible && !isAlreadyInState && !timers.current[bar.id]) {
        timers.current[bar.id] = setTimeout(() => {
          setVisibleBars(prev => [...new Set([...prev, bar.id])]);
          delete timers.current[bar.id];
        }, bar.delay || 0);
      }
      
      // Clear if no longer visible
      if (!isCurrentlyVisible) {
        if (timers.current[bar.id]) {
          clearTimeout(timers.current[bar.id]);
          delete timers.current[bar.id];
        }
        if (isAlreadyInState) {
          setVisibleBars(prev => prev.filter(id => id !== bar.id));
        }
      }
      
      // Auto Close
      const autoCloseKey = `autoclose-bar-${bar.id}`;
      const pathKey = `${bar.id}:${location.pathname}`;
      if (isAlreadyInState && bar.autoCloseTime > 0 && !closedBars.includes(pathKey) && !closedBars.includes(bar.id) && !timers.current[autoCloseKey]) {
        timers.current[autoCloseKey] = setTimeout(() => {
          setClosedBars(prev => [...new Set([...prev, pathKey])]);
          delete timers.current[autoCloseKey];
        }, bar.autoCloseTime);
      }
    });

  }, [floatingSettings, location.pathname, closedPopups, visiblePopups, closedBars, visibleBars]);

  // Handle unmount cleanup
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(t => clearTimeout(t));
      timers.current = {};
    };
  }, []);

  const normalizePath = (p: string) => {
    if (!p) return '/';
    let normalized = p.trim().toLowerCase();
    if (!normalized.startsWith('/')) normalized = '/' + normalized;
    if (normalized.length > 1 && normalized.endsWith('/')) normalized = normalized.slice(0, -1);
    return normalized || '/';
  };

  function isPopupVisible(popup: any) {
    if (!popup?.active) return false;
    
    // Check if closed globally or for this path
    const pathKey = `${popup.id}:${location.pathname}`;
    if (closedPopups.includes(pathKey) || closedPopups.includes(popup.id)) return false;
    
    // Date validity
    const now = new Date();
    if (popup.startDate && new Date(popup.startDate) > now) return false;
    if (popup.endDate && new Date(popup.endDate) < now) return false;

    // Page conditions
    const currentPath = normalizePath(location.pathname);
    const displayCondition = popup.displayCondition || 'all';
    
    if (displayCondition === 'landing') return currentPath === '/';
    
    if (displayCondition === 'specific') {
      if (!popup.specificPages || popup.specificPages.length === 0) return false;
      return popup.specificPages.some((page: string) => normalizePath(page) === currentPath);
    }

    if (displayCondition === 'except') {
      if (!popup.exceptPages || popup.exceptPages.length === 0) return true;
      return !popup.exceptPages.some((page: string) => normalizePath(page) === currentPath);
    }

    return true;
  }

  const isBarVisible = (bar: any) => {
    if (!bar?.active) return false;

    // Check if closed globally or for this path
    const pathKey = `${bar.id}:${location.pathname}`;
    if (closedBars.includes(pathKey) || closedBars.includes(bar.id)) return false;
    
    // Date validity
    const now = new Date();
    if (bar.startDate && new Date(bar.startDate) > now) return false;
    if (bar.endDate && new Date(bar.endDate) < now) return false;

    // Page conditions
    const currentPath = normalizePath(location.pathname);
    const displayCondition = bar.displayCondition || 'all';
    
    if (displayCondition === 'landing') return currentPath === '/';
    
    if (displayCondition === 'specific') {
      if (!bar.specificPages || bar.specificPages.length === 0) return false;
      return bar.specificPages.some((page: string) => normalizePath(page) === currentPath);
    }

    if (displayCondition === 'except') {
      if (!bar.exceptPages || bar.exceptPages.length === 0) return true;
      return !bar.exceptPages.some((page: string) => normalizePath(page) === currentPath);
    }

    return true;
  };

  const isScrollTopVisible = () => {
    if (!scrollTop?.active || !showScrollTop) return false;
    
    const currentPath = normalizePath(location.pathname);
    const displayCondition = scrollTop.displayCondition || 'all';
    
    if (displayCondition === 'landing') return currentPath === '/';
    
    if (displayCondition === 'specific') {
      if (!scrollTop.specificPages || scrollTop.specificPages.length === 0) return false;
      return scrollTop.specificPages.some((page: string) => normalizePath(page) === currentPath);
    }

    if (displayCondition === 'except') {
      if (!scrollTop.exceptPages || scrollTop.exceptPages.length === 0) return true;
      return !scrollTop.exceptPages.some((page: string) => normalizePath(page) === currentPath);
    }
    
    return true;
  };

  const handleCopy = (text: string, barId: string) => {
    navigator.clipboard.writeText(text);
    setCopied(barId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCTAClick = (bar: any) => {
    if (!bar.ctaLink) return;
    if (bar.ctaLink.startsWith('http')) {
      window.open(bar.ctaLink, '_blank');
    } else {
      navigate(bar.ctaLink);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getSocialIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return MessageCircle;
      case 'facebook': return Facebook;
      case 'instagram': return Instagram;
      case 'linkedin': return Linkedin;
      case 'email': return Mail;
      case 'phone': return Phone;
      case 'twitter': return Twitter;
      case 'youtube': return Youtube;
      case 'website': return Globe;
      default: return LinkIcon;
    }
  };

  if (!floatingSettings) return null;

  const isMobile = windowWidth < 768;
  const bottomBars = activeBars.filter((bar: any) => isBarVisible(bar) && visibleBars.includes(bar.id) && bar.position === 'bottom');
  const totalBottomOffset = bottomBars.length * (isMobile ? 44 : 48);

  const getSocialOffsetX = () => isMobile ? (social?.mobileOffsetX ?? social?.offsetX ?? 24) : (social?.offsetX ?? 24);
  const getSocialOffsetY = () => isMobile ? (social?.mobileOffsetY ?? social?.offsetY ?? 40) : (social?.offsetY ?? 40);

  const getScrollTopOffsetX = () => isMobile ? (scrollTop?.mobileOffsetX ?? scrollTop?.offsetX ?? 24) : (scrollTop?.offsetX ?? 24);
  const getScrollTopOffsetY = () => isMobile ? (scrollTop?.mobileOffsetY ?? scrollTop?.offsetY ?? 24) : (scrollTop?.offsetY ?? 24);

  return (
    <div className="relative z-[9999]">
      {/* Floating Promo Bars */}
      <AnimatePresence>
        {activeBars.filter((bar: any) => isBarVisible(bar) && visibleBars.includes(bar.id)).map((bar: any, bIdx: number) => {
          const marqueeVariants: any = {
            animate: {
              x: [0, -1000],
              transition: {
                x: {
                  repeat: Infinity,
                  repeatType: "loop",
                  duration: bar.marqueeSpeed || 20,
                  ease: "linear",
                },
              },
            },
          };

          const bottomIndex = bottomBars.findIndex(b => b.id === bar.id);
          const barBottomOffset = bottomIndex !== -1 ? bottomIndex * (window.innerWidth < 768 ? 44 : 48) : 0;

          return (
            <motion.div
              key={bar.id || "bar-" + bIdx}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={cn(
                "w-full overflow-hidden flex items-center justify-center text-sm font-display relative shadow-xl border-b border-white/5",
                bar.position === 'bottom' ? "fixed bottom-0 left-0" : ""
              )}
              style={{ 
                backgroundColor: bar.bgType === 'gradient' ? 'transparent' : (bar.bgColor || '#D4AF37'),
                backgroundImage: bar.bgType === 'gradient' ? (bar.bgGradient || 'linear-gradient(90deg, #D4AF37, #F1D483)') : 'none',
                color: bar.textColor || '#000',
                bottom: bar.position === 'bottom' ? `${barBottomOffset}px` : 'auto'
              }}
            >
              <div className="flex-1 py-2 md:py-3 px-4 md:px-10 pr-12 md:pr-14 overflow-hidden whitespace-nowrap flex items-center gap-2 md:gap-4">
                {bar.animation === 'marquee' ? (
                  <div className="flex gap-6 md:gap-10 min-w-full">
                    <motion.div 
                      variants={marqueeVariants}
                      animate="animate"
                      className="flex gap-6 md:gap-10 items-center shrink-0"
                    >
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 md:gap-6">
                          <div 
                            className="font-bold tracking-tight uppercase text-[9px] md:text-xs"
                            dangerouslySetInnerHTML={{ __html: bar.content || '' }}
                          />
                          
                          {bar.ctaText && (
                            <button 
                              onClick={() => handleCTAClick(bar)}
                              className="px-2 md:px-3 py-0.5 md:py-1 rounded bg-black/10 hover:bg-black/20 transition-all font-bold uppercase text-[8px] md:text-[10px] tracking-widest flex items-center gap-1 md:gap-1.5"
                            >
                              {bar.ctaText}
                              <ExternalLink size={8} className="md:w-2.5 md:h-2.5" />
                            </button>
                          )}

                          {bar.promoCode && (
                            <div 
                              className="flex items-center gap-1.5 md:gap-2 px-1.5 py-0.5 rounded border font-mono text-[8px] md:text-[10px] font-bold"
                              style={{ 
                                backgroundColor: bar.promoBg || 'rgba(0,0,0,0.1)', 
                                color: bar.promoColor || bar.textColor || '#000',
                                borderColor: 'rgba(0,0,0,0.1)'
                              }}
                            >
                              {bar.promoCode}
                            </div>
                          )}
                        </div>
                      ))}
                    </motion.div>
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 md:gap-6">
                    <div 
                      className="font-bold tracking-tight text-center uppercase text-[9px] md:text-xs"
                      dangerouslySetInnerHTML={{ __html: bar.content || '' }}
                    />
                    
                    {bar.ctaText && (
                      <button 
                        onClick={() => handleCTAClick(bar)}
                        className="px-2 md:px-4 py-1 md:py-1.5 rounded-lg bg-black/10 hover:bg-black/20 transition-all font-bold uppercase text-[8px] md:text-[10px] tracking-widest flex items-center gap-1.5 md:gap-2 shrink-0"
                      >
                        <span className="hidden sm:inline">{bar.ctaText}</span>
                        <span className="sm:hidden">{bar.ctaText.length > 8 ? bar.ctaText.substring(0,8) + '...' : bar.ctaText}</span>
                        <ExternalLink size={10} className="md:w-3 md:h-3" />
                      </button>
                    )}

                    {bar.promoCode && (
                      <button
                        onClick={() => handleCopy(bar.promoCode, bar.id)}
                        className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-0.5 md:py-1 rounded-lg border transition-all font-mono text-[9px] md:text-xs font-bold shrink-0"
                        style={{ 
                          backgroundColor: bar.promoBg || 'rgba(0,0,0,0.1)', 
                          color: bar.promoColor || bar.textColor || '#000',
                          borderColor: 'rgba(0,0,0,0.1)'
                        }}
                      >
                        {copied === bar.id ? <Check size={12} className="md:w-3.5 md:h-3.5" /> : <Copy size={12} className="md:w-3.5 md:h-3.5" />}
                        {bar.promoCode}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {bar.showClose && (
                <button 
                  onClick={() => setClosedBars(prev => [...prev, `${bar.id}:${location.pathname}`])}
                  className="absolute right-2 md:right-4 p-1 hover:bg-black/10 rounded-full transition-colors z-10"
                  style={{ color: bar.closeColor || bar.textColor || '#000' }}
                  title="Close"
                >
                  <X size={16} />
                </button>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Floating Social Icons */}
      {social?.active && (
        <div 
          className={cn(
            "fixed flex flex-col gap-3 pointer-events-none z-[9990]",
            social.position?.includes('left') ? "left-0" : "right-0",
            social.position?.includes('bottom') ? "bottom-0" : "top-1/2 -translate-y-1/2"
          )}
          style={{ 
            paddingLeft: social.position?.includes('left') ? `${getSocialOffsetX()}px` : '0',
            paddingRight: social.position?.includes('right') ? `${getSocialOffsetX()}px` : '0',
            paddingBottom: social.position?.includes('bottom') ? `${getSocialOffsetY() + (social.position?.includes('bottom') ? totalBottomOffset : 0)}px` : '0',
            marginTop: social.position?.includes('center') ? `${getSocialOffsetY()}px` : '0'
          }}
        >
          {social.icons?.filter((i: any) => i.active).map((icon: any, idx: number) => {
            const IconComp = getSocialIcon(icon.type);
            return (
              <motion.a
                key={icon.id || "icon-" + idx}
                href={icon.url}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: idx * 0.1 }}
                className="pointer-events-auto shadow-lg hover:scale-110 transition-transform flex items-center justify-center group relative cursor-pointer"
                style={{ 
                  backgroundColor: icon.bgType === 'gradient' ? 'transparent' : (icon.bgColor || icon.color || '#D4AF37'),
                  backgroundImage: icon.bgType === 'gradient' ? (icon.bgGradient || 'linear-gradient(45deg, #eee, #ccc)') : 'none',
                  padding: `${icon.padding || 12}px`,
                  borderRadius: '9999px'
                }}
                title={icon.label}
              >
                <IconComp size={icon.iconSize || 20} style={{ color: icon.iconColor || '#fff' }} />
                <span className={cn(
                  "absolute px-2 py-1 bg-black/80 text-white text-[8px] md:text-[10px] uppercase tracking-widest font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none",
                  social.position?.includes('left') ? "left-full ml-3" : "right-full mr-3"
                )}>
                  {icon.label}
                </span>
              </motion.a>
            );
          })}
        </div>
      )}

      {/* Scroll to Top */}
      <AnimatePresence>
        {isScrollTopVisible() && (
          <motion.button
            initial={{ y: 20, opacity: 0, scale: 0.8 }}
            animate={{ 
              y: 0, 
              opacity: 1, 
              scale: 1,
              boxShadow: scrollTop.shape === 'pulse' ? ['0 0 0 0 rgba(212, 175, 55, 0.4)', '0 0 0 15px rgba(212, 175, 55, 0)'] : '0 10px 30px -10px rgba(0,0,0,0.5)'
            }}
            transition={{
              boxShadow: scrollTop.shape === 'pulse' ? { repeat: Infinity, duration: 1.5 } : { duration: 0.2 },
              y: { type: "spring", stiffness: 300, damping: 20 }
            }}
            whileHover={{ scale: 1.1, y: -5 }}
            whileTap={{ scale: 0.9 }}
            exit={{ y: 20, opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className={cn(
              "fixed z-[9998] backdrop-blur-md border border-white/10 flex items-center justify-center transition-all group overflow-hidden shadow-2xl",
              scrollTop.position === 'right-bottom' ? "right-0 bottom-0" : "left-0 bottom-0",
              scrollTop.shape === 'square' ? "rounded-none" : 
              scrollTop.shape === 'rounded' ? "rounded-2xl" : 
              scrollTop.shape === 'pulse' ? "rounded-full" : "rounded-full"
            )}
            style={{ 
              backgroundColor: scrollTop.bgType === 'gradient' ? 'transparent' : (scrollTop.color || '#D4AF37'),
              backgroundImage: scrollTop.bgType === 'gradient' ? (scrollTop.bgGradient || 'linear-gradient(45deg, #D4AF37, #F1D483)') : 'none',
              marginRight: scrollTop.position === 'right-bottom' ? `${getScrollTopOffsetX()}px` : '0',
              marginLeft: scrollTop.position === 'left-bottom' ? `${getScrollTopOffsetX()}px` : '0',
              marginBottom: `${getScrollTopOffsetY() + totalBottomOffset}px`,
              width: `${(scrollTop.padding || 12) * 2 + (scrollTop.iconSize || 20)}px`,
              height: `${(scrollTop.padding || 12) * 2 + (scrollTop.iconSize || 20)}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Scroll to Top"
          >
            <div className="relative flex items-center justify-center w-full h-full">
              {(() => {
                const iconProps = { 
                  size: scrollTop.iconSize || 20, 
                  style: { color: scrollTop.iconColor || "#000" },
                  className: "transition-transform duration-300 group-hover:-translate-y-1 block"
                };
                switch (scrollTop.icon) {
                  case 'chevron-up': return <ChevronUp {...iconProps} />;
                  case 'arrow-up-circle': return <ArrowUpCircle {...iconProps} />;
                  case 'move-up': return <MoveUp {...iconProps} />;
                  case 'rocket': return <Rocket {...iconProps} />;
                  default: return <ArrowUp {...iconProps} />;
                }
              })()}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Popups Engine */}
      <AnimatePresence>
        {popups.filter((p: any) => visiblePopups.includes(p.id) && isPopupVisible(p)).map((popup: any) => {
          const getAnimation = (type: string) => {
            switch (type) {
              case 'fade': return { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } };
              case 'slide': return { initial: { y: 100, opacity: 0 }, animate: { y: 0, opacity: 1 }, exit: { y: 100, opacity: 0 } };
              case 'zoom': return { initial: { scale: 1.5, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.8, opacity: 0 } };
              default: return { initial: { scale: 0.8, opacity: 0 }, animate: { scale: 1, opacity: 1 }, exit: { scale: 0.8, opacity: 0 } };
            }
          };

          const animation = getAnimation(popup.animation);
          const isCenter = popup.position === 'center';
          
          return (
            <motion.div
              key={popup.id + "-popup"}
              {...animation}
              className={cn(
                "fixed z-[9999] p-1",
                isCenter ? "inset-0 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" : 
                popup.position === 'bottom-right' ? "bottom-8 right-8" :
                popup.position === 'bottom-left' ? "bottom-8 left-8" :
                popup.position === 'top-right' ? "top-8 right-8" : "top-8 left-8"
              )}
            >
              <div 
                className={cn(
                  "relative w-full rounded-[32px] overflow-hidden shadow-2xl border border-white/10",
                  !isCenter && "shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                )}
                style={{ 
                  backgroundColor: popup.bgType === 'gradient' ? 'transparent' : (popup.bgColor || '#1a1a1a'),
                  backgroundImage: popup.bgType === 'gradient' ? (popup.bgGradient || 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)') : 'none',
                  color: popup.textColor || '#fff',
                  width: popup.width ? `${popup.width}px` : '400px',
                  maxHeight: popup.height ? `${popup.height}px` : '600px',
                  maxWidth: '90vw'
                }}
              >
                {/* Close button */}
                <button 
                  onClick={() => setClosedPopups(prev => [...prev, `${popup.id}:${location.pathname}`])}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/40 transition-colors z-10"
                >
                  <X size={16} />
                </button>

                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar max-h-full">
                  {/* Type Icon */}
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center border border-white/5"
                      style={{ borderColor: `${popup.accentColor}40` }}
                    >
                      {popup.type === 'sales' ? <Gift size={20} style={{ color: popup.accentColor }} /> :
                       popup.type === 'news' ? <Bell size={20} style={{ color: popup.accentColor }} /> :
                       <Info size={20} style={{ color: popup.accentColor }} />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                        {popup.type} Announcement
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h5 className="text-2xl font-display leading-tight">{popup.title}</h5>
                    <p className="text-sm opacity-60 leading-relaxed font-medium">{popup.subtitle}</p>
                  </div>

                  <div className="space-y-4">
                    {popup.details && (
                       <p className="text-[11px] opacity-40 leading-relaxed italic line-clamp-4">{popup.details}</p>
                    )}

                    {popup.promoCode && (
                      <button 
                        onClick={() => handleCopy(popup.promoCode, popup.id)}
                        className="w-full flex items-center justify-between p-3 bg-black/20 border border-white/5 rounded-xl hover:bg-black/30 transition-all group"
                        style={{ borderColor: `${popup.accentColor}20` }}
                      >
                        <div className="flex items-center gap-2">
                          <Tag size={12} style={{ color: popup.accentColor }} />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Promo Code</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-bold tracking-tighter" style={{ color: popup.accentColor }}>{popup.promoCode}</span>
                          <div className="p-1.5 rounded-lg bg-white/5 text-white/40 group-hover:text-white transition-colors">
                            {copied === popup.id ? <Check size={12} /> : <Copy size={12} />}
                          </div>
                        </div>
                      </button>
                    )}

                    {/* HTML Content area */}
                    {popup.htmlContent && (
                      <div 
                        className="text-[11px] opacity-80 border-t border-white/5 pt-4 mt-4"
                        dangerouslySetInnerHTML={{ __html: popup.htmlContent }}
                      />
                    )}
                  </div>

                  {popup.ctaText && (
                    <button
                      onClick={() => handleCTAClick({ ctaLink: popup.ctaLink })}
                      className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-2"
                      style={{ background: popup.accentColor, color: '#000' }}
                    >
                      {popup.ctaText}
                      <ExternalLink size={14} />
                    </button>
                  )}
                </div>

                {/* Progress bar for autoCloseTime or decorative line */}
                <div className="h-1 w-full bg-black/10">
                  <motion.div 
                    initial={{ width: "0%" }} 
                    animate={{ width: "100%" }} 
                    transition={{ duration: popup.autoCloseTime ? popup.autoCloseTime / 1000 : 5, ease: "linear" }}
                    className="h-full" 
                    style={{ background: popup.accentColor }} 
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
