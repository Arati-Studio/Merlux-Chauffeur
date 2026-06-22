export interface FallbackExtra {
  id: string;
  name: string;
  active: boolean;
  price: number;
  description?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export const extrasFallback: FallbackExtra[] = [
  {
    "id": "PHKBXHIFmanDLh7P87wp",
    "name": "Baby Seat ",
    "active": true,
    "price": 10,
    "description": "Below 4 Years"
  },
  {
    "id": "T4bmRLEXnxexF0AOKz2t",
    "name": "Front Baby Seats",
    "active": true,
    "price": 15,
    "description": "Below 2 Years"
  }
];
