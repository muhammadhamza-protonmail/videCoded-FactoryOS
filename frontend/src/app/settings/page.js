'use client';
import { useState, useEffect } from 'react';
import { Building2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { API_BASE_URL } from '../../../lib/config';

export default function SettingsPage() {
    const [factory, setFactory] = useState({ name: '', address: '' });
    const [loading, setLoading] = useState(true);

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
    }, []);

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

    if (loading) return <div className="p-10 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div></div>;

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100">
                    <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                        <Building2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">Factory Profile</h2>
                        <p className="text-sm text-gray-500">Manage your factory's official information</p>
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
        </div>
    );
}
