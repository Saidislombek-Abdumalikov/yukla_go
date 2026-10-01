import React, { useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { api } from '../services/api';

const TabProfile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showOfertaModal, setShowOfertaModal] = useState(false);

  useEffect(() => {
    api.getProfile().then(setProfile);
  }, []);

  const branch = profile?.defaultDeliveryBranch;

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
            <h3 className="font-bold text-base text-gray-900 truncate">{profile?.name}</h3>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0">
              {profile?.customerCode}
            </span>
          </div>
          <p className="text-gray-500 font-mono text-xs mt-0.5">{profile?.phone}</p>
        </div>
      </div>

      {/* Approved Delivery Branch Card */}
      <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
            Yetkazib berish manzili
          </span>
          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
            🔒 Tasdiqlangan
          </span>
        </div>

        {branch ? (
          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-1">
            <p className="font-bold text-xs text-gray-900">
              {branch.provider} — {branch.branchName}
            </p>
            <p className="text-[11px] text-gray-500">{branch.region}, {branch.address}</p>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Filial belgilanmagan</p>
        )}

        <button
          onClick={() => setShowAddressModal(true)}
          className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-bold text-primary transition-colors active:scale-95 text-center"
        >
          Manzilni o'zgartirish so'rovi
        </button>
      </div>

      {/* Settings / Links */}
      <div className="bg-white rounded-3xl shadow-soft border border-gray-100 overflow-hidden divide-y divide-gray-50">
        
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
          href="https://t.me/yuklago_support" 
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
              <p className="text-[10px] text-gray-400">Telegram orqali qo'llab-quvvatlash</p>
            </div>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>

      </div>

      {/* Footer Branding */}
      <div className="text-center pt-4 opacity-40">
        <p className="font-black text-lg tracking-tight text-gray-500">Yukla Go</p>
        <p className="text-[10px] text-gray-400">Telegram Mini App • v0.1.0</p>
      </div>

      {/* Address Request Placeholder Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 animate-slide-up text-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-primary flex items-center justify-center mx-auto text-xl">
              📍
            </div>
            <h3 className="font-black text-base text-gray-900">Manzilni o'zgartirish</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Manzilni o'zgartirish so'rovi Stage 5 da faollashadi. Siz yangi filialni tanlaysiz va admin tasdiqlagach, manzilingiz yangilanadi.
            </p>
            <button
              onClick={() => setShowAddressModal(false)}
              className="w-full py-3 bg-primary text-white rounded-xl text-xs font-bold active:scale-95 transition-transform"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}

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
              <p>Yukla Go xizmatidan foydalanish orqali mijoz Xitoydan O'zbekistonga yuklarni tashish shartlariga to'liq rozilik bildiradi.</p>
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
