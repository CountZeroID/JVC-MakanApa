import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'error';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-4 w-full max-w-sm pointer-events-none"
      >
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border backdrop-blur-md font-bold text-sm pointer-events-auto ${
          type === 'success' 
            ? 'bg-success/10 border-success/20 text-success' 
            : 'bg-error/10 border-error/20 text-error'
        }`}>
          {type === 'success' ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
          <span className="flex-1">{message}</span>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
