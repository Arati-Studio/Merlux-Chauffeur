export interface FallbackPage {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: "Services" | "Tours" | "Guides" | string;
  active: boolean;
  featuredImage: string;
  featuredImageAlt?: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
  publishAt?: string;
  customCss?: string;
  isCustomCssActive?: boolean;
  createdAt?: { seconds: number; nanoseconds: number } | string;
}

export const pagesFallback: FallbackPage[] = [
  {
    id: "page-airport-transfers",
    title: "Melbourne Airport Transfers",
    slug: "airport-transfers",
    category: "Services",
    active: true,
    featuredImage: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop",
    featuredImageAlt: "Mercedes-Benz S-Class at Melbourne Airport",
    excerpt: "Indulge in a seamless, premium airport chauffeur service with flight tracking, meet-and-greet, and premium comfort.",
    metaTitle: "Luxury Melbourne Airport Transfers | Elite Chauffeur Service",
    metaDescription: "Pristine airport transfers to and from Melbourne Airport (Tullamarine) & Avalon. Premium European vehicles with certified professional chauffeurs.",
    keywords: ["Airport Transfer", "Melbourne Chauffeur", "Luxury Airport Limo", "Corporate Flight Pickup"],
    publishAt: "2026-01-01T00:00:00.000Z",
    customCss: ".cms-rendered-content h2 { color: #D4AF37; margin-top: 2rem; font-size: 2rem; } .cms-rendered-content p { margin-bottom: 1.5rem; text-align: justify; }",
    isCustomCssActive: true,
    createdAt: { seconds: 1767225600, nanoseconds: 0 },
    content: `
      <h2>The Gold Standard of Melbourne Airport Travel</h2>
      <p>Elevate your travel experience with Merlux's signature airport chauffeur service. We service Melbourne Tullamarine Airport (MEL), Essendon Fields (MEB), and Avalon Airport (AVV) with zero tolerance for delays.</p>
      <p>From the moment you touch down, our seasoned chauffeurs manage every detail. We track your flight in real-time, adapting instantly to early landings or unexpected delay windows. Your private chauffeur will greet you inside the terminal with a personalized digital tablet sign, assisting with your luggage and guiding you directly to your waiting prestige vehicle.</p>
      
      <h2>Impeccable Fleet Selection</h2>
      <p>Our pristine fleet consists exclusively of high-specification European sedans and executive SUVs. Relax in the whisper-quiet cabin of a Mercedes-Benz S-Class, BMW 7 Series, or Audi A8, complete with high-speed Wi-Fi connectivity, luxury refreshments, and multi-zone climate control.</p>
      <h3>Premium Airport Inclusions:</h3>
      <ul>
        <li>Complimentary flight tracking & instant adjustment</li>
        <li>Bespoke indoor terminal meet-and-greet service</li>
        <li>Generous 1-hour complimentary waiting window for international arrivals</li>
        <li>Chilled mineral bottled water, mints, and technology charging ports</li>
      </ul>
    `
  },
  {
    id: "page-corporate-travel",
    title: "Corporate Chauffeur Services",
    slug: "corporate-travel",
    category: "Services",
    active: true,
    featuredImage: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
    featuredImageAlt: "Premium Business Executive Car in Melbourne CBD",
    excerpt: "Maintain your business momentum. Punctual, discreet, and immaculate corporate chauffeur hire tailored for executives.",
    metaTitle: "Corporate Chauffeur Melbourne | Executive Jet & CBD Transfers",
    metaDescription: "Reliable, executive-class transport solutions for Melbourne's elite corporate sectors. Hourly hire, roadshows, and client transfers.",
    keywords: ["Corporate Chauffeur", "Executive Travel Melbourne", "CBD Limo Service", "Financial District Transport"],
    publishAt: "2026-01-01T00:00:00.000Z",
    customCss: ".cms-rendered-content h2 { color: #D4AF37; margin-top: 2rem; }",
    isCustomCssActive: true,
    createdAt: { seconds: 1767225600, nanoseconds: 0 },
    content: `
      <h2>Sophisticated CBD Executive Transport</h2>
      <p>Arrive composed and prepared for your business commitments. Merlux Chauffeur provides prestigious corporate travel accounts designed to streamline the schedule of busy executives, international guest delegations, and board members.</p>
      <p>Whether navigating dense Melbourne central business district traffic between consecutive meetings or scheduling multi-destination financial roadshows, our expert local drivers ensure optimal route planning and absolute confidentiality.</p>
      
      <h2>Confidentiality & In-Cabin Comfort</h2>
      <p>Each vehicle features privacy glazing and a peaceful interior environment, permitting you to conduct sensitive phone calls, hold discussions, or review presentations uninterrupted. With onboard charging equipment and specialized seating configurations, our luxury fleet functions as a dynamic extension of your executive workspace.</p>
    `
  },
  {
    id: "page-wedding-transfers",
    title: "Bespoke Wedding Transport",
    slug: "wedding-chauffeur",
    category: "Services",
    active: true,
    featuredImage: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
    featuredImageAlt: "Premium white wedding car detailed with fresh florals",
    excerpt: "Add ultimate prestige to your fairytale wedding. Impeccable bridal cars and customized guest shuttles.",
    metaTitle: "Wedding Cars Melbourne | Luxury Chauffeur hire",
    metaDescription: "Exquisite wedding day transportation services across Victoria. Classic ribbons, luxury interior preparation, and professional drivers.",
    keywords: ["Wedding Cars Melbourne", "Bridal Limo Hire", "Luxury Marriage Cars", "Yarra Valley Wedding"],
    publishAt: "2026-01-01T00:00:00.000Z",
    customCss: ".cms-rendered-content h2 { color: #D4AF37; }",
    isCustomCssActive: true,
    createdAt: { seconds: 1767225600, nanoseconds: 0 },
    content: `
      <h2>Your Unparalleled Wedding Day Experience</h2>
      <p>On your most cherished celebration, select transport that reflects your personal standard of luxury. Merlux specializes in bespoke wedding chauffeur services, ensuring the bridal party, groom, and esteemed guests ride with peerless refinement.</p>
      <p>We supply stunning late-model vehicles pre-dressed with premium silk vehicle ribbons matching your chosen theme. Our highly presentation-trained chauffeurs arrive in full immaculate dark suiting, treating your timeline and photography setups with specialized dedication.</p>
      
      <h2>Seamless Micro-Logistics</h2>
      <p>We work in harmony with your wedding coordinators and planners. From pre-ceremony photography travels to grand reception arrivals and late-night getaway pick-ups, every transition is masterfully coordinated. Rest assured, your luxury journey is under our premier control.</p>
    `
  },
  {
    id: "page-yarra-valley-tour",
    title: "Yarra Valley Private Wine Tour",
    slug: "yarra-valley-tour",
    category: "Tours",
    active: true,
    featuredImage: "https://images.unsplash.com/photo-1516594709406-e8a17a153259?q=80&w=2070&auto=format&fit=crop",
    featuredImageAlt: "Private Vineyard in Yarra Valley Victoria",
    excerpt: "Explore globally celebrated wineries in sovereign comfort. Custom-designed private itineraries with luxury vehicle hire.",
    metaTitle: "Private Yarra Valley Wine Tours | Luxury Chauffeur Tour",
    metaDescription: "Bespoke winery tours in Victoria's renowned Yarra Valley. Personal chauffeur with premier estate reservations and gourmet dining.",
    keywords: ["Yarra Valley Tour", "Private Wine Tasting", "Luxury Chauffeur Tour", "Melbourne Winery Escape"],
    publishAt: "2026-01-01T00:00:00.000Z",
    customCss: ".cms-rendered-content h2 { color: #D4AF37; }",
    isCustomCssActive: true,
    createdAt: { seconds: 1767225600, nanoseconds: 0 },
    content: `
      <h2>Savor Victoria’s Premier Viticultural Estate</h2>
      <p>Depart modern city limits for a customized gourmet exploration of Victoria's oldest grape growing region, the spectacular Yarra Valley. With Merlux, there is no need for a designated driver. Take pleasure in tastings at premium locations such as Yering Station, TarraWarra Estate, and Domaine Chandon.</p>
      <p>Our team assists in customizing your direct boutique schedule. Your chauffeur remains at your complete disposal for the day, accommodating multi-stop schedules, gourmet wine acquisitions, and scenic hillside lookouts.</p>
      
      <h2>Gourmet Experiences Curated to You</h2>
      <p>Enjoy luxury lunch bookings at award-winning hatted restaurants overlooking panoramic rolling vines. Ride in our plush touring Mercedes V-Class or customized luxury saloons, experiencing premium wine country style.</p>
    `
  },
  {
    id: "page-mornington-peninsula",
    title: "Mornington Peninsula Spa & Wine Escape",
    slug: "mornington-peninsula-tour",
    category: "Tours",
    active: true,
    featuredImage: "https://images.unsplash.com/photo-1563863691231-a0adb0d44336?q=80&w=2070&auto=format&fit=crop",
    featuredImageAlt: "Coastal cliffside on the Mornington Peninsula Victoria",
    excerpt: "Elevate your wellness escape with direct private transfers to Peninsula Hot Springs and coastal estates.",
    metaTitle: "Mornington Peninsula Private Tours | Elite Victoria Tours",
    metaDescription: "Experience artisan seaside towns, mineral springs, and cold-climate coastal vineyards in Victorian luxury.",
    keywords: ["Mornington Peninsula Tour", "Peninsula Hot Springs Limo", "Coastal Private Tour"],
    publishAt: "2026-01-01T00:00:00.000Z",
    customCss: ".cms-rendered-content h2 { color: #D4AF37; }",
    isCustomCssActive: true,
    createdAt: { seconds: 1767225600, nanoseconds: 0 },
    content: `
      <h2>Coastal Splendor Meet Thermal Healing</h2>
      <p>Immerse yourself in spectacular seaside scenery, fresh maritime ocean air, and soothing geothermal mineral bathing pools. The Mornington Peninsula Private Tour is the ultimate luxury wellness escape.</p>
      <p>Our door-to-door transfer picks you up comfortably in the morning and transports you seamlessly to the Peninsula Hot Springs for exclusive bathing sessions. Afterward, explore local cold-climate wineries specializing in premier Pinot Noir and Chardonnay varieties in Red Hill.</p>
      
      <h2>Artisanal Coastal Delights</h2>
      <p>Conclude your serene day visiting historic ocean-facing seaside lookouts at Arthurs Seat and strolling through seaside Flinders and Sorrento villages. Travel safely and elegantly in Melbourne's master fleet.</p>
    `
  },
  {
    id: "page-vip-experiences",
    title: "VIP Executive Hourly Hire",
    slug: "vip-experiences",
    category: "Services",
    active: true,
    featuredImage: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?q=80&w=2070&auto=format&fit=crop",
    featuredImageAlt: "Prestige luxury sedan detailing under dim nightlights",
    excerpt: "Absolute dynamic flexibility. Reserve a premium vehicle and elite chauffeur strictly on an hourly basis.",
    metaTitle: "As-Directed Hourly Chauffeur Hire | Merlux Premium",
    metaDescription: "Dynamic, flexible hourly prestige vehicle and driver bookings for VIP requirements, dining, events, and shopping.",
    keywords: ["VIP Hourly Car", "As Directed Chauffeur", "Private driver by hour", "Melbourne prestige ride"],
    publishAt: "2026-01-01T00:00:00.000Z",
    customCss: ".cms-rendered-content h2 { color: #D4AF37; }",
    isCustomCssActive: true,
    createdAt: { seconds: 1767225600, nanoseconds: 0 },
    content: `
      <h2>Absolute Liberty and On-Going Service</h2>
      <p>When coordinates and schedules shift dynamically, rely on our prestigious hourly booking solution. With our "As-Directed" VIP package, select your luxury car model and keep it for any number of hours you demand.</p>
      <p>Your professional chauffeur stays with you round-the-clock, managing all wait times, baggage holdings, destination updates, and swift pickups without delay. Ideal for premium luxury retail excursions, diplomatic travels, high-society gala events, and high-security details.</p>
      
      <h2>VIP Standard Accommodations</h2>
      <p>Our drivers are certified in advanced defense driving, close-quarters VIP logistics, and discretion. Experience the ultimate peace of mind knowing that Melbourne's finest chauffeur is completely focused on your time.</p>
    `
  }
];
