import { useState, useEffect, useCallback, useMemo, useRef } from "react";
// Dynamic reload touch
import { motion, AnimatePresence } from "motion/react";
import {
  MapPin,
  Calendar,
  BadgePercent,
  Clock,
  Timer,
  Car,
  HandHeart,
  Gem,
  Cake,
  User,
  ChevronsLeft,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Plane,
  Briefcase,
  Heart,
  Map,
  Info,
  Navigation,
  AlertCircle,
  Search,
  Loader2,
  ArrowLeft,
  CircleCheckBig,
  CreditCard,
  Banknote,
  Plus,
  Trash2,
  Percent,
  Tag,
  RotateCcw,
  Eye,
  LocateFixed,
  History,
} from "lucide-react";
import {
  GoogleMap,
  useJsApiLoader,
  Marker,
  DirectionsService,
  DirectionsRenderer,
  Autocomplete,
  TrafficLayer,
} from "@react-google-maps/api";
import { FormNotice, type NoticeType } from "../components/FormNotice";
import { cn, getAssetPath } from "../lib/utils";
import { useSettings } from "../lib/SettingsContext";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
  getDocs,
  updateDoc,
  setDoc,
  query,
  where,
} from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import Logo from "../components/layout/Logo";
import SEO from "../components/SEO";

import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from "../lib/google-maps";

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

// Suppress Google Maps Places Autocomplete, DirectionsService, Marker, and DirectionsRenderer deprecation warnings
if (typeof window !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: any[]) => {
    if (
      args[0] &&
      typeof args[0] === "string" &&
      (args[0].includes("google.maps.places.Autocomplete") ||
        args[0].includes("PlaceAutocompleteElement") ||
        args[0].includes("google.maps.DirectionsService") ||
        args[0].includes("Route.computeRoutes") ||
        args[0].includes("google.maps.Marker") ||
        args[0].includes("AdvancedMarkerElement") ||
        args[0].includes("google.maps.DirectionsRenderer"))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
};

const formatWithZone = (value?: string, timeZone?: string) =>
  value
    ? new Date(value).toLocaleString([], {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || undefined,
    })
    : "N/A";

const formatDateWithWeekday = (dateStr: string) => {
  if (!dateStr) return "N/A";
  try {
    const date = new Date(dateStr.replace(/-/g, "/"));
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch (e) {
    return dateStr;
  }
};

const formatTime12h = (timeStr: string) => {
  if (!timeStr) return "N/A";
  try {
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours, 10);
    const m = minutes;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

const center = {
  lat: -37.8136,
  lng: 144.9631, // Melbourne
};

const steps = [
  { id: 1, name: "Service", icon: Briefcase },
  { id: 2, name: "Details", icon: MapPin },
  { id: 3, name: "Vehicle", icon: Car },
  { id: 4, name: "Summary", icon: CreditCard },
];

const serviceTypes = [
  {
    id: "airport",
    name: "Airport Transfer",
    icon: Plane,
    desc: "To or from Melbourne Airport",
  },
  {
    id: "corporate",
    name: "Corporate Travel",
    icon: Briefcase,
    desc: "Professional business transport",
  },
  {
    id: "wedding",
    name: "Wedding Service",
    icon: Gem,
    desc: "Luxury for your special day",
  },
  {
    id: "hourly",
    name: "Hourly Hire",
    icon: Clock,
    desc: "Chauffeur at your disposal",
  },
  {
    id: "event",
    name: "Events Hire",
    icon: Cake,
    desc: "Elegant transport for any event",
  },
  {
    id: "occasions",
    name: "Special Occasions",
    icon: HandHeart,
    desc: "Bespoke regional Victoria tours",
  },
];

const vehicles = [
  {
    id: "sedan",
    name: "Luxury Sedan",
    model: "Mercedes E-Class",
    pax: 3,
    bags: 2,
    price: 95,
    img: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop",
  },
  {
    id: "suv",
    name: "Business SUV",
    model: "Audi Q7 / BMW X5",
    pax: 4,
    bags: 4,
    price: 125,
    img: "https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=2070&auto=format&fit=crop",
  },
  {
    id: "first",
    name: "First Class",
    model: "Mercedes S-Class",
    pax: 2,
    bags: 2,
    price: 180,
    img: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=2070&auto=format&fit=crop",
  },
  {
    id: "van",
    name: "Executive Van",
    model: "Mercedes V-Class",
    pax: 7,
    bags: 7,
    price: 150,
    img: "https://images.unsplash.com/photo-1532581291347-9c39cf10a73c?q=80&w=2070&auto=format&fit=crop",
  },
];

export default function Booking() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state as {
    service?: string;
    step?: number;
  } | null;

  const { isLoaded, loadError } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [pickupCoords, setPickupCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<google.maps.LatLngLiteral | null>(null);
  const [waypointCoords, setWaypointCoords] = useState<{ [key: number]: { lat: number; lng: number } }>({});
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const [step, setStep] = useState(initialState?.step || 1);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { floatingSettings, settings: contextSettings } = useSettings();
  const noticeTimerRef = useRef<any>(null);
  const [notice, setNotice] = useState<{ type: NoticeType; message: string; title?: string } | null>(null);

  const showNotice = (type: NoticeType, message: string, title?: string) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ type, message, title });

    const duration = floatingSettings?.toast?.duration || 5000;
    if (type === 'success' || type === 'info' || type === 'error' || type === 'warning') {
      noticeTimerRef.current = setTimeout(() => {
        setNotice(null);
        noticeTimerRef.current = null;
      }, duration);
    }
  };

  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);
  const waypointInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const [fleet, setFleet] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [priceAddons, setPriceAddons] = useState<any[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [showDistanceBreakdown, setShowDistanceBreakdown] = useState(false);

  useEffect(() => {
    if (step && mainScrollRef.current) {
      mainScrollRef.current.scrollTo(0, 0);
    }
  }, [step]);

  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showLoginFields, setShowLoginFields] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [formData, setFormData] = useState({
    serviceType: initialState?.service || "",
    pickup: "",
    dropoff: "",
    date: "",
    time: "",
    vehicle: "",
    passengers: 1,
    flightNumber: "",
    notes: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    customerPassword: "", // For registration
    isReturn: false,
    returnDate: "",
    returnTime: "",
    waypoints: [] as string[],
    hours: 1,
    purpose: "",
    couponCode: "",
    selectedExtras: [] as string[],
  });

  const [distance, setDistance] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [distanceValue, setDistanceValue] = useState<number>(0);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  const canNavigateToStep = (targetStep: number) => {
    if (targetStep === step) return true;
    if (targetStep < step) return true; // Always allow going back

    // Forward navigation validation
    if (targetStep === 2) {
      return !!formData.serviceType;
    }
    if (targetStep === 3) {
      const hasService = !!formData.serviceType;
      const isDropoffRequired = formData.serviceType !== "hourly";
      const hasDetails = !!formData.pickup && (isDropoffRequired ? !!formData.dropoff : true) && !!formData.date && !!formData.time;
      
      const isSameAddress = isDropoffRequired && formData.pickup && formData.dropoff && 
                           formData.pickup.trim().toLowerCase() === formData.dropoff.trim().toLowerCase();
      const hasDistance = isDropoffRequired ? (distanceValue > 0) : true;

      return hasService && hasDetails && !isSameAddress && hasDistance;
    }
    if (targetStep === 4) {
      const hasService = !!formData.serviceType;
      const isDropoffRequired = formData.serviceType !== "hourly";
      const hasDetails = !!formData.pickup && (isDropoffRequired ? !!formData.dropoff : true) && !!formData.date && !!formData.time;
      
      const isSameAddress = isDropoffRequired && formData.pickup && formData.dropoff && 
                           formData.pickup.trim().toLowerCase() === formData.dropoff.trim().toLowerCase();
      const hasDistance = isDropoffRequired ? (distanceValue > 0) : true;
      const hasVehicle = !!formData.vehicle;
      
      return hasService && hasDetails && !isSameAddress && hasDistance && hasVehicle;
    }
    return false;
  };

  const handleStepClick = (targetId: number) => {
    if (canNavigateToStep(targetId)) {
      setStep(targetId);
      if (mainScrollRef.current) {
        mainScrollRef.current.scrollTo(0, 0);
      }
    } else {
      // Provide feedback why they can't move forward
      if (targetId === 2 && !formData.serviceType) {
        showNotice('warning', "Please select a service type first", "Required Step");
      } else if (targetId === 3) {
        const isDropoffRequired = formData.serviceType !== "hourly";
        if (!formData.pickup || (isDropoffRequired && !formData.dropoff) || !formData.date || !formData.time) {
          showNotice('warning', "Please complete all ride details first", "Required Step");
        } else if (isDropoffRequired && formData.pickup && formData.dropoff && 
                   formData.pickup.trim().toLowerCase() === formData.dropoff.trim().toLowerCase()) {
          showNotice('error', "Pickup and Drop-off locations cannot be the same address.", 'Address Error');
        } else if (isDropoffRequired && (!distance || distanceValue <= 0)) {
          showNotice('error', "Distance cannot be 0 km. Please ensure your pickup and drop-off points are valid. (Min KM Restriction)", 'Distance Error');
        }
      } else if (targetId === 4 && !formData.vehicle) {
        showNotice('warning', "Please select a vehicle first", "Required Step");
      }
    }
  };

  const handleNewBooking = () => {
    // Reset all states (Storage is NOT cleared so users can restore if needed)
    
    // Reset all states
    setFormData({
      serviceType: "",
      pickup: "",
      dropoff: "",
      date: "",
      time: "",
      vehicle: "",
      passengers: 1,
      flightNumber: "",
      notes: "",
      customerName: user?.displayName || "",
      customerEmail: user?.email || "",
      customerPhone: "",
      customerPassword: "",
      isReturn: false,
      returnDate: "",
      returnTime: "",
      waypoints: [],
      hours: 1,
      purpose: "",
      couponCode: "",
      selectedExtras: [],
    });
    
    setStep(1);
    setAppliedCoupon(null);
    setDistance("");
    setDuration("");
    setDistanceValue(0);
    setLastSaved(null);
    setPickupCoords(null);
    setDropoffCoords(null);
    setWaypointCoords({});
    setDirections(null);
    
    // Clear inputs manually
    if (pickupInputRef.current) pickupInputRef.current.value = "";
    if (dropoffInputRef.current) dropoffInputRef.current.value = "";
    
    showNotice('success', "Started a fresh booking", "New Booking");
  };

  const restoreDraft = () => {
    const saved = localStorage.getItem('booking_progress_auto');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFormData(prev => ({
          ...prev,
          ...data.formData,
          customerPassword: prev.customerPassword 
        }));
        setStep(data.step || 1);
        if (data.appliedCoupon) setAppliedCoupon(data.appliedCoupon);
        if (data.distance) setDistance(data.distance);
        if (data.duration) setDuration(data.duration);
        if (data.distanceValue) setDistanceValue(data.distanceValue);
        if (data.pickupCoords) setPickupCoords(data.pickupCoords);
        if (data.dropoffCoords) setDropoffCoords(data.dropoffCoords);
        if (data.waypointCoords) setWaypointCoords(data.waypointCoords);
        if (data.directions) setDirections(data.directions);

        setLastSaved(data.lastUpdated || null);
        showNotice('success', "Booking progress restored from draft", "Draft Restored");
      } catch (e) {
        console.error("Failed to restore progress:", e);
        showNotice('error', "Could not restore booking draft", "Restore Failed");
      }
    } else {
      showNotice('info', "No saved draft found", "No Draft");
    }
  };

  // Auto-save form progress to localStorage
  useEffect(() => {
    const hasData = formData.pickup || formData.dropoff || formData.date || formData.customerEmail || step > 1;
    if (hasData) {
      const now = Date.now();
      const draft = {
        formData,
        step,
        appliedCoupon,
        distance,
        duration,
        distanceValue,
        pickupCoords,
        dropoffCoords,
        waypointCoords,
        directions,
        lastUpdated: now
      };
      localStorage.setItem('booking_progress_auto', JSON.stringify(draft));
      setLastSaved(now);
    }
  }, [formData, step, appliedCoupon, distance, duration, distanceValue, pickupCoords, dropoffCoords, waypointCoords, directions]);

  // Restore progress on mount
  useEffect(() => {
    const saved = localStorage.getItem('booking_progress_auto');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        // Progress expires after 24 hours
        if (Date.now() - (data.lastUpdated || 0) < 24 * 60 * 60 * 1000) {
          setFormData(prev => ({
            ...prev,
            ...data.formData,
            // Keep current password if user was typing one, or ignore saved password for security
            customerPassword: prev.customerPassword 
          }));
          setStep(data.step || 1);
          if (data.appliedCoupon) setAppliedCoupon(data.appliedCoupon);
          if (data.distance) setDistance(data.distance);
          if (data.duration) setDuration(data.duration);
          if (data.distanceValue) setDistanceValue(data.distanceValue);
          if (data.pickupCoords) setPickupCoords(data.pickupCoords);
          if (data.dropoffCoords) setDropoffCoords(data.dropoffCoords);
          if (data.waypointCoords) setWaypointCoords(data.waypointCoords);
          if (data.directions) setDirections(data.directions);
          setLastSaved(data.lastUpdated || null);
        }
      } catch (e) {
        console.error("Failed to restore progress:", e);
      }
    }
  }, [setFormData, setStep, setDistance, setDuration, setAppliedCoupon, setDistanceValue, setPickupCoords, setDropoffCoords, setWaypointCoords, setDirections]);

  useEffect(() => {
    const savedData = localStorage.getItem('booking_draft');
    const isCancelled = new URLSearchParams(location.search).get('cancelled');
    if (savedData && !isCancelled) {
      try {
        const data = JSON.parse(savedData);
        setFormData(data.formData);
        setStep(data.step);
        if (data.appliedCoupon) setAppliedCoupon(data.appliedCoupon);
        if (data.distance) setDistance(data.distance);
        if (data.duration) setDuration(data.duration);
        // Clean up
        localStorage.removeItem('booking_draft');
      } catch (err) {
        console.error('Failed to restore booking draft:', err);
      }
    }
  }, [location.search, setFormData, setStep, setDistance, setDuration, setAppliedCoupon]);

  // Route Avoidance options
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [avoidFerries, setAvoidFerries] = useState(false);

  // Geocode address when it changes manually to update map pins

  const handleLogin = async (e: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showNotice('warning', "Please enter your email and password", 'Required Fields');
      return;
    }

    setIsLoggingIn(true);
    setNotice(null);
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      setShowLoginFields(false);
      setLoginEmail("");
      setLoginPassword("");
      showNotice('success', "Logged in successfully!", 'Welcome');
    } catch (err: any) {
      console.error("Login Error:", err);
      showNotice('error', err.message || "Failed to log in. Please check your credentials.", 'Login Error');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const calculatePrice = useCallback(
    (vehicleId: string) => {
      const vehicle = fleet.find((v) => v.id === vehicleId);
      if (!vehicle)
        return {
          base: 0,
          distance: 0,
          waypoints: 0,
          returnPrice: 0,
          extras: 0,
          tax: 0,
          discount: 0,
          stripe: 0,
          net: 0,
          gross: 0,
          total: 0,
          addonTotal: 0,
          appliedAddons: [],
          rangeCalcs: [],
        };

      const distanceKm = parseFloat(distance.replace(/[^\d.]/g, "")) || 0;
      let baseFare = Number(vehicle.basePrice) || 0;
      let distancePrice = 0;
      const rangeCalcs: any[] = [];

      if (formData.serviceType === "hourly") {
        baseFare = 0; // Base price 0 for hourly
        distancePrice =
          (Number(vehicle.hourlyPrice) || 0) * (formData.hours || 1);
        rangeCalcs.push({
          label: "Hourly",
          dist: formData.hours,
          rate: vehicle.hourlyPrice,
          total: distancePrice,
          isHourly: true,
        });
      } else {
        distancePrice = Number(vehicle.distanceKm) || 0;

        // Add KM-based surcharge if ranges exist
        if (vehicle.kmRanges && vehicle.kmRanges.length > 0) {
          if (settings?.distanceCalculationType === "type2") {
            // Type 2: Cumulative (Each range segment has its own rate)
            let previousMax = 0;
            for (const r of vehicle.kmRanges) {
              if (r.label.includes("+")) {
                const min = parseFloat(r.label.replace("+", ""));
                if (distanceKm >= min) {
                  const balance = distanceKm - previousMax;
                  const segmentTotal = balance * Number(r.surcharge);
                  distancePrice += segmentTotal;
                  rangeCalcs.push({
                    label: r.label,
                    dist: balance,
                    rate: r.surcharge,
                    total: segmentTotal,
                  });
                  break;
                }
              } else {
                const [min, max] = r.label.split("-").map(Number);
                if (distanceKm > max) {
                  const segment = max - previousMax;
                  const segmentTotal = segment * Number(r.surcharge);
                  distancePrice += segmentTotal;
                  rangeCalcs.push({
                    label: r.label,
                    dist: segment,
                    rate: r.surcharge,
                    total: segmentTotal,
                  });
                  previousMax = max;
                } else if (distanceKm >= min && distanceKm <= max) {
                  const balance = distanceKm - previousMax;
                  const segmentTotal = balance * Number(r.surcharge);
                  distancePrice += segmentTotal;
                  rangeCalcs.push({
                    label: r.label,
                    dist: balance,
                    rate: r.surcharge,
                    total: segmentTotal,
                  });
                  break;
                }
              }
            }
          } else {
            // Type 1: Total Distance * Rate of the range it falls into
            let selectedRange = null;
            for (const r of vehicle.kmRanges) {
              if (r.label.includes("+")) {
                const min = parseFloat(r.label.replace("+", ""));
                if (distanceKm >= min) {
                  selectedRange = r;
                  break;
                }
              } else {
                const [min, max] = r.label.split("-").map(Number);
                if (distanceKm >= min && distanceKm <= max) {
                  selectedRange = r;
                  break;
                }
              }
            }
            if (selectedRange) {
              const totalSurcharge =
                distanceKm * Number(selectedRange.surcharge);
              distancePrice += totalSurcharge;
              rangeCalcs.push({
                label: selectedRange.label,
                dist: distanceKm,
                rate: selectedRange.surcharge,
                total: totalSurcharge,
              });
            }
          }
        }
      }

      // Waypoint Price
      const waypointCount = formData.waypoints.filter(
        (wp) => wp.length > 5,
      ).length;
      const waypointPriceTotal =
        waypointCount * (Number(settings?.waypointPrice) || 0);

      // Extras Price
      const extrasPrice = formData.selectedExtras.reduce((sum, extraId) => {
        const extra = extras.find((e) => e.id === extraId);
        return sum + (Number(extra?.price) || 0);
      }, 0);

      const returnPrice = formData.isReturn
        ? baseFare + distancePrice + waypointPriceTotal
        : 0;
      let subtotal = baseFare + distancePrice + waypointPriceTotal;

      // Return trip logic (Double the price except extras)
      if (formData.isReturn) {
        subtotal *= 2;
      }

      subtotal += extrasPrice;

      // Apply coupon discount
      let discount = 0;
      if (appliedCoupon) {
        if (appliedCoupon.type === "percentage") {
          discount = subtotal * (appliedCoupon.value / 100);
        } else {
          discount = appliedCoupon.value;
        }
      }

      const netPrice = Math.max(0, subtotal - discount);

      // Add tax
      let tax = 0;
      if (settings?.taxPercentage) {
        tax = netPrice * (Number(settings.taxPercentage) / 100);
      }

      let stripeFees = 0;
      if (paymentMethod === "card") {
        const feePercent = Number(settings?.stripeFeePercentage) || 4.0;
        stripeFees = (netPrice + tax) * (feePercent / 100);
      }

      const totalBeforeAddons = Number((netPrice + tax + stripeFees).toFixed(2));

      // Applied Add-ons logic
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

        // 1. Page validation
        if (addon.applyToBooking === false) return;

        // 1.5 Activation Date Range verification (auto-deactivates dynamically)
        if (addon.activeStartDate || addon.activeEndDate) {
          const todayLocal = new Date().toISOString().split("T")[0];
          if (addon.activeStartDate && todayLocal < addon.activeStartDate) return;
          if (addon.activeEndDate && todayLocal > addon.activeEndDate) return;
        }

        const satisfyDetails: string[] = [];
        const ruleResults: { matched: boolean; details: string[] }[] = [];

        // 2. Location restriction (Bounding Box GPS coordinates)
        if (addon.limitLocation) {
          const checkBBoxLocation = (lat: number, lng: number) => {
            // First check multiple bboxes if defined and non-empty
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
            // Fallback to single bbox fields
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
          const checkDate = (d: string) => {
            if (!d) return false;
            if (addon.startDate && d < addon.startDate) return false;
            if (addon.endDate && d > addon.endDate) return false;
            return true;
          };
          const matchP = checkDate(formData.date);
          const matchR = formData.isReturn ? checkDate(formData.returnDate) : false;

          const checkedDates: string[] = [];
          if (matchP) checkedDates.push(formData.date);
          if (matchR) checkedDates.push(formData.returnDate);

          ruleResults.push({
            matched: matchP || matchR,
            details: (matchP || matchR) ? [`${checkedDates.join(", ")} (Validity: ${addon.startDate} to ${addon.endDate})`] : []
          });
        }

        // 4. Time restriction
        if (addon.limitTime) {
          const checkTime = (timeStr: string) => {
            if (!timeStr) return false;
            const start = addon.startTime || "";
            const end = addon.endTime || "";
            if (start && end) {
              if (start > end) {
                // Overnight window (e.g., 22:00 - 05:00)
                return timeStr >= start || timeStr <= end;
              } else {
                // Standard single-day window (e.g., 08:00 - 17:00)
                return timeStr >= start && timeStr <= end;
              }
            } else if (start) {
              return timeStr >= start;
            } else if (end) {
              return timeStr <= end;
            }
            return true;
          };
          const matchP = checkTime(formData.time);
          const matchR = formData.isReturn ? checkTime(formData.returnTime) : false;
          
          let timeMatch = false;
          const target = addon.timeTarget || "any";
          if (target === "pickup") {
            timeMatch = matchP;
          } else if (target === "return") {
            timeMatch = formData.isReturn ? matchR : false;
          } else if (target === "both") {
            timeMatch = formData.isReturn ? (matchP && matchR) : matchP;
          } else {
            // "any" state
            timeMatch = formData.isReturn ? (matchP || matchR) : matchP;
          }

          const checkedTimes: string[] = [];
          if (matchP && (target === "pickup" || target === "any" || target === "both")) {
            checkedTimes.push(formatTimeString(formData.time));
          }
          if (matchR && (target === "return" || target === "any" || target === "both")) {
            checkedTimes.push(formatTimeString(formData.returnTime));
          }

          ruleResults.push({
            matched: timeMatch,
            details: timeMatch ? [`${checkedTimes.join(", ")} (Range: ${addon.startTime} - ${addon.endTime})`] : []
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
          const matchP = checkDay(formData.date);
          const matchR = formData.isReturn ? checkDay(formData.returnDate) : false;

          const satisfiedDays: string[] = [];
          const getDayName = (d: string) => {
            try {
              const parsedDate = new Date(d.replace(/-/g, "/"));
              return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][parsedDate.getDay()];
            } catch (_) { return ""; }
          };
          if (matchP) satisfiedDays.push(getDayName(formData.date));
          if (matchR) satisfiedDays.push(getDayName(formData.returnDate));

          ruleResults.push({
            matched: matchP || matchR,
            details: (matchP || matchR) ? [`${satisfiedDays.join(", ")}`] : []
          });
        }

        // 6. Fleet restriction
        if (addon.limitFleet) {
          const fleetList = addon.selectedFleet || [];
          const matched = !!vehicle && (fleetList.includes(vehicle.name) || fleetList.includes(vehicle.id));
          ruleResults.push({
            matched,
            details: matched && vehicle ? [`${vehicle.name}`] : []
          });
        }

        // 7. Service restriction
        if (addon.limitService) {
          const serviceList = addon.selectedServices || [];
          const matched = !!formData.serviceType && serviceList.includes(formData.serviceType);
          ruleResults.push({
            matched,
            details: matched ? [`${formData.serviceType}`] : []
          });
        }

        // 8. One-way / Return ride restriction
        if (addon.limitRideType) {
          const targetType = addon.rideTypeTarget || "any";
          let matched = true;
          if (targetType === "oneway" && formData.isReturn) matched = false;
          if (targetType === "return" && !formData.isReturn) matched = false;
          ruleResults.push({
            matched,
            details: matched ? [`${formData.isReturn ? "Return" : "One-Way"}`] : []
          });
        }

        // 9. Extra additions / Add-ons restriction
        if (addon.limitExtras) {
          const matchedExtrasList = (addon.selectedExtras || []) as string[];
          const selectedExtrasList = (formData.selectedExtras || []) as string[];
          const matched = selectedExtrasList.some(id => {
            const extraObj = extras.find(e => e.id === id);
            return matchedExtrasList.includes(id) || (extraObj && matchedExtrasList.includes(extraObj.name));
          });
          const matchedDetailsText = selectedExtrasList
            .map(id => {
              const extraObj = extras.find(e => e.id === id);
              if (matchedExtrasList.includes(id) || (extraObj && matchedExtrasList.includes(extraObj.name))) {
                return extraObj?.name || "Extra";
              }
              return null;
            })
            .filter(Boolean) as string[];

          ruleResults.push({
            matched,
            details: matched ? matchedDetailsText : []
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

        let baseValue = 0;
        if (addon.target === "gross") baseValue = subtotal;
        else if (addon.target === "net") baseValue = netPrice;
        else if (addon.target === "total") baseValue = totalBeforeAddons;

        let value = 0;
        if (addon.type === "percentage") {
          value = baseValue * (addon.value / 100);
        } else {
          value = addon.value;
        }

        const impact = addon.operation === "addition" ? value : -value;
        addonTotal += impact;
        appliedAddons.push({
          id: addon.id,
          name: addon.name,
          impact: Number(impact.toFixed(2)),
          target: addon.target,
          type: addon.type,
          value: addon.value,
          operation: addon.operation,
          hideLabelInBreakdown: !!addon.hideLabelInBreakdown,
          hideSatisfyDetails: !!addon.hideSatisfyDetails,
          satisfyDetails
        });
      });

      const finalTotal = Number((totalBeforeAddons + addonTotal).toFixed(2));

      return {
        base: Number(baseFare.toFixed(2)),
        distance: Number(distancePrice.toFixed(2)),
        waypoints: Number(waypointPriceTotal.toFixed(2)),
        returnPrice: Number(returnPrice.toFixed(2)),
        extras: Number(extrasPrice.toFixed(2)),
        tax: Number(tax.toFixed(2)),
        discount: Number(discount.toFixed(2)),
        stripe: Number(stripeFees.toFixed(2)),
        net: Number(netPrice.toFixed(2)),
        gross: Number(subtotal.toFixed(2)),
        total: finalTotal,
        addonTotal: Number(addonTotal.toFixed(2)),
        appliedAddons: appliedAddons,
        rangeCalcs: rangeCalcs,
      };
    },
    [
      fleet,
      extras,
      distance,
      settings,
      formData.serviceType,
      formData.hours,
      formData.isReturn,
      formData.selectedExtras,
      formData.waypoints,
      appliedCoupon,
      paymentMethod,
      priceAddons,
      pickupCoords,
      dropoffCoords,
      formData.date,
      formData.time,
      formData.returnDate,
      formData.returnTime,
    ],
  );

  // Filter State
  const [typeFilter, setTypeFilter] = useState("all");
  const [paxFilter, setPaxFilter] = useState(0);
  const [bagsFilter, setBagsFilter] = useState(0);
  const [priceSort, setPriceSort] = useState<"asc" | "desc" | null>("asc");

  const filteredFleet = useMemo(() => {
    let result = fleet.length > 0 ? [...fleet] : [...vehicles];

    if (typeFilter !== "all") {
      result = result.filter(
        (v) =>
          v.id.includes(typeFilter) ||
          v.name.toLowerCase().includes(typeFilter.toLowerCase()),
      );
    }

    if (paxFilter > 0) {
      result = result.filter((v) => v.pax >= paxFilter);
    }

    if (bagsFilter > 0) {
      result = result.filter((v) => v.bags >= bagsFilter);
    }

    if (priceSort) {
      result.sort((a, b) => {
        const priceA = calculatePrice(a.id).total;
        const priceB = calculatePrice(b.id).total;
        return priceSort === "asc" ? priceA - priceB : priceB - priceA;
      });
    }

    return result;
  }, [fleet, typeFilter, paxFilter, bagsFilter, priceSort, calculatePrice]);

  const [debouncedPickup, setDebouncedPickup] = useState(formData.pickup);
  const [debouncedDropoff, setDebouncedDropoff] = useState(formData.dropoff);
  const [debouncedWaypoints, setDebouncedWaypoints] = useState(formData.waypoints);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPickup(formData.pickup);
      setDebouncedDropoff(formData.dropoff);
      setDebouncedWaypoints(formData.waypoints);
    }, 500);
    return () => clearTimeout(timer);
  }, [formData.pickup, formData.dropoff, formData.waypoints]);

  // Geocode address when it changes manually to update map pins
  useEffect(() => {
    if (!isLoaded || !debouncedPickup || debouncedPickup.length < 5) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: debouncedPickup }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const location = results[0].geometry.location;
        const coords = { lat: location.lat(), lng: location.lng() };
        setPickupCoords(coords);
        setMapCenter(coords);
        setMapZoom(16);
      }
    });
  }, [debouncedPickup, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !debouncedDropoff || debouncedDropoff.length < 5) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: debouncedDropoff }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const location = results[0].geometry.location;
        const coords = { lat: location.lat(), lng: location.lng() };
        setDropoffCoords(coords);
        setMapCenter(coords);
        setMapZoom(16);
      }
    });
  }, [debouncedDropoff, isLoaded]);

  useEffect(() => {
    if (!isLoaded || !debouncedWaypoints || debouncedWaypoints.length === 0) return;

    const geocoder = new google.maps.Geocoder();
    debouncedWaypoints.forEach((wp, idx) => {
      if (wp && wp.length >= 5) {
        geocoder.geocode({ address: wp }, (results, status) => {
          if (status === "OK" && results?.[0]) {
            const location = results[0].geometry.location;
            const coords = { lat: location.lat(), lng: location.lng() };
            setWaypointCoords(prev => ({ ...prev, [idx]: coords }));
            setMapCenter(coords);
            setMapZoom(16);
          }
        });
      }
    });
  }, [debouncedWaypoints, isLoaded]);

  useEffect(() => {
    const fetchFleet = async () => {
      try {
        const fleetSnap = await getDocs(collection(db, "fleet"));
        setFleet(fleetSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error("Error fetching fleet:", err);
      }
    };

    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, "settings", "system"));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };

    const fetchCoupons = async () => {
      try {
        const couponsSnap = await getDocs(collection(db, "coupons"));
        setCoupons(
          couponsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
        );
      } catch (err) {
        console.error("Error fetching coupons:", err);
      }
    };

    const fetchExtras = async () => {
      try {
        const extrasSnap = await getDocs(
          query(collection(db, "extras"), where("active", "==", true)),
        );
        setExtras(
          extrasSnap.docs.map((doc) => ({
            id: doc.id,
            ...(doc.data() as any),
          })),
        );
      } catch (err) {
        console.error("Error fetching extras:", err);
      }
    };

    const fetchPriceAddons = async () => {
      const path = "price-addons";
      try {
        const addonsSnap = await getDocs(
          query(collection(db, path), where("active", "==", true)),
        );
        setPriceAddons(
          addonsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, path);
      }
    };

    fetchFleet();
    fetchSettings();
    fetchCoupons();
    fetchExtras();
    fetchPriceAddons();
  }, []);

  useEffect(() => {
    if (settings) {
      if (settings.allowStripeCardPayment === false && settings.allowCashPayment !== false && paymentMethod === "card") {
        setPaymentMethod("cash");
      } else if (settings.allowCashPayment === false && settings.allowStripeCardPayment !== false && paymentMethod === "cash") {
        setPaymentMethod("card");
      }
    }
  }, [settings, paymentMethod]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchUserDetails = async () => {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setFormData((prev) => ({
              ...prev,
              customerName: userData.name || user.displayName || prev.customerName || "",
              customerEmail: userData.email || user.email || prev.customerEmail || "",
              customerPhone: userData.phone || prev.customerPhone || "",
            }));
          }
        } catch (err) {
          console.error("Error fetching user details:", err);
        }
      };
      fetchUserDetails();
    }
  }, [user]);

  const minDate = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD format

  const minTime = useMemo(() => {
    if (formData.date === minDate) {
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      if (sixHoursLater.toLocaleDateString("en-CA") > minDate) {
        return "23:59";
      }
      return sixHoursLater.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return undefined;
  }, [formData.date, minDate]);

  const nextStep = () => {
    setNotice(null);
    if (step === 2) {
      const isDropoffRequired = formData.serviceType !== "hourly";
      
      // Check if pickup and dropoff are the same
      if (isDropoffRequired && formData.pickup && formData.dropoff && 
          formData.pickup.trim().toLowerCase() === formData.dropoff.trim().toLowerCase()) {
        showNotice('error', "Pickup and Drop-off locations cannot be the same address.", 'Address Error');
        return;
      }

      if (
        !formData.pickup ||
        (isDropoffRequired && !formData.dropoff) ||
        !formData.date ||
        !formData.time
      ) {
        showNotice('warning', "Please fill in all required fields", 'Required Info');
        return;
      }

      const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

      if (selectedDateTime < now) {
        showNotice('warning', "The selected date and time have already passed. Please choose a future time.", 'Time Error');
        return;
      }

      if (selectedDateTime < sixHoursLater) {
        showNotice('warning', "For operational reasons, bookings must be made at least 6 hours in advance. Please choose a later time.", 'Time Restriction');
        return;
      }

      let distanceKm = distanceValue || parseFloat(distance.replace(/[^\d.]/g, "")) || 0;

      // If return trip, double the distance for validation against limits
      if (formData.isReturn) {
        distanceKm = distanceKm * 2;
      }

      console.log("Validating distance (km):", distanceKm);

      // If service is not hourly, distance calculation is required
      if (formData.serviceType !== "hourly") {
        if (!distance && distanceValue === 0) {
          showNotice('warning', "Calculating distance... Please wait for the map to update.", 'Distance Required');
          return;
        }
        
        if (distanceKm <= 0) {
          showNotice('error', "Distance cannot be 0 km. Please ensure your pickup and drop-off points are valid. (Min KM Restriction)", 'Distance Error');
          return;
        }

        const activeSettings = settings || contextSettings;
        const minKm = Number(activeSettings?.minKm) || 0;
        const maxKm = Number(activeSettings?.maxKm) || 0;

        if (minKm > 0 && distanceKm < minKm) {
          showNotice('warning', `Minimum distance for booking is ${minKm} km. Your current distance is ${distanceKm.toFixed(1)} km.`, 'Distance Restriction');
          return;
        }

        if (maxKm > 0 && distanceKm > maxKm) {
          showNotice('warning', `Maximum distance for booking is ${maxKm} km. Your current distance is ${distanceKm.toFixed(1)} km.`, 'Distance Restriction');
          return;
        }
      }

      // Pickup hours constraints - General
      if (formData.serviceType !== 'hourly' && settings?.pickupHoursStart && settings?.pickupHoursEnd) {
        const checkTime = formData.time; // HH:mm
        if (checkTime < settings.pickupHoursStart || checkTime > settings.pickupHoursEnd) {
          showNotice('warning', `Standard Service is only available between ${settings.pickupHoursStart} and ${settings.pickupHoursEnd}.`, 'Time Restriction');
          return;
        }
      }

      // Hourly specific pickup hours constraints
      if (formData.serviceType === 'hourly' && settings?.hourlyPickHoursStart && settings?.hourlyPickHoursEnd) {
        const checkTime = formData.time; // HH:mm
        if (checkTime < settings.hourlyPickHoursStart || checkTime > settings.hourlyPickHoursEnd) {
          showNotice('warning', `Hourly Service is only available between ${settings.hourlyPickHoursStart} and ${settings.hourlyPickHoursEnd}.`, 'Time Restriction');
          return;
        }
      }
    }
    setStep((s) => Math.min(s + 1, 4));
  };
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  useEffect(() => {
    if (settings && formData.serviceType === 'hourly') {
      const min = settings.hourlyMinHours || 1;
      if (formData.hours < min) {
        updateForm('hours', min);
      }
    }
  }, [settings, formData.serviceType]);

  const updateForm = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field === "pickup" || field === "dropoff") {
      if (value !== "") {
        setNotice(null);
      }
      setDirections(null);
      setDistance("");
      setDuration("");
      setDistanceValue(0);
    }
  };

  const [mapCenter, setMapCenter] = useState(center);
  const [mapZoom, setMapZoom] = useState(12);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isSelectingOnMap, setIsSelectingOnMap] = useState<string | null>(null);

  const validateZipCode = useCallback((placeOrComponents: google.maps.places.PlaceResult | google.maps.GeocoderAddressComponent[]) => {
    if (!settings?.limitZipCode) return true;

    let postalCode = "";
    if (Array.isArray(placeOrComponents)) {
      postalCode = placeOrComponents.find(c => c.types.includes('postal_code'))?.long_name || "";
    } else {
      postalCode = placeOrComponents.address_components?.find(c => c.types.includes('postal_code'))?.long_name || "";
    }

    if (!postalCode) return true;

    const limit = settings.limitZipCode.trim();
    if (limit.includes('-')) {
      const parts = limit.split('-');
      const start = parseInt(parts[0].trim());
      const end = parseInt(parts[1].trim());
      const pcInt = parseInt(postalCode);

      if (!isNaN(pcInt) && !isNaN(start) && !isNaN(end)) {
        if (pcInt < start || pcInt > end) {
          showNotice('error', `Service is restricted to zip codes ${start} - ${end}`, 'Area Restricted');
          return false;
        }
      }
    } else {
      if (postalCode !== limit) {
        showNotice('error', `Service is currently only available in zip code ${limit}`, 'Area Restricted');
        return false;
      }
    }
    return true;
  }, [settings?.limitZipCode]);

  const handleGeolocation = async (field: string) => {
    if (!navigator.geolocation) {
      showNotice('error', "Geolocation is not supported by your browser", 'Location Error');
      return;
    }

    showNotice('info', "Finding your location...", 'Locating');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setMapCenter({ lat: latitude, lng: longitude });
        setMapZoom(16);

        if (!window.google || !window.google.maps || !isLoaded) {
          showNotice('error', "Maps service not fully loaded. Try again.", 'Error');
          return;
        }
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ location: { lat: latitude, lng: longitude } }, (results, status) => {
          if (status === "OK" && results && results[0]) {
            const address = results[0].formatted_address;
            const location = results[0].geometry.location;
            const coords = { lat: location.lat(), lng: location.lng() };

            if (!validateZipCode(results[0].address_components || [])) {
              return;
            }

            if (field.startsWith('waypoint-')) {
              const idx = parseInt(field.split('-')[1]);
              const newWps = [...formData.waypoints];
              newWps[idx] = address;
              updateForm("waypoints", newWps);
            } else {
              updateForm(field, address);
              if (field === "pickup") {
                setDebouncedPickup(address);
                setPickupCoords(coords);
              } else if (field === "dropoff") {
                setDebouncedDropoff(address);
                setDropoffCoords(coords);
              }
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

  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent & { placeId?: string }) => {
    if (!isSelectingOnMap) return;

    if (e.placeId) {
      // It's a POI click! Use PlacesService to get name and address
      const service = new google.maps.places.PlacesService(document.createElement('div'));
      service.getDetails({ placeId: e.placeId }, (result, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && result) {
          const address = result.formatted_address || "";
          const name = result.name || "";
          const finalValue = name && !address.startsWith(name) ? `${name}, ${address}` : address;
          const location = result.geometry?.location;
          const coords = location ? { lat: location.lat(), lng: location.lng() } : null;

          if (!validateZipCode(result)) return;

          if (isSelectingOnMap.startsWith('waypoint-')) {
            const idx = parseInt(isSelectingOnMap.split('-')[1]);
            const newWps = [...formData.waypoints];
            newWps[idx] = finalValue;
            updateForm("waypoints", newWps);
          } else {
            updateForm(isSelectingOnMap, finalValue);
            if (isSelectingOnMap === "pickup") {
              setDebouncedPickup(finalValue);
              if (coords) setPickupCoords(coords);
            } else if (isSelectingOnMap === "dropoff") {
              setDebouncedDropoff(finalValue);
              if (coords) setDropoffCoords(coords);
            }
          }
          showNotice('success', `${name || "Location"} selected!`, 'Success');
          setIsSelectingOnMap(null);
        }
      });
      // Try to prevent default info window
      if (typeof (e as any).stop === 'function') (e as any).stop();
      return;
    }

    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    showNotice('info', "Fetching address for selected point...", 'Geocoding');

    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ location: { lat, lng } }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const address = results[0].formatted_address;
        const coords = { lat, lng };

        if (!validateZipCode(results[0].address_components || [])) {
          return;
        }

        setMapCenter({ lat, lng });
        setMapZoom(16);

        if (isSelectingOnMap.startsWith('waypoint-')) {
          const idx = parseInt(isSelectingOnMap.split('-')[1]);
          const newWps = [...formData.waypoints];
          newWps[idx] = address;
          updateForm("waypoints", newWps);
        } else {
          updateForm(isSelectingOnMap, address);
          if (isSelectingOnMap === "pickup") {
            setDebouncedPickup(address);
            setPickupCoords(coords);
          } else if (isSelectingOnMap === "dropoff") {
            setDebouncedDropoff(address);
            setDropoffCoords(coords);
          }
        }
        showNotice('success', "Location selected!", 'Success');
      } else {
        showNotice('error', "Could not determine address for this point.", 'Geocoding Error');
      }
      setIsSelectingOnMap(null);
    });
  }, [isSelectingOnMap, validateZipCode, formData.waypoints]);

  const directionsCallback = useCallback(
    (
      result: google.maps.DirectionsResult | null,
      status: google.maps.DirectionsStatus,
    ) => {
      if (result !== null) {
        if (status === "OK") {
          setDirections(result);
          const route = result.routes[0];
          let totalDistance = 0;
          let totalDuration = 0;

          route.legs.forEach((leg) => {
            totalDistance += leg.distance?.value || 0;
            totalDuration += leg.duration?.value || 0;
          });

          // Convert meters to km and seconds to mins/hours
          const distanceKmNum = totalDistance / 1000;
          const distanceKm = distanceKmNum.toFixed(1);
          const durationMins = Math.round(totalDuration / 60);

          setDistanceValue(distanceKmNum);
          setDistance(`${distanceKm} km`);
          setDuration(
            durationMins > 60
              ? `${Math.floor(durationMins / 60)} h ${durationMins % 60} min`
              : `${durationMins} min`,
          );
          setNotice(null);
        } else {
          // Only log critical errors, ignore NOT_FOUND/ZERO_RESULTS as they are handled in UI
          if (status !== "NOT_FOUND" && status !== "ZERO_RESULTS") {
            console.error("Directions request failed:", status);
          }

          if (status === "ZERO_RESULTS") {
            showNotice('error', "No driving route found between these locations.", 'Distance Error');
          } else if (status === "NOT_FOUND") {
            showNotice('error', "One of the addresses could not be found. Please check your entry.", 'Location Not Found');
          } else {
            showNotice('error', "Could not calculate directions. Please try a different address.", 'API Error');
          }
          setDirections(null);
          setDistance("");
          setDuration("");
          setDistanceValue(0);
        }
      }
    },
    [],
  );

  const directionsOptions = useMemo(() => {
    const hasPickup = debouncedPickup && debouncedPickup.length >= 5;
    const hasDropoff = debouncedDropoff && debouncedDropoff.length >= 5;
    const hasWaypoints = formData.waypoints.some(wp => wp.length >= 5);

    // Only fetch directions if we have origin AND (destination OR waypoints)
    if (!hasPickup || (!hasDropoff && !hasWaypoints)) return null;

    const waypoints = formData.waypoints
      .filter((wp) => wp.length > 5)
      .map((wp) => ({ location: wp, stopover: true }));

    // If no dropoff but have waypoints, we treat the last waypoint as destination or just don't draw route if that's preferred.
    // However, usually "2+ points" means we should try to route.
    // If no dropoff, we can use the last waypoint as the destination for the directions service.

    let destination = debouncedDropoff;
    let finalWaypoints = [...waypoints];

    if (!hasDropoff && hasWaypoints) {
      const validWaypoints = formData.waypoints.filter(wp => wp.length > 5);
      destination = validWaypoints[validWaypoints.length - 1];
      finalWaypoints = validWaypoints.slice(0, -1).map(wp => ({ location: wp, stopover: true }));
    }

    if (!destination) return null;

    return {
      destination: destination,
      origin: debouncedPickup,
      waypoints: finalWaypoints,
      travelMode: "DRIVING" as google.maps.TravelMode,
      avoidTolls: avoidTolls,
      avoidHighways: avoidHighways,
      avoidFerries: avoidFerries,
    };
  }, [debouncedPickup, debouncedDropoff, formData.waypoints, avoidTolls, avoidHighways, avoidFerries]);

  const handleValidateCoupon = () => {
    if (!formData.couponCode) return;
    setIsValidatingCoupon(true);
    setCouponError(null);
    setAppliedCoupon(null);

    const coupon = coupons.find(
      (c) => c.code.toUpperCase() === formData.couponCode.toUpperCase(),
    );

    if (!coupon) {
      setCouponError("Invalid coupon code");
      setIsValidatingCoupon(false);
      return;
    }

    if (!coupon.active) {
      setCouponError("This coupon is no longer active");
      setIsValidatingCoupon(false);
      return;
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      setCouponError("This coupon is not yet valid");
      setIsValidatingCoupon(false);
      return;
    }

    if (coupon.endDate && new Date(coupon.endDate) < now) {
      setCouponError("This coupon has expired");
      setIsValidatingCoupon(false);
      return;
    }

    if (coupon.usageLimit > 0 && (coupon.usedCount || 0) >= coupon.usageLimit) {
      setCouponError("This coupon has reached its usage limit");
      setIsValidatingCoupon(false);
      return;
    }

    if (
      coupon.serviceIds?.length > 0 &&
      !coupon.serviceIds.includes(formData.serviceType)
    ) {
      setCouponError("This coupon is not valid for the selected service");
      setIsValidatingCoupon(false);
      return;
    }

    setAppliedCoupon(coupon);
    setIsValidatingCoupon(false);
  };

  const availableCoupons = useMemo(() => {
    const now = new Date();
    return coupons.filter((c) => {
      const isDateValid =
        (!c.startDate || new Date(c.startDate) <= now) &&
        (!c.endDate || new Date(c.endDate) >= now);
      const isUsageValid =
        !c.usageLimit || (c.usedCount || 0) < c.usageLimit;
      const isServiceValid =
        !c.serviceIds ||
        c.serviceIds.length === 0 ||
        c.serviceIds.includes(formData.serviceType);
      return c.active && isDateValid && isUsageValid && isServiceValid;
    });
  }, [coupons, formData.serviceType]);

  const handleApplyCouponFromList = (code: string) => {
    updateForm("couponCode", code);
    // We need to wait for state update or pass it directly. 
    // Since updateForm is async-ish state update, we'll manually find and apply.
    const coupon = coupons.find((c) => c.code.toUpperCase() === code.toUpperCase());
    if (coupon) {
      setAppliedCoupon(coupon);
      setCouponError(null);
    }
  };

  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    setNotice(null);

    try {
      let currentUserId = user?.uid;

      // Handle User Registration if not logged in
      if (!user) {
        if (!formData.customerPassword || formData.customerPassword.length < 6) {
          throw new Error(
            "Please provide a password (min 6 characters) to create your account.",
          );
        }

        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            formData.customerEmail,
            formData.customerPassword,
          );
          currentUserId = userCredential.user.uid;

          // Create user document
          await setDoc(doc(db, "users", currentUserId), {
            id: currentUserId,
            name: formData.customerName,
            email: formData.customerEmail.toLowerCase(),
            phone: formData.customerPhone,
            role: "customer",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (authErr: any) {
          if (authErr.code === "auth/email-already-in-use") {
            throw new Error(
              "This email is already registered. Please log in first.",
            );
          }
          throw authErr;
        }
      }

      const priceDetails = calculatePrice(formData.vehicle);
      const totalPrice = priceDetails.total;
      const selectedVehicle =
        fleet.find((v) => v.id === formData.vehicle) ||
        vehicles.find((v) => v.id === formData.vehicle);

      const bookingData: any = {
        serviceType: formData.serviceType,
        pickup: formData.pickup,
        dropoff: formData.dropoff,
        waypoints: formData.waypoints.filter((wp) => wp.length > 5),
        date: formData.date,
        time: formData.time,
        isReturn: formData.isReturn,
        returnDate: formData.returnDate || null,
        returnTime: formData.returnTime || null,
        hours: formData.hours || null,
        purpose: formData.purpose || "",
        vehicleId: formData.vehicle,
        price: totalPrice,
        priceBreakdown: priceDetails,
        status: "pending",
        flightNumber: formData.flightNumber,
        passengers: formData.passengers,
        distance: distance,
        duration: duration,
        paymentStatus: "unpaid",
        paymentMethod: paymentMethod,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail.toLowerCase(),
        customerPhone: formData.customerPhone,
        couponCode: appliedCoupon?.code || null,
        selectedExtras: formData.selectedExtras,
        userId: currentUserId,
      };

      if (paymentMethod === "card") {
        // Create Stripe Checkout Session
        // Save draft for restoration if cancelled
        localStorage.setItem('booking_draft', JSON.stringify({
          formData,
          step,
          appliedCoupon,
          distance,
          duration
        }));
        
        // Also ensure current auto-save is updated before redirect
        localStorage.setItem('booking_progress_auto', JSON.stringify({
          formData,
          step,
          appliedCoupon,
          distance,
          duration,
          lastUpdated: Date.now()
        }));

        const response = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingData,
            vehicleName: selectedVehicle?.name,
            cancelUrl: `${window.location.origin}${window.location.pathname}?cancelled=true`
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || "Failed to create checkout session",
          );
        }

        const { url } = await response.json();

        if (url) {
          window.location.href = url;
        } else {
          throw new Error("No checkout URL received");
        }
      } else {
        // Cash on Pickup - Create booking directly in Firestore
        try {
          const docRef = await addDoc(collection(db, "bookings"), {
            ...bookingData,
            read: false,
            createdAt: serverTimestamp(),
          });

          // Trigger Notifications
          const [{ smsService }, { emailService }] = await Promise.all([
            import("../services/smsService"),
            import("../services/emailService")
          ]);
          smsService.notify("booking_created", { ...bookingData, id: docRef.id });
          emailService.notify("booking_created", { ...bookingData, id: docRef.id });

          // Update coupon usage if applicable
          if (appliedCoupon) {
            await updateDoc(doc(db, "coupons", appliedCoupon.id), {
              usedCount: (appliedCoupon.usedCount || 0) + 1,
            });
          }

          // Clear progress after successful cash booking
          localStorage.removeItem('booking_progress_auto');
          localStorage.removeItem('booking_draft');

          navigate(`/payment/success?booking_id=${docRef.id}&method=cash`);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, "bookings");
        }
      }
    } catch (err: any) {
      console.error("Booking error:", err);
      showNotice('error', err.message || "An unexpected error occurred. Please try again.", 'Finalization Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="pt-20 pb-24 min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-red-500 flex items-center gap-2">
          <AlertCircle size={24} />
          <span>Error loading Google Maps. Please try again later.</span>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="pt-20 pb-24 min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" size={48} />
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Book Your Chauffeur Service"
        description="Secure your luxury transport in Melbourne. Easy booking for airport transfers, corporate travel, corporate events, and special occasions."
      />
      <div ref={mainScrollRef} className="pt-20 pb-24 min-h-screen bg-[#050505] overflow-y-auto custom-scrollbar">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-6">
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">
              Reservation
            </span>
            <h1 className="text-4xl md:text-6xl font-display mb-6">
              Book Your Chauffeur
            </h1>

            {/* Progress Bar */}
            <div className="flex justify-between sm:justify-center mt-12 mb-16 w-full max-w-xl mx-auto px-4 relative group/bar">
              {steps.map((s, idx, arr) => {
                const Icon = s.icon;
                const isCompleted = step > s.id;
                const isActive = step === s.id;
                const isNavigable = canNavigateToStep(s.id);
                
                return (
                  <div key={s.id} className="flex-1 flex flex-col items-center xl:flex-row xl:items-center">
                    <div
                      className={cn(
                        "flex items-center gap-2 transition-all duration-300",
                        isNavigable ? "cursor-pointer group" : "cursor-not-allowed opacity-50"
                      )}
                      onClick={() => handleStepClick(s.id)}
                    >
                      {/* Icon circle / squircle */}
                      <div
                        className={cn(
                          "w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-700 border relative",
                          isActive
                            ? "bg-gold text-black border-gold shadow-[0_0_20px_rgba(212,175,55,0.3)] scale-110 rotate-[360deg]"
                            : isCompleted
                              ? "bg-gold/10 text-gold border-gold/30"
                              : "bg-white/5 text-white/20 border-white/10 group-hover:bg-white/10"
                        )}
                      >
                        {isCompleted ? (
                          <CheckCircle size={16}/>
                        ) : (
                          <Icon size={16} className={cn(isActive ? "animate-pulse" : "")} />
                        )}

                        {/* Status ring for active step */}
                        {isActive && (
                          <div className="absolute -inset-1 rounded-xl border border-gold/30 animate-ping opacity-20"></div>
                        )}
                      </div>

                      {/* Desktop label */}
                      <div className="hidden xl:flex flex-col items-start min-w-[60px]">
                        <span className="text-[7px] uppercase tracking-[0.2em] font-bold text-white/30 leading-none mb-0.5">
                          Step {s.id}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] uppercase tracking-[0.25em] font-black transition-colors duration-500",
                            isActive || isCompleted ? "text-gold" : "text-white/20",
                            isNavigable && !isActive ? "group-hover:text-white/80" : ""
                          )}
                        >
                          {s.name}
                        </span>
                      </div>

                      {/* Connector line (desktop only) */}
                      {idx < arr.length - 1 && (
                        <motion.div
                          initial={{ width: "1rem" }}
                          animate={{ width: "2rem" }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={cn("h-[1px] hidden xl:block mx-2", isCompleted ? "bg-gold/30" : "bg-white/5")}
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
                        {s.name}
                      </motion.span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-6 relative">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, scale: 0.98, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -10 }}
                  className="space-y-8"
                >
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-white/[0.05] pb-6">
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl md:text-4xl font-display text-white mb-2">Select Service Class</h2>
                      <p className="text-gold/40 text-[10px] uppercase tracking-[0.4em] font-black">Choose your experience</p>
                    </div>
                    
                    <div className="flex items-center justify-center md:justify-end gap-3">
                      {lastSaved && (
                         <div
                          className="flex items-center gap-2.5 px-4 py-2 rounded-xl border border-gold/10 bg-gold/5 text-gold/50 text-[10px] uppercase tracking-widest font-black shadow-lg"
                        >
                          <div className="relative">
                            <History size={16} />
                            <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-gold animate-pulse"></div>
                          </div>
                          <span>Draft Saved</span>
                          <span className="opacity-40 font-mono text-[9px] lowercase">({new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                        </div>
                      )}
                      <button
                        onClick={handleNewBooking}
                        className="flex items-center gap-2.5 px-4 py-2 rounded-xl border border-red-500/20 bg-red-500/5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-[10px] uppercase tracking-widest font-black shadow-lg group"
                        title="Reset Booking"
                      >
                        <RotateCcw size={16} className="group-hover:rotate-[-45deg] transition-transform" />
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                    {serviceTypes.map((type, idx) => (
                      <motion.button
                        key={type.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        onClick={() => {
                          updateForm("serviceType", type.id);
                          nextStep();
                        }}
                        className={cn(
                          "relative group flex flex-col items-start p-6 md:p-8 rounded-2xl md:rounded-3xl transition-all duration-500 overflow-hidden text-left h-full",
                          formData.serviceType === type.id
                            ? "bg-gold/10 border-gold shadow-[0_0_40px_rgba(212,175,55,0.15)]"
                            : "bg-white/[0.03] border-white/5 hover:bg-white/[0.07] hover:border-white/20 active:scale-[0.98]",
                          "border"
                        )}
                      >
                        {/* Background Ornament */}
                        <div className="absolute -right-4 -bottom-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity duration-500 transform group-hover:scale-110 group-hover:-rotate-12">
                          <type.icon size={120} />
                        </div>

                        {/* Icon Container */}
                        <div className={cn(
                          "w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500",
                          formData.serviceType === type.id
                            ? "bg-gold text-black shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                            : "bg-white/5 text-gold group-hover:bg-gold/10 group-hover:scale-110"
                        )}>
                          <type.icon className="size-6 md:size-8" />
                        </div>

                        <div className="relative z-10">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-display text-xl md:text-2xl text-white group-hover:text-gold transition-colors">{type.name}</h3>
                            <ChevronRight className={cn(
                              "w-5 h-5 transition-transform duration-300",
                              formData.serviceType === type.id ? "text-gold rotate-0 opacity-100" : "text-white/20 -translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100"
                            )} />
                          </div>
                          <p className="text-white/40 text-[13px] leading-relaxed group-hover:text-white/60 transition-colors">{type.desc}</p>
                        </div>

                        {/* Top Accent Line */}
                        <div className={cn(
                          "absolute top-0 left-0 w-2 h-full transition-all duration-500",
                          formData.serviceType === type.id ? "bg-gold scale-y-100" : "bg-gold/0 scale-y-0"
                        )} />
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-[#030303]/40 backdrop-blur-3xl p-5 md:p-10 xl:p-12 rounded-3xl border border-white/[0.05] shadow-[0_25px_60px_rgba(0,0,0,0.85)] grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10 hover:border-white/[0.08] transition-all duration-700 relative overflow-hidden"
                >
                  <div className="lg:col-span-2 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.05] pb-6">
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl md:text-3xl font-display text-white mb-2">Ride Details</h2>
                      <p className="text-gold/40 text-[10px] uppercase tracking-[0.4em] font-black">Configure your journey</p>
                    </div>
                    
                    <div className="flex items-center justify-center md:justify-end gap-3">
                      {lastSaved && (
                        <div
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-gold/10 bg-gold/5 text-gold/50 text-[9px] uppercase tracking-widest font-black"
                        >
                          <div className="relative">
                            <History size={14} />
                            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></div>
                          </div>
                          <span>Draft Saved</span>
                          <span className="opacity-40 font-mono text-[8px] lowercase">({new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                        </div>
                      )}
                      <button
                        onClick={handleNewBooking}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-[9px] uppercase tracking-widest font-black group"
                        title="Reset Booking"
                      >
                        <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="space-y-8 h-full flex flex-col justify-between overflow-y-auto custom-scrollbar pr-2">
                    <div className="grid grid-cols-1 gap-8">
                      {/* Pickup Location */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
                            Pickup Location <span className="text-red-500">*</span>
                          </label>
                        </div>
                        <div className="relative group/input">
                          <MapPin
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40 group-focus-within/input:text-gold transition-colors"
                            size={20}
                          />
                          <div className="relative">
                            <Autocomplete
                              onLoad={(autocomplete) => {
                                autocomplete.addListener("place_changed", () => {
                                  const place = autocomplete.getPlace();
                                  const address = place.formatted_address || "";
                                  const location = place.geometry?.location;
                                  const coords = location ? { lat: location.lat(), lng: location.lng() } : null;

                                  if (address) {
                                    if (!validateZipCode(place)) {
                                      updateForm("pickup", "");
                                      return;
                                    }
                                    updateForm("pickup", address);
                                    setDebouncedPickup(address);
                                    if (coords) {
                                      setPickupCoords(coords);
                                      setMapCenter(coords);
                                      setMapZoom(16);
                                    }
                                    setActiveDropdown(null);
                                  }
                                });
                              }}
                              options={{
                                componentRestrictions: settings?.limitCountry
                                  ? { country: settings.limitCountry }
                                  : undefined,
                                types: ["address"],
                              }}
                            >
                              <input
                                ref={pickupInputRef}
                                type="text"
                                placeholder="Enter airport or address"
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-5 pl-14 pr-14 focus:border-gold/50 focus:bg-white/[0.08] outline-none transition-all text-base placeholder:text-white/20"
                                value={formData.pickup}
                                onChange={(e) => {
                                  updateForm("pickup", e.target.value);
                                  if (e.target.value.length > 2) setActiveDropdown(null);
                                }}
                                onFocus={() => {
                                  if (!formData.pickup) setActiveDropdown("pickup");
                                }}
                              />
                            </Autocomplete>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveDropdown(activeDropdown === "pickup" ? null : "pickup");
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-gold transition-all p-2.5 rounded-full hover:bg-gold/5"
                              title="Location options"
                            >
                              <LocateFixed size={20} />
                            </button>

                            {/* Dropdown Options */}
                            <AnimatePresence>
                              {activeDropdown === "pickup" && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className="absolute left-0 right-0 top-full mt-3 bg-[#0D0D0D] border border-gold/20 rounded-2xl overflow-hidden z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleGeolocation('pickup');
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-4 p-5 hover:bg-gold/10 transition-all border-b border-white/5 group/opt"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center group-hover/opt:bg-gold group-hover/opt:text-black transition-all">
                                      <LocateFixed size={18} className="text-gold group-hover/opt:text-black" />
                                    </div>
                                    <div className="text-left">
                                      <p className="text-[13px] font-bold tracking-wide uppercase">Use GPS Location</p>
                                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-0.5">Detect current position</p>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsSelectingOnMap("pickup");
                                      setActiveDropdown(null);
                                      showNotice('info', 'Click anywhere on the map to set pickup location', 'Map Selection');
                                    }}
                                    className="w-full flex items-center gap-4 p-5 hover:bg-gold/10 transition-all border-b border-white/5 group/opt"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center group-hover/opt:bg-gold group-hover/opt:text-black transition-all">
                                      <Map size={18} className="text-gold group-hover/opt:text-black" />
                                    </div>
                                    <div className="text-left">
                                      <p className="text-[13px] font-bold tracking-wide uppercase" >Pin on Map</p>
                                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-0.5">Select manually</p>
                                    </div>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>

                      {/* Dropoff Location */}
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <label className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-gold"></span>
                            Dropoff Location{" "}
                            {formData.serviceType !== "hourly" && (
                              <span className="text-red-500">*</span>
                            )}
                          </label>
                        </div>
                        <div className="relative group/input">
                          <MapPin
                            className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/40 group-focus-within/input:text-gold transition-colors"
                            size={20}
                          />
                          <div className="relative">
                            <Autocomplete
                              onLoad={(autocomplete) => {
                                autocomplete.addListener("place_changed", () => {
                                  const place = autocomplete.getPlace();
                                  const address = place.formatted_address || "";
                                  const location = place.geometry?.location;
                                  const coords = location ? { lat: location.lat(), lng: location.lng() } : null;

                                  if (address) {
                                    if (!validateZipCode(place)) {
                                      updateForm("dropoff", "");
                                      return;
                                    }
                                    updateForm("dropoff", address);
                                    setDebouncedDropoff(address);
                                    if (coords) {
                                      setDropoffCoords(coords);
                                      setMapCenter(coords);
                                      setMapZoom(16);
                                    }
                                    setActiveDropdown(null);
                                  }
                                });
                              }}
                              options={{
                                componentRestrictions: settings?.limitCountry
                                  ? { country: settings.limitCountry }
                                  : undefined,
                                types: ["address"],
                              }}
                            >
                              <input
                                ref={dropoffInputRef}
                                type="text"
                                placeholder={
                                  formData.serviceType === "hourly"
                                    ? "Destination (Optional for hourly)"
                                    : "Enter destination address"
                                }
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-5 pl-14 pr-14 focus:border-gold/50 focus:bg-white/[0.08] outline-none transition-all text-base placeholder:text-white/20"
                                value={formData.dropoff}
                                onChange={(e) => {
                                  updateForm("dropoff", e.target.value);
                                  if (e.target.value.length > 2) setActiveDropdown(null);
                                }}
                                onFocus={() => {
                                  if (!formData.dropoff) setActiveDropdown("dropoff");
                                }}
                              />
                            </Autocomplete>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveDropdown(activeDropdown === "dropoff" ? null : "dropoff");
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-gold transition-all p-2.5 rounded-full hover:bg-gold/5"
                              title="Location options"
                            >
                              <LocateFixed size={20} />
                            </button>

                            {/* Dropdown Options */}
                            <AnimatePresence>
                              {activeDropdown === "dropoff" && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                  className="absolute left-0 right-0 top-full mt-3 bg-[#0D0D0D] border border-gold/20 rounded-2xl overflow-hidden z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl"
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleGeolocation('dropoff');
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full flex items-center gap-4 p-5 hover:bg-gold/10 transition-all border-b border-white/5 group/opt"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center group-hover/opt:bg-gold group-hover/opt:text-black transition-all">
                                      <LocateFixed size={18} className="text-gold group-hover/opt:text-black" />
                                    </div>
                                    <div className="text-left">
                                      <p className="text-[13px] font-bold tracking-wide uppercase">Use GPS Location</p>
                                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-0.5">Detect current position</p>
                                    </div>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsSelectingOnMap("dropoff");
                                      setActiveDropdown(null);
                                      showNotice('info', 'Click anywhere on the map to set dropoff location', 'Map Selection');
                                    }}
                                    className="w-full flex items-center gap-4 p-5 hover:bg-gold/10 transition-all border-b border-white/5 group/opt"
                                  >
                                    <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center group-hover/opt:bg-gold group-hover/opt:text-black transition-all">
                                      <Map size={18} className="text-gold group-hover/opt:text-black" />
                                    </div>
                                    <div className="text-left">
                                      <p className="text-[13px] font-bold tracking-wide uppercase">Pin on Map</p>
                                      <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-0.5">Select manually</p>
                                    </div>
                                  </button>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Waypoints */}
                    <div className="space-y-6 pt-4 border-t border-white/5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] uppercase tracking-[0.2em] text-gold/60 font-bold">
                          Waypoints
                        </label>
                        <button
                          onClick={() => {
                            const limit = Number(settings?.waypointLimit) || 5;
                            if (formData.waypoints.length < limit) {
                              updateForm("waypoints", [
                                ...formData.waypoints,
                                "",
                              ]);
                            }
                          }}
                          disabled={
                            formData.waypoints.length >=
                            (Number(settings?.waypointLimit) || 5)
                          }
                          className="text-gold hover:text-white transition-all flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] bg-gold/5 px-4 py-2 rounded-full border border-gold/20 hover:bg-gold/20 disabled:opacity-30 disabled:cursor-not-allowed group"
                        >
                          <Plus size={14} className="group-hover:scale-125 transition-transform" />
                          {formData.waypoints.length === 0 ? "Add Stop" : "Add Another"}
                          {settings?.waypointLimit &&
                            ` (${formData.waypoints.length}/${settings.waypointLimit})`}
                        </button>
                      </div>

                      <div className="space-y-4">
                        {formData.waypoints.map((wp, idx) => (
                          <motion.div
                            key={`wp-${idx}`}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="relative flex gap-3"
                          >
                            <div className="relative flex-1 group/wp">
                              <MapPin
                                className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/30 group-focus-within/wp:text-gold transition-colors"
                                size={18}
                              />
                              <div className="relative">
                                <Autocomplete
                                  onLoad={(autocomplete) => {
                                    autocomplete.addListener("place_changed", () => {
                                      const place = autocomplete.getPlace();
                                      const address = place.formatted_address || "";
                                      const location = place.geometry?.location;
                                      const coords = location ? { lat: location.lat(), lng: location.lng() } : null;

                                      if (address) {
                                        if (!validateZipCode(place)) {
                                          const newWps = [...formData.waypoints];
                                          newWps[idx] = "";
                                          updateForm("waypoints", newWps);
                                          return;
                                        }
                                        const newWps = [...formData.waypoints];
                                        newWps[idx] = address;
                                        updateForm("waypoints", newWps);
                                        if (coords) {
                                          setWaypointCoords(prev => ({ ...prev, [idx]: coords }));
                                          setMapCenter(coords);
                                          setMapZoom(16);
                                        }
                                        setActiveDropdown(null);
                                      }
                                    });
                                  }}
                                  options={{
                                    componentRestrictions: settings?.limitCountry
                                      ? { country: settings.limitCountry }
                                      : undefined,
                                    types: ["address"],
                                  }}
                                >
                                  <input
                                    ref={el => { waypointInputRefs.current[idx] = el; }}
                                    type="text"
                                    placeholder={`Stop ${idx + 1} address`}
                                    className="w-full bg-white/5 rounded-xl border border-white/10 py-4 pl-12 pr-12 focus:border-gold/50 focus:bg-white/[0.08] outline-none transition-all text-sm placeholder:text-white/20"
                                    value={wp}
                                    onChange={(e) => {
                                      const newWps = [...formData.waypoints];
                                      newWps[idx] = e.target.value;
                                      updateForm("waypoints", newWps);
                                      if (e.target.value.length > 2) setActiveDropdown(null);
                                    }}
                                    onFocus={() => {
                                      if (!wp) setActiveDropdown(`waypoint-${idx}`);
                                    }}
                                  />
                                </Autocomplete>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setActiveDropdown(activeDropdown === `waypoint-${idx}` ? null : `waypoint-${idx}`);
                                  }}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-gold transition-all p-2 rounded-full"
                                >
                                  <LocateFixed size={18} />
                                </button>

                                <AnimatePresence>
                                  {activeDropdown === `waypoint-${idx}` && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                      animate={{ opacity: 1, scale: 1, y: 0 }}
                                      exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                      className="absolute left-0 right-0 top-full mt-3 bg-[#0D0D0D] border border-gold/20 rounded-2xl overflow-hidden z-[100] shadow-2xl backdrop-blur-xl"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleGeolocation(`waypoint-${idx}`);
                                          setActiveDropdown(null);
                                        }}
                                        className="w-full flex items-center gap-4 p-4 hover:bg-gold/10 transition-colors border-b border-white/5 group/opt"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center group-hover/opt:bg-gold transition-all">
                                          <LocateFixed size={16} className="text-gold group-hover/opt:text-black" />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide">Use GPS Location</p>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setIsSelectingOnMap(`waypoint-${idx}`);
                                          setActiveDropdown(null);
                                          showNotice('info', 'Pin waypoint on map', 'Map Selection');
                                        }}
                                        className="w-full flex items-center gap-4 p-4 hover:bg-gold/10 transition-colors border-b border-white/5 group/opt"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center group-hover/opt:bg-gold transition-all">
                                          <Map size={16} className="text-gold group-hover/opt:text-black" />
                                        </div>
                                        <p className="text-xs font-bold uppercase tracking-wide">Pin on Map</p>
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                            <button
                              onClick={() =>
                                updateForm(
                                  "waypoints",
                                  formData.waypoints.filter((_, i) => i !== idx),
                                )
                              }
                              className="p-4 bg-red-500/5 text-red-500/50 rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-500/10"
                              title="Remove stop"
                            >
                              <Trash2 size={18} />
                            </button>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                      <div className="space-y-3">
                        <label className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold flex items-center gap-2">
                          <Calendar size={14} className="text-gold" />
                          Pickup Date <span className="text-red-500">*</span>
                        </label>
                        <div className="relative group/input">
                          <input
                            type="date"
                            min={minDate}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-5 px-6 focus:border-gold/50 focus:bg-white/[0.08] outline-none transition-all text-sm appearance-none"
                            value={formData.date}
                            onChange={(e) => updateForm("date", e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold flex items-center gap-2">
                          <Clock size={14} className="text-gold" />
                          Pickup Time <span className="text-red-500">*</span>
                        </label>
                        <div className="relative group/input">
                          <input
                            type="time"
                            min={minTime}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-5 px-6 focus:border-gold/50 focus:bg-white/[0.08] outline-none transition-all text-sm appearance-none"
                            value={formData.time}
                            onChange={(e) => updateForm("time", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Hourly Options */}
                    {formData.serviceType === "hourly" && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3 pt-4"
                      >
                        <label className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold flex items-center gap-2">
                          <Clock size={14} />
                          Duration (Hours) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            value={formData.hours}
                            onChange={(e) =>
                              updateForm("hours", parseFloat(e.target.value))
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-5 px-6 pr-12 focus:border-gold/50 focus:bg-white/[0.08] outline-none transition-all appearance-none custom-select text-sm font-bold"
                          >
                            {(() => {
                              const min = settings?.hourlyMinHours || 1;
                              const max = settings?.hourlyMaxHours || 24;
                              const step = settings?.hourlyHourStep || 1;
                              const options = [];
                              for (let h = min; h <= max; h += step) {
                                options.push(h);
                              }
                              return options.map((h) => (
                                <option key={h} value={h} className="bg-[#0D0D0D] text-white">
                                  {h} {h === 1 ? "Hour" : "Hours"}
                                </option>
                              ));
                            })()}
                          </select>
                        </div>
                      </motion.div>
                    )}

                    {/* Return Trip / Special Services Panel */}
                    <div className="space-y-4 pt-4">
                      <div className="p-6 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-6 shadow-inner tracking-wide">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/10">
                              <RotateCcw className="text-gold" size={22} />
                            </div>
                            <div>
                              <p className="text-[13px] font-bold uppercase tracking-wider">Return Journey</p>
                              <p className="text-[10px] text-white/30 uppercase tracking-[0.1em] mt-0.5">
                                Add return trip details
                              </p>
                            </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input
                              type="checkbox"
                              className="sr-only peer"
                              checked={formData.isReturn}
                              onChange={(e) =>
                                updateForm("isReturn", e.target.checked)
                              }
                            />
                            <div className="w-14 h-7 bg-white/10 peer-focus-outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-[1.25rem] after:w-[1.25rem] after:transition-all peer-checked:bg-gold shadow-[0_0_15px_rgba(212,175,55,0.3)]"></div>
                          </label>
                        </div>

                        {formData.isReturn && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-white/5"
                          >
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-bold mb-1 block">
                                Return Date
                              </label>
                              <input
                                type="date"
                                min={formData.date || minDate}
                                className="w-full bg-white/5 rounded-xl border border-white/10 py-4 px-5 focus:border-gold/50 outline-none text-sm font-medium"
                                value={formData.returnDate}
                                onChange={(e) =>
                                  updateForm("returnDate", e.target.value)
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-bold mb-1 block">
                                Return Time
                              </label>
                              <input
                                type="time"
                                className="w-full bg-white/5 rounded-xl border border-white/10 py-4 px-5 focus:border-gold/50 outline-none text-sm font-medium"
                                value={formData.returnTime}
                                onChange={(e) =>
                                  updateForm("returnTime", e.target.value)
                                }
                              />
                            </div>
                          </motion.div>
                        )}
                      </div>

                      {formData.serviceType === "airport" && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center border border-gold/10">
                              <Plane className="text-gold" size={22} />
                            </div>
                            <div className="flex-1">
                              <label className="text-[11px] uppercase tracking-[0.2em] text-gold font-bold mb-1 block">
                                Arrival Flight Number
                              </label>
                              <input
                                type="text"
                                placeholder="E.G. QF400"
                                className="w-full bg-transparent border-b border-white/10 py-2 focus:border-gold outline-none transition-all uppercase text-lg font-bold tracking-widest placeholder:text-white/10"
                                value={formData.flightNumber}
                                onChange={(e) => {
                                  updateForm(
                                    "flightNumber",
                                    e.target.value.toUpperCase(),
                                  );
                                }}
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-white/20 italic tracking-wide pl-16">
                            * We monitor your flight for real-time adjustment of pickup.
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6 h-full flex flex-col">

                    {/* Route Preferences — Above Map */}
                    <div className="bg-black/85 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl flex flex-col gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-gold animate-ping"></span>
                        <p className="text-[10px] uppercase font-bold tracking-[0.2em] text-white">Route Preferences</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4">
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-white/70 hover:text-white select-none transition-colors">
                          <input
                            type="checkbox"
                            checked={avoidTolls}
                            onChange={(e) => {
                              setAvoidTolls(e.target.checked);
                              showNotice('info', e.target.checked ? 'Recalculating to avoid tolls...' : 'Tolls enabled', 'Route Change');
                            }}
                            className="rounded border-white/20 bg-white/5 text-gold focus:ring-gold focus:ring-offset-0 focus:ring-1 cursor-pointer w-4 h-4 accent-gold"
                          />
                          <span>AVOID TOLLS</span>
                        </label>

                        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-white/70 hover:text-white select-none transition-colors">
                          <input
                            type="checkbox"
                            checked={avoidHighways}
                            onChange={(e) => {
                              setAvoidHighways(e.target.checked);
                              showNotice('info', e.target.checked ? 'Recalculating to avoid highways...' : 'Highways enabled', 'Route Change');
                            }}
                            className="rounded border-white/20 bg-white/5 text-gold focus:ring-gold focus:ring-offset-0 focus:ring-1 cursor-pointer w-4 h-4 accent-gold"
                          />
                          <span>AVOID HIGHWAYS</span>
                        </label>

                        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-white/70 hover:text-white select-none transition-colors">
                          <input
                            type="checkbox"
                            checked={avoidFerries}
                            onChange={(e) => {
                              setAvoidFerries(e.target.checked);
                              showNotice('info', e.target.checked ? 'Recalculating to avoid ferries...' : 'Ferries enabled', 'Route Change');
                            }}
                            className="rounded border-white/20 bg-white/5 text-gold focus:ring-gold focus:ring-offset-0 focus:ring-1 cursor-pointer w-4 h-4 accent-gold"
                          />
                          <span>AVOID FERRIES</span>
                        </label>
                      </div>
                    </div>

                    {/* Map */}
                    <div className="relative flex-grow min-h-[450px] lg:min-h-0 rounded-2xl overflow-hidden border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.6)] group/map">
                      <div className="absolute inset-0 bg-gold/5 pointer-events-none group-hover/map:opacity-0 transition-opacity z-10"></div>

                      <GoogleMap
                        mapContainerStyle={mapContainerStyle}
                        center={mapCenter}
                        zoom={mapZoom}
                        onClick={handleMapClick}
                        onUnmount={() => { }}
                        options={{
                          styles: [
                            { elementType: "geometry", stylers: [{ color: "#000000" }] },
                            { elementType: "labels.text.stroke", stylers: [{ color: "#000000" }] },
                            { elementType: "labels.text.fill", stylers: [{ color: "#d4af37" }] },
                            { featureType: "road", elementType: "geometry", stylers: [{ color: "#333333" }] },
                            { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#212121" }] },
                            { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#ffffff" }] },
                            { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#4d4d4d" }] },
                            { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#666666" }] },
                            { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2f3948" }] },
                            { featureType: "water", elementType: "geometry", stylers: [{ color: "#0a121d" }] },
                            { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
                          ],
                          disableDefaultUI: false,
                          zoomControl: true,
                          mapTypeControl: false,
                          streetViewControl: false,
                          fullscreenControl: true,
                          backgroundColor: '#000000',
                          clickableIcons: true,
                        }}
                      >
                        {directionsOptions && (
                          <DirectionsService
                            options={directionsOptions}
                            callback={directionsCallback}
                          />
                        )}
                        {!directions && pickupCoords && (
                          <Marker position={pickupCoords} label="P" title="Pickup" />
                        )}
                        {!directions && dropoffCoords && (
                          <Marker position={dropoffCoords} label="D" title="Dropoff" />
                        )}
                        {!directions && Object.entries(waypointCoords).map(([idx, coords]) => (
                          <Marker
                            key={idx}
                            position={coords}
                            label={`W${parseInt(idx) + 1}`}
                            title={`Waypoint ${parseInt(idx) + 1}`}
                          />
                        ))}
                        {directions && (
                          <DirectionsRenderer
                            options={{
                              directions: directions,
                              polylineOptions: {
                                strokeColor: "#D4AF37",
                                strokeWeight: 6,
                                strokeOpacity: 0.8,
                              },
                            }}
                          />
                        )}
                      </GoogleMap>
                    </div>

                    {/* Directions Stats (Distance & Est. Time) Below Map */}
                    {(distance || duration) && (formData.serviceType !== 'hourly' || (parseFloat((distance || "").replace(/[^\d.]/g, "")) || 0) > 0) && (
                      <div className="flex flex-col sm:flex-row gap-4 w-full">
                        {distance && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 flex items-center gap-4 p-4 bg-[#020202]/90 backdrop-blur-xl border border-gold/10 rounded-2xl shadow-lg"
                          >
                            <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center border border-gold/20 flex-shrink-0">
                              <Navigation className="text-gold" size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Distance</p>
                              <p className="text-sm font-black text-white tracking-widest uppercase">
                                {(() => {
                                  const distVal = parseFloat(distance.replace(/[^\d.]/g, "")) || 0;
                                  return formData.isReturn ? `${(distVal * 2).toFixed(1)} km` : distance;
                                })()}
                              </p>
                            </div>
                          </motion.div>
                        )}

                        {duration && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex-1 flex items-center gap-4 p-4 bg-[#020202]/90 backdrop-blur-xl border border-gold/10 rounded-2xl shadow-lg"
                          >
                            <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center border border-gold/20 flex-shrink-0">
                              <Timer className="text-gold" size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-bold">Est. Time</p>
                              <p className="text-sm font-black text-white tracking-widest uppercase">
                                {(() => {
                                  if (!duration) return "N/A";
                                  const match = duration.match(/(\d+)\s*min/);
                                  if (match && formData.isReturn) {
                                    const mins = parseInt(match[1]);
                                    return `${mins * 2} mins`;
                                  }
                                  return duration;
                                })()}
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Redesigned Actions */}
                  <div className="flex flex-col sm:flex-row justify-between gap-6 pt-10 w-full lg:col-span-2 border-t border-white/5 mt-4">
                    <button
                      onClick={prevStep}
                      className="group flex items-center justify-center gap-3 py-5 px-10 rounded-xl border border-white/10 text-white/40 hover:text-white hover:border-white/20 transition-all font-bold uppercase tracking-widest text-xs"
                    >
                      <ChevronsLeft className="group-hover:scale-110 transition-transform" size={18} />
                      Back
                    </button>
                    <button
                      onClick={nextStep}
                      className="group flex items-center justify-center gap-4 bg-gold py-5 px-16 rounded-xl text-black font-black uppercase tracking-[0.25em] text-xs hover:bg-[#F2D06B] transition-all shadow-[0_10px_30px_rgba(212,175,55,0.2)] hover:shadow-[0_15px_40px_rgba(212,175,55,0.4)]"
                    >
                      Continue
                      <Car className=" group-hover:translate-x-2 transition-transform" size={18} />
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-[#030303]/40 backdrop-blur-3xl p-5 md:p-10 xl:p-12 rounded-3xl border border-white/[0.05] shadow-[0_25px_60px_rgba(0,0,0,0.85)] grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-10 hover:border-white/[0.08] transition-all duration-700 relative overflow-hidden items-start"
                >
                  <div className="lg:col-span-3 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/[0.05] pb-6 w-full">
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl md:text-3xl font-display text-white mb-2">Select Vehicle</h2>
                      <p className="text-gold/40 text-[10px] uppercase tracking-[0.4em] font-black">Choose your fleet</p>
                    </div>
                    
                    <div className="flex items-center justify-center md:justify-end gap-3">
                      {lastSaved && (
                        <div
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-gold/10 bg-gold/5 text-gold/50 text-[9px] uppercase tracking-widest font-black"
                        >
                          <div className="relative">
                            <History size={14} />
                            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></div>
                          </div>
                          <span>Draft Saved</span>
                          <span className="opacity-40 font-mono text-[8px] lowercase">({new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                        </div>
                      )}
                      <button
                        onClick={handleNewBooking}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-[9px] uppercase tracking-widest font-black group"
                        title="Reset Booking"
                      >
                        <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-8">
                    {/* Vehicle Filters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-[#080808]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                      {/* Subtle elegant top line accent for filter card */}
                      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-[0.2em] text-gold/60 font-bold block">
                          Type
                        </label>
                        <select
                          className="w-full bg-[#111111]/90 border border-white/10 hover:border-gold/30 text-white text-xs py-2.5 px-3 rounded-xl outline-none focus:border-gold/60 transition-all custom-select cursor-pointer tracking-wider font-medium shadow-inner"
                          onChange={(e) => setTypeFilter(e.target.value)}
                          value={typeFilter}
                        >
                          <option value="all" className="bg-[#121212]">All Types</option>
                          <option value="sedan" className="bg-[#121212]">Sedan</option>
                          <option value="suv" className="bg-[#121212]">SUV</option>
                          <option value="van" className="bg-[#121212]">Van</option>
                          <option value="luxury" className="bg-[#121212]">Luxury</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-[0.2em] text-gold/60 font-bold block">
                          Passengers
                        </label>
                        <select
                          className="w-full bg-[#111111]/90 border border-white/10 hover:border-gold/30 text-white text-xs py-2.5 px-3 rounded-xl outline-none focus:border-gold/60 transition-all custom-select cursor-pointer tracking-wider font-medium shadow-inner"
                          onChange={(e) => setPaxFilter(parseInt(e.target.value))}
                          value={paxFilter}
                        >
                          <option value={0} className="bg-[#121212]">Any</option>
                          <option value={2} className="bg-[#121212]">2+ Pax</option>
                          <option value={4} className="bg-[#121212]">4+ Pax</option>
                          <option value={6} className="bg-[#121212]">6+ Pax</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-[0.2em] text-gold/60 font-bold block">
                          Bags
                        </label>
                        <select
                          className="w-full bg-[#111111]/90 border border-white/10 hover:border-gold/30 text-white text-xs py-2.5 px-3 rounded-xl outline-none focus:border-gold/60 transition-all custom-select cursor-pointer tracking-wider font-medium shadow-inner"
                          onChange={(e) =>
                            setBagsFilter(parseInt(e.target.value))
                          }
                          value={bagsFilter}
                        >
                          <option value={0} className="bg-[#121212]">Any</option>
                          <option value={2} className="bg-[#121212]">2+ Bags</option>
                          <option value={4} className="bg-[#121212]">4+ Bags</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-[0.2em] text-gold/60 font-bold block">
                          Sort By
                        </label>
                        <select
                          className="w-full bg-[#111111]/90 border border-white/10 hover:border-gold/30 text-white text-xs py-2.5 px-3 rounded-xl outline-none focus:border-gold/60 transition-all custom-select cursor-pointer tracking-wider font-medium shadow-inner"
                          onChange={(e) => setPriceSort(e.target.value as any)}
                          value={priceSort || ""}
                        >
                          <option value="" className="bg-[#121212]">Default</option>
                          <option value="asc" className="bg-[#121212]">Price: Low to High</option>
                          <option value="desc" className="bg-[#121212]">Price: High to Low</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {filteredFleet.map((v) => {
                        const priceDetails = calculatePrice(v.id);
                        const isSelected = formData.vehicle === v.id;
                        return (
                          <button
                            key={v.id}
                            onClick={() => updateForm("vehicle", v.id)}
                            className={cn(
                              "flex flex-col border rounded-2xl transition-all duration-500 text-left overflow-hidden group relative",
                              isSelected
                                ? "border-gold/80 bg-gold/[0.03] shadow-[0_15px_40px_rgba(212,175,55,0.12)] ring-1 ring-gold/30"
                                : "border-white/[0.08] hover:border-gold/40 bg-[#0E0E0E]/90 hover:bg-[#121212]/90 shadow-[0_10px_30px_rgba(0,0,0,0.4)]",
                            )}
                          >
                            {/* Selected Badge Ring Accent */}
                            {isSelected && (
                              <div className="absolute top-3 right-3 z-20 px-3 py-1 bg-gold text-black text-[9px] uppercase tracking-[0.2em] font-black rounded-full shadow-lg">
                                Selected
                              </div>
                            )}

                            {/* Image with Luxury Ambient Gradient Overlay */}
                            <div className="relative aspect-[16/10] overflow-hidden flex-shrink-0 bg-black/40">
                              <img
                                src={getAssetPath(v.img) || null}
                                alt={v.name}
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 block"
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent opacity-80 pointer-events-none" />
                            </div>

                            {/* Luxury Text Content Container */}
                            <div className="flex-1 p-5 flex flex-col justify-between">
                              <div>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <h3 className="font-display text-lg md:text-xl font-medium tracking-tight text-white group-hover:text-gold transition-colors truncate">
                                      {v.name}
                                    </h3>
                                    <p className="text-white/40 text-[9px] uppercase tracking-[0.2em] font-medium">
                                      {v.model}
                                    </p>
                                  </div>
                                  <div className="flex flex-col items-end shrink-0 text-right">
                                    <span className="text-gold font-display font-medium text-lg tracking-wider leading-none">
                                      ${priceDetails.gross.toFixed(2)}
                                    </span>
                                    <span className="text-white/30 text-[8px] uppercase tracking-[0.18em] font-medium mt-1">
                                      Total
                                    </span>
                                  </div>
                                </div>

                                {v.excerpt && (
                                  <p className="text-white/50 text-[10px] mt-2 leading-relaxed italic line-clamp-2">
                                    "{v.excerpt}"
                                  </p>
                                )}
                              </div>

                              <div className="h-px bg-white/[0.06] my-4" />

                              <div className="flex gap-3">
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.02] border border-white/[0.08] rounded-full text-white/60 text-[9px] uppercase tracking-[0.16em] font-medium transition-colors group-hover:border-gold/20">
                                  <User size={10} className="text-gold" /> {v.pax} Passengers
                                </span>
                                <span className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.02] border border-white/[0.08] rounded-full text-white/60 text-[9px] uppercase tracking-[0.16em] font-medium transition-colors group-hover:border-gold/20">
                                  <Briefcase size={10} className="text-gold" /> {v.bags} Bags
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                      {filteredFleet.length === 0 && (
                        <div className="col-span-full text-center py-20 border border-dashed border-gold/15 rounded-3xl bg-[#080808]/60 backdrop-blur-md">
                          <Car size={36} className="text-gold/20 mx-auto mb-4 animate-pulse" />
                          <p className="text-white/50 text-sm uppercase tracking-[0.18em] font-light">
                            No vehicles match your search filters.
                          </p>
                          <button
                            onClick={() => {
                              setTypeFilter("all");
                              setPaxFilter(0);
                              setBagsFilter(0);
                              setPriceSort(null);
                            }}
                            className="text-gold hover:text-white hover:bg-gold hover:text-black text-[10px] font-bold uppercase tracking-[0.25em] mt-6 px-6 py-2.5 border border-gold/30 rounded-full transition-all duration-300"
                          >
                            Clear Filters
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Extras Section */}
                    {extras.length > 0 && (
                      <div className="space-y-4 pt-10 border-t border-white/[0.06]">
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.25em] text-gold/60 font-bold mb-1">
                              Customize Journeys
                            </p>
                            <h3 className="text-xl font-display font-medium text-white flex items-center gap-2">
                              Extra Options & Upgrades
                            </h3>
                          </div>
                          <div className="p-2 bg-gold/10 rounded-full border border-gold/20 flex items-center justify-center">
                            <Plus className="text-gold" size={16} />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {extras.map((extra) => {
                            const isExtraSelected = formData.selectedExtras.includes(extra.id);
                            return (
                              <button
                                key={extra.id}
                                onClick={() => {
                                  const isSelected =
                                    formData.selectedExtras.includes(extra.id);
                                  updateForm(
                                    "selectedExtras",
                                    isSelected
                                      ? formData.selectedExtras.filter(
                                        (id) => id !== extra.id,
                                      )
                                      : [...formData.selectedExtras, extra.id],
                                  );
                                }}
                                className={cn(
                                  "flex items-center justify-between p-5 rounded-2xl border transition-all duration-300 text-left relative overflow-hidden group",
                                  isExtraSelected
                                    ? "bg-gold/[0.04] border-gold shadow-[0_10px_30px_rgba(212,175,55,0.06)] ring-1 ring-gold/20"
                                    : "bg-[#0E0E0E]/90 border-white/[0.06] hover:border-gold/30 hover:bg-[#121212]/90",
                                )}
                              >
                                <div className="flex-1 min-w-0 pr-4">
                                  <p className="text-sm font-bold text-white group-hover:text-gold transition-colors truncate">
                                    {extra.name}
                                  </p>
                                  <p className="text-[10px] text-white/40 uppercase tracking-[0.12em] mt-1 line-clamp-1">
                                    {extra.description}
                                  </p>
                                </div>
                                <div className="text-right flex flex-col items-end shrink-0 ml-2">
                                  <p className="text-sm font-display text-gold font-medium tracking-wide">
                                    +${extra.price}
                                  </p>
                                  <div
                                    className={cn(
                                      "w-4 h-4 rounded-full border flex items-center justify-center mt-2.5 transition-all duration-300",
                                      isExtraSelected
                                        ? "bg-gold border-gold"
                                        : "border-white/20 group-hover:border-gold/40",
                                    )}
                                  >
                                    {isExtraSelected && (
                                      <CheckCircle
                                        size={10}
                                        className="text-black fill-current"
                                      />
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Summary */}
                  <div className="space-y-6">
                    <div className="bg-[#080808]/95 backdrop-blur-2xl p-6 md:p-8 sticky top-32 rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden group">
                      {/* Subtle elegant linear gold gradient accent line at the top of card */}
                      <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>

                      <div className="flex items-center justify-between mb-8 border-b border-white/[0.06] pb-4">
                        <h3 className="text-gold text-xs uppercase tracking-[0.25em] font-bold">
                          Booking Summary
                        </h3>
                        {lastSaved && (
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] uppercase tracking-widest text-gold/60 font-bold animate-pulse">
                              Draft Saved
                            </span>
                            <span className="text-[7px] text-white/30 font-mono tracking-wider">
                              {new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-5 mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 flex-shrink-0 animate-fade-in">
                            <LocateFixed size={14} className="text-gold" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                              Pickup
                            </p>
                            <p className="text-[11px] text-white/95 font-medium truncate leading-normal">
                              {formData.pickup}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 flex-shrink-0 animate-fade-in">
                            <MapPin size={14} className="text-gold" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                              Dropoff
                            </p>
                            <p className="text-[11px] text-white/95 font-medium truncate leading-normal">
                              {formData.dropoff || "Hourly Hire"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 flex-shrink-0 animate-fade-in">
                            <Calendar size={14} className="text-gold" />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                              Date & Time
                            </p>
                            <p className="text-[11px] text-white/95 font-medium leading-normal">
                              {formatDateWithWeekday(formData.date)} at {formatTime12h(formData.time)}
                            </p>
                          </div>
                        </div>
                        {formData.isReturn && (
                          <div className="flex items-center gap-4">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 flex-shrink-0 animate-fade-in">
                              <RotateCcw size={14} className="text-gold" />
                            </div>
                            <div>
                              <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                Return Trip
                              </p>
                              <p className="text-[11px] text-white/95 font-medium leading-normal">
                                {formatDateWithWeekday(formData.returnDate)} at {formatTime12h(formData.returnTime)}
                              </p>
                            </div>
                          </div>
                        )}

                        {formData.waypoints.filter((wp) => wp.length > 5).length >
                          0 && (
                            <div className="flex items-start gap-4">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0 animate-fade-in">
                                <Navigation size={14} className="text-gold" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                  Waypoints
                                </p>
                                <div className="space-y-1">
                                  {formData.waypoints
                                    .filter((wp) => wp.length > 5)
                                    .map((wp, idx) => (
                                      <p
                                        key={idx}
                                        className="text-[11px] text-white/95 font-medium truncate leading-normal"
                                      >
                                        {wp}
                                      </p>
                                    ))}
                                </div>
                              </div>
                            </div>
                          )}

                        {formData.selectedExtras.length > 0 && (
                          <div className="flex items-start gap-4">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0 animate-fade-in">
                              <Plus size={14} className="text-gold" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                Extras
                              </p>
                              <div className="space-y-1">
                                {formData.selectedExtras.map((id, seIdx) => {
                                  const extra = extras.find((e) => e.id === id);
                                  return (
                                    <p
                                      key={`sel-extra-${id}-${seIdx}`}
                                      className="text-[11px] text-white/95 font-medium truncate leading-normal"
                                    >
                                      {extra?.name}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-4 mb-2">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 flex-shrink-0 animate-fade-in">
                            <Car size={14} className="text-gold" />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                              Vehicle
                            </p>
                            <p className="text-[11px] text-white/95 font-medium leading-normal">
                              {
                                (
                                  fleet.find(
                                    (v) => v.id === formData.vehicle,
                                  ) ||
                                  vehicles.find(
                                    (v) => v.id === formData.vehicle,
                                  )
                                )?.name
                              }
                            </p>
                          </div>
                        </div>
                      </div>


                      {formData.vehicle && (
                        <div className="space-y-3.5 pt-4 border-t border-white/[0.06]">
                          {settings?.showPriceBreakdown !== false && (
                            <div className="space-y-2.5">
                              {(() => {
                                const details = calculatePrice(formData.vehicle);
                                return (
                                  <>
                                    {settings?.showBasePrice !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Base Fare</span>
                                        <span className="font-display font-medium text-white/90">${details.base.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showDistancePrice !== false && (
                                      <div className="space-y-2 border-b border-white/[0.03] last:border-0 pb-1.5">
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1 border-b-0">
                                          <div className="flex items-center gap-2">
                                            <span>
                                              {formData.serviceType === "hourly"
                                                ? `Hourly (${formData.hours}h)`
                                                : "Distance"}
                                            </span>

                                            {settings?.showDistanceEyeIcon && (
                                              <button
                                                onClick={() =>
                                                  setShowDistanceBreakdown(
                                                    !showDistanceBreakdown,
                                                  )
                                                }
                                                className={cn(
                                                  "flex items-center gap-1.5 text-gold/60 hover:text-gold transition-all duration-300",
                                                  showDistanceBreakdown &&
                                                  "text-gold font-mediumScale",
                                                )}
                                                title="View Range Wise Price"
                                              >
                                                <Eye size={10} />
                                                <span className="text-[9px] font-bold uppercase tracking-[0.15em]">
                                                  View
                                                </span>
                                              </button>
                                            )}
                                          </div>

                                          <span className="font-display font-medium text-white/90">
                                            ${details.distance.toFixed(2)}
                                          </span>
                                        </div>

                                        {showDistanceBreakdown &&
                                          details.rangeCalcs &&
                                          details.rangeCalcs.length > 0 && (
                                            <div className="p-4 bg-[#050505]/95 rounded-xl border border-gold/15 space-y-2.5 my-3 shadow-inner">
                                              <div className="flex items-center justify-between mb-1.5 border-b border-white/5 pb-1.5">
                                                <h4 className="text-[9px] uppercase tracking-[0.2em] font-bold text-gold">
                                                  {formData.serviceType ===
                                                    "hourly"
                                                    ? "Hourly Calculation"
                                                    : "Distance Calculation"}
                                                </h4>
                                              </div>
                                              {details.rangeCalcs.map(
                                                (calc: any, i: number) => (
                                                  <div
                                                    key={i}
                                                    className="flex justify-between items-center text-[10px] tracking-wide"
                                                  >
                                                    <div className="flex items-center gap-2">
                                                      <div className="w-1 h-1 rounded-full bg-gold/70" />
                                                      <span className="text-white font-medium uppercase tracking-[0.05em]">
                                                        {calc.label}{" "}
                                                        {calc.isHourly
                                                          ? ""
                                                          : "Range"}
                                                      </span>
                                                      <span className="text-white/40 text-[9px]">
                                                        ({calc.dist.toFixed(1)}
                                                        {calc.isHourly
                                                          ? "h"
                                                          : "km"}{" "}
                                                        × ${calc.rate})
                                                      </span>
                                                    </div>
                                                    <span className="text-white/95 font-semibold">
                                                      ${calc.total.toFixed(2)}
                                                    </span>
                                                  </div>
                                                ),
                                              )}
                                            </div>
                                          )}
                                      </div>
                                    )}
                                    {settings?.showWaypointPrice !== false &&
                                      details.waypoints > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                          <span>Waypoints</span>
                                          <span className="font-display font-medium text-white/90">
                                            ${details.waypoints.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    {formData.isReturn && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Return Trip (2x)</span>
                                        <span className="font-display font-medium text-white/90">
                                          ${details.returnPrice.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {settings?.showExtrasPrice !== false &&
                                      details.extras > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                          <span>Extras</span>
                                          <span className="font-display font-medium text-white/90">
                                            ${details.extras.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    {settings?.showGrossPrice !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Gross Price</span>
                                        <span className="font-display font-medium text-white/90">${details.gross.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showDiscount !== false &&
                                      details.discount > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-[#10B981] font-medium py-1.5 border-b border-white/[0.03]">
                                          <span>
                                            Discount ({appliedCoupon?.code} -{" "}
                                            {appliedCoupon?.type === "percentage"
                                              ? `${appliedCoupon.value}%`
                                              : `$${appliedCoupon.value}`}
                                            )
                                          </span>
                                          <span className="font-semibold text-[#10B981]">
                                            -${details.discount.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    {settings?.showNetPrice !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-gold/50 font-bold py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Net Price</span>
                                        <span className="font-display font-medium text-gold/50 font-bold">${details.net.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showTax !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>
                                          Tax ({settings?.taxPercentage || 0}%)
                                        </span>
                                        <span className="font-display font-medium text-white/90">${details.tax.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showStripeFees !== false &&
                                      details.stripe > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                          <span>Stripe Fees</span>
                                          <span className="font-display font-medium text-white/90">
                                            ${details.stripe.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    <div className="flex justify-between items-center pt-5">
                                      <span className="text-white font-bold text-xs uppercase tracking-[0.2em]">
                                        Total
                                      </span>
                                      <span className="text-gold font-display font-semibold text-2xl tracking-widest leading-none">
                                        ${details.total.toFixed(2)}
                                      </span>
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                      )}

                      <div className="flex flex-col sm:flex-row gap-4 mt-8">
                        <button
                          onClick={prevStep}
                          className="btn-outline flex-1 py-3.5 px-6 rounded-xl border border-white/10 hover:border-gold/50 text-[10px] uppercase tracking-[0.2em] font-medium transition-all duration-300 active:scale-[0.98]"
                        >
                          Back
                        </button>
                        <button
                          onClick={nextStep}
                          className="btn-primary flex-1 py-3.5 px-6 rounded-xl bg-gold hover:bg-white text-black font-semibold text-[10px] uppercase tracking-[0.2em] transition-all duration-300 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none"
                          disabled={!formData.vehicle}
                        >
                          Continue
                        </button>
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
                  className="space-y-8"
                >
                  <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 border-b border-white/[0.05] pb-6">
                    <div className="text-center md:text-left">
                      <h2 className="text-2xl md:text-3xl font-display text-white mb-2">Booking Summary</h2>
                      <p className="text-gold/40 text-[10px] uppercase tracking-[0.4em] font-black">Finalize your reservation</p>
                    </div>
                    
                    <div className="flex items-center justify-center md:justify-end gap-3">
                      {lastSaved && (
                        <div
                          className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-gold/10 bg-gold/5 text-gold/50 text-[9px] uppercase tracking-widest font-black"
                        >
                          <div className="relative">
                            <History size={14} />
                            <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></div>
                          </div>
                          <span>Draft Saved</span>
                          <span className="opacity-40 font-mono text-[8px] lowercase">({new Date(lastSaved).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>
                        </div>
                      )}
                      <button
                        onClick={handleNewBooking}
                        className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-500/60 hover:text-red-500 hover:bg-red-500/10 hover:border-red-500/40 transition-all text-[9px] uppercase tracking-widest font-black group"
                        title="Reset Booking"
                      >
                        <RotateCcw size={14} className="group-hover:rotate-[-45deg] transition-transform" />
                        Reset
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left items-start">
                    <div className="lg:col-span-7 space-y-8">
                      {/* Confirmation Card */}
                      <div className="bg-[#080808]/95 backdrop-blur-2xl p-6 md:p-8 xl:p-10 rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.85)] relative overflow-hidden group hover:border-gold/20 transition-all duration-500">
                        {/* Subtle elegant linear gold gradient accent line at the top of card */}
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>

                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-[#10B981]/15 border border-[#10B981]/35 text-[#10B981] rounded-full flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                            <CheckCircle size={24} className="text-[#10B981]" />
                          </div>
                          <div className="text-left">
                            <h2 className="text-lg md:text-xl font-display font-medium text-white tracking-wide mb-1">
                              Confirm Your Booking
                            </h2>
                            <p className="text-white/60 text-xs md:text-sm max-w-md leading-relaxed">
                              Please review your details. A confirmation email
                              will be sent once payment is processed.
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Customer Information Card */}
                      <div className="bg-[#080808]/95 backdrop-blur-2xl p-6 md:p-8 space-y-6 rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-gold/15 transition-all duration-500">
                        {/* Subtle gold line at top */}
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>

                        <div className="space-y-4">
                          <h3 className="text-gold text-xs uppercase tracking-[0.25em] font-bold mb-6 border-b border-white/[0.06] pb-4">
                            Customer Information
                          </h3>

                          {/* First row: Name + Email + Phone */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">
                                Full Name <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-black/40 hover:bg-black/60 focus:bg-black/80 rounded-xl border border-white/[0.08] focus:border-gold/50 py-3 px-4 outline-none text-white text-sm transition-all duration-300 placeholder:text-white/20 select-none shadow-inner"
                                value={formData.customerName}
                                onChange={(e) =>
                                  updateForm("customerName", e.target.value)
                                }
                                placeholder="Your Name"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">
                                Email <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="email"
                                className="w-full bg-black/40 hover:bg-black/60 focus:bg-black/80 rounded-xl border border-white/[0.08] focus:border-gold/50 py-3 px-4 outline-none text-white text-sm transition-all duration-300 placeholder:text-white/20 select-none shadow-inner"
                                value={formData.customerEmail}
                                onChange={(e) =>
                                  updateForm("customerEmail", e.target.value)
                                }
                                placeholder="Email Address"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">
                                Phone <span className="text-red-500">*</span>
                              </label>
                              <div className="flex gap-2">
                                <div className="flex items-center w-full bg-black/40 hover:bg-black/60 rounded-xl border border-white/[0.08] focus-within:border-gold/50 transition-all duration-300 shadow-inner overflow-hidden">
                                  <select
                                    className="custom-select h-[46px] border-r border-white/[0.08] text-white rounded-sm transition-all duration-300 bg-transparent pl-3 pr-7 outline-none cursor-pointer shrink-0"
                                    value={parsePhoneNumber(formData.customerPhone).countryCode}
                                    onChange={(e) => {
                                      const { localNumber } = parsePhoneNumber(formData.customerPhone);
                                      updateForm("customerPhone", `${e.target.value} ${localNumber}`);
                                    }}
                                  >
                                    {COUNTRY_CODES.map((c) => (
                                      <option key={c.code} value={c.code}>
                                        {c.short}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="tel"
                                    className="flex-1 bg-transparent py-3 px-4 outline-none text-white text-sm placeholder:text-white/20 select-none min-w-0"
                                    value={parsePhoneNumber(formData.customerPhone).localNumber}
                                    onChange={(e) => {
                                      const { countryCode } = parsePhoneNumber(formData.customerPhone);
                                      let val = e.target.value;
                                      if (val.startsWith("+")) {
                                        const parsed = parsePhoneNumber(val);
                                        updateForm("customerPhone", `${parsed.countryCode} ${parsed.localNumber}`);
                                      } else {
                                        updateForm("customerPhone", `${countryCode} ${val}`);
                                      }
                                    }}
                                    placeholder="Phone Number"
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Second row: Password (only if no user) */}
                          {!user && (
                            <div className="space-y-6">
                              <div className="flex flex-col gap-4">
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-gold/[0.02] border border-gold/15 rounded-2xl relative overflow-hidden group">
                                  <div>
                                    <p className="text-sm font-bold text-gold">Already have an account?</p>
                                    <p className="text-[10px] text-white/60">Log in to sync your profile and previous details.</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setShowLoginFields(!showLoginFields)}
                                    className="text-gold hover:text-black hover:bg-gold transition-all duration-300 text-[10px] font-bold uppercase tracking-[0.18em] border border-gold/30 hover:border-gold px-5 py-2.5 rounded-xl active:scale-95 flex-shrink-0 w-full sm:w-auto text-center justify-center flex"
                                  >
                                    {showLoginFields ? "Cancel" : "Login"}
                                  </button>
                                </div>

                                {showLoginFields && (
                                  <form
                                    onSubmit={handleLogin}
                                    className="p-6 md:p-8 bg-black/45 border border-white/[0.08] rounded-2xl space-y-5 animate-in fade-in slide-in-from-top-4 duration-500 shadow-2xl"
                                  >
                                    <h4 className="text-[10px] font-bold text-white uppercase tracking-[0.2em] flex items-center gap-2 mb-2 border-b border-white/[0.05] pb-3">
                                      <User size={14} className="text-gold" /> Member Login
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div className="space-y-1.5">
                                        <label className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">Email</label>
                                        <input
                                          type="email"
                                          className="w-full bg-black/60 hover:bg-black/85 focus:bg-black/95 rounded-xl border border-white/[0.08] focus:border-gold/50 py-2.5 px-4 outline-none text-sm text-white/95 transition-all duration-300 placeholder:text-white/20 select-none shadow-inner"
                                          value={loginEmail}
                                          onChange={(e) => setLoginEmail(e.target.value)}
                                          placeholder="your@email.com"
                                          autoComplete="email"
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <label className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">Password</label>
                                        <input
                                          type="password"
                                          className="w-full bg-black/60 hover:bg-black/85 focus:bg-black/95 rounded-xl border border-white/[0.08] focus:border-gold/50 py-2.5 px-4 outline-none text-sm text-white/95 transition-all duration-300 placeholder:text-white/20 select-none shadow-inner"
                                          value={loginPassword}
                                          onChange={(e) => setLoginPassword(e.target.value)}
                                          placeholder="••••••••"
                                          autoComplete="current-password"
                                        />
                                      </div>
                                    </div>
                                    <button
                                      type="submit"
                                      disabled={isLoggingIn}
                                      className="w-full bg-gradient-to-r from-gold to-[#D4AF37] hover:from-white hover:to-white text-black py-3 px-6 rounded-xl font-bold text-[10px] uppercase tracking-[0.2em] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(212,175,55,0.15)]"
                                    >
                                      {isLoggingIn ? (
                                        <>
                                          <Loader2 size={14} className="animate-spin" />
                                          <span>Logging in...</span>
                                        </>
                                      ) : (
                                        <span>Log In Now</span>
                                      )}
                                    </button>
                                  </form>
                                )}
                              </div>

                              {!showLoginFields && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="space-y-1.5 md:col-span-1">
                                    <label className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">
                                      Create Password{" "}
                                      <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                      type="password"
                                      className="w-full bg-black/40 hover:bg-black/60 focus:bg-black/80 rounded-xl border border-white/[0.08] focus:border-gold/50 py-3 px-4 outline-none text-white text-sm transition-all duration-300 placeholder:text-white/20 select-none shadow-inner"
                                      value={formData.customerPassword}
                                      onChange={(e) =>
                                        updateForm("customerPassword", e.target.value)
                                      }
                                      placeholder="Min 6 characters"
                                      required
                                    />
                                    <p className="text-[9px] text-white/35 italic">
                                      An account will be created for you.
                                    </p>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Additional info */}
                          <div className="space-y-1.5 pt-2">
                            <label className="text-[9px] uppercase tracking-[0.18em] text-white/40 font-bold">
                              Additional information
                            </label>
                            <textarea
                              className="w-full bg-black/40 hover:bg-black/60 focus:bg-black/80 rounded-xl border border-white/[0.08] focus:border-gold/50 py-3 px-4 outline-none text-white text-sm min-h-[90px] transition-all duration-300 placeholder:text-white/20 select-none shadow-inner"
                              value={formData.purpose}
                              onChange={(e) =>
                                updateForm("purpose", e.target.value)
                              }
                              placeholder="Optional: Share extra information to make your trip smoother"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Coupon Section Card */}
                      <div className="bg-[#080808]/95 backdrop-blur-2xl p-6 md:p-8 space-y-5 rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-gold/15 transition-all duration-500">
                        {/* Subtle gold line at top */}
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>

                        <h3 className="text-gold text-xs uppercase tracking-[0.25em] font-bold mb-6 border-b border-white/[0.06] pb-4 font-display">
                          Discount Coupon
                        </h3>
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Tag
                                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gold/50"
                                size={14}
                              />
                              <input
                                type="text"
                                placeholder="Enter coupon code"
                                className="w-full bg-black/40 hover:bg-black/65 focus:bg-black/85 rounded-xl border border-white/[0.08] focus:border-gold/50 py-3 pl-11 pr-4 outline-none text-white text-sm transition-all duration-300 placeholder:text-white/20 select-none shadow-inner uppercase tracking-wider"
                                value={formData.couponCode}
                                onChange={(e) =>
                                  updateForm(
                                    "couponCode",
                                    e.target.value.toUpperCase(),
                                  )
                                }
                              />
                            </div>
                            <button
                              onClick={handleValidateCoupon}
                              disabled={isValidatingCoupon || !formData.couponCode}
                              className="bg-gold hover:bg-white text-black px-6 rounded-xl text-[10px] uppercase tracking-[0.2em] font-semibold transition-all duration-300 active:scale-95 disabled:opacity-50 flex items-center justify-center shrink-0"
                            >
                              {isValidatingCoupon ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                "Apply"
                              )}
                            </button>
                          </div>

                          {/* Available Coupons Pills */}
                          {availableCoupons.length > 0 && !appliedCoupon && (
                            <div className="space-y-3 pt-1">
                              <p className="text-[9px] uppercase tracking-[0.18em] text-white/30 font-bold">Available Offers:</p>
                              <div className="flex flex-wrap gap-2">
                                {availableCoupons.map((coupon) => (
                                  <button
                                    key={`coupon-pill-${coupon.id}`}
                                    type="button"
                                    onClick={() => handleApplyCouponFromList(coupon.code)}
                                    className="flex items-center gap-2 px-3 py-2 bg-gold/[0.03] border border-gold/15 hover:border-gold/40 hover:bg-gold/[0.08] rounded-full transition-all duration-300 group hover:scale-[1.02] active:scale-95"
                                  >
                                    <BadgePercent size={12} className="text-gold" />
                                    <span className="text-[10px] font-bold text-white/80 group-hover:text-gold uppercase tracking-wider">{coupon.code}</span>
                                    <span className="text-[9px] text-gold/60 font-medium">
                                      {coupon.type === 'percentage' ? `${coupon.value}% OFF` : `$${coupon.value} OFF`}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        {couponError && (
                          <p className="text-red-500 text-[10px] tracking-wide mt-2">
                            {couponError}
                          </p>
                        )}
                        {appliedCoupon && (
                          <div className="flex items-center justify-between bg-gold/[0.06] border border-gold/25 p-3.5 rounded-xl animate-fade-in mt-3">
                            <div className="flex items-center gap-2.5 text-gold text-[10px] font-bold uppercase tracking-[0.15em]">
                              <CheckCircle size={14} />
                              Coupon Applied: {appliedCoupon.code}
                            </div>
                            <button
                              onClick={() => {
                                setAppliedCoupon(null);
                                updateForm("couponCode", "");
                              }}
                              className="text-white/40 hover:text-white transition-colors duration-200"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Payment Method Card */}
                      <div className="bg-[#080808]/95 backdrop-blur-2xl p-6 md:p-8 space-y-5 rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-gold/15 transition-all duration-500">
                        {/* Subtle gold line at top */}
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold/30 to-transparent"></div>

                        <h3 className="text-gold text-xs uppercase tracking-[0.25em] font-bold mb-6 border-b border-white/[0.06] pb-4 font-display">
                          Payment Method
                        </h3>
                        {(() => {
                          const allowedCount = (settings?.allowStripeCardPayment !== false ? 1 : 0) + (settings?.allowCashPayment !== false ? 1 : 0);
                          return (
                            <div className={cn("grid gap-4", allowedCount === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                              {settings?.allowStripeCardPayment !== false && (
                                <button
                                  onClick={() => setPaymentMethod("card")}
                                  className={cn(
                                    "flex items-center gap-4 p-5 rounded-xl border transition-all duration-300 text-left active:scale-[0.98]",
                                    paymentMethod === "card"
                                      ? "border-gold bg-gradient-to-br from-gold/10 to-gold/5 shadow-[0_0_20px_rgba(212,175,55,0.08)]"
                                      : "border-white/[0.06] hover:border-gold/30 hover:bg-white/[0.02] bg-black/45",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
                                      paymentMethod === "card"
                                        ? "bg-gold text-black shadow-[0_4px_15px_rgba(212,175,55,0.2)]"
                                        : "bg-white/[0.05] text-white/60 border border-white/[0.04]",
                                    )}
                                  >
                                    <CreditCard size={20} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-white/95">
                                      Credit/Debit Card
                                    </p>
                                    <p className="text-[9px] text-white/40 uppercase tracking-[0.16em] mt-0.5">
                                      Secure via Stripe
                                    </p>
                                  </div>
                                </button>
                              )}

                              {settings?.allowCashPayment !== false && (
                                <button
                                  onClick={() => setPaymentMethod("cash")}
                                  className={cn(
                                    "flex items-center gap-4 p-5 rounded-xl border transition-all duration-300 text-left active:scale-[0.98]",
                                    paymentMethod === "cash"
                                      ? "border-gold bg-gradient-to-br from-gold/10 to-gold/5 shadow-[0_0_20px_rgba(212,175,55,0.08)]"
                                      : "border-white/[0.06] hover:border-gold/30 hover:bg-white/[0.02] bg-black/45",
                                  )}
                                >
                                  <div
                                    className={cn(
                                      "w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 shrink-0",
                                      paymentMethod === "cash"
                                        ? "bg-gold text-black shadow-[0_4px_15px_rgba(212,175,55,0.2)]"
                                        : "bg-white/[0.05] text-white/60 border border-white/[0.04]",
                                    )}
                                  >
                                    <Banknote size={20} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-white/95">Cash on Pickup</p>
                                    <p className="text-[9px] text-white/40 uppercase tracking-[0.16em] mt-0.5">
                                      Pay the driver
                                    </p>
                                  </div>
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="lg:col-span-5 space-y-8 rounded-2xl">
                      {/* Booking Summary Card */}
                      <div className="bg-[#080808]/95 backdrop-blur-3xl p-6 md:p-8 space-y-6 rounded-2xl border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden lg:sticky lg:top-32 group">
                        {/* Subtle gold line at top */}
                        <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>

                        <h3 className="text-gold text-xs uppercase tracking-[0.25em] font-bold mb-6 border-b border-white/[0.06] pb-4 font-display">
                          Booking Summary
                        </h3>
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-5">
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                <Info size={16} className="text-gold" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                  Service
                                </p>
                                <p className="text-white font-semibold text-xs truncate">
                                  {
                                    serviceTypes.find(
                                      (t) => t.id === formData.serviceType,
                                    )?.name
                                  }
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                <Car size={16} className="text-gold" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                  Vehicle
                                </p>
                                <p className="text-white font-semibold text-xs truncate">
                                  {
                                    (
                                      fleet.find(
                                        (v) => v.id === formData.vehicle,
                                      ) ||
                                      vehicles.find(
                                        (v) => v.id === formData.vehicle,
                                      )
                                    )?.name
                                  }
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                <Calendar size={16} className="text-gold" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                  Pickup Date
                                </p>
                                <p className="text-white font-semibold text-xs truncate">
                                  {formatDateWithWeekday(formData.date)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                <Clock size={16} className="text-gold" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                  Pickup Time
                                </p>
                                <p className="text-white font-semibold text-xs truncate">
                                  {formatTime12h(formData.time)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="pt-6 border-t border-white/[0.06] space-y-4">
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                <MapPin size={16} className="text-gold" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                  Pickup
                                </p>
                                <p className="text-white text-xs leading-relaxed font-medium">
                                  {formData.pickup}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                <MapPin size={16} className="text-gold" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                  Dropoff
                                </p>
                                <p className="text-white text-xs leading-relaxed font-medium">
                                  {formData.dropoff || "Hourly Hire"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {formData.waypoints.filter((wp) => wp.length > 5)
                            .length > 0 && (
                              <div className="pt-6 border-t border-white/[0.06]">
                                <div className="flex items-start gap-3.5">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                    <Navigation size={16} className="text-gold" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-2">
                                      Waypoints
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {formData.waypoints
                                        .filter((wp) => wp.length > 5)
                                        .map((wp, idx) => (
                                          <span
                                            key={idx}
                                            className="bg-white/5 border border-white/[0.08] px-2.5 py-1 rounded-lg text-[10px] text-white/70 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px] inline-block"
                                          >
                                            {wp}
                                          </span>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                          {formData.selectedExtras.length > 0 && (
                            <div className="pt-6 border-t border-white/[0.06]">
                              <div className="flex items-start gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                  <Plus size={16} className="text-gold" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-2">
                                    Extras
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {formData.selectedExtras.map((id) => {
                                      const extra = extras.find(
                                        (e) => e.id === id,
                                      );
                                      return (
                                        <span
                                          key={id}
                                          className="bg-white/5 border border-white/[0.08] px-2.5 py-1 rounded-lg text-[10px] text-white/70 font-medium"
                                        >
                                          {extra?.name}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {formData.isReturn && (
                            <div className="pt-6 border-t border-white/[0.06]">
                              <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                  <RotateCcw size={16} className="text-gold" />
                                </div>
                                <div>
                                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                    Return Trip
                                  </p>
                                  <p className="text-[11px] text-white/95 font-medium leading-normal">
                                    {formatDateWithWeekday(formData.returnDate)} at {formatTime12h(formData.returnTime)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="pt-6 border-t border-white/[0.06] grid grid-cols-2 gap-5">
                            {formData.serviceType !== "hourly" ? (
                              <>
                                {/* Distance */}
                                {distance && (
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                      <Navigation size={16} className="text-gold" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                        Distance
                                      </p>
                                      <p className="text-white font-semibold text-xs leading-normal">
                                        {(() => {
                                          const distVal =
                                            parseFloat(distance.replace(/[^\d.]/g, "")) || 0;
                                          return formData.isReturn
                                            ? `${(distVal * 2).toFixed(1)} km`
                                            : distance;
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                )}

                                {/* Est. Time */}
                                {duration && (
                                  <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                      <Clock size={16} className="text-gold" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                        Est. Time
                                      </p>
                                      <p className="text-white font-semibold text-xs leading-normal">
                                        {(() => {
                                          const match = duration.match(/(\d+)\s*min/);
                                          if (match && formData.isReturn) {
                                            const mins = parseInt(match[1]);
                                            return `${mins * 2} mins`;
                                          }
                                          return duration;
                                        })()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              /* Travelling Hours (Hourly Service) */
                              <div className="flex items-center gap-3.5">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold/15 to-gold/5 flex items-center justify-center border border-gold/10 hover:border-gold/30 transition-colors duration-300 shrink-0">
                                  <Clock size={16} className="text-gold" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/35 font-bold mb-0.5">
                                    Travel Hours
                                  </p>
                                  <p className="text-white font-semibold text-xs leading-normal">
                                    {formData.hours} Hours
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Price Breakdown */}
                          {settings?.showPriceBreakdown !== false && (
                            <div className="space-y-3 pt-4 border-t border-white/[0.06]">
                              <h3 className="text-gold text-[10px] uppercase tracking-[0.2em] font-bold mb-3">
                                Price Breakdown
                              </h3>
                              {(() => {
                                const details = calculatePrice(formData.vehicle);
                                return (
                                  <>
                                    {settings?.showBasePrice !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Base Fare</span>
                                        <span className="font-display font-medium text-white/90">${details.base.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showDistancePrice !== false && (
                                      <div className="space-y-2 border-b border-white/[0.03] last:border-0 pb-1.5 font-display">
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1">
                                          {/* Left side: Label + Eye icon */}
                                          <div className="flex items-center gap-2">
                                            <span>
                                              {formData.serviceType === "hourly"
                                                ? `Hourly Charge (${formData.hours}h)`
                                                : "Distance Charge"}
                                            </span>

                                            {settings?.showDistanceEyeIcon && (
                                              <button
                                                onClick={() =>
                                                  setShowDistanceBreakdown(
                                                    !showDistanceBreakdown,
                                                  )
                                                }
                                                className={cn(
                                                  "flex items-center gap-1.5 text-gold/60 hover:text-gold transition-all duration-300",
                                                  showDistanceBreakdown &&
                                                  "text-gold font-medium",
                                                )}
                                                title="View Range Wise Price"
                                              >
                                                <Eye size={12} />
                                              </button>
                                            )}
                                          </div>

                                          {/* Right side: Value */}
                                          <span className="font-display font-medium text-white/90">
                                            ${details.distance.toFixed(2)}
                                          </span>
                                        </div>

                                        {showDistanceBreakdown &&
                                          details.rangeCalcs &&
                                          details.rangeCalcs.length > 0 && (
                                            <div className="p-4 bg-[#050505]/95 rounded-xl border border-gold/15 space-y-2.5 my-3 shadow-inner">
                                              <div className="flex items-center justify-between mb-1.5 border-b border-white/5 pb-1.5">
                                                <h4 className="text-[9px] uppercase tracking-[0.2em] font-bold text-gold font-display">
                                                  {formData.serviceType ===
                                                    "hourly"
                                                    ? "Hourly Price Calculation"
                                                    : "Distance Range Calculation"}
                                                </h4>
                                                <span className="text-[8px] bg-gold/10 text-gold px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                                                  {formData.serviceType ===
                                                    "hourly"
                                                    ? "Fixed Hourly"
                                                    : settings?.distanceCalculationType ===
                                                      "type2"
                                                      ? "Type 2: Cumulative"
                                                      : "Type 1: Range Rate"}
                                                </span>
                                              </div>
                                              <div className="space-y-2">
                                                {details.rangeCalcs.map(
                                                  (calc: any, i: number) => (
                                                    <div
                                                      key={i}
                                                      className="flex justify-between items-center text-[10px] tracking-wide font-display"
                                                    >
                                                      <div className="flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-gold/70" />
                                                        <span className="text-white font-medium uppercase tracking-[0.05em]">
                                                          {calc.label}{" "}
                                                          {calc.isHourly
                                                            ? ""
                                                            : "Range"}
                                                        </span>
                                                        <span className="text-white/40 text-[9px]">
                                                          ({calc.dist.toFixed(1)}
                                                          {calc.isHourly
                                                            ? "h"
                                                            : "km"}{" "}
                                                          × ${calc.rate})
                                                        </span>
                                                      </div>
                                                      <span className="text-white/95 font-semibold">
                                                        ${calc.total.toFixed(2)}
                                                      </span>
                                                    </div>
                                                  ),
                                                )}
                                                <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                                  <span className="text-[9px] text-gold font-bold uppercase tracking-widest">
                                                    {formData.serviceType ===
                                                      "hourly"
                                                      ? "Total Hourly Charge"
                                                      : "Total Distance Charge"}
                                                  </span>
                                                  <span className="text-xs text-gold font-bold">
                                                    ${details.distance.toFixed(2)}
                                                  </span>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    )}
                                    {settings?.showWaypointPrice !== false &&
                                      details.waypoints > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                          <span>Waypoints</span>
                                          <span className="font-display font-medium text-white/90">
                                            ${details.waypoints.toFixed(2)}
                                          </span>
                                        </div>
                                      )}

                                    {formData.isReturn && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Return Trip (2x)</span>
                                        <span className="font-display font-medium text-white/90">
                                          ${details.returnPrice.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                    {settings?.showExtrasPrice !== false &&
                                      details.extras > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                          <span>Extra Options</span>
                                          <span className="font-display font-medium text-white/90">
                                            ${details.extras.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    {settings?.showGrossPrice !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Gross Price</span>
                                        <span className="font-display font-medium text-white/90">${details.gross.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showDiscount !== false &&
                                      details.discount > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-[#10B981] font-medium py-1.5 border-b border-white/[0.03]">
                                          <span>
                                            Discount ({appliedCoupon?.code} -{" "}
                                            {appliedCoupon?.type === "percentage"
                                              ? `${appliedCoupon.value}%`
                                              : `$${appliedCoupon.value}`}
                                            )
                                          </span>
                                          <span className="font-semibold text-[#10B981]">
                                            -${details.discount.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    {settings?.showNetPrice !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-gold/50 font-bold py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>Net Price</span>
                                        <span className="font-display font-medium text-gold/50 font-bold">${details.net.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showTax !== false && (
                                      <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                        <span>
                                          Tax ({settings?.taxPercentage || 0}%)
                                        </span>
                                        <span className="font-display font-medium text-white/90">${details.tax.toFixed(2)}</span>
                                      </div>
                                    )}
                                    {settings?.showStripeFees !== false &&
                                      details.stripe > 0 && (
                                        <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-white/50 py-1.5 border-b border-white/[0.03] transition-colors hover:text-white/80">
                                          <span>Stripe Fees</span>
                                          <span className="font-display font-medium text-white/90 font-semibold">
                                            ${details.stripe.toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    {details.appliedAddons && details.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).length > 0 && (
                                      <div className="space-y-1.5 py-1.5 border-b border-white/[0.03]">
                                        {details.appliedAddons.filter((addon: any) => !addon.hideLabelInBreakdown).map((addon: any, aIdx: number) => (
                                          <div key={`addon-cust-${addon.id || aIdx}-${aIdx}`} className="py-1">
                                            <div className="flex justify-between items-center text-[10px] uppercase tracking-[0.16em] text-gold/60 font-display">
                                              <span>{addon.name}</span>
                                              <span className="font-display font-medium font-semibold">
                                                {addon.impact > 0 ? '+' : '-'}${Math.abs(addon.impact).toFixed(2)}
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

                                    {settings?.showTotalPrice !== false && (
                                      <div className="flex justify-between items-center pt-5 pb-1">
                                        <span className="text-white font-bold text-xs uppercase tracking-[0.2em]">
                                          Total Price
                                        </span>
                                        <span className="text-gold font-display font-semibold text-2xl tracking-widest leading-none">
                                          ${details.total.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-[#050505]/60 backdrop-blur-md p-5 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center sm:justify-between rounded-2xl border border-white/[0.06] shadow-xl max-sm:bg-transparent max-sm:border-none max-sm:backdrop-blur-none max-sm:p-0">
                    <div className="rounded-xl sm:p-0 sm:bg-transparent sm:border-none sm:backdrop-blur-none sm:shadow-none">
                      <button
                        onClick={prevStep}
                        className="w-full sm:w-auto border border-white/20 text-white/50 hover:text-white hover:border-gold/50 text-[10px] uppercase font-bold tracking-[0.2em] transition-all duration-300 py-3.5 px-8 flex items-center justify-center gap-2.5 rounded-xl active:scale-95 bg-black/40 hover:bg-black/80"
                      >
                        <ArrowLeft size={14} />
                        Back
                      </button>
                    </div>
                    <div className="rounded-xl sm:p-0 sm:bg-transparent sm:border-none sm:backdrop-blur-none sm:shadow-none">
                      <button
                        onClick={handleConfirmBooking}
                        disabled={
                          isSubmitting ||
                          (!user &&
                            (!formData.customerName ||
                              !formData.customerEmail ||
                              !formData.customerPhone ||
                              !formData.customerPassword))
                        }
                        className="w-full sm:w-auto bg-gradient-to-r from-gold to-[#D4AF37] hover:from-white hover:to-white text-black py-4 px-12 flex items-center justify-center gap-2.5 rounded-xl text-xs uppercase font-bold tracking-[0.2em] transition-all duration-300 active:scale-[0.98] disabled:opacity-40 shadow-[0_4px_25px_rgba(212,175,55,0.2)]"
                      >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <CircleCheckBig size={16} />
                            {paymentMethod === "card"
                              ? "Pay & Confirm Booking"
                              : "Confirm Booking"}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
