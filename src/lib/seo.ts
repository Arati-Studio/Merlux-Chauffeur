export const SEO_CONFIG = {
  defaultTitle: 'Merlux Chauffeur Services | Luxury Transport Melbourne',
  titleTemplate: '%s | Merlux Chauffeur Services',
  defaultDescription: 'Premium luxury chauffeur booking platform in Melbourne, Australia. Airport transfers, corporate travel, and private tours available 24/7.',
  defaultKeywords: 'chauffeur melbourne, luxury car service, airport transfer melbourne, corporate chauffeur, private tours melbourne, wedding transport',
  siteUrl: window.location.origin || 'https://merlux.com.au', // Fallback for build time
  defaultOGImage: '/images/og-image.jpg',
  twitterHandle: '@merluxchauffeur',
  facebookAppId: '',
  themeColor: '#D4AF37', // Gold
};

export interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  noindex?: boolean;
  robots?: string;
  structuredData?: object;
  schema?: object;
}

export const generateCanonicalUrl = (path: string) => {
  const base = SEO_CONFIG.siteUrl.endsWith('/') ? SEO_CONFIG.siteUrl.slice(0, -1) : SEO_CONFIG.siteUrl;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
};

export const generateDescriptionFromContent = (content: string, length = 160) => {
  if (!content) return SEO_CONFIG.defaultDescription;
  const stripped = content.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
  return stripped.length > length ? `${stripped.substring(0, length - 3)}...` : stripped;
};
