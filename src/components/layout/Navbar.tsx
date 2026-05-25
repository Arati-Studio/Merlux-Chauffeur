import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Gift, MapPin, Briefcase, MoreHorizontal, User, CalendarDays, LogOut, ChevronDown, LogIn, ShieldCheck, Truck, UserCircle, LayoutDashboard } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import Logo from './Logo';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Offers', path: '/offers' },
  { name: 'Tours', path: '/tours' },
  { name: 'Services', path: '/services' },
];

const moreLinks = [
  { name: 'Fleet', path: '/fleet' },
  { name: 'Blog', path: '/blog' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
];

export default function Navbar() {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showRoleTooltip, setShowRoleTooltip] = useState(false);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const location = useLocation();
  const moreRef = useRef<HTMLDivElement>(null);

  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const [activeNestedMenu, setActiveNestedMenu] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const roleColor = userProfile?.role === 'admin'
    ? 'text-red-400'
    : userProfile?.role === 'driver'
      ? 'text-blue-400'
      : 'text-gold';

  const mobileNavItems = [
    { name: 'Home', path: '/', Icon: Home },
    { name: 'Offers', path: '/offers', Icon: Gift },
    { name: 'Tours', path: '/tours', Icon: MapPin },
    { name: 'Services', path: '/services', Icon: Briefcase },
    { name: 'More', action: () => setIsMoreOpen(!isMoreOpen), Icon: MoreHorizontal },
  ];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        } catch (err) {
          console.error('Error fetching user profile in Navbar:', err);
        }
      } else {
        setUserProfile(null);
      }
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'system'), (doc) => {
      if (doc.exists()) {
        setSystemSettings(doc.data());
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setActiveSubMenu(null);
        setActiveNestedMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      unsubscribe();
      unsubscribeSettings();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const headerMenu = systemSettings?.menus?.headerActive && (systemSettings?.menus?.header || []).length > 0 
    ? systemSettings.menus.header 
    : navLinks;

  const hasManualMore = headerMenu !== navLinks && headerMenu.some((m: any) => m.isMore);

  const displayNavLinks = headerMenu === navLinks 
    ? navLinks 
    : (hasManualMore 
        ? headerMenu.filter((m: any) => !m.isMore) 
        : headerMenu.slice(0, 4));

  const displayMoreLinks = headerMenu === navLinks 
    ? moreLinks 
    : (hasManualMore 
        ? headerMenu.filter((m: any) => m.isMore) 
        : headerMenu.slice(4));

  return (
    <>
      <nav
        className={cn(
          'relative z-50 transition-all duration-300 px-4 sm:px-6 py-4 w-full',
          scrolled ? 'bg-black/90 backdrop-blur-md py-3 border-b border-white/10' : 'bg-transparent'
        )}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <Logo />

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center md:gap-4 lg:gap-8" ref={navRef}>
            {displayNavLinks.map((link: any, linkIdx: number) => (
              <div key={`${link.name || link.label}-${linkIdx}`} className="relative flex items-center gap-1 group/nav">
                {link.items && link.items.length > 0 ? (
                  <div className="relative flex items-center">
                    <Link
                      to={link.url || link.path || '#'}
                      onClick={() => setActiveSubMenu(null)}
                      className={cn(
                        "text-[10px] lg:text-sm uppercase font-bold tracking-widest transition-colors duration-300 whitespace-nowrap",
                        location.pathname === (link.url || link.path) ? "text-gold" : "text-white/70 hover:text-gold"
                      )}
                    >
                      {link.name || link.label}
                    </Link>
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        const key = `${link.name || link.label}-${linkIdx}`;
                        setActiveSubMenu(activeSubMenu === key ? null : key);
                      }}
                      className={cn(
                        "ml-1 p-1 rounded-full hover:bg-white/5 transition-colors",
                        activeSubMenu === `${link.name || link.label}-${linkIdx}` ? "text-gold" : "text-white/40"
                      )}
                    >
                      <ChevronDown size={14} className={cn("transition-transform duration-300", activeSubMenu === `${link.name || link.label}-${linkIdx}` && "rotate-180")} />
                    </button>
                    {/* Submenu Dropdown */}
                    <AnimatePresence>
                      {activeSubMenu === `${link.name || link.label}-${linkIdx}` && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: 10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: 10 }}
                          className="absolute top-full left-0 mt-6 min-w-64 z-[100]"
                        >
                          <div className="bg-[#050505]/95 backdrop-blur-2xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] p-3">
                            <div className="space-y-1">
                              {link.items.map((sub: any, sIdx: number) => {
                                const hasNested = sub.items && sub.items.length > 0;
                                const isNestedOpen = activeNestedMenu === sub.label;

                                return (
                                  <div key={`${link.label || link.name}-sub-${sIdx}`} className="relative">
                                    <div className={cn(
                                      "flex items-center group/subitem rounded-2xl transition-all",
                                      isNestedOpen ? "bg-gold text-black" : "hover:bg-white/5"
                                    )}>
                                      <Link
                                        to={sub.url}
                                        onClick={() => {
                                          setActiveSubMenu(null);
                                          setActiveNestedMenu(null);
                                        }}
                                        className={cn(
                                          "flex-1 px-4 py-3 text-[10px] uppercase tracking-widest font-bold transition-all",
                                          isNestedOpen ? "text-black" : "text-white/60 group-hover:text-white"
                                        )}
                                      >
                                        {sub.label}
                                      </Link>
                                      {hasNested && (
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            setActiveNestedMenu(isNestedOpen ? null : sub.label);
                                          }}
                                          className={cn(
                                            "mr-2 p-1.5 rounded-lg transition-colors",
                                            isNestedOpen ? "hover:bg-black/10 text-black" : "hover:bg-white/10 text-white/40"
                                          )}
                                        >
                                          <ChevronDown size={14} className={cn("transition-transform duration-300", isNestedOpen && "rotate-180")} />
                                        </button>
                                      )}
                                    </div>

                                    {/* Nested Level 2 Submenu */}
                                    {hasNested && isNestedOpen && (
                                      <motion.div
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="mt-1 ml-4 border-l border-white/10 pl-2 space-y-1"
                                      >
                                        {sub.items.map((nested: any, nIdx: number) => (
                                          <Link
                                            key={`nested-${nIdx}`}
                                            to={nested.url}
                                            onClick={() => {
                                              setActiveSubMenu(null);
                                              setActiveNestedMenu(null);
                                            }}
                                            className="block px-4 py-2.5 text-[9px] uppercase tracking-[0.2em] font-black text-white/40 hover:text-gold transition-colors"
                                          >
                                            {nested.label}
                                          </Link>
                                        ))}
                                      </motion.div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    to={link.path || link.url}
                    className={cn(
                      'group relative overflow-hidden text-[10px] lg:text-sm uppercase font-bold tracking-widest transition-colors duration-300 whitespace-nowrap',
                      location.pathname === (link.path || link.url) ? 'text-gold' : 'text-white/70'
                    )}
                  >
                    {link.name || link.label}
                    <span
                      className={cn(
                        'absolute inset-x-0 -bottom-1 h-[2px] bg-gold transition-transform duration-300 origin-right',
                        location.pathname === (link.path || link.url) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      )}
                    />
                  </Link>
                )}
              </div>
            ))}

            {/* More Dropdown */}
            {displayMoreLinks.length > 0 && (
              <div className="relative" ref={moreRef}>
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={cn(
                    "group flex items-center gap-2 text-[10px] lg:text-sm font-bold uppercase tracking-widest transition-colors duration-300",
                    displayMoreLinks.some((l: any) => (l.path || l.url) === location.pathname) ? "text-gold" : "text-white/70"
                  )}
                >
                  More
                  <ChevronDown size={14} className={cn("transition-transform duration-300", isMoreOpen && "rotate-180")} />
                </button>

                <AnimatePresence>
                  {isMoreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full right-0 mt-4 w-64 bg-[#050505]/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl p-2 z-[110]"
                    >
                      <div className="space-y-1">
                        {displayMoreLinks.map((link: any, linkIdx: number) => {
                          const hasSub = link.items && link.items.length > 0;
                          const moreKey = `more-${link.name || link.label}-${linkIdx}`;
                          const isSubOpen = activeSubMenu === moreKey;

                          return (
                            <div key={moreKey} className="space-y-1">
                              <div className={cn(
                                "flex items-center justify-between rounded-xl transition-all",
                                isSubOpen ? "bg-white/10" : "hover:bg-white/5"
                              )}>
                                <Link
                                  to={link.path || link.url || '#'}
                                  onClick={() => {
                                    if (!hasSub) {
                                      setIsMoreOpen(false);
                                      setActiveSubMenu(null);
                                    }
                                  }}
                                  className={cn(
                                    "flex-1 px-4 py-3 text-[10px] uppercase tracking-widest font-bold transition-all",
                                    location.pathname === (link.path || link.url) ? "text-gold" : "text-white/70"
                                  )}
                                >
                                  {link.name || link.label}
                                </Link>
                                {hasSub && (
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      setActiveSubMenu(isSubOpen ? null : moreKey);
                                    }}
                                    className="px-4 py-3 text-white/40 hover:text-gold transition-colors"
                                  >
                                    <ChevronDown size={14} className={cn("transition-transform duration-300", isSubOpen && "rotate-180")} />
                                  </button>
                                )}
                              </div>

                              {hasSub && isSubOpen && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  className="overflow-hidden ml-4 border-l border-white/10 pl-2 space-y-1 py-1"
                                >
                                  {link.items.map((sub: any, sIdx: number) => (
                                    <Link
                                      key={`${moreKey}-sub-${sIdx}`}
                                      to={sub.url}
                                      onClick={() => {
                                        setIsMoreOpen(false);
                                        setActiveSubMenu(null);
                                      }}
                                      className="block px-4 py-2 text-[9px] uppercase tracking-[0.2em] font-black text-white/40 hover:text-gold transition-colors"
                                    >
                                      {sub.label}
                                    </Link>
                                  ))}
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex items-center md:gap-4 lg:gap-6">
              {user ? (
                <div className="flex items-center gap-2 lg:gap-4">
                  <div className="relative group">
                    <Link
                      to="/app"
                      onMouseEnter={() => setShowRoleTooltip(true)}
                      onMouseLeave={() => setShowRoleTooltip(false)}
                      className={cn(
                        "flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-colors",
                        roleColor
                      )}
                    >
                      {userProfile?.role === 'admin' ? (
                        <ShieldCheck size={18} className="text-red-400" />
                      ) : userProfile?.role === 'driver' ? (
                        <Truck size={18} className="text-blue-400" />
                      ) : (
                        <UserCircle size={18} className="text-gold" />
                      )}
                      <span className="hidden lg:inline">Dashboard</span>
                    </Link>

                    {/* Tooltip */}
                    <AnimatePresence>
                      {showRoleTooltip && userProfile && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-gold text-black text-[8px] font-bold uppercase tracking-widest rounded whitespace-nowrap z-[60]"
                        >
                          Role: {userProfile.role}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button onClick={handleLogout} className="text-red-400 hover:text-red-600 transition-colors">
                    <LogOut size={18} />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="text-blue-400 hover:text-blue-600 transition-colors" title="Login">
                  <LogIn size={20} />
                </Link>
              )}
              <Link to="/booking" className="btn-primary py-2 px-4 lg:px-6 text-[10px] lg:text-xs rounded-sm whitespace-nowrap">
                Book Now
              </Link>
            </div>
          </div>

          {/* Mobile Header Actions */}
          <div className="flex items-center gap-3 md:hidden">
            {user ? (
              <Link
                to="/app"
                className={cn(
                  'transition-colors',
                  roleColor
                )}
                title="Dashboard"
              >
                {userProfile?.role === 'admin' ? (
                  <div className="bg-red-700 hover:bg-red-800 border border-red-700 rounded-md p-1.5">
                    <ShieldCheck size={16} className="text-white" />
                  </div>
                ) : userProfile?.role === 'driver' ? (
                  <div className="bg-blue-700 hover:bg-blue-800 border border-blue-700 rounded-md p-1.5">
                    <Truck size={16} className="text-white" />
                  </div>
                ) : (
                  <div className="bg-yellow-700 hover:bg-yellow-800 border border-yellow-700 rounded-md p-1.5">
                    <UserCircle size={16} className="text-white" />
                  </div>
                )}
              </Link>
            ) : (
              <Link
                to="/login"
                className="border border-blue-700 rounded-md p-1.5 shadow-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                title="Login"
              >
                <LogIn size={16} />
              </Link>
            )}

            <Link
              to="/booking"
              className="border border-green-700 rounded-md p-1.5 shadow-sm bg-green-700 text-white hover:bg-green-800 transition-colors"
              title="Book Now"
            >
              <CalendarDays size={16} />
            </Link>

            {user && (
              <button
                onClick={handleLogout}
                className="bg-red-500/10 border border-red-500 rounded-md p-1.5 shadow-sm text-red-500 hover:bg-red-800 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-t-3xl border-t border-white/10 bg-black/95 px-4 py-2 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]">
          {(headerMenu.length > 0 ? headerMenu.slice(0, 4) : mobileNavItems.slice(0, 4)).map((item: any, idx: number) => {
            const path = item.url || item.path;
            const name = item.label || item.name;
            const Icon = item.Icon || (idx === 0 ? Home : idx === 1 ? Gift : idx === 2 ? MapPin : Briefcase);

            return (
              <Link
                key={`${name}-${idx}`}
                to={path}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] uppercase tracking-widest transition-colors',
                  location.pathname === path ? 'text-gold' : 'text-white/70'
                )}
              >
                <Icon size={20} />
                <span className="line-clamp-1">{name}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setIsMoreOpen(!isMoreOpen)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] uppercase tracking-widest transition-colors',
              isMoreOpen ? 'text-gold' : 'text-white/70'
            )}
          >
            <MoreHorizontal size={20} />
            <span>More</span>
          </button>
        </div>

        <AnimatePresence>
          {isMoreOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-x-4 bottom-20 z-50 rounded-[32px] border border-white/10 bg-black/95 p-6 shadow-2xl md:hidden overflow-y-auto max-h-[60vh] custom-scrollbar"
            >
              <div className="flex flex-col gap-4 text-left">
                {(headerMenu.length > 4 ? headerMenu.slice(4) : moreLinks).map((link: any, lIdx: number) => (
                  <div key={`${link.label || link.name}-${lIdx}`} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Link
                        to={link.path || link.url || '#'}
                        onClick={() => !link.items && setIsMoreOpen(false)}
                        className={cn(
                          'flex-1 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-[10px] uppercase tracking-widest font-black transition-all hover:bg-gold hover:text-black',
                          location.pathname === (link.path || link.url) ? 'text-gold border-gold/40' : 'text-white/70'
                        )}
                      >
                        {link.name || link.label}
                      </Link>
                      {link.items && link.items.length > 0 && (
                        <button
                          onClick={() => {
                            const key = `mobile-${link.url || link.path || lIdx}`;
                            setActiveSubMenu(activeSubMenu === key ? null : key);
                          }}
                          className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-gold transition-all"
                        >
                          <ChevronDown size={18} className={cn("transition-transform duration-300", activeSubMenu === `mobile-${link.url || link.path || lIdx}` && "rotate-180")} />
                        </button>
                      )}
                    </div>
                    
                    <AnimatePresence>
                      {link.items && link.items.length > 0 && activeSubMenu === `mobile-${link.url || link.path || lIdx}` && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden border-l-2 border-gold/20 ml-4 pl-6 space-y-3 pt-1"
                        >
                          {link.items.map((sub: any, sIdx: number) => (
                            <Link
                              key={`${link.label || link.name}-mobile-sub-${sIdx}`}
                              to={sub.url}
                              onClick={() => {
                                setIsMoreOpen(false);
                                setActiveSubMenu(null);
                              }}
                              className="block text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-gold transition-colors py-1"
                            >
                              {sub.label}
                            </Link>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
