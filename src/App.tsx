import React, { lazy, Suspense, useState, useEffect } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Breadcrumbs from "./components/layout/Breadcrumbs";
import FloatingElements from "./components/FloatingElements";
import ScrollToTop from "./components/layout/ScrollToTop";
import { useSettings, SettingsProvider } from "./lib/SettingsContext";
import ProtectedRoute from "./components/ProtectedRoute";
import { OfflineDetector } from "./components/OfflineDetector";
import SearchDialog from "./components/SearchDialog";
import AnimatedPage from "./components/layout/AnimatedPage";
import { AnimatePresence } from "motion/react";
import { Helmet } from "react-helmet-async";
import { blogsFallback } from "./data/fallback/blogsFallback";
import { toursFallback } from "./data/fallback/toursFallback";
import { offersFallback } from "./data/fallback/offersFallback";
import { db } from "./lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, limit } from "firebase/firestore";

const Home = lazy(() => import("./pages/Home"));
const Booking = lazy(() => import("./pages/Booking"));
const Fleet = lazy(() => import("./pages/Fleet"));
const Services = lazy(() => import("./pages/Services"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const AppDashboard = lazy(() => import("./pages/AppDashboard"));
const Login = lazy(() => import("./pages/Login"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Terms = lazy(() => import("./pages/Terms"));
const DynamicPage = lazy(() => import("./pages/DynamicPage"));
const Offers = lazy(() => import("./pages/Offers"));
const Tours = lazy(() => import("./pages/Tours"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));

function DynamicSEO() {
  const location = useLocation();
  const pathname = location.pathname;
  const parts = pathname.split("/").filter(Boolean);

  const [meta, setMeta] = useState<{
    title: string;
    description: string;
    image: string;
    keywords?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (parts.length !== 2) {
      setMeta(null);
      return;
    }

    const section = parts[0];
    const slug = parts[1];
    if (!["blog", "tours", "offers"].includes(section)) {
      setMeta(null);
      return;
    }

    let active = true;
    setLoading(true);

    const fetchMeta = async () => {
      try {
        // 1. Try fetching from unified 'metadata' collection using docId: 'section_slug'
        const docId = `${section}_${slug}`;
        const metaDocRef = doc(db, "metadata", docId);
        const metaDocSnap = await getDoc(metaDocRef);

        if (metaDocSnap.exists() && active) {
          const data = metaDocSnap.data();
          setMeta({
            title: data.metaTitle || "",
            description: data.metaDescription || "",
            image: data.ogImage || "",
            keywords: Array.isArray(data.keywords) ? data.keywords.join(", ") : (data.keywords || ""),
          });
          setLoading(false);
          return;
        }

        // 2. Fall back to base collections
        let titleVal = "";
        let descVal = "";
        let imgVal = "";
        let kwsVal = "";

        const baseCollName = section === "blog" ? "blogs" : section; // "blog" is stored as "blogs"
        const q = query(collection(db, baseCollName), where("slug", "==", slug), limit(1));
        const baseSnap = await getDocs(q);

        if (!baseSnap.empty && active) {
          const baseData = baseSnap.docs[0].data();
          titleVal = baseData.metaTitle || baseData.title || "";
          descVal = baseData.metaDescription || baseData.seoDescription || baseData.description || baseData.shortDescription || "";
          imgVal = baseData.ogImage || baseData.featuredImage || baseData.image || "";
          kwsVal = Array.isArray(baseData.keywords) ? baseData.keywords.join(", ") : (baseData.keywords || "");
        } else {
          // 3. Last fallback to local hardcoded arrays
          if (section === "blog") {
            const post = blogsFallback.find((p) => p.slug === slug);
            if (post) {
              titleVal = post.metaTitle || `${post.title} | Merlux Journal`;
              descVal = post.metaDescription || post.excerpt;
              imgVal = post.featuredImage;
            }
          } else if (section === "tours") {
            const tour = toursFallback.find((t) => t.slug === slug);
            if (tour) {
              titleVal = `${tour.title} | Private Tours Melbourne`;
              descVal = tour.shortDescription;
              imgVal = tour.image;
            }
          } else if (section === "offers") {
            const offer = offersFallback.find((o) => o.slug === slug);
            if (offer) {
              titleVal = `${offer.title} | Exclusive Offers`;
              descVal = offer.description;
              imgVal = offer.image;
            }
          }
        }

        if (active) {
          setMeta({
            title: titleVal,
            description: descVal,
            image: imgVal,
            keywords: kwsVal,
          });
        }
      } catch (err) {
        console.error("Error fetching dynamic SEO metadata:", err);
        // Fall back to hardcoded data on error
        let titleVal = "";
        let descVal = "";
        let imgVal = "";
        if (section === "blog") {
          const post = blogsFallback.find((p) => p.slug === slug);
          if (post) {
            titleVal = post.metaTitle || `${post.title} | Merlux Journal`;
            descVal = post.metaDescription || post.excerpt;
            imgVal = post.featuredImage;
          }
        } else if (section === "tours") {
          const tour = toursFallback.find((t) => t.slug === slug);
          if (tour) {
            titleVal = `${tour.title} | Private Tours Melbourne`;
            descVal = tour.shortDescription;
            imgVal = tour.image;
          }
        } else if (section === "offers") {
          const offer = offersFallback.find((o) => o.slug === slug);
          if (offer) {
            titleVal = `${offer.title} | Exclusive Offers`;
            descVal = offer.description;
            imgVal = offer.image;
          }
        }
        if (active) {
          setMeta({ title: titleVal, description: descVal, image: imgVal });
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchMeta();

    return () => {
      active = false;
    };
  }, [pathname]);

  if (loading) {
    return (
      <Helmet>
        <title>Loading... | Merlux Chauffeur</title>
      </Helmet>
    );
  }

  if (!meta || !meta.title) return null;

  return (
    <Helmet>
      <title>{meta.title}</title>
      <meta name="description" content={meta.description} />
      {meta.keywords && <meta name="keywords" content={meta.keywords} />}
      <meta property="og:title" content={meta.title} />
      <meta property="og:description" content={meta.description} />
      {meta.image && <meta property="og:image" content={meta.image} />}
      <meta name="twitter:title" content={meta.title} />
      <meta name="twitter:description" content={meta.description} />
      {meta.image && <meta name="twitter:image" content={meta.image} />}
    </Helmet>
  );
}

function AppLayout() {
  const { floatingSettings } = useSettings();
  const barPosition = floatingSettings?.bar?.position || "top";

  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const location = useLocation();

  // Keyboard shortcut Ctrl+K / Cmd+K and global open-search event
  React.useEffect(() => {
    const handleOpenSearch = () => setIsSearchOpen(true);
    window.addEventListener("open-search-dialog", handleOpenSearch);

    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K
      if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("open-search-dialog", handleOpenSearch);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-gold selection:text-black flex flex-col">
      <DynamicSEO />
      <FloatingElements />
      <OfflineDetector />
      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <header className="sticky top-0 z-50 w-full pointer-events-none">
        <div className="pointer-events-auto">
          <Navbar />
        </div>
      </header>
      <Breadcrumbs />
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-8">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-y-2 border-gold shadow-[0_0_20px_rgba(212,175,55,0.2)]"></div>
              <div className="absolute inset-0 animate-pulse rounded-full bg-gold/5 blur-2xl"></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-gold text-xs font-bold uppercase tracking-[0.4em] animate-pulse">Loading Data...</h2>
              <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-gold/50 to-transparent"></div>
            </div>
          </div>
        </div>}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<AnimatedPage><Home /></AnimatedPage>} />
              <Route path="/booking" element={<AnimatedPage><Booking /></AnimatedPage>} />
              <Route path="/fleet" element={<AnimatedPage><Fleet /></AnimatedPage>} />
              <Route path="/services" element={<AnimatedPage><Services /></AnimatedPage>} />
              <Route path="/about" element={<AnimatedPage><About /></AnimatedPage>} />
              <Route path="/contact" element={<AnimatedPage><Contact /></AnimatedPage>} />
              <Route path="/blog" element={<AnimatedPage><Blog /></AnimatedPage>} />
              <Route path="/blog/:slug" element={<AnimatedPage><BlogPost /></AnimatedPage>} />
              <Route path="/faq" element={<AnimatedPage><FAQ /></AnimatedPage>} />
              <Route path="/offers" element={<AnimatedPage><Offers /></AnimatedPage>} />
              <Route path="/offers/:slug" element={<AnimatedPage><Offers /></AnimatedPage>} />
              <Route path="/tours" element={<AnimatedPage><Tours /></AnimatedPage>} />
              <Route path="/tours/:slug" element={<AnimatedPage><Tours /></AnimatedPage>} />
              <Route
                path="/app"
                element={
                  <ProtectedRoute>
                    <AnimatedPage>
                      <AppDashboard />
                    </AnimatedPage>
                  </ProtectedRoute>
                }
              />
              <Route path="/login" element={<AnimatedPage><Login /></AnimatedPage>} />
              <Route path="/payment/success" element={<AnimatedPage><PaymentSuccess /></AnimatedPage>} />
              <Route path="/terms" element={<AnimatedPage><Terms /></AnimatedPage>} />
              <Route path="/:slug" element={<AnimatedPage><DynamicPage /></AnimatedPage>} />
            </Routes>
          </AnimatePresence>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <Router>
          <ScrollToTop />
          <AppLayout />
        </Router>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
