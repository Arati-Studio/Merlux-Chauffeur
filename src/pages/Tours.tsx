import { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, Users, ArrowRight, Star, Calendar, User, Mail, Phone, CreditCard, Minus, Plus, ChevronRight, ChevronLeft, CheckCircle, Info, LayoutGrid, DollarSign, Tag, X, Image as ImageIcon, Banknote as BanknoteIcon, UserCheck, FileText, Luggage, LocateFixed, BadgePercent, Shield, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getCachedDocs } from '../lib/firestore-cache';
import { onAuthStateChanged } from 'firebase/auth';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { FormNotice, type NoticeType } from '../components/FormNotice';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { toursFallback } from '../data/fallback/toursFallback';
import { cn, getAssetPath } from '../lib/utils';
import Logo from '../components/layout/Logo';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '../lib/google-maps';
import LoginInline from '../components/LoginInline';
import SEO from '../components/SEO';
import { generateDescriptionFromContent } from '../lib/seo';

const COUNTRY_CODES = [
  { code: "+61", short: "AU +61" },
  { code: "+64", short: "NZ +64" },
  { code: "+1", short: "US +1" },
  { code: "+44", short: "UK +44" },
  { code: "+65", short: "SG +65" },
  { code: "+86", short: "CN +86" },
  { code: "+91", short: "IN +91" },
  { code: "+971", short: "AE +971" },
  { code: "+60", short: "MY +60" },
  { code: "+81", short: "JP +81" },
  { code: "+49", short: "DE +49" },
  { code: "+33", short: "FR +33" },
  { code: "+82", short: "KR +82" },
  { code: "+62", short: "ID +62" },
  { code: "+66", short: "TH +66" },
  { code: "+84", short: "VN +84" },
  { code: "+39", short: "IT +39" },
  { code: "+34", short: "ES +34" },
  { code: "+63", short: "PH +63" },
  { code: "+94", short: "LK +94" },
];

const parsePhoneNumber = (phone: string) => {
  const cleanPhone = (phone || "").trim();
  const sortedCodes = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const item of sortedCodes) {
    if (cleanPhone.startsWith(item.code)) {
      return {
        countryCode: item.code,
        localNumber: cleanPhone.substring(item.code.length).trim()
      };
    }
  }
  return {
    countryCode: "+61",
    localNumber: cleanPhone
  };
};

export default function Tours() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [tours, setTours] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [priceAddons, setPriceAddons] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string; title?: string } | null>(null);

  const showNotice = (type: NoticeType, message: string, title?: string) => {
    setNotice({ type, message, title });
    if (type === 'success' || type === 'info') {
      setTimeout(() => setNotice(null), 5000);
    }
  };

  useEffect(() => {
    const savedData = localStorage.getItem('tour_booking_draft');
    const isCancelled = new URLSearchParams(window.location.search).get('cancelled');

    if (savedData && isCancelled === 'true') {
      try {
        const data = JSON.parse(savedData);
        if (data.details) setDetails(data.details);
        if (data.step) setStep(data.step);
        if (data.selectedTour) setSelectedTour(data.selectedTour);
        if (data.selectedFleet) setSelectedFleet(data.selectedFleet);
        if (data.selectedExtras) setSelectedExtras(data.selectedExtras);
        if (data.quantity) setQuantity(data.quantity);
        // Clean up
        localStorage.removeItem('tour_booking_draft');
      } catch (err) {
        console.error('Failed to restore tour booking draft:', err);
      }
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        // Fetch profile data
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const userData = userSnap.data();
          setDetails(prev => ({
            ...prev,
            name: userData.name || prev.name,
            email: userData.email || prev.email,
            phone: userData.phone || prev.phone
          }));
        } else {
          // Basic data from auth
          setDetails(prev => ({
            ...prev,
            name: user.displayName || prev.name,
            email: user.email || prev.email
          }));
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const pickupAutocompleteRef = useRef<any>(null);
  const dropoffAutocompleteRef = useRef<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'system'));
        if (docSnap.exists()) {
          setSystemSettings(docSnap.data());
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const onPickupPlaceChanged = () => {
    if (pickupAutocompleteRef.current) {
      const place = pickupAutocompleteRef.current.getPlace();
      if (place?.formatted_address) {
        setDetails(prev => ({ ...prev, pickup: place.formatted_address }));
        if (place.geometry?.location) {
          setPickupCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          });
        }
      }
    }
  };

  const onDropoffPlaceChanged = () => {
    if (dropoffAutocompleteRef.current) {
      const place = dropoffAutocompleteRef.current.getPlace();
      if (place?.formatted_address) {
        setDetails(prev => ({ ...prev, dropoff: place.formatted_address }));
        if (place.geometry?.location) {
          setDropoffCoords({
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
          });
        }
      }
    }
  };

  const handleGeolocation = async (field: "pickup" | "dropoff") => {
    if (!navigator.geolocation) {
      showNotice('error', "Geolocation is not supported by your browser", 'Location Error');
      return;
    }

    showNotice('info', "Finding your location...", 'Locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        if (!window.google || !window.google.maps || !isLoaded) {
          showNotice('error', "Maps service not fully loaded. Try again.", 'Error');
          return;
        }
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const address = results[0].formatted_address;
            setDetails(prev => ({ ...prev, [field]: address }));
            const coords = { lat: latitude, lng: longitude };
            if (field === 'pickup') {
              setPickupCoords(coords);
            } else {
              setDropoffCoords(coords);
            }
            showNotice('success', "Location found!", 'Success');
          } else {
            showNotice('error', "Could not determine address", 'Geocoding Error');
          }
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        showNotice('error', "Could not access your location", 'Permission Denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const autocompleteOptions = useMemo(() => {
    const options: any = {
      types: ['address']
    };
    if (systemSettings?.limitCountry) {
      options.componentRestrictions = { country: systemSettings.limitCountry.split(',').map((c: string) => c.trim().toLowerCase()) };
    }
    return options;
  }, [systemSettings]);
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [selectedFleet, setSelectedFleet] = useState<any>(null);
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>({});
  const [quantity, setQuantity] = useState(1);
  const [paymentType, setPaymentType] = useState<'cash' | 'stripe'>('stripe');

  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.allowStripeCardPayment === false && systemSettings.allowCashPayment !== false && paymentType === 'stripe') {
        setPaymentType('cash');
      } else if (systemSettings.allowCashPayment === false && systemSettings.allowStripeCardPayment !== false && paymentType === 'cash') {
        setPaymentType('stripe');
      }
    }
  }, [systemSettings, paymentType]);
  const [expandedItinerary, setExpandedItinerary] = useState<number | null>(0);
  const [mainImage, setMainImage] = useState<string>('');
  const [details, setDetails] = useState({
    name: '',
    email: '',
    phone: '',
    pickup: '',
    dropoff: '',
    notes: '',
    date: '',
    time: '',
    returnRide: false,
    returnDate: '',
    returnTime: ''
  });

  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);

  useEffect(() => {
    if (!isLoaded || !details.pickup || details.pickup.length < 5) {
      setPickupCoords(null);
      return;
    }
    const timer = setTimeout(() => {
      if (!window.google || !window.google.maps) return;
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: details.pickup }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          setPickupCoords({ lat: loc.lat(), lng: loc.lng() });
        }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [details.pickup, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !details.dropoff || details.dropoff.length < 5) {
      setDropoffCoords(null);
      return;
    }
    const timer = setTimeout(() => {
      if (!window.google || !window.google.maps) return;
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: details.dropoff }, (results, status) => {
        if (status === "OK" && results?.[0]) {
          const loc = results[0].geometry.location;
          setDropoffCoords({ lat: loc.lat(), lng: loc.lng() });
        }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [details.dropoff, isLoaded]);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [priceSort, setPriceSort] = useState<"none" | "asc" | "desc">("none");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(12);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, durationFilter, priceSort, pageSize]);

  const categories = useMemo(() => {
    const cats = new Set(tours.map(t => t.category).filter(Boolean));
    return ["all", ...Array.from(cats)];
  }, [tours]);

  const durations = useMemo(() => {
    const durs = new Set(tours.map(t => t.duration).filter(Boolean));
    return ["all", ...Array.from(durs)];
  }, [tours]);

  const getStartingPrice = (tour: any) => {
    if (tour.fleets && Array.isArray(tour.fleets) && tour.fleets.length > 0) {
      const prices = tour.fleets.map((f: any) => Number(f?.salePrice || f?.standardPrice || f?.price || 0)).filter((p: number) => p > 0);
      if (prices.length > 0) return Math.min(...prices);
    }
    return tour.price || 0;
  };

  const filteredTours = useMemo(() => {
    let result = [...tours];

    // Filter out expired tours
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    result = result.filter(t => {
      if (t.availability?.endDate) {
        try {
          if (/^\d{4}-\d{2}-\d{2}$/.test(t.availability.endDate)) {
            return t.availability.endDate >= todayStr;
          }
          const end = new Date(t.availability.endDate);
          if (!isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            return end >= now;
          }
        } catch (e) {
          console.error("Error parsing tour endDate:", e);
        }
      }
      return true;
    });

    if (searchQuery) {
      result = result.filter(t =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.shortDescription.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter(t => t.category === categoryFilter);
    }

    if (durationFilter !== "all") {
      result = result.filter(t => t.duration === durationFilter);
    }

    if (priceSort !== "none") {
      result.sort((a, b) => {
        const priceA = Number(getStartingPrice(a));
        const priceB = Number(getStartingPrice(b));
        return priceSort === "asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return result;
  }, [tours, searchQuery, categoryFilter, durationFilter, priceSort]);

  const totalPages = pageSize === 'All' ? 1 : Math.max(1, Math.ceil(filteredTours.length / (pageSize as number)));

  const paginatedTours = useMemo(() => {
    if (pageSize === 'All') return filteredTours;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredTours.slice(startIndex, startIndex + pageSize);
  }, [filteredTours, currentPage, pageSize]);

  useEffect(() => {
    let active = true;
    const fetchToursAndAddons = async () => {
      try {
        const q = query(collection(db, 'tours'), where('active', '==', true));
        const fetchedTours = await getCachedDocs(q, 'tours_active');
        if (active) {
          if (fetchedTours.length > 0) {
            setTours(fetchedTours);
          } else {
            setTours(toursFallback);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn("Tours dynamic loading suspended, using fallback:", err);
        if (active) {
          setTours(toursFallback);
          setIsLoading(false);
        }
      }

      try {
        const addonsQ = query(collection(db, 'price-addons'), where('active', '==', true));
        const fetchedAddons = await getCachedDocs(addonsQ, 'price_addons_active');
        if (active) {
          setPriceAddons(fetchedAddons);
        }
      } catch (err) {
        console.warn("Price addons loading suspended:", err);
      }
    };

    fetchToursAndAddons();
    return () => {
      active = false;
    };
  }, []);

  // Deep Linking Effect
  useEffect(() => {
    if (tours.length > 0) {
      if (slug) {
        const tour = tours.find(t => t.slug === slug);
        if (tour) {
          if (!selectedTour || selectedTour.slug !== slug) {
            setSelectedTour(tour);
            setMainImage(tour.image || tour.featuredImage);
            setShowFullDetails(true);
            setExpandedItinerary(0);
          }
        } else {
          setSelectedTour(null);
          setShowFullDetails(false);
          setStep(1);
          navigate('/tours', { replace: true });
        }
      } else {
        if (selectedTour) {
          setSelectedTour(null);
          setShowFullDetails(false);
          setStep(1);
        }
      }
    }
  }, [slug, tours, selectedTour, navigate]);

  const handleTourSelect = (tour: any) => {
    setSelectedTour(tour);
    setMainImage(tour.image || tour.featuredImage);
    setShowFullDetails(true);
    setExpandedItinerary(0);
    navigate(`/tours/${tour.slug}`, { replace: true });
  };

  const handleStartBooking = (tour?: any) => {
    const activeTour = tour || selectedTour;
    setShowFullDetails(false);
    setStep(2); // Jump to vehicle selection

    // Default select first fleet if available and none selected
    if (!selectedFleet && activeTour?.fleets && activeTour.fleets.length > 0) {
      setSelectedFleet(activeTour.fleets[0]);
    }
  };

  const handleFleetSelect = (fleet: any) => {
    // If clicking already selected, keep it selected (one must be selected)
    // Or allow deselect if that's preferred, but usually for "one allowed" we just switch
    setSelectedFleet(fleet);
  };

  const toggleExtra = (extraIdOrName: string) => {
    setSelectedExtras(prev => {
      const current = prev[extraIdOrName] || 0;
      if (current > 0) {
        const { [extraIdOrName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [extraIdOrName]: 1 };
    });
  };

  const updateExtraCount = (extraIdOrName: string, delta: number, maxCount?: number) => {
    setSelectedExtras(prev => {
      const current = prev[extraIdOrName] || 0;
      let next = Math.max(0, current + delta);
      if (maxCount !== undefined && maxCount !== null) {
        next = Math.min(next, Number(maxCount));
      }
      if (next === 0) {
        const { [extraIdOrName]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [extraIdOrName]: next };
    });
  };

  const calculateTourPriceBreakdown = () => {
    if (!selectedFleet) return { base: 0, extras: 0, subtotal: 0, appliedAddons: [], total: 0 };

    let base = Number(selectedFleet?.salePrice || selectedFleet?.standardPrice || selectedFleet?.price || 0);

    if (details.returnRide) {
      base *= 2;
    }

    const extrasTotal = Object.entries(selectedExtras).reduce((acc, [idOrName, count]) => {
      const extra = (selectedTour?.extras || []).find((e: any) => (e.id || e.name) === idOrName);
      return acc + (Number(extra?.price || 0) * (count as number));
    }, 0);

    const subtotal = (base * quantity) + extrasTotal;

    // Apply Add-ons
    let addonTotal = 0;
    const appliedAddons: any[] = [];
    const formatTimeString = (t: string) => {
      if (!t) return "";
      const parts = t.split(":");
      if (parts.length < 2) return t;
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? "PM" : "AM";
      h = h % 12;
      h = h ? h : 12;
      return `${h}:${m} ${ampm}`;
    };

    (priceAddons || []).forEach((addon) => {
      if (!addon.active) return;

      // 1. Page/Scope Filter
      if (addon.applyToTours === false) return;

      // 1.5 Activation Date Range verification (auto-deactivates dynamically)
      if (addon.activeStartDate || addon.activeEndDate) {
        const todayLocal = new Date().toISOString().split("T")[0];
        if (addon.activeStartDate && todayLocal < addon.activeStartDate) return;
        if (addon.activeEndDate && todayLocal > addon.activeEndDate) return;
      }

      const satisfyDetails: string[] = [];
      const ruleResults: { matched: boolean; details: string[] }[] = [];

      // 2. Location restriction
      if (addon.limitLocation) {
        const checkBBoxLocation = (lat: number, lng: number) => {
          if (addon.bboxes && addon.bboxes.length > 0) {
            return addon.bboxes.some((box: any) => {
              const n = Number(box.north);
              const s = Number(box.south);
              const e = Number(box.east);
              const w = Number(box.west);
              const matchLat = lat >= Math.min(s, n) && lat <= Math.max(s, n);
              const matchLng = lng >= Math.min(w, e) && lng <= Math.max(w, e);
              return matchLat && matchLng;
            });
          }
          const n = Number(addon.bboxNorth);
          const s = Number(addon.bboxSouth);
          const e = Number(addon.bboxEast);
          const w = Number(addon.bboxWest);
          const matchLat = lat >= Math.min(s, n) && lat <= Math.max(s, n);
          const matchLng = lng >= Math.min(w, e) && lng <= Math.max(w, e);
          return matchLat && matchLng;
        };

        const hasPickup = pickupCoords && typeof pickupCoords.lat === "number" && typeof pickupCoords.lng === "number";
        const hasDropoff = dropoffCoords && typeof dropoffCoords.lat === "number" && typeof dropoffCoords.lng === "number";

        let locationMatch = false;
        const matchedNames: string[] = [];
        const getBBoxName = (lat: number, lng: number) => {
          if (addon.bboxes && addon.bboxes.length > 0) {
            const found = addon.bboxes.find((box: any) => {
              const n = Number(box.north);
              const s = Number(box.south);
              const e = Number(box.east);
              const w = Number(box.west);
              const matchLat = lat >= Math.min(s, n) && lat <= Math.max(s, n);
              const matchLng = lng >= Math.min(w, e) && lng <= Math.max(w, e);
              return matchLat && matchLng;
            });
            if (found) return found.name || "Custom Range";
          } else {
            const n = Number(addon.bboxNorth);
            const s = Number(addon.bboxSouth);
            const e = Number(addon.bboxEast);
            const w = Number(addon.bboxWest);
            const matchLat = lat >= Math.min(s, n) && lat <= Math.max(s, n);
            const matchLng = lng >= Math.min(w, e) && lng <= Math.max(w, e);
            if (matchLat && matchLng) {
              return "Default Range";
            }
          }
          return null;
        };

        if (addon.bboxTarget === "pickup") {
          locationMatch = !!(hasPickup && checkBBoxLocation(pickupCoords.lat, pickupCoords.lng));
          if (locationMatch && hasPickup) {
            const name = getBBoxName(pickupCoords.lat, pickupCoords.lng);
            if (name) matchedNames.push(name);
          }
        } else if (addon.bboxTarget === "dropoff") {
          locationMatch = !!(hasDropoff && checkBBoxLocation(dropoffCoords.lat, dropoffCoords.lng));
          if (locationMatch && hasDropoff) {
            const name = getBBoxName(dropoffCoords.lat, dropoffCoords.lng);
            if (name) matchedNames.push(name);
          }
        } else if (addon.bboxTarget === "both") {
          locationMatch = !!(hasPickup && hasDropoff && checkBBoxLocation(pickupCoords.lat, pickupCoords.lng) && checkBBoxLocation(dropoffCoords.lat, dropoffCoords.lng));
          if (locationMatch && hasPickup && hasDropoff) {
            const nameP = getBBoxName(pickupCoords.lat, pickupCoords.lng);
            const nameD = getBBoxName(dropoffCoords.lat, dropoffCoords.lng);
            if (nameP) matchedNames.push(nameP);
            if (nameD && nameD !== nameP) matchedNames.push(nameD);
          }
        } else if (addon.bboxTarget === "either") {
          const matchP = hasPickup && checkBBoxLocation(pickupCoords.lat, pickupCoords.lng);
          const matchD = hasDropoff && checkBBoxLocation(dropoffCoords.lat, dropoffCoords.lng);
          locationMatch = !!(matchP || matchD);
          if (matchP && hasPickup) {
            const name = getBBoxName(pickupCoords.lat, pickupCoords.lng);
            if (name) matchedNames.push(name);
          } else if (matchD && hasDropoff) {
            const name = getBBoxName(dropoffCoords.lat, dropoffCoords.lng);
            if (name) matchedNames.push(name);
          }
        }

        ruleResults.push({
          matched: locationMatch,
          details: matchedNames.length > 0 ? [`[${matchedNames.join(", ")}]`] : []
        });
      }

      // 3. Date restriction
      if (addon.limitDates) {
        const checkDateInRange = (dateStr: string) => {
          if (!dateStr) return false;
          if (addon.dateRanges && addon.dateRanges.length > 0) {
            return addon.dateRanges.some((range: any) => {
              const s = range.startDate || "";
              const e = range.endDate || "";
              if (!s && !e) return false;
              if (s && dateStr < s) return false;
              if (e && dateStr > e) return false;
              return true;
            });
          }
          if (addon.startDate && dateStr < addon.startDate) return false;
          if (addon.endDate && dateStr > addon.endDate) return false;
          return true;
        };
        const matchP = checkDateInRange(details.date);
        const matchR = details.returnRide ? checkDateInRange(details.returnDate) : false;

        const checkedDates: string[] = [];
        if (matchP) checkedDates.push(details.date);
        if (matchR) checkedDates.push(details.returnDate);

        ruleResults.push({
          matched: matchP || matchR,
          details: (matchP || matchR) ? [`${checkedDates.join(", ")} matched validity constraints`] : []
        });
      }

      // 4. Time restriction
      if (addon.limitTime) {
        const checkTimeInRange = (timeStr: string) => {
          if (!timeStr) return false;
          const checkSingleRange = (start: string, end: string) => {
            if (start && end) {
              if (start > end) return timeStr >= start || timeStr <= end;
              return timeStr >= start && timeStr <= end;
            } else if (start) return timeStr >= start;
            else if (end) return timeStr <= end;
            return true;
          };

          if (addon.timeRanges && addon.timeRanges.length > 0) {
            return addon.timeRanges.some((range: any) => checkSingleRange(range.startTime, range.endTime));
          }
          return checkSingleRange(addon.startTime, addon.endTime);
        };
        const matchP = checkTimeInRange(details.time);
        const matchR = details.returnRide ? checkTimeInRange(details.returnTime) : false;
        
        let timeMatch = false;
        const target = addon.timeTarget || "any";
        if (target === "pickup") {
          timeMatch = matchP;
        } else if (target === "return") {
          timeMatch = details.returnRide ? matchR : false;
        } else if (target === "both") {
          timeMatch = details.returnRide ? (matchP && matchR) : matchP;
        } else {
          timeMatch = details.returnRide ? (matchP || matchR) : matchP;
        }

        const checkedTimes: string[] = [];
        if (matchP && (target === "pickup" || target === "any" || target === "both")) {
          checkedTimes.push(formatTimeString(details.time));
        }
        if (matchR && (target === "return" || target === "any" || target === "both")) {
          checkedTimes.push(formatTimeString(details.returnTime));
        }

        ruleResults.push({
          matched: timeMatch,
          details: timeMatch ? [`${checkedTimes.join(", ")} within window constraints`] : []
        });
      }

      // 5. Day of week restriction
      if (addon.limitDays) {
        const days = addon.selectedDays || [];
        const checkDay = (d: string) => {
          if (!d) return false;
          try {
            const parsedDate = new Date(d.replace(/-/g, "/"));
            const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
            const dayName = weekdays[parsedDate.getDay()];
            return days.includes(dayName);
          } catch (_) {
            return false;
          }
        };
        const matchP = checkDay(details.date);
        const matchR = details.returnRide ? checkDay(details.returnDate) : false;

        const satisfiedDays: string[] = [];
        const getDayName = (d: string) => {
          try {
            const parsedDate = new Date(d.replace(/-/g, "/"));
            return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parsedDate.getDay()];
          } catch (_) { return ""; }
        };
        if (matchP) satisfiedDays.push(getDayName(details.date));
        if (matchR) satisfiedDays.push(getDayName(details.returnDate));

        ruleResults.push({
          matched: matchP || matchR,
          details: (matchP || matchR) ? [`${satisfiedDays.join(", ")}`] : []
        });
      }

      // 6. Fleet restriction
      if (addon.limitFleet) {
        const fleetList = addon.selectedFleet || [];
        const matched = !!selectedFleet && (fleetList.includes(selectedFleet.name) || fleetList.includes(selectedFleet.id));
        ruleResults.push({
          matched,
          details: matched && selectedFleet ? [`${selectedFleet.name}`] : []
        });
      }

      // 7. Service restriction (Match against tour category/title text)
      if (addon.limitService) {
        const serviceList = addon.selectedServices || [];
        const hasTours = serviceList.map((s: string) => s.toLowerCase()).includes("tours");
        let matchesAny = false;
        if (hasTours) {
          const otherServices = serviceList.filter((s: string) => s.toLowerCase() !== "tours");
          if (otherServices.length > 0) {
            const tourVal = (selectedTour?.title || selectedTour?.category || "").toLowerCase();
            matchesAny = otherServices.some((s: string) => tourVal.includes(s.toLowerCase()));
          } else {
            matchesAny = true;
          }
        }
        ruleResults.push({
          matched: matchesAny,
          details: matchesAny ? [`${selectedTour?.title || "Tour"}`] : []
        });
      }

      // 8. One-way / Return ride restriction
      if (addon.limitRideType) {
        const targetType = addon.rideTypeTarget || "any";
        let matched = true;
        if (targetType === "oneway" && details.returnRide) matched = false;
        if (targetType === "return" && !details.returnRide) matched = false;
        ruleResults.push({
          matched,
          details: matched ? [`${details.returnRide ? "Return" : "One-Way"}`] : []
        });
      }

      // Apply AND / OR operator connection logic
      const connectionOperator = addon.connectionOperator || "AND";
      let finalMatch = true;
      if (ruleResults.length > 0) {
        if (connectionOperator === "OR") {
          finalMatch = ruleResults.some(r => r.matched);
        } else {
          finalMatch = ruleResults.every(r => r.matched);
        }
      }

      if (!finalMatch) return;

      // Collect details from matched rules
      ruleResults.forEach(r => {
        if (r.matched) {
          satisfyDetails.push(...r.details);
        }
      });

      // For tours/offers, gross/net/total are often the same since they are fixed packages
      // but we maintain the logic for consistency
      const baseValue = (base * quantity);

      let value = 0;
      if (addon.type === 'percentage') {
        value = baseValue * (addon.value / 100);
      } else {
        value = addon.value;
      }

      const impact = addon.operation === "subtraction" ? -value : value;
      addonTotal += impact;
      appliedAddons.push({
        id: addon.id,
        name: addon.name,
        value: value,
        impact: impact,
        type: addon.type,
        target: addon.target,
        operation: addon.operation,
        hideLabelInBreakdown: !!addon.hideLabelInBreakdown,
        hideSatisfyDetails: !!addon.hideSatisfyDetails,
        satisfyDetails
      });
    });

    return {
      base: base * quantity,
      extras: extrasTotal,
      subtotal,
      appliedAddons,
      addonTotal,
      total: subtotal + addonTotal
    };
  };

  const bookingPricing = calculateTourPriceBreakdown();
  const totalPrice = bookingPricing.total;

  const handleDetailsSubmit = (e: FormEvent) => {
    e.preventDefault();

    // Validate date and time
    const selectedDate = new Date(details.date + 'T00:00:00');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (selectedDate < today) {
      showNotice('warning', "Please select a future date.", 'Date Error');
      return;
    }

    if (details.returnRide) {
      if (!details.returnDate || !details.returnTime) {
        showNotice('warning', "Please select a return date and time.", 'Missing Info');
        return;
      }
      const returnDateObj = new Date(details.returnDate + 'T' + details.returnTime + ':00');
      let pickupTime = details.time;
      if (!pickupTime && selectedTour?.timeSlot) {
        pickupTime = selectedTour.timeSlot.split(' - ')[0] || '00:00';
      }
      const pickupDateObj = new Date(details.date + 'T' + (pickupTime || '00:00') + ':00');
      if (returnDateObj <= pickupDateObj) {
        showNotice('warning', "Return time must be after the pickup time.", 'Time Error');
        return;
      }
    }

    if (selectedDate.getTime() === today.getTime()) {
      const [hours, minutes] = details.time.split(':').map(Number);
      const selectedTime = new Date(today);
      selectedTime.setHours(hours, minutes, 0, 0);

      const minTime = new Date(now.getTime() + 6 * 60 * 60 * 1000); // 6 hours from now

      if (selectedTime < minTime) {
        showNotice('warning', "For same-day bookings, please select a time at least 6 hours in the future to allow for arrangements.", 'Time Restriction');
        return;
      }
    }

    setStep(4);
  };

  const reset = () => {
    setStep(1);
    setSelectedTour(null);
    setSelectedFleet(null);
    setSelectedExtras({});
    setQuantity(1);
    navigate('/tours', { replace: true });
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBooking = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const bookingData: any = {
        customerName: details.name,
        customerEmail: details.email?.toLowerCase(),
        customerPhone: details.phone,
        pickup: details.pickup,
        dropoff: details.dropoff || null,
        notes: details.notes || null,
        date: details.date,
        time: details.time,
        returnRide: details.returnRide,
        returnDate: details.returnRide ? details.returnDate : null,
        returnTime: details.returnRide ? details.returnTime : null,
        tourId: selectedTour.id,
        tourTitle: selectedTour.title,
        vehicleId: selectedFleet?.id || selectedFleet?.name || 'unknown',
        vehicleType: selectedFleet?.name || 'Unknown Vehicle',
        price: totalPrice,
        priceBreakdown: {
          base: bookingPricing.base,
          extras: bookingPricing.extras,
          subtotal: bookingPricing.subtotal,
          appliedAddons: bookingPricing.appliedAddons,
          addonTotal: bookingPricing.addonTotal,
          total: bookingPricing.total
        },
        selectedExtras: selectedExtras,
        status: 'pending',
        type: 'tour',
        paymentStatus: 'unpaid',
        paymentMethod: paymentType,
        serviceType: 'tour',
        userId: auth.currentUser?.uid || 'guest',
        quantity: quantity
      };

      if (paymentType === 'stripe') {
        // Save draft for restoration if cancelled
        localStorage.setItem('tour_booking_draft', JSON.stringify({
          details,
          step,
          selectedTour,
          selectedFleet,
          selectedExtras,
          quantity
        }));

        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingData,
            vehicleName: selectedFleet?.name || selectedTour.title,
            cancelUrl: `${window.location.origin}${window.location.pathname}?cancelled=true`
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const { url } = await response.json();
        if (url) {
          window.location.href = url;
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        const docRef = await addDoc(collection(db, 'bookings'), {
          ...bookingData,
          createdAt: serverTimestamp(),
        });
        navigate(`/payment/success?booking_id=${docRef.id}&method=${paymentType}`);
      }
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'bookings');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFleetPrice = (f: any) => Number(f?.salePrice || f?.standardPrice || f?.price || 0);

  return (
    <>
      <SEO
        title={selectedTour ? selectedTour.title : 'Private Tours Melbourne'}
        description={selectedTour ? (selectedTour.seoDescription || selectedTour.shortDescription) : 'Luxury private tours in Melbourne and Victoria.'}
        ogImage={getAssetPath(selectedTour?.image || selectedTour?.featuredImage)}
        structuredData={selectedTour ? {
          "@context": "https://schema.org",
          "@type": "Service",
          "name": selectedTour.title,
          "description": selectedTour.shortDescription,
          "provider": {
            "@type": "Organization",
            "name": "Merlux Chauffeur Services"
          },
          "areaServed": "Melbourne, Australia"
        } : undefined}
      />
      <div className="pt-20 pb-24 bg-black min-h-screen">
        <section className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block"
            >
              Luxury Experiences
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-5xl md:text-7xl font-display mb-6"
            >
              Private <span className="text-gold italic">Tours</span>
            </motion.h1>

            {/* Progress Indicator */}
            <div className="flex justify-between sm:justify-center mt-12 mb-16 w-full max-w-md mx-auto">
              {[
                { id: 1, label: 'Packages', icon: LayoutGrid },
                { id: 2, label: 'Fleet', icon: Star },
                { id: 3, label: 'Details', icon: User },
                { id: 4, label: 'Summary', icon: FileText }
              ].map((s, idx, arr) => (
                <div key={`tour-step-${s.id}`} className="flex-1 flex flex-col items-center xl:flex-row xl:items-center">
                  <div
                    className={cn(
                      "flex items-center gap-2 transition-all duration-300",
                      Math.abs(s.id - step) === 1 ? "cursor-pointer group" : "cursor-not-allowed opacity-50"
                    )}
                    onClick={() => {
                      if (Math.abs(s.id - step) === 1) {
                        if (s.id > step) {
                          if (step === 1 && !selectedTour) return;
                          if (step === 2 && !selectedFleet) return;
                        }
                        setStep(s.id);
                        if (s.id === 1) {
                          setShowFullDetails(false);
                          setSelectedTour(null);
                          navigate('/tours', { replace: true });
                        }
                      }
                    }}
                  >
                    {/* Icon circle */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-700 border",
                        step === s.id
                          ? "bg-gold text-black border-gold shadow-[0_0_20px_rgba(212,175,55,0.3)] scale-110 rotate-[360deg]"
                          : step > s.id
                            ? "bg-gold/10 text-gold border-gold/30"
                            : "bg-white/5 text-white/20 border-white/10 group-hover:bg-white/10"
                      )}
                    >
                      {step > s.id ? <CheckCircle size={12} /> : <s.icon size={12} />}
                    </div>

                    {/* Desktop inline label */}
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-[0.2em] font-bold transition-colors duration-500 hidden xl:inline",
                        step === s.id ? "text-white" : "text-white/20 group-hover:text-white/40"
                      )}
                    >
                      {s.label}
                    </span>

                    {/* Connector line inline with label (desktop only) */}
                    {idx < arr.length - 1 && (
                      <motion.div
                        initial={{ width: "1rem" }}
                        animate={{ width: "2rem" }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={cn("h-[1px] hidden xl:block", step > s.id ? "bg-gold/30" : "bg-white/5")}
                      />
                    )}
                  </div>

                  {/* Mobile: only active label stacked below icon */}
                  {step === s.id && (
                    <motion.span
                      initial={{ opacity: 0, y: 0 }}
                      animate={{ opacity: 1, y: "25%" }}
                      exit={{ opacity: 0, y: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="text-[10px] uppercase tracking-[0.2em] font-bold xl:hidden text-gold mt-1"
                    >
                      {s.label}
                    </motion.span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {!showFullDetails && step === 1 && (
              <motion.div
                key="filters"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="max-full mx-auto mb-12 glass p-4 rounded-[2rem] border border-white/5 bg-white/5 shadow-2xl"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Search */}
                  <div className="space-y-2">
                    <div className="relative">
                      <LayoutGrid className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                      <input
                        type="text"
                        placeholder="Search title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-2 pl-12 pr-4 focus:border-gold outline-none transition-all text-sm placeholder:text-white/10"
                      />
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Tag className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="custom-select w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-2 pl-12 pr-8 focus:border-gold outline-none transition-all text-sm appearance-none cursor-pointer"
                      >
                        {categories.map((cat, cIdx) => (
                          <option key={`cat-${cat}-${cIdx}`} value={cat}>
                            {cat === 'all' ? 'All Collections' : cat}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <div className="relative">
                      <Clock className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                      <select
                        value={durationFilter}
                        onChange={(e) => setDurationFilter(e.target.value)}
                        className="custom-select w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-2 pl-12 pr-8 focus:border-gold outline-none transition-all text-sm appearance-none cursor-pointer"
                      >
                        {durations.map((dur, dIdx) => (
                          <option key={`dur-${dur}-${dIdx}`} value={dur}>
                            {dur === 'all' ? 'Any Duration' : dur}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Sort */}
                  <div className="space-y-2">
                    <div className="relative">
                      <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                      <select
                        value={priceSort}
                        onChange={(e) => setPriceSort(e.target.value as any)}
                        className="custom-select w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-2 pl-12 pr-8 focus:border-gold outline-none transition-all text-sm appearance-none cursor-pointer"
                      >
                        <option value="none">Default</option>
                        <option value="asc">Low to High</option>
                        <option value="desc">High to Low</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {showFullDetails && selectedTour && (
              <motion.div
                key="details"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-6xl mx-auto"
              >
                {/* Back Button */}
                <button
                  onClick={() => {
                    setShowFullDetails(false);
                    setSelectedTour(null);
                    setStep(1);
                    navigate('/tours', { replace: true });
                  }}
                  className="mb-8 flex items-center gap-2 text-gold font-bold uppercase tracking-[0.2em] text-[10px] hover:gap-4 transition-all"
                >
                  <ArrowRight size={14} className="rotate-180" /> Back to Collections
                </button>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  {/* Visuals & Content */}
                  <div className="lg:col-span-8 space-y-12">
                    {/* Hero Image & Gallery */}
                    <div className="space-y-6">
                      {/* Main Image Preview */}
                      <div className="w-full h-[320px] sm:h-[360px] rounded-[2.5rem] overflow-hidden relative group shadow-2xl">
                        <img
                          src={getAssetPath(mainImage || selectedTour.image || selectedTour.featuredImage)}
                          alt={selectedTour.title}
                          className="w-full h-full object-cover transition-all duration-700"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />

                        {/* Category Badge Top Right */}
                        <div className="absolute top-6 right-6 bg-black/70 text-white px-6 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest border border-white/20">
                          {selectedTour.category}
                        </div>

                        {/* Promo Tag Top Left */}
                        {selectedTour.promoTag && (
                          <div className="absolute top-6 left-6 bg-gold text-black px-6 py-2 rounded-full font-bold text-[10px] uppercase tracking-widest border border-white/20">
                            {selectedTour.promoTag}
                          </div>
                        )}
                      </div>

                      {/* Gallery Slider */}
                      {selectedTour.gallery && selectedTour.gallery.length > 0 && (
                        <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2 pt-2">
                          {[selectedTour.image || selectedTour.featuredImage, ...selectedTour.gallery]
                            .filter(Boolean)
                            .map((img: string, i: number) => (
                              <button
                                key={`gallery-${i}`}
                                onClick={() => setMainImage(img)}
                                className={cn(
                                  "w-40 h-28 rounded-xl overflow-hidden border-2 transition-all shrink-0 hover:scale-105 duration-300",
                                  mainImage === img
                                    ? "border-gold scale-105"
                                    : "border-white/5 opacity-60 hover:opacity-100"
                                )}
                              >
                                <img src={getAssetPath(img)} className="w-full h-full object-cover" />
                              </button>
                            ))}
                        </div>
                      )}
                    </div>

                    {/* Highlights Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        { icon: Clock, label: 'Duration', val: selectedTour.duration },
                        { icon: Users, label: 'Max People', val: `${selectedTour.maxPeople} Pax` },
                        { icon: MapPin, label: 'Start Point', val: selectedTour.startPlace },
                        { icon: Star, label: 'Ages', val: selectedTour.ageRange }
                      ].map((h, i) => (
                        <div key={`highlight-${i}`} className="glass p-6 rounded-3xl border border-white/5 text-center">
                          <h.icon size={20} className="text-gold mx-auto mb-3" />
                          <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">{h.label}</p>
                          <p className="text-xs font-bold text-white/70">{h.val}</p>
                        </div>
                      ))}
                    </div>

                    {/* Description Section */}
                    <div className="space-y-6">
                      <h2 className="text-4xl font-display text-white">Experience <span className="text-gold italic">Details</span></h2>
                      <p className="text-white/60 leading-relaxed text-lg italic border-l-2 border-gold/30 pl-6">
                        {selectedTour.shortDescription}
                      </p>
                      <div className="text-white/40 leading-relaxed whitespace-pre-wrap">
                        {selectedTour.fullDescription}
                      </div>
                    </div>

                    {/* Itinerary Accordion */}
                    <div className="space-y-8 pt-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-display text-gold underline underline-offset-8 decoration-gold/30">The Journey Map</h3>
                        <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Comprehensive Itinerary</p>
                      </div>
                      <div className="space-y-4">
                        {(selectedTour.itinerary || []).sort((a: any, b: any) => a.order - b.order).map((step: any, idx: number) => (
                          <div key={`itinerary-${idx}`} className="relative group">
                            <button
                              onClick={() => setExpandedItinerary(expandedItinerary === idx ? null : idx)}
                              className={cn(
                                "w-full text-left glass p-6 rounded-3xl border transition-all flex items-center justify-between",
                                expandedItinerary === idx ? "border-gold/50 bg-gold/5 shadow-2xl" : "border-white/5 hover:border-gold/30"
                              )}
                            >
                              <div className="flex items-center gap-6">
                                <div className={cn(
                                  "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm transition-all",
                                  expandedItinerary === idx ? "bg-gold text-black rotate-12" : "bg-white/5 text-gold"
                                )}>
                                  {idx + 1}
                                </div>
                                <div>
                                  <h4 className={cn("text-lg font-bold transition-colors", expandedItinerary === idx ? "text-white" : "text-white/60 group-hover:text-white")}>
                                    {step.name}
                                  </h4>
                                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Planned Phase</p>
                                </div>
                              </div>
                              <ChevronRight size={20} className={cn("text-gold transition-transform duration-500", expandedItinerary === idx ? "rotate-90" : "opacity-30")} />
                            </button>

                            <AnimatePresence>
                              {expandedItinerary === idx && (
                                <motion.div
                                  key={`itinerary-detail-${idx}`}
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden"
                                >
                                  <div className="glass-heavy mt-2 p-8 rounded-3xl border border-white/10 bg-black/40">
                                    <div className="flex flex-col md:flex-row gap-8">
                                      <div className="flex-1">
                                        <div className="text-sm text-white/60 leading-relaxed font-sans italic" dangerouslySetInnerHTML={{ __html: step.details }} />
                                      </div>
                                      {step.image && (
                                        <div className="w-full md:w-48 aspect-video rounded-2xl overflow-hidden border border-white/10 shrink-0 shadow-2xl">
                                          <img src={getAssetPath(step.image)} className="w-full h-full object-cover" />
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* FAQ Section */}
                    {(selectedTour.faqs || []).length > 0 && (
                      <div className="space-y-6 pt-12">
                        <h3 className="text-xl font-display text-gold">Essential Inquiries</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {(selectedTour.faqs || []).map((faq: any, i: number) => (
                            <div key={`faq-${i}`} className="p-6 bg-white/5 rounded-2xl border border-white/5">
                              <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                                <Info size={14} className="text-gold" />
                                {faq.question}
                              </h4>
                              <p className="text-xs text-white/40 leading-relaxed">{faq.answer}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Booking Card */}
                  <div className="lg:col-span-4 lg:sticky lg:top-32 h-fit space-y-6">
                    <div className="glass-heavy p-8 rounded-[2.5rem] border border-gold/20 shadow-[0_0_50px_rgba(212,175,55,0.1)]">
                      <div className="mb-8 border-b border-white/5 pb-6">
                        <h4 className="text-3xl font-display text-white italic mb-4">{selectedTour.title}</h4>
                        <p className="text-[10px] uppercase tracking-widest text-gold font-bold mb-2">Base Experience</p>
                        <h3 className="text-2xl font-display text-white mb-4">From ${getStartingPrice(selectedTour)}</h3>
                        <div className="flex items-center gap-2 text-gold/60">
                          <Calendar size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                            {selectedTour.availability?.startDate ? `${selectedTour.availability.startDate} to ${selectedTour.availability.endDate}` : 'Daily Departures'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={handleStartBooking}
                        className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-[0.2em] text-[10px] hover:bg-white transition-all shadow-[0_0_30px_rgba(212,175,55,0.3)] flex items-center justify-center gap-3"
                      >
                        Reserve Now <ArrowRight size={16} />
                      </button>
                    </div>

                    {/* Separate Info Divs for sidebar (Hide in Step 2) */}
                    <div className="space-y-4">
                      {[
                        { label: 'Inclusions', data: selectedTour.inclusions, icon: CheckCircle, color: 'text-green-500' },
                        { label: 'Exclusions', data: selectedTour.exclusions, icon: X, color: 'text-red-500' },
                        { label: 'Activities', data: selectedTour.activities, icon: Star, color: 'text-gold' },
                        { label: 'Visited Places', data: selectedTour.placesToVisit, icon: MapPin, color: 'text-blue-400' }
                      ].map((section, idx) => (
                        section.data && section.data.length > 0 && (
                          <div key={`sidebar-info-${idx}`} className="glass-heavy p-6 rounded-3xl border border-white/5 bg-white/5 transition-all hover:bg-white/10">
                            <div className="flex items-center gap-3 mb-4">
                              <div className={cn("p-2 rounded-xl bg-black/40 border border-white/5", section.color)}>
                                <section.icon size={16} />
                              </div>
                              <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-white">{section.label}</h4>
                            </div>
                            <div className="space-y-2 pl-2">
                              {section.data.map((item: string, i: number) => (
                                <div key={`${section.label}-${i}`} className="flex items-start gap-3 text-[11px] text-white/50 leading-relaxed group">
                                  <div className="w-1 h-1 rounded-full bg-gold/40 mt-1.5 shrink-0 group-hover:bg-gold transition-colors" />
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      ))}
                    </div>

                    {selectedTour.customerNote && (
                      <div className="p-6 bg-gold/5 rounded-2xl border border-gold/10 text-center italic">
                        <p className="text-[10px] text-gold/80 leading-relaxed">" {selectedTour.customerNote} "</p>
                      </div>
                    )}

                    {/* Luxury Sidebar CTA (Mobile/Desktop) */}
                    <div className="glass-heavy p-6 rounded-3xl border border-gold/20 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-10 blur-[2px] transition-all duration-700 group-hover:scale-125 group-hover:opacity-20 group-hover:blur-none">
                        <Shield size={120} className="text-gold" />
                      </div>
                      <div className="relative z-10 text-center space-y-4">
                        <span className="text-[9px] uppercase tracking-widest text-gold font-bold block">Premium Options</span>
                        <h3 className="text-xl font-display text-white">More Services</h3>
                        <p className="text-[10px] text-white/50 leading-relaxed">
                          Looking for standard Point-to-Point drops or bespoke Special Offers?
                        </p>
                        <div className="flex flex-col gap-2 pt-2">
                          <Link to="/booking" className="btn-gold text-[10px] py-3 text-black text-center w-full block">
                            Book Transfers
                          </Link>
                          <Link to="/offers" className="btn-outline text-[10px] py-3 w-full block text-center">
                            View Offers
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && !showFullDetails && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              >
                {isLoading ? (
                  <div className="col-span-full flex flex-col items-center justify-center py-24">
                    <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mb-4" />
                    <p className="text-white/40 uppercase tracking-[0.2em] text-[10px] font-bold text-center">Orchestrating exclusive tours...</p>
                  </div>
                ) : paginatedTours.length > 0 ? (
                  paginatedTours.map((tour, tourIdx) => (
                    <div
                      key={tour.id ? `tour-${tour.id}` : `tour-idx-${tourIdx}`}
                      onClick={() => handleTourSelect(tour)}
                      className="group bg-white/5 border border-white/10 rounded-[2rem] overflow-hidden hover:border-gold/50 transition-all duration-700 cursor-pointer relative"
                    >
                      <div className="aspect-[14/9] overflow-hidden relative">
                        <img src={getAssetPath(tour.image) || null} alt={tour.title} className="w-full h-full object-cover transition-transform duration-[1.5s] group-hover:scale-110" referrerPolicy="no-referrer" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                        {tour.promoTag && (
                          <div className="absolute top-4 left-4 bg-gold text-black px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-widest border border-white/20">
                            {tour.promoTag}
                          </div>
                        )}
                        {tour.category && (
                          <div className="absolute top-4 right-4 glass bg-black/70 px-4 py-1.5 rounded-full font-bold text-[8px] uppercase tracking-widest border border-white/10 text-white/80">
                            {tour.category}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-2 gap-2 mb-4">
                          <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                            <Clock size={12} className="text-gold" /> {tour.duration}
                          </div>
                          <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                            <UserCheck size={12} className="text-gold" /> {tour.ageRange}
                          </div>
                          <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                            <MapPin size={12} className="text-gold" /> {tour.startPlace}
                          </div>
                          <div className="flex items-center gap-1 text-white/30 text-[9px] uppercase tracking-widest font-bold">
                            <Users size={12} className="text-gold" /> {tour.maxPeople} Pax
                          </div>
                        </div>
                        <h3 className="text-2xl font-display mb-3 group-hover:text-gold transition-colors">{tour.title}</h3>
                        <p className="text-white/40 text-xs mb-3 italic line-clamp-2 leading-relaxed">"{tour.shortDescription}"</p>

                        <div className="flex items-center justify-between border-t border-white/5 pt-4 group-hover:border-gold/30">
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-1">Starting At</span>
                            <span className="text-lg font-display text-gold">${getStartingPrice(tour)}</span>
                          </div>
                          <div className="w-12 h-12 rounded-full border border-gold/30 flex items-center justify-center group-hover:bg-gold group-hover:text-black transition-all">
                            <ChevronRight size={20} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-24 text-center glass rounded-3xl border border-white/5">
                    <p className="text-white/40 italic">No luxury collections currently available for reservation.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* BlogTab.tsx Style Pagination Controls */}
            {step === 1 && !showFullDetails && filteredTours.length > 0 && (
              <motion.div
                key="pagination"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/[0.03] p-5 rounded-2xl border border-white/5 mt-12 mb-16 max-w-7xl mx-auto w-full"
              >
                {/* Status info */}
                <div className="text-[11px] font-mono text-white/50">
                  Showing <span className="text-gold font-bold">
                    {filteredTours.length === 0 ? 0 : (pageSize === 'All' ? 1 : (currentPage - 1) * (pageSize as number) + 1)}
                  </span> to <span className="text-gold font-bold">
                    {pageSize === 'All' ? filteredTours.length : Math.min(currentPage * (pageSize as number), filteredTours.length)}
                  </span> of <span className="text-white font-bold">{filteredTours.length}</span> entries
                </div>

                {/* Pagination buttons */}
                {pageSize !== 'All' && totalPages > 1 && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setCurrentPage(1);
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      disabled={currentPage === 1}
                      className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                      title="First Page"
                    >
                      <ChevronsLeft size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPage(prev => Math.max(1, prev - 1));
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      disabled={currentPage === 1}
                      className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                      title="Previous Page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    
                    {(() => {
                      const pageNumbers = [];
                      const maxButtons = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
                      let endPage = Math.min(totalPages, startPage + maxButtons - 1);
                      if (endPage - startPage + 1 < maxButtons) {
                        startPage = Math.max(1, endPage - maxButtons + 1);
                      }
                      for (let i = Math.max(1, startPage); i <= endPage; i++) {
                        pageNumbers.push(i);
                      }
                      return pageNumbers.map(num => (
                        <button
                          key={`page-btn-${num}`}
                          onClick={() => {
                            setCurrentPage(num);
                            window.scrollTo({ top: 400, behavior: 'smooth' });
                          }}
                          className={cn(
                            "w-8 h-8 flex items-center justify-center text-[10px] rounded-xl font-mono transition-all border font-bold cursor-pointer",
                            currentPage === num
                              ? "bg-gold text-black border-gold shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                              : "bg-white/5 text-white/70 border-white/10 hover:border-gold/30 hover:text-gold"
                          )}
                        >
                          {num}
                        </button>
                      ));
                    })()}

                    <button
                      onClick={() => {
                        setCurrentPage(prev => Math.min(totalPages, prev + 1));
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                      title="Next Page"
                    >
                      <ChevronRight size={14} />
                    </button>
                    <button
                      onClick={() => {
                        setCurrentPage(totalPages);
                        window.scrollTo({ top: 400, behavior: 'smooth' });
                      }}
                      disabled={currentPage === totalPages}
                      className="p-2 border border-white/10 rounded-xl bg-white/5 text-white/60 hover:text-gold hover:border-gold/30 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
                      title="Last Page"
                    >
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                )}

                {/* Page size dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-white/40 font-bold font-mono">Page Size:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPageSize(val === 'All' ? 'All' : Number(val));
                      setCurrentPage(1);
                    }}
                    className="custom-select bg-black text-gold text-[10px] font-mono border border-white/10 rounded-xl px-3 py-1.5 focus:outline-none focus:border-gold font-bold uppercase cursor-pointer"
                  >
                    <option value={12}>12 Entries</option>
                    <option value={24}>24 Entries</option>
                    <option value={48}>48 Entries</option>
                    <option value="All">Show All</option>
                  </select>
                </div>
              </motion.div>
            )}

            {!showFullDetails && step === 1 && (
              <motion.div
                key="luxury-ride-cta"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="mt-24 bg-gold rounded-[3rem] p-12 md:p-20 text-black text-center relative overflow-hidden shadow-2xl"
              >
                <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                  <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white blur-[120px] rounded-full rotate-45" />
                </div>
                <div className="relative z-10 max-w-2xl mx-auto">
                  <span className="uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block">Elevated Travel</span>
                  <h2 className="text-4xl md:text-6xl font-display mb-8 leading-tight">Reserve Your <span className="italic">Luxury Ride</span></h2>
                  <p className="text-black/70 mb-10 text-lg leading-relaxed text-balance">
                    Whether it's a specialized regional tour or a premium point-to-point transfer, we guarantee an unparalleled travel experience.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                      to="/booking"
                      className="bg-black text-white px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-2xl"
                    >
                      Book A Journey
                    </Link>
                    <Link
                      to="/offers"
                      className="bg-white/20 backdrop-blur-md border border-black/10 text-black px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-black hover:text-white transition-all font-display"
                    >
                      View Special Offers
                    </Link>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-5xl mx-auto"
              >
                <button
                  onClick={() => {
                    if (selectedTour) {
                      setShowFullDetails(true);
                      setStep(1);
                    } else {
                      setStep(1);
                    }
                  }}
                  className="text-gold mb-8 flex items-center gap-2 uppercase tracking-widest text-[10px] font-bold hover:gap-4 transition-all"
                >
                  <ArrowRight size={14} className="rotate-180" /> Change Selection
                </button>
                <h2 className="text-5xl font-display mb-12">Elite <span className="text-gold italic">Fleet Selection</span></h2>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                  {/* Fleet Selection Section */}
                  <div className="lg:col-span-8 space-y-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {(selectedTour?.fleets && Array.isArray(selectedTour.fleets) ? selectedTour.fleets : []).filter(Boolean).map((f: any, idx: number) => {
                        const isSelected = selectedFleet?.id === f.id || (f.name && selectedFleet?.name === f.name);
                        const hasSale = f?.salePrice && f?.standardPrice && Number(f.salePrice) < Number(f.standardPrice);

                        return (
                          <div
                            key={f.id || `fleet-${f.name}-${idx}`}
                            onClick={() => handleFleetSelect(f)}
                            className={cn(
                              "bg-white/5 border p-1 rounded-3xl transition-all cursor-pointer group relative overflow-hidden flex flex-col min-h-[160px]",
                              isSelected ? "border-gold shadow-[0_0_30px_rgba(212,175,55,0.15)]" : "border-white/10 hover:border-gold/30"
                            )}
                          >
                            <div className="aspect-[21/9] rounded-2xl overflow-hidden relative">
                              <img src={getAssetPath(f.image) || "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80"} className="w-full h-full object-cover transition-transform duration-[1s] group-hover:scale-110" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                              {/* Category Badge Top Right */}
                              {f.category && (
                                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-gold px-3 py-1 rounded-lg border border-white/10 text-[8px] uppercase font-bold tracking-widest">
                                  {f.category}
                                </div>
                              )}

                              {isSelected && (
                                <div className="absolute top-2 left-2 bg-gold text-black p-1.5 rounded-full shadow-lg border border-white/20">
                                  <CheckCircle size={12} />
                                </div>
                              )}
                            </div>

                            <div className="p-4 flex flex-col gap-3 flex-1">
                              <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">{f.name || 'Elite Transport'}</h4>
                                  <div className="flex items-center gap-3">
                                    {/* Passengers */}
                                    <div className="flex items-center gap-1">
                                      <Users size={12} className="text-gold" />
                                      <span className="text-[10px] font-bold text-white">
                                        {f.passengers || f.capacity}
                                      </span>
                                    </div>

                                    {/* Luggage */}
                                    <div className="flex items-center gap-1">
                                      <Luggage size={12} className="text-gold" />
                                      <span className="text-[10px] font-bold text-white">
                                        {f.luggage || f.capacity}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {hasSale ? (
                                    <div className="flex flex-col items-end">
                                      <span className="text-white/30 line-through text-[10px] decoration-red-500/50">${f.standardPrice}</span>
                                      <span className="text-gold font-display text-xl tracking-tight leading-none">${f.salePrice}</span>
                                    </div>
                                  ) : (
                                    <span className="text-gold font-display text-xl tracking-tight">${f.salePrice || f.standardPrice || f.price || 0}</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 pt-3 border-t border-white/5 mt-auto">
                                {f.additionalInfo && (
                                  <div className="bg-white/5 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1.5">
                                    <Info size={8} className="text-gold" />
                                    <span className="text-[8px] text-white/50 uppercase font-bold tracking-tighter">{f.additionalInfo}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {selectedTour?.extras && selectedTour.extras.length > 0 && (
                      <div className="border-t border-white/10 pt-12">
                        <div className="flex items-center justify-center gap-4 mb-10">
                          <div className="h-px bg-gradient-to-r from-transparent to-white/10 flex-1" />
                          <h3 className="text-xl font-display text-gold uppercase tracking-[0.2em]">Added Extras</h3>
                          <div className="h-px bg-gradient-to-l from-transparent to-white/10 flex-1" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {selectedTour.extras.map((extra: any, extraIdx: number) => {
                            const extraId = extra.id || extra.name;
                            const isSelected = selectedExtras[extraId] > 0;
                            return (
                              <div
                                key={`extra-${extraId}-${extraIdx}`}
                                onClick={() => toggleExtra(extraId)}
                                className={cn(
                                  "glass p-4 rounded-2xl border transition-all relative overflow-hidden group cursor-pointer",
                                  isSelected ? "border-gold/50 bg-gold/5" : "border-white/5 hover:border-gold/20"
                                )}
                              >
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1">
                                    <p className={cn("text-xs font-bold transition-colors", isSelected ? "text-gold" : "text-white")}>{extra.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <p className="text-[9px] text-white/30 font-bold">${extra.price} / Unit</p>
                                      {extra.availableCount !== undefined && extra.availableCount !== null && (
                                        <p className="text-[9px] text-white/20 font-bold">Max {extra.availableCount}</p>
                                      )}
                                    </div>
                                  </div>
                                  {isSelected ? (
                                    <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-xl border border-white/10" onClick={(e) => e.stopPropagation()}>
                                      <button onClick={() => updateExtraCount(extraId, -1, extra.availableCount)} className="p-1 hover:text-gold"><Minus size={10} /></button>
                                      <span className="text-xs font-bold font-mono min-w-[1ch] text-center">{selectedExtras[extraId]}</span>
                                      <button
                                        onClick={() => updateExtraCount(extraId, 1, extra.availableCount)}
                                        className="p-1 hover:text-gold disabled:opacity-20 disabled:hover:text-white"
                                        disabled={extra.availableCount !== undefined && selectedExtras[extraId] >= Number(extra.availableCount)}
                                      >
                                        <Plus size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center text-white/20 border border-white/10 group-hover:bg-gold/10 group-hover:text-gold transition-all">
                                      <Plus size={14} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Summary */}
                  <div className="lg:col-span-4 lg:sticky lg:top-32 h-fit space-y-6">
                    <div className="glass-heavy p-8 rounded-[2.5rem] border border-gold/20 shadow-2xl bg-black/40">
                      <div className="mb-6 border-b border-white/5 pb-4">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold mb-1">Configuration Review</p>
                        <h3 className="text-2xl font-display text-white mb-4">{selectedTour.title}</h3>

                        <div className="mt-4 space-y-5">
                          <div className="flex items-center gap-2 bg-white/5 px-4 py-3 rounded-2xl border border-white/5">
                            <Calendar size={14} className="text-gold" />
                            <div className="flex flex-col">
                              <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Availability Date</span>
                              <span className="text-[10px] font-bold uppercase tracking-widest leading-none">
                                {selectedTour.availability?.startDate ? `${selectedTour.availability.startDate} to ${selectedTour.availability.endDate}` : 'Daily Departures'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Fleet Selection Details */}
                      <div className="space-y-2 mb-6">
                        {selectedFleet ? (
                          <div className="glass p-3 rounded-2xl border border-gold/30 bg-gold/10 animate-in fade-in slide-in-from-top-2">
                            <p className="text-[9px] uppercase tracking-[0.2em] text-gold font-black mb-3">
                              Active Unit Selection
                            </p>
                            <div className="flex items-center gap-4">
                              <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 shrink-0 shadow-lg">
                                <img src={getAssetPath(selectedFleet.image)} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <p className="text-base font-display text-white leading-tight">
                                  {selectedFleet.name}
                                </p>
                                <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-widest italic">
                                  {selectedFleet.passengers} Passengers Max
                                </p>
                                <p className="text-[10px] text-white/40 font-bold mt-1 uppercase tracking-widest italic">
                                  {selectedFleet.luggage} Luggage Max
                                </p>
                                {/* Price Value */}
                                <p className="text-sm font-display text-gold mt-2">
                                  ${getFleetPrice(selectedFleet)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 border-2 border-dashed border-white/5 rounded-2xl text-center">
                            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                              Awaiting transport selection
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Summary Extras Details */}
                      {Object.keys(selectedExtras).length > 0 && (
                        <div className="space-y-4 mb-6 glass p-5 rounded-2xl border border-white/5">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-black">Selected Extras</p>
                          <div className="space-y-3">
                            {Object.entries(selectedExtras).map(([idOrName, count]) => {
                              const extra = (selectedTour?.extras || []).find((e: any) => (e.id || e.name) === idOrName);
                              return (
                                <div key={`extra-summary-line-${idOrName}`} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                  <span className="text-white/60 font-bold">{extra?.name} (x{count})</span>
                                  <span className="font-mono text-gold">${(Number(extra?.price || 0) * (count as number)).toFixed(2)}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Combined Price breakdown */}
                      <div className="border-t border-white/5 pt-8 mb-8 space-y-4">
                        <div className="flex items-center justify-between text-[11px] font-bold text-white/30 tracking-[0.1em] uppercase">
                          <span>Ride Price</span>
                          <span className="text-white font-mono">${(getFleetPrice(selectedFleet) * quantity).toFixed(2)}</span>
                        </div>
                        {bookingPricing.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).map((addon: any, aIdx: number) => (
                          <div key={`addon-tour-summary-${addon.id || aIdx}-${aIdx}`} className="border-b border-white/5 pb-4">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-gold text-[10px] uppercase tracking-widest font-bold">{addon.name}</span>
                              <span className="text-gold font-bold text-sm">
                                {addon.impact > 0 ? "+" : "-"}${Math.abs(addon.impact).toFixed(2)}
                              </span>
                            </div>
                            {!addon.hideSatisfyDetails && addon.satisfyDetails && addon.satisfyDetails.length > 0 && (
                              <div className="mt-1 space-y-0.5 pl-2 border-l border-gold/20">
                                {addon.satisfyDetails.map((detail: string, dIdx: number) => (
                                  <div key={dIdx} className="text-[9px] text-white/40 normal-case font-mono tracking-wider flex items-center gap-1">
                                    <span className="text-gold/50">•</span>
                                    <span>{detail}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                        {Object.keys(selectedExtras).length > 0 && (
                          <div className="flex items-center justify-between text-[11px] font-bold text-white/30 tracking-[0.1em] uppercase">
                            <span>Extras Total</span>
                            <span className="text-white font-mono">
                              ${Object.entries(selectedExtras).reduce((acc, [idOrName, count]) => {
                                const extra = (selectedTour?.extras || []).find((e: any) => (e.id || e.name) === idOrName);
                                return acc + (Number(extra?.price || 0) * (count as number));
                              }, 0).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mb-10 text-center glass p-6 rounded-3xl border border-gold/20 bg-gold/5">
                        <p className="text-[11px] uppercase text-gold font-black mb-2">Total Price</p>
                        <h4 className="text-4xl font-display text-white tracking-tighter">${totalPrice.toFixed(2)}</h4>
                      </div>

                      <button
                        disabled={!selectedFleet}
                        onClick={() => setStep(3)}
                        className="w-full bg-gold text-black py-6 rounded-2xl font-black uppercase text-[10px] hover:bg-white transition-all shadow-[0_15px_40px_rgba(212,175,55,0.2)] flex items-center justify-center gap-3 disabled:opacity-30 group"
                      >
                        Next Contact Details <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 max-w-7xl mx-auto">
                  <div className="lg:col-span-8">
                    <button
                      onClick={() => setStep(2)}
                      className="text-gold mb-8 flex items-center gap-2 uppercase tracking-widest text-[10px] font-bold hover:gap-4 transition-all"
                    >
                      <ArrowRight size={14} className="rotate-180" /> Change Fleet
                    </button>
                    <div className="flex items-center justify-between mb-8">
                      <h2 className="text-4xl font-display text-white">Customer <span className="text-gold italic">Details</span></h2>
                      {!currentUser && (
                        <div className="flex items-center gap-4">
                          <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="text-[10px] uppercase tracking-widest text-gold hover:text-white transition-colors"
                          >
                            Login
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="text-[10px] uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full text-white/60 hover:bg-white/10 transition-all"
                          >
                            Register
                          </button>
                        </div>
                      )}
                    </div>

                    {!currentUser && (
                      <div className="mb-12">
                        <LoginInline />
                      </div>
                    )}

                    <form onSubmit={handleDetailsSubmit} className="space-y-8 glass p-12 rounded-[3rem] border border-white/5 bg-white/5 shadow-2xl">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Full Name</label>
                          <div className="relative">
                            <User className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                            <input
                              required
                              type="text"
                              value={details.name}
                              onChange={(e) => setDetails({ ...details, name: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm"
                              placeholder="E.g. Alexander Hamilton"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Email Address</label>
                          <div className="relative">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                            <input
                              required
                              type="email"
                              value={details.email}
                              onChange={(e) => setDetails({ ...details, email: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm"
                              placeholder="client@majesty.luxury"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Phone Number</label>
                          <div className="flex gap-3">
                            <div className="relative min-w-[120px] w-1/3">
                              <select
                                className="custom-select w-full h-[62px] !py-0 !pl-4 text-sm rounded-[1.2rem] select-none hover:border-gold/50 cursor-pointer"
                                value={parsePhoneNumber(details.phone).countryCode}
                                onChange={(e) => {
                                  const { localNumber } = parsePhoneNumber(details.phone);
                                  setDetails({ ...details, phone: `${e.target.value} ${localNumber}` });
                                }}
                              >
                                {COUNTRY_CODES.map((c) => (
                                  <option key={c.code} value={c.code}>
                                    {c.short}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="relative flex-1">
                              <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                              <input
                                required
                                type="tel"
                                value={parsePhoneNumber(details.phone).localNumber}
                                onChange={(e) => {
                                  let val = e.target.value;
                                  const { countryCode } = parsePhoneNumber(details.phone);
                                  if (val.startsWith("+")) {
                                    const parsed = parsePhoneNumber(val);
                                    setDetails({ ...details, phone: `${parsed.countryCode} ${parsed.localNumber}` });
                                  } else {
                                    setDetails({ ...details, phone: `${countryCode} ${val}` });
                                  }
                                }}
                                className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm"
                                placeholder="Phone number"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Pickup Location</label>
                          <div className="relative">
                            <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50 z-10" size={16} />
                            {isLoaded ? (
                              <Autocomplete
                                onLoad={(ref) => (pickupAutocompleteRef.current = ref)}
                                onPlaceChanged={onPickupPlaceChanged}
                                options={autocompleteOptions}
                              >
                                <div className="relative">
                                  <input
                                    required
                                    type="text"
                                    value={details.pickup}
                                    onChange={(e) => setDetails({ ...details, pickup: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-12 focus:border-gold outline-none transition-all text-sm"
                                    placeholder="Hotel Vestibule or Residence"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      handleGeolocation('pickup');
                                    }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-gold transition-colors p-2"
                                    title="Use current location"
                                  >
                                    <LocateFixed size={18} />
                                  </button>
                                </div>
                              </Autocomplete>
                            ) : (
                              <input
                                required
                                type="text"
                                value={details.pickup}
                                onChange={(e) => setDetails({ ...details, pickup: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm"
                                placeholder="Loading location services..."
                              />
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Dropoff Location (Optional)</label>
                        <div className="relative">
                          <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50 z-10" size={16} />
                          {isLoaded ? (
                            <Autocomplete
                              onLoad={(ref) => (dropoffAutocompleteRef.current = ref)}
                              onPlaceChanged={onDropoffPlaceChanged}
                              options={autocompleteOptions}
                            >
                              <div className="relative">
                                <input
                                  type="text"
                                  value={details.dropoff}
                                  onChange={(e) => setDetails({ ...details, dropoff: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-12 focus:border-gold outline-none transition-all text-sm"
                                  placeholder="End Destination"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleGeolocation('dropoff');
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-gold transition-colors p-2"
                                  title="Use current location"
                                >
                                  <LocateFixed size={18} />
                                </button>
                              </div>
                            </Autocomplete>
                          ) : (
                            <input
                              type="text"
                              value={details.dropoff}
                              onChange={(e) => setDetails({ ...details, dropoff: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm"
                              placeholder="Loading location services..."
                            />
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Booking Date</label>
                          <div className="relative">
                            <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                            <input
                              required
                              type="date"
                              min={new Date().toISOString().split('T')[0]}
                              value={details.date}
                              onChange={(e) => setDetails({ ...details, date: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm custom-select appearance-none"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Pickup Time</label>
                          <div className="relative">
                            <Clock className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                            <input
                              required
                              type="time"
                              value={details.time}
                              onChange={(e) => setDetails({ ...details, time: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm custom-select appearance-none"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 pt-4">
                        <label className="flex items-center gap-3 cursor-pointer group w-fit" onClick={() => setDetails(prev => ({ ...prev, returnRide: !prev.returnRide }))}>
                          <div className={cn(
                            "w-12 h-6 rounded-full flex items-center transition-colors p-1",
                            details.returnRide ? "bg-gold" : "bg-white/10 group-hover:bg-white/20"
                          )}>
                            <div className={cn(
                              "w-4 h-4 rounded-full bg-white transition-transform",
                              details.returnRide ? "translate-x-6" : "translate-x-0"
                            )} />
                          </div>
                          <span className="text-[10px] uppercase tracking-widest font-bold text-white/70 group-hover:text-gold transition-colors">
                            Add Return Ride (+100% Base Fare)
                          </span>
                        </label>
                      </div>

                      {details.returnRide && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4">
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Return Date</label>
                            <div className="relative">
                              <Calendar className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                              <input
                                required={details.returnRide}
                                type="date"
                                min={details.date || new Date().toISOString().split('T')[0]}
                                value={details.returnDate}
                                onChange={(e) => setDetails({ ...details, returnDate: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm custom-select"
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Return Time</label>
                            <div className="relative">
                              <Clock className="absolute left-6 top-1/2 -translate-y-1/2 text-gold opacity-50" size={16} />
                              <input
                                required={details.returnRide}
                                type="time"
                                value={details.returnTime}
                                onChange={(e) => setDetails({ ...details, returnTime: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm custom-select"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/30 ml-4">Additional Notes (Optional)</label>
                        <div className="relative">
                          <FileText className="absolute left-6 top-6 text-gold opacity-50" size={16} />
                          <textarea
                            value={details.notes}
                            onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-[1.2rem] py-5 pl-14 pr-6 focus:border-gold outline-none transition-all text-sm h-32 resize-none"
                            placeholder="Any special requests or instructions?"
                          />
                        </div>
                      </div>
                      <button type="submit" className="w-full bg-gold text-black py-6 rounded-[1.5rem] font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-white transition-all shadow-2xl shadow-gold/20">
                        Confirm Details
                      </button>
                    </form>
                  </div>

                  {/* Sticky Sidebar Summary for Step 3 */}
                  <div className="lg:col-span-4 lg:sticky lg:top-32 h-fit">
                    <div className="glass-heavy p-8 rounded-[2.5rem] border border-gold/20 shadow-2xl bg-black/40">
                      <div className="mb-8 border-b border-white/5 pb-6">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold mb-1">Final Reservation Summary</p>
                        <h3 className="text-2xl font-display text-gold">{selectedTour.title}</h3>
                      </div>

                      <div className="space-y-4 mb-10 glass p-6 rounded-3xl border border-white/5">
                        <div className="flex items-center gap-4 border-b border-white/5 pb-3">
                          <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10">
                            <img src={getAssetPath(selectedFleet.image)} className="w-full h-full object-cover" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Elite Fleet</p>
                            <p className="text-xs font-bold text-white">{selectedFleet.name}</p>
                          </div>
                        </div>

                        {Object.keys(selectedExtras).length > 0 && (
                          <div className="space-y-2 border-b border-white/5 pb-3">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Planned Extras</p>
                            {Object.entries(selectedExtras).map(([idOrName, count]) => {
                              const extra = (selectedTour?.extras || []).find((e: any) => (e.id || e.name) === idOrName);
                              return <p key={`summary-extra-${idOrName}`} className="text-[10px] text-white/60">• {extra?.name} (x{count})</p>
                            })}
                          </div>
                        )}

                                                <div className="flex items-center justify-between text-[11px] font-bold text-white/30 tracking-[0.1em] uppercase">
                          <span>Ride Price</span>
                          <span className="text-white font-mono">${(getFleetPrice(selectedFleet) * quantity).toFixed(2)}</span>
                        </div>

                        {bookingPricing.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).length > 0 && (
                          <div className="space-y-3 border-b border-white/5 pb-3">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Price Add-ons</p>
                            {bookingPricing.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).map((addon: any, aIdx: number) => (
                              <div key={`addon-tour-sticky-summary-${addon.id || aIdx}-${aIdx}`} className="space-y-1">
                                <div className="flex justify-between text-[10px] text-gold/80">
                                  <span className="font-semibold">{addon.name}</span>
                                  <span className="font-mono text-gold font-bold">
                                    {addon.impact > 0 ? "+" : "-"}${Math.abs(addon.impact).toFixed(2)}
                                  </span>
                                </div>
                                {!addon.hideSatisfyDetails && addon.satisfyDetails && addon.satisfyDetails.length > 0 && (
                                  <div className="mt-1 space-y-0.5 pl-2 border-l border-gold/20">
                                    {addon.satisfyDetails.map((detail: string, dIdx: number) => (
                                      <div key={dIdx} className="text-[8px] text-white/40 normal-case font-mono tracking-wider flex items-center gap-1">
                                        <span className="text-gold/50">•</span>
                                        <span>{detail}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2">
                          <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Grand Total</p>
                          <p className="text-2xl font-display text-white">${totalPrice.toFixed(2)}</p>
                        </div>
                      </div>

                      <div className="space-y-4 mb-10 glass p-6 rounded-3xl border border-white/5 animate-in slide-in-from-right-4">
                        <p className="text-[8px] uppercase tracking-widest text-gold font-bold border-b border-white/5 pb-2">Contact Details</p>
                        <div className="grid grid-cols-1 gap-3 pt-2">
                          <div className="flex items-center gap-3">
                            <User size={12} className="text-white/30" />
                            <p className="text-[10px] text-white/80 font-bold">{details.name || 'Not specified'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Mail size={12} className="text-white/30" />
                            <p className="text-[10px] text-white/80 font-bold">{details.email || 'Not specified'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Phone size={12} className="text-white/30" />
                            <p className="text-[10px] text-white/80 font-bold">{details.phone || 'Not specified'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <MapPin size={12} className="text-white/30" />
                            <p className="text-[10px] text-white/80 font-bold">{details.pickup || 'Not specified'}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Clock size={12} className="text-white/30" />
                            <p className="text-[10px] text-white/80 font-bold">{details.date} at {details.time}</p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6 bg-gold/5 rounded-2xl border border-gold/10 text-center italic">
                        <p className="text-[10px] text-gold/80 leading-relaxed italic">" Your journey through {selectedTour.title} is being prepared. Please confirm your details below. "</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-2xl mx-auto"
              >
                <div className="glass-heavy border border-gold/20 rounded-[3rem] p-12 text-center bg-white/5">
                  <div className="w-24 h-24 bg-gold/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-gold/20 transform rotate-12">
                    <CreditCard className="text-gold" size={36} />
                  </div>
                  <h2 className="text-5xl font-display mb-10 text-white leading-tight">Master <span className="text-gold italic">Booking Review</span></h2>

                  <div className="space-y-4 mb-12 text-left glass p-10 rounded-[2rem] border border-white/5 bg-black/40">
                    <div className="flex justify-between border-b border-white/5 pb-4">
                      <span className="text-white/20 text-[10px] uppercase tracking-widest font-bold">Selected Tour</span>
                      <span className="text-white font-bold text-sm">{selectedTour.title}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-4">
                      <span className="text-white/20 text-[10px] uppercase tracking-widest font-bold">Transport Unit</span>
                      <span className="text-white font-bold text-sm">{selectedFleet.name} × {quantity}</span>
                    </div>
                    {Object.entries(selectedExtras).map(([idOrName, count], idx) => {
                      const extra = (selectedTour?.extras || []).find((e: any) => (e.id || e.name) === idOrName);
                      if (!extra) return null;
                      return (
                        <div key={`summary-extra-${idOrName}-${idx}`} className="flex justify-between border-b border-white/5 pb-4">
                          <span className="text-white/20 text-[10px] uppercase tracking-widest font-bold">{extra.name}</span>
                          <span className="text-white font-bold text-sm">× {count}</span>
                        </div>
                      );
                    })}
                    <div className="flex justify-between border-b border-white/5 pb-4">
                      <span className="text-white/20 text-[10px] uppercase tracking-widest font-bold">Arrival Schedule</span>
                      <span className="text-white font-bold text-sm">{details.date} • {details.time}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-4">
                      <span className="text-white/20 text-[10px] uppercase tracking-widest font-bold">Pickup Location</span>
                      <span className="text-white font-bold text-sm">{details.pickup}</span>
                    </div>
                    {bookingPricing.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).map((addon: any, aIdx: number) => (
                      <div key={`addon-tour-summary-3-${addon.id || aIdx}-${aIdx}`} className="border-b border-white/5 pb-4">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-gold/40 text-[10px] uppercase tracking-widest font-bold">{addon.name}</span>
                          <span className="text-gold font-bold text-sm">
                            {addon.impact > 0 ? "+" : "-"}${Math.abs(addon.impact).toFixed(2)}
                          </span>
                        </div>
                        {!addon.hideSatisfyDetails && addon.satisfyDetails && addon.satisfyDetails.length > 0 && (
                          <div className="mt-1 space-y-0.5 pl-2 border-l border-gold/20">
                            {addon.satisfyDetails.map((detail: string, dIdx: number) => (
                              <div key={dIdx} className="text-[9px] text-white/40 normal-case font-mono tracking-wider flex items-center gap-1">
                                <span className="text-gold/50">•</span>
                                <span>{detail}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-between pt-6">
                      <span className="text-gold text-[10px] uppercase tracking-widest font-bold mt-2">Grand Total</span>
                      <span className="text-5xl font-display text-white">${totalPrice.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment Selection */}
                  {(() => {
                    const paymentTypesList = [
                      ...(systemSettings?.allowStripeCardPayment !== false ? [{ id: 'stripe', label: 'Digital Payment', sub: 'Instant Update', icon: CreditCard }] : []),
                      ...(systemSettings?.allowCashPayment !== false ? [{ id: 'cash', label: 'Cash Payment', sub: 'Pay on Arrival', icon: BanknoteIcon }] : [])
                    ];
                    return (
                      <div className={cn("grid gap-4 mb-8", paymentTypesList.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
                        {paymentTypesList.map((p: any) => (
                          <button
                            key={p.id}
                            onClick={() => setPaymentType(p.id)}
                            className={cn(
                              "p-6 rounded-2xl border transition-all text-left group",
                              paymentType === p.id ? "bg-gold border-gold" : "bg-white/5 border-white/10 hover:border-gold/50"
                            )}
                          >
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all", paymentType === p.id ? "bg-black text-gold" : "bg-white/5 text-white/20 group-hover:text-gold")}>
                              {p.id === 'stripe' ? <CreditCard size={18} /> : <BanknoteIcon size={18} />}
                            </div>
                            <p className={cn("text-[9px] uppercase font-bold tracking-widest", paymentType === p.id ? "text-black" : "text-white/30")}>{p.label}</p>
                            <p className={cn("text-[8px] uppercase font-bold opacity-40", paymentType === p.id ? "text-black" : "text-gold")}>{p.sub}</p>
                          </button>
                        ))}
                      </div>
                    );
                  })()}

                  <button
                    onClick={handleBooking}
                    disabled={isSubmitting}
                    className="w-full bg-gold text-black py-6 rounded-2xl font-bold uppercase tracking-[0.3em] text-[10px] hover:bg-white transition-all shadow-[0_20px_50px_rgba(212,175,55,0.2)] mb-8 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing Booking...' : `Confirm Your ${paymentType === 'stripe' ? 'Payment' : 'Reservation'}`}
                  </button>
                  <div className="flex items-center justify-center gap-8">
                    <button
                      onClick={reset}
                      className="group flex items-center gap-2 text-white/20 uppercase tracking-widest text-[9px] font-bold hover:text-red-500 transition-all duration-300"
                    >
                      <ChevronLeft
                        size={10}
                        className="transform translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out"
                      />
                      <span className="transform group-hover:-translate-x-0.5 transition-transform duration-300">
                        Change Tour Package
                      </span>
                    </button>

                    <div className="w-px h-3 bg-white/10" />

                    <button
                      onClick={() => setStep(3)}
                      className="group flex items-center gap-2 text-white/20 uppercase tracking-widest text-[9px] font-bold hover:text-gold transition-all duration-300"
                    >
                      <span className="transform group-hover:translate-x-0.5 transition-transform duration-300">
                        Edit Contact Details
                      </span>
                      <ChevronRight
                        size={10}
                        className="transform -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out"
                      />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Features */}
        <section className="bg-white/5 py-16 border-y border-white/10 mt-24">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { icon: MapPin, title: "Custom Routes", desc: "Personalized itineraries" },
              { icon: Clock, title: "Flexible Time", desc: "No rushing allowed" },
              { icon: Users, title: "Private Groups", desc: "Just you and yours" },
              { icon: Star, title: "Expert Guides", desc: "Local knowledge" }
            ].map((item, i) => (
              <div key={`feature-${i}`} className="text-center">
                <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-gold/20">
                  <item.icon className="text-gold" size={20} />
                </div>
                <h4 className="text-sm font-bold uppercase tracking-widest mb-1">{item.title}</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-widest">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      <AnimatePresence>
        {notice && (
          <FormNotice
            type={notice.type}
            message={notice.message}
            title={notice.title}
            onClose={() => setNotice(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
