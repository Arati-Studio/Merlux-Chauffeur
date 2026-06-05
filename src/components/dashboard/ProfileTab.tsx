import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Shield, Car, User, Loader2, Save, Mail,
  DollarSign, XCircle, CalendarCog, Users, CheckCircle, Star, AlertCircle, Award, PiggyBank, Activity, MessageSquare, Clock,
  UploadCloud, FileText, Check, Eye, ExternalLink
} from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { verifyBeforeUpdateEmail } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';

export default function ProfileTab({
  user,
  userProfile: globalUserProfile,
  showDashboardNotice,
}: any) {
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [localProfile, setLocalProfile] = useState<any>(globalUserProfile);

  // Expanded Image Lightbox State
  const [expandedImage, setExpandedImage] = useState<{ src: string, title: string } | null>(null);

  // Driver document fields
  const [driverLicenseNumber, setDriverLicenseNumber] = useState('');
  const [driverLicenseExpiry, setDriverLicenseExpiry] = useState('');
  const [driverLicenseBase64, setDriverLicenseBase64] = useState('');
  const [driverLicenseFileName, setDriverLicenseFileName] = useState('');

  const [vehicleInsurancePolicy, setVehicleInsurancePolicy] = useState('');
  const [vehicleInsuranceExpiry, setVehicleInsuranceExpiry] = useState('');
  const [vehicleInsuranceBase64, setVehicleInsuranceBase64] = useState('');
  const [vehicleInsuranceFileName, setVehicleInsuranceFileName] = useState('');

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  // Google Products Gmail state
  const [googleLinkGmail, setGoogleLinkGmail] = useState('');

  const currentProfile = localProfile || globalUserProfile;

  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.id ? { id: snap.id, ...snap.data() } : snap.data();
        setLocalProfile(data);
        if (data.name) setProfileName(data.name);
        if (data.phone) setProfilePhone(data.phone);
        if (data.address) setProfileAddress(data.address);
        
        // Populate google link gmail
        if (data.googleLinkGmail) {
          setGoogleLinkGmail(data.googleLinkGmail);
        } else {
          const defaultEmail = data.email || user?.email || '';
          if (defaultEmail.toLowerCase().endsWith('@gmail.com') || defaultEmail.toLowerCase().endsWith('@googlemail.com')) {
            setGoogleLinkGmail(defaultEmail);
          }
        }
        
        // Populate driver document details
        if (data.driverLicenseNumber) setDriverLicenseNumber(data.driverLicenseNumber);
        if (data.driverLicenseExpiry) setDriverLicenseExpiry(data.driverLicenseExpiry);
        if (data.driverLicenseBase64) setDriverLicenseBase64(data.driverLicenseBase64);
        if (data.driverLicenseFileName) setDriverLicenseFileName(data.driverLicenseFileName);
        
        if (data.vehicleInsurancePolicy) setVehicleInsurancePolicy(data.vehicleInsurancePolicy);
        if (data.vehicleInsuranceExpiry) setVehicleInsuranceExpiry(data.vehicleInsuranceExpiry);
        if (data.vehicleInsuranceBase64) setVehicleInsuranceBase64(data.vehicleInsuranceBase64);
        if (data.vehicleInsuranceFileName) setVehicleInsuranceFileName(data.vehicleInsuranceFileName);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // Fetch role-based stats details
  useEffect(() => {
    if (!user?.uid || !currentProfile?.role) return;

    let unsubBookings: () => void = () => {};
    let unsubUsers: () => void = () => {};

    const role = currentProfile.role;

    if (role === 'admin') {
      const qBookings = query(collection(db, 'bookings'));
      unsubBookings = onSnapshot(qBookings, (snapBookings) => {
        const bookings = snapBookings.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        
        const qUsers = query(collection(db, 'users'), limit(500));
        unsubUsers = onSnapshot(qUsers, (snapUsers) => {
          const usersCount = snapUsers.size;

          const totalRevenue = bookings
            .filter(b => b.paymentStatus === 'paid' || b.status === 'completed')
            .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
          
          const lostRevenue = bookings
            .filter(b => b.status === 'cancelled')
            .reduce((sum, b) => sum + (Number(b.price) || 0), 0);
          
          const unassignedCount = bookings
            .filter(b => !b.driverId && b.status !== 'cancelled')
            .length;

          const totalBookings = bookings.length;

          setStats({
            totalRevenue,
            lostRevenue,
            unassignedCount,
            totalSystemUsers: usersCount,
            totalBookings
          });
          setLoadingStats(false);
        });
      }, (err) => {
        console.error('Error fetching admin bookings stats:', err);
        setLoadingStats(false);
      });
    } else if (role === 'driver') {
      const qBookings = query(collection(db, 'bookings'), where('driverId', '==', user.uid));
      unsubBookings = onSnapshot(qBookings, (snapBookings) => {
        const driverBookings = snapBookings.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        
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

        setStats({
          completedRides,
          ratingCount,
          avgRating,
          unreviewedCount,
          totalRatingValue: avgRating > 0 ? Number(avgRating.toFixed(1)) : 0,
          totalEarnings,
          feedbacks
        });
        setLoadingStats(false);
      }, (err) => {
        console.error('Error fetching driver bookings stats:', err);
        setLoadingStats(false);
      });
    } else {
      const qBookings = query(
        collection(db, 'bookings'), 
        where('userId', '==', user.uid)
      );
      unsubBookings = onSnapshot(qBookings, (snapBookings) => {
        const customerBookings = snapBookings.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        
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

        setStats({
          completedRides,
          totalBookings,
          totalSpend,
          cancelledRides,
          reviewedCount,
          unreviewedCount,
          favoriteService
        });
        setLoadingStats(false);
      }, (err) => {
        console.error('Error fetching customer bookings stats:', err);
        setLoadingStats(false);
      });
    }

    return () => {
      unsubBookings();
      unsubUsers();
    };
  }, [user?.uid, currentProfile?.role]);

  const handleFileChange = (file: File, type: 'license' | 'insurance') => {
    if (file.size > 4 * 1024 * 1024) {
      showDashboardNotice('error', 'File size exceeds the 4MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (type === 'license') {
        setDriverLicenseBase64(base64);
        setDriverLicenseFileName(file.name);
        showDashboardNotice('success', `License document loaded: ${file.name}`);
      } else {
        setVehicleInsuranceBase64(base64);
        setVehicleInsuranceFileName(file.name);
        showDashboardNotice('success', `Insurance document loaded: ${file.name}`);
      }
    };
    reader.onerror = () => {
      showDashboardNotice('error', 'Failed to read file.');
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async () => {
    if (!user?.uid) return;
    
    if (newPassword && newPassword !== confirmPassword) {
      showDashboardNotice('error', 'Passwords do not match');
      return;
    }

    if (googleLinkGmail) {
      const cleanGmail = googleLinkGmail.trim().toLowerCase();
      if (!cleanGmail.endsWith('@gmail.com') && !cleanGmail.endsWith('@googlemail.com')) {
        showDashboardNotice('error', 'Only standard Google Gmail accounts (@gmail.com or @googlemail.com) are allowed for Google Related Product Link purposes.');
        return;
      }
    }

    setIsUpdatingProfile(true);
    try {
      const updateData: any = {
        name: profileName,
        phone: profilePhone,
        address: profileAddress,
        googleLinkGmail: googleLinkGmail.trim().toLowerCase(),
        updatedAt: serverTimestamp()
      };

      if (currentProfile?.role === 'driver') {
        updateData.driverLicenseNumber = driverLicenseNumber;
        updateData.driverLicenseExpiry = driverLicenseExpiry;
        updateData.driverLicenseBase64 = driverLicenseBase64;
        updateData.driverLicenseFileName = driverLicenseFileName;

        updateData.vehicleInsurancePolicy = vehicleInsurancePolicy;
        updateData.vehicleInsuranceExpiry = vehicleInsuranceExpiry;
        updateData.vehicleInsuranceBase64 = vehicleInsuranceBase64;
        updateData.vehicleInsuranceFileName = vehicleInsuranceFileName;
        
        // Auto-reject if credentials are expired
        const isLicenseExpired = driverLicenseExpiry ? new Date(driverLicenseExpiry) < new Date() : false;
        const isInsuranceExpired = vehicleInsuranceExpiry ? new Date(vehicleInsuranceExpiry) < new Date() : false;

        if (isLicenseExpired || isInsuranceExpired) {
          updateData.driverVerificationStatus = 'rejected';
        } else if (!currentProfile?.driverVerificationStatus || currentProfile?.driverVerificationStatus === 'rejected') {
          updateData.driverVerificationStatus = 'pending';
        }
      }

      await updateDoc(doc(db, 'users', user.uid), updateData);

      if (newPassword) {
        const { updatePassword, getAuth } = await import('firebase/auth');
        const auth = getAuth();
        if (auth.currentUser) {
          await updatePassword(auth.currentUser, newPassword);
        }
      }

      showDashboardNotice('success', 'Profile updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      showDashboardNotice('error', err.message || 'Failed to update profile');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!user?.uid) return;

    const emailToUse = newEmail.trim().toLowerCase();

    if (!emailToUse) {
      showDashboardNotice('error', 'Please enter a valid email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToUse)) {
      showDashboardNotice('error', 'Please enter a valid email format');
      return;
    }

    if (emailToUse === user.email?.toLowerCase()) {
      showDashboardNotice('error', 'New email is identical to your current email');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      // 1. Send verification link and initiate email update in Firebase Auth
      if (auth.currentUser) {
        await verifyBeforeUpdateEmail(auth.currentUser, emailToUse);
      } else {
        throw new Error('No authenticated user found');
      }

      // 2. Update Firestore User Document email immediately so profile is synced
      await updateDoc(doc(db, 'users', user.uid), {
        email: emailToUse,
        updatedAt: serverTimestamp()
      });

      // 3. Find and update all bookings for the user to replace old email with new email
      const bookingsToUpdate: any[] = [];

      // Query by userId
      const qByUserId = query(collection(db, 'bookings'), where('userId', '==', user.uid));
      const snapByUserId = await getDocs(qByUserId);
      snapByUserId.forEach(d => {
        bookingsToUpdate.push(d);
      });

      // Query by current email as well to make sure all guest or mismatched bookings are updated
      if (user.email) {
        const qByEmail = query(collection(db, 'bookings'), where('customerEmail', '==', user.email));
        const snapByEmail = await getDocs(qByEmail);
        snapByEmail.forEach(d => {
          if (!bookingsToUpdate.some(existing => existing.id === d.id)) {
            bookingsToUpdate.push(d);
          }
        });
      }

      // Apply batch updates to respect bookings
      if (bookingsToUpdate.length > 0) {
        const batch = writeBatch(db);
        bookingsToUpdate.forEach(d => {
          const data = d.data();
          batch.update(d.ref, {
            customerEmail: emailToUse,
            ...(data.email ? { email: emailToUse } : {})
          });
        });
        await batch.commit();
      }

      showDashboardNotice('success', `Verification link sent to ${emailToUse}. Your profile and ${bookingsToUpdate.length} bookings have been updated and synchronized successfully!`);
      setNewEmail('');
    } catch (err: any) {
      console.error('Error updating email:', err);
      if (err.code === 'auth/requires-recent-login') {
        showDashboardNotice('error', 'For security reasons, changing your email requires a recent login. Please log out and log back in, then try again.');
      } else {
        showDashboardNotice('error', err.message || 'Failed to update email address');
      }
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  return (
<div className="space-y-8">
  {/* Header */}
  <div className="flex justify-between items-center">
    <div>
      <h3 className="text-xl sm:text-2xl font-display text-gold">Profile Settings</h3>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage your account and security</p>
    </div>
  </div>

  {/* Main Content - Unified Container */}
  <div className="glass border border-white/5 rounded-3xl overflow-hidden">
    {/* Profile Header Section */}
    <div className="relative">
      {/* Cover Background */}
      <div className={cn(
        "h-32 relative",
        currentProfile?.role === 'admin' ? "bg-gradient-to-br from-red-500/20 to-red-600/10" :
        currentProfile?.role === 'driver' ? "bg-gradient-to-br from-blue-500/20 to-blue-600/10" : 
        "bg-gradient-to-br from-gold/20 to-gold/10"
      )}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(255,255,255,0.1),transparent)]" />
        <div className="absolute top-0 right-0 p-6 opacity-5">
          {currentProfile?.role === 'admin' ? <Shield size={100} /> :
          currentProfile?.role === 'driver' ? <Car size={100} /> : <User size={100} />}
        </div>
      </div>

      {/* Profile Info Overlay */}
      <div className="px-8 pb-8 -mt-12 relative">
        <div className="flex flex-col xl:flex-row items-stretch xl:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 flex-1">
            {/* Avatar */}
            <div className={cn(
              "w-24 h-24 rounded-2xl flex items-center justify-center border-4 border-black shadow-2xl flex-shrink-0",
              currentProfile?.role === 'admin' ? "bg-red-500 text-white" :
              currentProfile?.role === 'driver' ? "bg-blue-500 text-white" : "bg-gold text-black"
            )}>
              {currentProfile?.role === 'admin' ? <Shield size={40} /> :
              currentProfile?.role === 'driver' ? <Car size={40} /> : <User size={40} />}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h4 className="text-xl font-bold text-white mb-1">{currentProfile?.name || 'User'}</h4>
              <p className="text-sm text-white/50 mb-3">{user?.email}</p>
              <div className="flex flex-wrap gap-2">
                <span className={cn(
                  "text-[10px] uppercase font-bold px-3 py-1.5 rounded-full",
                  currentProfile?.role === 'admin' ? "bg-red-500/15 text-red-400 border border-red-500/20" :
                  currentProfile?.role === 'driver' ? "bg-blue-500/15 text-blue-400 border border-blue-500/20" : 
                  "bg-gold/15 text-gold border border-gold/20"
                )}>
                  {currentProfile?.role}
                </span>
                <span className="text-[10px] bg-white/5 text-white/40 border border-white/10 px-3 py-1.5 rounded-full uppercase font-bold">
                  Account Verified
                </span>
              </div>
            </div>
          </div>

          {/* Stats Display Panel */}
          {stats && !loadingStats ? (
            <div className={cn(
              "w-full xl:w-auto xl:min-w-[380px] bg-white/5 p-4 rounded-2xl border border-white/5 shadow-2xl flex flex-col justify-center min-h-[90px] relative transition-all",
              currentProfile?.role === 'admin' ? "hover:border-red-500/30" :
              currentProfile?.role === 'driver' ? "hover:border-blue-500/30" : "hover:border-gold/30"
            )}>
              {currentProfile?.role === 'admin' ? (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold font-mono">System Overview</p>
                    <div className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                      <span className="text-[7px] text-blue-500/80 font-bold uppercase tracking-widest">Master Feed</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 w-full text-center">
                    <div className="flex flex-col items-center justify-center">
                      <DollarSign size={14} className="text-green-400 mb-1.5 animate-pulse" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(stats?.totalRevenue || 0).toLocaleString()}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Revenue</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <XCircle size={14} className="text-red-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(stats?.lostRevenue || 0).toLocaleString()}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Lost</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <CalendarCog size={14} className="text-purple-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">{stats?.unassignedCount || 0}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Pending</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <Activity size={14} className="text-cyan-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">{stats?.totalBookings || 0}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Bookings</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <Users size={14} className="text-blue-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">{stats?.totalSystemUsers || 0}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Users</p>
                    </div>
                  </div>
                </div>
              ) : currentProfile?.role === 'driver' ? (
                <div className="flex flex-col justify-center h-full">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold font-mono">Operational Health</p>
                    {stats?.feedbacks?.length > 0 && (
                      <div className="relative group/feedback">
                        <button className="text-gold hover:text-white transition-colors p-1 -m-1">
                          <MessageSquare size={12} />
                        </button>
                        <div className="invisible opacity-0 group-hover/feedback:visible group-hover/feedback:opacity-100 absolute right-0 bottom-full mb-3 w-64 bg-black/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] transition-all duration-300 transform translate-y-2 group-hover/feedback:translate-y-0">
                          <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                            <p className="text-[10px] font-bold text-gold uppercase tracking-widest flex items-center gap-2"> <MessageSquare size={12} /> Client Feedback </p>
                            <span className="text-[10px] text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded"> {stats?.feedbacks?.length} </span>
                          </div>
                          <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                            {stats?.feedbacks?.map((f: any, i: number) => (
                              <div key={`profile-feedback-${i}`} className="group/item relative bg-white/5 p-2.5 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-1 text-left">
                                  <div className="min-w-0 flex-1">
                                    <span className="text-[10px] font-bold text-white block truncate"> {f.customerName} </span>
                                    <div className="flex gap-0.5 mt-0.5">
                                      {[...Array(5)].map((_, j) => (
                                        <Star key={`profile-feedback-star-${i}-${j}`} size={8} className={j < (f.rating || 0) ? "text-gold fill-gold" : "text-white/10"} />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <p className="text-[10px] text-white/70 italic leading-relaxed line-clamp-3 text-left"> {f.comment?.trim() ? `"${f.comment}"` : "No comment provided"} </p>
                              </div>
                            ))}
                          </div>
                          <div className="absolute right-2 top-full w-3 h-3 bg-black/95 border-r border-b border-white/10 transform rotate-45 -translate-y-1.5"></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-1 w-full text-center">
                    <div className="flex flex-col items-center justify-center">
                      <CheckCircle size={14} className="text-green-400 mb-1.5" />
                      <span className="text-[11px] text-white font-bold leading-none mb-1">{stats?.completedRides || 0}</span>
                      <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Done</span>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <Star size={14} className="text-gold mb-1.5" />
                      <span className="text-[11px] text-white font-bold leading-none mb-1">{stats?.ratingCount || 0}</span>
                      <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Rating</span>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <AlertCircle size={14} className="text-orange-400 mb-1.5" />
                      <span className="text-[11px] text-white font-bold leading-none mb-1">{stats?.unreviewedCount || 0}</span>
                      <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Wait</span>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <Award size={14} className="text-cyan-400 mb-1.5" />
                      <span className="text-[11px] text-cyan-400 font-bold leading-none mb-1">{stats?.totalRatingValue || 0}</span>
                      <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Score</span>
                    </div>
                    <div className="flex flex-col items-center justify-center border-l border-white/10 pl-1">
                      <PiggyBank size={14} className="text-lime-400 mb-1.5" />
                      <span className="text-[11px] text-lime-400 font-bold leading-none mb-1">${Math.round(stats?.totalEarnings || 0).toLocaleString()}</span>
                      <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Rev</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 h-full flex flex-col">
                  <div className="flex justify-between items-center">
                    <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold leading-none font-mono">Engagement History</p>
                    <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-lg border border-gold/20 font-bold uppercase tracking-widest leading-none">
                      Fav: {stats?.favoriteService}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 w-full text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Activity size={14} className="text-blue-400 mb-1.5" />
                      <div className="flex items-end justify-center gap-0.5 leading-none mb-1">
                        <span className="text-[11px] font-bold text-white">{stats?.completedRides || 0}</span>
                        <span className="text-[7px] text-white/40 font-bold">/{stats?.totalBookings || 0}</span>
                      </div>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Activity</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <DollarSign size={14} className="text-green-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(stats?.totalSpend || 0).toLocaleString()}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Spend</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <XCircle size={14} className="text-red-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">{stats?.cancelledRides || 0}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Cancel</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <MessageSquare size={14} className="text-cyan-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">{stats?.reviewedCount || 0}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Reviews</p>
                    </div>
                    <div className="flex flex-col items-center justify-center">
                      <Clock size={14} className="text-orange-400 mb-1.5" />
                      <p className="text-[11px] font-bold text-white leading-none mb-1">{stats?.unreviewedCount || 0}</p>
                      <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Pending</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-full xl:w-auto xl:min-w-[380px] h-[90px] bg-white/5 rounded-2xl border border-white/5 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-gold animate-spin" />
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Divider */}
    <div className="border-t border-white/5" />

    {/* Settings Forms */}
    <div className="p-8 space-y-8">
      {/* Personal Details */}
      <div>
        <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6 flex items-center gap-2">
          <User size={16} /> Personal Details
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Full Name</label>
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                placeholder="Your Name"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Phone Number</label>
              <input
                type="tel"
                value={profilePhone}
                onChange={(e) => setProfilePhone(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                placeholder="+61 ..."
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Address</label>
            <input
              type="text"
              value={profileAddress}
              onChange={(e) => setProfileAddress(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
              placeholder="Street Address, Suburb, City"
            />
          </div>
        </div>
      </div>

      {currentProfile?.role === 'driver' && (
        <>
          {/* Divider */}
          <div className="border-t border-white/5" />

          {/* Credentials and Insurance Document Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-sm font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                <Car size={16} /> Driver Credentials & Insurance
              </h4>
              {currentProfile?.driverVerificationStatus ? (
                <span className={cn(
                  "text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border",
                  currentProfile.driverVerificationStatus === 'approved' ? "bg-green-500/15 text-green-400 border-green-500/20" :
                  currentProfile.driverVerificationStatus === 'rejected' ? "bg-red-500/15 text-red-400 border-red-500/20" :
                  "bg-amber-500/15 text-amber-400 border-amber-500/20"
                )}>
                  Verification: {currentProfile.driverVerificationStatus}
                </span>
              ) : (
                <span className="text-[10px] text-white/40 font-semibold bg-white/5 px-3 py-1 rounded-full border border-white/10 uppercase font-mono">
                  Verification: Pending Initial Submission
                </span>
              )}
            </div>

            {( (driverLicenseExpiry && new Date(driverLicenseExpiry) < new Date()) || (vehicleInsuranceExpiry && new Date(vehicleInsuranceExpiry) < new Date()) ) && (
              <div id="credential-warning-banner" className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
                <AlertCircle className="text-red-400 shrink-0 w-5 h-5 mt-0.5 animate-pulse" />
                <div className="space-y-1">
                  <h5 className="text-xs font-bold text-red-400 uppercase tracking-wider">Driver Credentials & Insurance Reverified/Update Needed</h5>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    Your license or insurance policy has expired. Please upload valid updated documents. Expired credentials prevent you from being assigned to list of active chauffeurs and picking rides.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Driver License Card */}
              <div className="bg-[#050510]/50 border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/80">1. Driver License</span>
                  {driverLicenseBase64 ? (
                    <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-bold uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle size={10} /> Document Loaded
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20 font-bold uppercase tracking-widest">
                      Missing Copy
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">License Number</label>
                    <input
                      type="text"
                      value={driverLicenseNumber}
                      onChange={(e) => setDriverLicenseNumber(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all text-white"
                      placeholder="DL-xxxxxx"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Expiry Date</label>
                    <input
                      type="date"
                      value={driverLicenseExpiry}
                      onChange={(e) => setDriverLicenseExpiry(e.target.value)}
                      className={cn(
                        "w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all text-white",
                        driverLicenseExpiry && new Date(driverLicenseExpiry) < new Date() ? "border-red-500/50 focus:border-red-500 text-red-00" : ""
                      )}
                    />
                    {driverLicenseExpiry && new Date(driverLicenseExpiry) < new Date() && (
                      <span className="text-[8px] text-red-500 font-bold uppercase tracking-widest mt-1 block">Credential Expired</span>
                    )}
                  </div>
                </div>

                {/* Drag & Drop Upload Zone for License */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-gold', 'bg-gold/5'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-gold', 'bg-gold/5'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-gold', 'bg-gold/5');
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileChange(file, 'license');
                  }}
                  className="border-2 border-dashed border-white/10 hover:border-gold/50 bg-black/40 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px] relative group"
                  onClick={() => document.getElementById('license-upload-input')?.click()}
                >
                  <input
                    id="license-upload-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(file, 'license');
                    }}
                  />
                  {driverLicenseBase64 ? (
                    <div className="space-y-2 w-full" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div 
                          onClick={() => setExpandedImage({ src: driverLicenseBase64, title: "Driver License Copy" })}
                          className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 hover:border-gold/50 bg-black flex items-center justify-center relative cursor-zoom-in group/thumb transition-colors duration-300 shadow-md"
                          title="Click to view full screen"
                        >
                          <img src={driverLicenseBase64} alt="License Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye size={16} className="text-gold" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => document.getElementById('license-upload-input')?.click()}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-wider text-white/70 transition-all"
                        >
                          Replace File
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-white max-w-[200px] truncate mx-auto">{driverLicenseFileName || "license_document.png"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <UploadCloud className="w-8 h-8 text-white/20 group-hover:text-gold transition-colors mx-auto" />
                      <div>
                        <p className="text-[10px] text-white/70 font-semibold">Drag & drop license image or click to browse</p>
                        <p className="text-[9px] text-white/30 uppercase mt-1">PNG, JPG, or JPEG (Max 4MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Vehicle Insurance Card */}
              <div className="bg-[#050510]/50 border border-white/5 hover:border-white/10 rounded-2xl p-5 space-y-4 transition-all">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-white/80">2. Vehicle Insurance</span>
                  {vehicleInsuranceBase64 ? (
                    <span className="text-[9px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20 font-bold uppercase tracking-widest flex items-center gap-1">
                      <CheckCircle size={10} /> Document Loaded
                    </span>
                  ) : (
                    <span className="text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full border border-[#f59e0b]/20 font-bold uppercase tracking-widest">
                      Missing Copy
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Policy Number</label>
                    <input
                      type="text"
                      value={vehicleInsurancePolicy}
                      onChange={(e) => setVehicleInsurancePolicy(e.target.value)}
                      className="w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all text-white"
                      placeholder="POL-xxxxxx"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Expiry Date</label>
                    <input
                      type="date"
                      value={vehicleInsuranceExpiry}
                      onChange={(e) => setVehicleInsuranceExpiry(e.target.value)}
                      className={cn(
                        "w-full bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-gold transition-all text-white",
                        vehicleInsuranceExpiry && new Date(vehicleInsuranceExpiry) < new Date() ? "border-red-500/50 focus:border-red-500 text-red-00" : ""
                      )}
                    />
                    {vehicleInsuranceExpiry && new Date(vehicleInsuranceExpiry) < new Date() && (
                      <span className="text-[8px] text-red-500 font-bold uppercase tracking-widest mt-1 block">Insurance Expired</span>
                    )}
                  </div>
                </div>

                {/* Drag & Drop Upload Zone for Insurance */}
                <div
                  onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-gold', 'bg-gold/5'); }}
                  onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-gold', 'bg-gold/5'); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-gold', 'bg-gold/5');
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileChange(file, 'insurance');
                  }}
                  className="border-2 border-dashed border-white/10 hover:border-gold/50 bg-black/40 rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[120px] relative group"
                  onClick={() => document.getElementById('insurance-upload-input')?.click()}
                >
                  <input
                    id="insurance-upload-input"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(file, 'insurance');
                    }}
                  />
                  {vehicleInsuranceBase64 ? (
                    <div className="space-y-2 w-full" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div 
                          onClick={() => setExpandedImage({ src: vehicleInsuranceBase64, title: "Vehicle Insurance Copy" })}
                          className="w-16 h-16 rounded-xl overflow-hidden border border-white/10 hover:border-gold/50 bg-black flex items-center justify-center relative cursor-zoom-in group/thumb transition-colors duration-300 shadow-md"
                          title="Click to view full screen"
                        >
                          <img src={vehicleInsuranceBase64} alt="Insurance Preview" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye size={16} className="text-gold" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => document.getElementById('insurance-upload-input')?.click()}
                          className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-wider text-white/70 transition-all"
                        >
                          Replace File
                        </button>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-white max-w-[200px] truncate mx-auto">{vehicleInsuranceFileName || "insurance_document.png"}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <UploadCloud className="w-8 h-8 text-white/20 group-hover:text-gold transition-colors mx-auto" />
                      <div>
                        <p className="text-[10px] text-white/70 font-semibold">Drag & drop insurance copy or click to browse</p>
                        <p className="text-[9px] text-white/30 uppercase mt-1">PNG, JPG, or JPEG (Max 4MB)</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Google Products Link Gmail Settings */}
      <div>
        <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6 flex items-center gap-2 font-display">
          <CalendarCog size={16} /> Google Products Association
        </h4>
        <div className="space-y-4">
          <div className="bg-gold/5 border border-gold/10 rounded-2xl p-4 flex gap-3">
            <AlertCircle className="text-gold shrink-0 w-5 h-5 mt-0.5" />
            <div className="space-y-1">
              <h5 className="text-xs font-bold text-gold uppercase tracking-wider">Purpose-Specific Google Workspace Gmail</h5>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Provide a standard Google Gmail address below to link Google related products (Google Calendar, Notes, Google Drive). <strong>Only standard Google Gmail accounts (@gmail.com or @googlemail.com) are allowed.</strong> Non-Gmail accounts are not permitted to use Google Product integrations to ensure verification and security.
              </p>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Link Purpose Gmail</label>
            <input
              type="text"
              value={googleLinkGmail}
              onChange={(e) => setGoogleLinkGmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white"
              placeholder="e.g. driver-account@gmail.com"
            />
          </div>

          {googleLinkGmail && (googleLinkGmail.toLowerCase().endsWith('@gmail.com') || googleLinkGmail.toLowerCase().endsWith('@googlemail.com')) ? (
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block mt-2">Linked Google Workspace Products</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <a
                  href="https://calendar.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-white/5 border border-white/5 hover:border-gold/30 rounded-xl p-3 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    Google Calendar
                  </span>
                  <ExternalLink size={12} className="text-white/40 group-hover:text-gold" />
                </a>

                <a
                  href="https://keep.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-white/5 border border-white/5 hover:border-gold/30 rounded-xl p-3 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />
                    Google Notes (Keep)
                  </span>
                  <ExternalLink size={12} className="text-white/40 group-hover:text-gold" />
                </a>

                <a
                  href="https://drive.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between bg-white/5 border border-white/5 hover:border-gold/30 rounded-xl p-3 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-all group"
                >
                  <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Google Drive
                  </span>
                  <ExternalLink size={12} className="text-white/40 group-hover:text-gold" />
                </a>
              </div>
            </div>
          ) : googleLinkGmail ? (
            <div className="text-[10px] text-red-400 font-semibold uppercase tracking-wider mt-1">
              ⚠️ Linking is disabled. Access to Workspace products is restricted to verified standard Gmail accounts only.
            </div>
          ) : null}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Email Settings */}
      <div>
        <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6 flex items-center gap-2">
          <Mail size={16} /> Email Address Settings
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Current Email</label>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full bg-white/2 border border-white/5 rounded-xl px-4 py-3 pl-10 text-sm outline-none text-white/40 cursor-not-allowed"
                />
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" />
              </div>
            </div>
            
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">New Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-10 text-sm outline-none focus:border-gold transition-all text-white"
                  placeholder="new-email@example.com"
                />
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30" />
              </div>
            </div>
          </div>
          
          <div className="bg-white/5 border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-white/40 leading-relaxed">
              We will send a secure verification link to verify your new email address. Changes will automatically synchronize and replace the email in all your existing & upcoming bookings to guarantee zero service interruption.
            </p>
          </div>

          <button
            onClick={handleUpdateEmail}
            disabled={isUpdatingEmail}
            className="w-full sm:w-auto px-6 py-3 bg-white/10 hover:bg-gold hover:text-black text-white rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUpdatingEmail ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Sending Verification...</span>
              </>
            ) : (
              <>
                <Mail size={14} />
                <span>Update Email & Sync Bookings</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Security */}
      <div>
        <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6 flex items-center gap-2">
          <Shield size={16} /> Security
        </h4>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>
          <p className="text-[10px] text-white/30 italic">
            Leave password fields blank if you don't want to change your password.
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/5" />

      {/* Save Button */}
      <button
        onClick={handleUpdateProfile}
        disabled={isUpdatingProfile}
        className="w-full bg-gold text-black py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-gold/20"
      >
        {isUpdatingProfile ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Updating Account...</span>
          </>
        ) : (
          <>
            <Save size={16} />
            <span>Save Profile Settings</span>
          </>
        )}
      </button>

      {/* Full-Screen Image Lightbox */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpandedImage(null)}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[200] flex items-center justify-center p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl w-full bg-[#050510] border border-gold/20 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center"
            >
              <button
                onClick={() => setExpandedImage(null)}
                className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full p-2 transition-colors cursor-pointer z-10"
                id="close-lightbox"
              >
                <XCircle size={20} />
              </button>

              <div className="w-full border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gold font-display">{expandedImage.title}</h3>
                  <p className="text-[10px] text-white/40 mt-1">Credentials Verification View</p>
                </div>
              </div>

              <div className="w-full flex items-center justify-center max-h-[70vh] overflow-auto custom-scrollbar p-2">
                <img
                  src={expandedImage.src}
                  alt={expandedImage.title}
                  className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain border border-white/10 shadow-lg shadow-black/80"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
</div>
  );
}
