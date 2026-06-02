import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Booking from './pages/Booking';
import Fleet from './pages/Fleet';
import Services from './pages/Services';
import About from './pages/About';
import Contact from './pages/Contact';
import AppDashboard from './pages/AppDashboard';
import Login from './pages/Login';
import Blog from './pages/Blog';
import BlogPost from './pages/BlogPost';
import FAQ from './pages/FAQ';
import Terms from './pages/Terms';
import DynamicPage from './pages/DynamicPage';
import Offers from './pages/Offers';
import Tours from './pages/Tours';
import PaymentSuccess from './pages/PaymentSuccess';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import FloatingElements from './components/FloatingElements';
import ScrollToTop from './components/layout/ScrollToTop';

import { useSettings, SettingsProvider } from './lib/SettingsContext';
import ProtectedRoute from './components/ProtectedRoute';

function AppLayout() {
  const { floatingSettings } = useSettings();
  const barPosition = floatingSettings?.bar?.position || 'top';
  
  // Custom Toaster Settings
  const toastSettings = floatingSettings?.toast || {};
  
  // Responsive Position
  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const isMobile = windowWidth < 768;

  let toastPosition = toastSettings?.position?.desktop || 'top-right';
  if (isMobile) toastPosition = toastSettings?.position?.mobile || 'top-center';

  // Responsive Width
  let toastWidth = toastSettings?.width?.desktop || 'auto';
  if (isMobile) toastWidth = toastSettings?.width?.mobile || 'calc(100% - 32px)';

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-gold selection:text-black flex flex-col">
      <Toaster 
        position={toastPosition as any}
        containerStyle={{
          top: toastSettings?.offset ? Number(toastSettings.offset) : 16,
          left: toastSettings?.offset ? Number(toastSettings.offset) : 16,
          bottom: toastSettings?.offset ? Number(toastSettings.offset) : 16,
          right: toastSettings?.offset ? Number(toastSettings.offset) : 16,
        }}
        toastOptions={{
          className: 'glass !text-white !rounded-2xl !font-bold !tracking-[0.1em] !uppercase !backdrop-blur-xl',
          duration: toastSettings?.duration || 5000,
          style: {
            background: toastSettings?.bgColors?.default || 'rgba(0, 0, 0, 0.8)',
            color: '#fff',
            border: `1px solid ${toastSettings?.colors?.default || 'rgba(212, 175, 55, 0.3)'}`,
            backdropFilter: 'blur(12px)',
            width: toastWidth,
            padding: toastSettings?.padding ? `${toastSettings.padding}px` : '16px',
            maxWidth: '100%',
          },
          success: {
            iconTheme: {
              primary: toastSettings?.colors?.success || '#D4AF37',
              secondary: '#000',
            },
            style: {
              background: toastSettings?.bgColors?.success || 'rgba(0, 0, 0, 0.8)',
              border: `1px solid ${toastSettings?.colors?.success || 'rgba(212, 175, 55, 0.3)'}`,
            }
          },
          error: {
            iconTheme: {
              primary: toastSettings?.colors?.error || '#EF4444',
              secondary: '#000',
            },
            style: {
              background: toastSettings?.bgColors?.error || 'rgba(0, 0, 0, 0.8)',
              border: `1px solid ${toastSettings?.colors?.error || 'rgba(239, 68, 68, 0.3)'}`,
            }
          },
        }}
      />
      <FloatingElements />
      <header className="sticky top-0 z-50 w-full pointer-events-none">
        <div className="pointer-events-auto">
          <Navbar />
        </div>
      </header>
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/fleet" element={<Fleet />} />
          <Route path="/services" element={<Services />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/blog/:slug" element={<BlogPost />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/offers" element={<Offers />} />
          <Route path="/offers/:slug" element={<Offers />} />
          <Route path="/tours" element={<Tours />} />
          <Route path="/tours/:slug" element={<Tours />} />
          <Route path="/app" element={
            <ProtectedRoute>
              <AppDashboard />
            </ProtectedRoute>
          } />
          <Route path="/login" element={<Login />} />
          <Route path="/payment/success" element={<PaymentSuccess />} />
          <Route path="/terms" element={<Terms />} />
          {/* Dynamic SEO Pages */}
          <Route path="/:slug" element={<DynamicPage />} />
        </Routes>
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
