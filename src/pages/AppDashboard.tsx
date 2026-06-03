import { motion, AnimatePresence } from 'motion/react';
import {
  Home, MapPin, Clock, User, Car, UserCog,
  Settings, Bell, LogOut, Truck, Shield, CalendarRange,
  BarChart3, Users, LayoutGrid, Globe, HelpCircle, FileText
} from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { cn } from '../lib/utils';
import { auth, db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc, limit, getDocs, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { FormNotice, type NoticeType } from '../components/FormNotice';
import SEO from '../components/SEO';
import NotificationDropdown from '../components/NotificationDropdown';
import ConfirmationModal from '../components/dashboard/ConfirmationModal';
import AdminDashboard from '../components/dashboard/AdminDashboard';
import DriverDashboard from '../components/dashboard/DriverDashboard';
import CustomerDashboard from '../components/dashboard/CustomerDashboard';

export default function AppDashboard() {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bookings');
  const [activeSubTab, setActiveSubTab] = useState('seo');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dashboardNotice, setDashboardNotice] = useState<{ type: NoticeType; message: string; title?: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    type: string;
    id?: string;
    ids?: string[];
    onConfirm?: () => void;
    title?: string;
    message?: string;
  } | null>(null);
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const isAdmin = userProfile?.role === 'admin';
  const isDriver = userProfile?.role === 'driver';

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        navigate('/login');
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Profile Fetching
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setUserProfile({ id: snap.id, ...data });
        if (data.emailVerified !== user.emailVerified) {
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              emailVerified: user.emailVerified
            });
          } catch (e) {
            console.warn('Could not sync emailVerified status into firestore:', e);
          }
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // Notifications Listener
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/login');
  };

  const showDashboardNotice = (type: NoticeType, message: string, title?: string) => {
    setDashboardNotice({ type, message, title });
    setTimeout(() => setDashboardNotice(null), 5000);
  };

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, 'notifications', id), { read: true });
  };

  const markAllAsRead = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
      if (!n.read) batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  };

  const clearAll = async () => {
    const batch = writeBatch(db);
    notifications.forEach(n => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  };

  const navItems = [
    { id: 'bookings', label: 'Bookings', icon: Car, roles: ['admin', 'driver', 'customer'] },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, roles: ['admin', 'driver', 'customer'] },
    { id: 'calendar', label: 'Calendar', icon: CalendarRange, roles: ['admin'] },
    { id: 'users', label: 'Users', icon: Users, roles: ['admin'] },
    { id: 'profile', label: 'Profile', icon: UserCog, roles: ['admin', 'driver', 'customer'] },
    { id: 'management', label: 'Management', icon: Settings, roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => 
    item.roles.includes(userProfile?.role || 'customer')
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-8">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-y-2 border-gold shadow-[0_0_20px_rgba(212,175,55,0.2)]"></div>
            <div className="absolute inset-0 animate-pulse rounded-full bg-gold/5 blur-2xl"></div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-gold text-xs font-bold uppercase tracking-[0.4em] animate-pulse">Loading Data...</h2>
            <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-gold/50 to-transparent"></div>
          </div>
        </div>
      </div>
    );
  }

  const commonDashboardProps = {
    user, userProfile, isAdmin, isDriver,
    activeTab, setActiveTab,
    activeSubTab, setActiveSubTab,
    showDashboardNotice,
    setConfirmDelete,
    handleLogout
  };

  const renderNotice = () => {
    if (!dashboardNotice) return null;
    return (
      <FormNotice 
        type={dashboardNotice.type} 
        message={dashboardNotice.message} 
        title={dashboardNotice.title}
        onClose={() => setDashboardNotice(null)}
      />
    );
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const { type, id, ids, onConfirm } = confirmDelete;

    try {
      if (onConfirm) {
        await onConfirm();
      } else {
        // Fallback for types explicitly requested by children
        const batch = writeBatch(db);
        
        switch (type) {
          case 'booking':
            if (id) await deleteDoc(doc(db, 'bookings', id));
            showDashboardNotice('success', 'Booking deleted successfully');
            break;
          case 'bulk-bookings':
            if (ids) {
              ids.forEach(bid => batch.delete(doc(db, 'bookings', bid)));
              await batch.commit();
            }
            showDashboardNotice('success', `${ids?.length} bookings deleted`);
            break;
          case 'offer':
            if (id) await deleteDoc(doc(db, 'offers', id));
            showDashboardNotice('success', 'Offer deleted successfully');
            break;
          case 'bulk-offers':
            if (ids) {
              ids.forEach(oid => batch.delete(doc(db, 'offers', oid)));
              await batch.commit();
            }
            showDashboardNotice('success', `${ids?.length} offers deleted`);
            break;
          case 'tour':
            if (id) await deleteDoc(doc(db, 'tours', id));
            showDashboardNotice('success', 'Tour deleted successfully');
            break;
          case 'bulk-tours':
            if (ids) {
              ids.forEach(tid => batch.delete(doc(db, 'tours', tid)));
              await batch.commit();
            }
            showDashboardNotice('success', `${ids?.length} tours deleted`);
            break;
          case 'user':
            if (id) {
              // Use the backend route for user deletion if possible
              const resp = await fetch('/api/admin/delete-user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: id })
              });
              if (!resp.ok) throw new Error('Backend deletion failed');
              showDashboardNotice('success', 'User deleted successfully');
            }
            break;
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
      showDashboardNotice('error', 'Failed to delete item');
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-black text-white overflow-hidden">
      <SEO 
        title="Dashboard - Merlux"
        robots="noindex, nofollow"
      />
      {/* Top Navigation Bar */}
      <header className="bg-black/50 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto w-full p-4 lg:px-10 lg:py-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xs sm:text-sm lg:text-base font-bold tracking-[0.15em] text-white/90">
              {isAdmin ? 'Admin Dashboard' : isDriver ? 'Driver Dashboard' : 'Customer Dashboard'}
            </h1>

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gold hover:bg-white/5 rounded-full transition-colors"
                >
                  <Bell size={22} />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <NotificationDropdown
                    notifications={notifications}
                    onClose={() => setShowNotifications(false)}
                    markAsRead={markAsRead}
                    markAllAsRead={markAllAsRead}
                    clearAll={clearAll}
                  />
                )}
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold">{userProfile?.name || 'User'}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                    {isAdmin ? 'Administrator' : isDriver ? 'Driver' : 'Customer'}
                  </p>
                </div>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center bg-gold/10 border border-gold/20`}>
                  {isAdmin ? <Shield size={18} className="text-red-600" /> : isDriver ? <Truck size={18} className="text-blue-600" /> : <User size={18} className="text-gold" />}
                </div>
              </div>
            </div>
          </div>

          <nav className="flex items-center w-full bg-white/5 p-1 rounded-2xl border border-white/5 mt-2">
            {filteredNavItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all relative whitespace-nowrap",
                  activeTab === item.id ? "text-white font-bold" : "text-white/60 hover:text-white"
                )}
              >
                <item.icon size={16} className={activeTab === item.id ? "text-white" : "text-gold"} />
                <span className="hidden sm:inline text-[9px] uppercase tracking-widest font-bold">{item.label}</span>
                {activeTab === item.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gold/20 rounded-xl -z-10"
                    transition={{ type: "spring", duration: 0.5 }}
                  />
                )}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto no-scrollbar" ref={mainScrollRef}>
        <div className="max-w-7xl mx-auto w-full p-1 lg:p-2">
          {dashboardNotice && (
            <div className="mb-6">
              {renderNotice()}
            </div>
          )}
          {isAdmin ? (
            <AdminDashboard {...commonDashboardProps} mainScrollRef={mainScrollRef} />
          ) : isDriver ? (
            <DriverDashboard {...commonDashboardProps} mainScrollRef={mainScrollRef} />
          ) : (
            <CustomerDashboard {...commonDashboardProps} mainScrollRef={mainScrollRef} />
          )}
        </div>
      </main>

      <ConfirmationModal
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleConfirmDelete}
        title={confirmDelete?.title || "Are you sure?"}
        message={confirmDelete?.message || "This action is permanent and cannot be undone."}
      />
    </div>
  );
}
