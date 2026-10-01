
import React, { useState, useEffect } from 'react';
import { 
    getAppSettings, 
    saveAppSettings,
    fetchAllClientsFromSheet,
    getRegisteredUsers,
    SETTINGS_SHEET_URL,
    CLIENTS_SHEET_URL,
    REYS_DIRECTORY_URL,
    ARRIVED_REYS_SHEET_URL
} from '../services/storageService';
import { AppSettings, ClientActivity, UserProfile } from '../types';

interface AdminDashboardProps {
  onLogout: () => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'STATS' | 'ACTIVITY' | 'CLIENTS' | 'SETTINGS'>('STATS');
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());
  const [clients, setClients] = useState<ClientActivity[]>([]);
  const [registeredUsers, setRegisteredUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState('');

  useEffect(() => {
    if (activeTab === 'CLIENTS') {
      loadClients();
    }
    if (activeTab === 'ACTIVITY') {
      loadRegisteredUsers();
    }
  }, [activeTab]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const data = await fetchAllClientsFromSheet();
      setClients(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadRegisteredUsers = () => {
      const users = getRegisteredUsers();
      setRegisteredUsers(users);
  };

  const handleSaveSettings = () => {
    saveAppSettings(settings);
    alert('Sozlamalar qurilmangizda saqlandi! Barcha mijozlar uchun yangilash uchun Google Jadvalni o\'zgartiring.');
  };

  const generateSettingsRow = () => {
      // NEW Format for Google Sheet (Row 2): 
      // A (skip), B (skip), C(AviaStd), D(AvtoStd), E(AviaBulk), F(AvtoBulk), G(AviaTime), H(AvtoTime), I(Rate)
      const row = `,,${settings.prices.avia.standard},${settings.prices.avto.standard},${settings.prices.avia.bulk},${settings.prices.avto.bulk},${settings.deliveryTime.avia},${settings.deliveryTime.avto},${settings.exchangeRate}`;
      navigator.clipboard.writeText(row);
      setCopySuccess('Nusxalandi!');
      setTimeout(() => setCopySuccess(''), 2000);
  };

  // Filter for valid users from Sheet
  const verifiedClients = clients.filter(c => 
    c.clientId && 
    (c.clientId.startsWith('TT') || c.clientId.startsWith('TOP') || c.clientId.startsWith('JEK') || c.clientId.startsWith('JK') || c.clientId.startsWith('YAQ') || c.clientId.startsWith('YAQIIN')) &&
    c.phone && 
    c.phone.replace(/\D/g, '').length >= 9
  );

  const filteredClients = verifiedClients.filter(c => 
    c.clientId.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery) ||
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredRegistered = registeredUsers.filter(u => 
      u.clientId.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.phone.includes(searchQuery) ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const openSheet = (url: string) => {
      window.open(url.replace('export?format=csv', 'edit'), '_blank');
  };

  const formatTime = (ts?: number) => {
      if (!ts) return '-';
      return new Date(ts).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col animate-fade-in">
      <style>{`
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type="number"] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* Header */}
      <div className="bg-white px-6 pt-12 pb-6 shadow-sm border-b border-gray-200 sticky top-0 z-20">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-black text-primary-dark tracking-tight uppercase italic">Admin Panel</h1>
            <p className="text-xs text-gray-500 font-bold uppercase mt-1">YAQIIN CARGO Management</p>
          </div>
          <button 
            onClick={onLogout}
            className="w-10 h-10 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center shadow-sm active:scale-90 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-gray-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
          {(['STATS', 'ACTIVITY', 'CLIENTS', 'SETTINGS'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[80px] py-2.5 rounded-xl text-[10px] font-black transition-all whitespace-nowrap ${activeTab === tab ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
            >
              {tab === 'STATS' ? 'STATISTIKA' : tab === 'ACTIVITY' ? 'FAOLLIK' : tab === 'CLIENTS' ? 'BAZA' : 'SOZLAMALAR'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-5 pb-24 max-w-lg mx-auto w-full">
        
        {activeTab === 'STATS' && (
          <div className="space-y-4 animate-slide-up">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[28px] shadow-soft border border-gray-100">
                <p className="text-[10px] text-gray-400 font-black uppercase mb-1 text-center">App Foydalanuvchilar</p>
                <h4 className="text-4xl font-black text-blue-600 text-center">{getRegisteredUsers().length}</h4>
                <p className="text-[9px] text-gray-400 mt-2 text-center leading-tight">Ro'yxatdan o'tganlar</p>
              </div>
              <div className="bg-white p-5 rounded-[28px] shadow-soft border border-gray-100">
                <p className="text-[10px] text-gray-400 font-black uppercase mb-1 text-center">Baza (Sheet)</p>
                <h4 className="text-4xl font-black text-primary text-center">{verifiedClients.length > 0 ? verifiedClients.length : '-'}</h4>
                <p className="text-[9px] text-gray-400 mt-2 text-center leading-tight">Jadvaldagi mijozlar</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-[32px] shadow-soft border border-gray-100">
              <h4 className="text-[10px] font-black text-gray-400 mb-4 uppercase tracking-widest">Ma'lumotlar Bazasi (Google Sheets)</h4>
              <div className="space-y-2">
                <button onClick={() => openSheet(CLIENTS_SHEET_URL)} className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-xs font-bold text-gray-700">👥 Mijozlar Ro'yxati</span>
                  <span className="text-xs text-blue-500 font-bold">Ochish →</span>
                </button>
                <button onClick={() => openSheet(ARRIVED_REYS_SHEET_URL)} className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-xs font-bold text-gray-700">📦 Kelgan Reyslar & Sozlamalar</span>
                  <span className="text-xs text-blue-500 font-bold">Ochish →</span>
                </button>
                <button onClick={() => openSheet(REYS_DIRECTORY_URL)} className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                  <span className="text-xs font-bold text-gray-700">📂 Reyslar Katalogi</span>
                  <span className="text-xs text-blue-500 font-bold">Ochish →</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ACTIVITY TAB: REAL USERS */}
        {activeTab === 'ACTIVITY' && (
          <div className="space-y-4 animate-slide-up">
              <div className="bg-white p-4 rounded-[28px] shadow-soft border border-gray-100 flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input 
                    type="text" 
                    placeholder="Qidirish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm font-medium"
                />
              </div>

              <div className="bg-white rounded-[32px] shadow-soft border border-gray-100 overflow-hidden">
                {filteredRegistered.length === 0 ? (
                     <div className="p-10 text-center text-gray-400 italic text-sm">Hozircha hech kim kirmagan</div>
                ) : (
                    <table className="w-full text-left">
                        <thead className="bg-blue-50/50 sticky top-0 z-10">
                            <tr>
                                <th className="px-5 py-3 text-[10px] font-black text-blue-800 uppercase tracking-widest">MIJOZ</th>
                                <th className="px-5 py-3 text-[10px] font-black text-blue-800 uppercase tracking-widest text-right">SO'NGGI FAOLLIK</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredRegistered.map((user, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-5 py-4">
                                        <p className="font-bold text-gray-800 text-xs">{user.name}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{user.clientId}</span>
                                            <span className="text-[10px] text-gray-500">{user.phone}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-right">
                                        <p className="text-[10px] font-bold text-gray-600">{formatTime(user.lastActive)}</p>
                                        <p className="text-[9px] text-gray-400 mt-0.5">Ro'yxatdan o'tgan: {formatTime(user.registeredAt).split(',')[0]}</p>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
              </div>
              <p className="text-center text-[10px] text-gray-400 font-bold uppercase px-6">
                Bu ro'yxatda faqat Appga muvaffaqiyatli kirgan foydalanuvchilar ko'rinadi.
              </p>
          </div>
        )}

        {/* CLIENTS TAB: DATABASE */}
        {activeTab === 'CLIENTS' && (
          <div className="space-y-4 animate-slide-up">
            <div className="bg-white p-4 rounded-[28px] shadow-soft border border-gray-100 flex items-center gap-3">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input 
                type="text" 
                placeholder="ID yoki Ism bo'yicha qidirish..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent outline-none text-sm font-medium"
              />
            </div>

            <div className="bg-white rounded-[32px] shadow-soft border border-gray-100 overflow-hidden">
              <div className="max-h-[65vh] overflow-y-auto no-scrollbar">
                {loading ? (
                  <div className="p-10 text-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div><p className="text-xs text-gray-400 mt-4 font-bold uppercase">Mijozlar o'qilmoqda...</p></div>
                ) : filteredClients.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 italic text-sm">Mijozlar topilmadi</div>
                ) : (
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 sticky top-0 z-10">
                      <tr>
                        <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">MIJOZ ID</th>
                        <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">HOLATI</th>
                        <th className="px-5 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">MA'LUMOT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {filteredClients.map((client) => (
                        <tr key={client.clientId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-4 align-top">
                             <p className="font-mono font-bold text-primary text-xs">{client.clientId}</p>
                             <p className="text-[9px] text-gray-400 font-medium mt-0.5">{client.phone}</p>
                          </td>
                          <td className="px-5 py-4 align-top">
                             <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold border border-green-100 whitespace-nowrap uppercase">Bazada Bor</span>
                          </td>
                          <td className="px-5 py-4 align-top">
                             <p className="font-bold text-gray-800 text-xs truncate max-w-[120px]">{client.name}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-400 font-bold uppercase px-6">
                Google Jadvaldagi tasdiqlangan (valid) hisoblar.
            </p>
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="space-y-5 animate-slide-up">
             
             <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl flex gap-3">
                 <div className="text-orange-500 text-xl">⚠️</div>
                 <div>
                     <h4 className="font-bold text-orange-800 text-sm">Diqqat!</h4>
                     <p className="text-xs text-orange-700 leading-relaxed mt-1">
                         Bu yerdagi o'zgarishlar faqat <strong>hozircha sizda</strong> saqlanadi (Preview). 
                         Barcha mijozlar uchun narxlarni yangilash uchun Google Jadvalni o'zgartirishingiz shart.
                     </p>
                 </div>
             </div>

             <div className="bg-white p-6 rounded-[32px] shadow-soft border border-gray-100">
                <label className="block text-[10px] font-black text-gray-400 uppercase mb-3 ml-1 tracking-widest">Valyuta Kursi (1 USD = ? UZS)</label>
                <div className="relative">
                  <input 
                    type="number" 
                    value={settings.exchangeRate}
                    onChange={(e) => setSettings({...settings, exchangeRate: Number(e.target.value)})}
                    className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-xl font-black text-gray-900 focus:ring-4 focus:ring-primary/5 transition-all outline-none"
                    placeholder="0"
                  />
                  <div className="absolute right-4 top-4 text-green-500 font-bold uppercase">UZS</div>
                </div>
             </div>

             <div className="bg-white p-6 rounded-[32px] shadow-soft border border-gray-100 space-y-6">
                {/* DELIVERY TIMES SECTION (Local only for now or manual update) */}
                <div>
                   <h5 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="text-lg">⏱️</span> YETKAZIB BERISH MUDDATI
                  </h5>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold ml-1 uppercase">Avto Muddat</span>
                      <input 
                        type="text"
                        value={settings.deliveryTime.avto}
                        onChange={(e) => setSettings({...settings, deliveryTime: {...settings.deliveryTime, avto: e.target.value}})}
                        className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 outline-none focus:ring-2 focus:ring-primary/20 text-gray-800"
                        placeholder="Masalan: 14-18 Kun"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold ml-1 uppercase">Avia Muddat</span>
                      <input 
                        type="text"
                        value={settings.deliveryTime.avia}
                        onChange={(e) => setSettings({...settings, deliveryTime: {...settings.deliveryTime, avia: e.target.value}})}
                        className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 outline-none focus:ring-2 focus:ring-primary/20 text-gray-800"
                        placeholder="Masalan: 3-5 Kun"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="w-full h-px bg-gray-100"></div>

                <div>
                  <h5 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="text-lg">🚛</span> AVTO TARIFLARI ($)
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold ml-1">Standart / kg</span>
                      <input 
                        type="number" step="0.1"
                        value={settings.prices.avto.standard}
                        onChange={(e) => setSettings({...settings, prices: {...settings.prices, avto: {...settings.prices.avto, standard: Number(e.target.value)}}})}
                        className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold ml-1">Katta Hajm</span>
                      <input 
                        type="number" step="0.1"
                        value={settings.prices.avto.bulk}
                        onChange={(e) => setSettings({...settings, prices: {...settings.prices, avto: {...settings.prices.avto, bulk: Number(e.target.value)}}})}
                        className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h5 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <span className="text-lg">✈️</span> AVIA TARIFLARI ($)
                  </h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold ml-1">Standart / kg</span>
                      <input 
                        type="number" step="0.1"
                        value={settings.prices.avia.standard}
                        onChange={(e) => setSettings({...settings, prices: {...settings.prices, avia: {...settings.prices.avia, standard: Number(e.target.value)}}})}
                        className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] text-gray-400 font-bold ml-1">Katta Hajm</span>
                      <input 
                        type="number" step="0.1"
                        value={settings.prices.avia.bulk}
                        onChange={(e) => setSettings({...settings, prices: {...settings.prices, avia: {...settings.prices.avia, bulk: Number(e.target.value)}}})}
                        className="w-full p-3 bg-gray-50 rounded-xl font-bold border border-gray-100 outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>
                </div>
             </div>
             
             <div className="flex gap-2">
                 <button 
                    onClick={handleSaveSettings}
                    className="flex-1 py-4 bg-gray-900 text-white rounded-[20px] font-bold text-sm shadow-lg active:scale-95 transition-transform"
                 >
                   PREVIEW SAQLASH
                 </button>
                 <button 
                    onClick={generateSettingsRow}
                    className="flex-1 py-4 bg-blue-50 text-primary border border-blue-100 rounded-[20px] font-bold text-sm shadow-sm active:scale-95 transition-transform"
                 >
                   {copySuccess || "NUSXALASH (JADVAL UCHUN)"}
                 </button>
             </div>

             <button 
                 onClick={() => openSheet(SETTINGS_SHEET_URL)}
                 className="w-full py-4 bg-green-500 text-white rounded-[24px] font-black text-lg shadow-glow shadow-green-500/30 active:scale-95 transition-transform flex items-center justify-center gap-2"
             >
                 <span>GOOGLE JADVALNI YANGILASH</span>
                 <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
             </button>
             
             <p className="text-center text-[10px] text-gray-400 px-4">
                 Yuqoridagi "NUSXALASH" tugmasini bosing, so'ng "GOOGLE JADVALNI YANGILASH" ni bosib, ochilgan jadvalning <strong>2-qatoriga</strong> ma'lumotlarni joylang (Paste).
                 <br/><br/>
                 <strong>Diqqat:</strong> Nusxalashda dastlabki 2 ta katak (Yetib kelgan Avia/Avto) tashlab ketiladi.
             </p>
          </div>
        )}
      </div>

      <div className="p-6 text-center text-[10px] text-gray-400 font-black tracking-widest uppercase opacity-40">
        Admin Management Dashboard • YAQIIN CARGO
      </div>
    </div>
  );
};

export default AdminDashboard;
