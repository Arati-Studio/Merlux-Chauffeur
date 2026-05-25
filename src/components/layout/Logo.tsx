import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface LogoProps {
  className?: string;
  variant?: 'navbar' | 'footer';
}

export default function Logo({ className, variant = 'navbar' }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'system'));
        if (settingsSnap.exists()) {
          const url = settingsSnap.data()?.seo?.logo;
          if (url) setLogoUrl(url);
        }
      } catch (e) {
        // Silent error
      }
    };
    fetchLogo();
  }, []);

  return (
    <Link to="/" className={cn("flex items-center gap-2", className)}>
      <img 
        src={logoUrl || "/assets/Logo.webp"} 
        alt="Merlux Chauffeur" 
        className={cn(
          "object-contain",
          variant === 'navbar' ? "h-10" : "h-16"
        )}
        referrerPolicy="no-referrer"
        onError={(e) => {
          if (logoUrl) {
            setLogoUrl(null);
          } else {
            e.currentTarget.style.display = 'none';
          }
        }}
      />
    </Link>
  );
}
