'use client';

export default function PageHeader({ title, subtitle, action }) {
    return (
        <div className="page-header">
            <div className="min-w-0 flex-1">
                {title && (
                    <h1 className="text-xl sm:text-2xl font-bold text-gray-800 break-words">
                        {title}
                    </h1>
                )}
                {subtitle && <p className="text-gray-400 text-sm mt-1 break-words">{subtitle}</p>}
            </div>
            {action ? (
                <div className="page-header-action shrink-0 w-full sm:w-auto min-w-0">
                    {action}
                </div>
            ) : null}
        </div>
    );
}
