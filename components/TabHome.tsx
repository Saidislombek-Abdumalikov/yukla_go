
import React, { useState, useEffect } from 'react';
import { Tab } from '../types';
import { getUserProfile, getAppSettings, getUserTracks, findParcel, fetchArrivedReys, isReysArrived } from '../services/storageService';

interface TabHomeProps {
  onNavigate: (tab: Tab) => void;
}

const TabHome: React.FC<TabHomeProps> = ({ onNavigate }) => {
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [infoModal, setInfoModal] = useState<'AVIA' | null>(null);
  const [isClosing, setIsClosing] = useState(false);
  
  const [copyFeedback, setCopyFeedback] = useState<boolean>(false);

  // Dashboard State
  const [activeStats, setActiveStats] = useState({ arrived: 0, transit: 0 });
  const [loadingStats, setLoadingStats] = useState(true);

  const user = getUserProfile();
  const settings = getAppSettings();
  const clientId = user?.clientId || '0000';
  const firstName = user?.name ? user.name.split(' ')[0] : 'Mijoz';

  useEffect(() => {
    if (infoModal || showAddressModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    }
  }, [infoModal, showAddressModal]);

  // Load basic stats for dashboard
  useEffect(() => {
      const loadDashboard = async () => {
          setLoadingStats(true);
          const tracks = getUserTracks();
          if (tracks.length === 0) {
              setLoadingStats(false);
              return;
          }

          let arrivedCount = 0;
          let transitCount = 0;
          const arrivedData = await fetchArrivedReys();

          // Quick check of statuses
          await Promise.all(tracks.map(async (t) => {
              const p = await findParcel(t.id);
              if (p) {
                  // Check if arrived based on Reys list OR history
                  if (
                      p.history[0].status.includes('Toshkentga yetib keldi') ||
                      (p.boxCode && isReysArrived(p.boxCode, arrivedData))
                  ) {
                      arrivedCount++;
                  } else {
                      transitCount++;
                  }
              }
          }));

          setActiveStats({ arrived: arrivedCount, transit: transitCount });
          setLoadingStats(false);
      };
      loadDashboard();
  }, []);

  const closeModal = () => {
      setIsClosing(true);
      setTimeout(() => {
          setInfoModal(null);
          setShowAddressModal(false);
          setIsClosing(false);
      }, 300);
  };

  const getAddressData = () => {
      let raw = clientId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      
      // Normalize prefix to get just the ID number
      if (raw.startsWith('JEK')) raw = raw.substring(3);
      else if (raw.startsWith('JK')) raw = raw.substring(2);
      else if (raw.startsWith('TT')) raw = raw.substring(2);
      else if (raw.startsWith('TOP')) raw = raw.substring(3);
      else if (raw.startsWith('YAQIIN')) raw = raw.substring(6);
      else if (raw.startsWith('YAQ')) raw = raw.substring(3);
      
      const code = `Yaqiin-${raw}`; 
      const receiver = code;
      const phone = '15757912326';
      const region = '浙江省金华市义乌市';
      const address = `苏溪镇东洪新村11栋3单元1号门 (${code})`;
      
      // Smart string with labels for better clarity when copied
      const smartString = `收件人: ${receiver}\n手机号码: ${phone}\n所在地区: ${region}\n详细地址: ${address}`;
      return { receiver, phone, region, address, smartString, displayCode: code };
  };

  const addressData = getAddressData();

  const handleCopyAll = () => {
      navigator.clipboard.writeText(addressData.smartString).then(() => {
          setCopyFeedback(true);
          setTimeout(() => setCopyFeedback(false), 2000);
      });
  };

  return (
    <div className="space-y-4 pb-32 animate-fade-in">
      
      {/* Header Section */}
      <div className="flex justify-between items-center px-1 pt-1">
        <div>
          <p className="text-text-secondary text-[10px] font-bold uppercase tracking-wide mb-0.5">Xush kelibsiz,</p>
          <h1 className="text-2xl font-black text-text tracking-tight">{firstName} 👋</h1>
        </div>
        <button 
          onClick={() => onNavigate(Tab.PROFILE)}
          className="w-10 h-10 bg-white rounded-xl shadow-soft flex items-center justify-center text-primary font-bold text-lg border border-gray-50 active:scale-95 transition-transform"
        >
          {firstName.charAt(0)}
        </button>
      </div>

      {/* Address Card (Clickable) - YAQIIN CARGO BRANDED */}
      <div 
        onClick={() => setShowAddressModal(true)}
        className="w-full relative overflow-hidden bg-gradient-to-br from-[#fe7d08] to-[#cc5a00] rounded-[24px] p-5 text-white shadow-xl shadow-orange-900/20 group cursor-pointer active:scale-[0.98] transition-all hover:shadow-2xl hover:shadow-orange-900/30"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-yellow-400/20 rounded-full -ml-8 -mb-8 blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center border border-white/10 shadow-inner">
                <span className="font-black text-sm">Y</span>
              </div>
              <div>
                 <span className="block font-bold leading-none text-white/90 text-sm">YAQIIN ID</span>
                 <span className="text-[9px] text-orange-100 font-medium">Shaxsiy Raqam</span>
              </div>
            </div>
            <div className="bg-white/20 backdrop-blur-md px-2.5 py-1 rounded-lg text-[9px] font-bold border border-white/10 group-hover:bg-white/30 transition-colors uppercase tracking-wider flex items-center gap-1">
              <span>🇨🇳</span> Ombor
            </div>
          </div>

          <div className="mb-4 text-center">
            <p className="text-3xl font-mono font-black tracking-wider text-shadow-sm leading-none">{addressData.displayCode}</p>
          </div>

          <div className="flex items-center justify-between border-t border-white/10 pt-3">
            <div className="flex items-center gap-2 text-orange-100 text-[10px] font-bold uppercase tracking-wide">
                <span>Manzilni ko'rish</span>
            </div>
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform backdrop-blur-sm">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
            </div>
          </div>
        </div>
      </div>

      {/* Live Status Widget - COMPACT */}
      <div>
        <h3 className="text-text font-black text-sm mb-2 px-1">Yuklar Holati</h3>
        <div 
            onClick={() => onNavigate(Tab.MY_PARCELS)}
            className="bg-white p-4 rounded-[24px] shadow-soft border border-gray-50 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all hover:border-primary/20"
        >
            <div className="flex gap-8">
                <div className="flex flex-col">
                    <span className="text-2xl font-black text-green-500 leading-none">
                        {loadingStats ? '-' : activeStats.arrived}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">Kelgan</span>
                </div>
                <div className="w-px bg-gray-100"></div>
                <div className="flex flex-col">
                    <span className="text-2xl font-black text-primary leading-none">
                        {loadingStats ? '-' : activeStats.transit}
                    </span>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mt-1">Yo'lda</span>
                </div>
            </div>
            <div className="w-8 h-8 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </div>
        </div>
      </div>

      {/* Quick Links - COMPACT ROW LAYOUT */}
      <div className="grid grid-cols-2 gap-3">
          <a 
            href="https://t.me/yaqiin"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white p-4 rounded-[20px] shadow-soft border border-gray-50 flex items-center gap-3 active:scale-95 transition-all hover:bg-gray-50"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <div className="text-left min-w-0">
              <p className="font-bold text-text text-sm truncate">Admin</p>
              <p className="text-[9px] text-text-secondary font-medium truncate">Yordam</p>
            </div>
          </a>

          <div 
             onClick={() => onNavigate(Tab.CALCULATOR)}
             className="bg-white p-4 rounded-[20px] shadow-soft border border-gray-50 flex items-center gap-3 active:scale-95 transition-all hover:bg-gray-50 cursor-pointer"
          >
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-500 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            </div>
            <div className="text-left min-w-0">
              <p className="font-bold text-text text-sm truncate">Hisoblash</p>
              <p className="text-[9px] text-text-secondary font-medium truncate">Kalkulyator</p>
            </div>
          </div>
      </div>

      {/* Info Button - AVIA ONLY */}
      <div className="w-full">
        <button 
          onClick={() => setInfoModal('AVIA')}
          className="w-full bg-white p-4 rounded-[20px] shadow-soft border border-gray-50 flex items-center gap-3 active:scale-95 transition-transform"
        >
           <div className="w-1 h-8 bg-primary rounded-full"></div>
           <div className="flex-1 text-left flex justify-between items-center">
              <div>
                <p className="text-[9px] text-text-secondary font-bold uppercase tracking-wide">Avia Muddat</p>
                <p className="text-base font-black text-text">✈️ {settings.deliveryTime.avia}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-primary">Batafsil &rarr;</span>
              </div>
           </div>
        </button>
      </div>

      {/* Address Modal */}
      {showAddressModal && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-0 sm:p-4">
              <div 
                className={`absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`} 
                onClick={closeModal}
              ></div>
              <div 
                className={`bg-[#F5F5FA] w-full max-w-md rounded-t-[32px] sm:rounded-[32px] shadow-2xl z-10 safe-area-bottom relative overflow-hidden transform transition-transform duration-300 ease-out flex flex-col max-h-[90vh] ${isClosing ? 'translate-y-full sm:translate-y-10 sm:opacity-0' : 'translate-y-0 animate-slide-up-mobile'}`}
              >
                  {/* Modal Header */}
                  <div className="bg-white px-6 py-5 rounded-b-[32px] shadow-sm z-20 relative">
                      <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 cursor-pointer opacity-50" onClick={closeModal}></div>
                      
                      <button 
                        onClick={closeModal}
                        className="absolute top-6 right-6 w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors active:scale-90"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>

                      <div className="text-center">
                          <h3 className="text-2xl font-black text-gray-900 tracking-tight">Xitoy Ombor Manzili</h3>
                          <p className="text-xs text-gray-500 font-medium mt-1">Yuklaringizni ushbu manzilga yuboring</p>
                      </div>

                      <div className="mt-6"></div>
                  </div>

                  {/* Scrollable Content */}
                  <div className="flex-1 overflow-y-auto p-6 pb-safe-bottom">
                      
                      <div className="bg-white p-6 rounded-[24px] shadow-sm border border-gray-200 relative">
                          <div className="w-full">
                             <p className="font-bold text-gray-900 text-[9px] leading-relaxed break-words whitespace-pre-wrap select-all text-left">
                                 {addressData.smartString}
                             </p>
                          </div>

                          {/* 6 lines empty space equivalent */}
                          <div className="h-28"></div>

                          {/* Nusxalash Button */}
                          <button
                            onClick={handleCopyAll}
                            className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${copyFeedback ? 'bg-green-50 text-green-600' : 'bg-primary/10 text-primary hover:bg-primary/20 active:scale-95'}`}
                          >
                             {copyFeedback ? (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                    Nusxalandi
                                </>
                             ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                                    Nusxalash
                                </>
                             )}
                          </button>

                          {/* 5 lines empty space equivalent */}
                          <div className="h-24"></div>
                      </div>

                      <div className="h-12"></div>
                  </div>
              </div>
          </div>
      )}

      {/* Info Modal */}
      {infoModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`} onClick={closeModal}></div>
              <div className={`bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl z-10 relative transform transition-all duration-300 max-h-[80vh] overflow-y-auto ${isClosing ? 'scale-90 opacity-0' : 'scale-100 opacity-100 animate-slide-up'}`}>
                  <button 
                    onClick={closeModal}
                    className="absolute top-4 right-4 w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>

                  <div className="text-center mb-8">
                      <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center text-4xl mb-5 shadow-sm bg-blue-50 text-blue-500`}>
                          ✈️
                      </div>
                      <h3 className="text-2xl font-black text-gray-900 tracking-tight">AVIA Xizmati</h3>
                      <p className="text-sm text-gray-500 mt-1">Yetkazib berish shartlari va narxlar</p>
                  </div>
                  
                  <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase">Muddat</p>
                              <p className="text-xs text-gray-400 italic mt-0.5">
                                  Xitoy manzilga yetib borgandan so'ng
                              </p>
                          </div>
                          <p className="text-xl font-black text-gray-900">
                              {settings.deliveryTime.avia}
                          </p>
                      </div>

                      <div className="p-5 bg-gray-50 rounded-2xl border border-gray-100">
                          <p className="text-[10px] text-gray-400 font-bold uppercase mb-3">Tariflar (1 kg uchun)</p>
                          <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                  <span className="text-sm font-bold text-gray-600">Standart</span>
                                  <span className="text-lg font-black text-primary">
                                      ${settings.prices.avia.standard}
                                  </span>
                              </div>
                              <div className="w-full h-px bg-gray-200"></div>
                              <div className="flex justify-between items-center">
                                  <div>
                                    <span className="text-sm font-bold text-gray-600 block">Gabarit / Seriya</span>
                                    <span className="text-[9px] text-gray-400 font-medium">(Qimmatroq tarif)</span>
                                  </div>
                                  <span className="text-lg font-black text-orange-500">
                                      ${settings.prices.avia.bulk}
                                  </span>
                              </div>
                          </div>
                          <div className="mt-4 bg-white p-3 rounded-xl border border-gray-100">
                             <p className="text-[10px] text-gray-500 italic leading-tight">
                                * <strong>Gabarit yuklar:</strong> Yengil lekin hajmi katta (kub) yuklar.<br/>
                                * <strong>Seriya yuklar:</strong> Tijorat maqsadida ko'p miqdorda kelgan bir xil tovarlar.
                             </p>
                          </div>
                      </div>
                  </div>

                  <button 
                    onClick={closeModal}
                    className="w-full mt-8 py-4 bg-primary-dark text-white rounded-2xl font-bold active:scale-95 transition-transform shadow-lg shadow-gray-200"
                  >
                    Tushunarli
                  </button>
              </div>
          </div>
      )}

    </div>
  );
};

export default TabHome;
