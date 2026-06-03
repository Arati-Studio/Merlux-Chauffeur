import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  format, parse, differenceInMinutes, subDays,
  startOfDay, endOfDay, setMonth, startOfYear,
  endOfMonth, setYear, endOfYear, parseISO,
  isSameMonth, startOfMonth, differenceInCalendarDays
} from 'date-fns';
import {
  BarChart3, Clock, CheckCircle, Truck, ThumbsUp, CheckSquare, XCircle, Plane,
  LayoutGrid, List, ChevronRight, Check, CheckCheck, XSquare, Trash2,
  X, Filter, Search, DollarSign, ArrowDown, ArrowUp, Calendar,
  RotateCcw, LocateFixed, MapPin, Navigation, Car, ThumbsDown, Edit2,
  CalendarArrowDown, CalendarArrowUp, RefreshCw, Blocks, Map as MapIcon,
  Globe, Mail, Phone, Eye, Star, User, UserMinus, SquarePen, AlertTriangle,
  ChevronDown, CheckSquare as CheckCloud, Route as RouteIcon, ArrowRight, Bell, CreditCard,
  Square, SquareCheck, UserCheck, Plus, CircleX, Loader2, MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import RouteMap from './RouteMap';
import ConfirmationModal from './ConfirmationModal';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  doc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
  getDoc, collection, query, where, orderBy, onSnapshot, limit,
  addDoc, getDocs
} from 'firebase/firestore';
const getServices = async () => {
  const [{ smsService }, { emailService }] = await Promise.all([
    import('../../services/smsService'),
    import('../../services/emailService')
  ]);
  return { smsService, emailService };
};

import BookingChat from './BookingChat';
import ChatBadge from './ChatBadge';

interface BookingsTabProps {
  isAdmin: boolean;
  isDriver: boolean;
  bookings?: any[]; // Now optional
  filteredAndSortedBookings?: any[]; // Now optional
  analytics?: any;
  bookingCategory?: 'standard' | 'offer' | 'tour';
  setBookingCategory?: (cat: 'standard' | 'offer' | 'tour') => void;
  bookingViewMode?: 'grid' | 'table';
  setBookingViewMode?: (mode: 'grid' | 'table') => void;
  bookingTimeFilter?: 'all' | '3d' | '7d' | '30d' | 'month' | 'year';
  setBookingTimeFilter?: (filter: 'all' | '3d' | '7d' | '30d' | 'month' | 'year') => void;
  bookingYearRange?: { start: number; end: number };
  setBookingYearRange?: (range: { start: number; end: number } | ((prev: { start: number; end: number }) => { start: number; end: number })) => void;
  bookingMonthRange?: { start: string; end: string };
  setBookingMonthRange?: (range: { start: string; end: string } | ((prev: { start: string; end: string }) => { start: string; end: string })) => void;
  bookingDateTypeFilter?: 'pickup' | 'booking';
  setBookingDateTypeFilter?: (type: 'pickup' | 'booking') => void;
  showDashboardNotice: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
  user: any;
  userProfile: any;
  setConfirmDelete: (val: any) => void;
}

export default function BookingsTab({
  isAdmin,
  isDriver,
  bookings: initialBookings,
  user,
  userProfile,
  showDashboardNotice,
  setConfirmDelete
}: BookingsTabProps) {
  const [bookings, setBookings] = useState<any[]>(initialBookings || []);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  // Local UI State (previously in AppDashboard)
  const [bookingCategory, setBookingCategory] = useState<'standard' | 'offer' | 'tour'>('standard');
  const [bookingViewMode, setBookingViewMode] = useState<'grid' | 'table'>('grid');
  const [bookingTimeFilter, setBookingTimeFilter] = useState<'all' | '3d' | '7d' | '30d' | 'month' | 'year'>('all');
  const [bookingYearRange, setBookingYearRange] = useState(() => {
    const currentYear = new Date().getFullYear();
    return { start: currentYear, end: currentYear };
  });
  const [bookingMonthRange, setBookingMonthRange] = useState(() => {
    const currentMonthStr = (new Date().getMonth() + 1).toString().padStart(2, '0');
    return { start: currentMonthStr, end: currentMonthStr };
  });
  const [bookingDateTypeFilter, setBookingDateTypeFilter] = useState<'pickup' | 'booking'>('pickup');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | null>(null);
  const [dateSort, setDateSort] = useState<'asc' | 'desc' | null>(null);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [isBookingsSelectionMode, setIsBookingsSelectionMode] = useState(false);
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date>(new Date());
  const [fleet, setFleet] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [tours, setTours] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [showNotesPopup, setShowNotesPopup] = useState<string | null>(null);
  const [routeBooking, setRouteBooking] = useState<any>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancellationReasonInput, setCancellationReasonInput] = useState<string>('');
  const [expandedFeedback, setExpandedFeedback] = useState<string[]>([]);
  const navigate = useNavigate();

  // Fetching Logic
  useEffect(() => {
    if (!user || !userProfile) return;
    const q = isAdmin
      ? query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(500))
      : isDriver
        ? query(collection(db, 'bookings'), where('driverId', '==', user.uid), orderBy('createdAt', 'desc'), limit(500))
        : query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLastSyncedAt(new Date());
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), limit(500)), (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeFleet = onSnapshot(collection(db, 'fleet'), (snap) => {
      setFleet(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeExtras = onSnapshot(collection(db, 'extras'), (snap) => {
      setExtras(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeTours = onSnapshot(collection(db, 'tours'), (snap) => {
      setTours(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeOffers = onSnapshot(collection(db, 'offers'), (snap) => {
      setOffers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'system'), (snap) => {
      if (snap.exists()) setSystemSettings(snap.data());
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
      unsubscribeFleet();
      unsubscribeExtras();
      unsubscribeTours();
      unsubscribeOffers();
      unsubscribeSettings();
    };
  }, [user, userProfile, isAdmin, isDriver]);

  const drivers = useMemo(() => allUsers.filter(u => u.role === 'driver' && u.driverVerificationStatus === 'approved'), [allUsers]);

  const handleRefresh = async () => {
    if (!user || !userProfile) return;
    setIsRefreshing(true);
    try {
      const q = isAdmin
        ? query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(500))
        : isDriver
          ? query(collection(db, 'bookings'), where('driverId', '==', user.uid), orderBy('createdAt', 'desc'), limit(500))
          : query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(500));

      const [bookingsSnap, usersSnap, fleetSnap, extrasSnap, toursSnap, offersSnap, settingsSnap] = await Promise.all([
        getDocs(q),
        getDocs(query(collection(db, 'users'), limit(500))),
        getDocs(collection(db, 'fleet')),
        getDocs(collection(db, 'extras')),
        getDocs(collection(db, 'tours')),
        getDocs(collection(db, 'offers')),
        getDoc(doc(db, 'settings', 'system'))
      ]);

      setBookings(bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setAllUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setFleet(fleetSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setExtras(extrasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setTours(toursSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setOffers(offersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      if (settingsSnap.exists()) {
        setSystemSettings(settingsSnap.data());
      }

      setLastSyncedAt(new Date());
      showDashboardNotice('success', 'Database synchronized successfully.', 'Live Sync Completed');
    } catch (err) {
      console.error('Manual sync failed:', err);
      showDashboardNotice('error', 'Failed to sync with the server. Please try again.', 'Sync Error');
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setServiceFilter('all');
    setTypeFilter('all');
    setBookingCategory('standard');
    setPriceSort(null);
    setDateSort(null);
    setBookingTimeFilter('all');
  };

  const formatTimeToAMPM = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) return timeStr;
      const [hours, minutes] = timeStr.split(':');
      let h = parseInt(hours);
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return `${h}:${minutes} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  const analytics = useMemo(() => {
    const completed = bookings.filter(b => b.status === 'completed');
    const paid = bookings.filter(b => b.paymentStatus === 'paid');
    const monthStart = startOfMonth(new Date());
    const monthBookings = bookings.filter(b => b.date && isSameMonth(parseISO(b.date), monthStart));

    return {
      completedBookings: completed.length,
      pendingBookings: bookings.filter(b => b.status === 'pending').length,
      cancelledBookings: bookings.filter(b => b.status === 'cancelled').length,
      confirmedBookings: bookings.filter(b => b.status === 'confirmed').length,
      assignedBookings: bookings.filter(b => b.status === 'assigned').length,
      acceptedBookings: bookings.filter(b => b.status === 'accepted').length,
      totalRevenue: bookings.filter(b => b.paymentStatus === 'paid' || b.status === 'completed').reduce((sum, b) => sum + (Number(b.price) || 0), 0),
      currentMonthCount: monthBookings.length,
      currentMonthRevenue: monthBookings.filter(b => b.paymentStatus === 'paid' || b.status === 'completed').reduce((sum, b) => sum + (Number(b.price) || 0), 0)
    };
  }, [bookings]);

  const filteredAndSortedBookings = useMemo(() => {
    let result = [...bookings];

    // Filter by Category
    if (bookingCategory === 'offer') result = result.filter(b => b.offerId || b.type === 'offer');
    else if (bookingCategory === 'tour') result = result.filter(b => b.tourId || b.type === 'tour');
    else result = result.filter(b => !b.offerId && !b.tourId && b.type !== 'offer' && b.type !== 'tour');

    // Helper to extract clean date objects based on selected date type
    const getBookingDateObject = (b: any) => {
      if (bookingDateTypeFilter === 'booking') {
        if (b.createdAt) {
          if (b.createdAt.seconds) {
            return new Date(b.createdAt.seconds * 1000);
          }
          if (typeof b.createdAt.toDate === 'function') {
            return b.createdAt.toDate();
          }
          const parsed = new Date(b.createdAt);
          if (!isNaN(parsed.getTime())) return parsed;
        }
        return null;
      } else {
        if (b.date) {
          // parse using string splits to prevent timezone locale offsets
          const parts = b.date.split('-');
          if (parts.length === 3) {
            const year = parseInt(parts[0], 10);
            const month = parseInt(parts[1], 10) - 1;
            const day = parseInt(parts[2], 10);
            return new Date(year, month, day);
          }
          const parsed = new Date(b.date);
          if (!isNaN(parsed.getTime())) return parsed;
        }
        return null;
      }
    };

    // Apply Time Filters
    if (bookingTimeFilter !== 'all') {
      const today = new Date();
      
      result = result.filter(b => {
        const bDate = getBookingDateObject(b);
        if (!bDate) return false;

        if (bookingTimeFilter === '3d') {
          // Absolute difference of booking date relative to current time <= 3 days
          const diffTime = Math.abs(bDate.getTime() - today.getTime());
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          return diffDays <= 3;
        }
        if (bookingTimeFilter === '7d') {
          // Absolute difference <= 7 days
          const diffTime = Math.abs(bDate.getTime() - today.getTime());
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          return diffDays <= 7;
        }
        if (bookingTimeFilter === '30d') {
          // Absolute difference <= 30 days
          const diffTime = Math.abs(bDate.getTime() - today.getTime());
          const diffDays = diffTime / (1000 * 60 * 60 * 24);
          return diffDays <= 30;
        }
        if (bookingTimeFilter === 'month') {
          // Filters by selected start & end months in the CURRENT YEAR
          const currentYearVal = today.getFullYear();
          const startMonthInt = parseInt(bookingMonthRange.start, 10);
          const endMonthInt = parseInt(bookingMonthRange.end, 10);
          
          const y = bDate.getFullYear();
          const m = bDate.getMonth() + 1; // 1-indexed

          if (y !== currentYearVal) return false;
          return m >= startMonthInt && m <= endMonthInt;
        }
        if (bookingTimeFilter === 'year') {
          // Filters within the selected year range
          const y = bDate.getFullYear();
          return y >= bookingYearRange.start && y <= bookingYearRange.end;
        }
        return true;
      });
    }

    // Apply Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(b =>
        (b.customerName?.toLowerCase().includes(q)) ||
        (b.id?.toLowerCase().includes(q)) ||
        (b.pickup?.toLowerCase().includes(q)) ||
        (b.dropoff?.toLowerCase().includes(q))
      );
    }

    // Apply Status Filter
    if (statusFilter !== 'all') {
      result = result.filter(b => b.status === statusFilter);
    }

    // Apply Sorting
    result.sort((a, b) => {
      let dateA = 0;
      let dateB = 0;

      const dateObjA = getBookingDateObject(a);
      const dateObjB = getBookingDateObject(b);

      if (dateObjA) dateA = dateObjA.getTime() / 1000;
      if (dateObjB) dateB = dateObjB.getTime() / 1000;

      if (!dateSort) return 0;
      return dateSort === 'asc' ? dateA - dateB : dateB - dateA;
    });

    return result;
  }, [
    bookings,
    bookingCategory,
    searchQuery,
    statusFilter,
    dateSort,
    bookingDateTypeFilter,
    bookingTimeFilter,
    bookingYearRange,
    bookingMonthRange
  ]);

  const updateBookingStatus = async (bookingId: string, status: string, driverId?: string) => {
    try {
      const updateData: any = { status, updatedAt: serverTimestamp() };
      if (status === 'completed') {
        updateData.completedAt = serverTimestamp();
      }
      if (driverId !== undefined) updateData.driverId = driverId;
      await updateDoc(doc(db, 'bookings', bookingId), updateData);
      showDashboardNotice('success', `Booking status updated to ${status}`);

      // Dispatch notifications
      try {
        const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
        if (bookingSnap.exists()) {
          const bookingData = { id: bookingId, ...bookingSnap.data(), ...updateData };
          const eventName = `status_${status}`;
          const { smsService, emailService } = await getServices();
          await Promise.all([
            smsService.notify(eventName, bookingData),
            emailService.notify(eventName, bookingData)
          ]);
        }
      } catch (notifyErr) {
        console.error('Error sending status update notifications:', notifyErr);
      }
    } catch (err) {
      console.error('Error updating booking status:', err);
      showDashboardNotice('error', 'Failed to update booking status');
    }
  };

  const updateBookingCancelledStatus = async (bookingId: string, reason: string) => {
    try {
      const updateData = {
        status: 'cancelled',
        cancellationReason: reason,
        updatedAt: serverTimestamp()
      };
      await updateDoc(doc(db, 'bookings', bookingId), updateData);
      showDashboardNotice('success', 'Booking has been officially cancelled.');

      // Dispatch notifications
      try {
        const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
        if (bookingSnap.exists()) {
          const bookingData = {
            id: bookingId,
            ...bookingSnap.data(),
            ...updateData
          };
          const eventName = 'status_cancelled';
          const { smsService, emailService } = await getServices();
          await Promise.all([
            smsService.notify(eventName, bookingData),
            emailService.notify(eventName, bookingData)
          ]);
        }
      } catch (notifyErr) {
        console.error('Error sending cancellation notifications:', notifyErr);
      }
    } catch (err) {
      console.error('Error cancelling booking:', err);
      showDashboardNotice('error', 'Failed to cancel booking');
    }
  };

  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [chatBooking, setChatBooking] = useState<any | null>(null);
  const [showDistanceBreakdown, setShowDistanceBreakdown] = useState(false);
  const [showWaypointsPopup, setShowWaypointsPopup] = useState<string | null>(null);
  const [showExtrasPopup, setShowExtrasPopup] = useState<string | null>(null);
  const [showDriverBulkAssign, setShowDriverBulkAssign] = useState(false);
  const [localDrivers, setLocalDrivers] = useState<any[]>([]);

  // Optimized driver fetching for customers
  useEffect(() => {
    if (!user || userProfile?.role === 'admin' || bookings.length === 0) return;

    const driverIds = Array.from(new Set(bookings.map(b => b.driverId).filter(Boolean)));
    if (driverIds.length > 0) {
      const fetchDrivers = async () => {
        try {
          const driverDocs = await Promise.all(
            driverIds.slice(0, 15).map(id => getDoc(doc(db, 'users', id)))
          );
          const driversData = driverDocs
            .filter(d => d.exists())
            .map(d => ({ id: d.id, ...d.data() }));

          setLocalDrivers(driversData);
        } catch (err) {
          console.error('Error fetching drivers in BookingsTab:', err);
        }
      };
      fetchDrivers();
    }
  }, [user, userProfile?.role, bookings]);

  // Merge localDrivers with allUsers for display
  const consolidatedUsers = useMemo(() => {
    const userMap = new Map();
    allUsers.forEach(u => userMap.set(u.id, u));
    localDrivers.forEach(u => userMap.set(u.id, u));
    return Array.from(userMap.values());
  }, [allUsers, localDrivers]);

  const isChatAllowed = (booking: any) => {
    if (isAdmin) return true;
    if (booking.status !== 'completed') return true;
    
    // Check completedAt or updatedAt as fallback
    const finishedAt = booking.completedAt || booking.updatedAt;
    if (!finishedAt) return true;
    
    try {
      const completedDate = finishedAt.toDate ? finishedAt.toDate() : new Date(finishedAt);
      const diffDays = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays < 15;
    } catch (e) {
      return true;
    }
  };

  const handleSendEarlyAlert = async (booking: any) => {
    try {
      const driver = consolidatedUsers.find(u => u.id === booking.driverId);
      const { smsService, emailService } = await getServices();
      await Promise.all([
        smsService.notify('pickup_early_alert', {
          ...booking,
          driverName: driver?.name,
          driverPhone: driver?.phone
        }, true),
        emailService.notify('pickup_early_alert', {
          ...booking,
          driverName: driver?.name,
          driverPhone: driver?.phone,
          driverEmail: driver?.email
        }, true)
      ]);
      showDashboardNotice('success', `Early pickup alert sent to ${booking.customerName}`, 'Notification Sent');
    } catch (err: any) {
      showDashboardNotice('error', `Failed to send early alert: ${err.message}`, 'Notification Error');
    }
  };

  // Automatic Early Pickup Alert logic
  useEffect(() => {
    if (bookings.length === 0 || !systemSettings) return;

    const interval = setInterval(async () => {
      const now = new Date();
      const timeGap = systemSettings.earlyAlertTimeGap || 30;

      const upcomingBookings = bookings.filter(b => {
        if (!['confirmed', 'assigned', 'accepted'].includes(b.status)) return false;
        if (b.earlyAlertSentAuto) return false;
        if (!b.date || !b.time) return false;

        try {
          const pickupDateTime = parse(`${b.date} ${b.time}`, 'yyyy-MM-dd HH:mm', new Date());
          const diffMins = differenceInMinutes(pickupDateTime, now);
          return diffMins <= timeGap && diffMins > 0;
        } catch (e) {
          return false;
        }
      });

      for (const booking of upcomingBookings) {
        try {
          const driver = consolidatedUsers.find(u => u.id === booking.driverId);
          const { smsService, emailService } = await getServices();

          await Promise.all([
            smsService.notify('pickup_early_alert', {
              ...booking,
              driverName: driver?.name,
              driverPhone: driver?.phone,
              isAutoAlert: true
            }, true),
            emailService.notify('pickup_early_alert', {
              ...booking,
              driverName: driver?.name,
              driverPhone: driver?.phone,
              driverEmail: driver?.email,
              isAutoAlert: true
            }, true)
          ]);

          await updateDoc(doc(db, 'bookings', booking.id), {
            earlyAlertSentAuto: true,
            earlyAlertSentAt: serverTimestamp()
          });
        } catch (err) {
          console.error('Error sending auto-alert in BookingsTab:', err);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [bookings, systemSettings, consolidatedUsers]);

  // Background check for:
  // 1. Auto-cancelling passed bookings
  // 2. Proactive 14-day and 7-day notifications for pending bookings
  useEffect(() => {
    if (bookings.length === 0) return;

    const runBackgroundChecks = async () => {
      const now = new Date();
      const startOfToday = startOfDay(now);

      for (const booking of bookings) {
        if (!booking.date || !booking.time) continue;

        // Task A: Check if booking is passed and needs auto-cancellation
        if (['pending', 'confirmed', 'assigned', 'accepted'].includes(booking.status)) {
          try {
            const pickupDateTime = parse(`${booking.date} ${booking.time}`, 'yyyy-MM-dd HH:mm', new Date());
            if (pickupDateTime < now) {
              await updateDoc(doc(db, 'bookings', booking.id), {
                status: 'cancelled',
                cancellationReason: 'Booking Pickup date passed',
                updatedAt: serverTimestamp()
              });

              const updatedBookingData = {
                ...booking,
                status: 'cancelled',
                cancellationReason: 'Booking Pickup date passed'
              };

              const { smsService, emailService } = await getServices();
              await Promise.all([
                smsService.notify('status_cancelled', updatedBookingData),
                emailService.notify('status_cancelled', updatedBookingData)
              ]);
              console.log(`Auto-cancelled past booking ${booking.id}`);
              continue; // Avoid triggering pending alerts if cancelled
            }
          } catch (e) {
            // Ignore parse errors for static checks
          }
        }

        // Task B: Proactive 14-day and 7-day alerts to admin for pending bookings
        if (booking.status === 'pending') {
          try {
            const bookingDateParsed = parse(booking.date, 'yyyy-MM-dd', new Date());
            const startOfPickup = startOfDay(bookingDateParsed);
            const diffDays = differenceInCalendarDays(startOfPickup, startOfToday);

            // Generate booking details object with placeholder helpers
            const bookingRefData = {
              bookingId: booking.id,
              ...booking
            };

            if (diffDays === 14 && !booking.alert14DaySent) {
              const { smsService, emailService } = await getServices();
              await Promise.all([
                smsService.notify('pending_ride_alert_14d', bookingRefData),
                emailService.notify('pending_ride_alert_14d', bookingRefData)
              ]);
              await updateDoc(doc(db, 'bookings', booking.id), {
                alert14DaySent: true,
                updatedAt: serverTimestamp()
              });
              console.log(`Sent 14-day admin alert for booking ${booking.id}`);
            } else if (diffDays === 7 && !booking.alert7DaySent) {
              const { smsService, emailService } = await getServices();
              await Promise.all([
                smsService.notify('pending_ride_alert_7d', bookingRefData),
                emailService.notify('pending_ride_alert_7d', bookingRefData)
              ]);
              await updateDoc(doc(db, 'bookings', booking.id), {
                alert7DaySent: true,
                updatedAt: serverTimestamp()
              });
              console.log(`Sent 7-day admin alert for booking ${booking.id}`);
            }
          } catch (e) {
            // Ignore errors for individual booking checks
          }
        }
      }
    };

    runBackgroundChecks();
    const interval = setInterval(runBackgroundChecks, 60000);
    return () => clearInterval(interval);
  }, [bookings]);

  const handleUpdateBooking = async (id: string, data: any) => {
    try {
      const { id: _id, createdAt, updatedAt, ...rest } = data;

      const existingBooking = bookings.find(b => b.id === id);
      const isNewlyCancelled = rest.status === 'cancelled' && existingBooking?.status !== 'cancelled';

      if (rest.status === 'cancelled' && !rest.cancellationReason) {
        rest.cancellationReason = 'Cancelled by Administrator';
      }

      await updateDoc(doc(db, 'bookings', id), {
        ...rest,
        updatedAt: serverTimestamp()
      });

      if (isNewlyCancelled) {
        try {
          const bookingSnap = await getDoc(doc(db, 'bookings', id));
          if (bookingSnap.exists()) {
            const bookingData = {
              id,
              ...bookingSnap.data(),
              ...rest,
              // Use formatted cancellationReason or a good fallback
              cancellationReason: rest.cancellationReason || 'Cancelled by Administrator'
            };

            // Dispatch SMS and Email alerts with cancellation details
            const { smsService, emailService } = await getServices();
            await Promise.all([
              smsService.notify('status_cancelled', bookingData),
              emailService.notify('status_cancelled', bookingData)
            ]);
            console.log('Cancellation notifications dispatched for edited booking:', bookingData);
          }
        } catch (notifyErr) {
          console.error('Error sending cancellation emails/SMS alerts:', notifyErr);
        }
      }

      setShowBookingModal(false);
      setEditingBooking(null);
      showDashboardNotice('success', 'Booking updated successfully.');
    } catch (err) {
      console.error('Error updating booking:', err);
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${id}`);
    }
  };


  const handleRateDriver = async (id: string, rating: number, comment: string) => {
    try {
      await updateDoc(doc(db, 'bookings', id), {
        rating,
        feedback: comment,
        ratingAt: serverTimestamp()
      });

      // Submit feedback also Notify via Email
      try {
        const bookingSnap = await getDoc(doc(db, 'bookings', id));
        if (bookingSnap.exists()) {
          const bookingData = {
            id,
            ...bookingSnap.data(),
            rating,
            feedback: comment,
            ratingValue: rating,
            ratingComment: comment
          };
          const { emailService } = await getServices();
          await emailService.notify('booking_feedback', bookingData);
        }
      } catch (notifyErr) {
        console.error('Error sending feedback email notification:', notifyErr);
      }

      showDashboardNotice('success', 'Thank you for your feedback!');
      setRatingBooking(null);
      setRatingComment('');
      setRatingValue(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${id}/rating`);
    }
  };

  const executeBulkUpdateBookingsStatus = async (ids: string[], status: string) => {
    try {
      const batch = writeBatch(db);
      for (const id of ids) {
        batch.update(doc(db, 'bookings', id), { status, updatedAt: serverTimestamp() });
      }
      await batch.commit();
      setSelectedBookings([]);
      showDashboardNotice('success', `Updated ${ids.length} bookings to ${status}.`);

      // Dispatch notifications in background
      for (const id of ids) {
        try {
          const bookingSnap = await getDoc(doc(db, 'bookings', id));
          if (bookingSnap.exists()) {
            const bookingData = { id, ...bookingSnap.data(), status };
            const eventName = `status_${status}`;
            const { smsService, emailService } = await getServices();
            await Promise.all([
              smsService.notify(eventName, bookingData),
              emailService.notify(eventName, bookingData)
            ]);
          }
        } catch (noteErr) {
          console.error("Bulk status notification error:", noteErr);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'bookings/bulk-status');
    }
  };

  const executeBulkAssignDriver = async (ids: string[], driverId: string | null) => {
    try {
      const batch = writeBatch(db);
      const status = driverId ? 'assigned' : 'confirmed';
      for (const id of ids) {
        batch.update(doc(db, 'bookings', id), { driverId, status, updatedAt: serverTimestamp() });
      }
      await batch.commit();
      setSelectedBookings([]);
      setShowDriverBulkAssign(false);
      showDashboardNotice('success', `Assigned ${ids.length} bookings.`);

      // Dispatch notifications in background
      for (const id of ids) {
        try {
          const bookingSnap = await getDoc(doc(db, 'bookings', id));
          if (bookingSnap.exists()) {
            const bookingData = { id, ...bookingSnap.data(), driverId, status };
            const eventName = `status_${status}`;
            const { smsService, emailService } = await getServices();
            await Promise.all([
              smsService.notify(eventName, bookingData),
              emailService.notify(eventName, bookingData)
            ]);
          }
        } catch (noteErr) {
          console.error("Bulk assign notification error:", noteErr);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'bookings/bulk-assign');
    }
  };

  const driverStats = useMemo(() => {
    const stats: Record<string, { avgRating: string, completedCount: number, rejectedCount: number }> = {};
    (drivers || []).forEach(d => {
      const driverBookings = (bookings || []).filter(b => b.driverId === d.id);
      const completed = driverBookings.filter(b => b.status === 'completed');
      const rejected = driverBookings.filter(b => b.status === 'rejected');
      const rated = completed.filter(b => b.rating);
      const avg = rated.length > 0 ? (rated.reduce((acc, b) => acc + (b.rating || 0), 0) / rated.length).toFixed(1) : '0';
      stats[d.id] = { avgRating: avg, completedCount: completed.length, rejectedCount: rejected.length };
    });
    return stats;
  }, [drivers, bookings]);

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass p-4 rounded-2xl border border-white/5">
            <p className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-2">Total Bookings</p>
            <h3 className="text-2xl font-bold text-gold font-display">{bookings.length}</h3>
            <p className="text-[10px] text-white/60">All Time</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <p className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-2">Total Revenue</p>
            <h3 className="text-2xl font-bold text-green-500 font-display">${Math.round(analytics.totalRevenue)}</h3>
            <p className="text-[10px] text-white/60">From Completed Bookings</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <p className="text-[9px] uppercase tracking-widest font-bold text-white/40 mb-2">This Month</p>
            <h3 className="text-2xl font-bold text-blue-500 font-display">{analytics.currentMonthCount}</h3>
            <p className="text-[10px] text-white/60">${Math.round(analytics.currentMonthRevenue || 0)} revenue</p>
          </div>
          <div className="glass p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between items-center mb-3">
              <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">Status Overview</p>
              <div className="p-1.5 bg-gold/10 text-gold rounded-xl">
                <BarChart3 size={12} />
              </div>
            </div>
            <div className="grid mt-2 grid-cols-3 sm:grid-cols-6 gap-x-4 text-center">
              <div className="flex flex-col items-center">
                <Clock size={12} className="text-gold mb-2" />
                <span className="text-xs font-display text-gold">{analytics.pendingBookings}</span>
              </div>
              <div className="flex flex-col items-center">
                <CheckCircle size={12} className="text-blue-400 mb-2" />
                <span className="text-xs font-display text-blue-400">{analytics.confirmedBookings}</span>
              </div>
              <div className="flex flex-col items-center">
                <Truck size={12} className="text-purple-400 mb-2" />
                <span className="text-xs font-display text-purple-400">{analytics.assignedBookings}</span>
              </div>
              <div className="flex flex-col items-center">
                <ThumbsUp size={12} className="text-cyan-400 mb-2" />
                <span className="text-xs font-display text-cyan-400">{analytics.acceptedBookings}</span>
              </div>
              <div className="flex flex-col items-center">
                <CheckSquare size={12} className="text-green-400 mb-2" />
                <span className="text-xs font-display text-green-400">{analytics.completedBookings}</span>
              </div>
              <div className="flex flex-col items-center">
                <XCircle size={12} className="text-red-400 mb-2" />
                <span className="text-xs font-display text-red-400">{analytics.cancelledBookings}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <h2 className="text-2xl font-display text-gold">Bookings</h2>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-2 py-1 rounded-full text-[10px] font-bold text-white/50">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Live Sync : <span className="text-white/80">{format(lastSyncedAt, 'dd-MM-yyyy HH:mm:ss')}</span></span>
                <span className="text-white/10">|</span>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-gold hover:text-white transition-all underline outline-none cursor-pointer font-bold uppercase tracking-wider text-[10px] disabled:opacity-50 inline-flex items-center gap-1"
                >
                  {isRefreshing ? (
                    <>
                      <RefreshCw size={12} className="animate-spin" />
                    </>
                  ) : (
                    <>
                      <RefreshCw size={12} />
                    </>
                  )}
                </button>
              </div>
            </div>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mt-1">Manage and track all rides</p>
          </div>
        </div>
        <div className="flex flex-col xl:flex-row xl:items-center gap-4 w-full">
          <div className="flex flex-wrap items-center gap-4 shrink-0">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9">
              {[
                { id: 'standard', label: 'Standard', count: bookings.filter(b => !b.offerId && !b.tourId && b.type !== 'offer' && b.type !== 'tour').length },
                { id: 'offer', label: 'Offers', count: bookings.filter(b => b.offerId || b.type === 'offer').length },
                { id: 'tour', label: 'Tours', count: bookings.filter(b => b.tourId || b.type === 'tour').length }
              ].map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setBookingCategory(cat.id as any)}
                  className={cn(
                    "px-4 py-1 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                    bookingCategory === cat.id ? "bg-gold text-black shadow-lg" : "text-white/40 hover:text-white"
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    {cat.label} <span className={cn("px-1.5 py-0.5 rounded text-[9px]", bookingCategory === cat.id ? "bg-black/20 text-black" : "bg-white/10 text-white/60")}>{cat.count}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9">
              <button
                onClick={() => setBookingViewMode('grid')}
                className={cn("px-3 py-1 rounded-lg transition-all", bookingViewMode === 'grid' ? "bg-gold text-black shadow-lg" : "text-white/40 hover:text-white")}
                title="Grid View"
              ><LayoutGrid size={14} /></button>
              <button
                onClick={() => setBookingViewMode('table')}
                className={cn("px-3 py-1 rounded-lg transition-all", bookingViewMode === 'table' ? "bg-gold text-black shadow-lg" : "text-white/40 hover:text-white")}
                title="Table View"
              ><List size={14} /></button>
            </div>
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className={cn("p-2 rounded-xl border border-white/5 bg-white/5 text-gold hover:bg-white/10 transition-all shrink-0", isFiltersExpanded ? "rotate-180" : "")}
              title={isFiltersExpanded ? "Collapse Filters" : "Expand Filters"}
            ><ChevronRight size={16} /></button>
          </div>
          {/* Right side: Day/Time filters + Bulk Actions */}
          <div className="flex flex-1 items-center min-w-0">
            <AnimatePresence>
              {isFiltersExpanded && (
                <motion.div
                  key="filters-expanded-container"
                  initial={{ opacity: 0, x: -20, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: '100%' }}
                  exit={{ opacity: 0, x: -20, width: 0 }}
                  className="flex flex-row flex-wrap items-center xl:justify-between w-full gap-4 pb-1 xl:pb-0"
                >
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9 mr-2">
                    {(() => {
                      const selectableBookings = filteredAndSortedBookings.filter((b: any) => b.status !== 'completed' && b.status !== 'cancelled');
                      const allSelected = isBookingsSelectionMode && selectableBookings.length > 0 && selectedBookings.length === selectableBookings.length;
                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setIsBookingsSelectionMode(!isBookingsSelectionMode);
                              setSelectedBookings([]);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                              isBookingsSelectionMode && !allSelected ? "bg-gold text-black" : "text-white/40 hover:text-white"
                            )}
                            title="Selection Mode ON"
                          >
                            <Check size={14} />
                            <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">Select</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsBookingsSelectionMode(true);
                              setSelectedBookings(selectableBookings.map((b: any) => b.id));
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                              allSelected ? "bg-gold text-black" : "text-white/40 hover:text-white"
                            )}
                            title="Select All"
                          >
                            <CheckCheck size={14} />
                            <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">All</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>


                  {/* Bulk Management handles in floating bottom bar */}
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9 overflow-x-auto custom-scrollbar max-w-full xl:w-auto">
                    {[
                      { label: 'All', value: 'all' },
                      { label: '3D', value: '3d' },
                      { label: '7D', value: '7d' },
                      { label: '30D', value: '30d' },
                      { label: 'Month', value: 'month' },
                      { label: 'Year', value: 'year' }
                    ].map((opt) => (
                      <button
                        key={`tab-time-${opt.value}`}
                        onClick={() => setBookingTimeFilter(opt.value as any)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                          bookingTimeFilter === opt.value
                            ? "bg-gold text-black shadow-lg"
                            : "text-white/40 hover:text-white"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {/* Year range select */}
                  {bookingTimeFilter === 'year' && (
                    <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/10 h-9">
                      {/* start year */}
                      <select
                        value={bookingYearRange.start}
                        onChange={(e) =>
                          setBookingYearRange((prev) => ({
                            ...prev,
                            start: parseInt(e.target.value),
                          }))
                        }
                        className="custom-select bg-transparent text-[10px] text-white/70 border-none outline-none pl-1.5 pr-6 cursor-pointer font-bold"
                        style={{ backgroundPosition: 'right 0.35rem center', backgroundSize: '0.65rem' }}
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                          <option key={y} value={y} className="bg-black text-white">
                            {y}
                          </option>
                        ))}
                      </select>
                      <span className="text-white/20 text-[10px]">-</span>
                      {/* end year */}
                      <select
                        value={bookingYearRange.end}
                        onChange={(e) =>
                          setBookingYearRange((prev) => ({
                            ...prev,
                            end: parseInt(e.target.value),
                          }))
                        }
                        className="custom-select bg-transparent text-[10px] text-white/70 border-none outline-none pl-1.5 pr-6 cursor-pointer font-bold"
                        style={{ backgroundPosition: 'right 0.35rem center', backgroundSize: '0.65rem' }}
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                          <option key={y} value={y} className="bg-black text-white">
                            {y}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Month range inputs */}
                  {bookingTimeFilter === 'month' && (
                    <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-xl border border-white/10 h-9">
                      <select
                        value={bookingMonthRange.start}
                        onChange={(e) =>
                          setBookingMonthRange((prev) => ({
                            ...prev,
                            start: e.target.value,
                          }))
                        }
                        className="custom-select bg-transparent text-[10px] text-white/70 border-none outline-none pl-1.5 pr-6 cursor-pointer font-bold"
                        style={{ backgroundPosition: 'right 0.35rem center', backgroundSize: '0.65rem' }}
                      >
                        {[
                          { val: '01', label: 'Jan' },
                          { val: '02', label: 'Feb' },
                          { val: '03', label: 'Mar' },
                          { val: '04', label: 'Apr' },
                          { val: '05', label: 'May' },
                          { val: '06', label: 'Jun' },
                          { val: '07', label: 'Jul' },
                          { val: '08', label: 'Aug' },
                          { val: '09', label: 'Sep' },
                          { val: '10', label: 'Oct' },
                          { val: '11', label: 'Nov' },
                          { val: '12', label: 'Dec' },
                        ].map((m) => (
                          <option key={m.val} value={m.val} className="bg-black text-white">
                            {m.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-white/20 text-[10px]">-</span>
                      <select
                        value={bookingMonthRange.end}
                        onChange={(e) =>
                          setBookingMonthRange((prev) => ({
                            ...prev,
                            end: e.target.value,
                          }))
                        }
                        className="custom-select bg-transparent text-[10px] text-white/70 border-none outline-none pl-1.5 pr-6 cursor-pointer font-bold"
                        style={{ backgroundPosition: 'right 0.35rem center', backgroundSize: '0.65rem' }}
                      >
                        {[
                          { val: '01', label: 'Jan' },
                          { val: '02', label: 'Feb' },
                          { val: '03', label: 'Mar' },
                          { val: '04', label: 'Apr' },
                          { val: '05', label: 'May' },
                          { val: '06', label: 'Jun' },
                          { val: '07', label: 'Jul' },
                          { val: '08', label: 'Aug' },
                          { val: '09', label: 'Sep' },
                          { val: '10', label: 'Oct' },
                          { val: '11', label: 'Nov' },
                          { val: '12', label: 'Dec' },
                        ].map((m) => (
                          <option key={m.val} value={m.val} className="bg-black text-white">
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Pickup / Booking toggle */}
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9">
                    <button
                      onClick={() => setBookingDateTypeFilter('pickup')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all",
                        bookingDateTypeFilter === 'pickup'
                          ? "bg-gold text-black shadow-lg"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      Pickup
                    </button>
                    <button
                      onClick={() => setBookingDateTypeFilter('booking')}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all",
                        bookingDateTypeFilter === 'booking'
                          ? "bg-gold text-black shadow-lg"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      Booking
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
          <input type="text" placeholder="Search bookings..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"><X size={12} /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="custom-select min-w-[120px]">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="assigned">Assigned</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select value={serviceFilter} onChange={(e) => setServiceFilter(e.target.value)} className="custom-select min-w-[120px]">
            <option value="all">All Services</option>
            <option value="wedding">Wedding</option>
            <option value="occasions">Special Occasions</option>
            <option value="hourly">Hourly</option>
            <option value="event">Event</option>
            <option value="airport">Airport</option>
            <option value="corporate">Corporate</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { setPriceSort(prev => prev === 'asc' ? 'desc' : 'asc'); setDateSort(null); }} className={cn("p-2 rounded-xl border transition-all flex items-center gap-1.5", priceSort ? "border-gold/50 bg-gold/10 text-gold" : "border-white/10 bg-black/20 text-white/40")} title="Sort by Price">
            <DollarSign size={14} /> {priceSort === 'asc' ? <ArrowDown size={10} /> : priceSort === 'desc' ? <ArrowUp size={10} /> : null}
          </button>
          <button onClick={() => { setDateSort(prev => prev === 'asc' ? 'desc' : 'asc'); setPriceSort(null); }} className={cn("p-2 rounded-xl border transition-all flex items-center gap-1.5", dateSort ? "border-gold/50 bg-gold/10 text-gold" : "border-white/10 bg-black/20 text-white/40")} title={`Sort by Date (${dateSort === 'desc' ? 'Newest' : 'Oldest'})`}>
            {dateSort === 'asc' ? <CalendarArrowUp size={16} /> : dateSort === 'desc' ? <CalendarArrowDown size={16} /> : <Calendar size={14} />}
          </button>
        </div>
        <button onClick={handleRefresh} className="p-2 rounded-xl border border-white/10 bg-black/20 text-white/40 hover:text-gold transition-all"><RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} /></button>
        {(searchQuery || priceSort || dateSort || statusFilter !== 'all' || typeFilter !== 'all' || serviceFilter !== 'all') && (
          <button
            onClick={clearFilters}
            className="p-2 rounded-xl border border-gold/20 bg-gold/5 text-gold hover:bg-gold/10 transition-all"
            title="Reset All Filters"
          >
            <RotateCcw size={14} />
          </button>
        )}
      </div>

      {bookings.length === 0 ? (
        <div className="glass p-12 rounded-3xl border border-white/5 text-center space-y-6">
          <div className="w-20 h-20 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto">
            <Calendar size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-display text-white">No Bookings Found</h3>
            <p className="text-white/40 text-sm max-w-xs mx-auto">
              You haven't made any bookings yet. Start your luxury journey today.
            </p>
          </div>
          <button
            onClick={() => navigate('/booking')}
            className="btn-primary px-10 py-4 mx-auto block"
          >
            Book Now
          </button>
        </div>
      ) : filteredAndSortedBookings.length === 0 ? (
        <div className="glass p-12 rounded-3xl border border-white/5 text-center space-y-6">
          <div className="w-20 h-20 bg-white/5 text-white/20 rounded-full flex items-center justify-center mx-auto">
            <Search size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-display text-white">No Results Found</h3>
            <p className="text-white/40 text-sm max-w-xs mx-auto">
              We couldn't find any bookings matching your current filters.
            </p>
          </div>
          <button
            onClick={clearFilters}
            className="btn-outline px-10 py-4 mx-auto block"
          >
            Reset Filters
          </button>
        </div>
      ) : bookingViewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedBookings.map((booking, idx) => (
            <div key={`booking-card-${booking.id}-${idx}`} className={cn("glass p-5 rounded-2xl overflow-hidden border transition-all group flex flex-col h-full relative", selectedBookings.includes(booking.id) ? "border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : booking.status === 'cancelled' && booking.cancellationReason === 'Booking Pickup date passed' ? "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]" : "border-white/5")}>

              <div className="flex justify-between items-start mb-4">
                {/* Left side: Selection + stacked date + name */}
                <div className="flex items-start gap-3">
                  {isBookingsSelectionMode &&
                    booking.status !== 'completed' &&
                    booking.status !== 'cancelled' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedBookings.includes(booking.id))
                            setSelectedBookings((prev) => prev.filter((id) => id !== booking.id));
                          else setSelectedBookings((prev) => [...prev, booking.id]);
                        }}
                        className={cn(
                          "w-5 h-5 flex items-center justify-center transition-all flex-shrink-0 mt-1",
                          selectedBookings.includes(booking.id)
                            ? "text-gold"
                            : "text-white/40 hover:text-white"
                        )}
                      >
                        {selectedBookings.includes(booking.id) ? (
                          <SquareCheck size={14} />
                        ) : (
                          <Square size={14} />
                        )}
                      </button>
                    )}

                  <div className="flex flex-col min-w-0">
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">
                      Booked on: {booking.createdAt?.seconds
                        ? format(new Date(booking.createdAt.seconds * 1000), 'dd-MM-yyyy HH:mm')
                        : 'N/A'}
                    </p>
                    <h3 className="text-lg font-display text-white group-hover:text-gold transition-colors">
                      {(() => {
                        const text = bookingCategory === 'offer'
                          ? booking.packageTitle || 'Package'
                          : bookingCategory === 'tour'
                            ? booking.tourTitle || 'Tour'
                            : booking.customerName || 'Customer';

                        return text.length > 25 ? text.slice(0, 25) + '...' : text;
                      })()}
                    </h3>
                  </div>
                </div>

                {/* Right side: status pill */}
                <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest self-start">
                  {booking.status && (
                    <span
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded-full border",
                        booking.status === 'pending' ? "bg-gold/10 text-gold border-gold/20" :
                          booking.status === 'confirmed' ? "bg-blue-400/10 text-blue-400 border-blue-400/20" :
                            booking.status === 'assigned' ? "bg-purple-400/10 text-purple-400 border-purple-400/20" :
                              booking.status === 'accepted' ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/20" :
                                booking.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                  booking.status === 'cancelled' ? "bg-red-400/10 text-red-400 border-red-400/20" :
                                    booking.status === 'rejected' ? "bg-orange-400/10 text-orange-400 border-orange-400/20" :
                                      "bg-white/10 text-white/60 border-white/20"
                      )}
                    >
                      {booking.status === 'pending' && <Clock className="h-3 w-3" />}
                      {booking.status === 'confirmed' && <CheckCircle className="h-3 w-3" />}
                      {booking.status === 'completed' && <CheckSquare className="h-3 w-3" />}
                      {booking.status === 'cancelled' && <XCircle className="h-3 w-3" />}
                      {booking.status === 'accepted' && <ThumbsUp className="h-3 w-3" />}
                      {booking.status === 'rejected' && <ThumbsDown className="h-3 w-3" />}
                      {booking.status === 'assigned' && <Truck className="h-3 w-3" />}
                      <span>{booking.status}</span>
                    </span>
                  )}
                  {booking.status === 'cancelled' && booking.cancellationReason === 'Booking Pickup date passed' && (
                    <span className="flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-full" title="Auto-Cancelled due to date passing">
                      <Clock size={10} /> Auto
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-start gap-3">
                  <LocateFixed size={12} className="text-gold shrink-0 mt-0.5" />
                  <p className="text-xs text-white/70 truncate">{booking.pickup}</p>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin size={12} className="text-gold shrink-0 mt-0.5" />
                  <p className={cn("text-xs truncate", booking.dropoff ? "text-white/70" : "text-white/60 italic")}>
                    {booking.dropoff || (booking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                  </p>
                </div>

                {/* Date + Info */}
                <div className="space-y-3 pt-2 border-t border-white/5 pb-2">

                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Calendar size={12} className="text-gold" />
                      <span className="text-[10px] text-white/60 font-bold uppercase">
                        {booking.date} at {formatTimeToAMPM(booking.time)}
                      </span>
                    </div>

                    {booking.isReturn && (
                      <div className="flex items-center gap-2">
                        <RotateCcw size={12} className="text-blue-500" />
                        <span className="text-[10px] text-white/60 font-bold uppercase">
                          {booking.returnDate} at {formatTimeToAMPM(booking.returnTime)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    {booking.distance && (
                      <div className="flex items-center gap-1.5">
                        <Navigation size={12} className="text-gold" />
                        <span className="text-[10px] text-white/60 font-bold uppercase">
                          {(() => {
                            if (!booking.isReturn) return booking.distance;
                            const num = parseFloat(booking.distance.replace(/[^\d.]/g, ''));
                            return isNaN(num) ? booking.distance : `${(num * 2).toFixed(1)} km`;
                          })()}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {bookingCategory === 'offer' ? (
                        <>
                          <Blocks size={12} className="text-gold" />
                          <span className="text-[10px] text-white/60 font-bold uppercase truncate">
                            {(booking.offerId || booking.type === 'offer') ? 'Offers Ride' : (booking.serviceType || 'Standard')}
                          </span>
                        </>
                      ) : bookingCategory === 'tour' ? (
                        <>
                          <MapIcon size={12} className="text-gold" />
                          <span className="text-[10px] text-white/60 font-bold uppercase truncate">
                            {(booking.tourId || booking.type === 'tour') ? 'Tours Ride' : (booking.serviceType || 'Standard')}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock size={12} className="text-gold" />
                          <span className="text-[10px] text-white/60 font-bold uppercase">
                            {booking.serviceType === 'hourly'
                              ? `${booking.hours} Hours`
                              : (() => {
                                if (!booking.duration) return 'N/A';
                                if (!booking.isReturn) return booking.duration;
                                const match = booking.duration.match(/(\d+)\s*min/);
                                if (match) {
                                  return `${parseInt(match[1]) * 2} mins`;
                                }
                                return booking.duration;
                              })()}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Car size={12} className="text-gold" />
                      <span className="text-[10px] text-white/60 font-bold uppercase">
                        {fleet.find(v => v.id === booking.vehicleId || v.name === booking.vehicleType)?.name || booking.vehicleType || 'Sedan'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {bookingCategory !== 'offer' && (
                <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5">
                  {/* Service */}
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Service</span>
                    <span className="text-[10px] text-gold font-bold truncate uppercase">
                      {(booking.offerId || booking.type === 'offer') ? 'Offers Ride' : (booking.tourId || booking.type === 'tour') ? 'Tours Ride' : (booking.serviceType || 'Standard')}
                    </span>
                  </div>

                  {/* Waypoints / Category Info */}
                  {bookingCategory !== 'tour' && (
                    <div className="flex flex-col relative">
                      <div className="flex items-center gap-1">
                        <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">
                          Waypoints
                        </span>
                        {booking.waypoints?.length > 0 && (
                          <button
                            onMouseEnter={() => setShowWaypointsPopup(booking.id)}
                            onMouseLeave={() => setShowWaypointsPopup(null)}
                            className="text-gold/50 hover:text-gold transition-colors"
                          >
                            <Eye size={10} />
                          </button>
                        )}
                      </div>

                      <span className="text-[10px] text-white/70 truncate">
                        {`${booking.waypoints?.length || 0} Stops`}
                      </span>

                      <AnimatePresence>
                        {showWaypointsPopup === booking.id && booking.waypoints?.length > 0 && (
                          <motion.div
                            key="waypoints-popup"
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full left-0 mb-2 w-48 bg-black p-3 rounded-xl border border-gold/20 z-50 shadow-2xl"
                          >
                            <p className="text-[8px] uppercase tracking-widest text-gold font-bold mb-2">
                              Stop Details
                            </p>
                            <div className="space-y-2">
                              {(booking.waypoints || []).map((wp: string, i: number) => (
                                <div key={`wp-pop-${i}`} className="flex gap-2 items-start">
                                  <div className="w-1 h-1 rounded-full bg-gold mt-1.5 shrink-0" />
                                  <p className="text-[9px] text-white/70 leading-tight">{wp}</p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Extras */}
                  <div className="flex flex-col relative">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Extras</span>
                      {booking.selectedExtras && (Array.isArray(booking.selectedExtras) ? booking.selectedExtras.length > 0 : Object.keys(booking.selectedExtras).length > 0) && (
                        <button
                          onMouseEnter={() => setShowExtrasPopup(booking.id)}
                          onMouseLeave={() => setShowExtrasPopup(null)}
                          className="text-gold/50 hover:text-gold transition-colors"
                        >
                          <Eye size={10} />
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-white/70 truncate">
                      {Array.isArray(booking.selectedExtras)
                        ? booking.selectedExtras.length
                        : Object.keys(booking.selectedExtras || {}).length} Added
                    </span>

                    <AnimatePresence>
                      {showExtrasPopup === booking.id && (Array.isArray(booking.selectedExtras) ? booking.selectedExtras.length > 0 : Object.keys(booking.selectedExtras || {}).length > 0) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute bottom-full right-0 mb-2 w-48 bg-black p-4 rounded-2xl border border-gold/20 z-50 shadow-2xl"
                        >
                          <p className="text-[9px] uppercase tracking-widest text-gold font-bold mb-3 border-b border-gold/10 pb-2">Selected Extras</p>
                          <div className="space-y-2">
                            {Array.isArray(booking.selectedExtras) ? (
                              booking.selectedExtras.map((id: string, index: number) => {
                                const extra = extras.find((e) => e.id === id);
                                return (
                                  <p
                                    key={`${id}-${index}`}
                                    className="text-[10px] text-white/70 font-bold uppercase tracking-tighter flex justify-between"
                                  >
                                    <span>• {extra?.name || 'Extra'}</span>
                                  </p>
                                );
                              })
                            ) : (
                              Object.entries(booking.selectedExtras || {}).map(([id, count]) => {
                                const tour = tours.find(t => t.id === (booking.tourId || viewingBooking?.tourId));
                                const tourExtras = tour?.extras || [];
                                const extra = tourExtras.find((e: any) => e.id === id || e.name === id) || extras.find(e => e.id === id);
                                return (
                                  <div key={`extra-summary-${id}`} className="flex justify-between items-center bg-white/5 p-1">
                                    <p className="text-[10px] text-white/70 font-bold uppercase tracking-tighter truncate">
                                      • {extra?.name || id || 'Extra'}
                                    </p>
                                    <span className="text-[10px] text-gold font-mono bg-gold/10 px-1.5 rounded">×{count as number}</span>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

              <div className="py-3 border-y border-white/10 mb-3 space-y-2">
                {/* Always show customer name if offer */}
                {(bookingCategory === 'offer' || bookingCategory === 'tour') && (
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">
                      Name:
                    </span>
                    <span className="text-[10px] text-white/70 whitespace-nowrap">
                      {booking.customerName || 'N/A'}
                    </span>
                  </div>
                )}

                {/* Row 1: Email & Phone */}
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <div className="flex items-center gap-2 min-w-fit">
                    <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Email:</span>
                    <span className="text-[10px] text-white/70 whitespace-nowrap">
                      {booking.customerEmail || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 min-w-fit">
                    <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Phone:</span>
                    <span className="text-[10px] text-white/70 whitespace-nowrap">
                      {booking.customerPhone || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Row 2: Flight Number & Notes */}
                <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
                  {booking.flightNumber && (
                    <div className="flex items-center gap-2 min-w-fit">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Flight:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-white/70 font-bold uppercase">{booking.flightNumber}</span>
                        <a
                          href={`https://www.melbourneairport.com.au/flights/departures/${booking.flightNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gold hover:text-white transition-colors"
                          title="View on Melbourne Airport website"
                        >
                          <Globe size={10} />
                        </a>
                      </div>
                    </div>
                  )}

                  {(booking.purpose || booking.notes) && (
                    <div className="flex items-center gap-2 relative flex-1 min-w-[120px]">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Notes:</span>
                        <button
                          onMouseEnter={() => setShowNotesPopup(booking.id)}
                          onMouseLeave={() => setShowNotesPopup(null)}
                          className="text-gold/50 hover:text-gold transition-colors"
                        >
                          <Eye size={10} />
                        </button>
                      </div>
                      <p className="text-[10px] text-white/60 truncate italic">"{booking.purpose || booking.notes}"</p>

                      <AnimatePresence>
                        {showNotesPopup === booking.id && (booking.purpose || booking.notes) && (
                          <motion.div
                            key="notes-popup"
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute bottom-full right-0 mb-2 w-48 bg-black p-3 rounded-xl border border-gold/20 z-50 shadow-2xl"
                          >
                            <p className="text-[8px] uppercase tracking-widest text-gold font-bold mb-2">Additional Info</p>
                            <p className="text-[9px] text-white/70 leading-relaxed italic">"{booking.purpose || booking.notes}"</p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between p-2.5 bg-gold/5 rounded-xl border border-gold/10">
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase tracking-widest text-gold/40 font-bold">Fare</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-display text-gold">${booking.price}</span>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gold/10 rounded-md border border-gold/20">
                        {booking.paymentMethod === 'cash' ? (
                          <DollarSign size={10} className="text-gold" />
                        ) : (
                          <CreditCard size={10} className="text-gold" />
                        )}
                        <span className="text-[8px] font-bold text-gold uppercase">{booking.paymentMethod || 'Stripe'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase tracking-widest text-gold/40 font-bold">Status</span>
                    <p className="text-[10px] font-bold text-white uppercase">{booking.paymentStatus}</p>
                  </div>
                </div>

                {/* Driver & Feedback Section */}
                <div className="space-y-3 mb-3">
                  {booking.status === 'cancelled' && (
                    <div className="p-3 bg-red-500/5 rounded-xl border border-red-500/20 space-y-1">
                      <div className="flex items-center gap-2 text-red-400">
                        <XCircle size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Cancellation Details</span>
                      </div>
                      <p className="text-[10px] text-white/75 italic leading-relaxed pl-5">
                        "{booking.cancellationReason || 'No reason provided'}"
                      </p>
                    </div>
                  )}

                  {booking.status !== 'completed' && booking.status !== 'cancelled' && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex justify-between items-center">

                        {/* Left side: Status badge + Driver details */}
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center",
                              !booking.driverId
                                ? "bg-red-500/20"
                                : booking.status === "accepted"
                                  ? "bg-cyan-500/20"
                                  : booking.status === "rejected"
                                    ? "bg-orange-400/20"
                                    : "bg-purple-500/20"
                            )}
                          >
                            {!booking.driverId ? (
                              <X size={12} className="text-red-500" />
                            ) : booking.status === "accepted" ? (
                              <UserCheck size={12} className="text-cyan-500" />
                            ) : booking.status === "rejected" ? (
                              <X size={12} className="text-orange-400" />
                            ) : (
                              <Truck size={12} className="text-purple-400" />
                            )}
                          </div>

                          <div>
                            <p className="text-[8px] uppercase tracking-widest font-bold">
                              <span className="text-white/50">Driver: </span>{" "}
                              <span
                                className={cn(
                                  !booking.driverId
                                    ? "text-red-500"
                                    : booking.status === "accepted"
                                      ? "text-cyan-500/75"
                                      : booking.status === "rejected"
                                        ? "text-orange-400/75"
                                        : "text-purple-400/75"
                                )}
                              >
                                {!booking.driverId
                                  ? "Unassigned"
                                  : booking.status === "accepted"
                                    ? "Accepted"
                                    : booking.status === "rejected"
                                      ? "Rejected"
                                      : "Assigned"}
                              </span>
                            </p>

                            <div className="flex gap-2 items-center">
                              {booking.driverId ? (
                                <p className="text-[10px] text-white font-bold flex items-center gap-1">
                                  {consolidatedUsers.find(u => u.id === booking.driverId)?.name || (booking.driverId === user?.uid ? userProfile?.name : "Unknown Driver")}
                                  <span className="text-white/30 font-normal">|</span>
                                  <span className="text-[9px] text-gold font-medium">
                                    {consolidatedUsers.find(u => u.id === booking.driverId)?.phone || (booking.driverId === user?.uid ? userProfile?.phone : "No Phone")}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-[10px] text-white font-bold">No Driver Assigned</p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right side: Route button */}
                        <div className="flex flex-row items-center gap-2">         
                          {(isAdmin || isDriver) && booking.status === 'accepted' && (
                            <button
                              onClick={() => handleSendEarlyAlert(booking)}
                              className="flex items-center justify-center w-8 h-8 bg-gold/10 border border-gold/20 rounded-xl hover:bg-gold/20 transition-all"
                              title="Send Early Pickup Alert"
                            >
                              <Bell size={16} className="text-gold" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setRouteBooking(booking);
                              setShowRouteModal(true);
                            }}
                            className="flex items-center justify-center w-8 h-8 bg-gradient-to-r from-red-500/10 via-green-500/10 to-blue-500/10 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-blue-400 hover:text-white"
                            title="View Route"
                          >
                            <RouteIcon size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {booking.status !== 'cancelled' && (booking.status === 'completed' || booking.feedback || (booking.rating && booking.rating > 0)) && (
                    <div className="p-3 bg-white/5 rounded-xl border border-white/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center">
                            <Star size={12} className={cn(booking.rating ? "text-gold fill-gold" : "text-white/20")} />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-gold/40 font-bold">
                              Feedback for <span className="text-blue-500">{consolidatedUsers.find(u => u.id === booking.driverId)?.name || 'Driver'}</span>
                            </p>
                            {booking.rating ? (
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <Star
                                    key={`feedback-star-${booking.id}-${s}`}
                                    size={8}
                                    className={cn(s <= booking.rating ? "text-gold fill-gold" : "text-white/10")}
                                  />
                                ))}
                              </div>
                            ) : (
                              <p className="text-[9px] text-white/40 font-bold uppercase">Not Rated Yet</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {typeof booking.rating === "number" && booking.rating > 0 && (
                            <span className="text-[10px] font-display text-gold">
                              {booking.rating}
                            </span>
                          )}

                          {!isDriver && (
                            <button
                              onClick={() => {
                                setRatingBooking(booking);
                                setRatingValue(booking.rating || 0);
                                setRatingComment(booking.feedback || '');
                              }}
                              className="p-1.5 bg-gold/10 hover:bg-gold/20 rounded-lg text-gold transition-all"
                              title={booking.rating ? "Edit Rating" : "Rate Now"}
                            >
                              {booking.rating ? (
                                <Edit2 size={10} />
                              ) : (
                                <Plus size={10} />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                      {booking.feedback && (
                        <div className="mt-1">
                          <p className={cn(
                            "text-[10px] text-white/60 leading-relaxed italic",
                            !expandedFeedback?.includes(booking.id) && "line-clamp-2"
                          )}>
                            "{booking.feedback}"
                          </p>
                          {booking.feedback.length > 60 && (
                            <button
                              onClick={() => setExpandedFeedback(prev =>
                                prev?.includes(booking.id)
                                  ? prev.filter(id => id !== booking.id)
                                  : [...(prev || []), booking.id]
                              )}
                              className="text-[9px] text-gold font-bold uppercase mt-1 hover:underline"
                            >
                              {expandedFeedback?.includes(booking.id) ? 'Show Less' : 'View Full Feedback'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-full mt-2">
                  {isAdmin ? (
                    booking.status === 'completed' || booking.status === 'cancelled' ? (
                      <>
                        {isChatAllowed(booking) && (
                          <div className="flex-1 flex gap-1">
                            <button
                              onClick={() => setChatBooking(booking)}
                              className="flex-1 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-2 relative shadow-lg shadow-amber-500/5 group"
                              title="Secure Live Chat"
                            >
                              <MessageSquare size={16} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Chat</span>
                              <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                            </button>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setViewingBooking(booking);
                            setShowViewModal(true);
                          }}
                          className="flex-1 p-2.5 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                          title="View Details"
                        >
                          <Eye size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">View</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingBooking(booking);
                            setShowBookingModal(true);
                          }}
                          className="flex-1 p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
                          title="Edit Booking"
                        >
                          <Edit2 size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Edit</span>
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'booking', id: booking.id })}
                          className="flex-1 p-2.5 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                          title="Delete Booking"
                        >
                          <Trash2 size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
                        </button>
                      </>
                    ) : booking.status === 'pending' ? (
                      <div className="flex items-center gap-2 w-full">
                        {isChatAllowed(booking) && (
                          <button
                            onClick={() => setChatBooking(booking)}
                            className="flex-1 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center relative shadow-lg shadow-amber-500/5 group"
                            title="Secure Live Chat"
                          >
                            <MessageSquare size={16} />
                            <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                          </button>
                        )}
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                          className="flex-1 h-10 border border-green-500/20 bg-green-500/5 rounded-xl text-green-400 hover:bg-green-500/10 transition-all flex items-center justify-center"
                          title="Confirm"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setViewingBooking(booking);
                            setShowViewModal(true);
                          }}
                          className="flex-1 h-10 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingBooking(booking);
                            setShowBookingModal(true);
                          }}
                          className="flex-1 h-10 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'booking', id: booking.id })}
                          className="flex-1 h-10 bg-red-500/5 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        {isChatAllowed(booking) && (
                           <div className="flex items-center gap-1 shrink-0">
                             <button
                               onClick={() => setChatBooking(booking)}
                               className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center shrink-0 relative shadow-lg shadow-amber-500/5"
                               title="Secure Live Chat"
                             >
                               <MessageSquare size={16} />
                               <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                             </button>
                           </div>
                        )}
                        {booking.status === 'confirmed' && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'pending')}
                              className="w-10 h-10 border border-white/20 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all flex items-center justify-center"
                              title="Unconfirm"
                            >
                              <CircleX size={16} />
                            </button>
                          </div>
                        )}
                        {booking.status !== 'cancelled' && booking.status !== 'completed' && booking.status !== 'pending' && (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <div className="flex-1 relative min-w-0 h-10">
                              <select
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!val) {
                                    updateBookingStatus(booking.id, 'confirmed', '');
                                  } else {
                                    updateBookingStatus(booking.id, 'assigned', val);
                                  }
                                }}
                                value={booking.driverId || ''}
                                className="w-full h-full bg-white/5 border border-white/10 rounded-xl px-3 text-[10px] text-white/80 outline-none focus:border-gold transition-all appearance-none truncate font-bold tracking-widest pr-8"
                              >
                                <option value="" className="bg-black">Assign Driver</option>
                                {(() => {
                                  const dropdownDrivers = [...drivers];
                                  if (booking.driverId && !dropdownDrivers.some(d => d.id === booking.driverId)) {
                                    const currentAssignedDriver = allUsers.find(u => u.id === booking.driverId);
                                    if (currentAssignedDriver) dropdownDrivers.push(currentAssignedDriver);
                                  }
                                  return dropdownDrivers.map((driver, dIdx) => {
                                    const stats = driverStats[driver.id] || { avgRating: '0', completedCount: 0, rejectedCount: 0 };
                                    const isNotApproved = driver.driverVerificationStatus !== 'approved';
                                    return (
                                      <option key={`assign-driver-${driver.id}-${idx}-${dIdx}`} value={driver.id} className="bg-black">
                                        {driver.name} {isNotApproved ? "(Unverified/Reverified Needed)" : ""} ({stats.avgRating}★, {stats.completedCount}✓, {stats.rejectedCount}✗)
                                      </option>
                                    );
                                  });
                                })()}
                              </select>
                              <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                            </div>
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setViewingBooking(booking);
                            setShowViewModal(true);
                          }}
                          className="w-10 h-10 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center shrink-0"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingBooking(booking);
                            setShowBookingModal(true);
                          }}
                          className="w-10 h-10 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center shrink-0"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete({ type: 'booking', id: booking.id })}
                          className="w-10 h-10 bg-red-500/5 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center shrink-0"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    )
                  ) : !isDriver && booking.userId === user?.uid ? (
                    booking.status === 'pending' ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full">
                        {booking.driverId && isChatAllowed(booking) && (
                          <button
                            onClick={() => setChatBooking(booking)}
                            className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-2 relative"
                            title="Secure Live Chat"
                          >
                            <MessageSquare size={16} />
                            <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline text-amber-500">Chat</span>
                            <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setViewingBooking(booking);
                            setShowViewModal(true);
                          }}
                          className="p-2.5 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                          title="View"
                        >
                          <Eye size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">View</span>
                        </button>
                        <button
                          onClick={() => {
                            setEditingBooking(booking);
                            setShowBookingModal(true);
                          }}
                          className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setCancellingBookingId(booking.id);
                            setCancellationReasonInput('');
                          }}
                          className="p-2.5 bg-red-500/5 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                          title="Cancel Booking"
                        >
                          <XCircle size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">Cancel</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 w-full">
                        {isChatAllowed(booking) && (
                           <button
                             onClick={() => setChatBooking(booking)}
                             className="flex-1 p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center gap-2 relative shadow-lg shadow-amber-500/5"
                             title="Secure Live Chat"
                           >
                             <MessageSquare size={16} />
                             <span className="text-[10px] font-bold uppercase tracking-widest">Chat</span>
                             <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                           </button>
                        )}
                        <button
                          onClick={() => {
                            setViewingBooking(booking);
                            setShowViewModal(true);
                          }}
                          className="flex-1 p-2.5 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                          title="View Details"
                        >
                          <Eye size={16} />
                          <span className="text-[10px] font-bold uppercase tracking-widest">View</span>
                        </button>
                        <button
                          onClick={() => navigate('/contact')}
                          className="flex-1 p-2.5 bg-white/5 border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                          title="Contact Us"
                        >
                          <Mail size={16} className="text-gold" />
                          <span className="text-[10px] font-bold uppercase tracking-widest">Contact</span>
                        </button>
                      </div>
                    )
                  ) : null}

                  {isDriver && booking.driverId === user.uid && (
                    <div className="space-y-2 w-full">
                      {booking.status === 'assigned' && (
                        <div className="flex gap-2 w-full">
                          {isChatAllowed(booking) && (
                            <button
                              onClick={() => setChatBooking(booking)}
                              className="px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center relative"
                              title="Secure Live Chat"
                            >
                              <MessageSquare size={16} />
                              <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                            </button>
                          )}
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'accepted')}
                            className="flex-1 bg-green-500 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                          >
                            Accept Ride
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'rejected')}
                            className="flex-1 bg-red-500 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                          >
                            Reject Ride
                          </button>
                        </div>
                      )}

                      {booking.status === 'accepted' && (
                        <div className="flex gap-2 w-full">
                          {isChatAllowed(booking) && (
                            <button
                              onClick={() => setChatBooking(booking)}
                              className="px-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500 hover:text-black transition-all flex items-center justify-center relative"
                              title="Secure Live Chat"
                            >
                              <MessageSquare size={16} />
                              <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                            </button>
                          )}
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'completed')}
                            className="flex-1 bg-gold text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                          >
                            Complete Ride
                          </button>
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'assigned')}
                            className="flex-1 bg-white/10 text-white border border-white/20 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                          >
                            UnAccept Ride
                          </button>
                        </div>
                      )}

                      {booking.status === 'rejected' && (
                        <button
                          onClick={() => updateBookingStatus(booking.id, 'assigned')}
                          className="w-full bg-white/10 text-white border border-white/20 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                        >
                          Unreject Ride
                        </button>
                      )}
                    </div>
                  )}

                  {!isAdmin && !isDriver && booking.status === 'completed' && !booking.rating && (
                    <div className="h-0 overflow-hidden" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass rounded-[0.5rem] border border-white/5 overflow-hidden">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[1240px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  {isBookingsSelectionMode && (
                    <th className="px-4 py-4 w-10"></th>
                  )}
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Date & Time</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Customer</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Route (Pickup/Dropoff)</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Services</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Fare</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Driver / Status</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredAndSortedBookings.map((booking, idx) => (
                  <tr key={`booking-row-${booking.id}-${idx}`} className={cn("transition-colors group", selectedBookings.includes(booking.id) ? "bg-gold/5 hover:bg-gold/10" : booking.status === 'cancelled' && booking.cancellationReason === 'Booking Pickup date passed' ? "bg-red-500/5 hover:bg-red-500/10 border-l border-l-red-500" : "hover:bg-white/[0.02]")}>
                    {isBookingsSelectionMode && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                      <td className="px-4 py-5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedBookings.includes(booking.id))
                              setSelectedBookings((prev) => prev.filter((id) => id !== booking.id));
                            else
                              setSelectedBookings((prev) => [...prev, booking.id]);
                          }}
                          className={cn(
                            "w-6 h-6 rounded flex items-center justify-center transition-all border",
                            selectedBookings.includes(booking.id) ? "bg-gold text-black border-gold" : "bg-black/40 text-white/40 border-white/10 hover:border-white/30"
                          )}
                        >
                          {selectedBookings.includes(booking.id) && <Check size={14} />}
                        </button>
                      </td>
                    )}
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-white text-xs font-bold uppercase">{booking.date}</span>
                        <span className="text-white/40 text-[10px] uppercase tracking-widest">{formatTimeToAMPM(booking.time)}</span>
                        {booking.isReturn && (
                          <div className="mt-1 flex items-center gap-1 text-blue-400">
                            <RotateCcw size={10} />
                            <span className="text-[8px] uppercase tracking-widest font-bold">{booking.returnDate}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-white text-xs font-bold uppercase truncate max-w-[150px]">
                          {bookingCategory === 'tour'
                            ? booking.tourTitle || 'Tour'
                            : bookingCategory === 'offer'
                              ? booking.packageTitle || 'Package'
                              : (booking.customerName || 'Guest')}
                        </span>
                        <span className="text-white/40 text-[10px] truncate max-w-[150px]">{booking.customerEmail}</span>
                        <span className="text-white/40 text-[10px]">{booking.customerPhone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="space-y-1.5 max-w-[200px]">
                        <div className="flex items-start gap-2">
                          <LocateFixed size={12} className="text-gold shrink-0 mt-0.5" />
                          <span className="text-xs text-white/70 line-clamp-1">{booking.pickup}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin size={12} className="text-gold shrink-0 mt-0.5" />
                          <span className="text-xs text-white/40 line-clamp-1">{booking.dropoff || (booking.serviceType === 'hourly' ? 'Optional' : 'N/A')}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2 py-0.5 bg-gold/10 text-gold rounded text-[8px] font-bold uppercase tracking-widest border border-gold/20 whitespace-nowrap">
                          {(booking.offerId || booking.type === 'offer') ? 'Offers Ride' : (booking.tourId || booking.type === 'tour') ? 'Tours Ride' : (booking.serviceType || 'Standard')}
                        </span>
                        <span className="px-2 py-0.5 bg-white/5 text-white/60 rounded text-[8px] font-bold uppercase tracking-widest border border-white/10 whitespace-nowrap">
                          {fleet.find(v => v.id === booking.vehicleId || v.name === booking.vehicleType)?.name || booking.vehicleType || 'Sedan'}
                        </span>
                        {(booking.type === 'offer' || booking.offerId) && (
                          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[8px] font-bold uppercase tracking-widest border border-purple-500/20 whitespace-nowrap transition-all group-hover:bg-purple-500 group-hover:text-white">
                            OFFER RIDE
                          </span>
                        )}
                        {(booking.type === 'tour' || booking.tourId) && (
                          <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[8px] font-bold uppercase tracking-widest border border-cyan-500/20 whitespace-nowrap transition-all group-hover:bg-cyan-500 group-hover:text-white">
                            TOUR RIDE
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-gold text-sm font-bold font-display">${booking.price}</span>
                        <span className={cn(
                          "text-[9px] uppercase tracking-widest font-bold",
                          booking.paymentStatus === 'paid' ? "text-green-400" : "text-white/40"
                        )}>{booking.paymentStatus}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            booking.status === 'pending' ? "bg-gold" :
                              booking.status === 'confirmed' ? "bg-blue-400" :
                                booking.status === 'assigned' ? "bg-purple-400" :
                                  booking.status === 'accepted' ? "bg-cyan-400" :
                                    booking.status === 'completed' ? "bg-green-500" :
                                      booking.status === 'cancelled' ? "bg-red-400" :
                                        booking.status === 'rejected' ? "bg-orange-400" : "bg-white/40"
                          )} />
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-white font-bold uppercase tracking-tighter">
                                {booking.status}
                              </span>
                              {booking.status === 'cancelled' && booking.cancellationReason === 'Booking Pickup date passed' && (
                                <span className="text-[8px] bg-red-500/10 text-red-500 border border-red-500/20 px-1 py-0.5 rounded leading-none" title="Auto-Cancelled due to date passing">
                                  AUTO
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
                              {booking.driverId ? (consolidatedUsers.find(u => u.id === booking.driverId)?.name || (booking.driverId === user?.uid ? userProfile?.name : 'Unknown Driver')) : 'Unassigned'}
                            </span>
                          </div>
                        </div>
                        {isAdmin && !['completed', 'cancelled', 'pending'].includes(booking.status) && (
                          <div className="relative">
                            <select
                              value={booking.driverId || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) {
                                  updateBookingStatus(booking.id, 'confirmed', '');
                                } else {
                                  updateBookingStatus(booking.id, 'assigned', val);
                                }
                              }}
                              className="w-full bg-black/40 border border-white/10 rounded-lg pl-2 pr-8 py-1.5 text-[10px] text-white/60 outline-none focus:border-gold transition-all appearance-none cursor-pointer hover:bg-white/5"
                            >
                              <option value="" className="bg-black">Assign Driver...</option>
                              {(() => {
                                const dropdownDrivers = [...drivers];
                                if (booking.driverId && !dropdownDrivers.some(d => d.id === booking.driverId)) {
                                  const currentAssignedDriver = allUsers.find(u => u.id === booking.driverId);
                                  if (currentAssignedDriver) dropdownDrivers.push(currentAssignedDriver);
                                }
                                return dropdownDrivers.map(driver => {
                                  const stats = driverStats[driver.id] || { avgRating: '0', completedCount: 0, rejectedCount: 0 };
                                  const isNotApproved = driver.driverVerificationStatus !== 'approved';
                                  return (
                                    <option key={`opt-${booking.id}-${driver.id}`} value={driver.id} className="bg-black">
                                      {driver.name} {isNotApproved ? "(Unverified/Reverified Needed)" : ""} ({stats.avgRating}★, {stats.completedCount}✓, {stats.rejectedCount}✗)
                                    </option>
                                  );
                                });
                              })()}
                            </select>
                            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex flex-col items-end gap-1.5">
                        {/* Completed Rides special placement: Chat icon BEFORE View button (Chat button first), placed below primary row */}
                        {!isAdmin && booking.status === 'completed' && isChatAllowed(booking) && (
                           <div className="flex items-center justify-end gap-2 mb-2">
                              {booking.driverId && (
                                <button
                                  onClick={() => setChatBooking(booking)}
                                  className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all cursor-pointer relative"
                                  title="Secure Live Chat"
                                >
                                  <MessageSquare size={14} />
                                  <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                                </button>
                              )}
                              {(isAdmin || isDriver || booking.userId === user?.uid) && (
                                <button
                                  onClick={() => {
                                    setViewingBooking(booking);
                                    setShowViewModal(true);
                                  }}
                                  className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                  title="View Details"
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                           </div>
                        )}

                        <div className="flex items-center justify-end gap-2 mt-1">
                          {/* Driver Assigned Section (Accepted) - Alert and Route Only */}
                          {!isAdmin && booking.status === 'accepted' && (
                            <>
                               {(isAdmin || isDriver) && (
                                 <button
                                   onClick={() => handleSendEarlyAlert(booking)}
                                   className="p-2 bg-gold/10 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                   title="Send Early Pickup Alert"
                                 >
                                   <Bell size={14} />
                                 </button>
                               )}
                               <button
                                 onClick={() => {
                                   setRouteBooking(booking);
                                   setShowRouteModal(true);
                                 }}
                                 className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-gold hover:text-black transition-all"
                                 title="View Route"
                               >
                                 <RouteIcon size={14} />
                               </button>
                            </>
                          )}

                          {/* Confirmed/Pending Section - Chat and View */}
                          {!isAdmin && (booking.status === 'confirmed' || booking.status === 'pending' || booking.status === 'assigned') && (
                            <>
                               {booking.driverId && isChatAllowed(booking) && (
                                 <button
                                   onClick={() => setChatBooking(booking)}
                                   className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all cursor-pointer relative shadow-lg shadow-amber-500/5"
                                   title="Secure Live Chat"
                                 >
                                   <MessageSquare size={14} />
                                   <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                                 </button>
                               )}
                               <button
                                 onClick={() => {
                                   setViewingBooking(booking);
                                   setShowViewModal(true);
                                 }}
                                 className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                 title="View Details"
                               >
                                 <Eye size={14} />
                               </button>
                            </>
                          )}

                          {!isAdmin && !isDriver && booking.userId === user?.uid && (booking.status === 'cancelled' || booking.status === 'completed') && (
                            <button
                              onClick={() => navigate('/contact')}
                              className="p-2 bg-white/5 text-white rounded-lg hover:bg-white hover:text-black transition-all"
                              title="Contact Us"
                            >
                              <Mail size={14} className="text-gold" />
                            </button>
                          )}

                          {isAdmin ? (
                            <div className="flex flex-col items-end gap-1.5">
                              {/* Action Row - Chat First */}
                              <div className="flex items-center gap-1.5">
                                {isChatAllowed(booking) && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => setChatBooking(booking)}
                                      className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all cursor-pointer relative shadow-lg shadow-amber-500/5 order-first"
                                      title="Secure Live Chat"
                                    >
                                      <MessageSquare size={14} />
                                      <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                                    </button>
                                  </div>
                                )}
                                <button
                                  onClick={() => {
                                    setViewingBooking(booking);
                                    setShowViewModal(true);
                                  }}
                                  className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                  title="View Details"
                                >
                                  <Eye size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingBooking(booking);
                                    setShowBookingModal(true);
                                  }}
                                  className="p-2 bg-white/5 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-lg shadow-blue-500/5"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => setConfirmDelete({ type: 'booking', id: booking.id })}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              {/* Special Tools Below Actions */}
                              {booking.status === 'accepted' && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <button
                                    onClick={() => handleSendEarlyAlert(booking)}
                                    className="p-2 bg-gold/10 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                    title="Send Early Pickup Alert"
                                  >
                                    <Bell size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setRouteBooking(booking);
                                      setShowRouteModal(true);
                                    }}
                                    className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-gold hover:text-black transition-all"
                                    title="View Route"
                                  >
                                    <RouteIcon size={14} />
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : isDriver && booking.driverId === user?.uid ? (
                          <div className="flex items-center gap-1.5">
                            {isChatAllowed(booking) && (
                               <button
                                 onClick={() => setChatBooking(booking)}
                                 className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all cursor-pointer relative shadow-lg shadow-amber-500/5"
                                 title="Secure Live Chat"
                               >
                                 <MessageSquare size={14} />
                                 <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                               </button>
                            )}
                            {booking.status === 'assigned' && (
                              <>
                                <button onClick={() => updateBookingStatus(booking.id, 'accepted')} className="p-2 bg-green-500/10 text-green-500 rounded-lg h-9 w-9 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all"><CheckCircle size={14} /></button>
                                <button onClick={() => updateBookingStatus(booking.id, 'rejected')} className="p-2 bg-red-500/10 text-red-500 rounded-lg h-9 w-9 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><X size={14} /></button>
                              </>
                            )}
                            {booking.status === 'accepted' && (
                              <button onClick={() => updateBookingStatus(booking.id, 'completed')} className="px-3 py-1.5 h-9 bg-gold text-black rounded-lg text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all">Complete Ride</button>
                            )}
                          </div>
                        ) : !isDriver && booking.userId === user?.uid ? (
                          <div className="flex items-center gap-1.5">
                            {isChatAllowed(booking) && (
                               <button
                                 onClick={() => setChatBooking(booking)}
                                 className="p-2 bg-amber-500/10 text-amber-500 rounded-lg hover:bg-amber-500 hover:text-black transition-all cursor-pointer relative shadow-lg shadow-amber-500/5"
                                 title="Secure Live Chat"
                               >
                                 <MessageSquare size={14} />
                                 <ChatBadge bookingId={booking.id} user={user} userProfile={userProfile} />
                               </button>
                            )}
                            {booking.status === 'pending' ? (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingBooking(booking);
                                    setShowBookingModal(true);
                                  }}
                                  className="p-2 bg-white/5 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-lg shadow-blue-500/5"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setCancellingBookingId(booking.id);
                                    setCancellationReasonInput('');
                                  }}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                  title="Cancel"
                                >
                                  <XCircle size={14} />
                                </button>
                              </>
                            ) : (
                               <button
                                 onClick={() => navigate('/contact')}
                                 className="p-2 bg-white/5 text-white rounded-lg hover:bg-white hover:text-black transition-all"
                                 title="Contact Us"
                               >
                                 <Mail size={14} className="text-gold" />
                               </button>
                            )}
                          </div>
                        ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {/* Cancellation Reason Modal */}
        {cancellingBookingId && (
          <motion.div
            key="cancellation-reason-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm glass p-8 rounded-3xl text-center border border-red-500/20"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle size={32} className="text-red-500" />
              </div>
              <h3 className="text-xl sm:text-2xl font-display mb-2 text-white uppercase tracking-tighter">Cancel Ride</h3>
              <p className="text-white/40 text-[10px] mb-8 uppercase tracking-[0.2em] leading-relaxed">
                Please provide a reason for cancelling this trip
              </p>

              <div className="mb-6">
                <textarea
                  value={cancellationReasonInput}
                  onChange={(e) => setCancellationReasonInput(e.target.value)}
                  placeholder="Reason (e.g. Schedule conflict, Customer request, Flight cancelled/delayed)..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-red-500 transition-all resize-none h-28 custom-scrollbar text-left"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setCancellingBookingId(null);
                    setCancellationReasonInput('');
                  }}
                  className="flex-1 py-4 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all font-display"
                >
                  Go Back
                </button>
                <button
                  onClick={async () => {
                    const reason = cancellationReasonInput.trim() || 'No reason provided';
                    const bookingIdToCancel = cancellingBookingId;
                    setCancellingBookingId(null);
                    setCancellationReasonInput('');
                    await updateBookingCancelledStatus(bookingIdToCancel, reason);
                  }}
                  className="flex-1 bg-red-600 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-500 transition-all shadow-lg shadow-red-500/20 font-display"
                >
                  Cancel Ride
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Rating Modal */}
        {ratingBooking && (
          <motion.div
            key="rating-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm glass p-8 rounded-3xl text-center border border-gold/20"
            >
              <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star size={32} className="text-gold" />
              </div>
              <h3 className="text-xl sm:text-2xl font-display mb-2">Rate Your Driver</h3>
              <p className="text-white/40 text-xs mb-8 uppercase tracking-widest">How was your ride to {ratingBooking.dropoff}?</p>

              <div className="flex justify-center gap-3 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={`star-${star}`}
                    onMouseEnter={() => setRatingValue(star)}
                    onClick={() => setRatingValue(star)}
                    className="transition-all hover:scale-125"
                  >
                    <Star
                      size={32}
                      className={cn(
                        "transition-colors",
                        star <= ratingValue ? "text-gold fill-gold" : "text-white/10"
                      )}
                    />
                  </button>
                ))}

                {/* Clear option */}
                <button
                  onClick={() => setRatingValue(0)}
                  className="ml-4 px-2 py-1 text-[10px] font-bold uppercase rounded-lg 
               bg-white/5 text-white/50 hover:text-gold hover:bg-gold/10 transition-all"
                  title="Clear Rating"
                >
                  Clear
                </button>
              </div>

              <div className="mb-6">
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Share your experience (optional)..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-gold transition-all resize-none h-24"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setRatingBooking(null);
                    setRatingComment('');
                  }}
                  className="flex-1 py-4 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleRateDriver(ratingBooking.id, ratingValue, ratingComment)}
                  className="flex-1 bg-gold text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Booking Modal (Edit) */}
        {showBookingModal && (
          <motion.div
            key="booking-edit-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-4 md:p-8 rounded-sm border border-gold/20 max-h-[95vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">Edit Booking</h3>
                <button onClick={() => setShowBookingModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Customer Name</label>
                    <input
                      type="text"
                      value={editingBooking?.customerName || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, customerName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={editingBooking?.customerPhone || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, customerPhone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Date</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={editingBooking?.date || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, date: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={editingBooking?.time || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, time: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                {/* Return Trip Details (Editable ONLY if originally requested) */}
                {(() => {
                  const originalBooking = bookings.find(b => b.id === editingBooking?.id);
                  const wasReturnOriginally = originalBooking?.isReturn || false;

                  if (!wasReturnOriginally) return null;

                  return (
                    <div className="p-4 bg-gold/5 rounded-2xl border border-gold/20 space-y-4 animate-in fade-in duration-300">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-gold">Return Trip Schedule</span>
                        <span className="text-[8px] bg-gold/10 text-gold px-2 py-0.5 rounded border border-gold/20 font-bold uppercase tracking-widest font-mono">Originally Requested</span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-1">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Return Date</label>
                          <input
                            type="date"
                            min={editingBooking?.date || new Date().toISOString().split('T')[0]}
                            value={editingBooking?.returnDate || ''}
                            onChange={(e) => setEditingBooking({ ...editingBooking, returnDate: e.target.value })}
                            className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Return Time</label>
                          <input
                            type="time"
                            value={editingBooking?.returnTime || ''}
                            onChange={(e) => setEditingBooking({ ...editingBooking, returnTime: e.target.value })}
                            className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    {/* Location fields removed from Edit Modal as per request */}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Additional Info</label>
                  <textarea
                    value={editingBooking?.additionalInfo || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, additionalInfo: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24 resize-none"
                    placeholder="Add any additional notes here..."
                  />
                </div>

                {isAdmin && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Admin Notes</label>
                    <textarea
                      value={editingBooking?.adminNotes || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, adminNotes: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-20 resize-none"
                      placeholder="Private admin notes..."
                    />
                  </div>
                )}

                {isAdmin && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Status</label>
                      <select
                        value={editingBooking?.status || 'pending'}
                        onChange={(e) => setEditingBooking({ ...editingBooking, status: e.target.value })}
                        className="custom-select w-full py-3 text-sm"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="assigned">Assigned</option>
                        <option value="accepted">Accepted</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </div>

                    {editingBooking?.status === 'cancelled' && (
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-red-400 mb-1 block">Cancellation Reason</label>
                        <textarea
                          value={editingBooking?.cancellationReason || ''}
                          onChange={(e) => setEditingBooking({ ...editingBooking, cancellationReason: e.target.value })}
                          className="w-full bg-white/5 border border-red-500/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-500 transition-all h-20 resize-none text-white font-medium"
                          placeholder="Please enter the reason for cancellation..."
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <p className="text-[8px] uppercase tracking-widest font-bold text-white/30">Fixed Details (View Only)</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-[8px] text-white/40 uppercase font-bold">Service</p>
                      <p className="text-[10px] text-white/70 uppercase font-bold text-gold">{editingBooking?.serviceType}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-white/40 uppercase font-bold">Vehicle</p>
                      <p className="text-[10px] text-white/70 uppercase font-bold">
                        {fleet.find(v => v.id === editingBooking?.vehicleId || v.name === editingBooking?.vehicleType)?.name || editingBooking?.vehicleType}
                      </p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-white/5">
                      <p className="text-[8px] text-white/40 uppercase font-bold">Total Price</p>
                      <p className="text-sm text-gold font-bold">${editingBooking?.price}</p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowBookingModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateBooking(editingBooking.id, editingBooking)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* View Booking Modal (Details) */}
        {showViewModal && viewingBooking && (
          <motion.div
            key="booking-view-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg glass p-4 md:p-8 rounded-2xl border border-gold/20 max-h-[95vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">Booking Details</h3>
                <button onClick={() => { setShowViewModal(false); setShowDistanceBreakdown(false); }} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Fare Breakdown - Hidden for Drivers & Customers (Admin Only as requested) */}
                {isAdmin && (
                  <div className="space-y-4">
                    {/* Tour Specific Details */}
                    {viewingBooking.type === 'tour' && (
                      <div className="p-4 bg-cyan-500/5 rounded-2xl border border-cyan-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-cyan-400">Tour Details</h4>
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Experience</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white/40 uppercase tracking-widest font-bold text-[9px]">Package Name</span>
                          <span className="text-white font-bold">{viewingBooking.tourTitle || 'Custom Tour'}</span>
                        </div>
                        {viewingBooking.quantity > 1 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-white/40 uppercase tracking-widest font-bold text-[9px]">Units / Guests</span>
                            <span className="text-white font-bold">{viewingBooking.quantity}</span>
                          </div>
                        )}
                        {viewingBooking.selectedExtras && !Array.isArray(viewingBooking.selectedExtras) && Object.keys(viewingBooking.selectedExtras).length > 0 && (
                          <div className="pt-2 border-t border-white/5">
                            <p className="text-[8px] uppercase tracking-widest text-cyan-400/60 font-bold mb-2">Enhancement Selection</p>
                            <div className="space-y-1.5">
                              {Object.entries(viewingBooking.selectedExtras).map(([id, count]) => {
                                const tourItem = tours.find(t => t.id === viewingBooking.tourId);
                                const extra = (tourItem?.extras || []).find((e: any) => e.id === id || e.name === id) || extras.find((e: any) => e.id === id);
                                return (
                                  <div key={`view-extra-${id}`} className="flex justify-between items-center text-[10px] text-white/70 bg-white/5 p-1.5 rounded-lg">
                                    <span>• {extra?.name || id || 'Extra'}</span>
                                    <span className="text-cyan-400 font-mono font-bold">×{count as number}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-gold mb-2">Fare Breakdown</h4>
                      {viewingBooking.priceBreakdown ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Base Fare</span>
                            <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.base || 0).toFixed(2)}</span>
                          </div>

                          {(viewingBooking.type === 'tour' || viewingBooking.type === 'offer') && (
                            <div className="flex justify-between items-center text-gold/80">
                              <span className="text-xs uppercase tracking-widest font-bold">
                                {viewingBooking.type === 'tour' ? 'Tour Package' : 'Offer Package'}
                              </span>
                              <span className="text-sm font-bold">
                                {viewingBooking.type === 'tour' ? viewingBooking.tourTitle : viewingBooking.packageTitle}
                              </span>
                            </div>
                          )}

                          {viewingBooking.priceBreakdown.distance > 0 && (
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-white/40 uppercase tracking-widest font-bold">{viewingBooking.serviceType === 'hourly' ? 'Hourly Charge' : 'Distance Charge'}</span>
                              </div>
                              <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.distance || 0).toFixed(2)}</span>
                            </div>
                          )}

                          {viewingBooking.priceBreakdown.waypoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Waypoints</span>
                              <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.waypoints || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {viewingBooking.isReturn && viewingBooking.priceBreakdown.returnPrice > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Return Trip (2x)</span>
                              <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.returnPrice || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {viewingBooking.priceBreakdown.discount > 0 && (
                            <div className="flex justify-between items-center text-green-400">
                              <span className="text-xs uppercase tracking-widest font-bold">Discount</span>
                              <span className="text-sm font-bold">-${(viewingBooking.priceBreakdown.discount || 0).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-white/5">
                            {/* Extras row */}
                            {viewingBooking.priceBreakdown.extras > 0 && (
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/40 uppercase tracking-widest font-bold">
                                  Extras
                                </span>
                                <span className="text-sm text-white font-bold">
                                  ${(viewingBooking.priceBreakdown.extras || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {/* Gross Price row */}
                            {systemSettings?.showGrossPrice !== false && viewingBooking.priceBreakdown.gross > 0 && (
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/40 uppercase tracking-widest font-bold">
                                  Gross Price
                                </span>
                                <span className="text-sm text-white font-bold">
                                  ${(viewingBooking.priceBreakdown.gross || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {/* Net Price row */}
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/60 uppercase tracking-widest font-bold">
                                Net Price
                              </span>
                              <span className="text-sm text-white font-bold">
                                ${(viewingBooking.priceBreakdown.net || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {viewingBooking.priceBreakdown.tax > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Tax</span>
                              <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.tax || 0).toFixed(2)}</span>
                            </div>
                          )}

                          {viewingBooking.priceBreakdown.appliedAddons && viewingBooking.priceBreakdown.appliedAddons.length > 0 && (
                            <div className="pt-2 border-t border-white/5 space-y-1">
                              {viewingBooking.priceBreakdown.appliedAddons.map((addon: any, aIdx: number) => (
                                <div key={`addon-view-modal-${addon.id || 'na'}-${addon.name || 'unnamed'}-${aIdx}`} className="flex justify-between items-center text-gold/60">
                                  <span className="text-[10px] uppercase tracking-widest font-bold">
                                    {addon.name} 
                                    <span className="text-[8px] opacity-40 ml-1">({addon.target})</span>
                                  </span>
                                  <span className="text-xs font-bold">
                                    {addon.impact > 0 ? '+' : '-'}${Math.abs(addon.impact).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                            <span className="text-sm text-gold uppercase tracking-widest font-bold">Total Price</span>
                            <span className="text-xl font-display text-gold">${(Number(viewingBooking.price) || 0).toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gold uppercase tracking-widest font-bold">Total Price</span>
                          <span className="text-xl font-display text-gold">${(Number(viewingBooking.price) || 0).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Distance Range Based Calculation */}
                    {isAdmin && (
                      <div className="p-4 bg-white/5 rounded-2xl border border-gold/20 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-gold">
                            {viewingBooking.serviceType === 'hourly' ? 'Hourly Price Calculation' : 'Distance Range Calculation'}
                          </h4>
                          <span className="text-[8px] bg-gold/10 text-gold px-2 py-0.5 rounded font-bold uppercase">
                            {viewingBooking.serviceType === 'hourly' ? 'Fixed Hourly' : (systemSettings?.distanceCalculationType === 'type2' ? 'Type 2: Cumulative' : 'Type 1: Range Rate')}
                          </span>
                        </div>
                        {(() => {
                          const vehicle = fleet.find(v => v.id === viewingBooking.vehicleId);
                          if (!vehicle) return null;

                          const isHourly = viewingBooking.serviceType === 'hourly';
                          const distKm = parseFloat(viewingBooking.distance?.replace(/[^\d.]/g, '') || '0');
                          const rangeCalcs = [];

                          if (isHourly) {
                            rangeCalcs.push({
                              label: 'Hourly',
                              dist: viewingBooking.hours || 1,
                              rate: vehicle.hourlyPrice,
                              total: (Number(vehicle.hourlyPrice) || 0) * (viewingBooking.hours || 1),
                              isHourly: true
                            });
                          } else if (vehicle.kmRanges && vehicle.kmRanges.length > 0) {
                            if (systemSettings?.distanceCalculationType === 'type2') {
                              // Type 2: Cumulative Range Calculation
                              let previousMax = 0;
                              for (const r of vehicle.kmRanges) {
                                if (r.label.includes('+')) {
                                  const min = parseFloat(r.label.replace('+', ''));
                                  if (distKm >= min) {
                                    const balance = distKm - previousMax;
                                    rangeCalcs.push({ label: r.label, dist: balance, rate: r.surcharge, total: balance * Number(r.surcharge) });
                                    break;
                                  }
                                } else {
                                  const [min, max] = r.label.split('-').map(Number);
                                  if (distKm > max) {
                                    const segment = max - previousMax;
                                    rangeCalcs.push({ label: r.label, dist: segment, rate: r.surcharge, total: segment * Number(r.surcharge) });
                                    previousMax = max;
                                  } else if (distKm >= min && distKm <= max) {
                                    const balance = distKm - previousMax;
                                    rangeCalcs.push({ label: r.label, dist: balance, rate: r.surcharge, total: balance * Number(r.surcharge) });
                                    break;
                                  }
                                }
                              }
                            } else {
                              // Type 1: Total Distance * Rate of the range it falls into
                              let selectedRange = null;
                              for (const r of vehicle.kmRanges) {
                                if (r.label.includes('+')) {
                                  const min = parseFloat(r.label.replace('+', ''));
                                  if (distKm >= min) {
                                    selectedRange = r;
                                    break;
                                  }
                                } else {
                                  const [min, max] = r.label.split('-').map(Number);
                                  if (distKm >= min && distKm <= max) {
                                    selectedRange = r;
                                    break;
                                  }
                                }
                              }
                              if (selectedRange) {
                                rangeCalcs.push({
                                  label: selectedRange.label,
                                  dist: distKm,
                                  rate: selectedRange.surcharge,
                                  total: distKm * Number(selectedRange.surcharge)
                                });
                              }
                            }
                          }

                          if (rangeCalcs.length === 0) {
                            return <p className="text-[10px] text-white/30 uppercase tracking-widest">No range-based pricing applied</p>;
                          }

                          return (
                            <div className="space-y-2">
                              {rangeCalcs.map((calc, i) => (
                                <div key={`calc-range-${i}`} className="flex justify-between items-center text-[10px]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-gold" />
                                    <span className="text-white font-bold uppercase tracking-tighter">{calc.label} {calc.isHourly ? '' : 'Range'}</span>
                                    <span className="text-white/40">({calc.dist.toFixed(1)} {calc.isHourly ? 'h' : 'km'} × ${calc.rate})</span>
                                  </div>
                                  <span className="text-white font-bold">${calc.total.toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                <span className="text-[9px] text-gold font-bold uppercase tracking-widest">
                                  {viewingBooking.serviceType === 'hourly' ? 'Total Hourly Charge' : 'Total Distance Charge'}
                                </span>
                                <span className="text-xs text-gold font-bold">${rangeCalcs.reduce((acc, curr) => acc + curr.total, 0).toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {viewingBooking.waypoints?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Waypoints</h4>
                      <div className="space-y-2">
                        {(viewingBooking.waypoints || []).map((wp: any, idx: number) => (
                          <div key={`view-wp-${idx}`} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-start gap-3">
                            <MapPin size={12} className="text-gold mt-0.5 shrink-0" />
                            <p className="text-[10px] text-white/70">{wp.address || wp}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingBooking.selectedExtras && (Array.isArray(viewingBooking.selectedExtras) ? viewingBooking.selectedExtras.length > 0 : Object.keys(viewingBooking.selectedExtras).length > 0) && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Selected Extras</h4>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {Array.isArray(viewingBooking.selectedExtras) ? (
                          viewingBooking.selectedExtras.map((extraId: string, index: number) => {
                            const extra = extras.find(e => e.id === extraId);
                            return (
                              <span key={`${extraId}-${index}`} className="px-3 py-1 bg-gold/10 border border-gold/20 rounded-full text-[10px] text-gold font-bold uppercase">
                                {extra?.name || 'Extra'}
                              </span>
                            );
                          })
                        ) : (
                          Object.entries(viewingBooking.selectedExtras || {}).map(([id, count]) => {
                            const tourItem = tours.find(t => t.id === viewingBooking.tourId);
                            const extra = (tourItem?.extras || []).find((e: any) => e.id === id || e.name === id) || extras.find((e: any) => e.id === id);
                            return (
                              <div key={`extra-summary-${id}`} className="flex items-center gap-2 bg-gold/10 border border-gold/20 px-3 py-1 rounded-full text-gold">
                                <span className="text-[10px] font-bold uppercase">{extra?.name || id || 'Extra'}</span>
                                <span className="text-[9px] font-black opacity-60">×{count as number}</span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Category Specific Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      {viewingBooking.type === 'tour' && (
                        <>
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Tour Title</p>
                            <p className="text-[10px] text-gold font-bold">{viewingBooking.tourTitle || viewingBooking.packageTitle || 'N/A'}</p>
                          </div>
                          {viewingBooking.hours && (
                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                              <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Hours</p>
                              <p className="text-[10px] text-white font-bold">{viewingBooking.hours} hrs</p>
                            </div>
                          )}
                        </>
                      )}
                      {viewingBooking.type === 'offer' && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                          <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Offer Title</p>
                          <p className="text-[10px] text-gold font-bold">{viewingBooking.packageTitle || 'N/A'}</p>
                        </div>
                      )}
                      {(viewingBooking.customerEmail || viewingBooking.customerPhone) && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 col-span-2">
                          <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Customer Liaison</p>
                          <div className="flex flex-wrap gap-4">
                            {viewingBooking.customerEmail && (
                              <div className="flex items-center gap-1.5">
                                <Mail size={10} className="text-gold" />
                                <span className="text-[10px] text-white/70">{viewingBooking.customerEmail}</span>
                              </div>
                            )}
                            {viewingBooking.customerPhone && (
                              <div className="flex items-center gap-1.5">
                                <Phone size={10} className="text-gold" />
                                <span className="text-[10px] text-white/70">{viewingBooking.customerPhone}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {(viewingBooking.distance && viewingBooking.distance !== 'N/A') || (viewingBooking.duration && viewingBooking.duration !== 'N/A') ? (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Ride Information</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {viewingBooking.distance && viewingBooking.distance !== 'N/A' && (
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Distance (One Way)</p>
                            <p className="text-[10px] text-white font-bold">{viewingBooking.distance}</p>
                          </div>
                        )}
                        {viewingBooking.duration && viewingBooking.duration !== 'N/A' && (
                          <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">ETA (One Way)</p>
                            <p className="text-[10px] text-white font-bold">{viewingBooking.duration}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {viewingBooking.flightNumber && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Flight Information</h4>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Plane size={16} className="text-gold" />
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Flight Number</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white font-bold">{viewingBooking.flightNumber}</p>
                              <a
                                href={`https://www.melbourneairport.com.au/flights/departures/${viewingBooking.flightNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold hover:text-white transition-colors"
                                title="View on Melbourne Airport website"
                              >
                                <Globe size={14} />
                              </a>
                            </div>
                          </div>
                        </div>
                        {viewingBooking.flightStatus && (
                          <div className="text-right">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Status</p>
                            <p className="text-[10px] text-gold font-bold uppercase">{viewingBooking.flightStatus}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {viewingBooking.purpose && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Additional Information</h4>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-xs text-white/70 leading-relaxed italic">"{viewingBooking.purpose}"</p>
                      </div>
                    </div>
                  )}

                  {/* Enhanced Status Bar: Driver Info or Feedback (Condition Based) */}
                  <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 mt-6">
                    {viewingBooking.status === 'cancelled' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center shrink-0">
                            <XCircle size={20} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-500">
                              Ride Cancelled
                            </p>
                            <p className="text-xs font-bold text-white">
                              Booking cancelled
                            </p>
                          </div>
                        </div>
                        <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10 mt-3">
                          <p className="text-[10px] uppercase tracking-widest font-bold text-red-400 mb-1">
                            Cancellation Reason
                          </p>
                          <p className="text-[10px] text-white/70 italic leading-relaxed">
                            "{viewingBooking.cancellationReason || 'No reason provided'}"
                          </p>
                        </div>
                      </div>
                    ) : viewingBooking.status === 'completed' ? (
                      <div className="space-y-4">
                        {/* Driver details shown even for completed rides as requested */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/5 animate-in fade-in duration-300">
                          <div className="flex items-center gap-3 w-full">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-purple-500/10 text-purple-400">
                              <Truck size={20} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[9px] font-black uppercase tracking-[0.2em] mb-0.5 text-purple-400">
                                Chauffeur Assigned
                              </p>
                              <p className="text-xs font-bold text-white truncate">
                                {consolidatedUsers.find(d => d.id === viewingBooking.driverId)?.name || 'No Dispatch'}
                                {consolidatedUsers.find(d => d.id === viewingBooking.driverId)?.phone && ` | ${consolidatedUsers.find(d => d.id === viewingBooking.driverId)?.phone}`}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Feedback / Rating Details */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                                <Star size={14} className="text-gold fill-gold" />
                              </div>
                              <div>
                                <p className="text-[8px] text-white/30 font-black tracking-widest">
                                  Feedback for {consolidatedUsers.find(d => d.id === viewingBooking.driverId)?.name || 'Unknown Driver'}
                                </p>
                                <div className="flex items-center gap-0.5">
                                  {[...Array(5)].map((_, i) => (
                                    <Star key={i} size={10} className={cn("fill-current", i < (viewingBooking.rating || 0) ? "text-gold" : "text-white/10")} />
                                  ))}
                                </div>
                              </div>
                            </div>
                            {!isAdmin && !isDriver && (
                              <button
                                onClick={() => setRatingBooking(viewingBooking)}
                                className="p-1.5 bg-white/5 hover:bg-gold/10 rounded-lg transition-all"
                              >
                                <SquarePen size={12} className="text-white/40" />
                              </button>
                            )}
                          </div>
                          {viewingBooking.feedback && (
                            <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                              <p className="text-[10px] text-white/60 italic leading-relaxed">
                                "{viewingBooking.feedback}"
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 w-full">
                          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", viewingBooking.driverId ? "bg-purple-500/10 text-purple-400" : "bg-red-500/10 text-red-500")}>
                            {viewingBooking.driverId ? <Truck size={20} /> : <UserMinus size={20} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[9px] font-black uppercase tracking-[0.2em] mb-0.5", viewingBooking.driverId ? "text-purple-400" : "text-red-500")}>
                              {viewingBooking.driverId ? 'Chauffeur Assigned' : 'Awaiting Assignment'}
                            </p>
                            <p className="text-xs font-bold text-white truncate">
                              {consolidatedUsers.find(d => d.id === viewingBooking.driverId)?.name || 'No Dispatch'}
                              {consolidatedUsers.find(d => d.id === viewingBooking.driverId)?.phone && ` | ${consolidatedUsers.find(d => d.id === viewingBooking.driverId)?.phone}`}
                            </p>
                          </div>
                          {isAdmin && !viewingBooking.driverId && (
                            <div className="relative">
                              <button
                                onClick={() => setShowViewModal(false)}
                                className="px-3 py-1.5 bg-gold/10 border border-gold/20 rounded-lg text-[9px] font-black text-gold uppercase tracking-widest hover:bg-gold hover:text-black transition-all"
                              >
                                Assign Now
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Actions for Drivers & Customers */}
                {viewingBooking.status !== 'cancelled' && viewingBooking.status !== 'completed' && (
                  <div className="flex flex-col gap-2 pt-2">
                    {isDriver && viewingBooking.status === 'assigned' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            updateBookingStatus(viewingBooking.id, 'accepted');
                            setShowViewModal(false);
                          }}
                          className="flex-1 bg-green-500 hover:bg-green-600 text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                          <CheckCircle size={16} />
                          Accept Ride
                        </button>
                        <button
                          onClick={() => {
                            updateBookingStatus(viewingBooking.id, 'rejected', '');
                            setShowViewModal(false);
                          }}
                          className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-red-500/30"
                        >
                          <XCircle size={16} />
                          Reject
                        </button>
                      </div>
                    )}
                    {isDriver && viewingBooking.status === 'accepted' && (
                      <button
                        onClick={() => {
                          updateBookingStatus(viewingBooking.id, 'completed');
                          setShowViewModal(false);
                        }}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <CheckSquare size={16} />
                        Mark as Completed
                      </button>
                    )}
                    {!isAdmin && !isDriver && ['pending', 'confirmed'].includes(viewingBooking.status) && (
                      <button
                        onClick={() => {
                          setCancellingBookingId(viewingBooking.id);
                          setShowViewModal(false);
                        }}
                        className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                        <CircleX size={16} />
                        Cancel Booking
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={() => { setShowViewModal(false); setShowDistanceBreakdown(false); }}
                  className="w-full bg-gold text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Dynamic Booking Chat Modal (Separate Window) */}
        <AnimatePresence>
          {chatBooking && (
            <motion.div
              key="booking-chat-modal"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[150] flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-xl glass p-5 md:p-6 rounded-2xl border border-gold/20 flex flex-col relative max-h-[90vh] overflow-hidden"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-display font-medium text-gold tracking-wide flex items-center gap-2">
                      <MessageSquare size={16} />
                      Secure Dispatch & Chat
                    </h3>
                    <p className="text-[9px] text-white/40 font-mono mt-0.5">Booking Reference: #{chatBooking.id.substring(0, 8).toUpperCase()}</p>
                  </div>
                  <button
                    onClick={() => setChatBooking(null)}
                    className="text-white/40 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden rounded-xl">
                  <BookingChat
                    bookingId={chatBooking.id}
                    user={user}
                    userProfile={userProfile}
                    isAdmin={isAdmin}
                    showDashboardNotice={showDashboardNotice}
                  />
                </div>

                <div className="mt-3 text-[10px] text-white/30 text-center leading-relaxed">
                  <span className="font-bold text-gold/80 block mb-0.5">Coordination Notice:</span>
                  This chat channel is monitored in real-time by dispatch and is archived for security and service quality.
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Route Modal */}
        {showRouteModal && routeBooking && (
          <motion.div
            key="booking-route-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[150] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-4xl glass p-4 md:p-8 rounded-lg md:rounded-sm border border-gold/20 overflow-y-auto custom-scrollbar flex flex-col max-h-[95vh] md:max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <div>
                  <h3 className="text-lg md:text-xl font-display text-gold">Travel Route Path</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[8px] md:text-[9px] px-2 py-0.5 bg-gold/10 text-gold rounded border border-gold/20 font-bold uppercase tracking-widest">Pickup</span>
                    <p className="text-[9px] md:text-[10px] text-white/70 truncate max-w-[100px] md:max-w-[150px]">{routeBooking.pickup}</p>

                    {routeBooking.waypoints?.length > 0 && (
                      <>
                        <ArrowRight size={10} className="text-white/20" />
                        <span className="text-[8px] md:text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-400/20 font-bold uppercase tracking-widest">
                          {routeBooking.waypoints.length} Stops
                        </span>
                      </>
                    )}

                    <ArrowRight size={10} className="text-white/20" />
                    <span className="text-[8px] md:text-[9px] px-2 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20 font-bold uppercase tracking-widest">Dropoff</span>
                    <p className={cn("text-[9px] md:text-[10px] truncate max-w-[100px] md:max-w-[150px]", routeBooking.dropoff ? "text-white/70" : "text-white/60 italic")}>
                      {routeBooking.dropoff || (routeBooking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowRouteModal(false)} className="text-white/40 hover:text-white p-2">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 h-[450px] md:h-[500px] min-h-[450px] md:min-h-[500px] relative rounded-xl md:rounded-2xl overflow-hidden border border-white/10 mb-4 md:mb-6">
                <RouteMap
                  booking={routeBooking}
                  onClose={() => setShowRouteModal(false)}
                />
              </div>

              <div className="mb-4 md:mb-6">
                <h4 className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 md:mb-3">Orderly Route Details</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                    <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] text-gold font-bold">P</span>
                    </div>
                    <p className="text-[10px] text-white/70">{routeBooking.pickup}</p>
                  </div>

                  {routeBooking.waypoints?.map((wp: string, i: number) => (
                    <div key={`route-wp-${i}`} className="flex items-start gap-3 p-2 bg-white/5 rounded-lg border border-white/5 ml-4">
                      <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] text-blue-400 font-bold">{i + 1}</span>
                      </div>
                      <p className="text-[10px] text-white/70">{wp}</p>
                    </div>
                  ))}

                  <div className="flex items-start gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] text-green-400 font-bold">D</span>
                    </div>
                    <p className={cn("text-[10px]", routeBooking.dropoff ? "text-white/70" : "text-white/60 italic")}>
                      {routeBooking.dropoff || (routeBooking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                    <Navigation size={20} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Total Distance</p>
                    <p className="text-lg font-display text-white">
                      {(() => {
                        if (!routeBooking.distance) return 'N/A';
                        if (!routeBooking.isReturn) return routeBooking.distance;
                        const num = parseFloat(routeBooking.distance.replace(/[^\d.]/g, ''));
                        return `${(num * 2).toFixed(1)} km`;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                    <Clock size={20} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      {routeBooking.serviceType === 'hourly' ? 'Selected Duration' : 'Est. Travel Time'}
                    </p>
                    <p className="text-lg font-display text-white">
                      {routeBooking.serviceType === 'hourly' ? `${routeBooking.hours} Hours` : (() => {
                        if (!routeBooking.duration) return 'N/A';
                        if (!routeBooking.isReturn) return routeBooking.duration;
                        const match = routeBooking.duration.match(/(\d+)\s*min/);
                        if (match) {
                          return `${parseInt(match[1]) * 2} mins`;
                        }
                        return routeBooking.duration;
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowRouteModal(false)}
                  className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white border border-white/10 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const origin = encodeURIComponent(routeBooking.pickup);
                    const destination = encodeURIComponent(routeBooking.dropoff);
                    const waypoints = (routeBooking.waypoints || []).map((wp: string) => encodeURIComponent(wp)).join('|');
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
                    window.open(url, '_blank');
                  }}
                  className="flex-1 bg-gradient-to-r from-gold to-yellow-600 text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:from-white hover:to-white transition-all shadow-lg shadow-gold/20 flex items-center justify-center gap-2"
                >
                  <Navigation size={16} fill="currentColor" />
                  Start Ride
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Bulk Management Bar */}
      <AnimatePresence>
        {selectedBookings.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[95%] max-w-2xl"
          >
            <div className="glass border border-gold/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center border border-gold/20">
                  <span className="text-gold font-display font-bold">{selectedBookings.length}</span>
                </div>
                <div>
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-black text-gold">Bulk Management</h4>
                  <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Manage {selectedBookings.length} selected rides</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin && (
                  <div className="flex items-center gap-1.5 px-3 border-x border-white/10">
                    <button
                      onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'pending')}
                      className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500 hover:text-white transition-all"
                      title="Pending"
                    ><Clock size={16} /></button>
                    <button
                      onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'confirmed')}
                      className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                      title="Confirm"
                    ><CheckCircle size={16} /></button>
                    <button
                      onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'cancelled')}
                      className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                      title="Cancel"
                    ><XCircle size={16} /></button>
                    
                    <div className="relative">
                      <button
                        onClick={() => setShowDriverBulkAssign(!showDriverBulkAssign)}
                        className="p-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-all"
                        title="Assign Driver"
                      ><Truck size={16} /></button>
                      
                      {showDriverBulkAssign && (
                        <div className="absolute bottom-full right-0 mb-3 w-56 bg-black/95 p-3 rounded-2xl border border-gold/30 shadow-2xl z-[110] flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar backdrop-blur-xl">
                          <div className="text-[8px] uppercase tracking-[0.2em] text-gold px-2 py-1 font-bold border-b border-white/5 mb-1">Assign Chauffeur</div>
                          <button
                            onClick={() => { executeBulkAssignDriver(selectedBookings, null); setShowDriverBulkAssign(false); }}
                            className="text-left px-3 py-2 text-[10px] uppercase tracking-widest font-black text-white/40 hover:bg-white/10 hover:text-white rounded-xl transition-all"
                          >None (Unassign)</button>
                          {drivers.map((driver, idx) => {
                            const stats = driverStats[driver.id] || { avgRating: '0', completedCount: 0, rejectedCount: 0 };
                            return (
                              <button
                                key={`float-driver-${driver.id}-${idx}`}
                                onClick={() => { executeBulkAssignDriver(selectedBookings, driver.id); setShowDriverBulkAssign(false); }}
                                className="text-left px-3 py-2 text-[10px] uppercase font-bold text-white/70 hover:bg-gold/10 hover:text-gold rounded-xl transition-all flex items-center justify-between"
                              >
                                <span>{driver.name}</span>
                                <span className="text-[8px] opacity-50">{stats.avgRating}★</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isDriver && !isAdmin && (
                  <div className="flex items-center gap-1.5 px-3 border-x border-white/10">
                    <button
                      onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'accepted')}
                      className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                    ><CheckCircle size={16} /></button>
                    <button
                      onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'completed')}
                      className="p-2 bg-gold/10 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                    ><CheckSquare size={16} /></button>
                  </div>
                )}

                <div className="flex items-center gap-2 pl-2">
                  {isAdmin && (
                    <button
                      onClick={() => setConfirmDelete({ type: 'bulk-bookings', ids: selectedBookings })}
                      className="p-2 bg-red-500 border border-red-500/50 text-white rounded-lg hover:bg-white hover:text-red-500 transition-all shadow-lg shadow-red-500/20"
                    ><Trash2 size={16} /></button>
                  )}
                  <button
                    onClick={() => {
                      setSelectedBookings([]);
                      setIsBookingsSelectionMode(false);
                    }}
                    className="p-2 text-white/40 hover:text-white transition-all"
                    title="Deselect All"
                  ><XSquare size={16} /></button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}