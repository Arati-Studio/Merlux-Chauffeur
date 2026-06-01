import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { CheckCircle, Loader2, Home, Calendar, Star } from 'lucide-react';
import SEO from '../components/SEO';
import { smsService } from '../services/smsService';
import { emailService } from '../services/emailService';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDoc, doc, setDoc, onSnapshot, updateDoc } from 'firebase/firestore';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const bookingIdParam = searchParams.get('booking_id');
  const method = searchParams.get('method');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const navigate = useNavigate();

  // Feedback/Rating States
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [bookingDoc, setBookingDoc] = useState<any>(null);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);

  // Live snapshot listener for booking document details
  useEffect(() => {
    if (!bookingId) return;
    const unsub = onSnapshot(doc(db, "bookings", bookingId), (snap) => {
      if (snap.exists()) {
        setBookingDoc({ id: snap.id, ...snap.data() });
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `bookings/${bookingId}`);
    });
    return () => unsub();
  }, [bookingId]);

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
  }, [sessionId, bookingIdParam]);

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0 || !bookingId) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const bookingRef = doc(db, 'bookings', bookingId);
      await updateDoc(bookingRef, {
        rating,
        feedback: comment,
        ratingAt: serverTimestamp()
      });

      // Submit feedback also Notify via Email
      try {
        const updatedBookingData = {
          id: bookingId,
          ...bookingDoc,
          rating,
          feedback: comment,
          ratingValue: rating,
          ratingComment: comment
        };
        await emailService.notify('booking_feedback', updatedBookingData);
      } catch (notifyErr) {
        console.error('Error sending feedback email notification:', notifyErr);
      }

      setComment("");
      setRating(0);
    } catch (err: any) {
      console.error('Feedback Submission Error:', err);
      setSubmitError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
          className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all pointer-events-auto cursor-pointer"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isRatingVisible = bookingDoc?.status === 'completed' || searchParams.get('rate') === 'true' || showFeedbackForm;
  const hasSubmittedFeedback = !!(bookingDoc?.rating || bookingDoc?.feedback);

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
        className="w-full max-w-xl space-y-8"
      >
        <div>
          <h1 className="text-4xl font-display mb-4">Booking Confirmed</h1>
          <p className="text-white/60 mb-8 max-w-md mx-auto">
            {method === 'cash' 
              ? 'Your booking has been received. Please pay the driver in cash upon pickup.' 
              : 'Your payment was successful and your chauffeur has been reserved.'} 
            A confirmation email has been sent to you.
          </p>
        </div>

        {/* Feedback / Rating Section if completed */}
        {isRatingVisible && (
          <motion.div 
            id="feedback-form-container"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-md mx-auto p-6 md:p-8 bg-[#080808]/90 backdrop-blur-xl border border-white/[0.08] hover:border-gold/30 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden transition-all duration-500"
          >
            {/* Subtle elegant top line accent */}
            <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-gold/40 to-transparent"></div>
            
            {hasSubmittedFeedback ? (
              <div className="text-center space-y-4 animate-fade-in">
                <div className="w-12 h-12 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Star className="text-gold fill-gold" size={24} />
                </div>
                <h3 className="text-lg font-display text-white">Feedback Submitted</h3>
                <p className="text-white/60 text-xs leading-relaxed max-w-xs mx-auto">
                  Thank you for rating your journey! Your feedback is highly appreciated.
                </p>
                <div className="inline-flex gap-1.5 justify-center py-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={`value-star-${star}`}
                      size={18}
                      className={star <= (bookingDoc?.rating || 0) ? "text-gold fill-gold" : "text-white/10"}
                    />
                  ))}
                </div>
                {bookingDoc?.feedback && (
                  <p className="text-white/70 italic text-xs py-2 px-4 bg-white/5 rounded-xl border border-white/5 max-w-xs mx-auto">
                    "{bookingDoc.feedback}"
                  </p>
                )}
              </div>
            ) : (
              <form onSubmit={handleFeedbackSubmit} className="text-left space-y-5">
                <div className="text-center">
                  <h3 className="text-lg font-display text-white mb-2">Rate Your Journey</h3>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                    Booking Reference #{bookingDoc?.id ? bookingDoc.id.substring(0, 8) : (bookingId ? bookingId.substring(0, 8) : '')}
                  </p>
                </div>

                {/* Stars Selection */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-[10px] uppercase tracking-widest text-gold/60 font-bold block">
                    Overall Experience
                  </span>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={`feedback-star-${star}`}
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-transform hover:scale-125 focus:outline-none p-1 cursor-pointer"
                      >
                        <Star
                          size={28}
                          className={(hoverRating || rating) >= star ? "text-gold fill-gold" : "text-white/10"}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comments Textarea */}
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-[0.18em] text-gold/60 font-bold block">
                    Your Comments
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Tell us about your chauffeur, car condition, and timing..."
                    className="w-full bg-black/50 border border-white/10 focus:border-gold rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:ring-0 resize-none h-24 transition-colors"
                  />
                </div>

                {submitError && (
                  <p className="text-red-500 text-xs text-center font-mono">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || rating === 0}
                  className="w-full bg-gold disabled:bg-gold/20 disabled:text-black/40 text-black py-3.5 rounded-xl text-xs font-black uppercase tracking-[0.2em] hover:bg-[#F2D06B] transition-all cursor-pointer shadow-[0_10px_20px_rgba(212,175,55,0.15)] hover:shadow-[0_15px_30px_rgba(212,175,55,0.3)] duration-300 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      SUBMITTING...
                    </>
                  ) : (
                    "Submit Feedback"
                  )}
                </button>
              </form>
            )}
          </motion.div>
        )}
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button 
            onClick={() => navigate('/app')}
            className="bg-gold text-black px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Calendar size={16} />
            View My Bookings
          </button>
          {!isRatingVisible && !hasSubmittedFeedback && (
            <button 
              onClick={() => {
                setShowFeedbackForm(true);
                setTimeout(() => {
                  const element = document.getElementById('feedback-form-container');
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }, 100);
              }}
              className="bg-gold/10 border border-gold/35 text-gold px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-gold hover:text-black transition-all flex items-center justify-center gap-2 cursor-pointer duration-300"
            >
              <Star size={16} className="fill-current" />
              Rate Now
            </button>
          )}
          <button 
            onClick={() => navigate('/')}
            className="bg-white/5 border border-white/10 text-white px-8 py-4 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home size={16} />
            Back to Home
          </button>
        </div>
      </motion.div>
    </div>
  );
}
