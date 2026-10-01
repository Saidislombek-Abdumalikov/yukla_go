
import React, { useState, useEffect } from 'react';
import { saveUserProfile, fetchAndVerifyClient, registerUserActivity } from '../services/storageService';

const Registration: React.FC<{ onRegister: () => void; onAdminLogin: () => void }> = ({ onRegister, onAdminLogin }) => {
  const [clientId, setClientId] = useState('');
  const [phone, setPhone] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Admin Login State
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminPin, setAdminPin] = useState('');

  // Secret Admin Trigger
  const [clickCount, setClickCount] = useState(0);

  useEffect(() => {
    if (clickCount === 0) return;
    const timer = setTimeout(() => setClickCount(0), 1000);
    return () => clearTimeout(timer);
  }, [clickCount]);

  const handleLogoClick = () => {
    if (clickCount + 1 === 3) {
      setIsAdminMode(true);
      setClickCount(0);
    } else {
      setClickCount(prev => prev + 1);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value.replace(/\D/g, '').slice(0, 9);
      setPhone(val);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanId = clientId.trim();
    const cleanPhone = phone.replace(/\D/g, '');

    if (!cleanId || !cleanPhone) {
      setError('Barcha maydonlarni to\'ldiring');
      return;
    }

    if (cleanPhone.length !== 9) {
        setError('Telefon raqam 9 xonali bo\'lishi kerak');
        return;
    }

    setLoading(true);

    try {
        const profile = await fetchAndVerifyClient(cleanId, cleanPhone);
        saveUserProfile(profile);
        // Track that this user successfully entered the app
        registerUserActivity(profile);
        onRegister();
    } catch (err: any) {
        setError(err.message || 'Xatolik yuz berdi');
    } finally {
        setLoading(false);
    }
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      // Admin PIN: s08121719
      if (adminPin === 's08121719') {
          onAdminLogin();
      } else {
          setError('PIN xato');
          setAdminPin('');
      }
  };

  if (isAdminMode) {
      return (
        <div className="fixed inset-0 bg-slate-900 z-[100] flex flex-col items-center justify-center p-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-white mb-8 text-center tracking-tight">Admin Tizimi</h2>
            <form onSubmit={handleAdminSubmit} className="w-full max-w-xs space-y-4">
                <input 
                    type="password" 
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Admin parolini kiriting"
                    className="w-full p-4 bg-slate-800 border border-slate-700 rounded-2xl focus:border-orange-500 outline-none text-center text-xl text-white tracking-widest placeholder:text-slate-600"
                    autoFocus
                />
                {error && <p className="text-red-400 text-sm text-center font-medium">{error}</p>}
                <button type="submit" className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-xl shadow-orange-900/20 active:scale-95 transition-transform">Kirish</button>
                <button type="button" onClick={() => setIsAdminMode(false)} className="w-full py-3 text-slate-500 text-sm font-medium">Orqaga qaytish</button>
            </form>
        </div>
      );
  }

  return (
    <div className="fixed inset-0 bg-[#F5F7FA] z-[100] flex flex-col items-center justify-center p-6 animate-fade-in safe-area-bottom">
      <div className="w-full max-w-sm bg-white p-8 rounded-[40px] shadow-soft">
        
        <div className="text-center mb-8">
           <div 
             onClick={handleLogoClick}
             className="w-20 h-20 bg-gradient-to-tr from-[#fe7d08] to-[#cc5a00] rounded-3xl mx-auto flex items-center justify-center text-white font-bold text-4xl shadow-glow mb-6 rotate-3 cursor-pointer select-none active:scale-90 transition-transform"
           >
              Y
           </div>
           <h1 className="text-2xl font-black text-[#cc5a00]">YAQIIN CARGO</h1>
           <p className="text-text-secondary mt-2 text-sm font-medium">
               Tizimga kirish uchun ma'lumotlarni kiriting.
           </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase ml-2">Mijoz ID</label>
                <input 
                    type="text" 
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="Masalan: YAQ-1234"
                    className="w-full p-4 bg-[#F5F7FA] rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-all font-bold uppercase text-text placeholder-text-secondary/50"
                    disabled={loading}
                />
            </div>
            
            <div className="space-y-1">
                <label className="text-xs font-bold text-text-secondary uppercase ml-2">Telefon</label>
                <div className="flex items-center">
                    <span className="p-4 bg-[#F5F7FA] rounded-l-2xl text-text-secondary font-bold border-r border-gray-200 text-lg">+998</span>
                    <input 
                        type="tel" 
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="901234567"
                        maxLength={9}
                        className="w-full p-4 bg-[#F5F7FA] rounded-r-2xl focus:bg-white focus:ring-2 focus:ring-primary outline-none transition-all font-bold text-lg text-text placeholder-text-secondary/50 tracking-wider"
                        disabled={loading}
                    />
                </div>
            </div>

            {error && <div className="p-3 bg-red-50 text-red-500 text-sm text-center rounded-xl font-medium animate-fade-in">{error}</div>}

            <button 
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-lg shadow-lg shadow-primary/30 active:scale-95 transition-all mt-4 flex items-center justify-center"
            >
                {loading ? (
                    <span className="flex items-center gap-2">
                         <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                         Tekshirilmoqda...
                    </span>
                ) : "Kirish"}
            </button>
        </form>
      </div>
    </div>
  );
};

export default Registration;
