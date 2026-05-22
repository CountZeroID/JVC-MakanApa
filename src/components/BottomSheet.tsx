import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

export default function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef<number | null>(null);

    const handleTouchStart = (e: React.TouchEvent) => {
        dragStartY.current = e.touches[0].clientY;
        setIsDragging(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragStartY.current === null) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - dragStartY.current;
        setTranslateY(Math.max(0, diff));
    };

    const handleTouchEnd = () => {
        if (translateY > 100) {
            onClose();
        }
        setTranslateY(0);
        setIsDragging(false);
        dragStartY.current = null;
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[100] flex items-end bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                >
                    <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: isDragging ? translateY : 0 }}
                        exit={{ y: "100%" }}
                        transition={isDragging ? { type: "tween", duration: 0 } : { type: "spring", damping: 30, stiffness: 350 }}
                        className="bg-bg-card w-full rounded-t-[32px] shadow-2xl border-t border-border flex flex-col max-h-[92dvh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div 
                            className="w-full cursor-grab active:cursor-grabbing touch-none shrink-0 flex flex-col items-center pt-3 pb-2"
                            onTouchStart={handleTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                        >
                            <div className="w-8 h-1 bg-gray-300 rounded-full mb-3" />
                            {title && <h2 className="text-xl font-bold font-heading text-text-primary mb-2 text-center">{title}</h2>}
                        </div>
                        <div className="px-6 pb-[calc(80px+env(safe-area-inset-bottom)+16px)] overflow-y-auto">
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
