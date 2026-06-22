export interface FallbackMetadata {
  id: string;
  title: string;
  slug: string;
  noindex?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  type?: string;
  structuredData?: any;
  updatedAt?: any;
}

export const metadataFallback: FallbackMetadata[] = [
  {
    id: "abbotsford-airport-transfer",
    title: "Abbotsford Airport Transfer",
    slug: "abbotsford-airport-transfer",
    structuredData: {
      "description": "Book a reliable Abbotsford Airport Chauffeur Service for private transfers to Melbourne Airport. Comfortable, punctual, and professional airport transport.",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "name": "Abbotsford Airport Chauffeur Service | Private Transfer to Melbourne Airport",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/abbotsford-airport-transfer"
    },
    noindex: false,
    metaTitle: "Abbotsford Airport Chauffeur Service | Private Transfer to Melbourne Airport",
    keywords: [],
    metaDescription: "Book a reliable Abbotsford Airport Chauffeur Service for private transfers to Melbourne Airport. Comfortable, punctual, and professional airport transport.",
    type: "Page"
  },
  {
    id: "about",
    type: "Page",
    metaDescription: "Learn about us and Merlux Chauffeurs commitment to excellence. Book your ride today for unparalleled travel service.",
    keywords: ["merlux chauffeur", "luxury chauffeur melbourne", "chauffeur service", "about"],
    title: "About",
    slug: "about",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Learn about us and Merlux Chauffeurs commitment to excellence. Book your ride today for unparalleled travel service.",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/about",
      "name": "Learn About Us: Merlux Chauffeur Quality Service"
    },
    noindex: false,
    metaTitle: "Learn About Us: Merlux Chauffeur Quality Service"
  },
  {
    id: "airport-transfers",
    metaDescription: "Premium airport transfers to Melbourne and Avalon airports. Professional chauffeurs, flight tracking, and luxury vehicles. Book your ride now.",
    keywords: ["airport transfers melbourne", "chauffeur melbourne airport", "luxury airport transfer", "tullamarine chauffeur"],
    type: "Page",
    structuredData: {
      "serviceType": "Airport Transfers Melbourne | Luxury Chauffeur Service",
      "description": "Premium airport transfers to Melbourne and Avalon airports. Professional chauffeurs, flight tracking, and luxury vehicles. Book your ride now.",
      "@type": "Service",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Merlux Chauffeur"
      },
      "@context": "https://schema.org"
    },
    slug: "airport-transfers",
    title: "Airport Transfers",
    metaTitle: "Airport Transfers Melbourne | Luxury Chauffeur Service",
    noindex: false
  },
  {
    id: "albert-park-airport-transfer",
    slug: "albert-park-airport-transfer",
    title: "Albert Park Airport Transfer",
    structuredData: {
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-airport-transfer",
      "keywords": "",
      "name": "Albert Park Airport Transfer Made Easy and Convenient",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Experience luxury with our Albert Park Airport Transfer services. Choose from elegant sedans or spacious SUVs for ultimate comfort."
    },
    metaTitle: "Albert Park Airport Transfer Made Easy and Convenient",
    noindex: false,
    keywords: [],
    metaDescription: "Experience luxury with our Albert Park Airport Transfer services. Choose from elegant sedans or spacious SUVs for ultimate comfort.",
    type: "Page"
  },
  {
    id: "albert-park-corporate-trips-or-hire",
    structuredData: {
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-corporate-trips-or-hire",
      "keywords": "",
      "name": "Albert Park Corporate Trips or Hire: Customized Solutions",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Streamline your next corporate trips or hire in Albert Park. Quality transport options and tailored services to meet your needs await you."
    },
    title: "Albert Park Corporate trips or hire",
    slug: "albert-park-corporate-trips-or-hire",
    noindex: false,
    metaTitle: "Albert Park Corporate Trips or Hire: Customized Solutions",
    metaDescription: "Streamline your next corporate trips or hire in Albert Park. Quality transport options and tailored services to meet your needs await you.",
    keywords: [],
    type: "Page"
  },
  {
    id: "albert-park-event-transfers",
    metaDescription: "Ensure smooth events in Albert Park with our reliable event transfers or event hire services tailored for any occasion.",
    keywords: [],
    type: "Page",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Ensure smooth events in Albert Park with our reliable event transfers or event hire services tailored for any occasion.",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-event-transfers",
      "name": "Albert Park Event Transfers for Everyone"
    },
    title: "Albert Park Event Transfers",
    slug: "albert-park-event-transfers",
    metaTitle: "Albert Park Event Transfers for Everyone",
    noindex: false
  },
  {
    id: "albert-park-executive-hire",
    metaTitle: "Albert Park Executive Hire for Your Next Event",
    noindex: false,
    structuredData: {
      "description": "Discover Albert Park Executive Hire for your next event. We offer tailored solutions for corporate, weddings, and private events.",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "name": "Albert Park Executive Hire for Your Next Event",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-executive-hire",
      "keywords": ""
    },
    slug: "albert-park-executive-hire",
    title: "Albert Park Executive Hire",
    type: "Page",
    metaDescription: "Discover Albert Park Executive Hire for your next event. We offer tailored solutions for corporate, weddings, and private events.",
    keywords: []
  },
  {
    id: "albert-park-luxury-private-tour",
    keywords: [],
    metaDescription: "Immerse yourself in the beauty of Albert Park on our Luxury Private Tour. Discover stunning landscapes and vibrant culture.",
    type: "Page",
    structuredData: {
      "description": "Immerse yourself in the beauty of Albert Park on our Luxury Private Tour. Discover stunning landscapes and vibrant culture.",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-luxury-private-tour",
      "keywords": "",
      "name": "Albert Park Luxury Private Tour: Nature and Heritage"
    },
    title: "Albert Park Luxury Private Tour",
    slug: "albert-park-luxury-private-tour",
    metaTitle: "Albert Park Luxury Private Tour: Nature and Heritage",
    noindex: false
  },
  {
    id: "albert-park-private-hire",
    title: "Albert Park Private hire",
    slug: "albert-park-private-hire",
    structuredData: {
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-private-hire",
      "keywords": "",
      "name": "Albert Park Private Hire: Exceptional Service Guaranteed",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Experience premium travel with Albert Park Private Hire. Enjoy seamless journeys in luxury vehicles with professional drivers."
    },
    metaTitle: "Albert Park Private Hire: Exceptional Service Guaranteed",
    noindex: false,
    keywords: [],
    metaDescription: "Experience premium travel with Albert Park Private Hire. Enjoy seamless journeys in luxury vehicles with professional drivers.",
    type: "Page"
  },
  {
    id: "albert-park-special-event-hire",
    title: "Albert Park Special Event Hire",
    slug: "albert-park-special-event-hire",
    structuredData: {
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Transform your occasion with Albert Park Special Event Hire. We create extraordinary experiences for weddings and parties.",
      "name": "Albert Park Special Event Hire for Memorable Occasions",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-special-event-hire"
    },
    metaTitle: "Albert Park Special Event Hire for Memorable Occasions",
    noindex: false,
    type: "Page",
    metaDescription: "Transform your occasion with Albert Park Special Event Hire. We create extraordinary experiences for weddings and parties.",
    keywords: []
  },
  {
    id: "albert-park-wedding-hire",
    noindex: false,
    metaTitle: "Albert Park Wedding Hire: Personalised Wedding Packages",
    structuredData: {
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Experience an extraordinary wedding at Albert Park Wedding Hire with beautiful venues, custom decorations, and complete event packages.",
      "name": "Albert Park Wedding Hire: Personalised Wedding Packages",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/albert-park-wedding-hire",
      "keywords": ""
    },
    slug: "albert-park-wedding-hire",
    title: "Albert Park Wedding Hire",
    type: "Page",
    keywords: [],
    metaDescription: "Experience an extraordinary wedding at Albert Park Wedding Hire with beautiful venues, custom decorations, and complete event packages."
  },
  {
    id: "balwyn-airport-transfer",
    type: "Page",
    metaDescription: "Experience luxury with our Balwyn Airport Transfer services. Choose from elegant sedans or spacious SUVs for ultimate comfort.",
    keywords: [],
    metaTitle: "Balwyn Airport Transfer Made Easy and Convenient",
    noindex: false,
    slug: "balwyn-airport-transfer",
    title: "Balwyn Airport Transfer",
    structuredData: {
      "description": "Experience luxury with our Balwyn Airport Transfer services. Choose from elegant sedans or spacious SUVs for ultimate comfort.",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "name": "Balwyn Airport Transfer Made Easy and Convenient",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-airport-transfer",
      "keywords": ""
    }
  },
  {
    id: "balwyn-corporate-trips-or-hire",
    metaTitle: "Balwyn Corporate Trips or Hire with Expert Chauffeurs",
    noindex: false,
    structuredData: {
      "name": "Balwyn Corporate Trips or Hire with Expert Chauffeurs",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-corporate-trips-or-hire",
      "keywords": "",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Explore Balwyn Corporate trips or hire for tailored transport solutions that ensure comfort and efficiency for your team."
    },
    slug: "balwyn-corporate-trips-or-hire",
    title: "Balwyn Corporate trips or hire",
    type: "Page",
    keywords: [],
    metaDescription: "Explore Balwyn Corporate trips or hire for tailored transport solutions that ensure comfort and efficiency for your team."
  },
  {
    id: "balwyn-event-transfers",
    title: "Balwyn Event transfers",
    slug: "balwyn-event-transfers",
    structuredData: {
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Explore Balwyn Event transfers for seamless guest transport and exceptional event solutions tailored to your needs.",
      "name": "Balwyn Event Transfers for Any Occasion",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-event-transfers",
      "keywords": ""
    },
    noindex: false,
    metaTitle: "Balwyn Event Transfers for Any Occasion",
    type: "Page",
    metaDescription: "Explore Balwyn Event transfers for seamless guest transport and exceptional event solutions tailored to your needs.",
    keywords: []
  },
  {
    id: "balwyn-executive-hire",
    keywords: [],
    metaDescription: "Experience luxury transportation with Balwyn Executive Hire. Arrive in style for events and transfers with our premium vehicles.",
    type: "Page",
    title: "Balwyn Executive Hire",
    slug: "balwyn-executive-hire",
    structuredData: {
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Experience luxury transportation with Balwyn Executive Hire. Arrive in style for events and transfers with our premium vehicles.",
      "name": "Balwyn Executive Hire: Luxury Transportation Services",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-executive-hire",
      "keywords": ""
    },
    noindex: false,
    metaTitle: "Balwyn Executive Hire: Luxury Transportation Services"
  },
  {
    id: "balwyn-luxury-private-tour",
    metaTitle: "Balwyn Luxury Private Tour: Unwind in Elegance",
    noindex: false,
    structuredData: {
      "name": "Balwyn Luxury Private Tour: Unwind in Elegance",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-luxury-private-tour",
      "keywords": "",
      "description": "Explore the charm of Balwyn on a luxury private tour tailored to your interests. Enjoy art, food, and relaxation in style.",
      "@type": "WebPage",
      "@context": "https://schema.org"
    },
    slug: "balwyn-luxury-private-tour",
    title: "Balwyn Luxury Private Tour",
    keywords: [],
    metaDescription: "Explore the charm of Balwyn on a luxury private tour tailored to your interests. Enjoy art, food, and relaxation in style.",
    type: "Page"
  },
  {
    id: "balwyn-north-airport-transfer",
    type: "Page",
    keywords: [],
    metaDescription: "Experience luxury with Balwyn North Airport Transfer from Merlux Chauffeur Services. Travel in style and comfort to Melbourne Airport.",
    title: "Balwyn North Airport Transfer",
    slug: "balwyn-north-airport-transfer",
    structuredData: {
      "name": "Balwyn North Airport Transfer with Merlux Chauffeur Services",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-airport-transfer",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Experience luxury with Balwyn North Airport Transfer from Merlux Chauffeur Services. Travel in style and comfort to Melbourne Airport."
    },
    noindex: false,
    metaTitle: "Balwyn North Airport Transfer with Merlux Chauffeur Services"
  },
  {
    id: "balwyn-north-corporate-trips-or-hire",
    slug: "balwyn-north-corporate-trips-or-hire",
    title: "Balwyn North Corporate trips or hire",
    structuredData: {
      "description": "Experience seamless travel for your business events with our Balwyn North corporate trips or hire service. Luxury awaits.",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-corporate-trips-or-hire",
      "keywords": "",
      "name": "Balwyn North Corporate Trips or Hire for Events"
    },
    metaTitle: "Balwyn North Corporate Trips or Hire for Events",
    noindex: false,
    metaDescription: "Experience seamless travel for your business events with our Balwyn North corporate trips or hire service. Luxury awaits.",
    keywords: [],
    type: "Page"
  },
  {
    id: "balwyn-north-event-transfers",
    keywords: [],
    metaDescription: "Secure dependable Balwyn North Event transfers for your guests. Ensure stress-free arrivals and a successful occasion.",
    type: "Page",
    metaTitle: "Balwyn North Event Transfers Options",
    noindex: false,
    slug: "balwyn-north-event-transfers",
    title: "Balwyn North Event transfers",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Secure dependable Balwyn North Event transfers for your guests. Ensure stress-free arrivals and a successful occasion.",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-event-transfers",
      "name": "Balwyn North Event Transfers Options"
    }
  },
  {
    id: "balwyn-north-executive-hire",
    structuredData: {
      "description": "Explore premium vehicles at Balwyn North Executive Hire. Enjoy comfort and sophistication with our top-brand selection.",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "name": "Balwyn North Executive Hire: Premium Vehicle Options",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-executive-hire",
      "keywords": ""
    },
    slug: "balwyn-north-executive-hire",
    title: "Balwyn North Executive Hire",
    noindex: false,
    metaTitle: "Balwyn North Executive Hire: Premium Vehicle Options",
    metaDescription: "Explore premium vehicles at Balwyn North Executive Hire. Enjoy comfort and sophistication with our top-brand selection.",
    keywords: [],
    type: "Page"
  },
  {
    id: "balwyn-north-luxury-private-tour",
    metaTitle: "Balwyn North Luxury Private Tour: A Unique Experience",
    noindex: false,
    slug: "balwyn-north-luxury-private-tour",
    title: "Balwyn North Luxury Private Tour",
    structuredData: {
      "description": "Experience elegance on a Balwyn North Luxury Private Tour, exploring stunning architecture and lush landscapes tailored to you.",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "name": "Balwyn North Luxury Private Tour: A Unique Experience",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-luxury-private-tour",
      "keywords": ""
    },
    type: "Page",
    keywords: [],
    metaDescription: "Experience elegance on a Balwyn North Luxury Private Tour, exploring stunning architecture and lush landscapes tailored to you."
  },
  {
    id: "balwyn-north-private-hire",
    noindex: false,
    metaTitle: "Balwyn North Private Hire: Your Trusted Transport Solution",
    slug: "balwyn-north-private-hire",
    title: "Balwyn North Private hire",
    structuredData: {
      "name": "Balwyn North Private Hire: Your Trusted Transport Solution",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-private-hire",
      "keywords": "",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Experience top-notch transportation with Balwyn North Private hire, offering comfort and luxury for all your travel needs."
    },
    type: "Page",
    metaDescription: "Experience top-notch transportation with Balwyn North Private hire, offering comfort and luxury for all your travel needs.",
    keywords: []
  },
  {
    id: "balwyn-north-special-event-hire",
    keywords: [],
    metaDescription: "Transform your celebrations with Balwyn North Special Event Hire. Enjoy unique event planning with quality equipment and support.",
    type: "Page",
    noindex: false,
    metaTitle: "Balwyn North Special Event Hire for Memorable Events",
    title: "Balwyn North Special Event Hire",
    slug: "balwyn-north-special-event-hire",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Transform your celebrations with Balwyn North Special Event Hire. Enjoy unique event planning with quality equipment and support.",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-special-event-hire",
      "name": "Balwyn North Special Event Hire for Memorable Events"
    }
  },
  {
    id: "balwyn-north-wedding-hire",
    type: "Page",
    keywords: [],
    metaDescription: "Plan your dream wedding with our Balwyn North wedding hire selections, tailored to create the perfect atmosphere for your celebration.",
    metaTitle: "Balwyn North Wedding Hire for Your Perfect Day",
    noindex: false,
    structuredData: {
      "name": "Balwyn North Wedding Hire for Your Perfect Day",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-north-wedding-hire",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Plan your dream wedding with our Balwyn North wedding hire selections, tailored to create the perfect atmosphere for your celebration."
    },
    slug: "balwyn-north-wedding-hire",
    title: "Balwyn North Wedding Hire"
  },
  {
    id: "balwyn-private-hire",
    type: "Page",
    metaDescription: "Experience excellence with Balwyn Private Hire for all your transportation needs. Luxurious rides with professional drivers await you.",
    keywords: [],
    metaTitle: "Balwyn Private Hire for Corporate Events and Weddings",
    noindex: false,
    structuredData: {
      "name": "Balwyn Private Hire for Corporate Events and Weddings",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-private-hire",
      "keywords": "",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Experience excellence with Balwyn Private Hire for all your transportation needs. Luxurious rides with professional drivers await you."
    },
    slug: "balwyn-private-hire",
    title: "Balwyn Private hire"
  },
  {
    id: "balwyn-special-event-hire",
    type: "Page",
    metaDescription: "Transform your occasion with Balwyn Special Event Hire. We offer tables, chairs, and more for unforgettable events.",
    keywords: [],
    noindex: false,
    metaTitle: "Balwyn Special Event Hire for Unforgettable Events",
    structuredData: {
      "description": "Transform your occasion with Balwyn Special Event Hire. We offer tables, chairs, and more for unforgettable events.",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-special-event-hire",
      "keywords": "",
      "name": "Balwyn Special Event Hire for Unforgettable Events"
    },
    title: "Balwyn Special Event Hire",
    slug: "balwyn-special-event-hire"
  },
  {
    id: "balwyn-wedding-hire",
    metaDescription: "Explore Balwyn Wedding Hire for stunning venue options that will make your wedding day unforgettable. Elegance awaits you!",
    keywords: [],
    type: "Page",
    noindex: false,
    metaTitle: "Balwyn Wedding Hire: Memorable Weddings Made Easy",
    structuredData: {
      "description": "Explore Balwyn Wedding Hire for stunning venue options that will make your wedding day unforgettable. Elegance awaits you!",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "name": "Balwyn Wedding Hire: Memorable Weddings Made Easy",
      "keywords": "",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/balwyn-wedding-hire"
    },
    title: "Balwyn Wedding Hire",
    slug: "balwyn-wedding-hire"
  },
  {
    id: "berwick-airport-transfer",
    metaTitle: "Berwick Airport Transfer Made Easy and Convenient",
    noindex: false,
    slug: "berwick-airport-transfer",
    title: "Berwick Airport Transfer",
    structuredData: {
      "name": "Berwick Airport Transfer Made Easy and Convenient",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/berwick-airport-transfer",
      "keywords": "",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Experience luxury with our Berwick Airport Transfer services. Choose from elegant sedans or spacious SUVs for ultimate comfort."
    },
    type: "Page",
    metaDescription: "Experience luxury with our Berwick Airport Transfer services. Choose from elegant sedans or spacious SUVs for ultimate comfort.",
    keywords: []
  },
  {
    id: "blog",
    metaDescription: "Read the latest news and travel insights on our blog.",
    keywords: ["blog", "chauffeur news", "melbourne travel tips"],
    title: "Blog",
    slug: "blog",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Read the latest news and travel insights on our blog.",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/blog",
      "name": "Merlux Chauffeur Blog Page: Your Travel Companion"
    },
    noindex: false,
    metaTitle: "Merlux Chauffeur Blog Page: Your Travel Companion",
    type: "Page"
  },
  {
    id: "contact",
    metaDescription: "Contact Merlux Chauffeur for luxury transfers, tours & events in Melbourne. Call or email today to book your premium ride.",
    keywords: ["contact-us", "merlux helpline"],
    type: "Page",
    noindex: false,
    metaTitle: "Contact Merlux Chauffeur – Book Luxury Transfers Melbourne",
    structuredData: {
      "name": "Contact Merlux Chauffeur – Book Luxury Transfers Melbourne",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/contact",
      "keywords": "contact-us, merlux helpline",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Contact Merlux Chauffeur for luxury transfers, tours & events in Melbourne. Call or email today to book your premium ride."
    },
    title: "Contact",
    slug: "contact"
  },
  {
    id: "corporate-travel",
    metaDescription: "Professional corporate travel solutions for executives. Reliable, discreet, and luxury chauffeur services in Melbourne. Open a corporate account today.",
    keywords: ["corporate travel melbourne", "executive chauffeur", "business transport melbourne", "professional driver"],
    type: "Page",
    metaTitle: "Corporate Chauffeur Melbourne | Executive Travel Services",
    noindex: false,
    structuredData: {
      "description": "Professional corporate travel solutions for executives. Reliable, discreet, and luxury chauffeur services in Melbourne. Open a corporate account today.",
      "@context": "https://schema.org",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Merlux Chauffeur"
      },
      "@type": "Service",
      "serviceType": "Corporate Chauffeur Melbourne | Executive Travel Services"
    },
    slug: "corporate-travel",
    title: "Corporate Travel"
  },
  {
    id: "faq",
    keywords: ["FAQ", "About Merlux Questions"],
    metaDescription: "Find answers to common questions about Merlux Chauffeur services, bookings, luxury fleet, and travel arrangements in Melbourne.",
    type: "Page",
    slug: "faq",
    title: "FAQ",
    structuredData: {
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/faq",
      "keywords": "FAQ, About Merlux Questions",
      "name": "Frequently Asked Questions",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Find answers to common questions about Merlux Chauffeur services, bookings, luxury fleet, and travel arrangements in Melbourne."
    },
    noindex: false,
    metaTitle: "Frequently Asked Questions"
  },
  {
    id: "fleet",
    type: "Page",
    metaDescription: "Explore Merlux Chauffeur’s luxury fleet of sedans, SUVs & vans for airport transfers, corporate travel, weddings & tours in Melbourne.",
    keywords: ["merlux chauffeur", "luxury chauffeur melbourne", "chauffeur service", "fleet"],
    structuredData: {
      "name": "Luxury Car Fleet – Premium Chauffeur Vehicles in Melbourne",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/fleet",
      "description": "Explore Merlux Chauffeur’s luxury fleet of sedans, SUVs & vans for airport transfers, corporate travel, weddings & tours in Melbourne.",
      "@type": "WebPage",
      "@context": "https://schema.org"
    },
    title: "Fleet",
    slug: "fleet",
    noindex: false,
    metaTitle: "Luxury Car Fleet – Premium Chauffeur Vehicles in Melbourne"
  },
  {
    id: "home",
    metaTitle: "Luxury Merlux Chauffeur Offers Premium Transfers",
    noindex: false,
    slug: "home",
    title: "Home",
    structuredData: {
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/",
      "name": "Luxury Merlux Chauffeur Offers Premium Transfers ",
      "@context": "https://schema.org",
      "@type": "WebPage",
      "description": "Experience unparalleled comfort with Luxury Merlux Chauffeur services for all your travel needs in Melbourne."
    },
    type: "Page",
    keywords: ["merlux chauffeur", "luxury chauffeur melbourne", "chauffeur service", "home"],
    metaDescription: "Experience unparalleled comfort with Luxury Merlux Chauffeur services for all your travel needs in Melbourne."
  },
  {
    id: "offers",
    title: "Offers",
    slug: "offers",
    structuredData: {
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Book premium Melbourne airport transfers today with Merlux Chauffeur Services — enjoy luxury rides at special discounted rates.",
      "name": "Special Offers for Melbourne Airport Transfers Today",
      "keywords": "merlux chauffeur, luxury chauffeur melbourne, chauffeur service, offers",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/offers"
    },
    noindex: false,
    metaTitle: "Special Offers for Melbourne Airport Transfers Today",
    metaDescription: "Book premium Melbourne airport transfers today with Merlux Chauffeur Services — enjoy luxury rides at special discounted rates.",
    keywords: ["merlux chauffeur", "luxury chauffeur melbourne", "chauffeur service", "offers"],
    type: "Page"
  },
  {
    id: "services",
    noindex: false,
    metaTitle: "Chauffeur Services: Luxury on the Road",
    title: "Services",
    slug: "services",
    structuredData: {
      "name": "Chauffeur Services: Luxury on the Road",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/services",
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Learn why Chauffeur Services are the perfect choice for business trips and special events. Travel in style and comfort effortlessly."
    },
    type: "Page",
    keywords: ["merlux chauffeur", "luxury chauffeur melbourne", "chauffeur service", "services"],
    metaDescription: "Learn why Chauffeur Services are the perfect choice for business trips and special events. Travel in style and comfort effortlessly."
  },
  {
    id: "terms",
    keywords: ["Terms 0f Service", "Merlux Terms"],
    metaDescription: "Understand the Merlux Terms and Conditions that govern all bookings for our chauffeuring services to secure a seamless experience.",
    structuredData: {
      "@type": "WebPage",
      "@context": "https://schema.org",
      "description": "Understand the Merlux Terms and Conditions that govern all bookings for our chauffeuring services to secure a seamless experience.",
      "name": "Merlux Terms and Conditions: Essential Guidelines",
      "url": "https://ais-dev-s5y6ufsd4c4bpfr5qlldpr-280816768868.asia-southeast1.run.app/terms",
      "keywords": "Terms 0f Service, Merlux Terms"
    },
    slug: "terms",
    title: "Terms and Conditions",
    noindex: false,
    metaTitle: "Merlux Terms and Conditions: Essential Guidelines",
    type: "Page"
  },
  {
    id: "wedding-chauffeur",
    metaTitle: "Wedding Car Hire Melbourne | Luxury Wedding Chauffeur",
    noindex: false,
    title: "Wedding Chauffeur",
    slug: "wedding-chauffeur",
    structuredData: {
      "serviceType": "Wedding Car Hire Melbourne | Luxury Wedding Chauffeur",
      "@context": "https://schema.org",
      "provider": {
        "@type": "LocalBusiness",
        "name": "Merlux Chauffeur"
      },
      "@type": "Service",
      "description": "Elegant wedding chauffeur services in Melbourne. Luxury vehicles, professional drivers, and personalized service for your special day."
    },
    type: "Page",
    metaDescription: "Elegant wedding chauffeur services in Melbourne. Luxury vehicles, professional drivers, and personalized service for your special day.",
    keywords: ["wedding car hire melbourne", "wedding chauffeur", "luxury wedding transport", "bridal cars melbourne"]
  }
];
