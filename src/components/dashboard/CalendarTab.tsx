import { motion } from 'motion/react';
import { 
  format, subMonths, addMonths, isSameMonth, isToday, 
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, parseISO, isSameYear, isSameDay 
} from 'date-fns';
import { X, MapPin, Eye, PiggyBank, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { useState, useEffect, useMemo } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

interface CalendarTabProps {
  isAdmin: boolean;
  user: any;
}

export default function CalendarTab({
  isAdmin,
  user
}: CalendarTabProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [calendarDateType, setCalendarDateType] = useState<'pickup' | 'booking'>('pickup');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayBookings, setShowDayBookings] = useState(false);
  const [showNotesPopup, setShowNotesPopup] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

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
      let bDate;
      if (calendarDateType === 'pickup') {
        if (!b.date) return false;
        bDate = parseISO(b.date);
      } else {
        bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : (b.createdAt ? parseISO(b.createdAt) : null);
      }
      return bDate && isSameDay(bDate, date);
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

                {dayBookings.length > 0 && (
                  <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-3 right-1 sm:right-3">
                    {/* Dot Matrix for bookings */}
                    <div className="flex flex-wrap gap-0.5 sm:gap-1 max-w-full">
                      {Object.entries(statusGroups).map(([status, countValue]) => {
                        const count = countValue as number;
                        return (
                          <div
                            key={status}
                            className={cn(
                              "w-1 h-1 sm:w-2 sm:h-2 rounded-full relative group/dot",
                              getStatusColor(status)
                            )}
                          >
                            <div className="invisible group-hover/dot:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[8px] px-1 py-0.5 rounded whitespace-nowrap z-10">
                              {status}: {count}
                            </div>
                            {count > 1 && (
                              <span className="absolute -top-1 -right-1 text-[6px] font-bold text-white leading-none scale-75 lg:scale-100">
                                {count}
                              </span>
                            )}
                          </div>
                        );
                      })}
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
                {getBookingsForDate(selectedDate).map((booking) => (
                  <div key={`day-booking-${booking.id}`} className="glass p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold">{booking.customerName}</p>
                        <p className="text-[10px] text-gold font-bold uppercase tracking-widest">{formatTimeToAMPM(booking.time)} | {booking.serviceType}</p>
                      </div>
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
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
