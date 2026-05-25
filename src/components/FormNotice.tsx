import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useSettings } from '../lib/SettingsContext';

export type NoticeType = 'success' | 'error' | 'warning' | 'info';

interface FormNoticeProps {
  type: NoticeType;
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
  isFloating?: boolean;
  actions?: { label: string; onClick: () => void; variant?: 'primary' | 'secondary' }[];
  iconOnly?: boolean;
}

export const FormNotice: React.FC<FormNoticeProps> = ({ 
  type, 
  title, 
  message, 
  onClose,
  className,
  isFloating = true,
  actions = [],
  iconOnly = false,
}) => {
  const { floatingSettings } = useSettings();
  const toastSettings = floatingSettings?.toast || {};

  const [windowWidth, setWindowWidth] = React.useState(window.innerWidth);
  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getStyle = (type: NoticeType) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={16} />,
          color: toastSettings?.colors?.success || '#10b981',
          bg: toastSettings?.bgColors?.success || 'rgba(16, 185, 129, 0.1)',
        };
      case 'error':
        return {
          icon: <XCircle size={16} />,
          color: toastSettings?.colors?.error || '#ef4444',
          bg: toastSettings?.bgColors?.error || 'rgba(239, 68, 68, 0.1)',
        };
      case 'warning':
        return {
          icon: <AlertCircle size={16} />,
          color: toastSettings?.colors?.default || '#D4AF37',
          bg: toastSettings?.bgColors?.default || 'rgba(212, 175, 55, 0.1)',
        };
      case 'info':
      default:
        return {
          icon: <Info size={16} />,
          color: toastSettings?.colors?.default || '#3b82f6',
          bg: toastSettings?.bgColors?.default || 'rgba(59, 130, 246, 0.1)',
        };
    }
  };

  const currentStyle = getStyle(type);

  const isMobile = windowWidth < 768;

  let toastPosition = toastSettings?.position?.desktop || 'top-right';
  if (isMobile) toastPosition = toastSettings?.position?.mobile || 'top-center';

  let toastWidth = toastSettings?.width?.desktop || 'auto';
  if (isMobile) toastWidth = toastSettings?.width?.mobile || 'full-margin';

  // Map settings to CSS
  let finalToastWidth = toastWidth;
  if (toastWidth === 'full-margin') finalToastWidth = 'calc(100% - 32px)';
  else if (toastWidth === 'full') finalToastWidth = '100%';
  else if (toastWidth === 'auto') finalToastWidth = 'auto';

  const offset = toastSettings?.offset ? Number(toastSettings.offset) : 16;
  const padding = toastSettings?.padding ? Number(toastSettings.padding) : 16;

  // Compute fixed styling if floating
  const fixedStyles: React.CSSProperties = isFloating ? {
    position: 'fixed',
    zIndex: 9999,
    width: finalToastWidth,
    padding: `${padding}px`,
    top: toastPosition.startsWith('top') ? `${offset}px` : 'auto',
    bottom: toastPosition.startsWith('bottom') ? `${offset}px` : 'auto',
    left: toastPosition.endsWith('left') ? `${offset}px` : toastPosition.endsWith('center') ? '50%' : 'auto',
    right: toastPosition.endsWith('right') ? `${offset}px` : 'auto',
    transform: toastPosition.endsWith('center') ? 'translateX(-50%)' : 'none',
  } : {
    width: finalToastWidth,
    padding: `${padding}px`,
  };

  const animationType = (isMobile ? toastSettings?.animation?.mobile : toastSettings?.animation?.desktop) || 'fade-slide';
  const entryDir = toastSettings?.entryDirection || 'default';
  const exitDir = toastSettings?.exitDirection || 'default';
  const speed = toastSettings?.animationSpeed ? Number(toastSettings.animationSpeed) : 1;
  const tweenDuration = 0.3 / speed;
  
  const getVariants = () => {
    if (!isFloating) {
      return {
        initial: { opacity: 0, y: -10, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -10, scale: 0.98 }
      };
    }

    const isCenter = toastPosition.endsWith('center');
    const isTop = toastPosition.startsWith('top');
    const baseX = isCenter ? '-50%' : 0;
    const defaultSlideY = isTop ? -30 : 30;

    const getOffset = (dir: string, defaultY: number) => {
      switch (dir) {
        case 'top': return { x: baseX, y: -60 };
        case 'bottom': return { x: baseX, y: 60 };
        case 'left': return { x: isCenter ? 'calc(-50% - 60px)' : -60, y: 0 };
        case 'right': return { x: isCenter ? 'calc(-50% + 60px)' : 60, y: 0 };
        default: return { x: baseX, y: defaultY };
      }
    };

    const initial = getOffset(entryDir, animationType === 'slide-down' ? -50 : (animationType === 'slide-up' ? 50 : defaultSlideY));
    const exit = getOffset(exitDir, animationType === 'slide-down' ? -50 : (animationType === 'slide-up' ? 50 : defaultSlideY));

    switch (animationType) {
      case 'fade-scale':
        return {
          initial: { opacity: 0, ...initial, scale: 0.8 },
          animate: { opacity: 1, x: baseX, y: 0, scale: 1 },
          exit: { opacity: 0, ...exit, scale: 0.8 }
        };
      case 'slide':
      case 'slide-up':
      case 'slide-down':
        return {
          initial: { opacity: 0, ...initial },
          animate: { opacity: 1, x: baseX, y: 0, scale: 1 },
          exit: { opacity: 0, ...exit }
        };
      case 'bounce':
        return {
          initial: { opacity: 0, x: initial.x, y: initial.y * 2, scale: 0.8 },
          animate: { opacity: 1, x: baseX, y: 0, scale: 1 },
          exit: { opacity: 0, x: exit.x, y: exit.y * 2, scale: 0.8 }
        };
      case 'fade-slide':
      default:
        return {
          initial: { opacity: 0, ...initial, scale: 0.95 },
          animate: { opacity: 1, x: baseX, y: 0, scale: 1 },
          exit: { opacity: 0, ...exit, scale: 0.95 }
        };
    }
  };

  const variants = getVariants();
  const transition: any = speed !== 1 
    ? { type: 'tween', duration: tweenDuration, ease: 'easeOut' }
    : (animationType === 'bounce' 
      ? { type: 'spring', damping: 15, stiffness: 300, mass: 0.8 }
      : { type: 'spring', damping: 25, stiffness: 300 });

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
      transition={transition}
      className={cn(
        "rounded-2xl flex items-start gap-4 transition-all glass backdrop-blur-xl",
        isFloating ? "shadow-2xl shadow-black/50" : "",
        className
      )}
      style={{
        background: currentStyle.bg,
        border: `1px solid ${currentStyle.color}`,
        ...fixedStyles
      }}
    >
      <div className="mt-0.5 shrink-0" style={{ color: currentStyle.color }}>
        {currentStyle.icon}
      </div>
      {!iconOnly && (
        <div className="flex-1 space-y-1">
          {title && (
            <h5 className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: currentStyle.color }}>
              {title}
            </h5>
          )}
          <p className="text-[11px] text-white/70 font-medium leading-relaxed italic">
            {message}
          </p>
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className="flex items-center gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={cn(
                "text-[10px] uppercase tracking-widest px-3 py-1.5 rounded-lg transition-colors",
                action.variant === 'primary' 
                  ? "bg-white/10 text-white hover:bg-white/20"
                  : "text-white/50 hover:text-white"
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {onClose && (
        <button 
          onClick={onClose}
          className="shrink-0 p-1 hover:bg-white/5 rounded-lg transition-colors group"
        >
          <X size={14} className="text-white/20 group-hover:text-white" />
        </button>
      )}
    </motion.div>
  );
};
