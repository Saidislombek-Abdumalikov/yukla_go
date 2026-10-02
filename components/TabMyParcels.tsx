import React, { useState, useEffect, useMemo } from 'react';
import { Parcel, ParcelStatus } from '../types';
import { api } from '../services/api';
import { DEV_DEFAULT_RATES } from '../constants';

interface TabMyParcelsProps {
  refreshTrigger?: number;
  onAddClick?: () => void;
}

type FilterTab = 'ALL' | 'TRANSIT' | 'UZBEKISTAN' | 'DELIVERED';

const statusLabels: Record<ParcelStatus, { label: string; color: string }> = {
  added: { label: 'Kiritildi', color: 'bg-gray-100 text-gray-700' },
  china_warehouse: { label: 'Xitoy omborida', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  in_transit: { label: 'Yo\'lda', color: 'bg-blue-100 text-blue-800' },
  uzbekistan: { label: 'O\'zbekistonda', color: 'bg-amber-100 text-amber-800' },
  delivered: { label: 'Yetkazildi', color: 'bg-green-100 text-green-800' },
};

const TabMyParcels: React.FC<TabMyParcelsProps> = ({ refreshTrigger = 0, onAddClick }) => {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getParcels()
      .then(data => {
        setParcels(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setParcels([]);
        setLoading(false);
      });
  }, [refreshTrigger]);

  const safeParcels = Array.isArray(parcels) ? parcels : [];

  const filteredParcels = useMemo(() => {
    return safeParcels.filter(p => {
      // Tab filter
      if (activeTab === 'TRANSIT' && !(p.status === 'in_transit' || p.status === 'china_warehouse' || p.status === 'added')) return false;
      if (activeTab === 'UZBEKISTAN' && p.status !== 'uzbekistan') return false;
      if (activeTab === 'DELIVERED' && p.status !== 'delivered') return false;

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        return p.trackingNumber.toLowerCase().includes(query);
      }

      return true;
    });
  }, [safeParcels, activeTab, searchQuery]);

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const currentIds = filteredParcels.map(p => p.id);
    const allSelected = currentIds.length > 0 && currentIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      currentIds.forEach(id => next.delete(id));
    } else {
      currentIds.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const totals = useMemo(() => {
    let weight = 0;
    let price = 0;
    selectedIds.forEach(id => {
      const p = safeParcels.find(item => item.id === id);
      if (p) {
        weight += p.weightKg || 0;
        price += p.amount || 0;
      }
    });
    return { weight, price, count: selectedIds.size };
  }, [selectedIds, safeParcels]);

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
      
      {/* Header & Search */}
      <div className="shrink-0 space-y-3 mb-3 z-10">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight">Yuklarim</h2>
          <span className="text-xs font-bold text-gray-500 bg-white px-2.5 py-1 rounded-full border border-gray-100 shadow-sm font-mono">
            {safeParcels.length} ta yuk
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Trek raqami bo'yicha qidirish..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl outline-none focus:border-primary text-xs font-medium text-gray-800 placeholder:text-gray-400 shadow-sm transition-all"
          />
          <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Category Tabs */}
        <div className="bg-white p-1 rounded-2xl border border-gray-100 flex shadow-sm text-xs font-bold">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`flex-1 py-2 rounded-xl transition-all ${activeTab === 'ALL' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Barchasi
          </button>
          <button
            onClick={() => setActiveTab('TRANSIT')}
            className={`flex-1 py-2 rounded-xl transition-all ${activeTab === 'TRANSIT' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Yo'lda
          </button>
          <button
            onClick={() => setActiveTab('UZBEKISTAN')}
            className={`flex-1 py-2 rounded-xl transition-all ${activeTab === 'UZBEKISTAN' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            O'zbekistonda
          </button>
          <button
            onClick={() => setActiveTab('DELIVERED')}
            className={`flex-1 py-2 rounded-xl transition-all ${activeTab === 'DELIVERED' ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
          >
            Yetkazildi
          </button>
        </div>
      </div>

      {/* Select All Action */}
      {filteredParcels.length > 0 && (
        <div className="flex justify-end px-1 mb-2 shrink-0">
          <button 
            onClick={toggleSelectAll}
            className="text-[11px] font-bold text-primary hover:underline"
          >
            {filteredParcels.every(p => selectedIds.has(p.id)) ? 'Tanlashni bekor qilish' : 'Hammasini tanlash'}
          </button>
        </div>
      )}

      {/* Scrollable Parcel List */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 space-y-2.5">
        {loading ? (
          <div className="text-center py-16">
            <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-400 text-xs font-bold mt-2">Yuklanmoqda...</p>
          </div>
        ) : filteredParcels.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-gray-200 p-6 space-y-3">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center text-xl mx-auto">
              📦
            </div>
            <p className="text-gray-700 font-bold text-sm">Yuklar topilmadi</p>
            <p className="text-gray-400 text-xs max-w-xs mx-auto">
              {searchQuery ? "Ushbu qidiruv bo'yicha hech qanday yuk topilmadi" : "Buyurtmangiz trek raqamini qo'shib, uning yo'nalishini kuzating"}
            </p>
            {onAddClick && (
              <button
                onClick={onAddClick}
                className="mt-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl active:scale-95 transition-transform shadow-md shadow-primary/20"
              >
                + Trek qo'shish
              </button>
            )}
          </div>
        ) : (
          filteredParcels.map(parcel => {
            const isExpanded = expandedId === parcel.id;
            const isSelected = selectedIds.has(parcel.id);
            const statusConfig = statusLabels[parcel.status] || { label: parcel.status, color: 'bg-gray-100 text-gray-700' };

            return (
              <div
                key={parcel.id}
                onClick={() => setExpandedId(isExpanded ? null : parcel.id)}
                className={`bg-white rounded-2xl border transition-all cursor-pointer overflow-hidden ${
                  isExpanded ? 'shadow-md border-primary/30' : 'shadow-sm border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className="p-3.5 flex items-center gap-3">
                  {/* Select Checkbox */}
                  <div
                    onClick={(e) => toggleSelect(e, parcel.id)}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                      isSelected ? 'bg-primary border-primary text-white' : 'bg-gray-50 border-gray-300'
                    }`}
                  >
                    {isSelected && (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  {/* Parcel Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-mono font-bold text-gray-900 text-sm truncate uppercase tracking-tight">
                        {parcel.trackingNumber}
                      </h4>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${statusConfig.color}`}>
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-1">
                      <span className="font-bold text-gray-700 bg-gray-100 px-1.5 py-0.2 rounded font-mono">
                        {parcel.weightKg ? `${parcel.weightKg} kg` : '-'}
                      </span>
                      <span>•</span>
                      <span className="font-mono">${parcel.amount?.toFixed(2) || '0.00'}</span>
                      <span>•</span>
                      <span className={parcel.paymentStatus === 'paid' ? 'text-green-600 font-bold' : 'text-amber-600 font-bold'}>
                        {parcel.paymentStatus === 'paid' ? 'To\'langan' : 'To\'lov kutilmoqda'}
                      </span>
                    </div>
                  </div>

                  {/* Expand Chevron */}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-gray-50 bg-gray-50/50 text-xs space-y-2 animate-fade-in">
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Xitoy sanasi</p>
                        <p className="font-bold text-gray-800">{parcel.chinaDate || '-'}</p>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Kutilayotgan sana</p>
                        <p className="font-bold text-primary">{parcel.estimatedArrival || 'Aniqlanmoqda'}</p>
                      </div>
                    </div>

                    {parcel.deliveryBranchSnapshot && (
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold uppercase">Yetkazish filiali</p>
                        <p className="font-bold text-gray-800">
                          {parcel.deliveryBranchSnapshot.provider} — {parcel.deliveryBranchSnapshot.branchName}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{parcel.deliveryBranchSnapshot.address}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Summary Bar (When items selected) */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-40 animate-slide-up">
          <div className="bg-[#185A96] text-white rounded-2xl p-4 shadow-xl shadow-blue-900/30 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase font-bold text-blue-200">
                Tanlangan ({totals.count} ta)
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black">${totals.price.toFixed(2)}</span>
                <span className="text-xs text-blue-200 font-medium">({totals.weight.toFixed(1)} kg)</span>
              </div>
              <p className="text-[10px] text-blue-200 font-mono">
                ≈ {Math.round(totals.price * DEV_DEFAULT_RATES.exchangeRate).toLocaleString()} UZS
              </p>
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
            >
              Tozalash
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default TabMyParcels;