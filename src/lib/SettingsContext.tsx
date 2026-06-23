import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, collection, query, orderBy, getDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { settingsFallback } from '../data/fallback/settingsFallback';
import { floatingFallback } from '../data/fallback/floatingFallback';
import { cmsFallback } from '../data/fallback/cmsFallback';
import { getCachedDoc, getCachedDocs } from './firestore-cache';

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
    const fetchData = async () => {
      try {
        const settingsRef = doc(db, 'settings', 'system');
        const floatingRef = doc(db, 'settings', 'floating');

        // Fetch System Settings
        const dbData = await getCachedDoc(settingsRef);
        const baseFallback = {
          ...settingsFallback,
          menus: cmsFallback.menus,
          seo: cmsFallback.seo,
          categories: cmsFallback.categories,
          tags: cmsFallback.tags
        };
        
        if (dbData) {
          setSettings(mergeFallback(dbData, baseFallback));
          
          // Formatting for sync back (dev only)
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

          // Only sync back if dev
          if (import.meta.env.DEV) {
             const settingsContent = `export const settingsFallback = ${JSON.stringify({ contact, pricing, company, bbox, styleFlags }, null, 2)};`;
             const cmsContent = `export const cmsFallback = ${JSON.stringify({ menus, seo, categories, tags }, null, 2)};`;
             attemptSyncBack('settingsFallback', settingsContent);
             attemptSyncBack('cmsFallback', cmsContent);
          }
        }

        // Fetch Floating Settings
        const fData = await getCachedDoc(floatingRef);
        if (fData) {
          setFloatingSettings({
            ...floatingFallback,
            ...fData,
            social: { ...(floatingFallback.social || {}), ...(fData.social || {}) },
            scrollTop: { ...(floatingFallback.scrollTop || {}), ...(fData.scrollTop || {}) },
            bars: Array.isArray(fData.bars) ? fData.bars : (floatingFallback.bars || []),
            popups: Array.isArray(fData.popups) ? fData.popups : (floatingFallback.popups || [])
          });
        }

      } catch (err) {
        console.warn('System settings failed to load, utilizing static fallback:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
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
