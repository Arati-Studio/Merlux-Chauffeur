import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Calendar, User, ArrowRight, Search, Loader2, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import SEO from '../components/SEO';
import { formatDate } from '../lib/utils';

const CATEGORIES = ["All", "Travel Tips", "Business", "Weddings", "Tours", "Industry", "Safety"];

export default function Blog() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const displayCategories = CATEGORIES.filter(cat => {
    if (cat === "All") return true;
    return posts.some(post => post.category === cat);
  });

  useEffect(() => {
    if (selectedCategory !== "All" && !displayCategories.includes(selectedCategory)) {
      setSelectedCategory("All");
    }
  }, [posts, selectedCategory]);

  useEffect(() => {
    const q = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const blogData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(blogData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.excerpt || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-y border-white/10 py-8">

          {/* Search — always visible, left side on desktop */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              placeholder="Search articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-6 text-sm focus:border-gold outline-none transition-all"
            />
          </div>

          {/* Mobile Dropdown */}
          <div className="relative md:hidden w-full">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="custom-select appearance-none w-full h-11 rounded-full pl-4 pr-9 text-[10px] font-bold uppercase tracking-widest text-gold focus:border-gold outline-none transition-all cursor-pointer"
            >
              {displayCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Desktop Pills — right side */}
          <div className="hidden md:flex flex-wrap gap-4">
            {displayCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`text-[10px] uppercase tracking-widest font-bold px-6 py-2 rounded-full border transition-all ${selectedCategory === cat
                  ? 'bg-gold border-gold text-black'
                  : 'border-white/10 text-white/60 hover:border-gold hover:text-gold'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

        </div>
      </section>

      {/* Blog Grid */}
      <section className="max-w-7xl mx-auto px-6">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="text-gold animate-spin" size={40} />
          </div>
        ) : filteredPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {filteredPosts.map((post, i) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group flex flex-col h-full"
              >
                <Link to={`/blog/${post.slug}`} className="block overflow-hidden rounded-3xl mb-6 aspect-[16/10] relative">
                  <img
                    src={post.featuredImage || post.image || null}
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
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {formatDate(post.createdAt || post.date || post.dateTime)}
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
