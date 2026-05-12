'use client';
import { useState, useEffect } from 'react';
import { Building2, Save, Cloud, Folder, CheckCircle2, HardDrive, Loader2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../../lib/config';

export default function SettingsPage() {
    const [factory, setFactory] = useState({ name: '', address: '' });
    const [loading, setLoading] = useState(true);
    
    // Cloud Sync States
    const [isDesktop, setIsDesktop] = useState(false);
    const [cloudStatus, setCloudStatus] = useState({ isConnected: false, folderId: '' });
    const [folderId, setFolderId] = useState('');
    const [backupDirectory, setBackupDirectory] = useState('');
    const [backupInProgress, setBackupInProgress] = useState(false);

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
                toast.dismiss();
                toast.success('Google Drive connected successfully!');
                refreshCloudStatus();
            });

            window.desktopApp.on('google-auth-failed', (message) => {
                toast.dismiss();
                toast.error(message || 'Google authentication failed');
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
            setBackupDirectory(status.effectiveBackupDirectory || status.backupDirectory || '');
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
        window.desktopApp.send('google-auth-start');
        toast.loading('Opening Google Login...');
    };

    const handleBackupNow = async () => {
        setBackupInProgress(true);
        const toastId = toast.loading('Creating backup...');
        try {
            const result = await window.desktopApp.invoke('backup-now');
            toast.dismiss(toastId);
            if (result.error) {
                toast.error(`Backup failed: ${result.error}`);
                return;
            }

            if (result.localSuccess) {
                const localPathMsg = result.localBackupPath ? `\n${result.localBackupPath}` : '';
                toast.success(`✅ Local backup saved.${localPathMsg}`, { duration: 5000 });
            } else {
                toast.error('❌ Local backup failed.');
            }

            if (result.cloudSuccess) {
                toast.success('☁️ Google Drive sync completed.');
            } else if (result.cloudSkipped) {
                toast('ℹ️ Google Drive sync skipped (not connected).', { icon: 'ℹ️' });
            } else if (result.localSuccess) {
                toast('⚠️ Local backup done, but Drive sync failed. It will retry automatically.', { icon: '⚠️' });
            }

            await refreshCloudStatus();
        } catch (err) {
            toast.dismiss(toastId);
            toast.error('Backup failed unexpectedly.');
        } finally {
            setBackupInProgress(false);
        }
    };

    const handleCopyValue = async (value, label) => {
        if (!value) {
            toast.error(`No ${label} available to copy`);
            return;
        }
        try {
            await navigator.clipboard.writeText(value);
            toast.success(`${label} copied`);
        } catch {
            toast.error(`Could not copy ${label}`);
        }
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
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={folderId}
                                            readOnly
                                            className="flex-1 p-2 border border-gray-300 rounded-xl outline-none bg-gray-50 text-gray-700"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleCopyValue(folderId, 'Folder ID')}
                                            className="px-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-600"
                                            title="Copy Folder ID"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">Found in the URL of your Google Drive folder</p>
                                </div>
                            </div>

                        </div>
                    ) : (
                        <div className="space-y-6 text-center py-4">
                            <div className="bg-blue-50 p-6 rounded-3xl inline-block mb-4">
                                <Cloud size={48} className="text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-800 mb-2">Connect Your Drive</h3>
                                <p className="text-sm text-gray-500 mb-6 px-4">
                                    Safely store your factory data in your own Google Drive.
                                </p>
                                <button 
                                    onClick={handleConnectCloud}
                                    className="w-full bg-indigo-600 text-white py-3.5 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Cloud size={20} />
                                    Connect Google Drive
                                </button>
                                <p className="text-[10px] text-gray-400 mt-4">
                                    Make sure GOOGLE_CLIENT_ID is set in your .env file.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-gray-100 mt-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Backup Directory
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={backupDirectory}
                                    readOnly
                                    className="flex-1 p-2 border border-gray-300 rounded-xl outline-none bg-gray-50 text-gray-700"
                                />
                                <button
                                    type="button"
                                    onClick={() => handleCopyValue(backupDirectory, 'Backup directory')}
                                    className="px-3 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-600"
                                    title="Copy Backup Directory"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">
                                Current backups are saved in: {backupDirectory || 'Default AppData backup folder'}
                            </p>
                        </div>
                    </div>

                    {/* Backup Now Button */}
                    <div className="pt-4 border-t border-gray-100 mt-2">
                        <button
                            onClick={handleBackupNow}
                            disabled={backupInProgress}
                            className="w-full bg-indigo-500 text-white py-3 rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {backupInProgress
                                ? <><Loader2 size={18} className="animate-spin" /> Backing up...</>
                                : <><HardDrive size={18} /> Backup Now</>
                            }
                        </button>
                        <p className="text-[10px] text-gray-400 mt-2 text-center">
                            Creates a local backup immediately and uploads to Google Drive if connected.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
