import React, { useState, useEffect } from 'react';
import type { UserProfile } from '../types';
import { api } from '../services/api';

interface TabProfileProps {
  onOpenAcademy?: () => void;
}

const TabProfile: React.FC<TabProfileProps> = ({ onOpenAcademy }) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showOfertaModal, setShowOfertaModal] = useState(false);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  return (
    <div className="space-y-4 pb-32 animate-fade-in">
      <h2 className="text-2xl font-black text-gray-900 tracking-tight px-1">Profil</h2>

      {/* User Info Card */}
      <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 flex items-center gap-4">
        <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-xl font-black shrink-0">
          {profile?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-base text-gray-900 truncate">{profile?.name || 'Mijoz'}</h3>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0">
              {profile?.customerCode || 'YK-###'}
            </span>
          </div>
          <p className="text-gray-500 font-mono text-xs mt-0.5">{profile?.phone || '-'}</p>
        </div>
      </div>

      {/* Settings / Links */}
      <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden divide-y divide-gray-50">
        
        {/* Video Darslar & Akademiya */}
        {onOpenAcademy && (
          <button
            onClick={onOpenAcademy}
            className="w-full p-4 flex items-center justify-between hover:bg-amber-50/50 transition-colors text-left group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                🎓
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-xs text-gray-900 group-hover:text-amber-800 transition-colors">Video Darslar & Akademiya</p>
                  <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-black">LMS</span>
                </div>
                <p className="text-[10px] text-gray-400">Xitoydan buyurtma berish amaliy kursi</p>
              </div>
            </div>
            <svg className="w-4 h-4 text-gray-400 group-hover:translate-x-1 group-hover:text-amber-600 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Oferta View */}
        <button
          onClick={() => setShowOfertaModal(true)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-xs text-gray-800">Foydalanish shartlari</p>
              <p className="text-[10px] text-gray-400">Yukla Go Ommaviy Ofertasi</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Telegram Admin Support */}
        <a 
          href="https://t.me/nothing_related" 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-xs text-gray-800">Admin bilan bog'lanish</p>
              <p className="text-[10px] text-gray-400">Telegram orqali qo'llab-quvvatlash (@nothing_related)</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>

        {/* Admin Dashboard Switch */}
        <button
          onClick={() => {
            window.location.hash = '#admin';
            window.location.reload();
          }}
          className="w-full p-4 flex items-center justify-between hover:bg-blue-50/50 transition-colors text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gray-100 group-hover:bg-primary group-hover:text-white text-gray-700 flex items-center justify-center shrink-0 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <p className="font-bold text-xs text-gray-800 group-hover:text-primary transition-colors">Admin boshqaruv paneli</p>
              <p className="text-[10px] text-gray-400">Kurslar, Darslar ruxsati va yuklarni boshqarish</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400 group-hover:translate-x-1 group-hover:text-primary transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

      </div>

      {/* Footer Branding */}
      <div className="text-center pt-4 opacity-40">
        <p className="font-black text-lg tracking-tight text-gray-500">Yukla Go</p>
        <p className="text-[10px] text-gray-400">Telegram Mini App • v0.1.0</p>
      </div>

      {/* Oferta Modal */}
      {showOfertaModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 animate-slide-up max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-black text-base text-gray-900">Ommaviy Oferta</h3>
              <button onClick={() => setShowOfertaModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>
            <div className="flex-1 overflow-y-auto text-xs text-gray-600 space-y-2 leading-relaxed">
              <p className="font-bold text-gray-800">1. Umumiy qoidalar</p>
              <p>Yukla Go xizmatidan foydalanish orqali mijoz Xitoydan O'zbekistonga yuklarni tashish va video darsliklardan foydalanish shartlariga to'liq rozilik bildiradi.</p>
              <p className="font-bold text-gray-800">2. Taqiqlangan buyumlar</p>
              <p>Havo yo'li orqali batareyalar, suyuqliklar, magnetlar va yonuvchan moddalarni jo'natish qat'iyan taqiqlanadi.</p>
              <p className="font-bold text-gray-800">3. Yetkazib berish va to'lov</p>
              <p>Mijoz yuk uchun to'lovni belgilangan tariflar bo'yicha amalga oshiradi.</p>
            </div>
            <button
              onClick={() => setShowOfertaModal(false)}
              className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold active:scale-95 transition-transform shrink-0"
            >
              Yopish
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TabProfile;
