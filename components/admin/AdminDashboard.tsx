import React, { useState } from 'react';

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = 'STATS' | 'PARCELS' | 'USERS' | 'REQUESTS' | 'SETTINGS';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('STATS');

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col animate-fade-in pb-12">
      
      {/* Header */}
      <div className="bg-white px-6 pt-8 pb-5 border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-black text-primary tracking-tight uppercase">Yukla Go Admin</h1>
            <p className="text-[11px] text-gray-400 font-bold uppercase">Boshqaruv paneli (Preview)</p>
          </div>
          <button 
            onClick={onBack}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
          >
            Ilovaga qaytish
          </button>
        </div>

        {/* Informational Banner */}
        <div className="mb-3 p-2.5 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-800 font-medium">
          🔒 Ushbu admin panel Stage 6 da Telegram server-avtorizatsiyasi orqali to'liq ulanadi.
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 text-[11px] font-bold">
          <button
            onClick={() => setActiveTab('STATS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all whitespace-nowrap ${activeTab === 'STATS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Statistika
          </button>
          <button
            onClick={() => setActiveTab('PARCELS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all whitespace-nowrap ${activeTab === 'PARCELS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Yangi yuklar
          </button>
          <button
            onClick={() => setActiveTab('USERS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all whitespace-nowrap ${activeTab === 'USERS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Mijozlar
          </button>
          <button
            onClick={() => setActiveTab('REQUESTS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all whitespace-nowrap ${activeTab === 'REQUESTS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Manzil so'rovlari
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all whitespace-nowrap ${activeTab === 'SETTINGS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Sozlamalar
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 p-5 max-w-xl mx-auto w-full space-y-4">
        
        {activeTab === 'STATS' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Mijozlar soni</p>
                <h4 className="text-3xl font-black text-primary">150+</h4>
                <p className="text-[10px] text-gray-400 mt-1">Ro'yxatdan o'tgan</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Faol yuklar</p>
                <h4 className="text-3xl font-black text-amber-500">42</h4>
                <p className="text-[10px] text-gray-400 mt-1">Yo'lda / Ombor</p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 space-y-2">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Tezkor amallar</h4>
              <p className="text-xs text-gray-500">
                Admin bir necha tugma orqali yangi treklarni nusxalashi, Xitoy karqo tizimiga kiritilganligini belgilashi va holatlarni ommaviy yangilashi mumkin.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'PARCELS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3 animate-fade-in">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-sm text-gray-800">Yangi kiritilgan treklar</h3>
              <button className="px-3 py-1.5 bg-primary text-white rounded-xl text-xs font-bold shadow-sm">
                Hammasini nusxalash
              </button>
            </div>
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 text-xs font-mono text-gray-600">
              <p>YT882910291CN &bull; YK-100 &bull; BTS Namangan</p>
              <p>SF1092837465CN &bull; YK-101 &bull; EMU Toshkent</p>
            </div>
            <p className="text-[11px] text-gray-400">
              Stage 6 da bu bo'limda bir bosish bilan yangi treklarni nusxalab, "Karqoga kiritildi" deb belgilash mumkin bo'ladi.
            </p>
          </div>
        )}

        {activeTab === 'USERS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800 mb-3">Mijozlar ro'yxati</h3>
            <div className="p-4 bg-gray-50 rounded-2xl text-xs text-gray-500 space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800">Saidislom (YK-100)</span>
                <span className="text-green-600 font-bold">Faol</span>
              </div>
              <p className="text-[11px]">+998 90 123 45 67 &bull; BTS Chorsu</p>
            </div>
          </div>
        )}

        {activeTab === 'REQUESTS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 animate-fade-in space-y-3">
            <h3 className="font-bold text-sm text-gray-800">Manzilni o'zgartirish so'rovlari</h3>
            <div className="p-4 bg-gray-50 rounded-2xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800">YK-105: Akmal</span>
                <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded">Kutilmoqda</span>
              </div>
              <p className="text-gray-600">Eski: BTS Namangan &rarr; Yangi: EMU Chortoq</p>
              <div className="flex gap-2 pt-1">
                <button className="flex-1 py-1.5 bg-green-600 text-white rounded-lg font-bold text-xs">Tasdiqlash</button>
                <button className="flex-1 py-1.5 bg-red-100 text-red-600 rounded-lg font-bold text-xs">Rad etish</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3 animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800">Tizim sozlamalari</h3>
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="font-bold text-gray-800">Xitoy karqo provayderi (Ichki)</p>
                <p className="text-gray-500 mt-0.5">Faol provayder: Standart ombor</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="font-bold text-gray-800">Tarif: $9.5 / kg</p>
                <p className="text-gray-500 mt-0.5">Kurs: 1 USD = 12,850 UZS</p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
