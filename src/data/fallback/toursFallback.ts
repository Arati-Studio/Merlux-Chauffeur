export interface Tour {
  id: string;
  title: string;
  slug: string;
  category: string;
  duration: string;
  price: number; // base starting price
  image: string;
  shortDescription: string;
  description: string;
  active: boolean;
  featured: boolean;
  fleets: Array<{
    id: string;
    name: string;
    price: number;
    salePrice?: number;
    standardPrice?: number;
  }>;
  itinerary: Array<{
    time?: string;
    title: string;
    description: string;
  }>;
  extras?: Array<{
    id: string;
    name: string;
    price: number;
    max?: number;
    desc?: string;
  }>;
  availability?: {
    startDate?: string;
    endDate?: string;
  };
}

export const toursFallback: Tour[] = [
  {
    id: "tour-yarra-valley",
    title: "Yarra Valley Premium Wine Tour",
    slug: "yarra-valley-premium",
    category: "Winery Tours",
    duration: "Full Day (8 Hours)",
    price: 650,
    image: "https://images.unsplash.com/photo-1516594709406-e8a17a153259?q=80&w=2070&auto=format&fit=crop",
    shortDescription: "Explore Victoria's world-class wineries in the Yarra Valley with a dedicated private chauffeur.",
    description: "Indulge in a sophisticated journey through the Rolling Hills of the Yarra Valley. This private tour is completely customizable, allowing you to visit your preferred cellar doors, dine at award-winning restaurants, and enjoy the region's finest cool-climate wines without the worry of driving.",
    active: true,
    featured: true,
    fleets: [
      { id: "fleet-business-sedan", name: "Business Sedan", price: 650, salePrice: 585 },
      { id: "fleet-business-suv", name: "Business SUV", price: 780, salePrice: 700 },
      { id: "fleet-business-van", name: "Business Van", price: 950, salePrice: 850 }
    ],
    itinerary: [
      { time: "09:00", title: "Melbourne CBD Departure", description: "Your chauffeur arrives at your designated pickup address." },
      { time: "10:30", title: "Domaine Chandon", description: "Start the day with world-class sparkling wine and panoramic vineyard views." },
      { time: "12:30", title: "Gourmet Lunch", description: "Reserved dining at a hatted restaurant (e.g., Levantine Hill or Oakridge)." },
      { time: "14:30", title: "Boutique Cellar Doors", description: "Visit hidden gems like Yering Station or TarraWarra Estate." },
      { time: "17:00", title: "Return Journey", description: "Relax as we navigate back to Melbourne." }
    ],
    extras: [
      { id: "refreshment-pack", name: "Premium Refreshment Pack", price: 45, desc: "Artisan chocolates, chilled sparkling water, and local treats." },
      { id: "child-seat", name: "Child Safety Seat", price: 15, max: 2, desc: "ISOFIX compatible premium safety seats." }
    ]
  },
  {
    id: "tour-great-ocean-road",
    title: "Great Ocean Road Private Adventure",
    slug: "great-ocean-road-private",
    category: "Scenic Tours",
    duration: "Full Day (11 Hours)",
    price: 850,
    image: "https://images.unsplash.com/photo-1473615695634-d284ec918736?q=80&w=2070&auto=format&fit=crop",
    shortDescription: "Experience Australia's most spectacular coastal drive in the unparalleled comfort of a luxury vehicle.",
    description: "Witness the majestic 12 Apostles, traverse ancient rainforest galleries at Otway National Park, and enjoy lunch in the seaside village of Apollo Bay. This private tour removes the stress of the long drive, allowing you to focus purely on the breathtaking Southern Ocean views.",
    active: true,
    featured: true,
    fleets: [
      { id: "fleet-business-sedan", name: "Business Sedan", price: 850, salePrice: 790 },
      { id: "fleet-business-suv", name: "Business SUV", price: 990, salePrice: 920 },
      { id: "fleet-business-van", name: "Business Van", price: 1250, salePrice: 1100 }
    ],
    itinerary: [
      { time: "08:00", title: "Early Departure", description: "Melbourne CBD pickup to maximize daylight on the coast." },
      { time: "10:30", title: "Memorial Arch", description: "The iconic gateway to the Great Ocean Road." },
      { time: "13:00", title: "Apollo Bay Coastal Lunch", description: "Fresh seafood and seaside charm." },
      { time: "15:30", title: "The 12 Apostles", description: "Guided exploration of the world-famous limestone stacks." },
      { time: "19:00", title: "Melbourne Return", description: "Direct highway return via the inland route." }
    ]
  }
];
