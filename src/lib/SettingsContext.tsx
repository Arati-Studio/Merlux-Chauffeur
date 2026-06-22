import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { db } from './firebase';
import { settingsFallback } from '../data/fallback/settingsFallback';
import { floatingFallback } from '../data/fallback/floatingFallback';
import { cmsFallback } from '../data/fallback/cmsFallback';

interface SettingsContextType {
  settings: any;
  floatingSettings: any;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// Dev only helper to mirror actual Firestore live contents to src/data/fallback/*.ts
async function attemptSyncBack(type: string, content: string) {
  try {
    await fetch('/api/dev/sync-back', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, content })
    });
  } catch (err) {
    // Silently proceed if server/api is offline or unreachable
  }
}

// Helper to deeply merge local fallback data with optional database records
function mergeFallback(dbData: any, localFallback: any) {
  if (!dbData) return localFallback;
  return {
    ...localFallback,
    ...dbData,
    contact: { ...(localFallback.contact || {}), ...(dbData.contact || {}) },
    pricing: { ...(localFallback.pricing || {}), ...(dbData.pricing || {}) },
    company: { ...(localFallback.company || {}), ...(dbData.company || {}) },
    bbox: { ...(localFallback.bbox || {}), ...(dbData.bbox || {}) },
    styleFlags: { ...(localFallback.styleFlags || {}), ...(dbData.styleFlags || {}) },
    menus: { ...(localFallback.menus || {}), ...(dbData.menus || {}) },
    seo: { ...(localFallback.seo || {}), ...(dbData.seo || {}) }
  };
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<any>(() => {
    // Start with fully combined system settings + cms fallback
    return {
      ...settingsFallback,
      menus: cmsFallback.menus,
      seo: cmsFallback.seo,
      categories: cmsFallback.categories,
      tags: cmsFallback.tags
    };
  });
  const [floatingSettings, setFloatingSettings] = useState<any>(floatingFallback);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'system');
    const floatingRef = doc(db, 'settings', 'floating');
    const faqsRef = collection(db, 'faqs');

    const unsubscribeSystem = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        const dbData = docSnap.data();
        const baseFallback = {
          ...settingsFallback,
          menus: cmsFallback.menus,
          seo: cmsFallback.seo,
          categories: cmsFallback.categories,
          tags: cmsFallback.tags
        };
        setSettings(mergeFallback(dbData, baseFallback));

        // Format and push code-generation file for offline/fallback mode
        const contact = {
          address: dbData?.contact?.address || "Collins Street, Melbourne VIC 3000, Australia",
          phone: dbData?.contact?.phone || "+61 3 0000 0000",
          email: dbData?.contact?.email || "bookings@merlux.com.au",
          bookingEmail: dbData?.contact?.bookingEmail || "bookings@merlux.com.au"
        };
        const pricing = {
          baseRate: dbData?.pricing?.baseRate ?? dbData?.basePrice ?? 85,
          perKmRate: dbData?.pricing?.perKmRate ?? dbData?.kmPrice ?? 4.5,
          perMinuteRate: dbData?.pricing?.perMinuteRate ?? 1.5,
          airportSurcharge: dbData?.pricing?.airportSurcharge ?? 25,
          nightSurcharge: dbData?.pricing?.nightSurcharge ?? 20,
          nightBonusPercent: dbData?.pricing?.nightBonusPercent ?? 15
        };
        const company = {
          name: dbData?.company?.name || "Merlux Chauffeur",
          description: dbData?.company?.description || "Melbourne's premier luxury chauffeur service provider.",
          logoUrl: dbData?.company?.logoUrl || "",
          footerText: dbData?.company?.footerText || "© 2026 Merlux Chauffeur. All rights reserved.",
          socialLinks: dbData?.company?.socialLinks || {
            facebook: "https://facebook.com/merlux",
            instagram: "https://instagram.com/merlux",
            linkedin: "https://linkedin.com/company/merlux"
          }
        };
        const bbox = dbData?.bbox || { north: -37.5, south: -38.5, east: 145.5, west: 144.5 };
        const styleFlags = dbData?.styleFlags || { enableGradients: true, useGoldTheme: true, roundedDesign: true };

        const settingsContent = `export interface SystemSettings {
  contact: {
    address: string;
    phone: string;
    email: string;
    bookingEmail: string;
  };
  pricing: {
    baseRate: number;
    perKmRate: number;
    perMinuteRate: number;
    airportSurcharge: number;
    nightSurcharge: number;
    nightBonusPercent: number;
  };
  company: {
    name: string;
    description: string;
    logoUrl?: string;
    footerText: string;
    socialLinks: {
      facebook?: string;
      instagram?: string;
      linkedin?: string;
      twitter?: string;
    };
  };
  bbox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  styleFlags: {
    enableGradients: boolean;
    useGoldTheme: boolean;
    roundedDesign: boolean;
  };
}

export const settingsFallback: SystemSettings = ${JSON.stringify({ contact, pricing, company, bbox, styleFlags }, null, 2)};
`;
        attemptSyncBack('settingsFallback', settingsContent);

        const menus = dbData?.menus || {
          headerActive: true,
          footerActive: true,
          servicesActive: true,
          header: [
            { label: "Home", url: "/" },
            { label: "Booking", url: "/booking" },
            { label: "Fleet", url: "/fleet" },
            { label: "Services", url: "/services" },
            { label: "Tours", url: "/tours" },
            { label: "Offers", url: "/offers" },
            { label: "About", url: "/about" },
            { label: "Contact", url: "/contact" }
          ],
          footer: [
            { label: "Home", url: "/" },
            { label: "Fleet", url: "/fleet" },
            { label: "Services", url: "/services" },
            { label: "About Us", url: "/about" },
            { label: "Contact Us", url: "/contact" },
            { label: "Blog & Stories", url: "/blog" }
          ],
          services: [
            { label: "Airport Transfers", url: "/services" },
            { label: "Corporate Travel", url: "/services" },
            { label: "Wedding Chauffeur", url: "/services" },
            { label: "Private Customized Tours", url: "/services" },
            { label: "Event Transfer Services", url: "/services" },
            { label: "Hourly Premium Hire", url: "/services" }
          ]
        };
        const seo = dbData?.seo || {
          siteName: "Merlux Chauffeur",
          defaultTitle: "Melbourne Luxury Chauffeur Services",
          titleTemplate: "%s | Merlux Chauffeur Melbourne",
          defaultDescription: "Melbourne's premier executive chauffeur service. Premium airport transfers, corporate luxury cars, wedding travel, and hourly hires.",
          keywords: ["chauffeur", "melbourne", "luxury car service", "airport transfer", "corporate travel", "mercedes s class"],
          noindex: false
        };
        const categories = dbData?.categories || ["Travel Tips", "Elite Chauffeur", "Fleet Showcases", "Melbourne Guides", "Company News"];
        const tags = dbData?.tags || ["Luxury", "Melbourne", "Airport", "Business", "Prestige", "VIP"];

        const cmsContent = `export interface MenuItem {
  id?: string;
  label: string;
  url: string;
  isMore?: boolean;
  items?: Array<{ label: string; url: string }>;
}

export interface CMSFallback {
  menus: {
    headerActive: boolean;
    footerActive: boolean;
    servicesActive: boolean;
    header: MenuItem[];
    footer: MenuItem[];
    services: MenuItem[];
  };
  seo: {
    siteName: string;
    defaultTitle: string;
    titleTemplate: string;
    defaultDescription: string;
    keywords: string[];
    noindex: boolean;
  };
  categories: string[];
  tags: string[];
}

export const cmsFallback: CMSFallback = ${JSON.stringify({ menus, seo, categories, tags }, null, 2)};
`;
        attemptSyncBack('cmsFallback', cmsContent);
      }
    }, (err) => {
      console.warn('System settings live subscription failed, utilizing static settings fallback:', err);
    });

    const unsubscribeFloating = onSnapshot(floatingRef, (docSnap) => {
      if (docSnap.exists()) {
        const dbData = docSnap.data();
        setFloatingSettings({
          ...floatingFallback,
          ...dbData,
          social: { ...(floatingFallback.social || {}), ...(dbData.social || {}) },
          scrollTop: { ...(floatingFallback.scrollTop || {}), ...(dbData.scrollTop || {}) },
          bars: Array.isArray(dbData.bars) ? dbData.bars : (floatingFallback.bars || []),
          popups: Array.isArray(dbData.popups) ? dbData.popups : (floatingFallback.popups || [])
        });

        // Sync floating options
        const floatSocial = dbData.social || {
          active: true,
          position: "right-bottom",
          icons: [
            { id: "s1", platform: "phone", url: "tel:+61300000000", active: true, color: "#D4AF37" },
            { id: "s2", platform: "mail", url: "mailto:bookings@merlux.com.au", active: true, color: "#ffffff" },
            { id: "s3", platform: "instagram", url: "https://instagram.com/merlux", active: true, color: "#E1306C" },
            { id: "s4", platform: "facebook", url: "https://facebook.com/merlux", active: false, color: "#1877F2" }
          ]
        };
        const floatScrollTop = dbData.scrollTop || {
          active: true,
          shape: "circle",
          position: "right-bottom",
          color: "#D4AF37"
        };
        const floatBars = Array.isArray(dbData.bars) ? dbData.bars : [
          {
            id: "bar1",
            text: "Experience Melbourne's finest chauffeur services. Book luxury travel today.",
            url: "/booking",
            active: true,
            bgColor: "#0a0a0a",
            textColor: "#D4AF37",
            closeable: true,
            position: "top"
          }
        ];
        const floatPopups = Array.isArray(dbData.popups) ? dbData.popups : [
          {
            id: "pop1",
            title: "Exclusive Welcome Corporate Rate",
            content: "Save 10% on your first airport transfer of this season. Code auto-applied at booking checkout.",
            active: false,
            delay: 5,
            trigger: "load",
            width: "400px",
            showClose: true
          }
        ];

        const floatingContent = `export interface FloatingSettings {
  social: {
    active: boolean;
    position: 'left-bottom' | 'right-bottom' | 'left-top' | 'right-top';
    icons: Array<{
      id: string;
      platform: string;
      url: string;
      active: boolean;
      color?: string;
    }>;
  };
  scrollTop: {
    active: boolean;
    shape: 'circle' | 'square' | 'rounded';
    position: 'left-bottom' | 'right-bottom';
    color?: string;
  };
  bars: Array<{
    id: string;
    text: string;
    url?: string;
    active: boolean;
    bgColor?: string;
    textColor?: string;
    closeable?: boolean;
    position?: 'top' | 'bottom';
  }>;
  popups: Array<{
    id: string;
    title: string;
    content: string;
    active: boolean;
    delay?: number;
    trigger?: 'load' | 'scroll' | 'exit';
    width?: string;
    showClose?: boolean;
  }>;
}

export const floatingFallback: FloatingSettings = ${JSON.stringify({ social: floatSocial, scrollTop: floatScrollTop, bars: floatBars, popups: floatPopups }, null, 2)};
`;
        attemptSyncBack('floatingFallback', floatingContent);
      }
      setLoading(false);
    }, (err) => {
      console.warn('Floating settings live subscription failed, utilizing static floating elements fallback:', err);
      setLoading(false);
    });

    const unsubscribeFaqs = onSnapshot(query(faqsRef, orderBy('order', 'asc')), (snapshot) => {
      const liveFaqs: any[] = [];
      snapshot.forEach(docSnap => {
        liveFaqs.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (liveFaqs.length > 0) {
        const faqContent = `export interface FallbackFAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  active: boolean;
}

export const faqFallback: FallbackFAQ[] = ${JSON.stringify(liveFaqs, null, 2)};
`;
        attemptSyncBack('faqFallback', faqContent);
      }
    }, (err) => {
      console.warn('FAQs subscription failed during fallback backup sync:', err);
    });

    return () => {
      unsubscribeSystem();
      unsubscribeFloating();
      unsubscribeFaqs();
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, floatingSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
