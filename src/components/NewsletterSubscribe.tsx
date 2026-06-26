import React, { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

interface NewsletterSubscribeProps {
  className?: string;
}

export default function NewsletterSubscribe({ className }: NewsletterSubscribeProps) {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubscribe = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please provide a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Real durable persistence into 'subscribers' collection
      await addDoc(collection(db, 'subscribers'), {
        email: email.trim().toLowerCase(),
        subscribedAt: serverTimestamp(),
        source: 'newsletter_footer',
        status: 'active'
      });

      setSuccess(true);
      setEmail('');
    } catch (err: any) {
      console.error('Error saving subscriber email:', err);
      setError('An error occurred. Please try again later.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#0B0B0B] to-[#121212] border border-white/5 p-8 md:p-12", className)}>
      {/* Decorative ambient gold glow in the corner */}
      <div className="absolute -bottom-16 -right-16 w-48 h-48 bg-gold/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -top-16 -left-16 w-48 h-48 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gold/5 border border-gold/15 mb-6">
          <Sparkles size={12} className="text-gold animate-pulse" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-gold font-bold">Private Circle</span>
        </div>

        <h3 className="text-2xl md:text-3.5xl font-display mb-3 text-white leading-tight">
          Subscribe to <span className="text-gold italic">The Journal</span>
        </h3>
        <p className="text-white/50 text-xs md:text-sm mb-8 leading-relaxed max-w-md mx-auto">
          Receive exclusive travel advisories, custom itineraries, and privileged priority notifications from Merlux.
        </p>

        <AnimatePresence mode="wait">
          {!success ? (
            <motion.form
              key="subscribe-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              onSubmit={handleSubscribe}
              className="space-y-3"
            >
              <div className="relative flex flex-col sm:flex-row items-stretch gap-3">
                <div className="relative flex-1">
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError(null);
                    }}
                    required
                    disabled={isSubmitting}
                    className="w-full bg-black/60 border border-white/10 rounded-full py-4 px-6 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-gold/50 transition-all focus:ring-1 focus:ring-gold/30 font-sans"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gold hover:bg-white text-black font-bold uppercase tracking-widest text-[10px] px-8 py-4 sm:py-0 rounded-full transition-all duration-500 flex items-center justify-center gap-2 group shrink-0 cursor-pointer shadow-lg shadow-gold/10"
                >
                  {isSubmitting ? (
                    <Loader2 className="animate-spin" size={14} />
                  ) : (
                    <>
                      <span>Join</span>
                      <Send size={12} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>
              </div>

              {error && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-red-400 text-[10px] uppercase tracking-widest font-bold mt-2"
                >
                  {error}
                </motion.p>
              )}
            </motion.form>
          ) : (
            <motion.div
              key="subscribe-success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-4 text-center"
            >
              <div className="w-12 h-12 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={24} className="text-gold" />
              </div>
              <h4 className="text-lg font-display text-gold mb-1">Privileged Access Granted</h4>
              <p className="text-white/40 text-[11px] uppercase tracking-wider font-bold">
                You have joined our exclusive newsletter list.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-4 text-[10px] uppercase tracking-widest text-gold/60 hover:text-gold transition-colors font-bold"
              >
                Subscribe another email
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
