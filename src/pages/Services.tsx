import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowRight, Search, X, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import SEO from '../components/SEO';
import { pagesFallback } from '../data/fallback/pagesFallback';
import { getCachedDocs } from '../lib/firestore-cache';
import { cn } from '../lib/utils';

export default function Services() {
  const navigate = useNavigate();
  const [dynamicServices, setDynamicServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Services');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(6);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const q = query(collection(db, 'pages'));
        const fetched = await getCachedDocs(q, 'all_pages_list');
        
        const STATIC_SLUGS = [
          'about', 'contact', 'fleet', 'services', 'tours', 'offers', 'home', 
          'faq', 'terms', 'privacy', 'booking', 'blog', 'admin', 'login', 
          'dashboard', 'pay', 'checkout', 'payment-success', ''
        ];

        // Filter in memory for maximum reliability and handle missing 'active' field
        const filtered = fetched
          .filter((p: any) => {
            const isPageActive = p.active !== false;
            const slug = (p.slug || '').toLowerCase().trim();
            const isStatic = STATIC_SLUGS.includes(slug);
            return isPageActive && !isStatic;
          })
          .sort((a: any, b: any) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeB - timeA;
          });
          
        if (filtered.length > 0) {
          setDynamicServices(filtered);
        } else {
          // Fallback to static data
          const fallbackList = pagesFallback.filter(p => {
            const isPageActive = p.active !== false;
            const slug = (p.slug || '').toLowerCase().trim();
            const isStatic = STATIC_SLUGS.includes(slug);
            return isPageActive && !isStatic;
          });
          setDynamicServices(fallbackList);
        }
      } catch (err) {
        console.error('Error fetching dynamic services, loading fallback:', err);
        const STATIC_SLUGS = [
          'about', 'contact', 'fleet', 'services', 'tours', 'offers', 'home', 
          'faq', 'terms', 'privacy', 'booking', 'blog', 'admin', 'login', 
          'dashboard', 'pay', 'checkout', 'payment-success', ''
        ];
        const fallbackList = pagesFallback.filter(p => {
          const isPageActive = p.active !== false;
          const slug = (p.slug || '').toLowerCase().trim();
          const isStatic = STATIC_SLUGS.includes(slug);
          return isPageActive && !isStatic;
        });
        setDynamicServices(fallbackList);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  const activePages = useMemo(() => {
    return dynamicServices.filter((p: any) => p.active !== false);
  }, [dynamicServices]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    activePages.forEach((p: any) => {
      const cat = p.category || 'Services';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [activePages]);

  const categories = useMemo(() => {
    return Object.keys(categoryCounts)
      .filter((cat) => categoryCounts[cat] > 0)
      .sort((a, b) => {
        if (a === 'Services') return -1;
        if (b === 'Services') return 1;
        return a.localeCompare(b);
      });
  }, [categoryCounts]);

  const filteredPages = useMemo(() => {
    return activePages.filter((p: any) => {
      const cat = p.category || 'Services';
      const matchesCategory = cat.toLowerCase() === selectedCategory.toLowerCase();
      
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchesCategory;

      const titleMatch = (p.title || '').toLowerCase().includes(q);
      const excerptMatch = (p.excerpt || '').toLowerCase().includes(q);
      const contentMatch = (p.content || '').toLowerCase().includes(q);
      
      return matchesCategory && (titleMatch || excerptMatch || contentMatch);
    });
  }, [activePages, selectedCategory, searchQuery]);

  // Automatically select an active category with items if the default "Services" has no items
  useEffect(() => {
    if (categories.length > 0) {
      const selectedIndex = categories.findIndex(c => c.toLowerCase() === selectedCategory.toLowerCase());
      if (selectedIndex === -1) {
        const servicesCategory = categories.find(c => c.toLowerCase() === 'services');
        if (servicesCategory) {
          setSelectedCategory(servicesCategory);
        } else {
          setSelectedCategory(categories[0]);
        }
      }
    }
  }, [categories, selectedCategory]);

  // Reset page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchQuery]);

  const totalPages = useMemo(() => {
    if (pageSize === 'All') return 1;
    return Math.ceil(filteredPages.length / (pageSize as number));
  }, [filteredPages, pageSize]);

  const paginatedPages = useMemo(() => {
    if (pageSize === 'All') return filteredPages;
    const startIndex = (currentPage - 1) * (pageSize as number);
    return filteredPages.slice(startIndex, startIndex + (pageSize as number));
  }, [filteredPages, currentPage, pageSize]);

  return (
    <div className="pt-20 pb-24 bg-[#050505] min-h-screen">
      <SEO 
        title="Our Premium Chauffeur Services"
        description="Explore Melbourne's most refined transport solutions. From corporate elegance to bespoke private journeys and airport transfers."
      />
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Excellence in Motion</span>
            <h1 className="text-5xl md:text-7xl font-display mb-6">Our Elite <span className="text-gold italic">Services</span></h1>
            <p className="text-white/50 max-w-2xl mx-auto text-lg font-light leading-relaxed">
              Experience Melbourne's most refined transport solutions. From corporate elegance to bespoke private journeys.
            </p>
          </motion.div>
        </div>

        {/* Categories and Search Controls */}
        {!loading && categories.length > 0 && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 bg-white/[0.02] border border-white/5 p-6 rounded-[2rem]">
            {/* Category Pills */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 md:pb-0 scrollbar-none custom-scrollbar max-w-full">
              {categories.map((cat) => {
                const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                const count = categoryCounts[cat] || 0;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSearchQuery('');
                    }}
                    className={cn(
                      "px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap border flex items-center gap-2 shrink-0 cursor-pointer",
                      isSelected
                        ? "bg-gold text-black border-gold shadow-lg shadow-gold/20"
                        : "bg-white/5 text-white/60 border-white/10 hover:text-white hover:border-white/30"
                    )}
                  >
                    <span>{cat}</span>
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-mono font-bold",
                      isSelected ? "bg-black/20 text-black" : "bg-white/10 text-white/40"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search option */}
            <div className="relative w-full md:w-80 shrink-0">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-white/30">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder={`Search ${selectedCategory}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-full py-3.5 pl-11 pr-10 text-xs font-mono text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 focus:bg-white/[0.08] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-white/30 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-12 h-12 border-2 border-gold/20 border-t-gold rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {paginatedPages.length > 0 ? (
                paginatedPages.map((service, i) => (
                  <motion.div
                    key={service.id || i}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    viewport={{ once: true }}
                    onClick={() => navigate(`/${service.slug}`)}
                    className="group bg-white/[0.03] border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-gold/50 transition-all duration-700 cursor-pointer flex flex-col h-full hover:shadow-[0_20px_50px_rgba(212,175,55,0.1)]"
                  >
                    <div className="h-72 overflow-hidden relative">
                      <img 
                        src={service.featuredImage || 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop'} 
                        alt={service.featuredImageAlt || service.title} 
                        className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
                      
                      <div className="absolute top-6 left-6">
                        <div className="bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10">
                          <p className="text-gold text-[10px] uppercase font-bold tracking-widest">{service.category || 'Services'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 flex flex-col flex-1">
                      <h3 className="text-3xl font-display mb-4 group-hover:text-gold transition-colors">{service.title}</h3>
                      {service.excerpt && (
                        <p className="text-white/40 text-sm leading-relaxed mb-8 line-clamp-3 italic">
                          "{service.excerpt}"
                        </p>
                      )}
                      
                      <div className="mt-auto pt-6 border-t border-white/5 flex items-center justify-between group-hover:border-gold/30">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-white/30 group-hover:text-gold transition-colors">Discover Details</span>
                        <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-gold group-hover:text-black transition-all">
                          <ArrowRight size={16} />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center glass rounded-[3rem] border border-dashed border-white/10">
                  <p className="text-white/40 italic text-xl">
                    {searchQuery 
                      ? `No experiences found matching "${searchQuery}" in ${selectedCategory}.`
                      : `No experiences listed in ${selectedCategory} category yet.`}
                  </p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {filteredPages.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] text-xs animate-fade-in"
              >
                {/* Entry status text */}
                <div className="text-white/50 tracking-wider font-mono text-[10px] uppercase font-bold">
                  Showing <span className="text-gold font-bold">
                    {filteredPages.length === 0 ? 0 : (pageSize === 'All' ? 1 : (currentPage - 1) * (pageSize as number) + 1)}
                  </span> to <span className="text-gold font-bold">
                    {pageSize === 'All' ? filteredPages.length : Math.min(currentPage * (pageSize as number), filteredPages.length)}
                  </span> of <span className="text-white font-bold">{filteredPages.length}</span> entries
                </div>

                {/* Pagination buttons */}
                {pageSize !== 'All' && totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setCurrentPage(1);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                      disabled={currentPage === 1}
                      className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                      title="First Page"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
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
                          onClick={() => {
                            setCurrentPage(num);
                            window.scrollTo({ top: 300, behavior: 'smooth' });
                          }}
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
                      onClick={() => {
                        setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPage(totalPages);
                        window.scrollTo({ top: 300, behavior: 'smooth' });
                      }}
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
                    <option value={6}>6 Entries</option>
                    <option value={12}>12 Entries</option>
                    <option value={24}>24 Entries</option>
                    <option value="All">Show All</option>
                  </select>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-32 bg-[#0A0A0A] border border-gold/15 rounded-[3rem] p-12 md:p-24 text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none text-gold/20">
            <div className="absolute top-[-50%] right-[-20%] w-[100%] h-[200%] bg-current blur-[120px] rounded-full -rotate-45" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block text-gold">Elite Transport</span>
            <h2 className="text-4xl md:text-6xl font-display mb-8 leading-tight text-white">Experience <span className="text-gold italic">Pure Luxury</span></h2>
            <p className="text-white/50 mb-10 text-lg leading-relaxed text-balance">
              From bespoke corporate travel to specialized regional excursions, our fleet and chauffeurs are at your service for any requirement.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Link 
                to="/booking" 
                className="bg-gold text-black px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-2xl shadow-gold/20"
              >
                Start Your Booking
              </Link>
              <Link 
                to="/offers" 
                className="bg-white/5 backdrop-blur-md border border-white/10 text-white px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-gold hover:text-black transition-all"
              >
                Explore Offers
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
