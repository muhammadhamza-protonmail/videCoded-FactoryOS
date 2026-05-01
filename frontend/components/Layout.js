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
    TrendingUp, Menu, X, ChevronRight, LogOut,
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

export default function Layout({ children }) {
    const pathname = usePathname();
    const [open, setOpen] = useState(true);
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

    const visibleNav = navItems.filter(item => {
        if (item.adminOnly) return user?.role === 'admin' || user?.role === 'superadmin';
        return can(item.module, 'view');
    });

    return (
        <div className="flex h-screen bg-gray-50 overflow-hidden">

            {/* ── Sidebar ── */}
            <aside className={`${open ? 'w-64' : 'w-16'} bg-gradient-to-b from-gray-900 to-gray-800 transition-all duration-300 flex flex-col shadow-xl z-10`}>

                {/* Logo */}
                <div className="flex items-center justify-between p-4 border-b border-gray-700">
                    {open && (
                        <div className="flex items-center gap-2">
                            {globalSettings.logo_url ? (
                                <img src={globalSettings.logo_url.startsWith('http') ? globalSettings.logo_url : `${API_ORIGIN}${globalSettings.logo_url}`} alt="Logo" className="w-8 h-8 rounded" />
                            ) : null}
                            <div>
                                <h1 className="text-white font-bold text-sm leading-tight truncate max-w-[150px]">
                                    {globalSettings.app_name}
                                </h1>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={() => setOpen(!open)}
                        className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-700"
                    >
                        {open ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>

                {/* User info */}
                {open && user && (
                    <div className="px-4 py-3 border-b border-gray-700">
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 ${roleColors[user.role] || 'bg-gray-500'} rounded-full flex items-center justify-center text-white text-sm font-bold`}>
                                {user.full_name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-medium truncate">{user.full_name}</p>
                                <div className="flex items-center gap-1">
                                    <Shield size={10} className="text-gray-400" />
                                    <p className="text-gray-400 text-xs capitalize">{user.role}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Nav */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {visibleNav.map(({ href, label, icon: Icon, color }) => {
                        const active = pathname === href;
                        return (
                            <Link key={href} href={href}>
                                <div className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl mb-1 transition-all duration-200 cursor-pointer group ${active
                                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg'
                                    : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                    }`}>
                                    <Icon size={20} className={active ? 'text-white' : color} />
                                    {open && (
                                        <>
                                            <span className="text-sm font-medium flex-1">{label}</span>
                                            {active && <ChevronRight size={14} />}
                                        </>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-gray-700">
                    <button
                        onClick={logout}
                        className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-gray-400 hover:bg-red-500 hover:text-white transition-all`}
                    >
                        <LogOut size={20} />
                        {open && <span className="text-sm font-medium">Logout</span>}
                    </button>
                    {open && (
                        <p className="text-gray-500 text-xs text-center mt-2">FactoryOS v1.0</p>
                    )}
                </div>
            </aside>

            {/* ── Main Content ── */}
            <main className="flex-1 overflow-y-auto">
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
                    <div>
                        <h2 className="text-gray-800 font-semibold text-lg capitalize">
                            {pathname === '/' ? 'Dashboard' : pathname.replace('/', '')}
                        </h2>
                        <p className="text-gray-400 text-xs">
                            {new Date().toLocaleDateString('en-PK', {
                                weekday: 'long', year: 'numeric',
                                month: 'long', day: 'numeric'
                            })}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${roleColors[user?.role] || 'bg-gray-500'} flex items-center justify-center`}>
                            <span className="text-white text-sm font-bold">
                                {user?.full_name?.charAt(0).toUpperCase()}
                            </span>
                        </div>
                        <div className="hidden md:block">
                            <p className="text-sm font-medium text-gray-700">{user?.full_name}</p>
                            <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                        </div>
                    </div>
                </div>
                <div className="p-6">{children}</div>
            </main>
        </div>
    );
}
