import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, 
  X, 
  Briefcase, 
  BookOpen, 
  HelpCircle, 
  Compass, 
  Tag, 
  Car,
  Home as HomeIcon,
  Phone,
  Info,
  CornerDownRight, 
  ArrowRight,
  Sparkles,
  Command
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { collection, getDocs, query, limit } from "firebase/firestore";
import { db, auth } from "../lib/firebase";

// Error helper as mandated by firebase-integration skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface SearchItem {
  id: string;
  title: string;
  snippet: string;
  type: 'service' | 'blog' | 'faq' | 'tour' | 'offer' | 'fleet' | 'static';
  path: string;
  category?: string;
  rawText: string; // Used for content search match
  image?: string;
}

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SearchDialog({ isOpen, onClose }: SearchDialogProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'services' | 'blogs' | 'faqs' | 'tours' | 'offers' | 'fleets' | 'pages'>('all');
  const [searchPool, setSearchPool] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Load all items when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const loadSearchData = async () => {
      setIsLoading(true);
      const pool: SearchItem[] = [];

      try {
        // 0. Add Core Static Pages (The missing "All static pages" requirement)
        const staticPages: SearchItem[] = [
          { id: 'home', title: 'Home', snippet: 'Premium Chauffeur Services in Victoria & Melbourne.', type: 'static', path: '/', rawText: 'home landing main page merlux chauffeur melbourne victoria' },
          { id: 'about', title: 'About Us', snippet: 'Learn about our commitment to excellence and professional chauffeur standards.', type: 'static', path: '/about', rawText: 'about us company story history values professional chauffeur excellence' },
          { id: 'contact', title: 'Contact Us', snippet: 'Get in touch for inquiries, custom bookings, or corporate partnerships.', type: 'static', path: '/contact', rawText: 'contact get in touch help support inquiry booking corporate phone email address' },
          { id: 'fleet-page', title: 'Our Fleet', snippet: 'Explore our exquisite collection of luxury sedans, SUVs, and vans.', type: 'static', path: '/fleet', rawText: 'fleet vehicles cars luxury sedan suv van limo collection' },
          { id: 'services-page', title: 'Our Services', snippet: 'From airport transfers to corporate travel and special events.', type: 'static', path: '/services', rawText: 'services airport transfer corporate travel wedding events chauffeur' },
          { id: 'tours-page', title: 'Sightseeing Tours', snippet: 'Curated luxury tour experiences across Victoria.', type: 'static', path: '/tours', rawText: 'tours sightseeing victoria melbourne yarra valley great ocean road' },
          { id: 'offers-page', title: 'Special Offers', snippet: 'Exclusive deals and promotional packages for premium travel.', type: 'static', path: '/offers', rawText: 'offers deals specials promotions packages discount' },
          { id: 'faq-page', title: 'Help & FAQ', snippet: 'Find answers to common questions about our services and bookings.', type: 'static', path: '/faq', rawText: 'faq help common questions answers support booking info' },
          { id: 'blog-page', title: 'Insights & Blog', snippet: 'Travel guides, chauffeur tips, and luxury lifestyle articles.', type: 'static', path: '/blog', rawText: 'blog insights articles travel guides lifestyle news' },
          { id: 'booking-page', title: 'Book Now', snippet: 'Schedule your next luxury ride using our easy online booking system.', type: 'static', path: '/booking', rawText: 'book now reservation schedule ride booking travel' },
          { id: 'terms-page', title: 'Terms & Conditions', snippet: 'Legal information and service agreements.', type: 'static', path: '/terms', rawText: 'terms conditions privacy legal agreement policy' },
        ];
        pool.push(...staticPages);

        // 1. Fetch Dynamic Pages
        try {
          const pagesSnap = await getDocs(collection(db, "pages"));
          pagesSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data.active !== false) {
              const category = data.category || "Pages";
              const isService = category === "Services";
              pool.push({
                id: doc.id,
                title: data.title || "",
                snippet: data.excerpt || data.metaDescription || data.description || "",
                type: isService ? 'service' : 'service',
                category: category,
                path: `/${data.slug || doc.id}`,
                rawText: `${data.title || ""} ${data.excerpt || ""} ${data.content || ""} ${category} ${data.metaDescription || ""} ${data.metaTitle || ""}`.toLowerCase(),
                image: data.image || data.imageUrl || data.thumbnail || data.bannerImage || "",
              });
            }
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, "pages");
        }

        // 2. Fetch Blog posts
        try {
          const blogsSnap = await getDocs(collection(db, "blogs"));
          blogsSnap.docs.forEach((doc) => {
            const data = doc.data();
            pool.push({
              id: doc.id,
              title: data.title || "",
              snippet: data.excerpt || data.metaDescription || data.content?.slice(0, 150) || "",
              type: 'blog',
              category: data.category || "Blog",
              path: `/blog/${data.slug || doc.id}`,
              rawText: `${data.title || ""} ${data.excerpt || ""} ${data.content || ""} ${data.category || ""} ${data.metaDescription || ""}`.toLowerCase(),
              image: data.image || data.thumbnail || data.featureImage || "",
            });
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, "blogs");
        }

        // 3. Fetch Full FAQs
        try {
          const faqsSnap = await getDocs(collection(db, "faqs"));
          faqsSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data.active !== false) {
              pool.push({
                id: doc.id,
                title: data.question || "",
                snippet: data.answer || "",
                type: 'faq',
                category: data.category || "FAQ",
                path: "/faq",
                rawText: `${data.question || ""} ${data.answer || ""} ${data.category || ""}`.toLowerCase(),
              });
            }
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, "faqs");
        }

        // 4. Fetch Tours with Descriptions
        try {
          const toursSnap = await getDocs(collection(db, "tours"));
          toursSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data.active !== false) {
              pool.push({
                id: doc.id,
                title: data.title || "",
                snippet: data.shortDescription || data.excerpt || data.fullDescription?.slice(0, 150) || "",
                type: 'tour',
                path: `/tours/${data.slug || doc.id}`,
                rawText: `${data.title || ""} ${data.shortDescription || ""} ${data.fullDescription || ""} ${data.category || ""} ${data.excerpt || ""}`.toLowerCase(),
                image: data.image || data.imageUrl || data.mainImage || data.thumbnail || "",
              });
            }
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, "tours");
        }

        // 5. Fetch Full Offers
        try {
          const offersSnap = await getDocs(collection(db, "offers"));
          offersSnap.docs.forEach((doc) => {
            const data = doc.data();
            if (data.active !== false) {
              pool.push({
                id: doc.id,
                title: data.title || "",
                snippet: data.description || data.excerpt || "",
                type: 'offer',
                path: `/offers/${data.slug || doc.id}`,
                rawText: `${data.title || ""} ${data.description || ""} ${data.excerpt || ""}`.toLowerCase(),
                image: data.image || data.imageUrl || data.thumbnail || "",
              });
            }
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, "offers");
        }

        // 6. Fetch Fleet Collections (Missing requirement)
        try {
          const fleetSnap = await getDocs(collection(db, "fleet"));
          fleetSnap.docs.forEach((doc) => {
            const data = doc.data();
            pool.push({
              id: doc.id,
              title: data.name || "",
              snippet: `${data.model || ""} - ${data.excerpt || data.description || ""}`,
              type: 'fleet',
              category: data.type || "Vehicle",
              path: "/fleet", // Typically scrolls or lists
              rawText: `${data.name || ""} ${data.model || ""} ${data.type || ""} ${data.excerpt || ""} ${data.description || ""} ${(data.features || []).join(" ")} ${(data.bestFor || []).join(" ")}`.toLowerCase(),
              image: data.image || data.imageUrl || data.thumbnail || "",
            });
          });
        } catch (err) {
          // fleet might be empty or restricted, handle silently or via helper
          console.warn("Fleet search fetch failed:", err);
        }

        setSearchPool(pool);
      } catch (err) {
        console.error("Global search loading failed or restricted:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadSearchData();
    setSearchTerm("");
    setSelectedFilter("all");
    setActiveIndex(0);

    // Focus input on mount
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
  }, [isOpen]);

  // Handle hotkeys & click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        e.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Filter & Search Logic with memory grouping
  const filteredResults = searchPool.filter((item) => {
    // Search query constraint
    const queryTerm = searchTerm.trim().toLowerCase();
    const matchesQuery = queryTerm === "" || item.rawText.includes(queryTerm);

    // Type filter constraint
    if (!matchesQuery) return false;
    if (selectedFilter === "all") return true;
    if (selectedFilter === "services" && item.type === "service") return true;
    if (selectedFilter === "blogs" && item.type === "blog") return true;
    if (selectedFilter === "faqs" && item.type === "faq") return true;
    if (selectedFilter === "tours" && item.type === "tour") return true;
    if (selectedFilter === "offers" && item.type === "offer") return true;
    if (selectedFilter === "fleets" && item.type === "fleet") return true;
    if (selectedFilter === "pages" && (item.type === "static" || item.type === "service")) return true;

    return false;
  });

  // Limit to 10 for clean UI density, allowing pagination/scroll for more
  const displayResults = filteredResults.slice(0, 15);

  // Keyboard Navigation inside Search Results
  useEffect(() => {
    const handleNavigationKeys = (e: KeyboardEvent) => {
      if (!isOpen || displayResults.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % displayResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + displayResults.length) % displayResults.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const activeItem = displayResults[activeIndex];
        if (activeItem) {
          navigate(activeItem.path);
          onClose();
        }
      }
    };

    window.addEventListener("keydown", handleNavigationKeys);
    return () => window.removeEventListener("keydown", handleNavigationKeys);
  }, [isOpen, displayResults, activeIndex, navigate, onClose]);

  // Sync scroll on active element
  useEffect(() => {
    if (resultsContainerRef.current) {
      const activeEl = resultsContainerRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeIndex]);

  // Clear or escape
  const handleItemClick = (path: string) => {
    navigate(path);
    onClose();
  };

  // Helper function to render text with matching query highlighted
  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    
    // Escape regex characters
    const safeHighlight = highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const parts = text.split(new RegExp(`(${safeHighlight})`, 'gi'));
    
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <span key={i} className="text-gold font-bold underline decoration-gold/50 bg-gold/10 px-0.5 rounded">
              {part}
            </span>
          ) : (
            part
          )
        )}
      </>
    );
  };

  // Utility to determine icon for item types
  const getItemIcon = (type: string, id?: string) => {
    switch (type) {
      case "service": return <Briefcase size={16} className="text-gold" />;
      case "blog": return <BookOpen size={16} className="text-emerald-400" />;
      case "faq": return <HelpCircle size={16} className="text-indigo-400" />;
      case "tour": return <Compass size={16} className="text-cyan-400" />;
      case "offer": return <Tag size={16} className="text-rose-400" />;
      case "fleet": return <Car size={16} className="text-orange-400" />;
      case "static": 
        if (id === 'contact') return <Phone size={16} className="text-blue-400" />;
        if (id === 'about') return <Info size={16} className="text-purple-400" />;
        return <HomeIcon size={16} className="text-white/60" />;
      default: return <Briefcase size={16} className="text-white/60" />;
    }
  };

  const getTypeNameLabel = (type: string, category?: string) => {
    if (type === "service") return category || "Service";
    if (type === "blog") return category || "Insights";
    if (type === "faq") return "FAQ Answer";
    if (type === "tour") return "Victoria Tour";
    if (type === "offer") return "Special Offer";
    if (type === "fleet") return category || "Fleet Vehicle";
    if (type === "static") return "Navigation";
    return type;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[900] flex items-start justify-center p-4 sm:p-6 md:p-12 overflow-y-auto"
        >
          {/* Click handler to close dialog */}
          <div className="absolute inset-0 cursor-default" onClick={onClose} />

          {/* Core modal element with elegant bento glass and gold accents */}
          <motion.div
            ref={containerRef}
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="w-full max-w-3xl glass bg-black/90 border border-gold/30 rounded-3xl overflow-hidden shadow-[0_0_80px_rgba(212,175,55,0.15)] relative mt-8 sm:mt-12 z-10 flex flex-col"
          >
            {/* Horizontal elegant gold line */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent w-full opacity-60" />

            {/* Input Header Area */}
            <div className="p-6 border-b border-white/10 relative flex items-center gap-4">
              <Search className="text-gold/80 flex-shrink-0 animate-pulse" size={24} />
              
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setActiveIndex(0);
                }}
                placeholder="Search services, articles, tours, FAQs..."
                className="w-full bg-transparent border-none text-white placeholder-white/40 focus:outline-none focus:ring-0 text-base sm:text-lg font-light tracking-wide py-2"
                aria-label="Global search input"
              />

              {/* Status Indicator inside Search */}
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {searchTerm && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      onClick={() => {
                        setSearchTerm("");
                        inputRef.current?.focus();
                      }}
                      className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all text-xs"
                    >
                      Clear
                    </motion.button>
                  )}
                </AnimatePresence>
                
                <button
                  onClick={onClose}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  aria-label="Close search"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filters Area */}
            <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01] flex items-center gap-2 overflow-x-auto custom-scrollbar whitespace-nowrap">
              <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest mr-2">Filter</span>
              
              {(['all', 'services', 'blogs', 'faqs', 'tours', 'offers', 'fleets', 'pages'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setSelectedFilter(filter);
                    setActiveIndex(0);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all border ${
                    selectedFilter === filter
                      ? "bg-gold text-black border-gold shadow-[0_4px_12px_rgba(212,175,55,0.25)]"
                      : "bg-white/5 text-white/60 border-white/10 hover:text-white hover:border-gold/30 hover:bg-white/[0.08]"
                  }`}
                >
                  {filter === 'all' ? 'All Results' : filter}
                </button>
              ))}
            </div>

            {/* Results Content Area */}
            <div 
              ref={resultsContainerRef}
              className="max-h-[50vh] overflow-y-auto custom-scrollbar p-3 space-y-1 bg-black/40 min-h-[160px]"
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <div className="w-10 h-10 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
                  <p className="text-xs text-white/40 uppercase tracking-widest animate-pulse">Initializing Global Registry...</p>
                </div>
              ) : displayResults.length > 0 ? (
                <div role="listbox">
                  {displayResults.map((item, index) => {
                    const isActive = index === activeIndex;
                    return (
                      <div
                        key={item.id + "-" + item.type}
                        role="option"
                        aria-selected={isActive}
                        data-active={isActive ? "true" : "false"}
                        onClick={() => handleItemClick(item.path)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`flex items-start gap-4 p-4 rounded-2xl transition-all cursor-pointer border ${
                          isActive
                            ? "bg-gradient-to-r from-gold/10 to-transparent border-gold/45 shadow-sm"
                            : "bg-transparent border-transparent hover:bg-white/[0.02]"
                        }`}
                      >
                        {/* Left Icon/Image Container */}
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 border transition-all overflow-hidden ${
                          isActive 
                            ? "bg-gold/20 border-gold/40 text-gold scale-105" 
                            : "bg-white/5 border-white/10 text-white/50"
                        }`}>
                          {item.image ? (
                            <img 
                              src={item.image} 
                              alt="" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                (e.target as HTMLImageElement).parentElement!.innerHTML = `<div class="flex items-center justify-center w-full h-full">${getItemIcon(item.type, item.id)}</div>`;
                              }}
                            />
                          ) : (
                            getItemIcon(item.type, item.id)
                          )}
                        </div>

                        {/* Mid Text Segment */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[9px] uppercase tracking-widest font-extrabold text-gold px-2 py-0.5 rounded bg-gold/10 border border-gold/15">
                              {getTypeNameLabel(item.type, item.category)}
                            </span>
                          </div>
                          
                          <h4 className={`text-sm sm:text-base font-display font-medium leading-snug transition-colors ${
                            isActive ? "text-gold" : "text-white"
                          }`}>
                            {renderHighlightedText(item.title, searchTerm)}
                          </h4>
                          
                          <p className="text-xs text-white/50 mt-1 line-clamp-2 leading-relaxed">
                            {renderHighlightedText(item.snippet, searchTerm)}
                          </p>
                        </div>

                        {/* Right Chevron / Arrow indicator */}
                        <div className={`self-center flex-shrink-0 transition-all ${
                          isActive ? "text-gold translate-x-1" : "text-white/10"
                        }`}>
                          <ArrowRight size={16} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/30 mb-4">
                    <Search size={22} className="opacity-60" />
                  </div>
                  <h3 className="text-white font-medium text-sm sm:text-base font-display">No matches found for "{searchTerm}"</h3>
                  <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto leading-relaxed">
                    Check your spelling or filter settings. You can try searching for "chauffeur", "airport transfer", or browsing through our Victoria "tours".
                  </p>
                  
                  {/* Quick helpful search suggestions link tags */}
                  <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-md">
                    {['Airport Transfer', 'Yarra Valley', 'Chauffeur', 'Hourly Booking', 'Corporate'].map((tag) => (
                      <button
                        key={tag}
                        onClick={() => {
                          setSearchTerm(tag);
                          setSelectedFilter("all");
                        }}
                        className="px-3 py-1 bg-white/5 hover:bg-white/10 hover:border-gold/30 border border-white/10 rounded-lg text-[10px] uppercase font-bold tracking-wider text-white/60 hover:text-gold transition-all"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sticky Action Footer Bar */}
            <div className="px-6 py-4 bg-[#0a0a0a] border-t border-white/5 flex flex-wrap items-center justify-between text-[11px] text-white/40 font-mono gap-y-2">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="bg-white/15 px-1 py-0.5 rounded leading-none">↑↓</span> Navigation
                </span>
                <span className="flex items-center gap-1">
                  <span className="bg-white/15 px-1 py-0.5 rounded leading-none">Enter</span> Select
                </span>
                <span className="flex items-center gap-1">
                  <span className="bg-white/15 px-1 py-0.5 rounded leading-none">Esc</span> Close
                </span>
              </div>
              <div className="flex items-center gap-1 text-gold/60 font-semibold uppercase tracking-wider">
                <Sparkles size={11} className="text-gold/80" />
                <span>Registry Verified</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
