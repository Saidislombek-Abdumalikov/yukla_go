
import React, { useState, useEffect } from 'react';
import { getUserProfile } from '../services/storageService';
import { UserProfile } from '../types';

interface TabProfileProps {
    onLogout: () => void;
}

const TabProfile: React.FC<TabProfileProps> = ({ onLogout }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    setProfile(getUserProfile());
  }, []);

  const handleLogoutClick = () => {
    onLogout();
  };

  return (
    <div className="space-y-8 pb-40 animate-fade-in">
      <h2 className="text-2xl font-bold text-text px-2">Profil</h2>

      {/* Profile Card */}
      <div className="bg-white p-6 rounded-[32px] shadow-soft border border-gray-100 flex items-center gap-5">
        <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center text-text-secondary text-3xl font-bold">
            {profile?.name.charAt(0).toUpperCase()}
        </div>
        <div>
            <h3 className="font-bold text-xl text-text">{profile?.name}</h3>
            <p className="text-text-secondary font-mono bg-secondary px-2 py-0.5 rounded text-sm inline-block mt-1">{profile?.phone}</p>
        </div>
      </div>

      {/* Settings List */}
      <div className="bg-white rounded-[32px] shadow-soft border border-gray-100 overflow-hidden">
        <a 
            href="https://t.me/yaqiin" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full p-5 flex items-center justify-between border-b border-gray-50 hover:bg-gray-50 transition-colors group"
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <div className="text-left">
                    <p className="font-bold text-text">Bog'lanish</p>
                    <p className="text-xs text-text-secondary">Telegram orqali admin bilan bog'lanish</p>
                </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-text-secondary">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
        </a>

        <button 
            onClick={handleLogoutClick}
            className="w-full p-5 flex items-center justify-between hover:bg-red-50 transition-colors group cursor-pointer"
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </div>
                <div className="text-left">
                    <p className="font-bold text-red-500">Chiqish</p>
                    <p className="text-xs text-red-300">Hisobdan chiqish</p>
                </div>
            </div>
        </button>
      </div>

      <div className="text-center opacity-30 pt-4">
          <p className="font-black text-2xl tracking-tighter text-gray-400">YAQIIN CARGO</p>
          <p className="text-[10px] text-gray-400">Version 2.3.0</p>
      </div>
    </div>
  );
};

export default TabProfile;
