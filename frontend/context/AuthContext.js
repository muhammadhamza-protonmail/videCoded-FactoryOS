'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [permissions, setPermissions] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        try {
            const savedUser = localStorage.getItem('user');
            const savedPerms = localStorage.getItem('permissions');
            if (savedUser) setUser(JSON.parse(savedUser));
            if (savedPerms) setPermissions(JSON.parse(savedPerms));
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    const login = (userData, perms, token) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('permissions', JSON.stringify(perms));
        setUser(userData);
        setPermissions(perms);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('permissions');
        setUser(null);
        setPermissions({});
    };

    const can = (module, action) => {
        if (!user) return false;
        if (user.role === 'superadmin') return true;
        if (user.role === 'admin') return true;
        return permissions?.[module]?.[action] === true;
    };

    return (
        <AuthContext.Provider value={{ user, permissions, loading, login, logout, can }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);