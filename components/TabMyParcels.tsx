import React, { useState, useEffect, useMemo } from 'react';
import { getUserTracks, findParcel, getAppSettings, fetchArrivedReys, isReysArrived, clearDataCache, removeUserTrack } from '../services/storageService';
import { SavedTrack, ParcelData } from '../types';

interface TabMyParcelsProps {
    refreshTrigger?: number;
}

type Category = 'ARRIVED' | 'TRANSIT' | 'UNKNOWN';

const TabMyParcels: React.FC<TabMyParcelsProps> = ({ refreshTrigger = 0 }) => {
  const [activeCategory, setActiveCategory] = useState<Category>('ARRIVED');
  const [savedTracks, setSavedTracks] = useState<SavedTrack[]>([]);
  const [refresh, setRefresh] = useState(0); 
  const [parcelDataMap, setParcelDataMap] = useState<Record<string, ParcelData | null>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [arrivedReys, setArrivedReys] = useState<{avia: string[], avto: string[]} | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const settings = getAppSettings();

  const handleRefresh = () => {
      clearDataCache();
      setRefresh(prev => prev + 1);
  };

  useEffect(() => {
    fetchArrivedReys().then(setArrivedReys);
  }, [refresh, refreshTrigger]);

  useEffect(() => {
    const tracks = getUserTracks();
    setSavedTracks(tracks);
    setLoading(true);

    const loadData = async () => {
        const newDataMap: Record<string, ParcelData | null> = {};
        
        // Parallel fetch for better performance
        await Promise.all(tracks.map(async (track) => {
             const data = await findParcel(track.id);
             
             // Check arrival status immediately
             if (data && arrivedReys && isReysArrived(data.boxCode, arrivedReys)) {
                 if (!data.history[0].status.includes('Toshkentga yetib keldi')) {
                    data.history = [{
                        date: "Hozir",
                        time: "",
                        status: `Toshkentga yetib keldi ${data.boxCode ? `(${data.boxCode})` : ''}`,
                        location: "Toshkent Ombori",
                        completed: true
                    }, ...data.history];
                 }
            }
            newDataMap[track.id] = data;
        }));
        
        setParcelDataMap(newDataMap);
        setLoading(false);
    };

    if (arrivedReys || tracks.length > 0) {
        loadData();
    } else {
        setLoading(false);
    }
  }, [refresh, arrivedReys, refreshTrigger]);

  const groups = useMemo(() => {
    const arrived: string[] = [];
    const inTransit: string[] = [];
    const unknown: string[] = [];

    savedTracks.forEach(track => {
      const data = parcelDataMap[track.id];
      if (!data) {
        unknown.push(track.id);
      } else {
        const isArrived = data.history[0].status.includes('Toshkentga yetib keldi');
        if (isArrived) arrived.push(track.id);
        else inTransit.push(track.id);
      }
    });

    return { arrived, inTransit, unknown };
  }, [savedTracks, parcelDataMap]);

  // Auto-switch tab logic: prefer showing tabs with content
  useEffect(() => {
      if (groups.arrived.length === 0 && groups.inTransit.length > 0 && activeCategory === 'ARRIVED') {
          setActiveCategory('TRANSIT');
      } else if (groups.arrived.length === 0 && groups.inTransit.length === 0 && groups.unknown.length > 0 && activeCategory === 'ARRIVED') {
          setActiveCategory('UNKNOWN');
      }
  }, [groups.arrived.length, groups.inTransit.length, groups.unknown.length]);

  const totals = useMemo(() => {
    let weight = 0;
    let price = 0;
    selectedIds.forEach(id => {
      const data = parcelDataMap[id];
      if (data) {
        weight += parseFloat(data.weight) || 0;
        price += data.price || 0;
      }
    });
    return { weight, price, count: selectedIds.size };
  }, [selectedIds, parcelDataMap]);

  const toggleSelect = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleGroup = (ids: string[]) => {
    const next = new Set(selectedIds);
    // Check if ALL currently filtered IDs are selected
    const allIn = ids.every(id => next.has(id));
    
    if (allIn) {
      ids.forEach(id => next.delete(id));
    } else {
      ids.forEach(id => next.add(id));
    }
    setSelectedIds(next);
  };

  const calculateEstimatedDate = (arrivedDateStr: string, boxCode: string | undefined): string => {
      try {
          const date = new Date(arrivedDateStr);
          if (isNaN(date.getTime())) return "Aniqlanmoqda...";
          const isAvia = boxCode?.toLowerCase().includes('avia');
          const daysToAdd = isAvia ? 5 : 18;
          const estimated = new Date(date);
          estimated.setDate(date.getDate() + daysToAdd);
          return estimated.toLocaleDateString();
      } catch (e) {
          return "Aniqlanmoqda...";
      }
  };

  const renderParcelCard = (id: string, groupType: 'arrived' | 'transit' | 'unknown') => {
    const data = parcelDataMap[id];
    const isExpanded = expandedId === id;
    const isSelected = selectedIds.has(id);
    const reysName = data?.boxCode || 'Kutilmoqda';
    const isAvia = reysName.toLowerCase().includes('avia');
    const chinaDate = data && data.history.length > 0 ? data.history[data.history.length - 1].date : '-';
    
    return (
      <div 
        key={id} 
        onClick={() => setExpandedId(isExpanded ? null : id)}
        className={`bg-white rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden relative mb-3 ${
            isExpanded ? 'shadow-lg border-primary/20 scale-[1.01]' : 'shadow-sm border-gray-100 hover:shadow-md'
        } ${groupType === 'arrived' ? 'ring-1 ring-green-400 shadow-green-100' : ''}`}
      >
        <div className="p-4 flex items-center gap-3">
            {/* Checkbox for selection */}
            {groupType !== 'unknown' && (
              <div 
                onClick={(e) => toggleSelect(e, id)}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'bg-primary border-primary text-white' : 'bg-gray-50 border-gray-200'}`}
              >
                {isSelected && <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
            )}

            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${groupType === 'arrived' ? 'bg-green-100 text-green-600' : (data ? (isAvia ? 'bg-blue-50 text-blue-500' : 'bg-orange-50 text-orange-500') : 'bg-gray-100 text-gray-400')}`}>
                 {data ? (isAvia ? '✈️' : '🚛') : '?'}
            </div>

            <div className="min-w-0 flex-1">
                <h4 className="font-bold text-gray-900 text-sm truncate uppercase tracking-tight">{id}</h4>
                <div className="flex items-center gap-2 text-[11px] text-gray-500">
                    {data ? (
                        <>
                            <span className="font-bold text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{data.weight} kg</span>
                            <span>•</span>
                            <span className={`font-medium ${groupType === 'arrived' ? 'text-green-600' : 'text-blue-600'}`}>{reysName}</span>
                        </>
                    ) : (
                        <span className="text-gray-400 italic">Hali bazaga kirmagan</span>
                    )}
                </div>
            </div>

            <div className={`text-gray-300 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
        </div>

        {isExpanded && data && (
            <div className="px-4 pb-4 pt-0 border-t border-gray-50 animate-fade-in bg-gray-50/30">
                <div className="grid grid-cols-2 gap-2 mt-4">
                    <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">Xitoy Sanasi</p>
                        <p className="text-xs font-bold text-gray-800">{chinaDate}</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-xl border border-gray-100">
                        <p className="text-[9px] text-gray-400 font-bold uppercase">Tahminiy Kelish</p>
                        <p className="text-xs font-bold text-blue-600">{groupType === 'arrived' ? "Kelgan" : calculateEstimatedDate(chinaDate, data.boxCode)}</p>
                    </div>
                    {data.price && data.price > 0 && (
                         <div className="col-span-2 bg-green-50/50 p-3 rounded-xl border border-green-100 flex justify-between items-center">
                            <div>
                                <p className="text-[9px] text-green-600 font-bold uppercase">Narxi</p>
                                <p className="text-lg font-black text-green-700">${data.price.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[9px] text-green-500 font-medium">UZS</p>
                                <p className="text-xs font-bold text-green-600">≈ {(data.price * settings.exchangeRate).toLocaleString()}</p>
                            </div>
                         </div>
                    )}
                </div>
            </div>
        )}
        
        {isExpanded && !data && (
             <div className="px-4 pb-4 pt-0 border-t border-gray-50 animate-fade-in bg-gray-50/30">
                 <p className="text-xs text-gray-400 mt-4 text-center">Ushbu yuk hali bazaga kiritilmagan. Iltimos kuting, yuk Xitoy omboriga yetib borgach, ma'lumotlar chiqadi.</p>
             </div>
        )}
      </div>
    );
  };

  const getCurrentList = () => {
      switch(activeCategory) {
          case 'ARRIVED': return groups.arrived;
          case 'TRANSIT': return groups.inTransit;
          case 'UNKNOWN': return groups.unknown;
          default: return [];
      }
  };

  const currentList = getCurrentList();

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in">
      
      {/* HEADER SECTION (Fixed) */}
      <div className="shrink-0 space-y-4 mb-2 z-10">
        <div className="flex items-center justify-between px-1">
           <h3 className="text-2xl font-black text-gray-800 tracking-tight">Mening Yuklarim</h3>
           <button onClick={handleRefresh} className="text-primary text-xs font-bold flex items-center gap-1 bg-white px-3 py-2 rounded-full shadow-sm border border-gray-100 active:scale-95">
              <svg className={`w-3.5 h-3.5 ${refresh > 0 ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
           </button>
        </div>

        {/* CATEGORY TABS */}
        <div className="bg-white p-1.5 rounded-2xl border border-gray-100 flex shadow-sm">
            <button 
              onClick={() => setActiveCategory('ARRIVED')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${activeCategory === 'ARRIVED' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <span>Yetib Kelgan</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${activeCategory === 'ARRIVED' ? 'bg-white/50' : 'bg-gray-100'}`}>{groups.arrived.length}</span>
            </button>
            <button 
              onClick={() => setActiveCategory('TRANSIT')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${activeCategory === 'TRANSIT' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <span>Yo'lda</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${activeCategory === 'TRANSIT' ? 'bg-white/50' : 'bg-gray-100'}`}>{groups.inTransit.length}</span>
            </button>
            <button 
              onClick={() => setActiveCategory('UNKNOWN')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center gap-1 ${activeCategory === 'UNKNOWN' ? 'bg-gray-100 text-gray-700 shadow-sm' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              <span>Noma'lum</span>
              <span className={`px-1.5 py-0.5 rounded text-[9px] ${activeCategory === 'UNKNOWN' ? 'bg-white/50' : 'bg-gray-200'}`}>{groups.unknown.length}</span>
            </button>
        </div>
      </div>

      {/* SCROLLABLE LIST SECTION */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-32 px-2 -mx-2 pt-2 scroll-smooth overscroll-contain">
          {savedTracks.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[40px] border border-dashed border-gray-200 mt-2">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <p className="text-gray-500 font-bold text-lg">Hozircha yuklar yo'q</p>
                <p className="text-gray-400 text-sm mt-1 px-8">Kuzatuv raqamini qo'shish uchun pastdagi "+" tugmasini bosing</p>
            </div>
          ) : (
            <>
                {currentList.length > 0 && activeCategory !== 'UNKNOWN' && (
                    <div className="flex justify-end px-1 mb-2">
                         <button 
                            onClick={() => toggleGroup(currentList)}
                            className="text-[10px] font-bold text-primary bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                        >
                            {currentList.every(id => selectedIds.has(id)) ? 'Bekor qilish' : 'Hammasini tanlash'}
                        </button>
                    </div>
                )}

                {loading ? (
                     <div className="text-center py-10">
                         <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
                         <p className="text-gray-400 text-xs font-bold mt-2">Yuklanmoqda...</p>
                     </div>
                ) : currentList.length === 0 ? (
                     <div className="text-center py-10 opacity-50">
                         <p className="text-gray-400 font-medium text-sm">Bu bo'limda yuklar yo'q</p>
                     </div>
                ) : (
                    currentList.map(id => renderParcelCard(
                        id, 
                        activeCategory === 'ARRIVED' ? 'arrived' : activeCategory === 'TRANSIT' ? 'transit' : 'unknown'
                    ))
                )}
            </>
          )}
      </div>

      {/* FLOATING CALCULATOR SUMMARY */}
      {selectedIds.size > 0 && activeCategory !== 'UNKNOWN' && (
        <div className="fixed bottom-28 left-4 right-4 z-[60] animate-slide-up">
           <div className="bg-gray-900 text-white rounded-3xl p-5 shadow-2xl shadow-blue-900/40 border border-white/10 flex items-center justify-between backdrop-blur-md bg-opacity-90">
              <div className="flex flex-col">
                <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Tanlangan ({totals.count})</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white">${totals.price.toFixed(2)}</span>
                  <span className="text-xs text-blue-200/60 font-medium">({totals.weight.toFixed(1)} kg)</span>
                </div>
                <p className="text-[10px] text-blue-300 font-bold">≈ {(totals.price * settings.exchangeRate).toLocaleString()} UZS</p>
              </div>
              <button 
                onClick={() => setSelectedIds(new Set())}
                className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default TabMyParcels;