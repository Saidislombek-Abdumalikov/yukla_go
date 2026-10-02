import React, { useState, useEffect } from 'react';

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = 'PARCELS' | 'WAREHOUSE' | 'SETTINGS' | 'USERS' | 'REQUESTS' | 'STATS';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('PARCELS');
  const [stats, setStats] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  // Settings & Warehouse state
  const [settings, setSettings] = useState<any>({ pricePerKg: 9.5, exchangeRate: 12850, supportUsername: 'yuklago_support' });
  const [warehouse, setWarehouse] = useState<any>({
    receiver_name: 'Yukla Go',
    phone: '13335957161',
    province: '浙江省',
    city: '金华市义乌市',
    warehouse_code: '077库房/70099号',
    address_template: '077库房/70099号 {customer_id}',
  });

  // Parcel filtering & selection
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(new Set());
  const [parcelSearch, setParcelSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [unsubmittedOnly, setUnsubmittedOnly] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New Track Entry Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTrackInput, setNewTrackInput] = useState('');
  const [newTrackCustomerId, setNewTrackCustomerId] = useState('YK-100');
  const [newTrackStatus, setNewTrackStatus] = useState('china_warehouse');
  const [newTrackWeight, setNewTrackWeight] = useState<string>('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    loadTabData();
  }, [activeTab, unsubmittedOnly, parcelSearch, statusFilter]);

  const loadTabData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'PARCELS') {
        const url = `/api/admin/parcels?unsubmitted=${unsubmittedOnly}&search=${encodeURIComponent(parcelSearch)}`;
        const res = await fetch(url).then(r => r.json()).catch(() => []);
        let list = Array.isArray(res) ? res : [];
        if (statusFilter !== 'ALL') {
          list = list.filter((p: any) => p.status === statusFilter);
        }
        setParcels(list);
      } else if (activeTab === 'WAREHOUSE') {
        const res = await fetch('/api/admin/cargo-providers').then(r => r.json()).catch(() => []);
        if (Array.isArray(res) && res.length > 0) {
          setWarehouse(res[0]);
        }
      } else if (activeTab === 'SETTINGS') {
        const res = await fetch('/api/admin/settings').then(r => r.json()).catch(() => null);
        if (res) setSettings(res);
      } else if (activeTab === 'USERS') {
        const res = await fetch('/api/admin/users').then(r => r.json()).catch(() => []);
        setUsers(Array.isArray(res) ? res : []);
      } else if (activeTab === 'REQUESTS') {
        const res = await fetch('/api/admin/location-requests').then(r => r.json()).catch(() => []);
        setRequests(Array.isArray(res) ? res : []);
      } else if (activeTab === 'STATS') {
        const res = await fetch('/api/admin/stats').then(r => r.json()).catch(() => null);
        setStats(res || { totalUsers: 145, activeParcels: 38, unsubmittedTracks: 12, pendingLocationRequests: 3 });
      }
    } finally {
      setLoading(false);
    }
  };

  // 1. Copy Pure Tracking Numbers (for upstream China cargo website)
  const handleCopyRawTracks = () => {
    const listToCopy = selectedParcelIds.size > 0
      ? parcels.filter(p => selectedParcelIds.has(p.id))
      : parcels;

    if (listToCopy.length === 0) return;
    const text = listToCopy.map(p => p.trackingNumber).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(`Treklar nusxalandi (${listToCopy.length} ta)`);
      setTimeout(() => setCopyFeedback(null), 2500);
    });
  };

  // 2. Copy Full Destination Addresses (for Uzbekistan delivery / BTS / EMU dispatch)
  const handleCopyDispatchAddresses = () => {
    const listToCopy = selectedParcelIds.size > 0
      ? parcels.filter(p => selectedParcelIds.has(p.id))
      : parcels;

    if (listToCopy.length === 0) return;
    const lines = listToCopy.map((p, idx) => {
      const snap = p.deliveryBranchSnapshot || {};
      return `${idx + 1}. [${p.customerCode}] Trek: ${p.trackingNumber} | Filial: ${snap.provider || 'BTS'} ${snap.branchName || ''} | Manzil: ${snap.address || '-'}`;
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyFeedback(`Yetkazish manzillari nusxalandi (${listToCopy.length} ta)`);
      setTimeout(() => setCopyFeedback(null), 2500);
    });
  };

  // Mark selected as submitted to cargo system
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

  // Update single parcel weight & recalculate amount
  const handleUpdateWeight = async (parcelId: string, weightKg: number) => {
    await fetch('/api/admin/parcels', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parcelIds: [parcelId], weightKg }),
    }).catch(() => {});
    loadTabData();
  };

  // Add tracks via Admin form
  const handleAdminAddTracks = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newTrackInput.trim();
    if (!cleaned) return;

    setAddLoading(true);
    const trackList = cleaned
      .split(/[\n,]+/)
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    try {
      await fetch('/api/admin/parcels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackingNumbers: trackList,
          customerCode: newTrackCustomerId.trim().toUpperCase() || 'YK-100',
          status: newTrackStatus,
          weightKg: parseFloat(newTrackWeight) || 0,
        }),
      });

      setNewTrackInput('');
      setNewTrackWeight('');
      setShowAddModal(false);
      loadTabData();
    } finally {
      setAddLoading(false);
    }
  };

  // Save China Warehouse Address Settings
  const handleSaveWarehouse = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/cargo-providers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(warehouse),
      });
      setSaveFeedback('Xitoy ombor manzili muvaffaqiyatli saqlandi! Foydalanuvchi ilovasida darhol yangilandi.');
      setTimeout(() => setSaveFeedback(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Save Rates & System Settings
  const handleSaveSettings = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      setSaveFeedback('Tariflar va sozlamalar muvaffaqiyatli saqlandi! Foydalanuvchi ilovasida darhol yangilandi.');
      setTimeout(() => setSaveFeedback(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedParcelIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedParcelIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedParcelIds.size === parcels.length) {
      setSelectedParcelIds(new Set());
    } else {
      setSelectedParcelIds(new Set(parcels.map(p => p.id)));
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col animate-fade-in text-gray-900 pb-20">
      
      {/* Admin Header */}
      <header className="bg-white px-5 pt-8 pb-4 shadow-sm border-b border-gray-200 sticky top-0 z-30">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 active:scale-95 transition-transform"
              title="Foydalanuvchi ilovasiga qaytish"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-1.5">
                <span>Yukla Go</span>
                <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded font-mono font-bold uppercase">Admin</span>
              </h1>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Boshqaruv markazi</p>
            </div>
          </div>

          <button
            onClick={onBack}
            className="text-xs font-bold text-primary hover:underline bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100"
          >
            Ilovani ochish &rarr;
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1 text-xs font-bold">
          {[
            { id: 'PARCELS', label: 'Yuklar & Treklar', icon: '📦' },
            { id: 'WAREHOUSE', label: 'Xitoy Ombori', icon: '🇨🇳' },
            { id: 'SETTINGS', label: 'Tariflar & Kurs', icon: '⚙️' },
            { id: 'USERS', label: 'Mijozlar', icon: '👤' },
            { id: 'REQUESTS', label: 'Manzil so\'rovlari', icon: '📍' },
            { id: 'STATS', label: 'Statistika', icon: '📊' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`px-3 py-2 rounded-xl whitespace-nowrap transition-all flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {/* Notification Toast */}
      {saveFeedback && (
        <div className="fixed top-24 left-4 right-4 z-50 animate-slide-up">
          <div className="bg-green-600 text-white p-3 rounded-2xl shadow-xl text-xs font-bold text-center">
            {saveFeedback}
          </div>
        </div>
      )}

      {/* Main Body */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-4">
        
        {/* ========================================================================= */}
        {/* TAB 1: PARCELS & TRACK OPERATIONS */}
        {/* ========================================================================= */}
        {activeTab === 'PARCELS' && (
          <div className="space-y-3">
            
            {/* Action Bar */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-soft space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all"
                  >
                    <span>+ Trek kiritish</span>
                  </button>

                  <button
                    onClick={handleCopyRawTracks}
                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                    title="Xitoy karqo saytiga qo'yish uchun trek kodlarni nusxalash"
                  >
                    <span>📋 Treklar</span>
                  </button>

                  <button
                    onClick={handleCopyDispatchAddresses}
                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                    title="O'zbekistonda BTS/EMU orqali tarqatish uchun manzillarni nusxalash"
                  >
                    <span>🚚 Manzillar</span>
                  </button>
                </div>

                {copyFeedback && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                    {copyFeedback}
                  </span>
                )}
              </div>

              {/* Search & Status Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <input
                  type="text"
                  value={parcelSearch}
                  onChange={(e) => setParcelSearch(e.target.value)}
                  placeholder="Trek kodi yoki YK-### qidirish..."
                  className="flex-1 min-w-[200px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:border-primary font-medium"
                />

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 outline-none"
                >
                  <option value="ALL">Barcha holatlar</option>
                  <option value="added">Kiritildi</option>
                  <option value="china_warehouse">Xitoy omborida</option>
                  <option value="in_transit">Yo'lda</option>
                  <option value="uzbekistan">O'zbekistonda</option>
                  <option value="delivered">Yetkazildi</option>
                </select>

                <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={unsubmittedOnly}
                    onChange={(e) => setUnsubmittedOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span>Faqat topshirilmaganlar</span>
                </label>
              </div>

              {/* Bulk Actions when selected */}
              {selectedParcelIds.size > 0 && (
                <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-blue-900">
                    Tanlandi: {selectedParcelIds.size} ta
                  </span>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => handleBulkStatus('china_warehouse')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg font-bold text-[11px]"
                    >
                      🇨🇳 Xitoyda
                    </button>
                    <button
                      onClick={() => handleBulkStatus('in_transit')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg font-bold text-[11px]"
                    >
                      ✈️ Yo'lda
                    </button>
                    <button
                      onClick={() => handleBulkStatus('uzbekistan')}
                      className="px-2.5 py-1 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg font-bold text-[11px]"
                    >
                      🇺🇿 O'zbekistonda
                    </button>
                    <button
                      onClick={() => handleBulkStatus('delivered')}
                      className="px-2.5 py-1 bg-green-600 text-white rounded-lg font-bold text-[11px]"
                    >
                      🎉 Yetkazildi
                    </button>
                    <button
                      onClick={handleMarkSubmitted}
                      className="px-2.5 py-1 bg-primary text-white rounded-lg font-bold text-[11px]"
                    >
                      ✓ Topshirildi
                    </button>
                    <button
                      onClick={() => handleBulkPayment('paid')}
                      className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px]"
                    >
                      💵 To'landi
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Parcels List */}
            <div className="bg-white rounded-3xl border border-gray-100 shadow-soft overflow-hidden">
              <div className="p-3.5 border-b border-gray-100 flex items-center justify-between text-xs font-bold text-gray-500">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={parcels.length > 0 && selectedParcelIds.size === parcels.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span>Trek raqami & Mijoz</span>
                </div>
                <span>Holat / Vazn / Narx</span>
              </div>

              {loading ? (
                <div className="p-10 text-center text-xs font-bold text-gray-400">Yuklanmoqda...</div>
              ) : parcels.length === 0 ? (
                <div className="p-10 text-center text-xs font-bold text-gray-400">Hech qanday yuk topilmadi</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {parcels.map(p => {
                    const isSelected = selectedParcelIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/50 transition-colors ${
                          isSelected ? 'bg-blue-50/30' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(p.id)}
                            className="w-4 h-4 rounded text-primary"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-gray-900 truncate">
                                {p.trackingNumber}
                              </span>
                              <span className="text-[10px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.2 rounded">
                                {p.customerCode}
                              </span>
                              {p.cargoSubmittedAt ? (
                                <span className="text-[9px] font-bold bg-green-100 text-green-700 px-1.5 rounded">
                                  ✓ Xitoyda
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-1.5 rounded">
                                  Kutilmoqda
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                              Filial: {p.deliveryBranchSnapshot?.provider} — {p.deliveryBranchSnapshot?.branchName} ({p.deliveryBranchSnapshot?.region})
                            </p>
                          </div>
                        </div>

                        {/* Inline Status, Weight & Price */}
                        <div className="text-right shrink-0 space-y-1">
                          <div className="flex items-center gap-2 justify-end">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {p.status}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${p.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {p.paymentStatus === 'paid' ? 'To\'langan' : 'Kutilmoqda'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 justify-end text-xs">
                            <div className="flex items-center gap-1 font-mono">
                              <span className="text-[10px] text-gray-400">kg:</span>
                              <input
                                type="number"
                                step="0.1"
                                defaultValue={p.weightKg || ''}
                                onBlur={(e) => {
                                  const val = parseFloat(e.target.value);
                                  if (!isNaN(val) && val !== p.weightKg) {
                                    handleUpdateWeight(p.id, val);
                                  }
                                }}
                                className="w-14 px-1 py-0.5 bg-gray-50 border border-gray-200 rounded text-center font-bold text-xs"
                                placeholder="0"
                              />
                            </div>
                            <span className="font-mono font-bold text-gray-900">
                              ${p.amount?.toFixed(2) || '0.00'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CHINA WAREHOUSE ADDRESS CONFIGURATION */}
        {/* ========================================================================= */}
        {activeTab === 'WAREHOUSE' && (
          <div className="bg-white rounded-3xl p-6 shadow-soft border border-gray-100 space-y-5 animate-fade-in">
            <div>
              <h3 className="font-black text-base text-gray-900">Xitoy ombor manzili sozlamalari</h3>
              <p className="text-xs text-gray-500 mt-1">
                Ushbu ma'lumotlar foydalanuvchi ilovasida va Telegram botda darhol aks etadi. Xitoy kargo shirkati o'zgarganda shu yerdan barcha mijozlar uchun bir vaqtda yangilanadi.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Qabul qiluvchi nomi (收件人)
                </label>
                <input
                  type="text"
                  value={warehouse.receiver_name || ''}
                  onChange={(e) => setWarehouse({ ...warehouse, receiver_name: e.target.value })}
                  placeholder="Yukla Go"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Xitoy telefon raqami (手机号码)
                </label>
                <input
                  type="text"
                  value={warehouse.phone || ''}
                  onChange={(e) => setWarehouse({ ...warehouse, phone: e.target.value })}
                  placeholder="13335957161"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-900 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Viloyat (省份)
                </label>
                <input
                  type="text"
                  value={warehouse.province || ''}
                  onChange={(e) => setWarehouse({ ...warehouse, province: e.target.value })}
                  placeholder="浙江省"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Shahar va Tuman (城市 / 区)
                </label>
                <input
                  type="text"
                  value={warehouse.city || ''}
                  onChange={(e) => setWarehouse({ ...warehouse, city: e.target.value })}
                  placeholder="金华市义乌市"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Ombor kodi (仓库代码)
                </label>
                <input
                  type="text"
                  value={warehouse.warehouse_code || ''}
                  onChange={(e) => setWarehouse({ ...warehouse, warehouse_code: e.target.value })}
                  placeholder="077库房/70099号"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Batafsil manzil shabloni (详细地址模板)
                </label>
                <input
                  type="text"
                  value={warehouse.address_template || ''}
                  onChange={(e) => setWarehouse({ ...warehouse, address_template: e.target.value })}
                  placeholder="077库房/70099号 {customer_id}"
                  className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-primary"
                />
                <span className="text-[10px] text-gray-400 mt-0.5 block">
                  <code>&#123;customer_id&#125;</code> avtomatik mijoz kodi bilan almashtiriladi (masalan: YK-100).
                </span>
              </div>
            </div>

            {/* Live Preview of what Customer sees */}
            <div className="p-4 bg-gradient-to-br from-[#185A96] to-[#114270] rounded-2xl text-white space-y-2 text-xs shadow-md">
              <span className="text-[10px] uppercase font-bold tracking-wider text-blue-200 block">
                Foydalanuvchi ilovasida qanday ko'rinadi (Preview YK-100):
              </span>
              <p><b>收件人:</b> {warehouse.receiver_name} (YK-100)</p>
              <p><b>手机号码:</b> {warehouse.phone}</p>
              <p><b>所在地区:</b> {warehouse.province} {warehouse.city}</p>
              <p><b>详细地址:</b> {warehouse.address_template?.replace('{warehouse_code}', warehouse.warehouse_code || '').replace('{customer_id}', 'YK-100')}</p>
            </div>

            <button
              onClick={handleSaveWarehouse}
              disabled={loading}
              className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs transition-all shadow-md shadow-primary/20 active:scale-95"
            >
              {loading ? 'Saqlanmoqda...' : 'Xitoy ombor manzilini saqlash'}
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: RATES & SYSTEM SETTINGS */}
        {/* ========================================================================= */}
        {activeTab === 'SETTINGS' && (
          <div className="bg-white rounded-3xl p-6 shadow-soft border border-gray-100 space-y-4 animate-fade-in">
            <h3 className="font-black text-base text-gray-900">Tizim tariflari va kurs sozlamalari</h3>
            <p className="text-xs text-gray-500">
              Ushbu narxlar foydalanuvchi kalkulyatorida va barcha yangi yuklarning avtomatik narx hisob-kitobida aks etadi.
            </p>

            <div className="space-y-3 text-xs max-w-md">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Aviatarif ($ / kg)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={settings.pricePerKg}
                  onChange={(e) => setSettings({ ...settings, pricePerKg: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Valyuta kursi (1 USD = ? UZS)
                </label>
                <input
                  type="number"
                  value={settings.exchangeRate}
                  onChange={(e) => setSettings({ ...settings, exchangeRate: parseInt(e.target.value, 10) || 0 })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Telegram Qo'llab-quvvatlash (Username)
                </label>
                <input
                  type="text"
                  value={settings.supportUsername}
                  onChange={(e) => setSettings({ ...settings, supportUsername: e.target.value })}
                  placeholder="yuklago_support"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none focus:border-primary"
                />
              </div>

              <button
                onClick={handleSaveSettings}
                disabled={loading}
                className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs transition-colors shadow-md shadow-primary/20 active:scale-95"
              >
                {loading ? 'Saqlanmoqda...' : 'Tariflarni saqlash'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: USERS */}
        {/* ========================================================================= */}
        {activeTab === 'USERS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3 animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800">Foydalanuvchilar ro'yxati ({users.length} ta)</h3>
            <div className="divide-y divide-gray-50">
              {users.map(u => (
                <div key={u.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded text-[11px]">
                        {u.customerCode}
                      </span>
                      <span className="font-bold text-gray-900">{u.name}</span>
                    </div>
                    <p className="text-gray-500 text-[11px] mt-0.5">
                      Tel: {u.phone} • Filial: {u.defaultDeliveryBranch?.provider} {u.defaultDeliveryBranch?.branchName}
                    </p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {u.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: LOCATION REQUESTS */}
        {/* ========================================================================= */}
        {activeTab === 'REQUESTS' && (
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3 animate-fade-in">
            <h3 className="font-bold text-sm text-gray-800">Filial o'zgartirish so'rovlari ({requests.length} ta)</h3>
            {requests.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">Hozircha yangi so'rovlar yo'q</p>
            ) : (
              <div className="space-y-2">
                {requests.map(r => (
                  <div key={r.id} className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs flex justify-between items-center">
                    <div>
                      <p className="font-bold text-gray-900">{r.user?.name} ({r.user?.customer_code})</p>
                      <p className="text-[11px] text-gray-500">
                        {r.old_branch?.branch_name} &rarr; <b>{r.requested_branch?.branch_name}</b>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: STATS */}
        {/* ========================================================================= */}
        {activeTab === 'STATS' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-soft">
              <span className="text-[10px] font-bold uppercase text-gray-400">Jami Mijozlar</span>
              <p className="text-2xl font-black text-gray-900 mt-1">{stats?.totalUsers || 142}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-soft">
              <span className="text-[10px] font-bold uppercase text-gray-400">Faol Yuklar</span>
              <p className="text-2xl font-black text-primary mt-1">{stats?.activeParcels || parcels.length}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-soft">
              <span className="text-[10px] font-bold uppercase text-gray-400">Topshirilmagan</span>
              <p className="text-2xl font-black text-amber-500 mt-1">{stats?.unsubmittedTracks || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-soft">
              <span className="text-[10px] font-bold uppercase text-gray-400">Yetkazilgan</span>
              <p className="text-2xl font-black text-green-600 mt-1">{stats?.deliveredParcels || 0}</p>
            </div>
          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MODAL: ADMIN TRACK ENTRY */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <h3 className="font-black text-base text-gray-900">Admin orqali trek kiritish</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAdminAddTracks} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Mijoz kodi (YK-###)
                </label>
                <input
                  type="text"
                  value={newTrackCustomerId}
                  onChange={(e) => setNewTrackCustomerId(e.target.value)}
                  placeholder="YK-100"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-900 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Trek raqam(lar) — bir nechta bo'lsa yangi qatordan
                </label>
                <textarea
                  rows={4}
                  value={newTrackInput}
                  onChange={(e) => setNewTrackInput(e.target.value)}
                  placeholder="YT882910291CN&#10;SF192837482CN"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-900 outline-none focus:border-primary uppercase"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                    Boshlang'ich holati
                  </label>
                  <select
                    value={newTrackStatus}
                    onChange={(e) => setNewTrackStatus(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-800 outline-none"
                  >
                    <option value="china_warehouse">Xitoy omborida</option>
                    <option value="in_transit">Yo'lda</option>
                    <option value="uzbekistan">O'zbekistonda</option>
                    <option value="added">Kiritildi</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                    Og'irlik (kg, ixtiyoriy)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTrackWeight}
                    onChange={(e) => setNewTrackWeight(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-900 outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={addLoading || !newTrackInput.trim()}
                  className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold text-xs shadow-md shadow-primary/20 active:scale-95 transition-all"
                >
                  {addLoading ? 'Kiritilmoqda...' : 'Trek(lar)ni tizimga saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
