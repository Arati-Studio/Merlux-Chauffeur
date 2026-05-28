import { cn } from '../../lib/utils';
import {
  format, setMonth, startOfYear, endOfMonth, setYear, endOfYear,
  subDays, eachDayOfInterval, eachMonthOfInterval, eachYearOfInterval,
  startOfMonth, parseISO, isSameMonth, isSameYear, subMonths
} from 'date-fns';
import { useState, useMemo, useEffect } from 'react';
import {
  BarChart3, LayoutGrid, RefreshCw, Scaling, DollarSign, PiggyBank,
  CheckCircle, Clock, XCircle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip,
  BarChart, Bar, LabelList, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface AnalyticsTabProps {
  isAdmin: boolean;
  isDriver: boolean;
  user: any;
  userProfile: any;
}

export default function AnalyticsTab({
  isAdmin,
  isDriver,
  user,
  userProfile
}: AnalyticsTabProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'charts' | 'numerical'>('charts');
  const [analyticsTimeFilter, setAnalyticsTimeFilter] = useState<'7d' | '30d' | 'month' | 'year' | 'all'>('7d');
  const [analyticsRoleFilter, setAnalyticsRoleFilter] = useState<'all' | 'driver' | 'customer'>('all');
  const [monthRange, setMonthRange] = useState({ start: 0, end: 11 });
  const [yearRange, setYearRange] = useState({ start: 2024, end: 2025 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch Data
  useEffect(() => {
    if (!user) return;
    const q = isAdmin
      ? query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(500))
      : isDriver
        ? query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(500)) // Drivers usually see all for comparison or filtered in useMemo
        : query(collection(db, 'bookings'), orderBy('createdAt', 'desc'), limit(500));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBookings(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), limit(500)), (snap) => {
      setAllUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubscribe();
      unsubscribeUsers();
    };
  }, [user, isAdmin, isDriver]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const analytics = useMemo(() => {
    const now = new Date();
    // ... Copy calculation logic from AppDashboard (truncated for brevity in CoT, but implementing fully)
    const filteredBookingsList = bookings.filter(b => {
      const bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : null;
      if (!bDate) return false;

      // Role filter
      if (analyticsRoleFilter === 'driver' && !b.driverId) return false;
      if (analyticsRoleFilter === 'customer' && !b.userId) return false;

      if (analyticsTimeFilter === 'month') {
        const start = setMonth(startOfYear(now), monthRange.start);
        const end = setMonth(startOfYear(now), monthRange.end);
        const s = start < end ? start : end;
        const e = endOfMonth(start < end ? end : start);
        return bDate >= s && bDate <= e;
      } else if (analyticsTimeFilter === 'year') {
        const start = startOfYear(setYear(now, yearRange.start));
        const end = endOfYear(setYear(now, yearRange.end));
        const s = start < end ? start : end;
        const e = start < end ? end : start;
        return bDate >= s && bDate <= e;
      } else if (analyticsTimeFilter === '7d') {
        return bDate >= subDays(now, 6);
      } else if (analyticsTimeFilter === '30d') {
        return bDate >= subDays(now, 29);
      } else if (analyticsTimeFilter === 'all') {
        return true;
      }
      return true;
    });

    const completedCount = filteredBookingsList.filter(b => b.status === 'completed').length;
    const pendingCount = filteredBookingsList.filter(b => b.status === 'pending').length;
    const cancelledCount = filteredBookingsList.filter(b => b.status === 'cancelled').length;
    const confirmedCount = filteredBookingsList.filter(b => b.status === 'confirmed').length;
    const assignedCount = filteredBookingsList.filter(b => b.status === 'assigned').length;
    const acceptedCount = filteredBookingsList.filter(b => b.status === 'accepted').length;

    const statusData = [
      { name: 'Pending', value: pendingCount, color: '#D4AF37' },
      { name: 'Confirmed', value: confirmedCount, color: '#60A5FA' },
      { name: 'Assigned', value: assignedCount, color: '#C084FC' },
      { name: 'Accepted', value: acceptedCount, color: '#22D3EE' },
      { name: 'Completed', value: completedCount, color: '#4ADE80' },
      { name: 'Cancelled', value: cancelledCount, color: '#F87171' },
    ].filter(item => item.value > 0);

    const safeFormat = (date: any, formatStr: string, fallback: string = 'N/A') => {
      try {
        if (!date || isNaN(new Date(date).getTime())) return fallback;
        return format(date, formatStr);
      } catch (e) {
        return fallback;
      }
    };

    let intervals: Date[] = [];
    let formatStr = 'MMM dd';
    let grouping: 'day' | 'month' | 'year' = 'day';

    if (analyticsTimeFilter === '7d') {
      intervals = eachDayOfInterval({ start: subDays(now, 6), end: now });
      formatStr = 'MMM dd';
      grouping = 'day';
    } else if (analyticsTimeFilter === '30d') {
      intervals = eachDayOfInterval({ start: subDays(now, 29), end: now });
      formatStr = 'MMM dd';
      grouping = 'day';
    } else if (analyticsTimeFilter === 'month') {
      const start = setMonth(startOfYear(now), monthRange.start);
      const end = setMonth(startOfYear(now), monthRange.end);
      intervals = eachMonthOfInterval({ start: start < end ? start : end, end: start < end ? end : start });
      formatStr = 'MMM';
      grouping = 'month';
    } else if (analyticsTimeFilter === 'year') {
      const start = startOfYear(setYear(now, yearRange.start));
      const end = startOfYear(setYear(now, yearRange.end));
      intervals = eachYearOfInterval({ start: start < end ? start : end, end: start < end ? end : start });
      formatStr = 'yyyy';
      grouping = 'year';
    } else {
      intervals = [now];
    }

    const rangeStart = intervals[0] || now;
    const rangeEnd = intervals[intervals.length - 1] || now;
    const rangeDescription = analyticsTimeFilter === '7d' ? `Last 7 Days (${safeFormat(rangeStart, 'MMM dd')} - ${safeFormat(rangeEnd, 'MMM dd')})` :
      analyticsTimeFilter === '30d' ? `Last 30 Days (${safeFormat(rangeStart, 'MMM dd')} - ${safeFormat(rangeEnd, 'MMM dd')})` :
        analyticsTimeFilter === 'month' ? `Monthly Range (${safeFormat(rangeStart, 'MMM yyyy')} - ${safeFormat(rangeEnd, 'MMM yyyy')})` :
          analyticsTimeFilter === 'year' ? `Yearly Range (${safeFormat(rangeStart, 'yyyy')} - ${safeFormat(rangeEnd, 'yyyy')})` :
            `All Time`;

    const revenueData = intervals.map(date => {
      const dayBookings = bookings.filter(b => {
        const bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : null;
        if (!bDate) return false;
        if (grouping === 'month') return safeFormat(bDate, 'yyyy-MM') === safeFormat(date, 'yyyy-MM');
        if (grouping === 'year') return safeFormat(bDate, 'yyyy') === safeFormat(date, 'yyyy');
        return safeFormat(bDate, 'yyyy-MM-dd') === safeFormat(date, 'yyyy-MM-dd');
      });
      return {
        name: safeFormat(date, formatStr),
        revenue: dayBookings.filter(b => b.paymentStatus === 'paid' || b.status === 'completed').reduce((sum, b) => sum + (Number(b.price) || 0), 0),
        bookings: dayBookings.length
      };
    });

    const adminCount = allUsers.filter(u => u.role === 'admin').length;
    const customerCount = allUsers.filter(u => u.role === 'customer' || !u.role).length;
    const driverCount = allUsers.filter(u => u.role === 'driver').length;

    const roleData = [
      { name: 'Admins', value: adminCount, color: '#D4AF37' },
      { name: 'Customers', value: customerCount, color: '#22D3EE' },
      { name: 'Drivers', value: driverCount, color: '#F43F5E' }
    ];

    const serviceDistribution = [...new Set(filteredBookingsList.map(b => b.serviceType).filter(Boolean))].map(type => {
      const typeBookings = filteredBookingsList.filter(b => b.serviceType === type);
      return {
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: typeBookings.length,
        completed: typeBookings.filter(b => b.status === 'completed').length,
        cancelled: typeBookings.filter(b => b.status === 'cancelled').length,
        other: typeBookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length,
        revenue: typeBookings.filter(b => b.paymentStatus === 'paid' || b.status === 'completed').reduce((sum, b) => sum + (Number(b.price) || 0), 0),
        color: type === 'airport' ? '#60A5FA' : type === 'corporate' ? '#D4AF37' : type === 'wedding' ? '#F43F5E' : '#C084FC'
      };
    }).sort((a, b) => b.revenue - a.revenue);

    // Calculate Top Drivers
    const topDrivers = isAdmin ? [...new Set(filteredBookingsList.map(b => b.driverId).filter(Boolean))].map(id => {
      const driver = allUsers.find(u => u.id === id);
      const driverBookings = filteredBookingsList.filter(b => b.driverId === id);
      return {
        id,
        name: driver?.name || 'Unknown Driver',
        revenue: driverBookings.filter(b => b.paymentStatus === 'paid' || b.status === 'completed').reduce((sum, b) => sum + (Number(b.price) || 0), 0),
        bookings: driverBookings.length,
        rating: driverBookings.filter(b => b.rating).length > 0
          ? (driverBookings.filter(b => b.rating).reduce((acc, b) => acc + (b.rating || 0), 0) / driverBookings.filter(b => b.rating).length).toFixed(1)
          : 'N/A'
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5) : [];

    // Calculate Top Customers
    const topCustomers = isAdmin ? [...new Set(filteredBookingsList.map(b => b.userId).filter(Boolean))].map(id => {
      const customer = allUsers.find(u => u.id === id);
      const customerBookings = filteredBookingsList.filter(b => b.userId === id);
      return {
        id,
        name: customer?.name || customer?.email || 'Unknown Customer',
        revenue: customerBookings.filter(b => b.paymentStatus === 'paid' || b.status === 'completed').reduce((sum, b) => sum + (Number(b.price) || 0), 0),
        bookings: customerBookings.length
      };
    }).sort((a, b) => b.revenue - a.revenue).slice(0, 5) : [];

    return {
      totalRevenue: revenueData.reduce((sum, i) => sum + i.revenue, 0),
      totalBookings: revenueData.reduce((sum, i) => sum + i.bookings, 0),
      rangeDescription,
      statusData,
      revenueData,
      completedBookings: completedCount,
      pendingBookings: pendingCount,
      cancelledBookings: cancelledCount,
      confirmedBookings: confirmedCount,
      assignedBookings: assignedCount,
      acceptedBookings: acceptedCount,
      roleData,
      serviceDistribution,
      topDrivers,
      topCustomers
    };
  }, [bookings, analyticsTimeFilter, monthRange, yearRange, analyticsRoleFilter, allUsers, isAdmin]);

  const [dashboardCharts, setDashboardCharts] = useState([
    { id: 'revenue-trend', title: 'Revenue Trend', type: 'area', dataKey: 'revenue', dataSource: 'revenueData', color: '#D4AF37', width: 'medium' },
    { id: 'booking-volume', title: 'Booking Volume', type: 'bar', dataKey: 'bookings', dataSource: 'revenueData', color: '#60A5FA', width: 'medium' },
    { id: 'service-perf', title: 'Service Performance', type: 'stacked-bar', dataKey: 'value', dataSource: 'serviceDistribution', color: '#C084FC', width: 'full' },
    { id: 'status-dist', title: 'Status Distribution', type: 'pie', dataKey: 'value', dataSource: 'statusData', color: '#22D3EE', width: 'medium' },
    { id: 'role-distribution', title: 'User Roles', type: 'pie', dataKey: 'value', dataSource: 'roleData', color: '#F43F5E', width: 'medium' },
  ]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header with Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title area */}
        <div>
          <h3 className="text-xl sm:text-2xl font-display text-gold">
            {isAdmin ? 'Analytics Overview' : isDriver ? 'Driver Insights' : 'My Travel Analytics'}
          </h3>
          <p className="text-white/40 text-[10px] uppercase tracking-widest">
            {isAdmin ? 'Business performance & insights' : isDriver ? 'Your performance and earnings' : 'Your booking history and spending trends'}
          </p>
        </div>
      </div>

      {/* Header / Filter Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

        {/* Active Range (Left Side) */}
        <div className="flex items-center gap-2 bg-gold/10 pr-3 rounded-xs">
          <div className="w-1 h-9 bg-white/30 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]" />
          <div className="flex flex-col justify-center min-h-[32px]">
            <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gold/60 leading-none mb-1">
              Active Range
            </p>
            <p className="text-[10px] font-bold text-white uppercase tracking-wider">
              {analytics.rangeDescription}
            </p>
          </div>
        </div>

        {/* Right Side: View Mode + Filters */}
        <div className="flex flex-col sm:flex-row gap-4 item-center">

          {/* View Mode Buttons */}
          <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
            {[
              { id: 'charts', label: 'Visual', icon: BarChart3 },
              { id: 'numerical', label: 'Data', icon: LayoutGrid },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setAnalyticsViewMode(v.id as any)}
                className={cn(
                  "flex items-center gap-2 h-7 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                  analyticsViewMode === v.id
                    ? "bg-gold text-black shadow-lg shadow-gold/20"
                    : "text-white/40 hover:text-white"
                )}
              >
                <v.icon size={12} />
                <span className="hidden sm:inline">{v.label}</span>
              </button>
            ))}
          </div>

          {/* Time Filters */}
          {analyticsViewMode !== 'numerical' && (
            <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/10">
              {[
                { id: '7d', label: '7D' },
                { id: '30d', label: '30D' },
                { id: 'month', label: 'Monthly' },
                { id: 'year', label: 'Yearly' },
                { id: 'all', label: 'All' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAnalyticsTimeFilter(f.id as any)}
                  className={cn(
                    "h-7 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                    analyticsTimeFilter === f.id
                      ? "bg-gold text-black shadow-md shadow-gold/10"
                      : "text-white/30 hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={handleRefresh}
            className="p-2 rounded-xl border border-white/10 bg-black/20 text-white/40 hover:text-gold transition-all"
            title="Refresh Data"
          >
            <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
          </button>

          {/* Range Selectors */}
          {analyticsViewMode !== 'numerical' &&
            (analyticsTimeFilter === 'month' || analyticsTimeFilter === 'year') && (
              <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
                <select
                  value={analyticsTimeFilter === 'month' ? monthRange.start : yearRange.start}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (analyticsTimeFilter === 'month') setMonthRange(prev => ({ ...prev, start: val }));
                    else setYearRange(prev => ({ ...prev, start: val }));
                  }}
                  className="h-7 custom-select bg-transparent border-none text-[10px] pr-10 text-white"
                >
                  {analyticsTimeFilter === 'month'
                    ? Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i} className="bg-black text-white">
                        {format(new Date(2024, i, 1), 'MMM')}
                      </option>
                    ))
                    : Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 9 + i;
                      return (
                        <option key={year} value={year} className="bg-black text-white">
                          {year}
                        </option>
                      );
                    })}
                </select>
                <span className="text-white/20 text-[10px]"> — </span>
                <select
                  value={analyticsTimeFilter === 'month' ? monthRange.end : yearRange.end}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (analyticsTimeFilter === 'month') {
                      setMonthRange(prev => ({ ...prev, end: val }));
                    } else {
                      setYearRange(prev => ({ ...prev, end: val }));
                    }
                  }}
                  className="h-7 custom-select bg-transparent border-none text-[10px] pr-10 text-white"
                >
                  {analyticsTimeFilter === 'month'
                    ? Array.from({ length: 12 }, (_, i) => (
                      <option key={i} value={i} className="bg-black text-white">
                        {format(new Date(2024, i, 1), 'MMM')}
                      </option>
                    ))
                    : Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - 9 + i;
                      return (
                        <option key={year} value={year} className="bg-black text-white">
                          {year}
                        </option>
                      );
                    })}
                </select>
              </div>
            )}
        </div>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: isAdmin ? 'Total Revenue' : isDriver ? 'My Earnings' : 'Total Spending',
            value: `$${Math.round(analytics.totalRevenue)}`,
            icon: isAdmin ? DollarSign : PiggyBank,
            color: 'text-gold'
          },
          {
            label: isAdmin ? 'Completed' : isDriver ? 'Finished Jobs' : 'Completed Rides',
            value: analytics.completedBookings,
            icon: CheckCircle,
            color: 'text-green-500'
          },
          {
            label: isAdmin ? 'Active' : isDriver ? 'Active Jobs' : 'Active Rides',
            value: analytics.confirmedBookings + analytics.assignedBookings + analytics.acceptedBookings,
            icon: Clock,
            color: 'text-blue-400'
          },
          {
            label: 'Cancelled',
            value: analytics.cancelledBookings,
            icon: XCircle,
            color: 'text-red-400'
          },
        ].map((stat, i) => (
          <div key={`stat-${i}`} className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden group">
            <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-30 transition-opacity">
              <stat.icon size={20} className={stat.color} />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 mb-1">{stat.label}</p>
              <h3 className={cn("text-2xl font-display", stat.color)}>{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {analyticsViewMode === 'charts' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {dashboardCharts
              .filter(chart => isAdmin || chart.id !== 'role-distribution')
              .map((chart) => (
                <div
                  key={chart.id}
                  className={cn(
                    "glass p-8 rounded-3xl border border-white/5 relative group transition-all duration-500 min-w-0",
                    chart.width === 'small' ? "lg:col-span-4" :
                      chart.width === 'medium' ? "lg:col-span-6" :
                        chart.width === 'large' ? "lg:col-span-8" : "lg:col-span-12"
                  )}
                >
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="text-sm font-bold text-gold uppercase tracking-widest">{chart.title}</h4>
                      <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tighter italic">Based on filtered data</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setDashboardCharts(dashboardCharts.map(c => {
                            if (c.id === chart.id) {
                              const widths = ['small', 'medium', 'large', 'full'];
                              const currentIndex = widths.indexOf(c.width || 'large');
                              const nextIndex = (currentIndex + 1) % widths.length;
                              return { ...c, width: widths[nextIndex] };
                            }
                            return c;
                          }));
                        }}
                        className="p-2 text-white/40 hover:text-gold transition-all"
                        title="Change Size"
                      >
                        <Scaling size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="h-60 w-full min-w-0">
                    <ResponsiveContainer width="100%" height={240}>
                      {chart.type === 'area' ? (
                        <AreaChart data={(analytics as any)[chart.dataSource || 'revenueData'] || []}>
                          <defs>
                            <linearGradient id={`color-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={chart.color || '#D4AF37'} stopOpacity={0.3} />
                              <stop offset="95%" stopColor={chart.color || '#D4AF37'} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                          <Area type="monotone" dataKey={chart.dataKey} stroke={chart.color || '#D4AF37'} fillOpacity={1} fill={`url(#color-${chart.id})`} strokeWidth={2} />
                        </AreaChart>
                      ) : chart.type === 'bar' ? (
                        <BarChart data={(analytics as any)[chart.dataSource || 'revenueData'] || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                          <Bar dataKey={chart.dataKey} fill={chart.color || '#60A5FA'} radius={[4, 4, 0, 0]}>
                            <LabelList dataKey={chart.dataKey} position="top" fill={chart.color || '#60A5FA'} fontSize={10} />
                          </Bar>
                        </BarChart>
                      ) : chart.type === 'line' ? (
                        <LineChart data={(analytics as any)[chart.dataSource || 'revenueData'] || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                          <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                          <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                          <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                          <Line type="monotone" dataKey={chart.dataKey} stroke={chart.color || '#D4AF37'} strokeWidth={3} dot={{ r: 4, fill: '#0a0a0a', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      ) : chart.type === 'pie' ? (
                        <PieChart>
                          <Pie
                            data={(analytics as any)[chart.dataSource] || []}
                            cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey={chart.dataKey} stroke="none"
                          >
                            {((analytics as any)[chart.dataSource] || []).map((entry: any, index: number) => (
                              <Cell key={`cell-${chart.id}-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                          <Legend
                            verticalAlign="bottom"
                            height={36}
                            iconType="circle"
                            iconSize={9}
                            wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                          />
                        </PieChart>
                      ) : chart.type === 'stacked-bar' ? (
                        <BarChart data={(analytics as any)[chart.dataSource || 'serviceDistribution'] || []} layout="vertical">
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" stroke="#ffffff40" fontSize={10} width={80} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10' }}
                            formatter={(value: any, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                          />
                          <Legend verticalAlign="top" height={36} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                          <Bar dataKey="completed" stackId="a" fill="#4ADE80" name="Completed" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="other" stackId="a" fill="#60A5FA" name="Active / Other" radius={[0, 0, 0, 0]} />
                          <Bar dataKey="cancelled" stackId="a" fill="#F87171" name="Cancelled" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      ) : null}
                    </ResponsiveContainer>
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        /* Numerical Mode */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {isAdmin ? (
            <>
              <div className="glass p-8 rounded-3xl border border-white/5">
                <h4 className="text-lg font-display text-gold mb-6">Top Drivers</h4>
                <div className="space-y-4">
                  {analytics.topDrivers.map((d: any, idx: number) => (
                    <div key={`top-driver-${d.id || d.name}-${idx}`} className="flex justify-between p-4 bg-white/5 rounded-xl">
                      <span className="text-xs text-white/70">{d.name}</span>
                      <span className="text-xs font-bold text-gold">${Math.round(d.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass p-8 rounded-3xl border border-white/5">
                <h4 className="text-lg font-display text-gold mb-6">Top Customers</h4>
                <div className="space-y-4">
                  {analytics.topCustomers.map((c: any, idx: number) => (
                    <div key={`top-customer-${c.id || c.name}-${idx}`} className="flex justify-between p-4 bg-white/5 rounded-xl">
                      <span className="text-xs text-white/70">{c.name}</span>
                      <span className="text-xs font-bold text-gold">${Math.round(c.revenue)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="glass p-8 rounded-3xl border border-white/5 lg:col-span-2">
              <h4 className="text-lg font-display text-gold mb-6">Recent Activity Analysis</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="text-white/20 uppercase tracking-widest border-b border-white/5">
                      <th className="pb-4">Date</th>
                      <th className="pb-4">Route</th>
                      <th className="pb-4">Status</th>
                      <th className="pb-4 text-right">Fare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {bookings.map(b => (
                      <tr key={b.id}>
                        <td className="py-4 text-white/60">{b.date}</td>
                        <td className="py-4 text-white/60">{b.pickup} → {b.dropoff}</td>
                        <td className="py-4">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                            b.status === 'completed' ? "bg-green-500/10 text-green-500" :
                              b.status === 'cancelled' ? "bg-red-500/10 text-red-500" :
                                b.status === 'pending' ? "bg-gold/10 text-gold" : "bg-blue-500/10 text-blue-500"
                          )}>{b.status}</span>
                        </td>
                        <td className="py-4 text-right text-gold font-bold">${b.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
