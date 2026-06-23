export interface Offer {
  id: string;
  title: string;
  slug: string;
  image: string;
  description: string;
  price?: number; // fallback min price
  discountType: "percentage" | "fixed";
  discountValue: number;
  tags: string[];
  active: boolean;
  fleets: Array<{
    id: string;
    name: string;
    price: number;
    salePrice: number;
  }>;
}

export const offersFallback: Offer[] = [
  {
    id: "offer-airport-luxury",
    title: "Melbourne Airport Signature Arrival",
    slug: "airport-signature-arrival",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop",
    description: "Experience the ultimate airport arrival. Meet and greet included with premium European sedan service. Fixed rate from CBD to Tullamarine.",
    discountType: "percentage",
    discountValue: 15,
    tags: ["Airport", "Limited Time", "Premium"],
    active: true,
    fleets: [
      { id: "fleet-business-sedan", name: "Business Sedan", price: 110, salePrice: 93.5 },
      { id: "fleet-first-class", name: "First Class Sedan", price: 175, salePrice: 148.75 }
    ]
  },
  {
    id: "offer-weekend-escape",
    title: "Yarra Valley Weekend Special",
    slug: "yarra-valley-weekend-special",
    image: "https://images.unsplash.com/photo-1516594709406-e8a17a153259?q=80&w=2070&auto=format&fit=crop",
    description: "Book a full-day winery tour on a Saturday or Sunday and receive a fixed $50 discount on SUV and Van bookings.",
    discountType: "fixed",
    discountValue: 50,
    tags: ["Tour", "Weekend", "Group"],
    active: true,
    fleets: [
      { id: "fleet-business-suv", name: "Business SUV", price: 780, salePrice: 730 },
      { id: "fleet-business-van", name: "Business Van", price: 950, salePrice: 900 }
    ]
  }
];
