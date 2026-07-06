import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { 
  Send, List, Calendar, Plus, RefreshCw, AlertCircle, 
  CheckCircle, Loader2, PlayCircle, Users, BellRing, Eye
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from 'react-hot-toast';

interface Campaign {
  id?: string;
  title: string;
  message: string;
  image?: string;
  url?: string;
  status: 'draft' | 'sent';
  sentAt?: any;
  createdAt: any;
}

export default function CampaignsTab({ showDashboardNotice }: any) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSubscribers, setTotalSubscribers] = useState(0);

  // Form state
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [image, setImage] = useState('');
  const [url, setUrl] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Fetch campaign histories and subscriber count
  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch campaigns
      const q = query(collection(db, 'campaigns'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const list: Campaign[] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Campaign));
      setCampaigns(list);

      // 2. Fetch FCM subscriber count via backend API to avoid client-side permission issues
      try {
        const countRes = await fetch('/api/campaigns/count');
        if (countRes.ok) {
          const countData = await countRes.json();
          setTotalSubscribers(countData.count || 0);
        } else {
          setTotalSubscribers(0);
        }
      } catch (countErr) {
        console.warn('Failed to fetch subscriber count via API:', countErr);
        setTotalSubscribers(0);
      }
    } catch (err: any) {
      console.error('[CampaignsTab] Error fetching campaigns:', err);
      toast.error('Failed to load campaigns data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSendCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required.');
      return;
    }

    setIsSending(true);
    try {
      // Save campaign draft to Firestore first
      const docRef = await addDoc(collection(db, 'campaigns'), {
        title: title.trim(),
        message: message.trim(),
        image: image.trim() || null,
        url: url.trim() || '/dashboard',
        status: 'draft',
        createdAt: serverTimestamp()
      });

      // Dispatch Push notification to FCM via backend route
      const response = await fetch('/api/campaigns/push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          image: image.trim() || null,
          url: url.trim() || '/dashboard'
        })
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Update campaign status to sent in Firestore
        await updateDoc(doc(db, 'campaigns', docRef.id), {
          status: 'sent',
          sentAt: serverTimestamp()
        });

        toast.success(result.message || 'Campaign sent successfully!');
        
        // Reset form fields
        setTitle('');
        setMessage('');
        setImage('');
        setUrl('');
        
        // Refresh histories
        await fetchData();
      } else {
        throw new Error(result.error || 'Server rejected campaign push dispatch.');
      }
    } catch (err: any) {
      console.error('[CampaignsTab] Push Campaign error:', err);
      toast.error(err.message || 'Failed to dispatch push campaign.');
    } finally {
      setIsSending(false);
    }
  };

  const formatTimestamp = (ts: any) => {
    if (!ts) return 'N/A';
    try {
      if (ts.toDate && typeof ts.toDate === 'function') {
        return ts.toDate().toLocaleString();
      }
      return new Date(ts).toLocaleString();
    } catch (e) {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-8">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="glass border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <Users size={80} className="text-gold" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Total Registered Devices</p>
            <h4 className="text-3xl font-display font-bold text-gold">{totalSubscribers}</h4>
            <p className="text-[10px] text-white/30">Active FCM service worker tokens</p>
          </div>
        </div>

        <div className="glass border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <BellRing size={80} className="text-gold" />
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Total Campaigns Sent</p>
            <h4 className="text-3xl font-display font-bold text-white">
              {campaigns.filter(c => c.status === 'sent').length}
            </h4>
            <p className="text-[10px] text-white/30">Delivered broadcast campaigns</p>
          </div>
        </div>

        <div className="glass border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <PlayCircle size={80} className="text-gold" />
          </div>
          <div className="space-y-1 flex flex-col justify-between h-full">
            <div>
              <p className="text-[10px] uppercase font-bold tracking-widest text-white/40">Real-time Delivery</p>
              <h4 className="text-xs font-bold text-green-400 mt-2 flex items-center gap-1.5 uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping inline-block" />
                FCM Delivery Engine Active
              </h4>
            </div>
            <button 
              onClick={fetchData}
              className="text-[10px] text-gold/80 hover:text-gold uppercase font-extrabold tracking-wider flex items-center gap-1.5 transition-colors self-start mt-4"
            >
              <RefreshCw size={10} className={cn(loading && "animate-spin")} />
              Sync Statistics
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form panel */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h4 className="text-sm font-bold text-gold uppercase tracking-widest">Create New Campaign</h4>
              <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Draft and publish instant notifications</p>
            </div>

            <form onSubmit={handleSendCampaign} className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Campaign Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Premium Airport Transfers Deal!"
                  className="w-full bg-[#030303] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-gold transition-all text-white placeholder:text-white/20 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Message / Announcement *</label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. Book luxury corporate transport this weekend and receive a complimentary premium champagne upgrade on us!"
                  className="w-full bg-[#030303] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-gold transition-all text-white placeholder:text-white/20 leading-relaxed font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Featured Image URL (Optional)</label>
                <input
                  type="url"
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="e.g. https://merlux.au/images/promo.jpg"
                  className="w-full bg-[#030303] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-gold transition-all text-white placeholder:text-white/20 font-semibold"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1.5 block">Redirect Action Link (Optional)</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="e.g. /offers/corporate-weekend-deal"
                  className="w-full bg-[#030303] border border-white/10 rounded-xl px-4 py-3 text-xs outline-none focus:border-gold transition-all text-white placeholder:text-white/20 font-semibold"
                />
              </div>

              <div className="p-3 bg-white/5 rounded-2xl border border-white/5 flex items-start gap-2.5">
                <AlertCircle size={14} className="text-gold shrink-0 mt-0.5" />
                <p className="text-[9px] text-white/40 leading-normal uppercase font-black tracking-wider">
                  Caution: Once dispatched, push notifications are sent instantly in the background to all registered devices. Double-check your spelling and URL.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSending || loading}
                className="w-full bg-gold text-black hover:bg-white transition-all py-3.5 rounded-xl font-bold text-xs uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Sending Push...</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Broadcast Campaign</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Histories panel */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass border border-white/5 rounded-3xl p-6 md:p-8 min-h-[450px] flex flex-col">
            <div className="border-b border-white/5 pb-4 mb-6 flex justify-between items-center">
              <div>
                <h4 className="text-sm font-bold text-gold uppercase tracking-widest">Campaign Histories</h4>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mt-1">Previous announcements & stats</p>
              </div>
              <button 
                onClick={fetchData} 
                disabled={loading}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg border border-white/5 text-white/60 hover:text-white transition-colors"
                title="Refresh Campaigns List"
              >
                <RefreshCw size={14} className={cn(loading && "animate-spin")} />
              </button>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={24} className="text-gold animate-spin" />
                <p className="text-xs text-white/30 uppercase tracking-widest font-bold">Synchronizing history database...</p>
              </div>
            ) : campaigns.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-20 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                <BellRing size={28} className="text-white/15 mb-3" />
                <p className="text-xs text-white/40 font-bold uppercase tracking-widest">No Campaigns Found</p>
                <p className="text-[10px] text-white/30 max-w-[280px] leading-relaxed mt-1">
                  You haven't initiated any push campaigns yet. Use the draft panel on the left to broadcast your first message.
                </p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar pr-1 flex-1">
                {campaigns.map((camp) => (
                  <div 
                    key={camp.id} 
                    className="p-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 rounded-2xl flex flex-col sm:flex-row items-stretch gap-4 transition-all"
                  >
                    {camp.image && (
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-white/5 shrink-0 bg-black flex items-center justify-center">
                        <img src={camp.image} alt={camp.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h5 className="text-xs font-bold text-white uppercase tracking-wider">{camp.title}</h5>
                          {camp.status === 'sent' ? (
                            <span className="text-[7px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Sent</span>
                          ) : (
                            <span className="text-[7px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-black uppercase tracking-widest">Draft</span>
                          )}
                        </div>
                        <p className="text-[11px] text-white/60 leading-relaxed font-semibold">{camp.message}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/5 pt-2 text-[8px] font-mono font-extrabold uppercase tracking-widest text-white/30">
                        <div className="flex items-center gap-1">
                          <Calendar size={10} className="text-gold" />
                          <span>Created: {formatTimestamp(camp.createdAt)}</span>
                        </div>
                        {camp.sentAt && (
                          <div className="flex items-center gap-1 text-green-400/70">
                            <Send size={10} />
                            <span>Pushed: {formatTimestamp(camp.sentAt)}</span>
                          </div>
                        )}
                        {camp.url && (
                          <div className="flex items-center gap-1 text-blue-400/70">
                            <Eye size={10} />
                            <span>Link: {camp.url}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
