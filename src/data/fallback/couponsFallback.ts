export interface FallbackCoupon {
  id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  startDate?: string;
  endDate?: string;
  serviceIds?: string[];
  usageLimit?: number | null;
  usedCount?: number;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export const couponsFallback: FallbackCoupon[] = [
  {
    "id": "Ayrpm9xK1M2zB17Kd8kq",
    "endDate": "2026-04-22",
    "serviceIds": [],
    "usedCount": 10,
    "code": "SAVE20",
    "value": 20,
    "startDate": "2026-04-09",
    "active": false,
    "type": "percentage"
  },
  {
    "id": "mM5N6uGoLI0E9mXuBWao",
    "endDate": "2026-05-16",
    "code": "MERLUX",
    "serviceIds": [],
    "usedCount": 9,
    "startDate": "2026-04-11",
    "active": false,
    "value": 10,
    "usageLimit": 0,
    "type": "percentage"
  },
  {
    "id": "wNLI7aZXp9Hvz5nedxX9",
    "code": "MERLUX30",
    "startDate": "2026-04-22",
    "active": true,
    "usageLimit": 10,
    "value": 30,
    "type": "fixed",
    "endDate": "2026-06-23",
    "serviceIds": [
      "airport",
      "corporate",
      "wedding",
      "hourly"
    ],
    "usedCount": 6
  }
];
