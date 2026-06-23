import { useState, FormEvent, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Car, ArrowRight, Tag, MapPin, Star, User, Mail, Phone, Calendar, Clock, CreditCard, Banknote, ChevronRight, ChevronLeft, FileText, LayoutGrid, Info, AlertCircle, Search, XCircle, CheckCircle, LocateFixed, Earth, Luggage, Handbag, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { getCachedDocs } from '../lib/firestore-cache';
import { onAuthStateChanged } from 'firebase/auth';
import { useJsApiLoader, Autocomplete } from '@react-google-maps/api';
import { FormNotice, type NoticeType } from '../components/FormNotice';
import { db, auth } from '../lib/firebase';
import { offersFallback } from '../data/fallback/offersFallback';
import { cn, getAssetPath } from '../lib/utils';
import Logo from '../components/layout/Logo';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '../lib/google-maps';
import LoginInline from '../components/LoginInline';
import SEO from '../components/SEO';

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

export default function Offers() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [offers, setOffers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [step, setStep] = useState(1);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'stripe'>('stripe');
  const [priceAddons, setPriceAddons] = useState<any[]>([]);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string; title?: string } | null>(null);

  const showNotice = (type: NoticeType, message: string, title?: string) => {
    setNotice({ type, message, title });
    if (type === 'success' || type === 'info') {
      setTimeout(() => setNotice(null), 5000);
    }
  };

  useEffect(() => {
    const savedData = localStorage.getItem('offer_booking_draft');
    const isCancelled = new URLSearchParams(window.location.search).get('cancelled');

    if (savedData && isCancelled === 'true') {
      try {
        const data = JSON.parse(savedData);
        if (data.details) setDetails(data.details);
        if (data.step) setStep(data.step);
        if (data.selectedPackage) setSelectedPackage(data.selectedPackage);
        if (data.selectedFleet) setSelectedFleet(data.selectedFleet);
        if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
        // Clean up
        localStorage.removeItem('offer_booking_draft');
      } catch (err) {
        console.error('Failed to restore offer booking draft:', err);
      }
    }
  }, []);

  useEffect(() => {
    const savedData = localStorage.getItem('offer_booking_draft');
    const isCancelled = new URLSearchParams(window.location.search).get('cancelled');

    if (savedData && isCancelled === 'true') {
      try {
        const data = JSON.parse(savedData);
        if (data.details) setDetails(data.details);
        if (data.step) setStep(data.step);
        if (data.selectedPackage) setSelectedPackage(data.selectedPackage);
        if (data.selectedFleet) setSelectedFleet(data.selectedFleet);
        if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
        // Clean up
        localStorage.removeItem('offer_booking_draft');
      } catch (err) {
        console.error('Failed to restore offer booking draft:', err);
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

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState('all');
  const [discountFilter, setDiscountFilter] = useState('all');
  const [priceSort, setPriceSort] = useState<'none' | 'asc' | 'desc'>('none');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'All'>(12);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, tagFilter, discountFilter, priceSort, pageSize]);

  // Selection States
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [selectedFleet, setSelectedFleet] = useState<any>(null);

  // Form States
  const [details, setDetails] = useState({
    name: '',
    email: '',
    phone: '',
    pickup: '',
    dropoff: '',
    date: '',
    time: '',
    notes: '',
    returnRide: false,
    returnDate: '',
    returnTime: ''
  });

  // Google Maps
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const pickupAutocompleteRef = useRef<any>(null);
  const dropoffAutocompleteRef = useRef<any>(null);

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

  useEffect(() => {
    if (systemSettings) {
      if (systemSettings.allowStripeCardPayment === false && systemSettings.allowCashPayment !== false && paymentMethod === 'stripe') {
        setPaymentMethod('cash');
      } else if (systemSettings.allowCashPayment === false && systemSettings.allowStripeCardPayment !== false && paymentMethod === 'cash') {
        setPaymentMethod('stripe');
      }
    }
  }, [systemSettings, paymentMethod]);

  useEffect(() => {
    let active = true;
    const fetchOffersAndAddons = async () => {
      try {
        const q = query(collection(db, 'offers'), where('active', '==', true));
        const fetchedOffers = await getCachedDocs(q, 'offers_active');
        if (active) {
          if (fetchedOffers.length > 0) {
            setOffers(fetchedOffers);
          } else {
            setOffers(offersFallback);
          }
          setIsLoading(false);
        }
      } catch (err) {
        console.warn("Offers dynamic loading suspended, using fallback:", err);
        if (active) {
          setOffers(offersFallback);
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

    fetchOffersAndAddons();
    return () => {
      active = false;
    };
  }, []);

  // Deep Linking Effect
  useEffect(() => {
    if (offers.length > 0) {
      if (slug) {
        const offer = offers.find(o => o.slug === slug);
        if (offer) {
          if (!selectedPackage || selectedPackage.slug !== slug) {
            setSelectedPackage(offer);
            setStep(2);
          }
        } else {
          setSelectedPackage(null);
          setStep(1);
          navigate('/offers', { replace: true });
        }
      } else {
        if (selectedPackage) {
          setSelectedPackage(null);
          setStep(1);
        }
      }
    }
  }, [slug, offers, selectedPackage, navigate]);

  const autocompleteOptions = useMemo(() => {
    const options: any = {
      types: ['address']
    };
    if (systemSettings?.limitCountry) {
      options.componentRestrictions = { country: systemSettings.limitCountry.split(',').map((c: string) => c.trim().toLowerCase()) };
    }
    return options;
  }, [systemSettings]);

  const handlePackageSelect = (pkg: any) => {
    setSelectedPackage(pkg);
    setStep(2);
    navigate(`/offers/${pkg.slug}`, { replace: true });
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFleetSelect = (fleet: any) => {
    setSelectedFleet(fleet);
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onPlaceChanged = (type: 'pickup' | 'dropoff') => {
    const autocomplete = type === 'pickup' ? pickupAutocompleteRef.current : dropoffAutocompleteRef.current;
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place?.formatted_address) {
        setDetails(prev => ({ ...prev, [type]: place.formatted_address }));
        if (place.geometry?.location) {
          const coords = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
          if (type === 'pickup') {
            setPickupCoords(coords);
          } else {
            setDropoffCoords(coords);
          }
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

  const reset = () => {
    setStep(1);
    setSelectedPackage(null);
    setSelectedFleet(null);
    setDetails({
      name: '', email: '', phone: '', pickup: '', dropoff: '', date: '', time: '', notes: '', returnRide: false, returnDate: '', returnTime: ''
    });
    navigate('/offers', { replace: true });
  };

  // Helper to get price range for an offer
  const getPriceRange = (pkg: any) => {
    const fleets = pkg.fleets || [
      { salePrice: pkg.price || 0 },
      { salePrice: Math.round((pkg.price || 0) * 1.5) }
    ];
    const prices = fleets.map((f: any) => Number(f.salePrice)).filter((p: number) => !isNaN(p));
    if (prices.length === 0) return { min: 0, max: 0 };
    return {
      min: Math.min(...prices),
      max: Math.max(...prices)
    };
  };

  const allTags = Array.from(new Set(offers.flatMap(o => o.tags || []).filter(t => typeof t === 'string' && t.trim() !== '')));

  const filteredOffers = useMemo(() => {
    let result = [...offers];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.title?.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q)
      );
    }

    if (tagFilter !== 'all') {
      result = result.filter(o => o.tags?.includes(tagFilter));
    }

    if (discountFilter !== 'all') {
      result = result.filter(o => {
        const dType = o.discountType || 'percentage'; // assume percentage if missing
        return dType === discountFilter;
      });
    }

    if (priceSort !== 'none') {
      result.sort((a, b) => {
        const minA = getPriceRange(a).min;
        const minB = getPriceRange(b).min;
        return priceSort === 'asc' ? minA - minB : minB - minA;
      });
    }

    return result;
  }, [offers, searchQuery, tagFilter, discountFilter, priceSort]);

  const ITEMS_PER_PAGE = 12;
  const totalPages = pageSize === 'All' ? 1 : Math.max(1, Math.ceil(filteredOffers.length / (pageSize as number)));

  const paginatedOffers = useMemo(() => {
    if (pageSize === 'All') return filteredOffers;
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOffers.slice(startIndex, startIndex + pageSize);
  }, [filteredOffers, currentPage, pageSize]);

  const calculateOfferPriceBreakdown = () => {
    if (!selectedFleet) return { base: 0, subtotal: 0, appliedAddons: [], total: 0, addonTotal: 0 };
    
    let base = Number(selectedFleet.salePrice || selectedFleet.price || 0);

    if (details.returnRide) {
      base *= 2;
    }

    const subtotal = base;
    
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
      if (addon.applyToOffers === false) return;

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

      // 7. Service restriction (Match against package details)
      if (addon.limitService) {
        const serviceList = addon.selectedServices || [];
        const hasOffers = serviceList.map((s: string) => s.toLowerCase()).includes("offers");
        let matchesAny = false;
        if (hasOffers) {
          const otherServices = serviceList.filter((s: string) => s.toLowerCase() !== "offers");
          if (otherServices.length > 0) {
            const packVal = (selectedPackage?.title || selectedPackage?.category || "").toLowerCase();
            matchesAny = otherServices.some((s: string) => packVal.includes(s.toLowerCase()));
          } else {
            matchesAny = true;
          }
        }
        ruleResults.push({
          matched: matchesAny,
          details: matchesAny ? [`${selectedPackage?.title || "Offer"}`] : []
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

      const baseValue = base; 

      let value = 0;
      if (addon.type === "percentage") {
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
      base,
      subtotal,
      appliedAddons,
      addonTotal,
      total: subtotal + addonTotal
    };
  };

  const bookingPricing = calculateOfferPriceBreakdown();
  const totalPrice = bookingPricing.total;

  return (
    <>
      <SEO 
        title={selectedPackage ? selectedPackage.title : 'Special Luxury Offers'}
        description={selectedPackage ? (selectedPackage.seoDescription || selectedPackage.description) : 'Curated luxury chauffeur packages and special offers.'}
        ogImage={getAssetPath(selectedPackage?.image)}
        structuredData={selectedPackage ? {
          "@context": "https://schema.org",
          "@type": "Offer",
          "name": selectedPackage.title,
          "description": selectedPackage.description,
          "seller": {
            "@type": "Organization",
            "name": "Merlux Chauffeur Services"
          }
        } : undefined}
      />
      <div className="pt-20 pb-24 bg-black min-h-screen text-white font-sans overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-6">

          {/* Header Section */}
          <header className="mb-12">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center text-center space-y-4"
            >
              <span className="text-gold tracking-[0.4em] text-[10px] uppercase font-bold px-4 py-1.5 border border-gold/20 rounded-full bg-gold/5">
                Premium Collections
              </span>
              <h1 className="text-4xl md:text-6xl font-display leading-tight">
                Exclusive <span className="text-gold italic">Travel Packages</span>
              </h1>
              <p className="text-white/40 max-w-xl mx-auto text-sm leading-relaxed lowercase italic tracking-wide">
                luxury transport solutions curated for your most significant journeys. select a package to begin your reservation.
              </p>
            </motion.div>

            {/* Stepper */}
            <div className="flex flex-wrap items-center justify-between sm:justify-center gap-2 sm:gap-3 mt-12 mb-16 w-full max-w-full">
              {[
                { id: 1, label: 'Packages', icon: LayoutGrid },
                { id: 2, label: 'Fleet', icon: Car },
                { id: 3, label: 'Details', icon: User },
                { id: 4, label: 'Summary', icon: FileText }
              ].map((s, idx, arr) => (
                <div key={`offer-step-${s.id}`} className="flex items-center gap-2 shrink-0">
                  <div
                    className={cn(
                      "flex flex-row items-center gap-1 sm:gap-2 transition-all duration-300 justify-center",
                      Math.abs(s.id - step) === 1 ? "cursor-pointer group" : "cursor-not-allowed opacity-50"
                    )}
                    onClick={() => {
                      if (Math.abs(s.id - step) === 1) {
                        if (s.id > step) {
                          if (step === 1 && !selectedPackage) return;
                          if (step === 2 && !selectedFleet) return;
                        }
                        setStep(s.id);
                        if (s.id === 1) {
                          setSelectedPackage(null);
                          setSelectedFleet(null);
                          navigate('/offers', { replace: true });
                        }
                      }
                    }}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-700 border",
                        step === s.id
                          ? "bg-gold text-black border-gold shadow-[0_0_15px_rgba(212,175,55,0.3)] scale-110 rotate-[360deg]"
                          : step > s.id
                            ? "bg-gold/10 text-gold border-gold/30"
                            : "bg-white/5 text-white/20 border-white/10 group-hover:bg-white/10"
                      )}
                    >
                      {step > s.id ? <CheckCircle size={12} /> : <s.icon size={12} />}
                    </div>

                    {/* Label – show only active step on mobile */}
                    <span
                      className={cn(
                        "text-[9px] uppercase tracking-[0.15em] font-bold transition-colors duration-500 hidden sm:inline",
                        step === s.id ? "text-gold sm:text-white" : "text-white/20 group-hover:text-white/40"
                      )}
                    >
                      {s.label}
                    </span>
                    {/* Mobile active label */}
                    {step === s.id && (
                      <span className="text-[9px] uppercase tracking-[0.15em] font-bold text-gold sm:hidden">
                        {s.label}
                      </span>
                    )}
                  </div>

                            {idx < arr.length - 1 && (
                              <div
                                key={`connector-${s.id}-${idx}`}
                                className={cn(
                                  "w-6 h-[1px] mx-1 shrink-0 hidden sm:block", // hide on mobile
                                  step > s.id ? "bg-gold/30" : "bg-white/5"
                                )}
                              />
                            )}
                </div>
              ))}
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start relative">

            {/* Main Content Area */}
            <div className={cn(
              (step === 1 || step === 4) ? "lg:col-span-12" : "lg:col-span-8"
            )}>
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.5, ease: "circOut" }}
                    className="space-y-8"
                  >
                    {/* Filters & Search */}
<div className="flex flex-wrap items-center justify-between gap-4 bg-[#0A0A0A] p-4 rounded-2xl border border-white/5">
  {/* Search — full width on mobile, fixed on md+ */}
  <div className="relative w-full md:w-64">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
    <input
      type="text"
      placeholder="Search standard and special offers..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:outline-none focus:border-gold/50 transition-all"
    />
    {searchQuery && (
      <button
        onClick={() => setSearchQuery('')}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
      >
        <XCircle size={14} />
      </button>
    )}
  </div>

  {/* Filters — each row takes full width on mobile, auto on md+ */}
  <div className="grid grid-cols-1 md:flex md:flex-wrap gap-3 w-full md:w-auto">
    {/* Tags */}
    <div className="flex items-center gap-2 w-full md:w-auto">
      <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 shrink-0 w-14 md:w-auto">
        Tags
      </label>
      <select
        value={tagFilter}
        onChange={(e) => setTagFilter(e.target.value)}
        className="flex-1 md:flex-none bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-gold/50 transition-all custom-select appearance-none cursor-pointer md:w-40"
      >
        <option value="all">All Packages</option>
        {allTags.map((tag, tIdx) => (
          <option key={`offer-tag-${tag}-${tIdx}`} value={tag}>{tag}</option>
        ))}
      </select>
    </div>

    {/* Discount */}
    <div className="flex items-center gap-2 w-full md:w-auto">
      <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 shrink-0 w-14 md:w-auto">
        Discount
      </label>
      <select
        value={discountFilter}
        onChange={(e) => setDiscountFilter(e.target.value)}
        className="flex-1 md:flex-none bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-gold/50 transition-all custom-select appearance-none cursor-pointer md:w-40"
      >
        <option value="all">All Discounts</option>
        <option value="percentage">Percentage (%)</option>
        <option value="fixed">Fixed Amount ($)</option>
      </select>
    </div>

    {/* Sort Price */}
    <div className="flex items-center gap-2 w-full md:w-auto">
      <label className="text-[9px] uppercase tracking-widest font-bold text-white/40 shrink-0 w-14 md:w-auto">
        Sort Price
      </label>
      <select
        value={priceSort}
        onChange={(e) => setPriceSort(e.target.value as any)}
        className="flex-1 md:flex-none bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-xs text-white focus:outline-none focus:border-gold/50 transition-all custom-select appearance-none cursor-pointer md:w-40"
      >
        <option value="none">Default Sort</option>
        <option value="asc">Low to High</option>
        <option value="desc">High to Low</option>
      </select>
    </div>
  </div>
</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {isLoading ? (
                        <div className="col-span-full py-32 flex flex-col items-center">
                          <div className="w-16 h-16 border-2 border-gold/10 border-t-gold rounded-full animate-spin-slow mb-6" />
                          <p className="text-gold/60 text-[10px] uppercase tracking-[0.3em] animate-pulse">Initializing Portals...</p>
                        </div>
                      ) : paginatedOffers.length > 0 ? (
                        paginatedOffers.map((pkg) => {
                          const range = getPriceRange(pkg);
                          return (
                            <motion.div
                              key={pkg.id}
                              whileHover={{ y: -8 }}
                              onClick={() => handlePackageSelect(pkg)}
                              className="group flex flex-col relative bg-[#0A0A0A] border border-white/5 rounded-3xl overflow-hidden cursor-pointer hover:border-gold/30 transition-all duration-700 h-full"
                            >
                              <div className="h-48 relative overflow-hidden shrink-0">
                                <img
                                  src={getAssetPath(pkg.image) || `https://picsum.photos/seed/${pkg.id}/800/500`}
                                  alt={pkg.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110 opacity-70 group-hover:opacity-100"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent" />

                                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                                  {pkg.tags?.slice(0, 3).map((tag: string, tIdx: number) => (
                                    <span key={tIdx} className="bg-black/60 backdrop-blur-md border border-white/10 text-white shadow-xl text-[8px] font-bold uppercase tracking-widest px-2 py-1 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>

                                <div className="absolute top-4 right-4">
                                  {pkg.discountType === 'percentage'
                                    ? <span className="bg-gold text-black text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-full shadow-xl">{pkg.discountValue || pkg.offerPercentage || 15}% OFF</span>
                                    : <span className="bg-gold text-black text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-full shadow-xl">${pkg.discountValue || 15} OFF</span>}
                                </div>
                              </div>

                              <div className="p-6 flex-1 flex flex-col relative z-10 bg-[#0A0A0A] -mt-4 border-t border-white/5 backdrop-blur-lg rounded-t-2xl">
                                <h3 className="text-xl font-display mb-2 group-hover:text-gold transition-colors">{pkg.title}</h3>
                                <p className="text-white/50 text-xs mb-4 leading-relaxed italic line-clamp-2">
                                  "{pkg.description || 'Experience the pinnacle of luxury travel with our curated selection of premium transportation services.'}"
                                </p>
                                <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                                  <div className="space-y-1">
                                    <p className="text-[9px] uppercase tracking-widest text-white/40">From</p>
                                    <p className="text-lg font-display text-gold font-bold">
                                      {range.min === range.max ? `$${range.min}` : `$${range.min} - $${range.max}`}
                                    </p>
                                  </div>
                                  <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center group-hover:bg-gold group-hover:text-black group-hover:border-gold transition-all duration-500">
                                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })
                      ) : (
                        <div className="col-span-full py-24 text-center border border-dashed border-white/10 rounded-[3rem]">
                          <p className="text-white/30 italic text-sm tracking-wide">No specialized packages match your current preferences.</p>
                        </div>
                      )}
                    </div>

                    {/* BlogTab.tsx Style Pagination Controls */}
                    {filteredOffers.length > 0 && (
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white/[0.03] p-5 rounded-2xl border border-white/5 mt-12 mb-16">
                        {/* Status info */}
                        <div className="text-[11px] font-mono text-white/50">
                          Showing <span className="text-gold font-bold">
                            {filteredOffers.length === 0 ? 0 : (pageSize === 'All' ? 1 : (currentPage - 1) * (pageSize as number) + 1)}
                          </span> to <span className="text-gold font-bold">
                            {pageSize === 'All' ? filteredOffers.length : Math.min(currentPage * (pageSize as number), filteredOffers.length)}
                          </span> of <span className="text-white font-bold">{filteredOffers.length}</span> entries
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
                      </div>
                    )}

                    {/* Luxury CTA Below Offers */}
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      className="mt-24 bg-gold rounded-[3rem] p-12 md:p-20 text-black text-center relative overflow-hidden shadow-2xl"
                    >
                      <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white blur-[120px] rounded-full rotate-45" />
                      </div>
                      <div className="relative z-10 max-w-2xl mx-auto">
                        <span className="uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block">Bespoke Experiences</span>
                        <h2 className="text-4xl md:text-6xl font-display mb-8 leading-tight">Reserve Your <span className="italic">Luxury Ride</span></h2>
                        <p className="text-black/70 mb-10 text-lg leading-relaxed text-balance">
                          Indulge in the finest private tours across Melbourne and regional Victoria. Our chauffeurs are ready to guide you through an unforgettable journey.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                          <Link 
                            to="/booking" 
                            className="bg-black text-white px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all shadow-2xl"
                          >
                            Book A Journey
                          </Link>
                          <Link 
                            to="/tours" 
                            className="bg-white/20 backdrop-blur-md border border-black/10 text-black px-12 py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-black hover:text-white transition-all font-display"
                          >
                            Explore Private Tours
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="flex items-center justify-between mb-8">
                      <button onClick={() => { setStep(1); setSelectedPackage(null); setSelectedFleet(null); navigate('/offers', { replace: true }); }} className="text-gold hover:text-white flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-bold transition-all">
                        <ArrowRight size={14} className="rotate-180" /> Back to Packages
                      </button>
                      <div className="flex items-center gap-3">
                        <Info size={14} className="text-gold/40" />
                        <p className="text-[10px] uppercase tracking-widest text-white/40">Select a fleet model to continue</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                      {(selectedPackage?.fleets || [
                        { type: 'Executive Sedan', basePrice: 120, salePrice: 90, capacity: '3 Passengers', image: 'https://picsum.photos/seed/sedan/400/250' },
                        { type: 'Luxury Sedan', basePrice: 150, salePrice: 120, capacity: '3 Passengers', image: 'https://picsum.photos/seed/luxsedan/400/250' },
                        { type: 'Premium SUV', basePrice: 180, salePrice: 140, capacity: '6 Passengers', image: 'https://picsum.photos/seed/suv/400/250' },
                        { type: 'Luxury SUV', basePrice: 220, salePrice: 180, capacity: '6 Passengers', image: 'https://picsum.photos/seed/luxsuv/400/250' },
                        { type: 'Luxury Van', basePrice: 280, salePrice: 240, capacity: '12 Passengers', image: 'https://picsum.photos/seed/van/400/250' }
                      ]).map((fleet: any, idx: number) => (
                        <motion.div
                          key={`${fleet.type}-${idx}`}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          onClick={() => handleFleetSelect(fleet)}
                          className={cn(
                            "group relative flex flex-col md:flex-row items-center gap-8 bg-[#0A0A0A] border border-white/5 p-8 rounded-[2rem] hover:border-gold/40 transition-all duration-500 cursor-pointer overflow-hidden",
                            selectedFleet?.type === fleet.type && "border-gold bg-gold/5 shadow-[0_0_40px_rgba(212,175,55,0.05)]"
                          )}
                        >
                          <div className="w-full md:w-64 aspect-[16/10] overflow-hidden rounded-2xl relative shrink-0">
                            <img
                              src={getAssetPath(fleet.image) || `https://picsum.photos/seed/${fleet.type}/400/250`}
                              alt={fleet.type}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                            />

                            {/* Passengers - Top Left */}
                            <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md text-gold text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-gold/20 flex items-center gap-1.5">
                              <User className="w-2.5 h-2.5" />
                              <span className="text-white">{fleet.passengers}</span>
                            </div>

                            {/* Luggage & Capacity - Top Right */}
                            <div className="absolute bottom-3 right-3 flex items-center gap-2">
                              {/* Luggage */}
                              <div className="bg-black/80 backdrop-blur-md text-gold text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-gold/20 flex items-center gap-1.5">
                                <Luggage className="w-2.5 h-2.5" />
                                <span className="text-white">{fleet.luggage}</span>
                              </div>

                              {/* Handbag/Capacity */}
                              <div className="bg-black/80 backdrop-blur-md text-gold text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border border-gold/20 flex items-center gap-1.5">
                                <Handbag className="w-2.5 h-2.5" />
                                <span className="text-white">{fleet.capacity}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <h4 className="text-2xl font-display mb-1 group-hover:text-gold transition-colors">{fleet.type}</h4>
                              <p className="text-[9px] uppercase tracking-[0.1em] font-bold text-white/30">
                                {fleet.additionalInfo || "Fully Serviced & Chauffeur Driven"}
                              </p>
                            </div>
                            <div className="flex items-end gap-4">
                              <div className="space-y-0.5">
                                <p className="text-[9px] uppercase tracking-widest text-white/40">Standard Price</p>
                                <p className="text-xl text-white/20 font-bold line-through">${fleet.basePrice}</p>
                              </div>
                              <div className="space-y-0.5">
                                <p className="text-[9px] uppercase tracking-widest text-gold/60">Your Special Offer</p>
                                <p className="text-4xl font-display text-white">${fleet.salePrice}</p>
                              </div>
                              <div className="ml-auto mb-1">
                                <div className="flex items-center gap-2 text-gold font-bold uppercase tracking-widest text-[10px]">
                                  <span className="hidden md:block">Select Fleet</span>
                                  <ChevronRight size={16} />
                                </div>
                              </div>
                            </div>
                          </div>
                          {selectedFleet?.type === fleet.type && (
                            <div className="absolute top-0 right-0 p-4">
                              <Tag className="text-gold animate-bounce" size={16} />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <button onClick={() => setStep(2)} className="text-gold hover:text-white flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-bold transition-all mb-4">
                      <ArrowRight size={14} className="rotate-180" /> Back to Fleet selection
                    </button>

                    <div className="bg-[#0A0A0A] border border-white/5 rounded-[3rem] p-10 md:p-14">
                      <div className="mb-12">
                        <h2 className="text-3xl font-display mb-3">Booking <span className="text-gold italic">Information</span></h2>
                        <p className="text-white/40 text-sm italic">Please provide your contact and journey details to finalize the reservation.</p>
                      </div>

                      <div className="mb-12">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-3">
                            <User size={14} className="text-gold" />
                            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/30">
                              Personal Details
                            </span>
                          </div>
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
                          <div className="mb-6">
                            <LoginInline />
                          </div>
                        )}
                      </div>

                      <form onSubmit={handleDetailsSubmit} className="space-y-10">
                        {/* Identity Section */}
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                              <input
                                required
                                type="text"
                                value={details.name}
                                onChange={(e) => setDetails({ ...details, name: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 
                     focus:border-gold outline-none transition-all 
                     placeholder:text-white/20 text-sm font-medium"
                                placeholder="Full name"
                              />
                            </div>
                            <div className="space-y-2">
                              <input
                                required
                                type="email"
                                value={details.email}
                                onChange={(e) => setDetails({ ...details, email: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 
                     focus:border-gold outline-none transition-all 
                     placeholder:text-white/20 text-sm font-medium"
                                placeholder="Email address"
                              />
                            </div>
                            <div className="md:col-span-2 space-y-2">
                              <div className="flex gap-2">
                                <div className="relative min-w-[120px] w-1/3 p-0">
                                  <select
                                    className="custom-select w-full h-[54px] !py-0 !pl-3 text-sm rounded-xl select-none"
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
                                  className="flex-1 bg-white/5 border border-white/10 rounded-xl py-4 px-4 focus:border-gold outline-none transition-all placeholder:text-white/20 text-sm font-medium"
                                  placeholder="Phone number"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Journey Section */}
                        <div className="space-y-6 pt-4">
                          <div className="flex items-center gap-3 mb-2">
                            <MapPin size={14} className="text-gold" />
                            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/30">
                              Route & Logistics
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {isLoaded ? (
                              <>
                                <div className="space-y-2">
                                  <Autocomplete
                                    onLoad={(ref) => (pickupAutocompleteRef.current = ref)}
                                    onPlaceChanged={() => onPlaceChanged('pickup')}
                                    options={autocompleteOptions}
                                  >
                                    <div className="relative">
                                      <input
                                        required
                                        type="text"
                                        value={details.pickup}
                                        onChange={(e) => setDetails({ ...details, pickup: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-4 pr-12 
                             focus:border-gold outline-none transition-all 
                             placeholder:text-white/20 text-sm font-medium"
                                        placeholder="Pickup address"
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
                                </div>
                                <div className="space-y-2">
                                  <Autocomplete
                                    onLoad={(ref) => (dropoffAutocompleteRef.current = ref)}
                                    onPlaceChanged={() => onPlaceChanged('dropoff')}
                                    options={autocompleteOptions}
                                  >
                                    <div className="relative">
                                      <input
                                        type="text"
                                        value={details.dropoff}
                                        onChange={(e) => setDetails({ ...details, dropoff: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-4 pr-12 
                             focus:border-gold outline-none transition-all 
                             placeholder:text-white/20 text-sm font-medium"
                                        placeholder="Dropoff address (optional)"
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
                                </div>
                              </>
                            ) : (
                              <div className="col-span-2 p-4 text-[10px] text-white/20 uppercase tracking-widest text-center animate-pulse">
                                Loading map services...
                              </div>
                            )}
                            <div className="space-y-2">
                              <input
                                required
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                value={details.date}
                                onChange={(e) => setDetails({ ...details, date: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 
                     focus:border-gold outline-none transition-all 
                     text-sm font-medium appearance-none h-[53px]"
                              />
                            </div>
                            <div className="space-y-2">
                              <input
                                required
                                type="time"
                                value={details.time}
                                onChange={(e) => setDetails({ ...details, time: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 
                     focus:border-gold outline-none transition-all 
                     text-sm font-medium appearance-none h-[53px]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Return Ride Section */}
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
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4">
                            <div className="space-y-2">
                              <input
                                required={details.returnRide}
                                type="date"
                                min={details.date || new Date().toISOString().split('T')[0]}
                                value={details.returnDate}
                                onChange={(e) => setDetails({ ...details, returnDate: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 
                       focus:border-gold outline-none transition-all 
                       text-sm font-medium appearance-none h-[53px]"
                              />
                            </div>
                            <div className="space-y-2">
                              <input
                                required={details.returnRide}
                                type="time"
                                value={details.returnTime}
                                onChange={(e) => setDetails({ ...details, returnTime: e.target.value })}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-4 px-4 
                       focus:border-gold outline-none transition-all 
                       text-sm font-medium appearance-none h-[53px]"
                              />
                            </div>
                          </div>
                        )}

                        {/* Notes Section */}
                        <div className="space-y-4 pt-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Info size={14} className="text-gold" />
                            <span className="text-[10px] uppercase tracking-[0.3em] font-bold text-white/30">
                              Additional Notes
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            value={details.notes}
                            onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl p-6 
                 focus:border-gold outline-none transition-all 
                 placeholder:text-white/20 text-sm font-medium custom-scrollbar"
                            placeholder="Any special requests or instructions for your chauffeur..."
                          />
                        </div>

                        <button
                          type="submit"
                          className="w-full bg-gold text-black py-6 rounded-2xl font-black uppercase 
               tracking-[0.3em] text-[11px] hover:bg-white transition-all 
               shadow-2xl shadow-gold/20 flex items-center justify-center gap-3"
                        >
                          Review booking summary <ChevronRight size={18} />
                        </button>
                      </form>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div
                    key="step4"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="space-y-8"
                  >
                    <div className="bg-[#0A0A0A] border border-white/5 rounded-[4rem] p-8 md:p-16 relative overflow-hidden group">
                      {/* Background Accent */}
                      <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-gold/5 to-transparent pointer-events-none" />

                      <div className="relative z-10">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
                          <div className="space-y-4">
                            <button onClick={() => setStep(3)} className="text-gold hover:text-white flex items-center gap-2 uppercase tracking-[0.2em] text-[10px] font-bold transition-all group/back">
                              <div className="w-8 h-8 rounded-full border border-gold/20 flex items-center justify-center group-hover/back:bg-gold group-hover/back:text-black transition-all">
                                <ArrowRight size={14} className="rotate-180" />
                              </div>
                              Modify details
                            </button>
                            <h2 className="text-4xl md:text-5xl font-display leading-tight">Confirmation <span className="text-gold italic">Summary</span></h2>
                            <p className="text-white/40 text-sm italic max-w-md leading-relaxed lowercase">
                              your exclusive journey is ready for launch. please verify all details before initiating the secure transaction.
                            </p>
                          </div>

                          <div className="hidden md:block">
                            <div className="w-48 h-48 rounded-[2rem] border border-gold/20 p-2 bg-gradient-to-br from-gold/5 to-transparent">
                              <img
                                src={getAssetPath(selectedFleet.image || selectedPackage.image)}
                                alt="Vehicle Selection"
                                className="w-full h-full object-cover rounded-[1.5rem] opacity-80 group-hover:opacity-100 transition-opacity"
                                referrerPolicy="no-referrer"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Full Width Integrated Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 border-t border-white/5 pt-16">
                          <div className="space-y-10">
                            <div className="space-y-6">
                              <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-gold/60">Selected Package</p>
                                <p className="text-xl font-bold text-white uppercase tracking-tighter">{selectedPackage.title}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-gold/60">Vehicle Choice</p>
                                <p className="text-xl font-bold text-white uppercase tracking-tighter">{selectedFleet.type}</p>
                              </div>
                            </div>
                          </div>

                          <div className="md:col-span-2 space-y-12">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-10">
                              <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/30">Reserved For</p>
                                <p className="text-sm font-bold text-white uppercase tracking-tighter">{details.name}</p>
                                <p className="text-[10px] text-white/40 tracking-wider lowercase italic">{details.email}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/30">Trip Schedule</p>
                                <p className="text-sm font-bold text-white uppercase tracking-tighter">{details.date} at {details.time}</p>
                                <p className="text-[10px] text-white/40 tracking-wider">M: {details.phone}</p>
                              </div>
                              <div className="space-y-1 sm:col-span-2">
                                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-white/30">Route Profile</p>
                                <div className="space-y-2 mt-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                                    <p className="text-sm font-medium text-white/80 line-clamp-1">{details.pickup}</p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <div className="w-1.5 h-1.5 rounded-full border border-gold" />
                                    <p className="text-sm font-medium text-white/40 line-clamp-1">{details.dropoff || 'N/A'}</p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {details.notes && (
                              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl italic">
                                <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-gold/40 mb-3 italic">Special Directives</p>
                                <p className="text-sm text-white/60 leading-relaxed font-medium capitalize">"{details.notes}"</p>
                              </div>
                            )}

                            <div className="pt-8 border-t border-white/5 space-y-6">
                              <div className="space-y-2.5 max-w-sm sm:max-w-md border-b border-white/5 pb-6">
                                <div className="flex justify-between text-xs text-white/50">
                                  <span className="uppercase tracking-wider">Base Package Price:</span>
                                  <span className="font-bold font-mono">${bookingPricing.subtotal.toFixed(2)}</span>
                                </div>
                                {bookingPricing.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).map((addon: any, aIdx: number) => (
                                  <div key={`summary-addon-${addon.id || aIdx}-${aIdx}`} className="space-y-1">
                                    <div className="flex justify-between text-xs text-gold/80">
                                      <span className="uppercase tracking-wider font-semibold">{addon.name}:</span>
                                      <span className="font-bold font-mono">
                                        {addon.impact > 0 ? "+" : "-"}${Math.abs(addon.impact).toFixed(2)}
                                      </span>
                                    </div>
                                    {!addon.hideSatisfyDetails && addon.satisfyDetails && addon.satisfyDetails.length > 0 && (
                                      <div className="space-y-0.5 pl-2 border-l border-gold/20 text-left">
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
                              </div>

                              <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pt-2">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    {paymentMethod === 'stripe' ? <CreditCard size={14} className="text-gold" /> : <Banknote size={14} className="text-gold" />}
                                    <span className="text-gold text-[10px] uppercase tracking-[0.3em] font-bold italic">Premier Reservation Asset</span>
                                  </div>
                                  <p className="text-[9px] text-white/20 uppercase tracking-[0.2em]">Inclusive of all terminal taxes & luxury surcharges</p>
                                </div>
                                <div className="text-center sm:text-right">
                                  <span className="text-5xl font-display text-white tracking-tighter">${totalPrice.toFixed(2)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-12 space-y-6">
                          <h3 className="text-gold text-xs uppercase tracking-widest font-bold">Secure Payment Method</h3>
                          {(() => {
                            const paymentMethodsList = [
                              ...(systemSettings?.allowStripeCardPayment !== false ? [{ id: 'stripe', label: 'Stripe Pay', sub: 'Instant Update', icon: CreditCard }] : []),
                              ...(systemSettings?.allowCashPayment !== false ? [{ id: 'cash', label: 'Cash Payment', sub: 'Pay on Arrival', icon: Banknote }] : [])
                            ];
                            return (
                              <div className={cn("grid gap-4", paymentMethodsList.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2")}>
                                {paymentMethodsList.map((p) => (
                                  <button
                                    key={p.id}
                                    onClick={() => setPaymentMethod(p.id as any)}
                                    className={cn(
                                      "p-6 rounded-2xl border transition-all text-left group",
                                      paymentMethod === p.id ? "bg-gold border-gold" : "bg-white/5 border-white/10 hover:border-gold/50"
                                    )}
                                  >
                                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-all", paymentMethod === p.id ? "bg-black text-gold" : "bg-white/5 text-white/20 group-hover:text-gold")}>
                                      <p.icon size={18} />
                                    </div>
                                    <p className={cn("text-[9px] uppercase font-bold tracking-widest", paymentMethod === p.id ? "text-black" : "text-white/30")}>{p.label}</p>
                                    <p className={cn("text-[8px] uppercase font-bold opacity-40", paymentMethod === p.id ? "text-black" : "text-gold")}>{p.sub}</p>
                                  </button>
                                ))}
                              </div>
                            );
                          })()}
                        </div>

                        <div className="mt-16">
                          <button
                            onClick={async () => {
                              setIsLoading(true);
                              try {
                                const bookingData: any = {
                                  customerName: details.name,
                                  customerEmail: details.email?.toLowerCase(),
                                  customerPhone: details.phone,
                                  pickup: details.pickup,
                                  dropoff: details.dropoff || null,
                                  date: details.date,
                                  time: details.time,
                                  purpose: details.notes || "",
                                  returnRide: details.returnRide,
                                  returnDate: details.returnRide ? details.returnDate : null,
                                  returnTime: details.returnRide ? details.returnTime : null,
                                  packageId: selectedPackage.id,
                                  packageTitle: selectedPackage.title,
                                  vehicleType: selectedFleet.type,
                                  price: totalPrice,
                                  priceBreakdown: {
                                    base: bookingPricing.base,
                                    subtotal: bookingPricing.subtotal,
                                    appliedAddons: bookingPricing.appliedAddons,
                                    addonTotal: bookingPricing.addonTotal,
                                    total: bookingPricing.total
                                  },
                                  status: 'pending',
                                  type: 'offer',
                                  paymentStatus: 'unpaid',
                                  paymentMethod: paymentMethod,
                                  serviceType: 'offer',
                                  userId: auth.currentUser?.uid || 'guest'
                                };

                                if (paymentMethod === 'stripe') {
                                  // Save draft for restoration if cancelled
                                  localStorage.setItem('offer_booking_draft', JSON.stringify({
                                    details,
                                    step,
                                    selectedPackage,
                                    selectedFleet,
                                    paymentMethod
                                  }));

                                  const response = await fetch('/api/create-checkout-session', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      bookingData,
                                      vehicleName: `${selectedPackage.title} - ${selectedFleet.type}`,
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
                                  navigate(`/payment/success?booking_id=${docRef.id}&method=cash`);
                                }
                              } catch (err: any) {
                                console.error("Booking error:", err);
                                showNotice('error', err.message || "There was an issue processing your booking. Please try again.", 'Booking Failed');
                              } finally {
                                setIsLoading(false);
                              }
                            }}
                            disabled={isLoading}
                            className="w-full bg-gold text-black py-8 rounded-[2rem] font-black uppercase tracking-[0.5em] text-sm hover:bg-white transition-all shadow-[0_30px_60px_rgba(212,175,55,0.15)] flex items-center justify-center gap-6"
                          >
                            {isLoading ? 'Processing Luxury Asset...' : `Finalize & Secure Ride — $${totalPrice}`}
                            <ArrowRight size={22} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Sticky Sidebar Booking Summary */}
            {(step === 2 || step === 3) && (
              <div className="lg:col-span-4 sticky top-24">
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-[#0A0A0A] border border-white/5 rounded-[2.5rem] overflow-hidden"
                >
                  <div className="bg-gold/5 p-8 border-b border-white/5">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-gold mb-1">Reservation Info</h3>
                    <p className="text-white text-lg font-display">Booking Summary</p>
                  </div>

                  <div className="p-8 space-y-8">
                    {selectedPackage ? (
                      <>
                        {/* Step 1 Data */}
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-1">
                              <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">Package</p>
                              <p className="text-sm font-bold text-white leading-tight uppercase tracking-tighter">{selectedPackage.title}</p>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                              <Tag size={16} className="text-gold" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-gold bg-gold/10 px-2 py-0.5 rounded-md">-{selectedPackage.offerPercentage || 15}%</span>
                            <span className="text-[9px] uppercase tracking-widest text-white/20 italic">Seasonal Special</span>
                          </div>
                        </div>

                        {/* Step 2 Data */}
                        {selectedFleet && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4 pt-8 border-t border-white/5"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">Selected Fleet</p>
                                <p className="text-sm font-bold text-white leading-tight uppercase tracking-tighter">{selectedFleet.type}</p>
                                <p className="text-[9px] uppercase tracking-widest font-bold text-white/20">{selectedFleet.capacity}</p>
                              </div>
                              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                <Car size={16} className="text-gold" />
                              </div>
                            </div>
                          </motion.div>
                        )}

                        {/* Step 3 Data */}
                        {(details.pickup || details.date) && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-5 pt-8 border-t border-white/5"
                          >
                            {details.pickup && (
                              <div className="flex gap-4">
                                <div className="w-8 shrink-0 flex flex-col items-center">
                                  <div className="w-2 h-2 rounded-full border border-gold" />
                                  <div className="w-[1px] h-8 bg-white/10 my-1" />
                                  <div className="w-2 h-2 rounded-full bg-gold shadow-[0_0_8px_rgba(212,175,55,0.8)]" />
                                </div>
                                <div className="flex-1 space-y-4">
                                  <div className="space-y-1">
                                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">Pickup</p>
                                    <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 uppercase tracking-tighter">{details.pickup}</p>
                                  </div>
                                  {details.dropoff && (
                                    <div className="space-y-1">
                                      <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">Dropoff</p>
                                      <p className="text-[11px] font-bold text-white leading-tight line-clamp-2 uppercase tracking-tighter">{details.dropoff}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {(details.date || details.time) && (
                              <div className="flex items-center gap-6 pt-2">
                                <div className="space-y-1 flex-1">
                                  <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">Departure</p>
                                  <div className="flex items-center gap-2">
                                    <Calendar size={12} className="text-gold/40" />
                                    <p className="text-[11px] font-bold text-white uppercase tracking-tighter">{details.date || 'TBD'}</p>
                                  </div>
                                </div>
                                <div className="space-y-1 flex-1 text-right">
                                  <p className="text-[9px] uppercase tracking-widest font-bold text-white/30">Time</p>
                                  <div className="flex items-center gap-2 justify-end">
                                    <Clock size={12} className="text-gold/40" />
                                    <p className="text-[11px] font-bold text-white uppercase tracking-tighter">{details.time || 'TBD'}</p>
                                  </div>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}

                        {/* Total Section */}
                        <div className="mt-12 pt-8 border-t border-gold/20 flex flex-col gap-4">
                          <div className="space-y-2">
                             <div className="flex items-center justify-between text-white/50">
                               <span className="text-[10px] font-bold uppercase tracking-widest italic">Base Package</span>
                               <span className="text-xs font-bold font-mono">${bookingPricing.subtotal.toFixed(2)}</span>
                             </div>
                             
                             {bookingPricing.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).map((addon: any, aIdx: number) => (
                               <div key={`offer-summary-addon-${addon.id}-${aIdx}`} className="border-b border-white/[0.03] pb-1.5 last:border-0 last:pb-0">
                                 <div className="flex items-center justify-between text-gold/60">
                                   <span className="text-[10px] font-bold uppercase tracking-widest italic">{addon.name}</span>
                                   <span className="text-xs font-bold font-mono">
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

                          <div className="flex items-center justify-between mb-4 mt-2">
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gold">Final Total</span>
                            <div className="h-[1px] flex-1 bg-gold/10 mx-4" />
                            <span className="text-3xl font-display text-white">
                              ${totalPrice.toFixed(2)}
                            </span>
                          </div>
                        </div>
                          <p className="text-[9px] text-white/20 italic text-right leading-none lowercase tracking-tight">exclusive airport fees & taxes included.</p>
                      </>
                    ) : (
                      <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 rounded-full border border-dashed border-white/10 flex items-center justify-center text-white/10">
                          <Star size={24} className="animate-pulse" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/20">Awaiting Select</p>
                          <p className="text-[9px] text-white/10 italic leading-relaxed lowercase px-8 prose prose-invert">your curated itinerary will appear here as you configure your journey.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Assistance Card */}
                <div className="mt-6 p-8 bg-gold/5 border border-gold/10 rounded-[2.5rem] flex items-center gap-5">
                  <div className="w-12 h-12 bg-black rounded-full border border-gold/20 flex items-center justify-center shrink-0">
                    <Phone size={16} className="text-gold" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-gold leading-none">Need Assistance?</p>
                    <p className="text-[11px] text-white/50 leading-tight uppercase tracking-tighter font-bold">VIP Priority Line: +61 400 000 000</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Global Features Footer */}
          <div className="mt-32 pt-20 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-12">
            {[
              { icon: MapPin, title: "Global Access", val: "Available in 50+ Cities" },
              { icon: Car, title: "Platinum Fleet", val: "Model Year 2024+" },
              { icon: User, title: "Lounge Access", val: "Complimentary VIP entry" },
              { icon: Star, title: "Chauffeur", val: "Certfied Professionals" }
            ].map((f, i) => (
              <div key={i} className="space-y-4">
                <div className="w-10 h-10 border border-white/5 bg-[#050505] rounded-xl flex items-center justify-center text-gold/60">
                  <f.icon size={18} />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-[0.3em] font-bold text-gold">{f.title}</p>
                  <p className="text-white text-xs font-display tracking-wide">{f.val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
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
