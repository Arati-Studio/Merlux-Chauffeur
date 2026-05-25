import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Loader2, AlertTriangle, Clock, LogOut } from 'lucide-react';
import { useInactivityTimeout } from '../lib/useInactivityTimeout';
import { motion, AnimatePresence } from 'motion/react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();
  const rememberMe = localStorage.getItem('rememberMe') === 'true';

  const { showWarning, timeLeft, resetTimer } = useInactivityTimeout({
    timeoutMs: 15 * 60 * 1000, // 15 minutes
    warningMs: 60 * 1000,      // 1 minute warning
    enabled: !rememberMe,      // Disable inactivity logout if "Remember Me" is checked
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setAuthenticated(!!user && user.emailVerified);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
        <p className="text-gold text-[10px] uppercase tracking-widest font-black">Verifying Session...</p>
      </div>
    );
  }

  if (!authenticated) {
    // Redirect to login but save the current location they were trying to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <>
      <AnimatePresence>
        {showWarning && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-2xl p-8 text-center space-y-6 shadow-2xl"
            >
              <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="text-gold animate-pulse" size={40} />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-display text-white">Session Expiring</h2>
                <p className="text-white/60 text-sm">
                  You've been inactive for a while. For your security, we'll log you out in:
                </p>
                <div className="text-3xl font-mono text-gold font-bold">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={resetTimer}
                  className="w-full bg-gold text-black py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-white transition-all transform active:scale-95"
                >
                  I'm Still Here
                </button>
                <button 
                  onClick={async () => {
                    await auth.signOut();
                    window.location.href = '/login';
                  }}
                  className="w-full bg-white/5 border border-white/10 text-white/40 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={14} />
                  Log Out Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
};

export default ProtectedRoute;
