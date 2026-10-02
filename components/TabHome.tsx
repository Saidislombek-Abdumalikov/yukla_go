import React, { useState, useEffect } from 'react';
import { Tab, UserProfile, ChinaWarehouseAddress, Parcel } from '../types';
import { api } from '../services/api';

interface TabHomeProps {
  onNavigate: (tab: Tab) => void;
  onAddClick: () => void;
  refreshTrigger?: number;
}

const TabHome: React.FC<TabHomeProps> = ({ onNavigate, onAddClick, refreshTrigger = 0 }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [warehouse, setWarehouse] = useState<ChinaWarehouseAddress | null>(null);
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then(setUser).catch(() => {});
    api.getWarehouseAddress().then(setWarehouse).catch(() => {});
    api.getParcels().then(data => {
      setParcels(Array.isArray(data) ? data : []);
    }).catch(() => {
      setParcels([]);
    });
  }, [refreshTrigger]);

  const handleCopyFull = () => {
    if (!warehouse) return;
    const textToCopy = `收件人: ${warehouse.receiver}\n手机号码: ${warehouse.phone}\n所在地区: ${warehouse.region}\n详细地址: ${warehouse.address}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleCopySingle = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 1500);
    });
  };

  const safeParcels = Array.isArray(parcels) ? parcels : [];
  const inTransitCount = safeParcels.filter(p => p.status === 'in_transit' || p.status === 'china_warehouse' || p.status === 'added').length;
  const uzbCount = safeParcels.filter(p => p.status === 'uzbekistan').length;
  const deliveredCount = safeParcels.filter(p => p.status === 'delivered').length;

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      
      {/* Header */}
      <div className="flex justify-between items-center px-1 pt-1">
        <div>
          <p className="text-text-secondary text-[11px] font-bold uppercase tracking-wide">Xush kelibsiz,</p>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            Salom, {user?.name || 'Mijoz'} 👋
          </h1>
        </div>
        <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-xs font-black tracking-wider font-mono">
          {user?.customerCode || 'YK-###'}
        </div>
      </div>

      {/* China Warehouse Address Card */}
      <div className="w-full bg-gradient-to-br from-[#185A96] to-[#114270] rounded-3xl p-5 text-white shadow-xl shadow-blue-900/15 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center gap-2">
              <span className="text-base">🇨🇳</span>
              <span className="font-bold text-xs uppercase tracking-wider text-blue-100">Xitoydagi ombor manzilingiz</span>
            </div>
            <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded font-mono font-bold">
              {user?.customerCode || 'YK-###'}
            </span>
          </div>

          {/* Address Details with quick single-copy clicks */}
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-white/10 space-y-2.5 text-xs">
            <div 
              onClick={() => warehouse && handleCopySingle(warehouse.receiver, 'receiver')}
              className="flex justify-between items-center cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
            >
              <div>
                <span className="text-blue-200 block text-[10px] font-medium uppercase">Qabul qiluvchi (收件人):</span>
                <span className="font-bold text-white select-all">{warehouse?.receiver || 'Yukla Go'}</span>
              </div>
              <span className="text-[10px] text-blue-200 opacity-75 font-mono">
                {copiedField === 'receiver' ? '✓ Nusxalandi' : 'Nusxa'}
              </span>
            </div>

            <div 
              onClick={() => warehouse && handleCopySingle(warehouse.phone, 'phone')}
              className="flex justify-between items-center cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
            >
              <div>
                <span className="text-blue-200 block text-[10px] font-medium uppercase">Telefon (手机号码):</span>
                <span className="font-bold font-mono text-white select-all">{warehouse?.phone || '-'}</span>
              </div>
              <span className="text-[10px] text-blue-200 opacity-75 font-mono">
                {copiedField === 'phone' ? '✓ Nusxalandi' : 'Nusxa'}
              </span>
            </div>

            <div 
              onClick={() => warehouse && handleCopySingle(`${warehouse.region} ${warehouse.address}`, 'address')}
              className="flex justify-between items-start cursor-pointer hover:bg-white/5 p-1 rounded-lg transition-colors"
            >
              <div className="pr-2">
                <span className="text-blue-200 block text-[10px] font-medium uppercase">Manzil (详细地址):</span>
                <span className="font-bold text-white leading-relaxed select-all">
                  {warehouse?.region} {warehouse?.address}
                </span>
              </div>
              <span className="text-[10px] text-blue-200 opacity-75 font-mono shrink-0 mt-3">
                {copiedField === 'address' ? '✓ Nusxalandi' : 'Nusxa'}
              </span>
            </div>
          </div>

          {/* Copy Full Address Button */}
          <button
            onClick={handleCopyFull}
            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-95 ${
              copied 
                ? 'bg-green-500 text-white shadow-sm' 
                : 'bg-white text-primary hover:bg-blue-50 shadow-sm'
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
                <span>To'liq manzilni nusxalash</span>
              </>
            )}
          </button>
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

    </div>
  );
};

export default TabHome;
