'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import Layout from './Layout';
import toast from 'react-hot-toast';

const PUBLIC_PAGES = ['/login', '/signup'];

export default function AppLayout({ children }) {
    const { user, loading } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const isPublicPage = PUBLIC_PAGES.includes(pathname);
    const isSuperAdminPage = pathname.startsWith('/superadmin');

    useEffect(() => {
        if (loading) return;

        // Not logged in → go to login
        if (!user && !isPublicPage) {
            router.push('/login');
            return;
        }

        // Logged in → redirect away from public pages
        if (user && isPublicPage) {
            if (user.role === 'superadmin') router.push('/superadmin');
            else router.push('/');
            return;
        }

        // Super admin must stay on superadmin pages
        if (user?.role === 'superadmin' && !isSuperAdminPage) {
            router.push('/superadmin');
            return;
        }

        // Normal users can't access superadmin pages
        if (user?.role !== 'superadmin' && isSuperAdminPage) {
            router.push('/');
        }

    }, [user, loading, pathname]);

    useEffect(() => {
        const handleLocalChange = () => {
            toast('Saved offline. It will sync when cloud sync is connected.', { icon: '📱' });
        };
        const handleRemoteChange = () => {
            toast.success('New cloud data received. Refreshing view...');
            router.refresh();
        };

        window.addEventListener('factoryos-local-data-changed', handleLocalChange);
        window.addEventListener('factoryos-remote-data-updated', handleRemoteChange);

        return () => {
            window.removeEventListener('factoryos-local-data-changed', handleLocalChange);
            window.removeEventListener('factoryos-remote-data-updated', handleRemoteChange);
        };
    }, [router]);

    // Loading screen
    if (loading) return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-400">Loading...</p>
            </div>
        </div>
    );

    // Public pages — no layout
    if (isPublicPage) return <>{children}</>;

    // Not logged in — show nothing while redirecting
    if (!user) return null;

    // Super admin pages — full-screen dark background with centered content
    if (isSuperAdminPage) return (
        <div className="min-h-[100dvh] bg-slate-100">
            <div className="max-w-7xl mx-auto p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
                {children}
            </div>
        </div>
    );

    // Normal pages — with sidebar layout
    return <Layout>{children}</Layout>;
}
