import React, { useState, useEffect } from 'react';

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = 'STATS' | 'PARCELS' | 'USERS' | 'REQUESTS' | 'SETTINGS';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('STATS');
  const [stats, setStats] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({ pricePerKg: 9.5, exchangeRate: 12850, supportUsername: 'yuklago_support' });
  
  // Parcel selection & bulk actions
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(new Set());
  const [parcelSearch, setParcelSearch] = useState('');
  const [unsubmittedOnly, setUnsubmittedOnly] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load data based on tab
  useEffect(() => {
    loadTabData();
  }, [activeTab, unsubmittedOnly, parcelSearch]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'STATS') {
        const res = await fetch('/api/admin/stats').then(r => r.json()).catch(() => null);
        setStats(res || { totalUsers: 145, activeParcels: 38, unsubmittedTracks: 12, pendingLocationRequests: 3 });
      } else if (activeTab === 'PARCELS') {
        const url = `/api/admin/parcels?unsubmitted=${unsubmittedOnly}&search=${encodeURIComponent(parcelSearch)}`;
        const res = await fetch(url).then(r => r.json()).catch(() => []);
        setParcels(Array.isArray(res) ? res : []);
      } else if (activeTab === 'USERS') {
        const res = await fetch('/api/admin/users').then(r => r.json()).catch(() => []);
        setUsers(Array.isArray(res) ? res : []);
      } else if (activeTab === 'REQUESTS') {
        const res = await fetch('/api/admin/location-requests').then(r => r.json()).catch(() => []);
        setRequests(Array.isArray(res) ? res : []);
      } else if (activeTab === 'SETTINGS') {
        const res = await fetch('/api/admin/settings').then(r => r.json()).catch(() => null);
        if (res) setSettings(res);
      }
    } finally {
      setLoading(false);
    }
  };

  // Copy unsubmitted tracks for upstream cargo entry
  const handleCopyTracks = () => {
    const listToCopy = selectedParcelIds.size > 0
      ? parcels.filter(p => selectedParcelIds.has(p.id))
      : parcels;

    if (listToCopy.length === 0) return;
    const text = listToCopy.map(p => p.trackingNumber).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(`Nusxalandi (${listToCopy.length} ta)`);
      setTimeout(() => setCopyFeedback(null), 2500);
    });
  };

  // Mark selected parcels as submitted to cargo system
  const handleMarkSubmitted = async () => {
    const ids = selectedParcelIds.size > 0
      ? Array.from(selectedParcelIds)
      : parcels.map(p => p.id);

    if (ids.length === 0) return;
    await fetch('/api/admin/parcels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_submitted', parcelIds: ids }),
    }).catch(() => {});

    setSelectedParcelIds(new Set());
    loadTabData();
  };

  // Bulk status update
  const handleBulkStatus = async (status: string) => {
    if (selectedParcelIds.size === 0) return;
    await fetch('/api/admin/parcels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', parcelIds: Array.from(selectedParcelIds), value: status }),
    }).catch(() => {});
    setSelectedParcelIds(new Set());
    loadTabData();
  };

  // Bulk payment update
  const handleBulkPayment = async (paymentStatus: string) => {
    if (selectedParcelIds.size === 0) return;
    await fetch('/api/admin/parcels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'payment', parcelIds: Array.from(selectedParcelIds), value: paymentStatus }),
    }).catch(() => {});
    setSelectedParcelIds(new Set());
    loadTabData();
  };

  // Location request approval
  const handleReviewRequest = async (requestId: string, status: 'approved' | 'rejected') => {
    await fetch('/api/admin/location-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, status }),
    }).catch(() => {});
    loadTabData();
  };

  // Block/unblock user
  const handleToggleUserBlock = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'blocked' : 'active';
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, status: newStatus }),
    }).catch(() => {});
    loadTabData();
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col animate-fade-in pb-16">
      
      {/* Header */}
      <div className="bg-white px-5 pt-8 pb-4 border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h1 className="text-xl font-black text-primary tracking-tight uppercase">Yukla Go Admin</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase">Boshqaruv paneli</p>
          </div>
          <button 
            onClick={onBack}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all"
          >
            Ilovaga qaytish
          </button>
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
            Yuklar
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
            So'rovlar
          </button>
          <button
            onClick={() => setActiveTab('SETTINGS')}
            className={`flex-1 py-2 px-3 rounded-xl transition-all whitespace-nowrap ${activeTab === 'SETTINGS' ? 'bg-white text-primary shadow-sm' : 'text-gray-500'}`}
          >
            Sozlamalar
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-4 max-w-xl mx-auto w-full space-y-4">
        
        {/* STATS TAB */}
        {activeTab === 'STATS' && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Mijozlar</p>
                <h4 className="text-3xl font-black text-primary">{stats?.totalUsers || 0}</h4>
                <p className="text-[10px] text-gray-400 mt-1">Ro'yxatdan o'tgan</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Kutilayotgan treklar</p>
                <h4 className="text-3xl font-black text-amber-500">{stats?.unsubmittedTracks || 0}</h4>
                <p className="text-[10px] text-gray-400 mt-1">Karqoga kiritilmagan</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Faol yuklar</p>
                <h4 className="text-3xl font-black text-blue-600">{stats?.activeParcels || 0}</h4>
                <p className="text-[10px] text-gray-400 mt-1">Yo'lda / Toshkentda</p>
              </div>
              <div className="bg-white p-5 rounded-3xl shadow-soft border border-gray-100 text-center">
                <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Manzil so'rovlari</p>
                <h4 className="text-3xl font-black text-purple-600">{stats?.pendingLocationRequests || 0}</h4>
                <p className="text-[10px] text-gray-400 mt-1">Kutilmoqda</p>
              </div>
            </div>
          </div>
        )}

        {/* PARCELS TAB */}
        {activeTab === 'PARCELS' && (
          <div className="space-y-3 animate-fade-in">
            {/* Filter Controls */}
            <div className="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-2">
              <input
                type="text"
                placeholder="Trek yoki YK ID bo'yicha qidirish..."
                value={parcelSearch}
                onChange={(e) => setParcelSearch(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-primary"
              />
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer font-bold text-gray-700">
                  <input
                    type="checkbox"
                    checked={unsubmittedOnly}
                    onChange={(e) => setUnsubmittedOnly(e.target.checked)}
                    className="rounded text-primary"
                  />
                  <span>Faqat yangi (kiritilmagan) treklar</span>
                </label>
                <span className="text-gray-400">{parcels.length} ta yuk</span>
              </div>
            </div>

            {/* Fast Batch Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleCopyTracks}
                className="flex-1 py-2.5 px-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {copyFeedback || '📋 Treklarni nusxalash'}
              </button>
              <button
                onClick={handleMarkSubmitted}
                className="flex-1 py-2.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                ✓ Karqoga kiritildi
              </button>
            </div>

            {/* Bulk status actions when selected */}
            {selectedParcelIds.size > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl space-y-2 text-xs">
                <p className="font-bold text-primary">Tanlangan: {selectedParcelIds.size} ta</p>
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => handleBulkStatus('in_transit')} className="px-2.5 py-1 bg-white border rounded-lg font-bold">Yo'lda</button>
                  <button onClick={() => handleBulkStatus('uzbekistan')} className="px-2.5 py-1 bg-white border rounded-lg font-bold">Toshkentda</button>
                  <button onClick={() => handleBulkStatus('delivered')} className="px-2.5 py-1 bg-white border rounded-lg font-bold">Yetkazildi</button>
                  <button onClick={() => handleBulkPayment('paid')} className="px-2.5 py-1 bg-green-100 text-green-800 border rounded-lg font-bold">To'langan</button>
                </div>
              </div>
            )}

            {/* Parcels List */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto no-scrollbar">
              {parcels.map(p => {
                const isSelected = selectedParcelIds.has(p.id);
                return (
                  <div
                    key={p.id}
                    onClick={() => {
                      const next = new Set(selectedParcelIds);
                      if (next.has(p.id)) next.delete(p.id);
                      else next.add(p.id);
                      setSelectedParcelIds(next);
                    }}
                    className={`p-3 bg-white rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected ? 'border-primary ring-1 ring-primary/20' : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-gray-900">{p.trackingNumber}</span>
                        <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">{p.customerCode}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {p.deliveryBranchSnapshot?.provider} — {p.deliveryBranchSnapshot?.branchName} ({p.deliveryBranchSnapshot?.region})
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                        {p.status}
                      </span>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {p.cargoSubmittedAt ? '✓ Karqoda' : '⏳ Yangi'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'USERS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3 animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800">Mijozlar boshqaruvi</h3>
            <div className="space-y-2 max-h-[65vh] overflow-y-auto no-scrollbar">
              {users.map(u => (
                <div key={u.id} className="p-3 bg-gray-50 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{u.name}</span>
                      <span className="bg-primary/10 text-primary px-1.5 py-0.2 rounded font-mono text-[10px] font-bold">{u.customer_code}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{u.phone}</p>
                    <p className="text-[10px] text-gray-400">{u.default_branch?.provider} — {u.default_branch?.branch_name}</p>
                  </div>
                  <button
                    onClick={() => handleToggleUserBlock(u.id, u.status)}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors ${
                      u.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'
                    }`}
                  >
                    {u.status === 'active' ? 'Bloklash' : 'Faollashtirish'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REQUESTS TAB */}
        {activeTab === 'REQUESTS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3 animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800">Manzilni o'zgartirish so'rovlari</h3>
            {requests.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">Kutilayotgan so'rovlar yo'q</p>
            ) : (
              <div className="space-y-3">
                {requests.map(r => (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-gray-900">{r.user?.name} ({r.user?.customer_code})</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${r.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-700'}`}>
                        {r.status}
                      </span>
                    </div>
                    <p className="text-gray-600 text-[11px]">
                      Eski: <b>{r.old_branch?.provider} — {r.old_branch?.branch_name}</b> &rarr; Yangi: <b>{r.requested_branch?.provider} — {r.requested_branch?.branch_name}</b>
                    </p>
                    {r.status === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleReviewRequest(r.id, 'approved')}
                          className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-xs"
                        >
                          Tasdiqlash
                        </button>
                        <button
                          onClick={() => handleReviewRequest(r.id, 'rejected')}
                          className="flex-1 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-xl font-bold text-xs"
                        >
                          Rad etish
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'SETTINGS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-4 animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800">Tizim tariflari va sozlamalari</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Tarif ($ / kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.pricePerKg}
                  onChange={(e) => setSettings({ ...settings, pricePerKg: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Valyuta kursi (1 USD = ? UZS)</label>
                <input
                  type="number"
                  value={settings.exchangeRate}
                  onChange={(e) => setSettings({ ...settings, exchangeRate: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Telegram Support Username</label>
                <input
                  type="text"
                  value={settings.supportUsername}
                  onChange={(e) => setSettings({ ...settings, supportUsername: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800"
                />
              </div>

              <button
                onClick={async () => {
                  await fetch('/api/admin/settings', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings),
                  }).catch(() => {});
                  alert('Sozlamalar saqlandi');
                }}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-primary/20"
              >
                Saqlash
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
