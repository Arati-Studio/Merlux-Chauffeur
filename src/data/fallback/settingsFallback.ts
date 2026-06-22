export interface SystemSettings {
  contact: {
    address: string;
    phone: string;
    email: string;
    bookingEmail: string;
    [key: string]: any;
  };
  pricing: {
    baseRate: number;
    perKmRate: number;
    perMinuteRate: number;
    airportSurcharge: number;
    nightSurcharge: number;
    nightBonusPercent: number;
    [key: string]: any;
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
      [key: string]: any;
    };
    [key: string]: any;
  };
  bbox: {
    north: number;
    south: number;
    east: number;
    west: number;
    [key: string]: any;
  };
  styleFlags: {
    enableGradients: boolean;
    useGoldTheme: boolean;
    roundedDesign: boolean;
    [key: string]: any;
  };
  maxKm?: number;
  taxPercentage?: number;
  showExtrasPrice?: boolean;
  hourlyMinHours?: number;
  allowAdminRegistration?: boolean;
  distanceCalculationType?: string;
  hourlyHourStep?: number;
  showTax?: boolean;
  showBasePrice?: boolean;
  hourlyMaxHours?: number;
  showGrossPrice?: boolean;
  showDiscount?: boolean;
  limitCity?: string;
  limitCountry?: string;
  showNetPrice?: boolean;
  showWaypointPrice?: boolean;
  kmPrice?: number;
  showPriceBreakdown?: boolean;
  showStripeFees?: boolean;
  waypointPrice?: number;
  showDistanceEyeIcon?: boolean;
  stripeFeePercentage?: number;
  limitZipCode?: string;
  bookingTimeStep?: number;
  waypointLimit?: number;
  minKm?: number;
  showDistancePrice?: boolean;
  showTotalPrice?: boolean;
  services?: Array<{
    id: string;
    name: string;
    icon: string;
    desc: string;
    [key: string]: any;
  }>;
  basePrice?: number;
  maxBookingDistance?: number;
  showCompleteRideButton?: boolean;
  minBookingDistance?: number;
  allowCashPayment?: boolean;
  pickupHoursStart?: string;
  pickupHoursEnd?: string;
  [key: string]: any;
}

export const settingsFallback: SystemSettings = {
  "contact": {
    "address": "Melbourne VIC, Australia",
    "phone": "+61426444449",
    "email": "bookings@merlux.au",
    "bookingEmail": "bookings@merlux.au"
  },
  "pricing": {
    "baseRate": 50,
    "perKmRate": 2.5,
    "perMinuteRate": 1.5,
    "airportSurcharge": 25,
    "nightSurcharge": 20,
    "nightBonusPercent": 15
  },
  "company": {
    "name": "Merlux Chauffeur",
    "description": "Melbourne's premier luxury chauffeur service provider.",
    "logoUrl": "",
    "footerText": "© 2026 Merlux Chauffeur. All rights reserved.",
    "socialLinks": {
      "facebook": "https://facebook.com/merlux",
      "instagram": "https://instagram.com/merlux",
      "linkedin": "https://linkedin.com/company/merlux"
    }
  },
  "bbox": {
    "north": -37.5,
    "south": -38.5,
    "east": 145.5,
    "west": 144.5
  },
  "styleFlags": {
    "enableGradients": true,
    "useGoldTheme": true,
    "roundedDesign": true
  },
  "maxKm": 250,
  "taxPercentage": 10,
  "showExtrasPrice": true,
  "hourlyMinHours": 2,
  "allowAdminRegistration": true,
  "distanceCalculationType": "type2",
  "hourlyHourStep": 1,
  "showTax": true,
  "showBasePrice": true,
  "hourlyMaxHours": 24,
  "showGrossPrice": true,
  "showDiscount": true,
  "limitCity": "VIC",
  "limitCountry": "AU",
  "showNetPrice": true,
  "showWaypointPrice": true,
  "kmPrice": 2.5,
  "showPriceBreakdown": true,
  "showStripeFees": true,
  "waypointPrice": 13.64,
  "showDistanceEyeIcon": false,
  "stripeFeePercentage": 4,
  "limitZipCode": "3000 - 3999",
  "bookingTimeStep": 30,
  "waypointLimit": 2,
  "minKm": 2,
  "showDistancePrice": true,
  "showTotalPrice": true,
  "services": [
    {
      "id": "airport",
      "name": "Airport Transfer",
      "icon": "Plane",
      "desc": "Reliable transfers To or from Melbourne Airport with flight tracking. "
    },
    {
      "desc": "Professional chauffeur service for executives and business events.",
      "icon": "Briefcase",
      "name": "Corporate Travel",
      "id": "corporate"
    },
    {
      "desc": "Elegant transport for your special day with premium vehicles.",
      "name": "Wedding Service",
      "id": "wedding",
      "icon": "Heart"
    },
    {
      "id": "events",
      "name": "Special Events",
      "icon": "PartyPopper",
      "desc": "Arrive in style at galas, concerts, and sporting events."
    },
    {
      "name": "Hourly Hire",
      "id": "hourly",
      "icon": "Clock",
      "desc": "Flexible chauffeur service for any number of hours, tailored to your needs."
    },
    {
      "name": " Special Occasions",
      "id": "occassions",
      "icon": "Sparkles",
      "desc": "Chauffeur service designed to add elegance and ease to life’s most memorable moments"
    }
  ],
  "basePrice": 50,
  "maxBookingDistance": 25,
  "showCompleteRideButton": true,
  "minBookingDistance": 2,
  "allowCashPayment": false,
  "pickupHoursStart": "00:00",
  "pickupHoursEnd": "23:59"
};
