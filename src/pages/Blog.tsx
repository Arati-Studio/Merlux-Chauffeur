import { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { Calendar, User, ArrowRight, Search, Loader2, Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import SEO from '../components/SEO';
import { formatDate, getAssetPath, cn } from '../lib/utils';
import { blogsFallback } from '../data/fallback/blogsFallback';

const DEFAULT_CATEGORIES = ["All", "Travel Tips", "Business", "Weddings", "Tours", "Industry", "Safety"];

export default function Blog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const ITEMS_PER_PAGE = 12;

  const categoryCounts = (() => {
    const counts: Record<string, number> = {};
    let totalActive = 0;
    posts.forEach(post => {
      const isActive = post.active !== false && (!post.publishAt || new Date(post.publishAt) <= new Date());
      if (isActive) {
        totalActive++;
        if (post.category) {
          counts[post.category] = (counts[post.category] || 0) + 1;
        }
      }
    });
    return { counts, totalActive };
  })();

  const displayCategories = (() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    posts.forEach(post => {
      if (post.category && post.active !== false && (!post.publishAt || new Date(post.publishAt) <= new Date())) {
        cats.add(post.category);
      }
    });
    return Array.from(cats);
  })();

  useEffect(() => {
    if (selectedCategory !== "All" && !displayCategories.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [posts, selectedCategory]);

  useEffect(() => {
    const q = query(collection(db, 'blogs'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const blogData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (blogData.length > 0) {
        setPosts(blogData);
      } else {
        setPosts(blogsFallback);
      }
      setLoading(false);
    }, (err) => {
      console.warn('Error fetching blogs, using fallback:', err);
      setPosts(blogsFallback);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  const filteredPosts = useMemo(() => {
    let result = posts.filter(post => {
      if (post.active === false) return false;
      if (post.publishAt && new Date(post.publishAt) > new Date()) return false;

      const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.excerpt || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    return result.sort((a, b) => {
      const dateA = new Date(a.publishAt || (a.createdAt?.toDate ? a.createdAt.toDate() : a.createdAt) || 0).getTime();
      const dateB = new Date(b.publishAt || (b.createdAt?.toDate ? b.createdAt.toDate() : b.createdAt) || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [posts, searchQuery, selectedCategory, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / ITEMS_PER_PAGE));

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPosts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredPosts, currentPage]);

  return (
    <div className="pt-16 pb-24 bg-black min-h-screen">
      <SEO 
        title="Luxury Travel Blog & Insights"
        description="Discover the latest trends in luxury travel, corporate transport, and regional Victoria tours. Professional chauffeur insights and news from Merlux."
      />
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Insights & News</span>
            <h1 className="text-4xl md:text-6xl font-display leading-tight">
              The Merlux <span className="text-gold italic">Journal</span>
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:pb-4"
          >
            <p className="text-white/60 text-sm leading-relaxed max-w-md">
              Discover the latest trends in luxury travel, corporate transport, and bespoke regional tours across Victoria.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filter & Search */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 border-y border-white/10 py-8">

          {/* Search — always visible, left side on desktop */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-6 text-sm focus:border-gold outline-none transition-all"
            />
          </div>

          {/* Dropdown - shown on all screen widths */}
          <div className="flex gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="custom-select appearance-none w-full h-11 rounded-full pl-5 pr-10 text-[10px] font-bold uppercase tracking-widest text-gold focus:border-gold outline-none transition-all cursor-pointer bg-white/5 border border-white/10"
              >
                {displayCategories.map(cat => {
                  const count = cat === "All" ? categoryCounts.totalActive : (categoryCounts.counts[cat] || 0);
                  return (
                    <option key={cat} value={cat} className="bg-[#111111] text-white py-2">
                      {cat} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            <button
              onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              className={cn(
                "h-11 px-5 bg-white/5 border border-white/10 rounded-full flex items-center justify-center gap-2 transition-all hover:border-gold group",
                sortOrder === 'asc' ? "text-gold" : "text-white/60"
              )}
              title={sortOrder === 'desc' ? "Sorted Newest First" : "Sorted Oldest First"}
            >
              <Calendar size={14} className={cn("transition-transform shrink-0", sortOrder === 'asc' && "rotate-180")} />
              <span className="text-[10px] font-bold uppercase invisible sm:visible sm:inline tracking-widest">
                {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
              </span>
            </button>
          </div>

        </div>
      </section>

      {/* Blog Grid */}
      <section className="max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="text-gold animate-spin" size={40} />
          </div>
        ) : paginatedPosts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {paginatedPosts.map((post, i) => (
                <motion.article
                  key={post.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.05 }}
                  className="group flex flex-col h-full"
                >
                  <Link to={`/blog/${post.slug}`} className="block overflow-hidden rounded-3xl mb-6 aspect-[16/10] relative">
                    <img
                      src={getAssetPath(post.featuredImage || post.image || null)}
                      alt={post.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                      <span className="bg-gold text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                        {post.category || 'Luxury Travel'}
                      </span>
                    </div>
                  </Link>
                  <div className="flex-grow">
                    <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-white/40 font-bold mb-4">
                      <span className="flex items-center gap-1 text-gold/80">
                        <Calendar size={12} className="shrink-0" />
                        {formatDate(post.publishAt || post.createdAt || post.date || post.dateTime)}
                      </span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime || post.readingTime || '5 min read'}</span>
                    </div>
                    <h3 className="text-2xl font-display mb-4 group-hover:text-gold transition-colors leading-snug">
                      <Link to={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>
                    <p className="text-white/50 text-sm leading-relaxed mb-6 line-clamp-3">
                      {post.excerpt || post.metaDescription}
                    </p>
                  </div>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold group-hover:gap-4 transition-all"
                  >
                    Read Full Article <ArrowRight size={14} />
                  </Link>
                </motion.article>
              ))}
            </div>

            {/* Next/Previous Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 mt-12 pb-4">
                <button
                  disabled={currentPage === 1}
                  onClick={() => {
                    setCurrentPage(p => Math.max(1, p - 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 text-white hover:border-gold hover:text-gold transition-all duration-300 disabled:opacity-20 disabled:hover:text-white disabled:hover:border-white/10 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-white/40">
                  Page <span className="text-gold font-black">{currentPage}</span> of {totalPages}
                </span>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => {
                    setCurrentPage(p => Math.min(totalPages, p + 1));
                    window.scrollTo({ top: 400, behavior: 'smooth' });
                  }}
                  className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 text-white hover:border-gold hover:text-gold transition-all duration-300 disabled:opacity-20 disabled:hover:text-white disabled:hover:border-white/10 cursor-pointer"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-white/40 italic">No articles found matching your criteria.</p>
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-6 mt-32">
        <div className="bg-gradient-to-br from-[#1a1506] via-[#2a1f04] to-[#1a1506] border border-gold/25 rounded-[3rem] p-6 md:p-10 text-black text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white blur-[120px] rounded-full rotate-45" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block text-gold">Ready to Experience?</span>
            <h2 className="text-4xl md:text-6xl font-display mb-8 text-gold">Reserve Your <span className="text-white italic">Luxury Ride</span></h2>
            <p className="text-white/70 mb-10 text-lg leading-relaxed text-balance ">
              Explore our curated selection of exclusive offers and bespoke regional tours. Your premium journey begins here.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/offers" 
                className="bg-gold-dark text-white px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-2xl"
              >
                Explore Offers
              </Link>
              <Link 
                to="/tours" 
                className="bg-white backdrop-blur-md border border-black/10 text-black px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-gold hover:text-white transition-all"
              >
                View All Tours
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
