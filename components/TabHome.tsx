import React, { useState, useEffect } from 'react';
import { Tab, UserProfile, ChinaWarehouseAddress, Parcel } from '../types';
import { api } from '../services/api';

interface TabHomeProps {
  onNavigate: (tab: Tab) => void;
  onAddClick: () => void;
  onOpenAcademy?: () => void;
  refreshTrigger?: number;
}

const TabHome: React.FC<TabHomeProps> = ({ onNavigate, onAddClick, onOpenAcademy, refreshTrigger = 0 }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [warehouse, setWarehouse] = useState<ChinaWarehouseAddress | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load data on mount & whenever trigger updates
  const loadData = () => {
    api.getProfile().then(setUser).catch(() => {});
    api.getWarehouseAddress().then(setWarehouse).catch(() => {});
    api.getParcels().then(data => {
      setParcels(Array.isArray(data) ? data : []);
    }).catch(() => {
      setParcels([]);
    });
  };

  useEffect(() => {
    loadData();
    // Also re-check when window regains focus (e.g. user switched back from admin tab)
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refreshTrigger]);

  const handleCopyFull = () => {
    if (!warehouse) return;
    const textToCopy = `收件人: ${warehouse.receiver}\n手机号码: ${warehouse.phone}\n所在地区: ${warehouse.region}\n详细地址: ${warehouse.address}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const safeParcels = Array.isArray(parcels) ? parcels : [];
  const inTransitCount = safeParcels.filter(p => p.status === 'in_transit' || p.status === 'china_warehouse' || p.status === 'added').length;
  const uzbCount = safeParcels.filter(p => p.status === 'uzbekistan').length;
  const deliveredCount = safeParcels.filter(p => p.status === 'delivered').length;

  return (
    <div className="space-y-4 pb-32 animate-fade-in">
      
      {/* Header */}
      <div className="flex justify-between items-center px-1 pt-1">
        <div>
          <p className="text-text-secondary text-[11px] font-bold uppercase tracking-wide">Xush kelibsiz,</p>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Salom, {user?.name || 'Mijoz'} 👋
          </h1>
        </div>
        <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-xs font-black tracking-wider font-mono shadow-sm">
          {user?.customerCode || 'YK-###'}
        </div>
      </div>

      {/* China Warehouse Address Card (Clean, Clickable Card) */}
      <div 
        onClick={() => setShowAddressModal(true)}
        className="w-full relative overflow-hidden bg-gradient-to-br from-[#185A96] to-[#114270] rounded-3xl p-5 text-white shadow-xl shadow-blue-900/20 group cursor-pointer active:scale-[0.99] transition-all hover:shadow-2xl"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🇨🇳</span>
              <span className="font-bold text-xs uppercase tracking-wider text-blue-100">Xitoy ombori</span>
            </div>
            <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold">
              {user?.customerCode || 'YK-###'}
            </span>
          </div>

          <div className="my-3 text-center py-2 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10">
            <p className="text-[10px] text-blue-200 uppercase font-bold tracking-wider mb-0.5">Sizning mijoz kodingiz</p>
            <p className="text-3xl font-black tracking-wider font-mono text-white leading-none">
              {user?.customerCode || 'YK-###'}
            </p>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <span className="text-xs font-bold text-blue-100 flex items-center gap-1.5">
              <span>Manzilni ko'rish va nusxalash</span>
            </span>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Parcel Overview Counters */}
      <div>
        <div className="flex justify-between items-center mb-2 px-1">
          <h3 className="text-sm font-black text-gray-900">Yuklar holati</h3>
          <button 
            onClick={() => onNavigate(Tab.MY_PARCELS)}
            className="text-xs font-bold text-primary hover:underline"
          >
            Barchasi &rarr;
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div 
            onClick={() => onNavigate(Tab.MY_PARCELS)}
            className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-soft cursor-pointer hover:border-primary/20 transition-all text-center"
          >
            <p className="text-2xl font-black text-primary leading-none mb-1">{inTransitCount}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Yo'lda</p>
          </div>

          <div 
            onClick={() => onNavigate(Tab.MY_PARCELS)}
            className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-soft cursor-pointer hover:border-primary/20 transition-all text-center"
          >
            <p className="text-2xl font-black text-amber-500 leading-none mb-1">{uzbCount}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">O'zbekistonda</p>
          </div>

          <div 
            onClick={() => onNavigate(Tab.MY_PARCELS)}
            className="bg-white p-3.5 rounded-2xl border border-gray-100 shadow-soft cursor-pointer hover:border-primary/20 transition-all text-center"
          >
            <p className="text-2xl font-black text-green-600 leading-none mb-1">{deliveredCount}</p>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Yetkazildi</p>
          </div>
        </div>
      </div>

      {/* Quick Action: Add Track */}
      <div className="pt-1">
        <button
          onClick={onAddClick}
          className="w-full bg-white border border-gray-200 hover:border-primary p-4 rounded-2xl shadow-soft flex items-center justify-between active:scale-[0.99] transition-all group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xl group-hover:bg-primary group-hover:text-white transition-colors">
              +
            </div>
            <div className="text-left">
              <p className="font-bold text-sm text-gray-900">Yangi track qo'shish</p>
              <p className="text-[11px] text-gray-500">Buyurtmangiz trek kodini kiriting</p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Akademiya / Video Darslar Promotional Card */}
      {onOpenAcademy && (
        <div 
          onClick={onOpenAcademy}
          className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 rounded-2xl p-4 text-white shadow-lg shadow-orange-500/20 cursor-pointer active:scale-[0.99] transition-all flex items-center justify-between group hover:shadow-xl"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-xl shadow-inner">
              🎓
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-black text-sm text-white">Video Darslar & Akademiya</h4>
                <span className="text-[9px] bg-white/25 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">BEPUL</span>
              </div>
              <p className="text-[11px] text-amber-100 font-medium">Xitoydan to'g'ri buyurtma berish kursi</p>
            </div>
          </div>
          <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      )}

      {/* Warehouse Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in modal-backdrop">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🇨🇳</span>
                <h3 className="font-black text-base text-gray-900">Xitoy ombor manzili</h3>
              </div>
              <button 
                onClick={() => setShowAddressModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {/* Address Details Card */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-3 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Qabul qiluvchi (收件人):</span>
                <p className="font-bold text-gray-900 select-all font-mono">{warehouse?.receiver || 'Yukla Go'}</p>
              </div>

              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Telefon (手机号码):</span>
                <p className="font-bold text-gray-900 select-all font-mono">{warehouse?.phone || '-'}</p>
              </div>

              <div>
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Manzil (详细地址):</span>
                <p className="font-bold text-gray-900 select-all leading-relaxed">
                  {warehouse?.region} {warehouse?.address}
                </p>
              </div>
            </div>

            {/* Helper Note for Taobao */}
            <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 text-[11px] text-blue-900/80 leading-relaxed">
              💡 <b>Maslahat:</b> Taobao yoki Pinduoduo ilovasida manzil qo'shishda nusxalangan matnni to'g'ridan-to'g'ri joylasangiz (Paste), barcha qatorlar avtomatik to'ldiriladi.
            </div>

            {/* Single Prominent Copy Button */}
            <button
              onClick={handleCopyFull}
              className={`w-full py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md ${
                copied
                  ? 'bg-green-600 text-white shadow-green-600/25'
                  : 'bg-primary hover:bg-primary-dark text-white shadow-primary/25'
              }`}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  <span>To'liq manzil nusxalandi!</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  <span>Butun manzilni nusxalash</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TabHome;
