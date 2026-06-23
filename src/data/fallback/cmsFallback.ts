export interface MenuItem {
  id?: string;
  label: string;
  url: string;
  isMore?: boolean;
  items?: Array<{ id?: string; label: string; url: string; [key: string]: any }>;
  [key: string]: any;
}

export interface CMSFallback {
  menus: {
    headerActive: boolean;
    footerActive: boolean;
    servicesActive: boolean;
    header: MenuItem[];
    footer: MenuItem[];
    services: MenuItem[];
    [key: string]: any;
  };
  seo: {
    siteName: string;
    defaultTitle: string;
    titleTemplate?: string;
    defaultDescription: string;
    keywords?: string[];
    noindex?: boolean;
    [key: string]: any;
  };
  categories: string[];
  tags: string[];
  [key: string]: any;
}

export const cmsFallback: CMSFallback = {
  "menus": {
    "services": [
      {
        "label": "Airport Transfers",
        "url": "/airport-transfers",
        "items": [
          {
            "url": "/tarneit-airport-transfer",
            "label": "Tarneit Airport Transfer",
            "id": "tarneit-airport-transfer"
          },
          {
            "id": "melton-airport-transfer",
            "label": "Melton Airport Transfer",
            "url": "/melton-airport-transfer"
          },
          {
            "label": "Keysborough Airport Transfer",
            "url": "/keysborough-airport-transfer",
            "id": "keysborough-airport-transfer"
          },
          {
            "label": "Craigieburn Airport Transfer",
            "url": "/craigieburn-airport-transfer",
            "id": "craigieburn-airport-transfer"
          },
          {
            "url": "/bundoora-airport-transfer",
            "label": "Bundoora Airport Transfer",
            "id": "bundoora-airport-transfer"
          },
          {
            "id": "albert-park-airport-transfer",
            "label": "Albert Park Airport Transfer",
            "url": "/albert-park-airport-transfer"
          },
          {
            "id": "abbotsford-airport-transfer",
            "url": "/abbotsford-airport-transfer",
            "label": "Abbotsford Airport Transfer"
          },
          {
            "id": "werribee-airport-transfer",
            "url": "/werribee-airport-transfer",
            "label": "Werribee Airport Transfer"
          },
          {
            "url": "/point-cook-airport-transfer",
            "label": "Point Cook Airport Transfer",
            "id": "point-cook-airport-transfer"
          },
          {
            "url": "/narre-warren-airport-transfer",
            "label": "Narre Warren Airport Transfer",
            "id": "narre-warren-airport-transfer"
          },
          {
            "id": "frankston-airport-transfer",
            "url": "/frankston-airport-transfer",
            "label": "Frankston Airport Transfer"
          },
          {
            "id": "cranbourne-airport-transfer",
            "url": "/cranbourne-airport-transfer",
            "label": "Cranbourne Airport Transfer"
          },
          {
            "id": "caroline-springs-airport-transfer",
            "url": "/caroline-springs-airport-transfer",
            "label": "Caroline Springs Airport Transfer"
          },
          {
            "id": "berwick-airport-transfer",
            "url": "/berwick-airport-transfer",
            "label": "Berwick Airport Transfer"
          },
          {
            "label": "Springvale Airport Transfer",
            "url": "/springvale-airport-transfer",
            "id": "springvale-airport-transfer"
          },
          {
            "url": "/oakleigh-airport-transfer",
            "label": "Oakleigh Airport Transfer",
            "id": "oakleigh-airport-transfer"
          },
          {
            "label": "Dandenong Airport Transfer",
            "url": "/dandenong-airport-transfer",
            "id": "dandenong-airport-transfer"
          },
          {
            "label": "Box Hill Airport Transfer",
            "url": "/box-hill-airport-transfer",
            "id": "box-hill-airport-transfer"
          },
          {
            "id": "williamstown-airport-transfer",
            "url": "/williamstown-airport-transfer",
            "label": "Williamstown Airport Transfer"
          },
          {
            "label": "St Kilda Airport Transfer",
            "url": "/st-kilda-airport-transfer",
            "id": "st-kilda-airport-transfer"
          },
          {
            "id": "elwood-airport-transfer",
            "label": "Elwood Airport Transfer",
            "url": "/elwood-airport-transfer"
          },
          {
            "url": "/toorak-airport-transfer",
            "label": "Toorak Airport Transfer",
            "id": "toorak-airport-transfer"
          },
          {
            "id": "templestowe-airport-transfer",
            "url": "/templestowe-airport-transfer",
            "label": "Templestowe Airport Transfer"
          },
          {
            "id": "port-melbourne-airport-transfer",
            "label": "Port Melbourne Airport Transfer",
            "url": "/port-melbourne-airport-transfer"
          },
          {
            "id": "doncaster-airport-transfer",
            "label": "Doncaster Airport Transfer",
            "url": "/doncaster-airport-transfer"
          },
          {
            "url": "/docklands-airport-transfer",
            "label": "Docklands Airport Transfer",
            "id": "docklands-airport-transfer"
          },
          {
            "url": "/burwood-east-airport-transfer",
            "label": "Burwood East Airport Transfer",
            "id": "burwood-east-airport-transfer"
          },
          {
            "id": "balwyn-north-airport-transfer",
            "url": "/balwyn-north-airport-transfer",
            "label": "Balwyn North Airport Transfer"
          },
          {
            "id": "balwyn-airport-transfer",
            "url": "/balwyn-airport-transfer",
            "label": "Balwyn Airport Transfer"
          },
          {
            "label": "Mount Waverley Airport Transfer",
            "url": "/mount-waverley-airport-transfer",
            "id": "mount-waverley-airport-transfer"
          },
          {
            "id": "malvern-airport-transfer",
            "url": "/malvern-airport-transfer",
            "label": "Malvern Airport Transfer"
          },
          {
            "label": "Kew Airport Transfer",
            "url": "/kew-airport-transfer",
            "id": "kew-airport-transfer"
          },
          {
            "url": "/hawthorn-airport-transfer",
            "label": "Hawthorn Airport Transfer",
            "id": "hawthorn-airport-transfer"
          },
          {
            "id": "glen-waverley-airport-transfer",
            "url": "/glen-waverley-airport-transfer",
            "label": "Glen Waverley Airport Transfer"
          },
          {
            "id": "camberwell-airport-transfer",
            "label": "Camberwell Airport Transfer",
            "url": "/camberwell-airport-transfer"
          },
          {
            "id": "burwood-airport-transfer",
            "label": "Burwood Airport Transfer",
            "url": "/burwood-airport-transfer"
          },
          {
            "id": "brighton-airport-transfer",
            "label": "Brighton Airport Transfer",
            "url": "/brighton-airport-transfer"
          },
          {
            "id": "south-yarra-airport-transfer",
            "label": "South Yarra Airport Transfer",
            "url": "/south-yarra-airport-transfer"
          }
        ]
      },
      {
        "label": "Private Tours",
        "url": "/private-tours",
        "items": [
          {
            "label": "Williamstown Luxury Private Tour",
            "url": "/williamstown-luxury-private-tour",
            "id": "williamstown-luxury-private-tour"
          },
          {
            "id": "st-kilda-luxury-private-tour",
            "label": "St Kilda Luxury Private Tour",
            "url": "/st-kilda-luxury-private-tour"
          },
          {
            "id": "port-melbourne-luxury-private-tour",
            "url": "/port-melbourne-luxury-private-tour",
            "label": "Port Melbourne Luxury Private Tour"
          },
          {
            "label": "Elwood Luxury Private Tour",
            "url": "/elwood-luxury-private-tour",
            "id": "elwood-luxury-private-tour"
          },
          {
            "id": "docklands-luxury-private-tour",
            "url": "/docklands-luxury-private-tour",
            "label": "Docklands Luxury Private Tour"
          },
          {
            "url": "/templestowe-luxury-private-tour",
            "label": "Templestowe Luxury Private Tour",
            "id": "templestowe-luxury-private-tour"
          },
          {
            "label": "Mount Waverley Luxury Private Tour",
            "url": "/mount-waverley-luxury-private-tour",
            "id": "mount-waverley-luxury-private-tour"
          },
          {
            "label": "Doncaster Luxury Private Tour",
            "url": "/doncaster-luxury-private-tour",
            "id": "doncaster-luxury-private-tour"
          },
          {
            "label": "Camberwell Luxury Private Tour",
            "url": "/camberwell-luxury-private-tour",
            "id": "camberwell-luxury-private-tour"
          },
          {
            "id": "burwood-luxury-private-tour",
            "label": "Burwood Luxury Private Tour",
            "url": "/burwood-luxury-private-tour"
          },
          {
            "url": "/burwood-east-luxury-private-tour",
            "label": "Burwood East Luxury Private Tour",
            "id": "burwood-east-luxury-private-tour"
          },
          {
            "url": "/balwyn-north-luxury-private-tour",
            "label": "Balwyn North Luxury Private Tour",
            "id": "balwyn-north-luxury-private-tour"
          },
          {
            "url": "/balwyn-luxury-private-tour",
            "label": "Balwyn Luxury Private Tour",
            "id": "balwyn-luxury-private-tour"
          },
          {
            "id": "albert-park-luxury-private-tour",
            "label": "Albert Park Luxury Private Tour",
            "url": "/albert-park-luxury-private-tour"
          },
          {
            "id": "toorak-luxury-private-tour",
            "url": "/toorak-luxury-private-tour",
            "label": "Toorak Luxury Private Tour"
          },
          {
            "id": "south-yarra-luxury-private-tour",
            "url": "/south-yarra-luxury-private-tour",
            "label": "South Yarra Luxury Private Tour"
          },
          {
            "label": "Malvern Luxury Private Tour",
            "url": "/malvern-luxury-private-tour",
            "id": "malvern-luxury-private-tour"
          },
          {
            "label": "Kew Luxury Private Tour",
            "url": "/kew-luxury-private-tour",
            "id": "kew-luxury-private-tour"
          },
          {
            "id": "hawthorn-luxury-private-tour",
            "label": "Hawthorn Luxury Private Tour",
            "url": "/hawthorn-luxury-private-tour"
          },
          {
            "label": "Glen Waverley Luxury Private Tour",
            "url": "/glen-waverley-luxury-private-tour",
            "id": "glen-waverley-luxury-private-tour"
          },
          {
            "label": "Brighton Luxury Private Tour",
            "url": "/brighton-luxury-private-tour",
            "id": "brighton-luxury-private-tour"
          }
        ]
      },
      {
        "items": [
          {
            "label": "Camberwell Wedding Hire",
            "url": "/camberwell-wedding-hire",
            "id": "camberwell-wedding-hire"
          },
          {
            "id": "st-kilda-wedding-hire",
            "label": "St Kilda Wedding Hire",
            "url": "/st-kilda-wedding-hire"
          },
          {
            "id": "elwood-wedding-hire",
            "url": "/elwood-wedding-hire",
            "label": "Elwood Wedding Hire"
          },
          {
            "url": "/docklands-wedding-hire",
            "label": "Docklands Wedding Hire",
            "id": "docklands-wedding-hire"
          },
          {
            "id": "williamstown-wedding-hire",
            "url": "/williamstown-wedding-hire",
            "label": "Williamstown Wedding Hire"
          },
          {
            "url": "/templestowe-wedding-hire",
            "label": "Templestowe Wedding Hire",
            "id": "templestowe-wedding-hire"
          },
          {
            "id": "port-melbourne-wedding-hire",
            "label": "Port Melbourne Wedding Hire",
            "url": "/port-melbourne-wedding-hire"
          },
          {
            "id": "mount-waverley-wedding-hire",
            "label": "Mount Waverley Wedding Hire",
            "url": "/mount-waverley-wedding-hire"
          },
          {
            "id": "glen-waverley-wedding-hire",
            "url": "/glen-waverley-wedding-hire",
            "label": "Glen Waverley Wedding Hire"
          },
          {
            "id": "doncaster-wedding-hire",
            "label": "Doncaster Wedding Hire",
            "url": "/doncaster-wedding-hire"
          },
          {
            "id": "burwood-wedding-hire",
            "url": "/burwood-wedding-hire",
            "label": "Burwood Wedding Hire"
          },
          {
            "label": "Burwood East Wedding Hire",
            "url": "/burwood-east-wedding-hire",
            "id": "burwood-east-wedding-hire"
          },
          {
            "label": "Balwyn Wedding Hire",
            "url": "/balwyn-wedding-hire",
            "id": "balwyn-wedding-hire"
          },
          {
            "label": "Balwyn North Wedding Hire",
            "url": "/balwyn-north-wedding-hire",
            "id": "balwyn-north-wedding-hire"
          },
          {
            "id": "albert-park-wedding-hire",
            "url": "/albert-park-wedding-hire",
            "label": "Albert Park Wedding Hire"
          },
          {
            "id": "toorak-wedding-hire",
            "url": "/toorak-wedding-hire",
            "label": "Toorak Wedding Hire"
          },
          {
            "id": "south-yarra-wedding-hire",
            "url": "/south-yarra-wedding-hire",
            "label": "South Yarra Wedding Hire"
          },
          {
            "label": "Malvern Wedding Hire",
            "url": "/malvern-wedding-hire",
            "id": "malvern-wedding-hire"
          },
          {
            "id": "kew-wedding-hire",
            "url": "/kew-wedding-hire",
            "label": "Kew Wedding Hire"
          },
          {
            "id": "hawthorn-wedding-hire",
            "url": "/hawthorn-wedding-hire",
            "label": "Hawthorn Wedding Hire"
          },
          {
            "url": "/brighton-wedding-hire",
            "label": "Brighton Wedding Hire",
            "id": "brighton-wedding-hire"
          }
        ],
        "label": "Wedding Chauffeur",
        "url": "/wedding-chauffeur"
      },
      {
        "items": [
          {
            "id": "kew-corporate-trips-or-hire",
            "label": "Kew Corporate trips or hire",
            "url": "/kew-corporate-trips-or-hire"
          },
          {
            "id": "williamstown-corporate-trips-or-hire",
            "url": "/williamstown-corporate-trips-or-hire",
            "label": "Williamstown Corporate trips or hire"
          },
          {
            "id": "st-kilda-corporate-trips-or-hire",
            "url": "/st-kilda-corporate-trips-or-hire",
            "label": "St Kilda Corporate trips or hire"
          },
          {
            "id": "port-melbourne-corporate-trips-or-hire",
            "url": "/port-melbourne-corporate-trips-or-hire",
            "label": "Port Melbourne Corporate trips or hire"
          },
          {
            "id": "elwood-corporate-trips-or-hire",
            "url": "/elwood-corporate-trips-or-hire",
            "label": "Elwood Corporate trips or hire"
          },
          {
            "url": "/docklands-corporate-trips-or-hire",
            "label": "Docklands Corporate trips or hire",
            "id": "docklands-corporate-trips-or-hire"
          },
          {
            "label": "Brighton Corporate trips or hire",
            "url": "/brighton-corporate-trips-or-hire",
            "id": "brighton-corporate-trips-or-hire"
          },
          {
            "id": "templestowe-corporate-trips-or-hire",
            "url": "/templestowe-corporate-trips-or-hire",
            "label": "Templestowe Corporate trips or hire"
          },
          {
            "label": "Mount Waverley Corporate trips or hire",
            "url": "/mount-waverley-corporate-trips-or-hire",
            "id": "mount-waverley-corporate-trips-or-hire"
          },
          {
            "id": "doncaster-corporate-trips-or-hire",
            "url": "/doncaster-corporate-trips-or-hire",
            "label": "Doncaster Corporate trips or hire"
          },
          {
            "label": "Camberwell Corporate trips or hire",
            "url": "/camberwell-corporate-trips-or-hire",
            "id": "camberwell-corporate-trips-or-hire"
          },
          {
            "id": "burwood-corporate-trips-or-hire",
            "url": "/burwood-corporate-trips-or-hire",
            "label": "Burwood Corporate trips or hire"
          },
          {
            "url": "/balwyn-north-corporate-trips-or-hire",
            "label": "Balwyn North Corporate trips or hire",
            "id": "balwyn-north-corporate-trips-or-hire"
          },
          {
            "url": "/balwyn-corporate-trips-or-hire",
            "label": "Balwyn Corporate trips or hire",
            "id": "balwyn-corporate-trips-or-hire"
          },
          {
            "url": "/albert-park-corporate-trips-or-hire",
            "label": "Albert Park Corporate trips or hire",
            "id": "albert-park-corporate-trips-or-hire"
          },
          {
            "label": "Toorak Corporate trips or hire",
            "url": "/toorak-corporate-trips-or-hire",
            "id": "toorak-corporate-trips-or-hire"
          },
          {
            "id": "south-yarra-corporate-trips-or-hire",
            "url": "/south-yarra-corporate-trips-or-hire",
            "label": "South Yarra Corporate trips or Hire"
          },
          {
            "url": "/malvern-corporate-trips-or-hire",
            "label": "Malvern Corporate trips or hire",
            "id": "malvern-corporate-trips-or-hire"
          },
          {
            "url": "/hawthorn-corporate-trips-or-hire",
            "label": "Hawthorn Corporate trips or hire",
            "id": "hawthorn-corporate-trips-or-hire"
          },
          {
            "url": "/glen-waverley-corporate-trips-or-hire",
            "label": "Glen Waverley Corporate trips or hire",
            "id": "glen-waverley-corporate-trips-or-hire"
          },
          {
            "label": "Burwood East Corporate trips or hire",
            "url": "/burwood-east-corporate-trips-or-hire",
            "id": "burwood-east-corporate-trips-or-hire"
          }
        ],
        "label": "Corporate Travel",
        "url": "/corporate-travel"
      }
    ],
    "footer": [
      {
        "url": "/",
        "label": "Home"
      },
      {
        "url": "/offers",
        "label": "Offers"
      },
      {
        "label": "Tours",
        "url": "/tours"
      },
      {
        "items": [
          {
            "label": "Blog",
            "url": "/blog"
          },
          {
            "url": "/",
            "label": "Fleet"
          },
          {
            "url": "/faq",
            "label": "FAQ"
          },
          {
            "label": "About",
            "url": "/about"
          },
          {
            "url": "/contact",
            "label": "Contact",
            "id": "ghvk6z4kr"
          }
        ],
        "label": "More",
        "url": "#"
      }
    ],
    "footerActive": true,
    "mobileActive": true,
    "header": [
      {
        "url": "/",
        "label": "Home"
      },
      {
        "label": "Offers",
        "url": "/offers",
        "isMore": false,
        "items": []
      },
      {
        "label": "Tours",
        "url": "/tours",
        "items": []
      },
      {
        "items": [
          {
            "url": "/airport-transfers",
            "label": "Airport Transfers"
          },
          {
            "url": "/private-tours",
            "label": "Private Tours"
          },
          {
            "label": "Wedding Chauffeur",
            "url": "/wedding-chauffeur"
          },
          {
            "label": "Corporate Travel",
            "url": "/corporate-travel"
          }
        ],
        "isMore": false,
        "url": "/services",
        "label": "Services"
      },
      {
        "url": "/blog",
        "label": "Blog",
        "items": [],
        "isMore": true
      },
      {
        "url": "/faq",
        "label": "Faq",
        "isMore": true
      },
      {
        "isMore": true,
        "label": "Fleet",
        "url": "/fleet"
      },
      {
        "label": "About",
        "url": "/about",
        "isMore": true
      },
      {
        "isMore": true,
        "label": "Contact",
        "url": "/contact"
      }
    ],
    "servicesActive": true,
    "headerActive": true,
    "mobile": [
      {
        "label": "Home",
        "url": "/"
      },
      {
        "label": "Tours",
        "url": "/tours"
      },
      {
        "label": "Tours",
        "url": "/tours"
      },
      {
        "url": "/about",
        "label": "About"
      }
    ]
  },
  "seo": {
    "robotsTxt": "User-agent: *\nAllow: /\nDisallow: /app\nSitemap: https://merlux.au/sitemap_index.xml",
    "favicon": "assets/favicon.webp",
    "isGlobalCssActive": true,
    "siteName": "Merlux Chauffeur Services",
    "defaultTitle": "Luxury Chauffeur Melbourne I Merlux",
    "searchConsoleId": "",
    "logo": "assets/Logo.webp",
    "globalCmsCss": "/* Luxury Wedding Car Hire Styles - Normal List */\n\nbody {\n  color: #f5f5f5;\n  line-height: 1.6;\n  margin: 0;\n  padding: 0;\n}\n\nh2 {\n  font-size: 2.2rem;\n  color: #d4af37; /* gold accent */\n  text-align: left;\n  margin-bottom: 1rem;\n  letter-spacing: 1px;\n}\n\nh3 {\n  font-size: 1.6rem;\n  color: #d4af37;\n  margin-top: 2rem;\n  margin-bottom: 1rem;\n  border-bottom: 1px solid #444;\n  padding-bottom: 0.5rem;\n}\n\np {\n  font-size: 1.1rem;\n  max-width: 800px;\n  margin: 0 auto 1.5rem auto;\n  text-align: left;\n  color: #ddd;\n}\n\nul {\n  list-style: disc; /* normal bullet style */\n  padding-left: 1rem; /* indent for bullets */\n  max-width: 700px;\n  margin: 0 auto;\n}\n\nul li {\n  margin-bottom: 0.8rem;\n  font-size: 1.05rem;\n}\n\nul li strong {\n  color: #d4af37;\n  font-weight: 600;\n}\n\na {\n  color: #39B1D1;\n  text-decoration: underline;\n  font-weight: bold;\n  font-style: italic;\n  transition: all 0.3s ease;\n}\n\na:hover {\n  color: gold;\n}\n\n/* --- Mobile Responsive Adjustments --- */\n@media (max-width: 768px) {\n  h2 {\n    font-size: 1.5rem; \n  }\n\n  h3 {\n    font-size: 1.2rem;\n  }\n\n  p {\n    font-size: 0.8rem;\n    padding: 0 1rem; \n  }\n\n  ul {\n    padding-left: 1.2rem;\n  }\n\n  ul li {\n    font-size: 0.8rem;\n  }\n\n  a {\n    font-size: 0.8rem;\n  }\n}\n\n@media (max-width: 480px) {\n  h2 {\n    font-size: 1.5rem;\n  }\n\n  h3 {\n    font-size: 1.2rem;\n  }\n\n  p, ul li {\n    font-size: 0.8rem;\n  }\n\n  a {\n    font-size: 0.8rem;\n  }\n}",
    "defaultDescription": "book luxury chauffeur services in Melbourne"
  },
  "categories": [
    "Travel Tips",
    "Elite Chauffeur",
    "Fleet Showcases",
    "Melbourne Guides",
    "Company News"
  ],
  "tags": [
    "Luxury",
    "Melbourne",
    "Airport",
    "Business",
    "Prestige",
    "VIP"
  ]
};
