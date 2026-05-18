'use client';

export default function FormActions({ children, className = '' }) {
    return (
        <div className={`form-actions ${className}`.trim()}>
            {children}
        </div>
    );
}
