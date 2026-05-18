'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL, API_ORIGIN } from '../lib/config';
import {
    LayoutDashboard, Users, Package, Factory,
    FileText, CreditCard, Warehouse, ShoppingCart,
    Menu, X, ChevronRight, LogOut,
    UserCog, Shield, BarChart3, Boxes, Building2
} from 'lucide-react';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-400', module: 'dashboard' },
    { href: '/customers', label: 'Customers', icon: Users, color: 'text-green-400', module: 'customers' },
    { href: '/products', label: 'Products', icon: Package, color: 'text-purple-400', module: 'products' },
    { href: '/vendors', label: 'Vendors', icon: ShoppingCart, color: 'text-yellow-400', module: 'vendors' },
    { href: '/rawmaterials', label: 'Raw Materials', icon: Warehouse, color: 'text-orange-400', module: 'rawmaterials' },
    { href: '/production', label: 'Production', icon: Factory, color: 'text-red-400', module: 'production' },
    { href: '/invoices', label: 'Invoices', icon: FileText, color: 'text-cyan-400', module: 'invoices' },
    { href: '/payments', label: 'Payments', icon: CreditCard, color: 'text-pink-400', module: 'payments' },
    { href: '/inventory', label: 'Inventory', icon: Boxes, color: 'text-orange-400', module: 'inventory' },
    { href: '/reports', label: 'Reports', icon: BarChart3, color: 'text-indigo-400', module: 'reports' },
    { href: '/users', label: 'Users', icon: UserCog, color: 'text-teal-400', module: 'users', adminOnly: true },
    { href: '/settings', label: 'Factory Settings', icon: Building2, color: 'text-slate-400', module: 'dashboard', adminOnly: true },
];

const roleColors = {
    superadmin: 'bg-red-500',
    admin: 'bg-green-500',
    user: 'bg-blue-500',
};

function SidebarContent({ open, user, globalSettings, visibleNav, pathname, onNavigate, onLogout, showCollapseToggle, onToggleCollapse }) {
    return (
        <>
            <div className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
                {open ? (
                    <div className="flex items-center gap-2 min-w-0">
                        {globalSettings.logo_url ? (
                            <img
                                src={globalSettings.logo_url.startsWith('http') ? globalSettings.logo_url : `${API_ORIGIN}${globalSettings.logo_url}`}
                                alt="Logo"
                                className="w-8 h-8 rounded shrink-0"
                            />
                        ) : null}
                        <h1 className="text-white font-bold text-sm leading-tight truncate">
                            {globalSettings.app_name}
                        </h1>
                    </div>
                ) : (
                    <span className="sr-only">Menu</span>
                )}
                {showCollapseToggle ? (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label={open ? 'Collapse sidebar' : 'Expand sidebar'}
                    >
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={onNavigate}
                        className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-700 min-h-[44px] min-w-[44px] flex items-center justify-center lg:hidden"
                        aria-label="Close menu"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>

            {open && user && (
                <div className="px-4 py-3 border-b border-gray-700 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 ${roleColors[user.role] || 'bg-gray-500'} rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                            {user.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-white text-sm font-medium truncate">{user.full_name}</p>
                            <div className="flex items-center gap-1">
                                <Shield size={10} className="text-gray-400 shrink-0" />
                                <p className="text-gray-400 text-xs capitalize truncate">{user.role}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <nav className="flex-1 py-4 overflow-y-auto overscroll-contain">
                {visibleNav.map(({ href, label, icon: Icon, color }) => {
                    const active = pathname === href;
                    return (
                        <Link key={href} href={href} onClick={onNavigate}>
                            <div
                                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl mb-1 transition-all duration-200 cursor-pointer min-h-[44px] ${active
                                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                    }`}
                            >
                                <Icon size={20} className={`shrink-0 ${active ? 'text-white' : color}`} />
                                {open && (
                                    <>
                                        <span className="text-sm font-medium flex-1 truncate">{label}</span>
                                        {active && <ChevronRight size={14} className="shrink-0" />}
                                    </>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </nav>

            <div className="p-4 border-t border-gray-700 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <button
                    type="button"
                    onClick={onLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500 hover:text-white transition-all min-h-[44px]"
                >
                    <LogOut size={20} className="shrink-0" />
                    {open && <span className="text-sm font-medium">Logout</span>}
                </button>
                {open && (
                    <p className="text-gray-500 text-xs text-center mt-2">FactoryOS v1.0</p>
                )}
            </div>
        </>
    );
}

export default function Layout({ children }) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout, can } = useAuth();
    const [globalSettings, setGlobalSettings] = useState({ app_name: 'FactoryOS', logo_url: '' });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/superadmin/settings`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.data) setGlobalSettings(res.data);
            } catch (err) {}
        };
        if (user) fetchSettings();
    }, [user]);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        const mq = window.matchMedia('(min-width: 1024px)');
        const sync = () => {
            if (mq.matches) {
                setMobileMenuOpen(false);
            } else {
                setSidebarOpen(false);
            }
        };
        sync();
        mq.addEventListener('change', sync);
        return () => mq.removeEventListener('change', sync);
    }, []);

    useEffect(() => {
        document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [mobileMenuOpen]);

    const visibleNav = navItems.filter(item => {
        if (item.adminOnly) return user?.role === 'admin' || user?.role === 'superadmin';
        return can(item.module, 'view');
    });

    const pageTitle = pathname === '/' ? 'Dashboard' : pathname.replace('/', '').replace(/-/g, ' ');
    const closeMobileMenu = () => setMobileMenuOpen(false);

    return (
        <div className="flex h-[100dvh] bg-gray-50 overflow-hidden">
            {/* Mobile overlay */}
            {mobileMenuOpen && (
                <button
                    type="button"
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={closeMobileMenu}
                    aria-label="Close navigation menu"
                />
            )}

            {/* Mobile drawer */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-[min(100vw-3rem,18rem)] bg-gradient-to-b from-gray-900 to-gray-800 flex flex-col shadow-xl transform transition-transform duration-300 ease-out lg:hidden pt-[env(safe-area-inset-top)] ${
                    mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
                aria-hidden={!mobileMenuOpen}
            >
                <SidebarContent
                    open
                    user={user}
                    globalSettings={globalSettings}
                    visibleNav={visibleNav}
                    pathname={pathname}
                    onNavigate={closeMobileMenu}
                    onLogout={logout}
                    showCollapseToggle={false}
                />
            </aside>

            {/* Desktop sidebar */}
            <aside
                className={`hidden lg:flex ${sidebarOpen ? 'w-64' : 'w-16'} bg-gradient-to-b from-gray-900 to-gray-800 transition-all duration-300 flex-col shadow-xl z-10 shrink-0`}
            >
                <SidebarContent
                    open={sidebarOpen}
                    user={user}
                    globalSettings={globalSettings}
                    visibleNav={visibleNav}
                    pathname={pathname}
                    onNavigate={() => {}}
                    onLogout={logout}
                    showCollapseToggle
                    onToggleCollapse={() => setSidebarOpen(!sidebarOpen)}
                />
            </aside>

            {/* Main */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sticky top-0 z-20 shadow-sm shrink-0 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(true)}
                            className="lg:hidden p-2 -ml-1 rounded-lg text-gray-600 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                            aria-label="Open navigation menu"
                        >
                            <Menu size={22} />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-gray-800 font-semibold text-base sm:text-lg capitalize truncate">
                                {pageTitle}
                            </h2>
                            <p className="text-gray-400 text-xs truncate hidden sm:block">
                                {new Date().toLocaleDateString('en-PK', {
                                    weekday: 'long', year: 'numeric',
                                    month: 'long', day: 'numeric'
                                })}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className={`w-9 h-9 sm:w-8 sm:h-8 rounded-full ${roleColors[user?.role] || 'bg-gray-500'} flex items-center justify-center`}>
                            <span className="text-white text-sm font-bold">
                                {user?.full_name?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="hidden sm:block min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate max-w-[120px] md:max-w-none">{user?.full_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                    {children}
                </div>
            </main>
        </div>
    );
}
