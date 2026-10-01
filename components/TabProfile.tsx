import React, { useState, useEffect } from 'react';
import { UserProfile, DeliveryBranchSnapshot } from '../types';
import { api } from '../services/api';

const TabProfile: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [showOfertaModal, setShowOfertaModal] = useState(false);

  // Address change modal state
  const [selectedProvider, setSelectedProvider] = useState<'BTS' | 'EMU' | 'UZPOST'>('BTS');
  const [availableBranches, setAvailableBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);

  useEffect(() => {
    api.getProfile().then(setProfile).catch(() => {});
  }, []);

  useEffect(() => {
    if (showAddressModal) {
      api.getBranches(selectedProvider).then(branches => {
        setAvailableBranches(branches);
        if (branches.length > 0) {
          setSelectedBranchId((branches[0] as any).id);
        }
      }).catch(() => {});
    }
  }, [showAddressModal, selectedProvider]);

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBranchId) return;

    setSubmitting(true);
    setRequestFeedback(null);
    try {
      const res = await api.requestLocationChange(selectedBranchId);
      setRequestFeedback(res.message || 'So\'rov yuborildi');
      setTimeout(() => {
        setShowAddressModal(false);
        setRequestFeedback(null);
      }, 2000);
    } catch (err: any) {
      setRequestFeedback(err.message || 'Xatolik yuz berdi');
    } finally {
      setSubmitting(false);
    }
  };

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
            <h3 className="font-bold text-base text-gray-900 truncate">{profile?.name || 'Mijoz'}</h3>
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0">
              {profile?.customerCode || 'YK-###'}
            </span>
          </div>
          <p className="text-gray-500 font-mono text-xs mt-0.5">{profile?.phone || '-'}</p>
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

      {/* Address Change Request Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 animate-slide-up">
            <div className="flex justify-between items-center">
              <h3 className="font-black text-base text-gray-900">Manzilni o'zgartirish</h3>
              <button onClick={() => setShowAddressModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
            </div>

            <form onSubmit={handleAddressSubmit} className="space-y-3">
              {/* Provider Selection */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Xizmat turi</label>
                <div className="grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl text-xs font-bold">
                  {(['BTS', 'EMU', 'UZPOST'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProvider(p)}
                      className={`py-1.5 rounded-lg transition-all ${selectedProvider === p ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* Branch Selection */}
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Yangi filial</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium text-gray-800 outline-none focus:border-primary"
                >
                  {availableBranches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.region} — {b.branch_name || b.branchName}
                    </option>
                  ))}
                </select>
              </div>

              {requestFeedback && (
                <p className="text-xs text-center font-bold text-primary bg-blue-50 py-2 rounded-xl">
                  {requestFeedback}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-md shadow-primary/20"
              >
                {submitting ? 'Yuborilmoqda...' : 'So\'rov yuborish'}
              </button>
            </form>
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
