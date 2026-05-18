'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const widthClass = {
    sm: 'modal-shell-sm',
    md: 'modal-shell-md',
    lg: 'modal-shell-lg',
    xl: 'modal-shell-xl',
};

export default function Modal({ title, onClose, children, size, footer, wide }) {
    const resolvedSize = size || (wide === 'xl' ? 'xl' : wide ? 'lg' : 'md');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') onClose?.();
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [mounted, onClose]);

    if (!mounted) return null;

    return createPortal(
        <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose?.();
            }}
        >
            <div
                className={`modal-shell ${widthClass[resolvedSize] || widthClass.md}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2 id="modal-title" className="text-lg font-semibold text-gray-800 truncate pr-2">
                        {title}
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 p-2 -mr-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="modal-body">{children}</div>
                {footer ? <div className="modal-footer">{footer}</div> : null}
            </div>
        </div>,
        document.body
    );
}
