import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';

interface SettingsContextType {
  settings: any;
  floatingSettings: any;
  loading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<any>(null);
  const [floatingSettings, setFloatingSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const settingsRef = doc(db, 'settings', 'system');
    const floatingRef = doc(db, 'settings', 'floating');

    const unsubscribeSystem = onSnapshot(settingsRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      }
    });

    const unsubscribeFloating = onSnapshot(floatingRef, (docSnap) => {
      if (docSnap.exists()) {
        setFloatingSettings(docSnap.data());
      }
      setLoading(false);
    }, (err) => {
      console.error('Error fetching settings:', err);
      setLoading(false);
    });

    return () => {
      unsubscribeSystem();
      unsubscribeFloating();
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, floatingSettings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
