import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Shield, Car, User, Loader2, Save, Mail
} from 'lucide-react';
import { db, auth } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { verifyBeforeUpdateEmail } from 'firebase/auth';

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

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (snap.exists()) {
        const data = snap.id ? { id: snap.id, ...snap.data() } : snap.data();
        setLocalProfile(data);
        if (data.name) setProfileName(data.name);
        if (data.phone) setProfilePhone(data.phone);
        if (data.address) setProfileAddress(data.address);
      }
    });
    return () => unsub();
  }, [user?.uid]);

  const handleUpdateProfile = async () => {
    if (!user?.uid) return;
    
    if (newPassword && newPassword !== confirmPassword) {
      showDashboardNotice('error', 'Passwords do not match');
      return;
    }

    setIsUpdatingProfile(true);
    try {
      const updateData: any = {
        name: profileName,
        phone: profilePhone,
        address: profileAddress,
        updatedAt: serverTimestamp()
      };

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

  const currentProfile = localProfile || globalUserProfile;

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
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6">
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
    </div>
  </div>
</div>
  );
}
