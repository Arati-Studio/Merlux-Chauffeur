import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { SEO_CONFIG, type SEOProps, generateCanonicalUrl } from '../lib/seo';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSettings } from '../lib/SettingsContext';

const SEO: React.FC<SEOProps> = ({
  title,
  description,
  keywords,
  canonical,
  ogImage,
  ogType = 'website',
  noindex = false,
  robots,
  structuredData,
  schema,
}) => {
  const { pathname } = useLocation();
  const { settings } = useSettings();
  const [dbSeo, setDbSeo] = useState<{
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    noindex?: boolean;
    structuredData?: any;
  } | null>(null);

  useEffect(() => {
    const pathParts = pathname.split('/').filter(Boolean);
    let slug = 'home';
    if (pathParts.length > 0) {
      slug = pathParts.join('/');
    }

    const q = query(
      collection(db, 'metadata'),
      where('slug', '==', slug),
      limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setDbSeo({
          metaTitle: docData.metaTitle || '',
          metaDescription: docData.metaDescription || '',
          keywords: docData.keywords || [],
          noindex: docData.noindex || false,
          structuredData: docData.structuredData || null
        });
      } else {
        setDbSeo(null);
      }
    }, (error) => {
      console.warn('SEO dynamic loading suspended:', error);
    });

    return () => unsubscribe();
  }, [pathname]);

  const finalTitle = dbSeo?.metaTitle || title;
  const finalDescription = dbSeo?.metaDescription || description;
  const finalKeywords = (dbSeo?.keywords && dbSeo.keywords.length > 0)
    ? dbSeo.keywords.join(', ')
    : (Array.isArray(keywords) ? keywords.join(', ') : keywords);
  const finalNoindex = dbSeo?.noindex !== undefined ? dbSeo.noindex : noindex;
  const finalStructuredData = dbSeo?.structuredData || schema || structuredData;

  const seoTitle = finalTitle 
    ? SEO_CONFIG.titleTemplate.replace('%s', finalTitle) 
    : SEO_CONFIG.defaultTitle;
    
  const seoDescription = finalDescription || SEO_CONFIG.defaultDescription;
  const seoKeywords = finalKeywords || SEO_CONFIG.defaultKeywords;
  const seoCanonical = canonical || generateCanonicalUrl(pathname);
  const seoImage = ogImage || `${SEO_CONFIG.siteUrl}${SEO_CONFIG.defaultOGImage}`;
  
  const finalRobots = robots || (finalNoindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
  
  return (
    <Helmet>
      {/* Basic Metadata */}
      <title>{seoTitle}</title>
      <meta name="description" content={seoDescription} />
      <meta name="keywords" content={seoKeywords} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0" />
      <meta charSet="utf-8" />
      <meta name="theme-color" content={SEO_CONFIG.themeColor} />
      
      {/* Robots Control */}
      <meta name="robots" content={finalRobots} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={seoCanonical} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={seoTitle} />
      <meta property="og:description" content={seoDescription} />
      <meta property="og:url" content={seoCanonical} />
      <meta property="og:site_name" content="Merlux Chauffeur Services" />
      <meta property="og:image" content={seoImage} />
      <meta property="og:image:alt" content={seoTitle} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content={SEO_CONFIG.twitterHandle} />
      <meta name="twitter:creator" content={SEO_CONFIG.twitterHandle} />
      <meta name="twitter:title" content={seoTitle} />
      <meta name="twitter:description" content={seoDescription} />
      <meta name="twitter:image" content={seoImage} />

      {/* Global Site-Wide Schemas */}
      {settings?.schema?.organization && (
        <script type="application/ld+json">
          {JSON.stringify(settings.schema.organization)}
        </script>
      )}

      {settings?.schema?.localBusiness && (
        <script type="application/ld+json">
          {JSON.stringify(settings.schema.localBusiness)}
        </script>
      )}
      
      {/* Structured Data (Page-Specific JSON-LD) */}
      {finalStructuredData && (
        <script type="application/ld+json">
          {JSON.stringify(finalStructuredData)}
        </script>
      )}
      
      {/* Default LocalBusiness Schema if not provided globally or locally */}
      {!finalStructuredData && !settings?.schema?.localBusiness && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "LocalBusiness",
            "name": "Merlux Chauffeur Services",
            "image": seoImage,
            "@id": SEO_CONFIG.siteUrl,
            "url": SEO_CONFIG.siteUrl,
            "telephone": "+61400000000",
            "address": {
              "@type": "PostalAddress",
              "streetAddress": "Collins St",
              "addressLocality": "Melbourne",
              "addressRegion": "VIC",
              "postalCode": "3000",
              "addressCountry": "AU"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": -37.8136,
              "longitude": 144.9631
            },
            "openingHoursSpecification": {
              "@type": "OpeningHoursSpecification",
              "dayOfWeek": [
                "Monday",
                "Tuesday",
                "Wednesday",
                "Thursday",
                "Friday",
                "Saturday",
                "Sunday"
              ],
              "opens": "00:00",
              "closes": "23:59"
            }
          })}
        </script>
      )}

      {/* Breadcrumb Schema for non-home pages */}
      {pathname !== '/' && (
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": SEO_CONFIG.siteUrl
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": title || pathname.split('/').pop()?.replace(/-/g, ' '),
                "item": seoCanonical
              }
            ]
          })}
        </script>
      )}
    </Helmet>
  );
};

export default SEO;
