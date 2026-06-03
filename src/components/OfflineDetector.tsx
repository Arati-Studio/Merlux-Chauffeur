import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { WifiOff, Wifi, RefreshCw, X } from "lucide-react";

export function OfflineDetector() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isChecking, setIsChecking] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Function to actually verify internet access by fetching a lightweight API or asset
  const verifyConnectivity = async (): Promise<boolean> => {
    setIsChecking(true);
    try {
      // Fetch with a short timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch("/api/health", {
        method: "GET",
        signal: controller.signal,
        cache: "no-store",
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return true;
      }
      return false;
    } catch (e) {
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      // Browser says online, let's verify actual internet access
      const hasActualAccess = await verifyConnectivity();
      if (hasActualAccess) {
        setIsOffline(false);
        setShowRestored(true);
        setDismissed(false);
        // Hide restored notification after 4 seconds
        const timer = setTimeout(() => {
          setShowRestored(false);
        }, 4000);
        return () => clearTimeout(timer);
      } else {
        setIsOffline(true);
      }
    };

    const handleOffline = () => {
      setIsOffline(true);
      setShowRestored(false);
      setDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check in case of ambiguity
    if (navigator.onLine) {
      verifyConnectivity().then((online) => {
        setIsOffline(!online);
      });
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleManualCheck = async () => {
    const isOnlineNow = await verifyConnectivity();
    if (isOnlineNow) {
      setIsOffline(false);
      setShowRestored(true);
      setDismissed(false);
      setTimeout(() => {
        setShowRestored(false);
      }, 4000);
    } else {
      setIsOffline(true);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isOffline && !dismissed && (
          <motion.div
            id="offline-warning-card"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md px-4 pointer-events-auto"
          >
            <div className="glass bg-black/90 border border-gold/40 text-white rounded-2xl p-5 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              {/* Luxury Gold Accented Accent Bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-gold via-gold-light to-gold-dark animate-pulse" />

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                    <WifiOff size={20} className="animate-pulse" />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-sm uppercase tracking-[0.1em] text-white font-semibold">
                    No Internet Connection
                  </h3>
                  <p className="text-xs text-white/60 mt-1 leading-relaxed">
                    You are currently offline. Pages and forms requiring internet connectivity may not function properly.
                  </p>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      id="retry-connection-button"
                      onClick={handleManualCheck}
                      disabled={isChecking}
                      className="px-4 py-1.5 rounded-lg bg-gold text-black text-xs font-bold uppercase tracking-wider hover:bg-gold-light transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
                    >
                      {isChecking ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <RefreshCw size={13} />
                      )}
                      {isChecking ? "Checking..." : "Verify Connection"}
                    </button>
                    <button
                      id="dismiss-offline-button"
                      onClick={() => setDismissed(true)}
                      className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-gold/30 hover:text-gold text-white/50 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <button
                    id="close-offline-warning-btn"
                    onClick={() => setDismissed(true)}
                    className="p-1 rounded-lg text-white/40 hover:text-white/80 transition-all cursor-pointer"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRestored && (
          <motion.div
            id="online-restored-card"
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-sm px-4 pointer-events-auto"
          >
            <div className="glass bg-black/95 border border-emerald-500/50 text-white rounded-2xl p-4 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              {/* Green connection line */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Wifi size={16} />
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="font-display text-xs uppercase tracking-[0.1em] text-emerald-400 font-bold">
                    Connected Online
                  </h4>
                  <p className="text-[11px] text-white/60 mt-0.5">
                    Your connection has been restored successfully!
                  </p>
                </div>

                <button
                  id="close-restored-card-btn"
                  onClick={() => setShowRestored(false)}
                  className="p-1 text-white/40 hover:text-white/80 transition-all cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tiny Persistent Indicator for when dismissed but still offline */}
      <AnimatePresence>
        {isOffline && dismissed && (
          <motion.div
            id="offline-persistent-indicator"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-6 right-6 z-[9998] pointer-events-auto"
          >
            <button
              onClick={() => setDismissed(false)}
              className="glass bg-black/90 border border-gold/40 text-gold hover:text-gold-light hover:border-gold flex items-center gap-2 px-3 py-2 rounded-full shadow-lg transition-all active:scale-95 cursor-pointer text-xs uppercase font-bold tracking-wider"
              title="You are currently offline. Click to restore details."
            >
              <div className="w-2 h-2 rounded-full bg-gold animate-ping" />
              <WifiOff size={14} />
              <span>Offline</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
