import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  type?: 'danger' | 'warning' | 'info';
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message = "This action is permanent and cannot be undone.",
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  type = 'danger'
}: ConfirmationModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
        >
          <div className="absolute inset-0" onClick={onClose} />
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20 }}
            className="w-full max-w-sm glass p-8 rounded-3xl text-center border border-white/10 relative"
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
              type === 'danger' ? 'bg-red-500/10 text-red-500' : 
              type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' : 
              'bg-blue-500/10 text-blue-500'
            }`}>
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg sm:text-xl font-display mb-2">{title}</h3>
            <p className="text-white/40 text-[12px] mb-8 leading-relaxed">
              {message}
            </p>

            <div className="flex gap-4">
              <button
                onClick={onClose}
                className="flex-1 py-4 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all font-display"
              >
                {cancelLabel}
              </button>
              <button
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                className={`flex-1 py-4 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-xl font-display ${
                  type === 'danger' ? 'bg-red-600 text-white hover:bg-red-500 shadow-red-600/20' : 
                  type === 'warning' ? 'bg-gold text-black hover:bg-white shadow-gold/20' : 
                  'bg-blue-600 text-white hover:bg-blue-500 shadow-blue-600/20'
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
