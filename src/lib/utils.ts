import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: any): string {
  if (!date) return '';

  try {
    // 1. Handle Firestore Timestamp object
    if (date && typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }

    // 2. Handle object with seconds/nanoseconds (Firestore-like)
    if (date && typeof date.seconds === 'number') {
      return new Date(date.seconds * 1000).toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }

    // 3. Handle JavaScript Date object
    if (date instanceof Date) {
      if (isNaN(date.getTime())) return '';
      return date.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }

    // 4. Handle String or Number
    const parsedDate = new Date(date);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.toLocaleDateString('en-AU', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    }
  } catch (e) {
    console.error('Error formatting date:', e);
  }

  return '';
}
