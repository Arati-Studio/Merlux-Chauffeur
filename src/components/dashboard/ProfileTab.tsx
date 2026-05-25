import React, { useEffect, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  Shield, Car, User, Loader2, Save
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';

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

  const currentProfile = localProfile || globalUserProfile;

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl sm:text-2xl font-display text-gold">Profile Settings</h3>
          <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage your account and security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1 border border-white/5 rounded-3xl overflow-hidden bg-white/5 h-fit">
          <div className={cn(
            "h-24 relative",
            currentProfile?.role === 'admin' ? "bg-red-500/20" :
            currentProfile?.role === 'driver' ? "bg-blue-500/20" : "bg-gold/20"
          )}>
            {/* Decorative background element */}
            <div className="absolute top-0 right-0 p-4 opacity-10">
              {currentProfile?.role === 'admin' ? <Shield size={80} /> :
              currentProfile?.role === 'driver' ? <Car size={80} /> : <User size={80} />}
            </div>
          </div>
          <div className="px-6 pb-6 -mt-10 relative">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center border-4 border-black mb-4",
              currentProfile?.role === 'admin' ? "bg-red-500 text-white" :
              currentProfile?.role === 'driver' ? "bg-blue-500 text-white" : "bg-gold text-black"
            )}>
              {currentProfile?.role === 'admin' ? <Shield size={32} /> :
              currentProfile?.role === 'driver' ? <Car size={32} /> : <User size={32} />}
            </div>
            <h4 className="text-lg font-bold text-white">{currentProfile?.name || 'User'}</h4>
            <p className="text-xs text-white/40 mb-4">{user?.email}</p>
 
            <div className="flex flex-wrap gap-2">
              <span className={cn(
                "text-[10px] uppercase font-bold px-3 py-1 rounded-full",
                currentProfile?.role === 'admin' ? "bg-red-500/10 text-red-500" :
                currentProfile?.role === 'driver' ? "bg-blue-500/10 text-blue-500" : "bg-gold/10 text-gold"
              )}>
                {currentProfile?.role}
              </span>
              <span className="text-[10px] bg-white/5 text-white/40 px-3 py-1 rounded-full uppercase font-bold">
                Account Verified
              </span>
            </div>
          </div>
        </div>

        {/* Settings Forms */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass p-8 rounded-3xl border border-white/5">
            <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6">Personal Details</h4>
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

          <div className="glass p-8 rounded-3xl border border-white/5">
            <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6">Security</h4>
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
              <p className="text-[10px] text-white/20 italic">
                Leave password fields blank if you don't want to change your password.
              </p>
            </div>
          </div>

          <button
            onClick={handleUpdateProfile}
            disabled={isUpdatingProfile}
            className="w-full bg-gold text-black py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
