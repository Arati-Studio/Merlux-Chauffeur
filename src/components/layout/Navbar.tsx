import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Gift, MapPin, Briefcase, MoreHorizontal, User, CalendarDays, LogOut, ChevronDown, ChevronUp, LogIn, ShieldCheck, Truck, UserCircle, LayoutDashboard, Search, Car, BookOpen, Phone, HelpCircle, Sparkles, ChevronsUp, CarFront } from 'lucide-react';
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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        unsubscribeProfile = onSnapshot(userRef, (userSnap) => {
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        }, (err) => {
          console.error('Error fetching user profile in Navbar:', err);
        });
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
      if (unsubscribeProfile) {
        (unsubscribeProfile as any)();
      }
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

  // Static config for More menu (independent of backend CMS/settings changes)
  const gridMoreLinks = [
    { name: 'Services', path: '/services', type: 'link', icon: Briefcase },
    { name: 'Fleet', path: '/fleet', type: 'link', icon: Car },
    { name: 'Blog', path: '/blog', type: 'link', icon: BookOpen },
    { name: 'About', path: '/about', type: 'link', icon: User },
    { name: 'Contact', path: '/contact', type: 'link', icon: Phone },
    { name: 'Search', type: 'search', icon: Search },
    { name: 'Dashboard', path: '/app', type: 'link', icon: LayoutDashboard },
    { name: 'Auth', type: 'auth' }
  ];

  const getIconForPage = (nameStr: string) => {
    const name = nameStr.toLowerCase();
    if (name.includes('fleet')) return Car;
    if (name.includes('blog')) return BookOpen;
    if (name.includes('about')) return User;
    if (name.includes('contact')) return Phone;
    if (name.includes('services')) return Briefcase;
    if (name.includes('tour')) return MapPin;
    if (name.includes('offer')) return Gift;
    if (name.includes('home')) return Home;
    if (name.includes('dashboard')) return LayoutDashboard;
    if (name.includes('faq')) return HelpCircle;
    return Sparkles;
  };

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
                        "group relative py-0.5 text-[10px] lg:text-sm uppercase font-bold tracking-widest transition-colors duration-300 whitespace-nowrap",
                        location.pathname === (link.url || link.path) ? "text-gold" : "text-white/70 hover:text-gold"
                      )}
                    >
                      {link.name || link.label}
                      <span
                        className={cn(
                          'absolute inset-x-0 -bottom-1 h-[2px] bg-gold transition-transform duration-500 origin-left',
                          location.pathname === (link.url || link.path) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        )}
                      />
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
                      'group relative py-0.5 text-[10px] lg:text-sm uppercase font-bold tracking-widest transition-colors duration-300 whitespace-nowrap',
                      location.pathname === (link.path || link.url) ? 'text-gold' : 'text-white/70'
                    )}
                  >
                    {link.name || link.label}
                    <span
                      className={cn(
                        'absolute inset-x-0 -bottom-1 h-[2px] bg-gold transition-transform duration-500 origin-left',
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
                    "group relative py-1 flex items-center gap-2 text-[10px] lg:text-sm font-bold uppercase tracking-widest transition-colors duration-300",
                    displayMoreLinks.some((l: any) => (l.path || l.url) === location.pathname) ? "text-gold" : "text-white/70"
                  )}
                >
                  More
                  <ChevronDown size={14} className={cn("transition-transform duration-300", isMoreOpen && "rotate-180")} />
                  <span
                    className={cn(
                      'absolute inset-x-0 -bottom-1 h-[2px] bg-gold transition-transform duration-500 origin-left',
                      displayMoreLinks.some((l: any) => (l.path || l.url) === location.pathname) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    )}
                  />
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

            <div className="hidden md:flex items-center md:gap-4 lg:gap-6">
              <button
                id="navbar-search-trigger"
                onClick={() => window.dispatchEvent(new Event('open-search-dialog'))}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-gold hover:border-gold/50 hover:bg-white/[0.08] transition-all text-[9px] lg:text-xs font-bold uppercase tracking-wider cursor-pointer"
                title="Search Site (Ctrl+K)"
              >
                <Search size={14} className="text-gold" />
                <span className="hidden lg:inline flex items-center gap-1">
                  <span>Search</span>
                </span>
              </button>

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

              <Link to="/booking" className="group relative overflow-hidden bg-gold text-black px-4 py-1.5 rounded-full text-[10px] lg:text-xs font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(212,175,55,0.2)] transition-all duration-500 hover:shadow-[0_0_30px_rgba(212,175,55,0.5)] hover:scale-105 active:scale-95 whitespace-nowrap flex items-center gap-1">
                <div className="relative z-10 flex items-center overflow-hidden w-6 h-6 group-hover:text-gold transition-colors duration-500">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.5,
                      ease: "easeInOut"
                    }}
                    className="flex shrink-0 font-bold"
                  >

                    <CarFront size={18} />
                  </motion.div>
                </div>
                <span className="relative z-10 group-hover:text-gold transition-colors duration-500 hidden md:inline-block">Book Now</span>
                <div className="absolute inset-0 bg-black translate-y-[101%] group-hover:translate-y-0 transition-transform duration-500 ease-out" />
              </Link>
            </div>
          </div>

          {/* Mobile Header Actions */}
          <div className="flex items-center gap-3 md:hidden">
            <button
              id="mobile-search-trigger"
              onClick={() => window.dispatchEvent(new Event('open-search-dialog'))}
              className="border border-gold/40 rounded-md p-1.5 shadow-sm bg-black/60 text-gold hover:bg-gold hover:text-black transition-colors cursor-pointer"
              title="Search Site"
            >
              <Search size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden bg-transparent select-none pb-safe">
        <div className="mx-auto max-w-sm px-4 pb-3 filter drop-shadow-[0_12px_24px_rgba(212,175,55,0.35)]">
          <div className="flex h-11 items-end relative w-full overflow-visible">

            {/* Left Wing Container */}
            <div className="flex-1 h-12 bg-black/95 backdrop-blur-md rounded-l-2xl border-l border-b border-gold/15 flex items-center justify-around px-1 relative">
              {/* Left Wing Gradient Top Border */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1.2px] pointer-events-none"
                style={{
                  background: 'linear-gradient(to right, rgba(197, 160, 40, 0.15), rgba(197, 160, 40, 0.6))',
                  borderTopLeftRadius: 'rounded-2xl'
                }}
              />
              {/* Home */}
              <Link
                to="/"
                className={cn(
                  'flex items-center justify-center transition-all duration-300 relative min-w-[50px] h-full active:scale-95',
                  location.pathname === '/' ? 'text-gold font-bold' : 'text-white/60 hover:text-white'
                )}
              >
                <Home size={18} className={cn("transition-all duration-300 -mt-1", location.pathname === '/' ? "scale-110 text-gold" : "opacity-80")} />
                {location.pathname === '/' ? (
                  <motion.div layoutId="mobileDot" className="w-1 h-1 bg-gold rounded-full absolute bottom-1 left-1/2 -translate-x-1/2" />
                ) : (
                  <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wider font-extrabold text-white/40 block whitespace-nowrap scale-90">Home</span>
                )}
               </Link>

              {/* Offers */}
              <Link
                to="/offers"
                className={cn(
                  'flex items-center justify-center transition-all duration-300 relative min-w-[50px] h-full active:scale-95',
                  location.pathname === '/offers' ? 'text-gold font-bold' : 'text-white/60 hover:text-white'
                )}
              >
                <Gift size={18} className={cn("transition-all duration-300 -mt-1", location.pathname === '/offers' ? "scale-110 text-gold" : "opacity-80")} />
                {location.pathname === '/offers' ? (
                  <motion.div layoutId="mobileDot" className="w-1 h-1 bg-gold rounded-full absolute bottom-1 left-1/2 -translate-x-1/2" />
                ) : (
                  <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wider font-extrabold text-white/40 block whitespace-nowrap scale-90">Offers</span>
                )}
              </Link>
            </div>

            {/* Custom Background Notch SVG (placed between Left and Right wings) */}
            <div className="w-[80px] h-12 relative overflow-visible pointer-events-none -mx-px flex justify-center">
              <svg width="80" height="12" viewBox="0 0 80 47" fill="none" xmlns="http://w3.org" className="absolute top-0 left-0 w-full h-full">
                <defs>
                  <linearGradient id="goldBorderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#C5A028" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#AA6B39" stopOpacity="0.6" />
                  </linearGradient>
                </defs>
                <path d="M 0,0 H 4 C 12,0 15.2,3 16,9 A 25 25 0 0 0 65 9 C 65,0 75,0 76,0 H 80 V 47 H 0 Z" fill="rgba(0,0,0,0.95)" />
                <path d="M 0,0 H 4 C 12,0 15.2,3 16,9 A 25 25 0 0 0 65 9 C 65,0 75,0 76,0 H 80" stroke="url(#goldBorderGradient)" strokeWidth="1" fill="none" strokeLinecap="round" />
              </svg>


              {/* Centre Icon Text Label Book Now and Active time dots show Otherwise label name show */}
              {location.pathname === '/booking' ? (
                <div className="w-1 h-1 bg-gold rounded-full absolute bottom-1 left-1/2 -translate-x-1/2 animate-pulse" />
              ) : (
                <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wider font-extrabold text-white/40 block whitespace-nowrap scale-90">Book Now</span>
              )}
            </div>

            {/* Floating Booking Button - Perfectly nested down but not overshooting the curve */}
            <Link
              to="/booking"
              className={cn(
                "absolute left-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 active:scale-95 overflow-hidden shadow-[0_4px_15px_rgba(212,175,55,0.4)]",
                location.pathname === '/booking'
                  ? "ring-2 ring-black/20"
                  : "hover:scale-105"
              )}
              style={{ 
                top: '-17px', 
                bottom: 'auto',
                background: 'linear-gradient(135deg, #C5A028 0%, #AA6B39 100%)'
              }}
            >
              <div className="relative w-6 h-6 flex items-center justify-center overflow-hidden">
                <motion.div
                  animate={{ scale: [1, 1.1, 1], opacity: [1, 0.8, 1] }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut"
                  }}
                  className="flex shrink-0 text-black font-bold"
                >
                  <CarFront size={20} />
                </motion.div>
              </div>
            </Link>

            {/* Right Wing Container */}
            <div className="flex-1 h-12 bg-black/95 backdrop-blur-md rounded-r-2xl border-r border-b border-gold/15 flex items-center justify-around px-1 relative">
              {/* Right Wing Gradient Top Border */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1.2px] pointer-events-none"
                style={{
                  background: 'linear-gradient(to left, rgba(197, 160, 40, 0.15), rgba(197, 160, 40, 0.6))',
                  borderTopRightRadius: 'rounded-2xl'
                }}
              />
              {/* Tours */}
              <Link
                to="/tours"
                className={cn(
                  'flex items-center justify-center transition-all duration-300 relative min-w-[50px] h-full active:scale-95',
                  location.pathname === '/tours' ? 'text-gold font-bold' : 'text-white/60 hover:text-white'
                )}
              >
                <MapPin size={18} className={cn("transition-all duration-300 -mt-1", location.pathname === '/tours' ? "scale-110 text-gold" : "opacity-80")} />
                {location.pathname === '/tours' ? (
                  <motion.div layoutId="mobileDot" className="w-1 h-1 bg-gold rounded-full absolute bottom-1 left-1/2 -translate-x-1/2" />
                ) : (
                  <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wider font-extrabold text-white/40 block whitespace-nowrap scale-90">Tours</span>
                )}
              </Link>

              {/* More */}
              <button
                type="button"
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={cn(
                  'flex items-center justify-center transition-all duration-300 relative min-w-[50px] h-full active:scale-95',
                  isMoreOpen ? 'text-gold font-bold' : 'text-white/60 hover:text-white'
                )}
              >
                <ChevronsUp size={18} className={cn("transition-all duration-300 -mt-1", isMoreOpen ? "rotate-180 scale-110 text-gold" : "opacity-80")} />
                {isMoreOpen ? (
                  <motion.div layoutId="mobileDot" className="w-1 h-1 bg-gold rounded-full absolute bottom-1 left-1/2 -translate-x-1/2" />
                ) : (
                  <span className="absolute bottom-[2px] left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wider font-extrabold text-white/40 block whitespace-nowrap scale-90">More</span>
                )}
              </button>
            </div>

          </div>
        </div>

        {/* More bottomsheet modal - Grid Arrangement */}
        <AnimatePresence>
          {isMoreOpen && (
            <>
              {/* Semi-transparent Overlay Background */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMoreOpen(false)}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
              />

              <motion.div
                initial={{ opacity: 0, y: '100%' }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="fixed inset-x-0 bottom-0 z-50 rounded-t-[32px] border-t border-gold/20 bg-black/98 p-6 shadow-[0_-20px_50px_rgba(0,0,0,0.95)] md:hidden max-h-[80vh] overflow-y-auto custom-scrollbar pb-12"
              >
                {/* Visual Pill Grab Handle */}
                <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />

                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black uppercase tracking-[0.25em] text-gold">Explore Menu</h3>
                  <button
                    onClick={() => setIsMoreOpen(false)}
                    className="text-[9px] uppercase font-bold tracking-widest text-[#D4AF37] hover:text-white bg-gold/10 px-3 py-1.5 rounded-full border border-gold/20"
                  >
                    Close
                  </button>
                </div>

                {/* Modular Touch Grid Arrangement (4 Columns) */}
                <div className="grid grid-cols-4 gap-2 pb-8">
                  {gridMoreLinks.map((link: any, lIdx: number) => {
                    const name = link.name;
                    const IconComponent = link.icon || Sparkles;

                    if (link.type === 'search') {
                      return (
                        <button
                          key={`more-grid-search-${lIdx}`}
                          onClick={() => {
                            setIsMoreOpen(false);
                            window.dispatchEvent(new Event('open-search-dialog'));
                          }}
                          className="w-full rounded-2xl border border-gold/15 bg-[#090909] py-3.5 px-1 flex flex-col items-center justify-center text-center gap-1.5 aspect-square transition-all duration-300 active:scale-95 hover:border-gold/35 hover:bg-[#0d0d0d]"
                        >
                          <div className="p-1.5 rounded-xl bg-gold text-black shadow-lg shadow-gold/25">
                            <IconComponent size={14} />
                          </div>
                          <span className="text-[8px] uppercase tracking-widest font-bold text-white/85 line-clamp-1">
                            Search
                          </span>
                        </button>
                      );
                    }

                    if (name === 'Dashboard') {
                      const isLogged = !!user;
                      const role = userProfile?.role;
                      const isActive = location.pathname === link.path;

                      // Role specific properties
                      let RoleIcon = LayoutDashboard;
                      let roleBadgeClass = "bg-white/5 text-gold/90 border-white/5";
                      let roleButtonBorderClass = "border-white/5 text-white/80 hover:border-gold/15 hover:bg-[#0d0d0d]";

                      if (isLogged) {
                        if (role === 'admin') {
                          RoleIcon = ShieldCheck;
                          roleBadgeClass = isActive ? "bg-red-500 text-black shadow-lg shadow-red-500/20" : "bg-red-500/10 text-red-400";
                          roleButtonBorderClass = isActive
                            ? "border-red-500/40 text-red-00 bg-red-500/5 shadow-[0_4px_12px_rgba(239,68,68,0.1)]"
                            : "border-red-500/15 text-red-400 hover:border-red-500/30 hover:bg-[#120808]";
                        } else if (role === 'driver') {
                          RoleIcon = Truck;
                          roleBadgeClass = isActive ? "bg-blue-500 text-black shadow-lg shadow-blue-500/20" : "bg-blue-500/10 text-blue-400";
                          roleButtonBorderClass = isActive
                            ? "border-blue-500/40 text-blue-00 bg-blue-500/5 shadow-[0_4px_12px_rgba(59,130,246,0.1)]"
                            : "border-blue-500/15 text-blue-400 hover:border-blue-500/35 hover:bg-[#080d12]";
                        } else {
                          // customer/user
                          RoleIcon = UserCircle;
                          roleBadgeClass = isActive ? "bg-gold text-black shadow-lg shadow-gold/20" : "bg-gold/10 text-gold";
                          roleButtonBorderClass = isActive
                            ? "border-gold/40 text-gold bg-gold/5 shadow-[0_4px_12px_rgba(212,175,55,0.08)]"
                            : "border-gold/15 text-gold/90 hover:border-gold/25 hover:bg-[#121008]";
                        }
                      } else {
                        // Default Guest
                        RoleIcon = LayoutDashboard;
                        roleBadgeClass = isActive ? "bg-gold text-black shadow-lg shadow-gold/20" : "bg-white/5 text-gold/90";
                        roleButtonBorderClass = isActive
                          ? "border-gold/40 text-gold bg-gold/5 shadow-[0_4px_12px_rgba(212,175,55,0.08)]"
                          : "border-white/5 text-white/80 hover:border-gold/15 hover:bg-[#0d0d0d]";
                      }

                      return (
                        <Link
                          key={`more-grid-dashboard-${lIdx}`}
                          to={link.path}
                          onClick={() => setIsMoreOpen(false)}
                          className={cn(
                            "w-full rounded-2xl border py-3.5 px-1 flex flex-col items-center justify-center text-center gap-1.5 aspect-square transition-all duration-300 active:scale-95",
                            roleButtonBorderClass
                          )}
                        >
                          <div className={cn(
                            "p-1.5 rounded-xl transition-all duration-300",
                            roleBadgeClass
                          )}>
                            <RoleIcon size={14} />
                          </div>
                          <span className="text-[8px] uppercase tracking-widest font-bold line-clamp-1">
                            Dashboard
                          </span>
                        </Link>
                      );
                    }

                    if (link.type === 'auth') {
                      const isLogged = !!user;
                      const authIcon = isLogged ? LogOut : LogIn;
                      const authLabel = isLogged ? 'Logout' : 'Login';

                      const handleAuthClick = () => {
                        setIsMoreOpen(false);
                        if (isLogged) {
                          handleLogout();
                        }
                      };

                      if (isLogged) {
                        return (
                          <button
                            key={`more-grid-auth-${lIdx}`}
                            onClick={handleAuthClick}
                            className="w-full rounded-2xl border border-red-500/10 bg-[#090909] py-3.5 px-1 flex flex-col items-center justify-center text-center gap-1.5 aspect-square transition-all duration-300 active:scale-95 hover:border-red-500/30 hover:bg-[#120808]"
                          >
                            <div className="p-1.5 rounded-xl bg-red-500/10 text-red-400">
                              <LogOut size={14} />
                            </div>
                            <span className="text-[8px] uppercase tracking-widest font-bold text-red-400 line-clamp-1">
                              Logout
                            </span>
                          </button>
                        );
                      } else {
                        return (
                          <Link
                            key={`more-grid-auth-${lIdx}`}
                            to="/login"
                            onClick={() => setIsMoreOpen(false)}
                            className={cn(
                              "w-full rounded-2xl border border-white/5 bg-[#090909] py-3.5 px-1 flex flex-col items-center justify-center text-center gap-1.5 aspect-square transition-all duration-300 active:scale-95",
                              location.pathname === '/login'
                                ? "border-gold/40 text-gold bg-gold/5 shadow-[0_4px_12px_rgba(212,175,55,0.08)]"
                                : "text-white/80 hover:border-gold/15 hover:bg-[#0d0d0d]"
                            )}
                          >
                            <div className={cn(
                              "p-1.5 rounded-xl transition-all duration-300",
                              location.pathname === '/login' ? "bg-gold text-black" : "bg-white/5 text-gold/90"
                            )}>
                              <LogIn size={14} />
                            </div>
                            <span className="text-[8px] uppercase tracking-widest font-bold line-clamp-1">
                              Login
                            </span>
                          </Link>
                        );
                      }
                    }

                    // Default links (Services, Fleet, Blog, About, Contact)
                    const isActive = location.pathname === link.path;
                    return (
                      <Link
                        key={`more-grid-link-${link.name}-${lIdx}`}
                        to={link.path}
                        onClick={() => setIsMoreOpen(false)}
                        className={cn(
                          "w-full rounded-2xl border border-white/5 bg-[#090909] py-3.5 px-1 flex flex-col items-center justify-center text-center gap-1.5 aspect-square transition-all duration-300 active:scale-95",
                          isActive
                            ? "border-gold/40 text-gold bg-gold/5 shadow-[0_4px_12px_rgba(212,175,55,0.08)]"
                            : "text-white/80 hover:border-gold/15 hover:bg-[#0d0d0d]"
                        )}
                      >
                        <div className={cn(
                          "p-1.5 rounded-xl transition-all duration-300",
                          isActive ? "bg-gold text-black" : "bg-white/5 text-gold/90"
                        )}>
                          <IconComponent size={14} />
                        </div>
                        <span className="text-[8px] uppercase tracking-widest font-bold line-clamp-1">
                          {name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
