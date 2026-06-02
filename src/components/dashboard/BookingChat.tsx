import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Send, MessageSquare, Clock, User, Shield, Car, Loader2, Check, CheckCheck } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import {
  collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, writeBatch, getDocs, deleteDoc
} from 'firebase/firestore';
import { Trash2, X } from 'lucide-react';

interface BookingChatProps {
  bookingId: string;
  user: any;
  userProfile: any;
  isAdmin?: boolean;
  showDashboardNotice?: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
}

interface ChatMessage {
  id: string;
  bookingId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'driver' | 'admin';
  message: string;
  createdAt: any;
}

const BookingChat: React.FC<BookingChatProps> = ({ 
  bookingId, 
  user, 
  userProfile, 
  isAdmin: isAdminProp, 
  showDashboardNotice 
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [othersTyping, setOthersTyping] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const isAdmin = isAdminProp || 
                  userProfile?.role === 'admin' || 
                  user?.email === 'aratistudioweb@gmail.com' || 
                  user?.email === 'keliztan20@gmail.com';

  // Subscribe to booking document for live indicators
  useEffect(() => {
    if (!bookingId) return;

    const unsubscribe = onSnapshot(
      doc(db, 'bookings', bookingId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setBooking({ id: snapshot.id, ...data });

          // Check for others typing
          const typingMap = data.typingStatus || {};
          const activeOthers: string[] = [];
          const now = Date.now();
          
          Object.entries(typingMap).forEach(([uid, timestamp]: [string, any]) => {
            if (uid === user?.uid) return;
            const time = timestamp?.toMillis ? timestamp.toMillis() : new Date(timestamp).getTime();
            // If typing update was in the last 4 seconds, consider them active
            if (now - time < 4000) {
              const name = data.typingNames?.[uid] || 'Someone';
              activeOthers.push(name);
            }
          });
          setOthersTyping(activeOthers);
        }
      },
      (error) => {
        console.error('Error listening to booking status:', error);
      }
    );

    return () => unsubscribe();
  }, [bookingId, user?.uid]);

  // Handle typing state updates
  const handleTyping = () => {
    if (!bookingId || !user) return;
    
    if (!isTyping) {
      setIsTyping(true);
      updateTypingStatus(true);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      updateTypingStatus(false);
    }, 3000);
  };

  const updateTypingStatus = async (typing: boolean) => {
    try {
      const docRef = doc(db, 'bookings', bookingId);
      const typingStatusKey = `typingStatus.${user.uid}`;
      const typingNameKey = `typingNames.${user.uid}`;
      
      await updateDoc(docRef, {
        [typingStatusKey]: typing ? serverTimestamp() : null,
        [typingNameKey]: typing ? (userProfile.name || 'User') : null
      });
    } catch (err) {
      // Quiet fail for typing status
    }
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!bookingId) return;

    setLoading(true);
    const q = query(
      collection(db, 'booking-chats'),
      where('bookingId', '==', bookingId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        const now = Date.now();
        const isAdminCheck = userProfile?.role === 'admin' || user?.email === 'aratistudioweb@gmail.com';
    
    snapshot.forEach((doc) => {
          const data = doc.data();
          const createdAtDate = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)) : new Date();
          
          // Apply 15-day filtering for non-admins if ride is completed
          const finishedAt = booking?.completedAt || booking?.updatedAt;
          if (!isAdminCheck && booking?.status === 'completed' && finishedAt) {
            const completedTime = finishedAt.toDate ? finishedAt.toDate().getTime() : new Date(finishedAt).getTime();
            const daysSinceCompletion = (now - completedTime) / (1000 * 60 * 60 * 24);
            if (daysSinceCompletion > 15) return; // Skip old messages
          }

          msgs.push({
            id: doc.id,
            bookingId: data.bookingId,
            senderId: data.senderId,
            senderName: data.senderName,
            senderRole: data.senderRole,
            message: data.message,
            createdAt: data.createdAt,
          });
        });
        setMessages(msgs);
        setLoading(false);
        // Scroll to bottom
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      (error) => {
        console.error('Error fetching chat messages:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [bookingId, booking?.status, booking?.completedAt, userProfile?.role, user?.email]);

  // Mark chat presence / last-seen whenever there are new messages or on mount
  useEffect(() => {
    if (!bookingId || !userProfile || !user) return;

    const role = userProfile.role || 'customer';
    const docRef = doc(db, 'bookings', bookingId);

    const updatePresence = async () => {
      try {
        if (role === 'driver') {
          await updateDoc(docRef, { lastSeenDriver: serverTimestamp() });
        } else if (role === 'admin') {
          await updateDoc(docRef, { lastSeenAdmin: serverTimestamp() });
        } else {
          await updateDoc(docRef, { lastSeenCustomer: serverTimestamp() });
        }
      } catch (err) {
        console.error('Failed to update presence timestamp:', err);
      }
    };

    updatePresence();
  }, [bookingId, messages.length, userProfile, user]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !user || !userProfile) return;

    setSending(true);
    const msgData = {
      bookingId,
      senderId: user.uid,
      senderName: userProfile.name || 'Anonymous',
      senderRole: userProfile.role || 'customer',
      message: newMessage.trim(),
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'booking-chats'), msgData);
      setNewMessage('');
    } catch (err) {
      console.error('Failed to send message:', err);
      try {
        handleFirestoreError(err, OperationType.CREATE, `booking-chats`);
      } catch (e) {
        // Suppress or handle appropriately
      }
    } finally {
      setSending(false);
    }
  };

  const handleSendQuickReply = async (replyText: string) => {
    if (sending || !user || !userProfile) return;

    setSending(true);
    const msgData = {
      bookingId,
      senderId: user.uid,
      senderName: userProfile.name || 'Anonymous',
      senderRole: userProfile.role || 'customer',
      message: replyText,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'booking-chats'), msgData);
    } catch (err) {
      console.error('Failed to send quick reply:', err);
    } finally {
      setSending(false);
    }
  };

  const handleClearChat = async () => {
    // Re-verify role precisely as per user intent with all available checks
    const isActuallyAdmin = isAdminProp ||
                            isAdmin ||
                            (userProfile?.role === 'admin') || 
                            (user?.email === 'aratistudioweb@gmail.com') || 
                            (user?.email === 'keliztan20@gmail.com');

    if (!isActuallyAdmin) {
      if (showDashboardNotice) showDashboardNotice('error', 'Administrative access strictly required for transmission purge.', 'Security Alert');
      return;
    }

    if (!window.confirm('PROTOCOL: Wipe ALL coordination messages for this booking? This is absolute and irreversible.')) return;
    
    setLoading(true);
    try {
      // 1. Precise Query for ALL records belonging to this booking
      // We'll attempt a fresh fetch but fallback to existing state if needed
      const chatRef = collection(db, 'booking-chats');
      const q = query(chatRef, where('bookingId', '==', bookingId));
      let docRefs: any[] = [];
      
      try {
        const snap = await getDocs(q);
        docRefs = snap.docs.map(d => d.ref);
      } catch (qErr) {
        console.warn('Direct query failed, falling back to loaded state IDs:', qErr);
        // Fallback: Delete what's currently in the messages list if query fails
        docRefs = messages.map(m => doc(db, 'booking-chats', m.id));
      }
      
      if (docRefs.length === 0) {
        if (showDashboardNotice) showDashboardNotice('info', 'Secure channel is already empty or no records found.', 'Audit Sync');
        setLoading(false);
        return;
      }

      const totalRemoved = docRefs.length;
      console.log(`Initiating purge of ${totalRemoved} message records for booking: ${bookingId}`);
      
      // Batch deletion in chunks of 450 (Firestore limit is 500)
      for (let i = 0; i < docRefs.length; i += 450) {
        const batch = writeBatch(db);
        const chunk = docRefs.slice(i, i + 450);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      
      console.log('Purge successful');
      if (showDashboardNotice) {
        showDashboardNotice('success', `Transmission history wiped. ${totalRemoved} records purged successfully.`, 'Purge Complete');
      }
    } catch (err: any) {
      console.error('Purge Operation Failure:', err);
      if (showDashboardNotice) {
        showDashboardNotice('error', `Purge Failed: ${err.message || 'Operation failed. Please check permissions.'}`, 'Security Error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Only admins should trigger this though UI guards it too
    if (!isAdmin) return;
    
    try {
      await deleteDoc(doc(db, 'booking-chats', messageId));
      if (showDashboardNotice) showDashboardNotice('success', 'Message removed from history.', 'Chat Admin');
    } catch (err: any) {
      console.error('Failed to delete message:', err);
      if (showDashboardNotice) showDashboardNotice('error', `Could not remove message: ${err.message}`, 'Error');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 bg-red-500/15 text-red-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em] border border-red-500/25">
            <Shield size={10} />
            Support
          </span>
        );
      case 'driver':
        return (
          <span className="inline-flex items-center gap-1 bg-gold/15 text-gold text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em] border border-gold/25">
            <Car size={10} />
            Chauffeur
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-[0.1em] border border-blue-500/25">
            <User size={10} />
            Customer
          </span>
        );
    }
  };

  const formatMessageTime = (createdAt: any) => {
    if (!createdAt) return 'Sending...';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  // Compute modern read status indicators in real time
  const getReadStatus = (msg: ChatMessage) => {
    if (!msg.createdAt || !booking) return { label: 'Sent', icon: <Check size={10} className="text-white/30" /> };
    const msgTime = msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : new Date(msg.createdAt).getTime();

    if (msg.senderId !== user?.uid) {
      return null; // Don't show read status for messages sent by others to avoid clutter
    }

    // Customer messages
    if (msg.senderRole === 'customer') {
      if (booking.lastSeenDriver) {
        const driverTime = booking.lastSeenDriver.toDate ? booking.lastSeenDriver.toDate().getTime() : new Date(booking.lastSeenDriver).getTime();
        if (driverTime >= msgTime) {
          return { label: 'Read by chauffeur', icon: <CheckCheck size={10} className="text-gold" /> };
        }
      }
      return { label: 'Delivered', icon: <Check size={10} className="text-white/40" /> };
    }

    // Driver messages
    if (msg.senderRole === 'driver') {
      if (booking.lastSeenCustomer) {
        const customerTime = booking.lastSeenCustomer.toDate ? booking.lastSeenCustomer.toDate().getTime() : new Date(booking.lastSeenCustomer).getTime();
        if (customerTime >= msgTime) {
          return { label: 'Read by Customer', icon: <CheckCheck size={10} className="text-gold" /> };
        }
      }
      return { label: 'Delivered', icon: <Check size={10} className="text-white/40" /> };
    }

    // Admin / Support messages
    if (msg.senderRole === 'admin') {
      const readers: string[] = [];
      if (booking.lastSeenCustomer) {
        const customerTime = booking.lastSeenCustomer.toDate ? booking.lastSeenCustomer.toDate().getTime() : new Date(booking.lastSeenCustomer).getTime();
        if (customerTime >= msgTime) readers.push('Customer');
      }
      if (booking.lastSeenDriver) {
        const driverTime = booking.lastSeenDriver.toDate ? booking.lastSeenDriver.toDate().getTime() : new Date(booking.lastSeenDriver).getTime();
        if (driverTime >= msgTime) readers.push('Chauffeur');
      }

      if (readers.length > 0) {
        return { label: `Read by ${readers.join(' & ')}`, icon: <CheckCheck size={10} className="text-gold" /> };
      }
      return { label: 'Delivered', icon: <Check size={10} className="text-white/40" /> };
    }

    return { label: 'Sent', icon: <Check size={10} className="text-white/30" /> };
  };

  const getQuickReplies = () => {
    const role = userProfile?.role || 'customer';
    if (role === 'driver') {
      return [
        'On my way 🚗',
        'Here at pickup 📍',
        'Stuck in traffic 🚥',
        'Arriving shortly ⏱️',
        'Waiting at airport arrivals 👋'
      ];
    } else if (role === 'admin') {
      return [
        'Dispatcher looking into this 🔍',
        'Your chauffeur is on the way 🚗',
        'Confirmed with operator ✅',
        'Calling the vehicle now ⏱_'
      ];
    } else {
      return [
        'I am ready! 👍',
        'Be there in 5 mins ⏱️',
        'At the pickup location 📍',
        'Looking for you 👋',
        'Thank you so much! 🙏'
      ];
    }
  };

  return (
    <div className="flex flex-col h-[400px] sm:h-[480px] bg-[#050505] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl relative overflow-hidden transition-all duration-300">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/[0.06] bg-[#0a0a0a] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
            <MessageSquare size={16} />
          </div>
          <div>
            <h4 className="text-xs font-display font-medium text-white tracking-wide">Live Trip Coordinator</h4>
            <p className="text-[10px] text-white/40">Secure workspace messenger</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-green-500/10 text-green-400 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-green-500/20">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Active
        </div>
        {isAdmin && (
          <button 
            onClick={handleClearChat}
            className="ml-2 w-7 h-7 flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all cursor-pointer"
            title="Clear Chat History (Admin Only)"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Messages Pane */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar bg-gradient-to-b from-transparent to-[#020202]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-white/40">
            <Loader2 size={24} className="animate-spin text-gold" />
            <span className="text-[10px] uppercase tracking-widest font-bold">Synchronizing...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white/30 text-center px-6">
            <div className="w-12 h-12 bg-white/[0.02] border border-white/[0.06] rounded-full flex items-center justify-center text-white/20">
              <MessageSquare size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-white/60 mb-0.5">No Messages Yet</p>
              <p className="text-[10px] text-white/30 max-w-[240px]">
                Initiate coordination regarding routing, timing, or special instructions.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => {
              const isMe = msg.senderId === user?.uid;
              const statusInfo = getReadStatus(msg);
              return (
                <motion.div
                  key={msg.id || idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  {/* Sender title */}
                  <div className={`flex items-center gap-1.5 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[10px] font-bold text-white/70">{msg.senderName}</span>
                    {getRoleBadge(msg.senderRole)}
                  </div>

                  {/* Message bubble container with potential delete button */}
                  <div className={`relative group max-w-[85%] sm:max-w-[75%] ${isMe ? 'flex flex-row-reverse items-start' : 'flex items-start'}`}>
                    <div className={`rounded-2xl px-4 py-2.5 text-xs font-sans leading-relaxed break-words shadow-sm relative transition-all duration-300 ${
                      isMe
                        ? 'bg-gradient-to-br from-gold/90 to-gold/75 text-black font-semibold rounded-tr-sm'
                        : 'bg-white/5 border border-white/[0.06] text-white rounded-tl-sm hover:border-gold/20'
                    }`}>
                      {msg.message}
                    </div>
                    
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className={`opacity-70 group-hover:opacity-100 p-1.5 text-red-500/50 hover:text-red-500 transition-all cursor-pointer ${isMe ? 'mr-1' : 'ml-1'}`}
                        title="Delete message"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Message time and read status */}
                  <div className={`flex items-center gap-2 text-[8px] text-white/30 font-bold mt-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <span className="flex items-center gap-0.5">
                      <Clock size={8} />
                      {formatMessageTime(msg.createdAt)}
                    </span>
                    {isMe && statusInfo && (
                      <span className="flex items-center gap-0.5">
                        {statusInfo.icon}
                        <span className="opacity-75">{statusInfo.label}</span>
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
        
        {/* Typing Indicator */}
        {othersTyping.length > 0 && (
          <div className="flex items-center gap-1.5 px-4 py-1.5 text-[9px] text-gold animate-pulse">
            <div className="flex gap-0.5">
              <span className="w-0.5 h-0.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-0.5 h-0.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-0.5 h-0.5 bg-gold rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="font-bold opacity-80">{othersTyping.join(', ')} {othersTyping.length === 1 ? 'is' : 'are'} typing...</span>
          </div>
        )}
      </div>

      {/* Quick Replies chips above form */}
      <div className="px-3 pt-2 pb-1 bg-[#070707] border-t border-white/[0.04] shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 custom-scrollbar invisible-scrollbar">
          {getQuickReplies().map((reply, ridx) => (
            <button
              key={`quick-reply-${ridx}`}
              type="button"
              onClick={() => handleSendQuickReply(reply)}
              disabled={sending || loading}
              className="shrink-0 bg-white/[0.03] hover:bg-gold/15 border border-white/[0.06] hover:border-gold/45 text-white/80 hover:text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wide transition-all cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
            >
              {reply}
            </button>
          ))}
        </div>
      </div>

      {/* Inputs Form */}
      <form onSubmit={handleSendMessage} className="p-3 border-t border-white/[0.06] bg-[#080808] flex items-center gap-2 shrink-0">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          placeholder="Compose secure transmission..."
          className="flex-1 bg-black border border-white/[0.06] focus:border-gold rounded-full px-4 py-2.5 text-xs text-white placeholder-white/20 outline-none transition-all"
          maxLength={2000}
          disabled={sending || loading}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending || loading}
          className="w-9 h-9 rounded-full bg-gold disabled:bg-white/5 text-black disabled:text-white/20 hover:bg-gold-light flex items-center justify-center shrink-0 cursor-pointer disabled:cursor-not-allowed transition-all"
        >
          {sending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </button>
      </form>
    </div>
  );
};

export default BookingChat;
