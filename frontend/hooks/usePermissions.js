'use client';
import { useAuth } from '../context/AuthContext';

export function usePermissions() {
    const { can, user } = useAuth();
    return {
        can,
        user,
        isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
        isSuperAdmin: user?.role === 'superadmin',
    };
}