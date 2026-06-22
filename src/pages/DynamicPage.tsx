import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc, orderBy } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, ArrowRight, Share2, Map, Gift, Shield } from 'lucide-react';
import { useSettings } from '../lib/SettingsContext';
import { generateDescriptionFromContent } from '../lib/seo';
import Comments from '../components/Comments';
import { FormNotice, NoticeType } from '../components/FormNotice';
import SEO from '../components/SEO';
import { pagesFallback } from '../data/fallback/pagesFallback';

export default function DynamicPage() {
  const { slug } = useParams();
  const { settings } = useSettings();
  const [pageData, setPageData] = useState<any>(null);
  const [pageId, setPageId] = useState<string>('');
  const [relatedPages, setRelatedPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string } | null>(null);

  const showNotice = (type: NoticeType, message: string) => {
    setNotice({ type, message });
    setTimeout(() => setNotice(null), 5000);
  };

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      let targetDoc: any = null;
      let idVal = '';
      let relatedList: any[] = [];

      try {
        const q = query(collection(db, 'pages'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);

        if (!snap.empty) {
          const docSnap = snap.docs[0];
          targetDoc = docSnap.data();
          idVal = docSnap.id;

          // Fetch Related Pages
          const relatedQ = query(
            collection(db, 'pages'),
            where('slug', '!=', slug),
            limit(10)
          );
          const relatedSnap = await getDocs(relatedQ);
          relatedList = relatedSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((p: any) => p.active !== false && (!p.publishAt || new Date(p.publishAt) <= new Date()))
            .slice(0, 3);
        }
      } catch (dbErr) {
        console.warn("Firestore pages query failed, checking fallback:", dbErr);
      }

      // If page was not found in Firestore or query errored, check fallback database
      if (!targetDoc) {
        const matched = pagesFallback.find(p => p.slug === slug);
        if (matched) {
          targetDoc = matched;
          idVal = matched.id;
          relatedList = pagesFallback
            .filter(p => p.slug !== slug && p.active !== false && (!p.publishAt || new Date(p.publishAt) <= new Date()))
            .slice(0, 3);
        }
      }

      if (targetDoc) {
        // Check if page is active and released
        const isNotActive = targetDoc.active === false;
        const isFuture = targetDoc.publishAt && new Date(targetDoc.publishAt) > new Date();
        if (isNotActive || isFuture) {
          setError(true);
          setLoading(false);
          return;
        }

        setPageData(targetDoc);
        setPageId(idVal);
        setError(false);
        setRelatedPages(relatedList);

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
          // Scope CSS to content area using modern CSS nesting
          const scopedGlobal = `.cms-rendered-content { ${settings.seo.globalCmsCss} }`;
          globalStyleTag.innerHTML = scopedGlobal;
        } else if (globalStyleTag) {
          globalStyleTag.remove();
        }

        // Individual CSS Injection
        const styleId = `page-css-${slug}`;
        let styleTag = document.getElementById(styleId);
        if (targetDoc.customCss && targetDoc.isCustomCssActive !== false) {
          if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleId;
            document.head.appendChild(styleTag);
          }
          // Scope CSS to content area using modern CSS nesting
          const scopedIndividual = `.cms-rendered-content { ${targetDoc.customCss} }`;
          styleTag.innerHTML = scopedIndividual;
        } else if (styleTag) {
          styleTag.remove();
        }
      } else {
        setError(true);
      }
      setLoading(false);
    };

    if (slug) fetchPage();

    return () => {
      // Individual CSS cleanup
      const styleId = `page-css-${slug}`;
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
      <div className="bg-black min-h-screen pb-24">
        {/* Skeleton Hero Section */}
        <div className="relative h-[70vh] w-full overflow-hidden bg-white/5 animate-pulse">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          
          <div className="absolute bottom-16 left-0 right-0 z-10 font-sans">
            <div className="max-w-7xl mx-auto px-6">
              <div className="max-w-4xl space-y-4">
                {/* Back Button Skeleton */}
                <div className="w-40 h-6 bg-white/10 rounded-full" />
                {/* Title Skeletons */}
                <div className="w-3/4 h-12 md:h-16 bg-white/10 rounded-lg animate-pulse" />
                <div className="w-1/2 h-8 bg-white/10 rounded-lg animate-pulse" />
                {/* Category tag skeleton */}
                <div className="w-24 h-6 bg-white/10 rounded-full mt-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Skeleton Article Section */}
        <div className="max-w-7xl mx-auto px-6 pt-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Main Content Area */}
            <div className="lg:col-span-8 space-y-8">
              {/* Content Paragraph Skeletons */}
              <div className="space-y-4 animate-pulse">
                <div className="h-4 bg-white/10 rounded-md w-full" />
                <div className="h-4 bg-white/10 rounded-md w-11/12" />
                <div className="h-4 bg-white/10 rounded-md w-10/12" />
                <div className="h-4 bg-white/10 rounded-md w-9/12" />
              </div>
              <div className="space-y-4 pt-6 animate-pulse">
                <div className="h-6 bg-white/10 rounded-md w-1/3 mb-4" />
                <div className="h-4 bg-white/10 rounded-md w-full" />
                <div className="h-4 bg-white/10 rounded-md w-full" />
                <div className="h-4 bg-white/10 rounded-md w-5/6" />
              </div>
              <div className="space-y-4 pt-6 animate-pulse">
                <div className="h-4 bg-white/10 rounded-md w-full" />
                <div className="h-4 bg-white/10 rounded-md w-11/12" />
                <div className="h-4 bg-white/10 rounded-md w-4/5" />
              </div>

              {/* End of experience separator skeleton */}
              <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between animate-pulse">
                <div className="w-28 h-3 bg-white/10 rounded-md" />
                <div className="flex items-center gap-4">
                  <div className="w-24 h-3 bg-white/10 rounded-md" />
                  <div className="w-10 h-10 bg-white/10 rounded-full" />
                </div>
              </div>

              {/* Related experiences skeleton */}
              <div className="mt-24 pt-24 border-t border-white/5 space-y-8">
                <div className="flex justify-between items-end animate-pulse">
                  <div className="space-y-3">
                    <div className="w-28 h-3 bg-white/10 rounded-md" />
                    <div className="w-48 h-8 bg-white/10 rounded-md" />
                  </div>
                  <div className="w-20 h-4 bg-white/10 rounded-md" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="space-y-4 animate-pulse">
                      <div className="aspect-[4/5] rounded-3xl bg-white/10" />
                      <div className="space-y-3">
                        <div className="w-16 h-3 bg-white/10 rounded-md" />
                        <div className="w-full h-5 bg-white/10 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Sticky Area */}
            <div className="lg:col-span-4 space-y-12">
              {/* Glass Booking block */}
              <div className="glass p-8 rounded-[2rem] border border-white/5 space-y-6 animate-pulse">
                <div className="w-24 h-3 bg-white/10 rounded-md" />
                <div className="space-y-3">
                  <div className="w-3/4 h-8 bg-white/10 rounded-md" />
                  <div className="w-1/2 h-8 bg-white/10 rounded-md" />
                </div>
                <div className="space-y-3">
                  <div className="w-full h-4 bg-white/10 rounded-md" />
                  <div className="w-5/6 h-4 bg-white/10 rounded-md" />
                </div>
                <div className="w-full h-12 bg-white/10 rounded-full mt-4" />
              </div>

              {/* Sidebar list items */}
              <div className="space-y-4">
                {[1, 2].map((n) => (
                  <div key={n} className="glass p-6 rounded-2xl border border-white/5 flex items-center justify-between animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-white/10" />
                      <div className="space-y-3">
                        <div className="w-28 h-4 bg-white/10 rounded-md" />
                        <div className="w-36 h-3 bg-white/10 rounded-md" />
                      </div>
                    </div>
                    <div className="w-4 h-4 bg-white/10 rounded-full" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-black pt-32 px-6 text-center">
        <SEO
          title="Page Not Found"
          robots="noindex, nofollow"
        />
        <h1 className="text-4xl font-display mb-6">Page Not Found</h1>
        <p className="text-white/60 mb-8">The luxury experience you're looking for might have moved.</p>
        <Link to="/" className="bg-gold text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-black min-h-screen pb-24">
      <SEO
        title={pageData.metaTitle || pageData.title}
        description={pageData.metaDescription || generateDescriptionFromContent(pageData.content)}
        keywords={Array.isArray(pageData.keywords) ? pageData.keywords.join(', ') : pageData.keywords}
        ogImage={pageData.featuredImage || pageData.ogImage}
        noindex={pageData.noindex}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": pageData.title,
          "description": pageData.metaDescription,
          "publisher": {
            "@type": "Organization",
            "name": "Merlux Chauffeur Services"
          }
        }}
      />
      {/* Featured Image Hero */}
      <section className="relative h-[70vh] w-full overflow-hidden">
        <img
          src={pageData.featuredImage || pageData.ogImage || 'https://picsum.photos/seed/luxury/1920/1080'}
          alt={pageData.title}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

        {/* Navigation Over Image */}
        <AnimatePresence>
          {notice && (
            <FormNotice
              type={notice.type}
              message={notice.message}
              onClose={() => setNotice(null)}
            />
          )}
        </AnimatePresence>

        {/* Heading Over Image (Bottom Left) */}
        <div className="absolute bottom-16 left-0 right-0 z-10">
          <div className="max-w-7xl mx-auto px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-4xl"
            >
              {/* Button directly above heading */}
              <div className="inline-flex bg-black/40 backdrop-blur-sm px-4 py-2 rounded-full mb-5">
                <Link
                  to="/services"
                  className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold hover:gap-4 transition-all"
                >
                  <ArrowLeft size={14} /> Back to Services
                </Link>
              </div>
              <h1 className="text-4xl md:text-7xl font-display leading-tight">
                {pageData.title}
              </h1>
              {pageData.category && (
                <span className="bg-gold text-black px-3 py-1 rounded-full text-[10px] uppercase tracking-widest font-bold mb-6 inline-block">
                  {pageData.category}
                </span>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      <article className="max-w-7xl mx-auto px-6 pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
            <div
              className="cms-rendered-content prose prose-invert prose-gold max-w-none prose-p:text-white/70 prose-p:leading-relaxed prose-p:text-lg prose-headings:font-display prose-headings:text-white prose-li:text-white/70"
              dangerouslySetInnerHTML={{ __html: pageData.content }}
            />

            {/* Share at bottom */}
            <div className="mt-16 pt-8 border-t border-white/10 flex items-center justify-between">
              <p className="text-[10px] uppercase text-white/40 font-bold">End of Experience</p>
              <div className="flex items-center gap-4">
                <span className="text-[10px] uppercase text-gold font-bold tracking-widest">Share this page</span>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({ title: pageData.title, url: window.location.href })
                        .then(() => showNotice('success', 'Page shared successfully.'))
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

            {/* Related Pages Section */}
            {relatedPages.length > 0 && (
              <div className="mt-24 pt-24 border-t border-white/5">
                <div className="flex justify-between items-end mb-12">
                  <div>
                    <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">More Discoveries</span>
                    <h2 className="text-4xl font-display">Related <span className="text-gold italic">Experiences</span></h2>
                  </div>
                  <Link to="/services" className="text-gold text-[10px] uppercase tracking-widest font-bold flex items-center gap-2 hover:gap-4 transition-all">
                    All Services <ArrowRight size={14} />
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {relatedPages.map((r, i) => (
                    <Link key={r.id} to={`/${r.slug}`} className="group">
                      <div className="aspect-[4/5] rounded-3xl overflow-hidden mb-6 relative">
                        <img src={r.featuredImage || r.ogImage} alt={r.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
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
            <Comments targetId={pageId} targetType="page" />
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
                  <h3 className="text-3xl font-display mb-4 leading-tight">Book Your Journey</h3>
                  <p className="text-white/60 text-sm mb-8 leading-relaxed">Secure your premium chauffeur service in seconds. Travel with unmatched elegance.</p>
                  <Link to="/booking" className="btn-gold w-full flex items-center justify-center gap-2 relative overflow-hidden group/btn">
                    <span className="relative z-10 flex items-center gap-2">Reserve Now <ArrowRight size={16} className="group-hover/btn:translate-x-1 transition-transform" /></span>
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
