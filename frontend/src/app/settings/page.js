'use client';
import { useState, useEffect } from 'react';
import { Building2, Save, Cloud, Key, Folder, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../../lib/config';

export default function SettingsPage() {
    const [factory, setFactory] = useState({ name: '', address: '' });
    const [loading, setLoading] = useState(true);
    
    // Cloud Sync States
    const [isDesktop, setIsDesktop] = useState(false);
    const [cloudStatus, setCloudStatus] = useState({ isConnected: false, folderId: '' });
    const [clientId, setClientId] = useState('');
    const [clientSecret, setClientSecret] = useState('');
    const [folderId, setFolderId] = useState('');

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/factories/profile`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });
                if (res.data) setFactory({ name: res.data.name || '', address: res.data.address || '' });
            } catch (err) {
                toast.error('Failed to load factory profile');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();

        // Check if running in Electron
        if (window.desktopApp && window.desktopApp.isDesktop) {
            setIsDesktop(true);
            refreshCloudStatus();
            
            window.desktopApp.on('google-auth-success', () => {
                toast.success('Google Drive connected successfully!');
                refreshCloudStatus();
            });
            
            window.desktopApp.on('google-config-updated', () => {
                toast.success('Backup folder updated!');
                refreshCloudStatus();
            });
        }
    }, []);

    const refreshCloudStatus = async () => {
        if (window.desktopApp?.invoke) {
            const status = await window.desktopApp.invoke('google-auth-status');
            setCloudStatus(status);
            setFolderId(status.folderId);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${API_BASE_URL}/factories/profile`, factory, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success('Factory profile updated successfully!');
        } catch (err) {
            toast.error('Failed to update profile');
        }
    };

    const handleConnectCloud = () => {
        if (!clientId || !clientSecret) {
            toast.error('Please enter both Client ID and Client Secret');
            return;
        }
        window.desktopApp.send('google-auth-start', { clientId, clientSecret });
        toast.loading('Opening login window...');
    };

    const handleSaveFolder = () => {
        if (!folderId) {
            toast.error('Please enter a Folder ID');
            return;
        }
        window.desktopApp.send('google-set-folder', folderId);
    };

    if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    return (
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Factory Profile Section */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-fit">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
                    <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Factory Profile</h2>
                        <p className="text-sm text-gray-500">Manage official information</p>
                    </div>
                </div>

                <form onSubmit={handleSave} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Factory Name</label>
                        <input 
                            type="text" 
                            value={factory.name}
                            onChange={e => setFactory({...factory, name: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Official Address</label>
                        <textarea 
                            value={factory.address}
                            onChange={e => setFactory({...factory, address: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50 h-24"
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2">
                            <Save size={18} />
                            Save Profile
                        </button>
                    </div>
                </form>
            </div>

            {/* Cloud Backup Section (Only in Desktop) */}
            {isDesktop && (
                <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm h-fit">
                    <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
                        <div className="bg-green-100 p-3 rounded-xl text-green-600">
                            <Cloud size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Cloud Backup</h2>
                            <p className="text-sm text-gray-500">Auto-sync backups to Google Drive</p>
                        </div>
                    </div>

                    {cloudStatus.isConnected ? (
                        <div className="space-y-6">
                            <div className="bg-green-50 p-4 rounded-2xl flex items-center gap-3 text-green-700">
                                <CheckCircle2 size={24} />
                                <div>
                                    <p className="font-bold">Connected to Google Drive</p>
                                    <p className="text-xs">Your personal account is linked.</p>
                                </div>
                            </div>

                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                                        <Folder size={16} className="text-gray-400" />
                                        Google Drive Folder ID
                                    </label>
                                    <input 
                                        type="text" 
                                        value={folderId}
                                        onChange={e => setFolderId(e.target.value)}
                                        placeholder="Paste your Google Drive Folder ID here"
                                        className="w-full p-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 outline-none bg-gray-50"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Found in the URL of your Google Drive folder</p>
                                </div>
                                <button 
                                    onClick={handleSaveFolder}
                                    className="w-full bg-green-600 text-white py-2.5 rounded-xl font-medium hover:bg-green-700 transition-colors"
                                >
                                    Save Folder ID
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="bg-amber-50 p-4 rounded-2xl flex items-start gap-3 text-amber-700">
                                <AlertCircle size={24} className="mt-0.5 shrink-0" />
                                <div className="text-xs leading-relaxed">
                                    <p className="font-bold mb-1">Not Connected</p>
                                    <p>Backups are only local. Connect your Google account to enable secure cloud sync using your 15GB+ storage.</p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="relative">
                                    <Key size={14} className="absolute left-3 top-3 text-gray-400" />
                                    <input 
                                        type="text" 
                                        placeholder="Google Client ID"
                                        value={clientId}
                                        onChange={e => setClientId(e.target.value)}
                                        className="w-full pl-9 p-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                                    />
                                </div>
                                <div className="relative">
                                    <Key size={14} className="absolute left-3 top-3 text-gray-400" />
                                    <input 
                                        type="password" 
                                        placeholder="Google Client Secret"
                                        value={clientSecret}
                                        onChange={e => setClientSecret(e.target.value)}
                                        className="w-full pl-9 p-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-gray-50"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 px-1">
                                    Create these in your Google Cloud Console as a "Desktop App" credential.
                                </p>
                                <button 
                                    onClick={handleConnectCloud}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-md flex items-center justify-center gap-2"
                                >
                                    <Cloud size={18} />
                                    Connect Google Drive
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
