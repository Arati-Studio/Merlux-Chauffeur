import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';

interface ChatBadgeProps {
  bookingId: string;
  user: any;
  userProfile: any;
}

const ChatBadge: React.FC<ChatBadgeProps> = ({ bookingId, user, userProfile }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [lastSeenTime, setLastSeenTime] = useState<number>(0);

  // 1. Listen to booking last seen timestamp
  useEffect(() => {
    if (!bookingId || !userProfile) return;

    const role = userProfile.role || 'customer';
    const bookingRef = doc(db, 'bookings', bookingId);

    const unsubBooking = onSnapshot(bookingRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        let lastSeenVal = null;
        if (role === 'driver') {
          lastSeenVal = data.lastSeenDriver;
        } else if (role === 'admin') {
          lastSeenVal = data.lastSeenAdmin;
        } else {
          lastSeenVal = data.lastSeenCustomer;
        }

        if (lastSeenVal) {
          const epoch = lastSeenVal.toDate ? lastSeenVal.toDate().getTime() : new Date(lastSeenVal).getTime();
          setLastSeenTime(epoch);
        } else {
          setLastSeenTime(0);
        }
      }
    }, (err) => console.error("Error listening to booking for badge:", err));

    return () => unsubBooking();
  }, [bookingId, userProfile]);

  // 2. Listen to chats
  useEffect(() => {
    if (!bookingId) return;

    const chatsQuery = query(
      collection(db, 'booking-chats'),
      where('bookingId', '==', bookingId)
    );

    const unsubChats = onSnapshot(chatsQuery, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          senderId: data.senderId,
          createdAt: data.createdAt,
        });
      });
      setMessages(msgs);
    }, (err) => console.error("Error listening to chats for badge:", err));

    return () => unsubChats();
  }, [bookingId]);

  // Compute unread count reactively
  const unreadCount = messages.filter((msg) => {
    // Message sent by someone else
    if (msg.senderId === user?.uid) return false;

    let msgTime = 0;
    if (msg.createdAt) {
      msgTime = msg.createdAt.toDate ? msg.createdAt.toDate().getTime() : new Date(msg.createdAt).getTime();
    } else {
      // Local optimistic message
      msgTime = Date.now();
    }

    return msgTime > lastSeenTime;
  }).length;

  if (unreadCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-black shadow-[0_0_8px_rgba(220,38,38,0.6)] animate-pulse select-none z-10">
      {unreadCount}
    </span>
  );
};

export default ChatBadge;
