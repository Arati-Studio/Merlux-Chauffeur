import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  placeholderClassName?: string;
}

export default function LazyImage({
  src,
  alt,
  className,
  placeholderClassName,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // If IntersectionObserver is not supported, load immediately
    if (!window.IntersectionObserver) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.unobserve(entry.target);
          }
        });
      },
      {
        rootMargin: '200px 0px', // Start loading 200px before image enters viewport
      }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => {
      if (imageRef.current) {
        observer.unobserve(imageRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={imageRef}
      className={cn("relative overflow-hidden w-full h-full bg-black/40", placeholderClassName)}
    >
      {/* Elegant Golden-Silt Shimmering Placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 z-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 animate-pulse flex items-center justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(212,175,55,0.05),transparent)] animate-[shimmer_2s_infinite] -translate-x-full" />
          <span className="text-[9px] uppercase tracking-[0.3em] text-gold/30 font-bold font-mono">MERLUX</span>
        </div>
      )}

      {/* Actual Image */}
      {isInView && (
        <img
          src={src}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-all duration-[1.2s] ease-out",
            isLoaded ? "opacity-100 scale-100 blur-0" : "opacity-0 scale-105 blur-md",
            className
          )}
          onLoad={() => setIsLoaded(true)}
          {...props}
        />
      )}
    </div>
  );
}
