import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar, User, ArrowLeft, Clock, Share2, Loader2, ArrowRight, Map, Gift, Shield } from 'lucide-react';
import { useSettings } from '../lib/SettingsContext';
import { generateDescriptionFromContent } from '../lib/seo';
import { formatDate, getAssetPath } from '../lib/utils';
import Comments from '../components/Comments';
import { FormNotice, NoticeType } from '../components/FormNotice';
import SEO from '../components/SEO';

export default function BlogPost() {
  const { slug } = useParams();
  const { settings } = useSettings();
  const [post, setPost] = useState<any>(null);
  const [postId, setPostId] = useState<string>('');
  const [relatedPosts, setRelatedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 5000);
  };

  useEffect(() => {
    const fetchPost = async () => {
      setLoading(true);
      if (!slug) return;

      try {
        // Try fetching by slug first
        const q = query(collection(db, 'blogs'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);

        let targetDoc: any = null;
        let targetId: string = '';

        if (!snap.empty) {
          targetDoc = snap.docs[0].data();
          targetId = snap.docs[0].id;
        } else {
          // If slug fails, try fetching by ID as fallback
          try {
            const directDoc = await getDoc(doc(db, 'blogs', slug));
            if (directDoc.exists()) {
              targetDoc = directDoc.data();
              targetId = directDoc.id;
            }
          } catch (e) {
            console.warn("Direct ID lookup failed", e);
          }
        }

        if (targetDoc) {
          setPost(targetDoc);
          setPostId(targetId);
          setError(false);

          // Fetch Related Posts
          const relatedQ = query(
            collection(db, 'blogs'),
            where('slug', '!=', targetDoc.slug || ''),
            limit(3)
          );
          const relatedSnap = await getDocs(relatedQ);
          setRelatedPosts(relatedSnap.docs.map(d => ({ id: d.id, ...d.data() })));

          window.scrollTo(0, 0);

          // Global CMS CSS Injection
          const globalStyleId = 'global-cms-css';
          let globalStyleTag = document.getElementById(globalStyleId);
          if (settings?.seo?.globalCmsCss && settings?.seo?.isGlobalCssActive !== false) {
            if (!globalStyleTag) {
              globalStyleTag = document.createElement('style');
              globalStyleTag.id = globalStyleId;
              document.head.appendChild(globalStyleTag);
            }
            // Scope CSS to content area
            const scopedGlobal = settings.seo.globalCmsCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m: string) =>
              m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')
            );
            globalStyleTag.innerHTML = scopedGlobal;
          } else if (globalStyleTag) {
            globalStyleTag.remove();
          }

          // Individual CSS Injection
          const styleId = `blog-css-${slug}`;
          let styleTag = document.getElementById(styleId);
          if (targetDoc.customCss && targetDoc.isCustomCssActive !== false) {
            if (!styleTag) {
              styleTag = document.createElement('style');
              styleTag.id = styleId;
              document.head.appendChild(styleTag);
            }
            // Scope CSS to content area
            const scopedIndividual = targetDoc.customCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m: string) =>
              m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')
            );
            styleTag.innerHTML = scopedIndividual;
          } else if (styleTag) {
            styleTag.remove();
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching blog post:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchPost();

    return () => {
      // Individual CSS cleanup
      const styleId = `blog-css-${slug}`;
      const styleTag = document.getElementById(styleId);
      if (styleTag) styleTag.remove();

      // Global CSS cleanup
      const globalStyleId = 'global-cms-css';
      const globalStyleTag = document.getElementById(globalStyleId);
      if (globalStyleTag) globalStyleTag.remove();
    };
  }, [slug, settings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" size={40} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-black pt-32 px-6 text-center">
        <h1 className="text-4xl font-display mb-6">Article Not Found</h1>
        <p className="text-white/60 mb-8">The story you're looking for might have moved.</p>
        <Link to="/blog" className="bg-gold text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all">
          Back to Journal
        </Link>
      </div>
    );
  }

  const articleDate = formatDate(post.createdAt || post.date);

  return (
    <div className="bg-black min-h-screen pb-24">
      <SEO 
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt || generateDescriptionFromContent(post.content)}
        keywords={Array.isArray(post.keywords) ? post.keywords.join(', ') : post.keywords}
        ogImage={getAssetPath(post.featuredImage || post.image)}
        ogType="article"
        noindex={post.noindex}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": post.title,
          "image": [getAssetPath(post.featuredImage || post.image)],
          "datePublished": post.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          "author": [{
            "@type": "Organization",
            "name": "Merlux Chauffeur Services",
            "url": window.location.origin
          }]
        }}
      />
      {/* Back Button and Featured Image Hero */}
      <section className="relative h-[70vh] w-full overflow-hidden">
        <img
          src={getAssetPath(post.featuredImage || post.image)}
          alt={post.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        <AnimatePresence>
          {notice && (
            <FormNotice
              type={notice.type}
              message={notice.message}
              onClose={() => setNotice(null)}
            />
          )}
        </AnimatePresence>

        <div className="absolute inset-0 z-10 flex flex-col justify-end px-6 pb-8">
          <div className="max-w-7xl mx-auto w-full">

            {/* Button directly above heading */}
            <div className="inline-flex bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full mb-5">
              <Link
                to="/blog"
                className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold hover:gap-4 transition-all"
              >
                <ArrowLeft size={14} /> Back to Journal
              </Link>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl"
            >
              <h1 className="text-3xl md:text-5xl font-display leading-tight mb-8">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-[10px] uppercase tracking-widest text-white/60 font-bold">
                <span className="bg-gold text-black px-3 py-1 rounded-full">
                  {post.category || 'Luxury Travel'}
                </span>
                <span className="flex items-center gap-2 border-l border-white/20 pl-6">
                  <Calendar size={12} className="text-gold" /> {articleDate}
                </span>
                <span className="flex items-center gap-2 border-l border-white/20 pl-6">
                  <Clock size={12} className="text-gold" /> {post.readingTime || post.readTime || '5 MIN READ'}
                </span>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      <article className="max-w-7xl mx-auto px-6 pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
            <div
              className="cms-rendered-content prose prose-invert prose-gold max-w-none prose-p:text-white/70 prose-p:leading-relaxed prose-p:text-lg prose-headings:font-display prose-headings:text-white prose-li:text-white/70"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Share at bottom of content */}
            <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between">
              <p className="text-[10px] uppercase text-white/40 font-bold">End of Article</p>
              <div className="flex items-center gap-4">
                <span className="text-[10px] uppercase text-gold font-bold tracking-widest">Share this article</span>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: post.title, url: window.location.href })
                        .then(() => showNotice('success', 'Shared successfully.'))
                        .catch(() => { });
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      showNotice('success', 'Link copied to clipboard.');
                    }
                  }}
                  className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-gold hover:text-black transition-all border border-white/10"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>

            {/* Related Blogs Section */}
            {relatedPosts.length > 0 && (
              <div className="mt-24 pt-24 border-t border-white/5">
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Keep Reading</span>
                    <h2 className="text-4xl font-display">Related <span className="text-gold italic">Stories</span></h2>
                  </div>
                  <Link to="/blog" className="text-gold text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:gap-4 transition-all">
                    View Journal <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {relatedPosts.map((r, i) => (
                    <Link key={r.id} to={`/blog/${r.slug}`} className="group">
                      <div className="aspect-[4/5] rounded-3xl overflow-hidden mb-6 relative">
                        <img src={getAssetPath(r.featuredImage)} alt={r.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-all" />
                        <div className="absolute bottom-6 left-6 right-6">
                          <span className="text-gold text-[8px] uppercase tracking-widest font-bold mb-2 block">{r.category}</span>
                          <h4 className="text-lg font-display leading-tight">{r.title}</h4>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            <Comments targetId={postId} targetType="blog" />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4">
            <div className="sticky top-32 space-y-12">
              <div className="glass p-8 rounded-[2rem] border border-gold/20 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 blur-[2px] transition-all duration-700 group-hover:scale-110 group-hover:opacity-20 group-hover:blur-none">
                  <Shield size={120} className="text-gold" />
                </div>
                <div className="relative z-10">
                  <span className="text-[10px] uppercase tracking-widest text-gold font-bold mb-2 block">Premium Service</span>
                  <h3 className="text-3xl font-display mb-4 leading-tight">Elite Travel Awaits</h3>
                  <p className="text-white/60 text-sm mb-8 leading-relaxed">Experience a new standard of luxury transport in Melbourne. Discover our exclusive fleet and personalized services.</p>
                  <Link to="/booking" className="btn-gold w-full flex items-center justify-center gap-2 relative overflow-hidden group/btn">
                    <span className="relative z-10 flex items-center gap-2">Book Your Journey <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" /></span>
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Link to="/tours" className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20 text-gold group-hover:scale-110 transition-transform">
                      <Map size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 group-hover:text-gold transition-colors">Private Tours</h4>
                      <p className="text-xs text-white/50">Explore bespoke itineraries</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-white/30 group-hover:text-gold transition-colors group-hover:translate-x-1" />
                </Link>

                <Link to="/offers" className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center border border-gold/20 text-gold group-hover:scale-110 transition-transform">
                      <Gift size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-white mb-1 group-hover:text-gold transition-colors">Special Offers</h4>
                      <p className="text-xs text-white/50">View exclusive packages</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-white/30 group-hover:text-gold transition-colors group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
