export interface FleetVehicle {
  id: string;
  name: string;
  model: string;
  type: string;
  excerpt: string;
  pax: number;
  bags: number;
  basePrice: number;
  hourlyPrice: number;
  img: string;
  features: string[];
  bestFor: string[];
  kmRanges: Array<{ label: string; surcharge: number }>;
  active: boolean;
}

export const fleetFallback: FleetVehicle[] = [
  {
    id: "fleet-business-sedan",
    name: "Business Sedan",
    model: "Mercedes-Benz E-Class",
    type: "Sedan",
    excerpt: "Perfect for corporate travel and airport transfers for up to 3 passengers.",
    pax: 3,
    bags: 2,
    basePrice: 95.5,
    hourlyPrice: 90.9,
    img: "assets/Sedan.webp",
    features: ["Leather Interior", "Climate Control", "Bottled Water", "WiFi"],
    bestFor: ["Executive Travel", "Business Meetings", "City Transfers"],
    active: true,
    kmRanges: [
      { label: "0-25", surcharge: 0 },
      { label: "25-50", surcharge: 1.91 },
      { label: "50-100", surcharge: 2.39 },
      { label: "100+", surcharge: 1.91 }
    ]
  },
  {
    id: "fleet-business-suv",
    name: "Business SUV",
    model: "Audi Q7 / BMW X5",
    type: "SUV",
    excerpt: "Spacious and powerful, ideal for families and small groups with luggage.",
    pax: 4,
    bags: 4,
    basePrice: 114.5,
    hourlyPrice: 109,
    img: "assets/SUV.webp",
    features: ["Luxury Leather", "Panoramic Roof", "High Capacity", "Premium Audio"],
    bestFor: ["Family Trips", "Ski Transfers", "Group Travel"],
    active: true,
    kmRanges: [
      { label: "0-25", surcharge: 0 },
      { label: "25-50", surcharge: 2.39 },
      { label: "50-100", surcharge: 2.86 },
      { label: "100+", surcharge: 2.39 }
    ]
  },
  {
    id: "fleet-first-class",
    name: "First Class Sedan",
    model: "Mercedes-Benz S-Class",
    type: "First Class",
    excerpt: "The ultimate in luxury and prestige. Experience the finest chauffeur travel.",
    pax: 3,
    bags: 2,
    basePrice: 152.75,
    hourlyPrice: 145.5,
    img: "assets/First Class Sedan.webp",
    features: ["Reclining Rear Seats", "Rear Entertainment", "Chilled Water", "Absolute Privacy"],
    bestFor: ["VIP Transfers", "Wedding Transport", "Special Occasions"],
    active: true,
    kmRanges: [
      { label: "0-25", surcharge: 0 },
      { label: "25-50", surcharge: 3.34 },
      { label: "50-100", surcharge: 3.82 },
      { label: "100+", surcharge: 3.34 }
    ]
  },
  {
    id: "fleet-business-van",
    name: "Business Van",
    model: "Mercedes-Benz V-Class",
    type: "Van",
    excerpt: "Premier group transport for up to 7 passengers in conference seating.",
    pax: 7,
    bags: 7,
    basePrice: 133.9,
    hourlyPrice: 126,
    img: "assets/Van.webp",
    features: ["Conference Seating", "Spacious Cabin", "Privacy Glass", "Large Boot"],
    bestFor: ["Corporate Teams", "Event Shuttles", "Golf Tours"],
    active: true,
    kmRanges: [
      { label: "0-25", surcharge: 0 },
      { label: "25-50", surcharge: 2.86 },
      { label: "50-100", surcharge: 3.34 },
      { label: "100+", surcharge: 2.86 }
    ]
  }
];
