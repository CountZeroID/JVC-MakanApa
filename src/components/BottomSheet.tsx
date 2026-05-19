import React, { useState, useEffect, useRef } from 'react';

interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string;
}

export default function BottomSheet({ isOpen, onClose, children, title }: BottomSheetProps) {
    const [isVisible, setIsVisible] = useState(isOpen);
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [translateY, setTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartY = useRef<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            setShouldRender(true);
            setTimeout(() => {
                setIsVisible(true);
            }, 10); // slightly delay to trigger transition
        } else {
            setIsVisible(false);
            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 300); // match animation duration
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

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

    if (!shouldRender) return null;

    return (
        <div 
            className={`fixed inset-0 z-[100] flex items-end bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`} 
            onClick={onClose}
        >
            <div 
                className="bg-bg-card w-full rounded-t-[32px] shadow-2xl border-t border-border flex flex-col max-h-[92dvh]"
                onClick={(e) => e.stopPropagation()}
                style={{ 
                    transform: `translateY(${isVisible ? (isDragging ? translateY + 'px' : '0px') : '100%'})`,
                    transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)' 
                }}
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
            </div>
        </div>
    );
}
