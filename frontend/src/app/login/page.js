'use client';
import { useState } from 'react';
import { loginUser } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { Eye, EyeOff, Factory } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!username || !password) return toast.error('Please fill all fields');
        setLoading(true);
        try {
            const res = await loginUser({ username, password });
            login(res.data.user, res.data.permissions, res.data.token);
            toast.success(`✅ Welcome, ${res.data.user.full_name}!`);
            // Redirect based on role
            if (res.data.user.role === 'superadmin') {
                window.location.href = '/superadmin';
            } else {
                window.location.href = '/';
            }
        } catch (err) {
            toast.error(err.response?.data?.error || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">

                {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                            <Factory size={32} className="text-white" />
                        </div>
                        <h1 className="text-3xl font-bold text-white">Factory <span className="text-green-400">MS</span></h1>
                        <p className="text-gray-400 mt-1 text-sm">Multi-Tenant Management System</p>
                    </div>

                {/* Card */}
                <div className="bg-white rounded-3xl shadow-2xl p-8">
                    <h2 className="text-xl font-bold text-gray-800 mb-1">Welcome back</h2>
                    <p className="text-gray-400 text-sm mb-6">Sign in to your account</p>

                    <form onSubmit={handleLogin} className="space-y-4">

                        {/* Username */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Enter your username"
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                autoFocus
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-semibold transition-all shadow-lg mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Signing in...
                                </span>
                            ) : 'Sign In'}
                        </button>
                    </form>

                    {/* Credentials hint */}
                    <div className="mt-6 bg-gray-50 rounded-2xl p-4 space-y-2">
                        <p className="text-xs font-bold text-gray-500 mb-3 uppercase tracking-wide">Default Credentials</p>
                        <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-3 bg-red-50 rounded-xl px-3 py-2">
                                <span className="text-base">👑</span>
                                <div>
                                    <p className="font-semibold text-red-700">Superadmin</p>
                                    <p className="text-gray-500">superadmin / superadmin123</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-green-50 rounded-xl px-3 py-2">
                                <span className="text-base">🏭</span>
                                <div>
                                    <p className="font-semibold text-green-700">Factory Admin</p>
                                    <p className="text-gray-500">admin / admin123</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-3 py-2">
                                <span className="text-base">👤</span>
                                <div>
                                    <p className="font-semibold text-blue-700">Factory User</p>
                                    <p className="text-gray-500">user1 / user123</p>
                                </div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-3 text-center">New accounts are created by Admins — no public registration</p>
                    </div>
                </div>

                <p className="text-center text-gray-500 text-xs mt-6">
                    Factory MS v1.0 · Secure Login
                </p>
            </div>
        </div>
    );
}