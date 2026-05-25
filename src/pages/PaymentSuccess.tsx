import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, Home, Calendar } from 'lucide-react';
import SEO from '../components/SEO';
import { smsService } from '../services/smsService';
import { emailService } from '../services/emailService';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDoc, doc, setDoc } from 'firebase/firestore';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingIdParam = searchParams.get('booking_id');
  const method = searchParams.get('method');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const finalizeBooking = async () => {
      // Handle Direct Booking IDs (e.g. Cash on Pickup or pre-created bookings)
      if (bookingIdParam) {
        setBookingId(bookingIdParam);
        setLoading(false);
        return;
      }

      if (!sessionId) {
        setError('No session ID found');
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch session from server
        const response = await fetch(`/api/checkout-session/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        
        const session = await response.json();
        
        if (session.payment_status === 'paid') {
          const bookingDataString = 
            (session.metadata.bookingDataChunk1 || '') + 
            (session.metadata.bookingDataChunk2 || '') + 
            (session.metadata.bookingDataChunk3 || '') + 
            (session.metadata.bookingDataChunk4 || '') || 
            session.metadata.bookingData || '{}';
          
          const bookingData = JSON.parse(bookingDataString);
          
          // Check if booking already exists for this session
          const docRef = doc(db, 'bookings', sessionId);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setBookingId(docSnap.id);
            setLoading(false);
            return;
          }
          
          // 2. Save to Firestore using sessionId as doc ID for idempotency
          const saveDocRef = doc(db, 'bookings', sessionId);
          await setDoc(saveDocRef, {
            ...bookingData,
            status: 'confirmed',
            paymentStatus: 'paid',
            stripeSessionId: sessionId,
            read: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          
          // Trigger Notifications
          smsService.notify("booking_created", { ...bookingData, id: sessionId, status: 'confirmed' });
          emailService.notify("booking_created", { ...bookingData, id: sessionId, status: 'confirmed' });

          setBookingId(sessionId);
        } else {
          setError('Payment was not successful');
        }
      } catch (err: any) {
        console.error('Finalization Error:', err);
        setError(err.message || 'Failed to finalize booking');
      } finally {
        setLoading(false);
      }
    };

    finalizeBooking();
  }, [sessionId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6">
        <Loader2 className="text-gold animate-spin mb-4" size={48} />
        <p className="text-white/60 uppercase tracking-widest text-sm">Finalizing your booking...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="text-red-500 rotate-180" size={40} />
        </div>
        <h1 className="text-3xl font-display mb-4">Something went wrong</h1>
        <p className="text-white/60 mb-8 max-w-md">{error}</p>
        <button 
          onClick={() => navigate('/booking')}
          className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
      <SEO 
        title="Booking Confirmed - Merlux"
        robots="noindex, nofollow"
      />
      <motion.div 
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mb-6"
      >
        <CheckCircle className="text-gold" size={40} />
      </motion.div>
      
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h1 className="text-4xl font-display mb-4">Booking Confirmed</h1>
        <p className="text-white/60 mb-8 max-w-md mx-auto">
          {method === 'cash' 
            ? 'Your booking has been received. Please pay the driver in cash upon pickup.' 
            : 'Your payment was successful and your chauffeur has been reserved.'} 
          A confirmation email has been sent to you.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => navigate('/app')}
            className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all flex items-center justify-center gap-2"
          >
            <Calendar size={16} />
            View My Bookings
          </button>
          <button 
            onClick={() => navigate('/')}
            className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2"
          >
            <Home size={16} />
            Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
