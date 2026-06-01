import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, UserPlus, Users, Shield, Car, User, Mail, Phone, MapPin,
  Calendar, DollarSign, XCircle, CalendarCog, MessageSquare, Star,
  CheckCircle, AlertCircle, Award, PiggyBank, Activity, Clock, Edit2, Trash2, Save, Loader2, Ban
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

interface UsersTabProps {
  isAdmin: boolean;
  user?: any;
  userProfile?: any;
  userSearchQuery?: string;
  setUserSearchQuery?: (query: string) => void;
  userRoleFilter?: string;
  setUserRoleFilter?: (role: string) => void;
  userDetailStats?: Record<string, any>;
  showDashboardNotice: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
  setConfirmDelete: (config: { type: string; id?: string; ids?: string[]; onConfirm?: () => void; title?: string; message?: string }) => void;
}

export default function UsersTab({
  isAdmin,
  user,
  userProfile,
  showDashboardNotice,
  setConfirmDelete
}: UsersTabProps) {
  const navigate = useNavigate();
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userDetailStats, setUserDetailStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Fetch Users
  useEffect(() => {
    if (!isAdmin) return;
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(500));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isAdmin]);

  // Fetch Bookings & Compute User Detail Stats
  useEffect(() => {
    if (!isAdmin || allUsers.length === 0) return;

    const qBookings = query(collection(db, 'bookings'));
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      const stats: Record<string, any> = {};

      allUsers.forEach(u => {
        if (u.role === 'admin') {
          // System Overview Admin Stats
          const totalRevenue = bookings
            .filter(b => b.paymentStatus === 'paid' || b.status === 'completed')
            .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
          
          const lostRevenue = bookings
            .filter(b => b.status === 'cancelled')
            .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
          
          const unassignedCount = bookings
            .filter(b => !b.driverId && b.status !== 'cancelled')
            .length;

          stats[u.id] = {
            totalRevenue,
            lostRevenue,
            unassignedCount,
            totalSystemUsers: allUsers.length
          };
        } else if (u.role === 'driver') {
          // Driver Stats
          const driverBookings = bookings.filter(b => b.driverId === u.id);
          const completedRides = driverBookings.filter(b => b.status === 'completed').length;
          
          const ratedBookings = driverBookings.filter(b => b.rating);
          const ratingCount = ratedBookings.length;
          const avgRating = ratingCount > 0 
            ? ratedBookings.reduce((sum, b) => sum + (b.rating || 0), 0) / ratingCount 
            : 0;

          const unreviewedCount = driverBookings.filter(b => b.status === 'completed' && !b.rating).length;
          
          const feedbacks = driverBookings
            .filter(b => b.rating || b.feedback)
            .map(b => ({
              customerName: b.customerName || 'Customer',
              rating: b.rating || 0,
              comment: b.feedback || ''
            }));

          const totalEarnings = driverBookings
            .filter(b => b.status === 'completed' || b.paymentStatus === 'paid')
            .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

          stats[u.id] = {
            completedRides,
            ratingCount,
            avgRating,
            unreviewedCount,
            totalRatingValue: avgRating > 0 ? Number(avgRating.toFixed(1)) : 0,
            totalEarnings,
            feedbacks
          };
        } else {
          // Customer / User Stats
          const customerBookings = bookings.filter(b => b.userId === u.id || b.customerEmail === u.email);
          const completedRides = customerBookings.filter(b => b.status === 'completed').length;
          const totalBookings = customerBookings.length;
          const totalSpend = customerBookings
            .filter(b => b.status !== 'cancelled')
            .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
          const cancelledRides = customerBookings.filter(b => b.status === 'cancelled').length;
          const reviewedCount = customerBookings.filter(b => b.status === 'completed' && b.rating).length;
          const unreviewedCount = customerBookings.filter(b => b.status === 'completed' && !b.rating).length;

          // Compute Favorite Service
          const serviceCounts: Record<string, number> = {};
          customerBookings.forEach(b => {
            if (b.serviceType) {
              serviceCounts[b.serviceType] = (serviceCounts[b.serviceType] || 0) + 1;
            }
          });
          let favoriteService = 'N/A';
          let maxCount = 0;
          Object.entries(serviceCounts).forEach(([service, count]) => {
            if (count > maxCount) {
              maxCount = count;
              favoriteService = service;
            }
          });

          stats[u.id] = {
            completedRides,
            totalBookings,
            totalSpend,
            cancelledRides,
            reviewedCount,
            unreviewedCount,
            favoriteService
          };
        }
      });

      setUserDetailStats(stats);
    });

    return () => unsubscribeBookings();
  }, [allUsers, isAdmin]);

  const [editingUser, setEditingUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  if (!isAdmin) return null;

  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      const sanitizedData = { ...data, id: userId };
      await setDoc(doc(db, 'users', userId), {
        ...sanitizedData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowUserModal(false);
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleCreateUser = async (userData: any) => {
    if (!userData.email || !userData.password || !userData.name) {
      showDashboardNotice('warning', 'Email, Password and Name are mandatory for account creation.', 'Incomplete Form');
      return;
    }

    setIsCreatingUser(true);
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          displayName: userData.name,
          role: userData.role,
          phone: userData.phone,
          address: userData.address,
          driverLicense: userData.driverLicense,
          driverPlate: userData.driverPlate,
          driverVehicle: userData.driverVehicle
        })
      });

      const data = await response.json();

      if (!response.ok) {
        const errMsg = data.error || '';
        if (
          errMsg.includes('identitytoolkit') ||
          errMsg.includes('Identity Toolkit') ||
          errMsg.includes('SERVICE_DISABLED') ||
          errMsg.includes('PERMISSION_DENIED') ||
          errMsg.includes('permission') ||
          errMsg.includes('Insufficient') ||
          response.status === 500
        ) {
          console.warn('Server failed to create user (Auth API disabled or Permissions denied). Retrying client-side-only write...');
          
          const fallbackUid = 'local-user-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
          await setDoc(doc(db, 'users', fallbackUid), {
            id: fallbackUid,
            name: userData.name,
            email: userData.email.toLowerCase(),
            phone: userData.phone || '',
            address: userData.address || '',
            role: userData.role || 'customer',
            emailVerified: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            authDisabledFallback: true,
            driverLicense: userData.driverLicense || '',
            driverPlate: userData.driverPlate || '',
            driverVehicle: userData.driverVehicle || ''
          });

          setShowUserModal(false);
          setEditingUser(null);
          showDashboardNotice('warning', 'Account creation bypassed Auth API. User profile created directly in Firestore database.', 'Auth Bypassed Successfully');
          return;
        }
        throw new Error(data.error || 'Failed to create user');
      }

      setShowUserModal(false);
      setEditingUser(null);
      
      if (data.warning) {
        showDashboardNotice('warning', data.warning, 'Bypassed Firebase Auth');
      } else {
        showDashboardNotice('success', 'User account created successfully.', 'Success');
      }
    } catch (err: any) {
      console.error('Error creating user:', err);
      const errStr = String(err.message || err);
      if (
        errStr.includes('identitytoolkit') ||
        errStr.includes('Identity Toolkit') ||
        errStr.includes('SERVICE_DISABLED') ||
        errStr.includes('PERMISSION_DENIED') ||
        errStr.includes('permission') ||
        errStr.includes('Insufficient') ||
        errStr.includes('fallback')
      ) {
        try {
          console.warn('Caught auth/permission error. Generating client-side backup user document...');
          const fallbackUid = 'local-user-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
          await setDoc(doc(db, 'users', fallbackUid), {
            id: fallbackUid,
            name: userData.name,
            email: userData.email.toLowerCase(),
            phone: userData.phone || '',
            address: userData.address || '',
            role: userData.role || 'customer',
            emailVerified: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            authDisabledFallback: true,
            driverLicense: userData.driverLicense || '',
            driverPlate: userData.driverPlate || '',
            driverVehicle: userData.driverVehicle || ''
          });

          setShowUserModal(false);
          setEditingUser(null);
          showDashboardNotice('warning', 'Account creation bypassed Auth API. User profile created directly in Firestore database.', 'Auth Bypassed Successfully');
          return;
        } catch (innerErr: any) {
          console.error('Client-side fallback also failed:', innerErr);
        }
      }
      showDashboardNotice('error', err.message || 'Failed to create user', 'Creation Failed');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = allUsers.find(u => u.id === userId);
    setConfirmDelete({
      type: 'user',
      id: userId,
      title: 'Delete User Account',
      message: `Are you sure you want to permanently delete ${userToDelete?.name || 'this user'}? This action is irreversible and will remove all their data from the system.`,
      onConfirm: async () => {
        try {
          const resp = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
          });
          const data = await resp.json();
          if (!resp.ok) {
            throw new Error(data.error || 'Server failed to delete user');
          }
          showDashboardNotice('success', 'User has been deleted successfully.', 'Deleted');
        } catch (err: any) {
          console.warn('Backend deletion failed, trying client-side direct deletion...');
          try {
            await deleteDoc(doc(db, 'users', userId));
            showDashboardNotice('success', 'User has been deleted directly from Firestore.', 'Deleted');
          } catch (innerErr) {
            console.error('Error deleting user:', innerErr);
            handleFirestoreError(innerErr, OperationType.DELETE, `users/${userId}`);
          }
        }
      }
    });
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        blocked,
        updatedAt: serverTimestamp()
      });
      showDashboardNotice('info', `User has been ${blocked ? 'blocked' : 'unblocked'}.`, 'Status Updated');
    } catch (err) {
      console.error('Error blocking user:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const filteredUsers = allUsers.filter(u => {
    const matchesSearch = (
      u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(userSearchQuery.toLowerCase())
    );
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
        {/* Row 1: Heading */}
        <div>
          <h3 className="text-xl sm:text-2xl font-display text-gold">User Management</h3>
          <p className="text-white/40 text-[10px] uppercase tracking-widest">
            Manage staff and customers
          </p>
        </div>

        {/* Row 2: Search + Add User */}
        <div className="flex flex-row items-center gap-2 w-full md:w-auto">
          {/* Search input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
            <input
              type="text"
              placeholder="Search users..."
              value={userSearchQuery}
              onChange={(e) => setUserSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
            />
            {userSearchQuery && (
              <button
                onClick={() => setUserSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Add User button */}
          <button
            onClick={() => navigate('/login?mode=register')}
            className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
          >
            <UserPlus size={18} />
            <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
              Add User
            </span>
          </button>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-white/5 p-1 bg-white/5 rounded-lg w-fit overflow-x-auto no-scrollbar">
        {[
          { id: 'all', label: 'All Users', icon: Users, count: allUsers.length },
          { id: 'admin', label: 'Admins', icon: Shield, count: allUsers.filter(u => u.role === 'admin').length },
          { id: 'driver', label: 'Drivers', icon: Car, count: allUsers.filter(u => u.role === 'driver').length },
          { id: 'customer', label: 'Customers', icon: User, count: allUsers.filter(u => u.role === 'customer' || !u.role || u.role === 'user').length },
        ].map((roleTab) => (
          <button
            key={`user-role-tab-${roleTab.id}`}
            onClick={() => setUserRoleFilter(roleTab.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
              userRoleFilter === roleTab.id
                ? "bg-gold text-black shadow-lg shadow-gold/20"
                : "text-white/40 hover:text-white hover:bg-white/5"
            )}
            title={`${roleTab.label} (${roleTab.count})`}
          >
            <roleTab.icon size={14} />
            <span className="hidden md:inline-flex items-center">
              {roleTab.label}
              <span className={cn(
                "ml-1.5 opacity-60 font-mono",
                userRoleFilter === roleTab.id ? "text-black" : "text-gold"
              )}>
                ({roleTab.count})
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((u) => (
          <div key={u.id} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group flex flex-col h-full">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center border transition-all",
                    u.role === "admin"
                      ? "bg-red-500/10 border-red-500/20 text-red-500"
                      : u.role === "driver"
                        ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                        : "bg-gold/10 border-gold/20 text-gold"
                  )}
                >
                  {u.role === "admin" ? (
                    <Shield className="w-4 h-4 md:w-5 md:h-5" />
                  ) : u.role === "driver" ? (
                    <Car className="w-4 h-4 md:w-5 md:h-5" />
                  ) : (
                    <User className="w-4 h-4 md:w-5 md:h-5" />
                  )}
                </div>

                <div className="flex flex-col">
                  <h4 className="text-[14px] font-bold font-display text-white group-hover:text-gold transition-colors flex items-center justify-between gap-2 w-full min-w-0">
                    <span className="truncate leading-tight">
                      {u.name || "No Name"}
                    </span>

                    {u.role === "driver" && (
                      <span className="flex items-center gap-1 text-gold text-[11px] font-bold shrink-0 leading-none">
                        <Star size={12} className="fill-gold text-gold" />
                        {userDetailStats?.[u.id]?.avgRating?.toFixed(1) || "0.0"}
                      </span>
                    )}
                  </h4>
                </div>
              </div>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
                u.role === 'admin' ? "bg-red-500/10 text-red-400 border-red-400/20" :
                  u.role === 'driver' ? "bg-blue-500/10 text-blue-400 border-blue-400/20" :
                    "bg-gold/10 text-gold border-gold/20"
              )}>
                {u.role}
              </span>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Mail size={14} className="text-gold shrink-0" />
                  <p className="text-xs text-white/60 truncate" title={u.email}>{u.email || 'No Email'}</p>
                </div>
                {u.emailVerified ? (
                  <span className="flex items-center gap-1 text-[8px] text-[#4ADE80] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#4ADE80]/10 border border-[#4ADE80]/20 shrink-0">
                    <CheckCircle size={8} /> Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[8px] text-amber-500 font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 shrink-0">
                    <Clock size={8} /> Unverified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Phone size={14} className="text-gold shrink-0" />
                <p className="text-xs text-white/60">{u.phone || 'No Phone'}</p>
              </div>
              <div className="flex items-center gap-3">
                <MapPin size={14} className="text-gold shrink-0" />
                <p className="text-xs text-white/60">{u.address || 'No Adrress'}</p>
              </div>
              {u.createdAt && (
                <div className="flex items-center gap-3">
                  <Calendar size={14} className="text-gold shrink-0" />
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                    Joined: {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'MMM dd, yyyy') : 'N/A'}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 pb-4 flex-1 flex flex-col justify-center min-h-[160px]">
              {u.role === 'admin' ? (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold">System Overview</p>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[7px] text-blue-500/80 font-bold uppercase tracking-widest">Master Feed</span>
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex-1 flex items-center">
                    <div className="grid grid-cols-4 gap-1 w-full text-center">
                      <div className="flex flex-col items-center justify-center">
                        <DollarSign size={14} className="text-green-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(userDetailStats?.[u.id]?.totalRevenue || 0).toLocaleString()}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Revenue</p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <XCircle size={14} className="text-red-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(userDetailStats?.[u.id]?.lostRevenue || 0).toLocaleString()}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Lost</p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <CalendarCog size={14} className="text-purple-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats?.[u.id]?.unassignedCount || 0}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Pending</p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <Users size={14} className="text-blue-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats?.[u.id]?.totalSystemUsers || 0}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Users</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : u.role === 'driver' ? (
                <div className="flex flex-col justify-center h-full">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold"> Operational Health </p>
                    {userDetailStats?.[u.id]?.feedbacks?.length > 0 && (
                      <div className="relative group/feedback">
                        <button className="text-gold hover:text-white transition-colors p-1 -m-1">
                          <MessageSquare size={12} />
                        </button>
                        <div className="invisible opacity-0 group-hover/feedback:visible group-hover/feedback:opacity-100 absolute right-0 bottom-full mb-3 w-64 bg-black/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] transition-all duration-300 transform translate-y-2 group-hover/feedback:translate-y-0">
                          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                            <p className="text-[10px] font-bold text-gold uppercase tracking-widest flex items-center gap-2"> <MessageSquare size={12} /> Client Feedback </p>
                            <span className="text-[10px] text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded"> {userDetailStats?.[u.id]?.feedbacks?.length} </span>
                          </div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {userDetailStats?.[u.id]?.feedbacks?.map((f: any, i: number) => (
                              <div key={`feedback-${u.id}-${i}`} className="group/item relative bg-white/5 p-2.5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-white block truncate"> {f.customerName} </span>
                                    <div className="flex gap-0.5 mt-0.5">
                                      {[...Array(5)].map((_, j) => (
                                        <Star key={`feedback-star-${u.id}-${i}-${j}`} size={8} className={j < (f.rating || 0) ? "text-gold fill-gold" : "text-white/10"} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-[10px] text-white/70 italic leading-relaxed line-clamp-3"> {f.comment?.trim() ? `"${f.comment}"` : "No comment provided"} </p>
                              </div>
                            ))}
                          </div>
                          <div className="absolute right-2 top-full w-3 h-3 bg-black/95 border-r border-b border-white/10 transform rotate-45 -translate-y-1.5"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="bg-white/5 p-2 rounded-2xl border border-white/5 flex-1 flex items-center">
                    <div className="grid grid-cols-5 gap-1 w-full text-center">
                      <div className="flex flex-col items-center justify-center">
                        <CheckCircle size={14} className="text-green-400 mb-1.5" />
                        <span className="text-[11px] text-white font-bold leading-none mb-1">{userDetailStats?.[u.id]?.completedRides || 0}</span>
                        <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Done</span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <Star size={14} className="text-gold mb-1.5" />
                        <span className="text-[11px] text-white font-bold leading-none mb-1">{userDetailStats?.[u.id]?.ratingCount || 0}</span>
                        <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Rating</span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <AlertCircle size={14} className="text-orange-400 mb-1.5" />
                        <span className="text-[11px] text-white font-bold leading-none mb-1">{userDetailStats?.[u.id]?.unreviewedCount || 0}</span>
                        <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Wait</span>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <Award size={14} className="text-cyan-400 mb-1.5" />
                        <span className="text-[11px] text-cyan-400 font-bold leading-none mb-1">{userDetailStats?.[u.id]?.totalRatingValue || 0}</span>
                        <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Score</span>
                      </div>
                      <div className="flex flex-col items-center justify-center border-l border-white/10 pl-1">
                        <PiggyBank size={14} className="text-lime-400 mb-1.5" />
                        <span className="text-[11px] text-lime-400 font-bold leading-none mb-1">${Math.round(userDetailStats?.[u.id]?.totalEarnings || 0).toLocaleString()}</span>
                        <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Rev</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold">Engagement History</p>
                    <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-lg border border-gold/20 font-bold uppercase tracking-widest">
                      Fav: {userDetailStats?.[u.id]?.favoriteService}
                    </span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex-1 flex items-center">
                    <div className="grid grid-cols-5 gap-1.5 w-full text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Activity size={14} className="text-blue-400 mb-1.5" />
                        <div className="flex items-end justify-center gap-0.5 leading-none mb-1">
                          <span className="text-[11px] font-bold text-white">{userDetailStats?.[u.id]?.completedRides || 0}</span>
                          <span className="text-[7px] text-white/40 font-bold">/{userDetailStats?.[u.id]?.totalBookings || 0}</span>
                        </div>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Activity</p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <DollarSign size={14} className="text-green-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(userDetailStats?.[u.id]?.totalSpend || 0).toLocaleString()}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Spend</p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <XCircle size={14} className="text-red-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats?.[u.id]?.cancelledRides || 0}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Cancel</p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <MessageSquare size={14} className="text-cyan-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats?.[u.id]?.reviewedCount || 0}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Reviews</p>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <Clock size={14} className="text-orange-400 mb-1.5" />
                        <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats?.[u.id]?.unreviewedCount || 0}</p>
                        <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Pending</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-4 border-t border-white/5 flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingUser(u);
                  setShowUserModal(true);
                }}
                className="flex-1 px-3 py-2 border border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500 transition-all rounded-xl flex items-center justify-center gap-2"
              >
                <Edit2 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Edit</span>
              </button>
              <button
                onClick={() => handleDeleteUser(u.id)}
                className="flex-1 px-3 py-2 border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all rounded-xl flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-6 md:p-8 rounded-sm border border-gold/20 max-h-[95vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6 text-center md:text-left">
                <h3 className="text-xl font-display text-gold">
                  {editingUser.id ? 'Edit System User' : 'Register New User'}
                </h3>
                <button onClick={() => setShowUserModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Full Name</label>
                    <input
                      type="text"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="John Doe"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">System Role</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                      className="custom-select w-full py-3 text-sm"
                    >
                      <option value="customer">Customer</option>
                      <option value="driver">Driver</option>
                      <option value="admin">Administrator</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Email Address</label>
                  <input
                    type="email"
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="name@example.com"
                  />
                </div>

                {!editingUser.id && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Password (Required for new user)</label>
                    <input
                      type="password"
                      value={editingUser.password || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Min 6 characters"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Phone Number</label>
                    <input
                      type="tel"
                      value={editingUser.phone}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="+61 ..."
                    />
                  </div>
                  {editingUser.role === 'driver' && (
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Driver License</label>
                      <input
                        type="text"
                        value={editingUser.license || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, license: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all uppercase"
                        placeholder="Lic #"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Residential Address</label>
                  <input
                    type="text"
                    value={editingUser.address || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, address: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Street, City, Postcode"
                  />
                </div>

                {editingUser.id && (
                  <div className="pt-2">
                    <button
                      onClick={() => handleBlockUser(editingUser.id, !editingUser.blocked)}
                      className={cn(
                        "flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest px-3 py-2 rounded-lg border transition-all w-full justify-center",
                        editingUser.blocked
                          ? "bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                      )}
                    >
                      {editingUser.blocked ? <CheckCircle size={14} /> : <Ban size={14} />}
                      {editingUser.blocked ? 'Unblock User Account' : 'Block User Account'}
                    </button>
                  </div>
                )}

                <button
                  disabled={isCreatingUser}
                  onClick={() => editingUser.id ? handleUpdateUser(editingUser.id, editingUser) : handleCreateUser(editingUser)}
                  className="w-full btn-primary py-4 rounded-xl flex items-center justify-center gap-3 transition-all relative overflow-hidden group mt-4 mb-2 disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gold/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                  {isCreatingUser ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">Processing...</span>
                    </>
                  ) : (
                    <>
                      <Save size={18} />
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">{editingUser.id ? 'Update User' : 'Register User'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
