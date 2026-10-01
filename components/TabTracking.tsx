
import React, { useState, useEffect } from 'react';
import { findParcel, saveUserTrack, getAppSettings, fetchArrivedReys, isReysArrived } from '../services/storageService';
import { ParcelData } from '../types';

const TabTracking: React.FC = () => {
  const [trackingId, setTrackingId] = useState('');
  const [result, setResult] = useState<ParcelData | null | 'NOT_FOUND'>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [arrivedReys, setArrivedReys] = useState<{avia: string[], avto: string[]} | null>(null);

  useEffect(() => {
    fetchArrivedReys().then(setArrivedReys);
  }, []);

  const handleTrack = async () => {
    if (!trackingId.trim()) return;
    
    setLoading(true);
    setResult(null);
    setSaved(false);

    try {
        const data = await findParcel(trackingId.trim());
        
        // CHECK IF ARRIVED
        if (data && arrivedReys && isReysArrived(data.boxCode, arrivedReys)) {
             data.history.unshift({
                 date: "Hozir",
                 time: "",
                 status: `Toshkentga yetib keldi ${data.boxCode ? `(${data.boxCode})` : ''}`,
                 location: "Toshkent Ombori",
                 completed: true
             });
        }

        setResult(data || 'NOT_FOUND');
    } catch (e) {
        setResult('NOT_FOUND');
    } finally {
        setLoading(false);
    }
  };

  const handleSave = () => {
      if (result && result !== 'NOT_FOUND') {
          saveUserTrack(result.id);
          setSaved(true);
      }
  };

  const getChinaDate = (data: ParcelData) => {
      // The original China event is always the last one since we unshift new events
      if (data && data.history.length > 0) {
          return data.history[data.history.length - 1].date;
      }
      return '-';
  };

  return (
    <div className="space-y-6 pb-32 animate-fade-in">
      <div className="bg-white p-6 rounded-[32px] shadow-soft sticky top-24 z-10 border border-gray-100">
        <h2 className="text-2xl font-bold text-text mb-2">Yuk Qidirish</h2>
        <div className="relative mb-4">
          <input
            type="text"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="JEK-882..."
            className="w-full pl-12 pr-4 py-4 bg-secondary rounded-2xl outline-none focus:ring-2 focus:ring-primary/20 transition-all font-bold text-lg uppercase text-text placeholder-text-secondary/50"
          />
          <div className="absolute left-4 top-4 text-text-secondary">
             <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        <button
          onClick={handleTrack}
          disabled={loading || !trackingId}
          className={`w-full py-4 rounded-2xl font-bold text-white transition-all shadow-lg active:scale-95 ${
            loading || !trackingId ? 'bg-gray-300 shadow-none' : 'bg-primary shadow-primary/30'
          }`}
        >
          {loading ? (
             <span className="flex items-center justify-center gap-2">
               <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
               Izlanmoqda...
             </span>
          ) : 'Kuzatish'}
        </button>
      </div>

      {/* Arrived Reys Card (Shown when not viewing a specific result) */}
      {arrivedReys && (arrivedReys.avia.length > 0 || arrivedReys.avto.length > 0) && !result && (
        <div className="bg-white rounded-[32px] p-6 shadow-soft border border-gray-100 space-y-4 relative overflow-hidden animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
                 <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <h3 className="font-bold text-gray-900 text-lg">Toshkentga Yetib Keldi</h3>
            </div>
            
            <p className="text-xs text-gray-500 mb-2">
              Ushbu reyslar Toshkent omboriga yetib kelgan. Agar reys kodingiz shu yerda bo'lsa, yukingizni olib ketishingiz mumkin.
            </p>

            {arrivedReys.avia.length > 0 && (
                 <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100/50">
                     <div className="flex items-center gap-2 mb-3">
                         <span className="text-2xl">✈️</span>
                         <span className="text-sm font-bold text-blue-900/60 uppercase tracking-wide">Avia Reyslar</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                         {arrivedReys.avia.map((r, i) => (
                             <span key={i} className="bg-white text-blue-600 font-bold px-3 py-2 rounded-xl text-base shadow-sm border border-blue-100">{r}</span>
                         ))}
                     </div>
                 </div>
            )}

            {arrivedReys.avto.length > 0 && (
                 <div className="bg-orange-50/50 rounded-2xl p-4 border border-orange-100/50">
                     <div className="flex items-center gap-2 mb-3">
                         <span className="text-2xl">🚛</span>
                         <span className="text-sm font-bold text-orange-900/60 uppercase tracking-wide">Avto Reyslar</span>
                     </div>
                     <div className="flex flex-wrap gap-2">
                         {arrivedReys.avto.map((r, i) => (
                             <span key={i} className="bg-white text-orange-600 font-bold px-3 py-2 rounded-xl text-base shadow-sm border border-orange-100">{r}</span>
                         ))}
                     </div>
                 </div>
            )}
        </div>
      )}

      {/* Result Card */}
      {result && result !== 'NOT_FOUND' && (
        <div className="bg-white rounded-[32px] overflow-hidden shadow-soft border border-gray-100 animate-slide-up">
            <div className="bg-gray-50 p-6 border-b border-gray-100">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs font-bold text-text-secondary uppercase mb-1">Track ID</p>
                        <h3 className="text-3xl font-black text-text tracking-tight">{result.id}</h3>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${result.boxCode?.toLowerCase().includes('avia') ? 'bg-blue-100 text-primary' : 'bg-orange-100 text-orange-600'}`}>
                        {result.boxCode?.toLowerCase().includes('avia') ? '✈️ AVIA' : '🚛 AVTO'}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Xitoy Sanasi</p>
                        <p className="text-xl font-bold text-gray-800">{getChinaDate(result)}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-xs text-gray-400 font-bold uppercase mb-1">Reys</p>
                        <p className="text-xl font-bold text-primary">{result.boxCode || '-'}</p>
                    </div>
                </div>

                {result.price && result.price > 0 && (
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                        <div className="flex justify-between items-end">
                            <div>
                                <p className="text-xs text-green-600 font-bold uppercase mb-1">Hisoblangan Narx</p>
                                <p className="text-3xl font-black text-green-700">${result.price.toFixed(2)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-green-600/70 mb-1">So'mda</p>
                                <p className="text-lg font-bold text-green-700">
                                    {(result.price * getAppSettings().exchangeRate).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-4 pt-2">
                    <p className="text-xs font-bold text-gray-400 uppercase ml-1">So'nggi holat</p>
                    {result.history.map((event, i) => {
                        const isArrived = event.status.includes('Toshkentga yetib keldi');
                        return (
                            <div key={i} className="flex gap-4 relative">
                                {/* Line */}
                                {i !== result.history.length - 1 && (
                                    <div className="absolute left-[19px] top-8 bottom-[-16px] w-0.5 bg-gray-100"></div>
                                )}
                                
                                <div className={`w-10 h-10 rounded-full border-4 border-white shadow-sm flex items-center justify-center shrink-0 z-10 ${isArrived ? 'bg-green-100 animate-pulse' : 'bg-blue-50'}`}>
                                    <div className={`w-3 h-3 rounded-full ${isArrived ? 'bg-green-600' : 'bg-primary'}`}></div>
                                </div>
                                <div className="pt-1">
                                    <p className={`font-bold text-lg ${isArrived ? 'text-green-600' : 'text-text'}`}>{event.status}</p>
                                    <p className="text-sm text-text-secondary">{event.location}</p>
                                    <p className="text-xs text-gray-400 mt-1 font-mono">{event.date}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <button 
                    onClick={handleSave}
                    disabled={saved}
                    className={`w-full py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                        saved 
                        ? 'bg-green-100 text-green-600' 
                        : 'bg-primary-dark text-white shadow-lg active:scale-95'
                    }`}
                >
                    {saved ? (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Saqlandi
                        </>
                    ) : (
                        "Mening yuklarimga qo'shish"
                    )}
                </button>
            </div>
        </div>
      )}

      {/* Not Found State */}
      {result === 'NOT_FOUND' && (
          <div className="bg-white rounded-[32px] p-8 text-center shadow-soft border border-gray-100 animate-slide-up">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-400">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Yuk Topilmadi</h3>
              <p className="text-gray-500 mb-6">
                  Kiritilgan ID bo'yicha ma'lumot yo'q. ID raqamini tekshirib qaytadan urining.
              </p>
              <button 
                onClick={() => setResult(null)}
                className="text-primary font-bold hover:underline"
              >
                  Qayta urinish
              </button>
          </div>
      )}
    </div>
  );
};

export default TabTracking;
