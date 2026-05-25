import { useEffect, useState, useRef, useCallback } from 'react';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface InactivityConfig {
  timeoutMs: number; // Time until logout
  warningMs: number; // Time until warning modal shows
  enabled?: boolean; // Whether the timeout is active
}

export const useInactivityTimeout = (config: InactivityConfig) => {
  const [showWarning, setShowWarning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const { timeoutMs, warningMs, enabled = true } = config;

  const resetTimer = useCallback(() => {
    if (!enabled) return;
    
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    setShowWarning(false);
    
    timerRef.current = setTimeout(() => {
      setShowWarning(true);
      startCountdown();
    }, timeoutMs - warningMs);
  }, [timeoutMs, warningMs, enabled]);

  const startCountdown = useCallback(() => {
    let secondsLeft = warningMs / 1000;
    setTimeLeft(secondsLeft);
    
    if (countdownRef.current) clearInterval(countdownRef.current);
    
    countdownRef.current = setInterval(() => {
      secondsLeft -= 1;
      setTimeLeft(secondsLeft);
      
      if (secondsLeft <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        logoutUser();
      }
    }, 1000);
  }, [warningMs]);

  const logoutUser = async () => {
    try {
      await signOut(auth);
      window.location.href = '/login?reason=session_expired';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setShowWarning(false);
      return;
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'mousemove'];
    
    // Throttle activity resets to once every 2 seconds
    let lastReset = Date.now();
    const activityHandler = () => {
      const now = Date.now();
      if (!showWarning && now - lastReset > 2000) {
        lastReset = now;
        resetTimer();
      }
    };

    events.forEach(event => window.addEventListener(event, activityHandler));
    
    // Initial setup
    resetTimer();

    return () => {
      events.forEach(event => window.removeEventListener(event, activityHandler));
    };
  }, [resetTimer, showWarning, enabled]);

  // Handle cleanup separately to ensure refs are cleared on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  return { showWarning, timeLeft, resetTimer };
};
