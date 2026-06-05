import { motion } from 'motion/react';
import {
  format, subMonths, addMonths, isSameMonth, isToday,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, parseISO, isSameYear, isSameDay
} from 'date-fns';
import { X, MapPin, Eye, PiggyBank, Activity, ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import {
  googleSignInWithCalendar,
  syncBookingToCalendar,
  getCalendarAccessToken,
  deleteBookingFromCalendar
} from '../../services/googleCalendarService';
import ConfirmationModal from './ConfirmationModal';

interface CalendarTabProps {
  isAdmin: boolean;
  user: any;
  userProfile?: any;
  showDashboardNotice?: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
}

export default function CalendarTab({
  isAdmin,
  user,
  userProfile,
  showDashboardNotice
}: CalendarTabProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [calendarDateType, setCalendarDateType] = useState<'pickup' | 'booking'>('pickup');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayBookings, setShowDayBookings] = useState(false);
  const [showNotesPopup, setShowNotesPopup] = useState<string | null>(null);

  const [gcalToken, setGcalToken] = useState<string | null>(getCalendarAccessToken());
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  const [syncLogs, setSyncLogs] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('gcal_sync_logs');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const addSyncLog = (type: 'sync' | 'update' | 'remove' | 'info' | 'error', message: string, bookingId?: string) => {
    const newLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      type,
      message,
      bookingId,
      userRole: userProfile?.role || 'customer',
      userId: user?.uid || 'unknown'
    };
    setSyncLogs(prev => {
      const updated = [newLog, ...prev].slice(0, 50);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gcal_sync_logs', JSON.stringify(updated));
      }
      return updated;
    });

    if (showDashboardNotice) {
      const noticeType = type === 'error' ? 'error' : (type === 'remove' ? 'warning' : 'success');
      showDashboardNotice(noticeType, message, 'Google Calendar Sync');
    }
  };

  const clearSyncLogs = () => {
    setSyncLogs([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('gcal_sync_logs');
    }
    if (showDashboardNotice) {
      showDashboardNotice('info', 'Google Calendar activity log cleared.', 'Logs Cleared');
    }
  };

  // Sync token from service on load and listen to unauthorized invalidations
  useEffect(() => {
    setGcalToken(getCalendarAccessToken());

    const handleUnauthorized = () => {
      setGcalToken(null);
      addSyncLog('error', 'Your Google Calendar session has expired or is invalid. Please reconnect to restore automatic synchronization.');
      showDashboardNotice?.('error', 'Google Calendar session expired. Please connect again.', 'Session Expired');
    };

    window.addEventListener('gcal_unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('gcal_unauthorized', handleUnauthorized);
    };
  }, []);

  const handleConnectGCal = async () => {
    try {
      const gLinkEmail = userProfile?.googleLinkGmail || '';
      if (!gLinkEmail) {
        addSyncLog('error', 'Google Products Gmail is required. Please set up your Google Products Association in your Profile settings before linking Google Calendar.');
        showDashboardNotice?.('error', 'Please configure your Google Products Gmail on your Profile.', 'Configuration Missing');
        return;
      }
      const token = await googleSignInWithCalendar(gLinkEmail);
      if (token) {
        setGcalToken(token);
        addSyncLog('info', `Successfully connected Google Calendar session for specified Gmail account: ${gLinkEmail}.`);
        
        // Auto trigger bulk sync of month bookings after connection
        showDashboardNotice?.('success', 'Connected successfully! Auto-syncing month bookings...', 'Calendar Connected');
        setTimeout(() => {
          handleSyncAllMonthBookings(token);
        }, 800);
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || 'Google Calendar authorization failed. Could not sync scopes.';
      addSyncLog('error', errMsg);
      showDashboardNotice?.('error', errMsg, 'Authorization Failed');
    }
  };

  const handleDisconnectGCal = () => {
    setShowDisconnectModal(true);
  };

  const handleConfirmDisconnect = async () => {
    setShowDisconnectModal(false);
    const syncedBookings = bookings.filter(b => b.calendarEventId || b.returnCalendarEventId);

    if (syncedBookings.length > 0) {
      let successCount = 0;
      for (const b of syncedBookings) {
        try {
          const ok = await deleteBookingFromCalendar(b);
          if (ok) successCount++;
        } catch (err) {
          console.error('Error removing event on disconnect:', err);
        }
      }
      addSyncLog('info', `Successfully cleared ${successCount} events from Google Calendar.`);
    }

    import('../../services/googleCalendarService').then(async (service) => {
      service.setCalendarAccessToken(null);
      setGcalToken(null);

      // Update users profile in firestore to clear calendarLinked flag
      if (user?.uid) {
        try {
          const { doc, updateDoc } = await import('firebase/firestore');
          await updateDoc(doc(db, 'users', user.uid), { calendarLinked: false });
        } catch (err) {
          console.warn('Failed to clear calendarLinked from user profile:', err);
        }
      }

      addSyncLog('info', 'Disconnected Google Calendar session and invalidated the active session token.');
    });
  };

  const handleSyncBooking = async (booking: any) => {
    if (!gcalToken) {
      addSyncLog('error', 'Google Calendar integration must be connected first.');
      return;
    }
    setSyncingId(booking.id);
    const isUpdate = !!booking.calendarEventId;
    const success = await syncBookingToCalendar(booking);
    setSyncingId(null);
    if (success) {
      if (isUpdate) {
        addSyncLog('update', `Manually updated ride for ${booking.customerName} (Ref: ${booking.id?.substring(0, 6) || ''}) on Google Calendar.`, booking.id);
      } else {
        addSyncLog('sync', `Manually synced scheduled ride for ${booking.customerName} (Ref: ${booking.id?.substring(0, 6) || ''}) to Google Calendar.`, booking.id);
      }
    } else {
      addSyncLog('error', `Could not synchronize booking for ${booking.customerName} to Google Calendar.`, booking.id);
    }
  };

  const handleSyncAllMonthBookings = async (forcedToken?: string | any) => {
    const tokenStr = (forcedToken && typeof forcedToken === 'string') ? forcedToken : undefined;
    const activeToken = tokenStr || gcalToken;
    if (!activeToken) return;
    setSyncingAll(true);
    let successCount = 0;

    // Filter bookings for current month that are not completed, cancelled, or rejected
    const monthBookings = bookings.filter(b => {
      if (b.status === 'completed' || b.status === 'cancelled' || b.status === 'rejected') return false;
      let bDate;
      if (calendarDateType === 'pickup') {
        if (!b.date) return false;
        bDate = parseISO(b.date);
      } else {
        bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : (b.createdAt ? parseISO(b.createdAt) : null);
      }
      if (!bDate || isNaN(bDate.getTime())) return false;
      return isSameMonth(bDate, currentMonth) && isSameYear(bDate, currentMonth);
    });

    addSyncLog('info', `Bulk syncing ${monthBookings.length} booking records for ${format(currentMonth, 'MMMM yyyy')}...`);

    for (const b of monthBookings) {
      const isOk = await syncBookingToCalendar(b);
      if (isOk) successCount++;
    }

    setSyncingAll(false);
    addSyncLog('sync', `Successfully synchronized ${successCount} booking records cleanly to Google Calendar.`);
  };

  useEffect(() => {
    if (!user || !userProfile) return;
    const isDriver = userProfile?.role === 'driver';
    const q = isAdmin
      ? query(collection(db, 'bookings'), orderBy('createdAt', 'desc'))
      : isDriver
        ? query(collection(db, 'bookings'), where('driverId', '==', user.uid), orderBy('createdAt', 'desc'))
        : query(collection(db, 'bookings'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error('Firestore snapshot subscription error:', error);
    });
    return () => unsubscribe();
  }, [user, userProfile, isAdmin]);

  // Automatic Background Sync and auto-removal for modified/cancelled records when Calendar Session is linked
  useEffect(() => {
    if (!gcalToken || bookings.length === 0 || syncingAll) return;

    const autoSyncAndCleanup = async () => {
      const isDriver = userProfile?.role === 'driver';
      const currentUserId = user?.uid;

      const getEventId = (b: any) => {
        return currentUserId ? (b.gcalEvents?.[currentUserId]?.eventId || null) : b.calendarEventId;
      };

      const getReturnEventId = (b: any) => {
        return currentUserId ? (b.gcalEvents?.[currentUserId]?.returnEventId || null) : b.returnCalendarEventId;
      };

      // 1. Find bookings without eventId that are allowed to sync based on user role
      const unsynced = bookings.filter(b => {
        const hasEvent = !!getEventId(b) || (b.returnDate && b.returnTime && !!getReturnEventId(b));
        if (hasEvent) return false;

        if (isDriver) {
          // Drivers only sync rides that are ACCEPTED
          return b.status === 'accepted';
        } else {
          // Others sync any active ride
          return b.status !== 'cancelled' && b.status !== 'rejected' && b.status !== 'completed';
        }
      });

      if (unsynced.length > 0) {
        for (const b of unsynced) {
          const success = await syncBookingToCalendar(b);
          if (success) {
            addSyncLog('sync', `Automatically synced scheduled ride for ${b.customerName} (Ref: ${b.id?.substring(0, 6) || ''}) to Google Calendar.`, b.id);
          }
        }
      }

      // 2. Find synced active bookings that have been edited (dates, times, status, etc.)
      const modified = bookings.filter(b => {
        const hasEvent = !!getEventId(b) || !!getReturnEventId(b);
        if (!hasEvent) return false;

        if (isDriver) {
          // Drivers only sync rides that are ACCEPTED
          if (b.status !== 'accepted') return false;
        } else {
          if (b.status === 'cancelled' || b.status === 'rejected' || b.status === 'completed') return false;
        }

        const syncedAtStr = currentUserId ? (b.gcalEvents?.[currentUserId]?.syncedAt) : b.syncedToCalendarAt;
        if (!syncedAtStr) return true;

        const syncedTime = new Date(syncedAtStr).getTime();
        if (b.updatedAt) {
          let updateTime = 0;
          if (b.updatedAt.seconds) {
            updateTime = b.updatedAt.seconds * 1000;
          } else {
            updateTime = new Date(b.updatedAt).getTime();
          }
          if (updateTime > syncedTime + 3000) {
            return true;
          }
        }
        return false;
      });

      if (modified.length > 0) {
        for (const b of modified) {
          const success = await syncBookingToCalendar(b);
          if (success) {
            addSyncLog('update', `Automatically patched Calendar details for ${b.customerName} (Ref: ${b.id?.substring(0, 6) || ''}) to match database changes.`, b.id);
          }
        }
      }

      // 3. Cancelled, Completed, Rejected, or (for drivers) Unaccepted bookings with active events to be auto removed
      const cancelledWithEvent = bookings.filter(b => {
        const hasEvent = !!getEventId(b) || !!getReturnEventId(b);
        if (!hasEvent) return false;

        if (isDriver) {
          return b.status !== 'accepted';
        } else {
          return b.status === 'cancelled' || b.status === 'rejected' || b.status === 'completed';
        }
      });

      if (cancelledWithEvent.length > 0) {
        for (const b of cancelledWithEvent) {
          const success = await deleteBookingFromCalendar(b);
          if (success) {
            addSyncLog('remove', `Automatically cleared finished/cancelled ride for ${b.customerName} (Ref: ${b.id?.substring(0, 6) || ''}) from Google Calendar.`, b.id);
          }
        }
      }
    };

    // Slight debounce so multiple items don't trigger simultaneously and flood requests
    const timeout = setTimeout(autoSyncAndCleanup, 1500);
    return () => clearTimeout(timeout);
  }, [bookings, gcalToken, syncingAll, user, userProfile]);

  const visibleSyncLogs = useMemo(() => {
    if (isAdmin) {
      return syncLogs;
    }
    const currentUserId = user?.uid;
    return syncLogs.filter((log) => {
      if (log.userId === currentUserId) return true;
      if (log.bookingId) {
        return bookings.some(b => b.id === log.bookingId);
      }
      return false;
    });
  }, [syncLogs, isAdmin, user, bookings]);

  const calendarDays = useMemo(() => {
    if (!currentMonth || isNaN(currentMonth.getTime())) return [];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const calendarStats = useMemo(() => {
    const monthBookings = bookings.filter(b => {
      if (calendarDateType === 'pickup') {
        let isPickupInMonth = false;
        if (b.date) {
          try {
            const bDate = parseISO(b.date);
            isPickupInMonth = bDate && isSameMonth(bDate, currentMonth) && isSameYear(bDate, currentMonth);
          } catch { }
        }
        let isReturnInMonth = false;
        if (b.returnDate) {
          try {
            const rDate = parseISO(b.returnDate);
            isReturnInMonth = rDate && isSameMonth(rDate, currentMonth) && isSameYear(rDate, currentMonth);
          } catch { }
        }
        return isPickupInMonth || isReturnInMonth;
      } else {
        const bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : (b.createdAt ? parseISO(b.createdAt) : null);
        return bDate && isSameMonth(bDate, currentMonth) && isSameYear(bDate, currentMonth);
      }
    });

    const stats = {
      totalRevenue: 0,
      completed: { count: 0, revenue: 0 },
      cancelled: { count: 0, revenue: 0 },
      pending: { count: 0, revenue: 0 },
      standard: { count: 0, revenue: 0 },
      tours: { count: 0, revenue: 0 },
      offers: { count: 0, revenue: 0 },
      statusCounts: {} as Record<string, number>
    };

    monthBookings.forEach(b => {
      const price = Number(b.price) || 0;
      if (b.status === 'completed') {
        stats.completed.count++;
        stats.completed.revenue += price;
        stats.totalRevenue += price;
      } else if (b.status === 'cancelled') {
        stats.cancelled.count++;
        stats.cancelled.revenue += price;
      } else {
        stats.pending.count++;
        stats.pending.revenue += price;
      }

      if (b.offerId || b.type === 'offer' || b.bookingType === 'offer') {
        stats.offers.count++;
        stats.offers.revenue += price;
      } else if (b.tourId || b.type === 'tour' || b.bookingType === 'tour') {
        stats.tours.count++;
        stats.tours.revenue += price;
      } else {
        stats.standard.count++;
        stats.standard.revenue += price;
      }

      const statusKey = b.status || 'unknown';
      if (!stats.statusCounts[statusKey]) stats.statusCounts[statusKey] = 0;
      stats.statusCounts[statusKey]++;
    });

    return stats;
  }, [bookings, currentMonth, calendarDateType]);

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(b => {
      if (calendarDateType === 'pickup') {
        let matchesPickup = false;
        if (b.date) {
          try {
            const bDate = parseISO(b.date);
            matchesPickup = bDate && isSameDay(bDate, date);
          } catch {
            matchesPickup = false;
          }
        }

        let matchesReturn = false;
        if (b.returnDate) {
          try {
            const returnDate = parseISO(b.returnDate);
            matchesReturn = returnDate && isSameDay(returnDate, date);
          } catch {
            matchesReturn = false;
          }
        }

        return matchesPickup || matchesReturn;
      } else {
        const bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : (b.createdAt ? parseISO(b.createdAt) : null);
        return bDate && isSameDay(bDate, date);
      }
    });
  };

  const formatTimeToAMPM = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) return timeStr;
      const [hours, minutes] = timeStr.split(':');
      if (hours === undefined || minutes === undefined) return timeStr;
      let h = parseInt(hours);
      const m = minutes;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12;
      return `${h}:${m} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };
  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 w-full">
        {/* Row 1: Title & Toggle */}
        <div className="flex flex-row items-center justify-between w-full">
          <h3 className="text-xl sm:text-2xl font-display text-gold">Booking Calendar</h3>

          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setCalendarDateType('pickup')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                calendarDateType === 'pickup'
                  ? "bg-gold text-black shadow-lg"
                  : "text-white/40 hover:text-white"
              )}
            >
              Pickup Date
            </button>
            <button
              onClick={() => setCalendarDateType('booking')}
              className={cn(
                "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                calendarDateType === 'booking'
                  ? "bg-gold text-black shadow-lg"
                  : "text-white/40 hover:text-white"
              )}
            >
              Booking Date
            </button>
          </div>
        </div>
      </div>

      {/* Google Calendar Control Panel */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-4 md:p-5 rounded-[2rem] border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gradient-to-r from-white/[0.01] to-gold/[0.02]"
      >
        <div className="flex items-center gap-2.5 md:gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-gold/10 flex items-center justify-center text-gold border border-gold/20 shrink-0">
            <CalendarIcon size={20} className="md:hidden" />
            <CalendarIcon size={24} className="hidden md:block" />
          </div>
          <div>
            <h4 className="text-[11px] md:text-sm font-display text-white flex items-center gap-1.5 md:gap-2 flex-wrap">
              Google Calendar Automatic Sync
              {gcalToken ? (
                <span className="flex items-center gap-1 text-[7px] md:text-[9px] bg-green-500/10 text-green-500 border border-green-500/20 px-1.5 md:px-2 py-0.5 rounded-full font-bold uppercase tracking-widest font-sans">
                  <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                  Active
                </span>
              ) : (
                <span className="text-[7px] md:text-[9px] bg-white/5 text-white/50 border border-white/10 px-1.5 md:px-2 py-0.5 rounded-full font-bold uppercase tracking-widest font-sans">
                  Inactive
                </span>
              )}
            </h4>
            <p className="text-[10px] md:text-xs text-white/40 mt-0.5 leading-relaxed">
              {gcalToken
                ? "Your active session is connected. Booking records will automatically record in your Google Calendar."
                : "Authorize your Google Calendar to seamlessly link, view, and sync ride bookings."}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 md:gap-3.5 w-full sm:w-auto justify-end">
          {gcalToken ? (
            <>
              <button
                onClick={handleSyncAllMonthBookings}
                disabled={syncingAll}
                className="px-3 md:px-4 py-2 md:py-2.5 bg-gold text-black rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all flex items-center gap-1.5 md:gap-2 disabled:opacity-50"
              >
                <RefreshCw size={10} className={cn("md:hidden", syncingAll && "animate-spin")} />
                <RefreshCw size={12} className={cn("hidden md:block", syncingAll && "animate-spin")} />
                {syncingAll ? "Syncing..." : "Sync Month's Bookings"}
              </button>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={cn(
                  "px-3 md:px-4 py-2 md:py-2.5 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5",
                  showLogs
                    ? "bg-gold text-black border-gold hover:bg-white"
                    : "bg-white/5 text-white/70 border-white/10 hover:border-gold hover:bg-white/[0.08]"
                )}
              >
                <Activity size={10} className="md:hidden" />
                <Activity size={12} className="hidden md:block" />
                {showLogs ? "Hide Logs" : "Logs"}
              </button>
              <button
                onClick={handleDisconnectGCal}
                className="px-3 md:px-4 py-2 md:py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={handleConnectGCal}
              className="px-3.5 md:px-5 py-2 md:py-2.5 bg-white/5 border border-white/10 hover:border-gold hover:bg-gold hover:text-black rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 md:gap-2"
            >
              <svg className="w-3 h-3 md:w-4 md:h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21.35,11.1H12v2.7h5.38c-0.24,1.28 -0.96,2.37 -2.05,3.1v2.57h3.3c1.93,-1.78 3.04,-4.4 3.04,-7.45C21.67,11.75 21.56,11.4 21.35,11.1z" />
                <path fill="currentColor" d="M12,21c2.43,0 4.47,-0.8 5.96,-2.18l-3.3,-2.57c-0.9,0.6 -2.07,0.97 -3.53,0.97 -2.71,0 -5.01,-1.83 -5.83,-4.29H1.83v2.66C3.3,18.52 7.37,21 12,21z" />
                <path fill="currentColor" d="M6.17,12.93c-0.2,-0.6 -0.31,-1.25 -0.31,-1.93s0.11,-1.33 0.31,-1.93V6.41H1.83C1.19,7.7 0.83,9.15 0.83,11s0.36,3.3 1,4.59L6.17,12.93z" />
                <path fill="currentColor" d="M12,5.8c1.32,0 2.51,0.45 3.44,1.35l2.58,-2.58C16.46,3.15 14.42,2.3 12,2.3C7.37,2.3 3.3,4.78 1.83,8.34l4.34,3.35C7,9.18 9.3,5.8 12,5.8z" />
              </svg>
              Enable Calendar Integration
            </button>
          )}
        </div>
      </motion.div>

      {/* Google Calendar Activity & Sync Logs */}
      {gcalToken && showLogs && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-5 rounded-[2rem] border border-white/5 space-y-4 bg-black/40"
        >
          <div className="flex items-center justify-between gap-4 flex-wrap pb-3 border-b border-white/5">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-gold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                Live Sync Logs
              </h4>
              <p className="text-[10px] text-white/40 mt-1">
                Real-time security-sanitized log entries detailing automatic Google Calendar record writes and deletions.
              </p>
            </div>
            {visibleSyncLogs.length > 0 && (
              <button
                onClick={clearSyncLogs}
                className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 bg-white/5 hover:bg-red-500/10 hover:text-red-400 border border-white/10 hover:border-red-500/20 rounded-lg transition-all"
              >
                Clear History
              </button>
            )}
          </div>

          <div className="max-h-[160px] overflow-y-auto custom-scrollbar pr-1 space-y-2">
            {visibleSyncLogs.length === 0 ? (
              <div className="py-8 text-center text-white/25 text-xs font-medium italic">
                No active log entries recorded yet. Fully listening to automatic dashboard booking modification times...
              </div>
            ) : (
              visibleSyncLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 bg-white/[0.01] hover:bg-white/[0.02] border border-white/5 hover:border-white/10 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2.5 transition-all text-xs"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className={cn(
                      "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md shrink-0 border",
                      log.type === 'sync' ? "bg-green-500/10 text-green-400 border-green-500/20" :
                        log.type === 'update' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                          log.type === 'remove' ? "bg-red-500/10 text-red-400 border-red-500/20" :
                            log.type === 'error' ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
                              "bg-white/5 text-white/60 border-white/10"
                    )}>
                      {log.type}
                    </span>
                    <p className="text-white/80 select-all selection:bg-gold/20 font-sans tracking-tight">
                      {log.message}
                    </p>
                  </div>
                  <span className="text-[9px] font-mono font-bold text-white/30 shrink-0 self-end md:self-center">
                    {format(parseISO(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Disconnect Google Calendar Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
        onConfirm={handleConfirmDisconnect}
        title="Disconnect Google Sync?"
        message="Are you sure you want to disconnect Google Calendar? This will automatically remove all currently synchronized ride booking events from your Google Calendar to preserve security. Previously written events will be cleared."
        confirmLabel="Disconnect"
        cancelLabel="Keep Connected"
        type="danger"
      />

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Card 1: Revenue & Monthly Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-5 rounded-[2rem] border border-white/10 relative overflow-hidden group flex flex-col justify-between h-full"
        >
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <PiggyBank size={48} className="text-gold" />
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">
            {currentMonth && !isNaN(currentMonth.getTime()) ? format(currentMonth, 'MMMM') : 'Month'} Revenue
          </p>
          <h4 className="text-3xl font-display text-gold flex items-end gap-2 text-wrap break-all">
            ${calendarStats.totalRevenue.toLocaleString()}
            {calendarStats.cancelled.revenue > 0 && (
              <span className="text-red-500 text-lg italic">
                (- ${calendarStats.cancelled.revenue.toLocaleString()})
              </span>
            )}
          </h4>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/30 font-bold uppercase tracking-tighter">
              Gross Monthly Value
            </span>
          </div>
        </motion.div>

        {/* Card 2: Fulfillment Value Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass p-5 rounded-[2rem] border border-white/5 relative bg-white/[0.02]"
        >
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-4">Ride Fulfillment</p>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className="text-[10px] text-white/60 font-bold uppercase">Completed</span>
              </div>
              <span className="text-[10px] text-white font-mono font-bold">${calendarStats.completed.revenue.toLocaleString()} <span className="text-white/20 text-[8px]">({calendarStats.completed.count})</span></span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                <span className="text-[10px] text-white/60 font-bold uppercase">Pending</span>
              </div>
              <span className="text-[10px] text-white font-mono font-bold">${calendarStats.pending.revenue.toLocaleString()} <span className="text-white/20 text-[8px]">({calendarStats.pending.count})</span></span>
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[10px] text-white/60 font-bold uppercase">Cancelled</span>
              </div>
              <span className="text-[10px] text-white font-mono font-bold">${calendarStats.cancelled.revenue.toLocaleString()} <span className="text-white/20 text-[8px]">({calendarStats.cancelled.count})</span></span>
            </div>
          </div>
        </motion.div>

        {/* Card 3: Product Segmentation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass p-5 rounded-[2rem] border border-white/5 relative bg-white/[0.02]"
        >
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-4">Product Performance</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
              <p className="text-[7px] uppercase tracking-widest text-white/40 mb-1 font-bold">Standard</p>
              <p className="text-[10px] font-bold text-gold font-mono">
                ${calendarStats.standard.revenue.toFixed(2)}
              </p>
              <p className="text-[8px] text-white/20 font-bold">{calendarStats.standard.count} Rides</p>
            </div>

            <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
              <p className="text-[7px] uppercase tracking-widest text-white/40 mb-1 font-bold">Tours</p>
              <p className="text-[10px] font-bold text-gold font-mono">
                ${calendarStats.tours.revenue.toFixed(2)}
              </p>
              <p className="text-[8px] text-white/20 font-bold">{calendarStats.tours.count} Rides</p>
            </div>

            <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
              <p className="text-[7px] uppercase tracking-widest text-white/40 mb-1 font-bold">Offers</p>
              <p className="text-[10px] font-bold text-gold font-mono">
                ${calendarStats.offers.revenue.toFixed(2)}
              </p>
              <p className="text-[8px] text-white/20 font-bold">{calendarStats.offers.count} Rides</p>
            </div>
          </div>
        </motion.div>

        {/* Card 4: Detailed Lifecycle Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass p-5 rounded-[2rem] border border-white/5 relative bg-white/[0.02]"
        >
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3">Booking Status Pipeline</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(calendarStats.statusCounts).map(([status, count]) => (
              <div key={`status-pill-${status}`} className="flex items-center gap-2 px-2.5 py-1.5 bg-black/20 rounded-lg border border-white/5">
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  status === 'pending' ? "bg-gold" :
                    status === 'confirmed' ? "bg-blue-400" :
                      status === 'assigned' ? "bg-purple-400" :
                        status === 'accepted' ? "bg-cyan-400" :
                          status === 'completed' ? "bg-green-500" :
                            status === 'cancelled' ? "bg-red-400" :
                              status === 'rejected' ? "bg-orange-400" : "bg-white/40"
                )} />
                <span className="text-[8px] uppercase tracking-widest font-bold text-white/60">{status}:</span>
                <span className="text-[9px] font-bold text-white leading-none">{count as any}</span>
              </div>
            ))}
            {Object.keys(calendarStats.statusCounts).length === 0 && (
              <div className="flex flex-col items-center justify-center w-full py-2 opacity-20">
                <Activity size={16} />
                <p className="text-[7px] uppercase tracking-widest mt-1">No Activity</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      <div className="glass p-4 sm:p-8 rounded-3xl border border-white/5">
        {/* Month Navigation now inside */}
        <div className="flex items-center justify-between gap-4 mb-6 bg-white/5 p-1.5 rounded-xl">
          {/* Left chevron */}
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-2 hover:bg-gold hover:text-black rounded-xl transition-all"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Month label */}
          <span className="text-xs font-bold uppercase tracking-[0.2em] min-w-[140px] text-center text-white/80">
            {currentMonth && !isNaN(currentMonth.getTime()) ? format(currentMonth, 'MMMM yyyy') : 'Invalid Date'}
          </span>

          {/* Right chevron */}
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-2 hover:bg-gold hover:text-black rounded-xl transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-4">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-white/20">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2 sm:gap-4">
          {calendarDays.map((day) => {
            const dayStr = day.toISOString();
            const dayBookings = getBookingsForDate(day);

            // Group bookings by status
            const statusGroups = dayBookings.reduce((acc: Record<string, number>, b) => {
              const status = b.status || 'pending';
              acc[status] = (acc[status] || 0) + 1;
              return acc;
            }, {});

            const getStatusColor = (status: string) => {
              switch (status.toLowerCase()) {
                case 'pending': return 'bg-[#D4AF37]';
                case 'confirmed': return 'bg-blue-400';
                case 'assigned': return 'bg-purple-400';
                case 'accepted': return 'bg-cyan-400';
                case 'completed': return 'bg-green-500';
                case 'cancelled': return 'bg-red-400';
                case 'rejected': return 'bg-orange-400'
                default: return 'bg-white/40';
              }
            };

            const getStatusTextColor = (status: string) => {
              switch (status.toLowerCase()) {
                case 'pending': return 'text-[#D4AF37]';
                case 'confirmed': return 'text-blue-400';
                case 'assigned': return 'text-purple-400';
                case 'accepted': return 'text-cyan-400';
                case 'completed': return 'text-green-500';
                case 'cancelled': return 'text-red-400';
                case 'rejected': return 'text-orange-400';
                default: return 'text-white/45';
              }
            };

            const hasReturnBooking = dayBookings.some(b => b.returnDate);

            return (
              <div
                key={dayStr}
                onClick={() => {
                  setSelectedDate(day);
                  if (dayBookings.length > 0) setShowDayBookings(true);
                }}
                className={cn(
                  "aspect-square rounded-xl sm:rounded-2xl border p-1 sm:p-3 transition-all cursor-pointer relative group",
                  !isSameMonth(day, currentMonth) ? "opacity-10 border-transparent pointer-events-none" :
                    isToday(day) ? "border-gold bg-gold/5" : "border-white/5 hover:border-white/20 shadow-xl",
                  dayBookings.length > 0 && "bg-white/5"
                )}
              >
                {/* Date number pinned at top */}
                <span
                  className={cn(
                    "absolute top-1 left-1 sm:top-2 sm:left-2 text-[10px] sm:text-xs font-bold font-mono",
                    isToday(day) ? "text-gold" : "text-white/40"
                  )}
                >
                  {day && !isNaN(day.getTime()) ? format(day, "d") : '?'}
                </span>

                {/* Synced/Not Synced status dot in top-right corner */}
                {(() => {
                  if (dayBookings.length === 0 || !isSameMonth(day, currentMonth)) {
                    return null;
                  }

                  const currentUserId = user?.uid;
                  const isDriver = userProfile?.role === 'driver';

                  const getEventId = (b: any) => {
                    return currentUserId ? (b.gcalEvents?.[currentUserId]?.eventId || null) : b.calendarEventId;
                  };

                  const getReturnEventId = (b: any) => {
                    return currentUserId ? (b.gcalEvents?.[currentUserId]?.returnEventId || null) : b.returnCalendarEventId;
                  };

                  const isEligibleToSync = (b: any) => {
                    if (isDriver) {
                      return b.status === 'accepted';
                    } else {
                      return b.status !== 'cancelled' && b.status !== 'rejected' && b.status !== 'completed';
                    }
                  };

                  // Check if any booking on this day is eligible but lacks correct sync ID
                  let hasEligible = false;
                  let allSynced = true;

                  dayBookings.forEach((b) => {
                    if (isEligibleToSync(b)) {
                      hasEligible = true;
                      
                      const isPickup = b.date && isSameDay(parseISO(b.date), day);
                      const isReturn = b.returnDate && isSameDay(parseISO(b.returnDate), day);

                      if (calendarDateType === 'booking') {
                        const mainSynced = !!getEventId(b);
                        const returnSynced = b.returnDate ? !!getReturnEventId(b) : true;
                        if (!mainSynced || !returnSynced) {
                          allSynced = false;
                        }
                      } else {
                        if (isPickup && !getEventId(b)) {
                          allSynced = false;
                        }
                        if (isReturn && !getReturnEventId(b)) {
                          allSynced = false;
                        }
                      }
                    }
                  });

                  if (!hasEligible) {
                    return null;
                  }

                  return (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2 group/sync-dot z-20">
                      <span
                        className={cn(
                          "w-1.5 h-1.5 rounded-full block border border-black/40",
                          allSynced ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)]"
                        )}
                      />
                      {/* Tooltip */}
                      <span className="pointer-events-none invisible group-hover/sync-dot:visible absolute top-full right-0 mt-1 bg-black/95 text-white text-[9px] px-2 py-1 rounded-md border border-white/10 shadow-2xl font-sans tracking-wide whitespace-nowrap z-[110]">
                        {allSynced ? "Google Calendar: Synced" : "Google Calendar: Pending/Not Synced"}
                      </span>
                    </div>
                  );
                })()}

                {dayBookings.length > 0 && (
                  <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-3 right-1 sm:right-3">
                    <div className="flex flex-wrap gap-[3px] sm:gap-[5px] items-center max-w-full">
                      {(() => {
                        const rawLegs: Array<{
                          key: string;
                          status: string;
                          type: 'P' | 'R' | null;
                          tooltip: string;
                          count: number;
                        }> = dayBookings.flatMap((b) => {
                          const legs = [];
                          if (calendarDateType === 'pickup') {
                            const isPickupLeg = b.date && isSameDay(parseISO(b.date), day);
                            const isReturnLeg = b.returnDate && isSameDay(parseISO(b.returnDate), day);

                            if (b.returnDate) {
                              if (isPickupLeg) {
                                legs.push({
                                  key: `${b.id}-P`,
                                  status: b.status || 'pending',
                                  type: 'P' as 'P',
                                  tooltip: `${b.customerName} (P): ${b.status}`,
                                  count: 1
                                });
                              }
                              if (isReturnLeg) {
                                legs.push({
                                  key: `${b.id}-R`,
                                  status: b.status || 'pending',
                                  type: 'R' as 'R',
                                  tooltip: `${b.customerName} (R): ${b.status}`,
                                  count: 1
                                });
                              }
                            } else {
                              if (isPickupLeg) {
                                legs.push({
                                  key: `${b.id}-std`,
                                  status: b.status || 'pending',
                                  type: null,
                                  tooltip: `${b.customerName}: ${b.status}`,
                                  count: 1
                                });
                              }
                            }
                          } else {
                            legs.push({
                              key: `${b.id}-booking`,
                              status: b.status || 'pending',
                              type: null,
                              tooltip: `${b.customerName} (Placed): ${b.status}`,
                              count: 1
                            });
                          }
                          return legs;
                        });

                        const prLegs = rawLegs.filter(l => l.type !== null);
                        const standardLegs = rawLegs.filter(l => l.type === null);

                        const standardGroups: Record<string, typeof standardLegs> = {};
                        standardLegs.forEach(l => {
                          if (!standardGroups[l.status]) {
                            standardGroups[l.status] = [];
                          }
                          standardGroups[l.status].push(l);
                        });

                        const groupedStandardLegs = Object.entries(standardGroups).map(([status, legs]) => {
                          const count = legs.length;
                          const names = legs.map(l => l.tooltip.split(':')[0]).join(', ');
                          const tooltip = count > 1 
                            ? `${count} ${status} bookings: ${names}` 
                            : legs[0].tooltip;

                          return {
                            key: `grouped-${status}-${dayStr}`,
                            status,
                            type: null,
                            tooltip,
                            count
                          };
                        });

                        const finalLegs = [...prLegs, ...groupedStandardLegs];

                        return finalLegs.map((leg) => (
                          <div
                            key={leg.key}
                            className="relative inline-flex select-none scale-[0.85] sm:scale-100 origin-left group/dot"
                          >
                            {/* Dot */}
                            <span
                              className={cn(
                                "w-1.5 h-1.5 rounded-full shrink-0 block",
                                getStatusColor(leg.status)
                              )}
                            />

                            {/* Superscript label */}
                            {leg.type ? (
                              <span className={cn(
                                "absolute -top-[4px] -right-[5px] text-[5px] sm:text-[7px] font-black leading-none uppercase",
                                leg.type === 'R' ? "text-gold" : "text-white"
                              )}>
                                {leg.type}
                              </span>
                            ) : leg.count > 1 ? (
                              <span className={cn(
                                "absolute -top-[4px] -right-[5px] text-[5px] sm:text-[7px] font-black leading-none uppercase",
                                getStatusTextColor(leg.status)
                              )}>
                                {leg.count}
                              </span>
                            ) : null}

                            {/* Tooltip */}
                            <div className="invisible group-hover/dot:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[10px] px-1 py-0.5 rounded whitespace-nowrap z-10 shadow-2xl">
                              {leg.tooltip}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    {/* Total Count - Desktop Only */}
                    <div className="hidden lg:block mt-1 pt-1 border-t border-white/5">
                      <p className="text-[7px] font-bold uppercase tracking-tight text-white/30 truncate">
                        {dayBookings.length} {dayBookings.length === 1 ? 'Ride' : 'Rides'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Google Calendar Sync Legend */}
        <div className="mt-6 pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-white/40">
            <span>Sync Indicators:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] border border-black/40" />
              <span className="text-white/60">Synced to GCal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.6)] border border-black/40" />
              <span className="text-white/60">Not Synced / Pending</span>
            </div>
          </div>
          <p className="text-[9px] text-white/30 italic font-medium font-sans">
            * Indicators show Google Calendar sync status in top right corner of each date cell
          </p>
        </div>
      </div>

      <AnimatePresence>
        {showDayBookings && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg glass p-5 sm:p-8 rounded-xl sm:rounded-3xl border border-gold/20 max-h-[90vh] sm:max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-display text-gold">Bookings for {selectedDate && !isNaN(selectedDate.getTime()) ? format(selectedDate, 'MMM dd, yyyy') : 'Selected Date'}</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{getBookingsForDate(selectedDate).length} Rides Scheduled</p>
                </div>
                <button onClick={() => setShowDayBookings(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {getBookingsForDate(selectedDate).map((booking) => {
                  let timeDisplay = "";
                  let legLabel = "";

                  if (calendarDateType === 'booking') {
                    if (booking.returnDate) {
                      timeDisplay = `Pickup: ${booking.date} at ${formatTimeToAMPM(booking.time)} | Return: ${booking.returnDate} at ${formatTimeToAMPM(booking.returnTime)}`;
                      legLabel = "Round Trip";
                    } else {
                      timeDisplay = `Pickup: ${booking.date} at ${formatTimeToAMPM(booking.time)}`;
                      legLabel = "One Way";
                    }
                  } else {
                    const isPickup = selectedDate && booking.date ? isSameDay(parseISO(booking.date), selectedDate) : false;
                    const isReturn = selectedDate && booking.returnDate ? isSameDay(parseISO(booking.returnDate), selectedDate) : false;

                    if (isPickup && isReturn) {
                      timeDisplay = `Pickup: ${formatTimeToAMPM(booking.time)} | Return: ${formatTimeToAMPM(booking.returnTime)}`;
                      legLabel = "Round Trip";
                    } else if (isReturn) {
                      timeDisplay = `Return: ${formatTimeToAMPM(booking.returnTime)}`;
                      legLabel = "Return Ride";
                    } else {
                      timeDisplay = `Pickup: ${formatTimeToAMPM(booking.time)}`;
                      legLabel = "Pickup Ride";
                    }
                  }

                  return (
                    <div key={`day-booking-${booking.id}`} className="glass p-4 rounded-xl border border-white/5 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-white">{booking.customerName}</p>
                            {booking.returnDate && (
                              <span className={cn(
                                "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
                                legLabel === "Round Trip" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                  legLabel === "Return Leg" ? "bg-gold/10 text-gold border-gold/20" :
                                    "bg-blue-500/10 text-blue-400 border-blue-500/20"
                              )}>
                                {legLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gold font-bold uppercase tracking-widest mt-1">{timeDisplay} | {booking.serviceType}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <span className={cn(
                            "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                            booking.status === 'pending' ? "bg-gold/10 text-gold border-gold/20" :
                              booking.status === 'confirmed' ? "bg-blue-400/10 text-blue-400 border-blue-400/20" :
                                booking.status === 'assigned' ? "bg-purple-400/10 text-purple-400 border-purple-400/20" :
                                  booking.status === 'accepted' ? "bg-cyan-400/10 text-cyan-400 border-cyan-400/20" :
                                    booking.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                      booking.status === 'cancelled' ? "bg-red-400/10 text-red-400 border-red-400/20" :
                                        booking.status === 'rejected' ? "bg-orange-400/10 text-orange-400 border-orange-400/20" :
                                          "bg-white/10 text-white/60 border-white/20"
                          )}>
                            {booking.status}
                          </span>

                          {gcalToken && (
                            <button
                              onClick={() => handleSyncBooking(booking)}
                              disabled={syncingId === booking.id}
                              className={cn(
                                "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all",
                                booking.calendarEventId
                                  ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                                  : "bg-white/5 text-white/50 border-white/10 hover:border-gold hover:text-gold"
                              )}
                              title={booking.calendarEventId ? "Synchronised in Google Calendar. Click to re-sync." : "Click to sync to Google Calendar"}
                            >
                              <RefreshCw size={8} className={cn(syncingId === booking.id && "animate-spin")} />
                              {booking.calendarEventId ? "Synced" : "Sync GCal"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-[10px] text-white/60">
                          <div className="w-1 h-1 bg-gold rounded-full" />
                          <span className="truncate">{booking.pickup}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-white/60">
                          <MapPin size={10} className="text-gold" />
                          <span className={cn("truncate", !booking.dropoff && "text-white/60 italic")}>
                            {booking.dropoff || (booking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 pt-2 border-t border-white/5">
                        <div className="flex flex-col gap-1 relative order-2 sm:order-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[8px] text-white/40 uppercase font-bold shrink-0">Phone:</p>
                            <p className="text-[10px] text-white/80 whitespace-nowrap">{booking.customerPhone || 'No phone'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-[8px] text-white/40 uppercase font-bold shrink-0">Email:</p>
                            <p className="text-[10px] text-white/60 truncate">{booking.customerEmail}</p>
                          </div>
                          {(booking.purpose || booking.notes) && (
                            <div className="mt-1 flex items-center gap-1">
                              <p className="text-[8px] text-white/40 uppercase font-bold shrink-0">Notes:</p>
                              <button
                                onMouseEnter={() => setShowNotesPopup(booking.id)}
                                onMouseLeave={() => setShowNotesPopup(null)}
                                className="text-gold/50 hover:text-gold transition-colors"
                              >
                                <Eye size={8} />
                              </button>
                              <p className="text-[9px] text-white/50 truncate italic ml-1">"{booking.purpose || booking.notes}"</p>
                            </div>
                          )}

                          <AnimatePresence>
                            {showNotesPopup === booking.id && (booking.purpose || booking.notes) && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute bottom-full left-0 mb-2 w-48 bg-black p-3 rounded-xl border border-gold/20 z-[110] shadow-2xl"
                              >
                                <p className="text-[8px] uppercase tracking-widest text-gold font-bold mb-2">Additional Info</p>
                                <p className="text-[9px] text-white/70 leading-relaxed italic">"{booking.purpose || booking.notes}"</p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                        <div className="flex sm:flex-col justify-between items-center sm:items-end sm:text-right order-1 sm:order-2">
                          <div className="flex flex-col sm:items-end">
                            <p className="text-[8px] text-white/40 uppercase font-bold">Vehicle</p>
                            <p className="text-[10px] text-white/80">{booking.vehicleId}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
