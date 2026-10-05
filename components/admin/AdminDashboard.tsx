import React, { useState, useEffect } from 'react';
import { ALL_BRANCHES, REGIONS_LIST, getBranches } from '../../api/_lib/branchesData';
import type { CourseAccessItem } from '../../types';

interface AdminDashboardProps {
  onBack: () => void;
}

type AdminTab = 'PARCELS' | 'COURSES' | 'WAREHOUSE' | 'SETTINGS' | 'USERS' | 'STATS';

const AdminDashboard: React.FC<AdminDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('PARCELS');
  const [stats, setStats] = useState<any>(null);
  const [parcels, setParcels] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);

  // Academy & Course LMS state
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('course_cargo_101');
  const [courseLessons, setCourseLessons] = useState<any[]>([]);
  const [studentsProgress, setStudentsProgress] = useState<any[]>([]);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [courseAccessList, setCourseAccessList] = useState<CourseAccessItem[]>([]);
  const [grantUserInput, setGrantUserInput] = useState('');
  const [grantLoading, setGrantLoading] = useState(false);

  // New Lesson Modal state
  const [showAddLessonModal, setShowAddLessonModal] = useState(false);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonYoutube, setNewLessonYoutube] = useState('');
  const [newLessonDuration, setNewLessonDuration] = useState('360');
  const [newLessonDesc, setNewLessonDesc] = useState('');
  const [addLessonLoading, setAddLessonLoading] = useState(false);

  // Settings & Warehouse state
  const [settings, setSettings] = useState<any>({ pricePerKg: 9.5, exchangeRate: 12850, supportUsername: 'nothing_related' });
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

  // User Management & Full Wipe State
  const [userSearch, setUserSearch] = useState('');
  const [manualWipeInput, setManualWipeInput] = useState('');
  const [wipeTargetUser, setWipeTargetUser] = useState<any | null>(null);
  const [wipeLoading, setWipeLoading] = useState(false);

  const handleWipeUser = async (target: any) => {
    setWipeLoading(true);
    try {
      const res = await fetch(`/api/admin/users?id=${encodeURIComponent(target.id || '')}&customerCode=${encodeURIComponent(target.customerCode || '')}&telegramUserId=${encodeURIComponent(target.telegramUserId || '')}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      }).then(r => r.json());

      if (res.success) {
        setSaveFeedback(res.message || 'Mijoz ma\'lumotlari butunlay tozalandi');
        setTimeout(() => setSaveFeedback(null), 3500);
        setWipeTargetUser(null);
        setManualWipeInput('');
        loadTabData();
      } else {
        alert(res.error || 'Xatolik yuz berdi');
      }
    } catch (e: any) {
      alert(e.message || 'Xatolik yuz berdi');
    } finally {
      setWipeLoading(false);
    }
  };

  const handleManualWipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = manualWipeInput.trim();
    if (!clean) return;

    const found = users.find(u =>
      u.customerCode?.toUpperCase() === clean.toUpperCase() ||
      String(u.telegramUserId) === clean ||
      u.id === clean
    );

    const target = found || {
      id: clean,
      customerCode: clean.toUpperCase().startsWith('YK-') ? clean.toUpperCase() : clean,
      telegramUserId: !isNaN(Number(clean)) ? Number(clean) : 0,
      name: clean,
    };

    setWipeTargetUser(target);
  };

  const handleToggleUserStatus = async (user: any) => {
    const nextStatus = user.status === 'active' ? 'blocked' : 'active';
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, status: nextStatus }),
      }).then(r => r.json());

      if (res.success) {
        setSaveFeedback(`Foydalanuvchi holati: ${nextStatus === 'active' ? 'Faol' : 'Bloklandi'}`);
        setTimeout(() => setSaveFeedback(null), 2500);
        loadTabData();
      }
    } catch {}
  };

  useEffect(() => {
    loadTabData();
  }, [activeTab, unsubmittedOnly, parcelSearch, statusFilter, selectedCourseId]);

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
      } else if (activeTab === 'COURSES') {
        const [cRes, lRes, sRes, aRes] = await Promise.all([
          fetch('/api/admin/academy').then(r => r.json()).catch(() => ({ courses: [] })),
          fetch(`/api/admin/academy?action=lessons&courseId=${selectedCourseId}`).then(r => r.json()).catch(() => []),
          fetch(`/api/admin/academy?action=students&courseId=${selectedCourseId}`).then(r => r.json()).catch(() => []),
          fetch(`/api/admin/academy?action=access&courseId=${selectedCourseId}`).then(r => r.json()).catch(() => []),
        ]);
        if (cRes?.courses) setCourses(cRes.courses);
        setCourseLessons(Array.isArray(lRes) ? lRes : []);
        setStudentsProgress(Array.isArray(sRes) ? sRes : []);
        setCourseAccessList(Array.isArray(aRes) ? aRes : []);
      } else if (activeTab === 'SETTINGS') {
        const res = await fetch('/api/admin/settings').then(r => r.json()).catch(() => null);
        if (res) setSettings(res);
      } else if (activeTab === 'USERS') {
        const res = await fetch('/api/admin/users').then(r => r.json()).catch(() => []);
        setUsers(Array.isArray(res) ? res : []);
      } else if (activeTab === 'STATS') {
        const res = await fetch('/api/admin/stats').then(r => r.json()).catch(() => null);
        setStats(res || { totalUsers: 145, activeParcels: 38, unsubmittedTracks: 12, pendingLocationRequests: 3 });
      }
    } finally {
      setLoading(false);
    }
  };

  // Derived filtered parcels according to search, status and unsubmitted filters
  const filteredParcels = parcels.filter(p => {
    if (parcelSearch.trim()) {
      const q = parcelSearch.toLowerCase().trim();
      const matchTrack = p.trackingNumber.toLowerCase().includes(q);
      const matchCode = p.customerCode.toLowerCase().includes(q);
      if (!matchTrack && !matchCode) return false;
    }
    if (statusFilter !== 'ALL' && p.status !== statusFilter) {
      return false;
    }
    if (unsubmittedOnly && p.cargoSubmittedAt) {
      return false;
    }
    return true;
  });

  // 1. Copy Pure Tracking Numbers (for upstream China cargo website)
  const handleCopyRawTracks = () => {
    const listToCopy = selectedParcelIds.size > 0
      ? filteredParcels.filter(p => selectedParcelIds.has(p.id))
      : filteredParcels;

    if (listToCopy.length === 0) return;
    const text = listToCopy.map(p => p.trackingNumber).join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(`Treklar nusxalandi: ${listToCopy.length} ta`);
      setTimeout(() => setCopyFeedback(null), 2500);
    });
  };

  // 2. Copy Customer Parcels List (for admin direct delivery/handover)
  const handleCopyCustomerList = () => {
    const listToCopy = selectedParcelIds.size > 0
      ? filteredParcels.filter(p => selectedParcelIds.has(p.id))
      : filteredParcels;

    if (listToCopy.length === 0) return;
    const lines = listToCopy.map((p, idx) => {
      return `${idx + 1}. [${p.customerCode}] Trek: ${p.trackingNumber} | Holat: ${p.status} | Og'irlik: ${p.weightKg || 0} kg`;
    });

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopyFeedback(`Mijozlar ro'yxati nusxalandi: ${listToCopy.length} ta`);
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

  // Academy Actions
  const handleResetStudentProgress = async (studentId: string, studentName: string) => {
    if (!window.confirm(`${studentName} talabasining barcha dars progressini qayta boshlamoqchimisiz (Reset)?`)) {
      return;
    }
    setLoading(true);
    try {
      await fetch('/api/admin/academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_progress',
          userId: studentId,
          courseId: selectedCourseId,
        }),
      });
      setSaveFeedback(`${studentName} talabasining dars progressi 0% ga qaytarildi.`);
      setTimeout(() => setSaveFeedback(null), 3000);
      loadTabData();
    } finally {
      setLoading(false);
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLessonTitle.trim() || !newLessonYoutube.trim()) return;

    setAddLessonLoading(true);
    try {
      await fetch('/api/admin/academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_lesson',
          courseId: selectedCourseId,
          title: newLessonTitle.trim(),
          youtubeUrlOrId: newLessonYoutube.trim(),
          durationSeconds: parseInt(newLessonDuration, 10) || 360,
          description: newLessonDesc.trim(),
          order: courseLessons.length + 1,
        }),
      });

      setNewLessonTitle('');
      setNewLessonYoutube('');
      setNewLessonDuration('360');
      setNewLessonDesc('');
      setShowAddLessonModal(false);
      setSaveFeedback("Yangi dars muvaffaqiyatli qo'shildi!");
      setTimeout(() => setSaveFeedback(null), 3000);
      loadTabData();
    } finally {
      setAddLessonLoading(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string, title: string) => {
    if (!window.confirm(`"${title}" darsini o'chirishga ishonchingiz komilmi?`)) return;
    setLoading(true);
    try {
      await fetch(`/api/admin/academy?lessonId=${lessonId}`, {
        method: 'DELETE',
      });
      setSaveFeedback(`Dars o'chirildi.`);
      setTimeout(() => setSaveFeedback(null), 3000);
      loadTabData();
    } finally {
      setLoading(false);
    }
  };

  const handleGrantAccess = async (targetIdentifier?: string) => {
    const target = (targetIdentifier || grantUserInput).trim();
    if (!target) return;
    setGrantLoading(true);
    try {
      const res = await fetch('/api/admin/academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant_access',
          identifier: target,
          courseId: selectedCourseId,
        }),
      }).then(r => r.json());

      if (res.success) {
        setSaveFeedback(res.message || `${target} ga darslarni ko'rish uchun ruxsat berildi!`);
        setTimeout(() => setSaveFeedback(null), 3500);
        setGrantUserInput('');
        loadTabData();
      } else {
        alert(res.error || 'Xatolik yuz berdi');
      }
    } finally {
      setGrantLoading(false);
    }
  };

  const handleRevokeAccess = async (target: string, name: string) => {
    if (!window.confirm(`${name} (${target}) ning darslarga kirish ruxsatini bekor qilishni xohlaysizmi?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/academy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke_access',
          identifier: target,
          courseId: selectedCourseId,
        }),
      }).then(r => r.json());

      setSaveFeedback(res.message || 'Ruxsat bekor qilindi');
      setTimeout(() => setSaveFeedback(null), 3000);
      loadTabData();
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
        <div className="flex gap-1 overflow-x-auto no-scrollbar pt-1 text-xs font-bold scroll-x-smooth">
          {[
            { id: 'PARCELS', label: 'Yuklar & Treklar', icon: '📦' },
            { id: 'COURSES', label: 'Kurslar & Video', icon: '🎓' },
            { id: 'WAREHOUSE', label: 'Xitoy Ombori', icon: '🇨🇳' },
            { id: 'SETTINGS', label: 'Tariflar & Kurs', icon: '⚙️' },
            { id: 'USERS', label: 'Mijozlar', icon: '👤' },
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
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowAddModal(true)}
                    className="px-4 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all"
                  >
                    <span>+ Trek kiritish</span>
                  </button>

                  <button
                    onClick={handleCopyRawTracks}
                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                    title="Xitoy karqo saytiga topshirish uchun trek kodlarni nusxalash"
                  >
                    <span>📋 Treklar nusxalash</span>
                  </button>

                  <button
                    onClick={handleCopyCustomerList}
                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all"
                    title="Mijozlar va ularning trek kodlarini ro'yxatini nusxalash"
                  >
                    <span>👥 Mijozlar ro'yxati</span>
                  </button>
                </div>

                {copyFeedback && (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">
                    {copyFeedback}
                  </span>
                )}
              </div>

              {/* Search & Status Filters */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
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
                  <span>Topshirilmaganlar</span>
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
                    checked={filteredParcels.length > 0 && selectedParcelIds.size === filteredParcels.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-primary"
                  />
                  <span>Trek raqami & Joylashuv ({filteredParcels.length} ta)</span>
                </div>
                <span>Holat / Vazn / Narx</span>
              </div>

              {loading ? (
                <div className="p-10 text-center text-xs font-bold text-gray-400">Yuklanmoqda...</div>
              ) : filteredParcels.length === 0 ? (
                <div className="p-10 text-center text-xs font-bold text-gray-400">
                  Ushbu filtr bo'yicha yuklar topilmadi
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredParcels.map(p => {
                    const isSelected = selectedParcelIds.has(p.id);
                    const snap = p.deliveryBranchSnapshot || {};
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

                            {/* Direct Admin Delivery Badge */}
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                📍 Admin orqali bevosita topshirish
                              </span>
                            </div>
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
        {/* TAB 3: ACADEMY COURSES & VIDEO LESSONS */}
        {/* ========================================================================= */}
        {activeTab === 'COURSES' && (
          <div className="space-y-4 animate-fade-in">
            {/* Top Bar: Course Selector & Quick Action */}
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                    <span>🎓 Video Darslar & Akademiya</span>
                  </h3>
                  <p className="text-xs text-gray-500">
                    O'quv kurslarini boshqarish, video darslar tartibi va talabalar ko'rish progressi
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/?app=academy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-amber-200 transition-colors"
                  >
                    <span>Talaba rejimida ko'rish ↗</span>
                  </a>
                  <button
                    onClick={() => setShowAddLessonModal(true)}
                    className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all"
                  >
                    <span>+ Dars qo'shish</span>
                  </button>
                </div>
              </div>

              {/* Course Selector Tabs */}
              <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
                {(courses.length > 0 ? courses : [
                  { id: 'course_cargo_101', title: 'Xitoydan buyurtma berish kursi', icon: '📦' },
                  { id: 'course_english_logistics', title: 'Logistika & Biznes ingliz tili', icon: '🇬🇧' },
                ]).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCourseId(c.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedCourseId === c.id
                        ? 'bg-gray-900 text-white shadow-sm'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    }`}
                  >
                    <span>{c.icon || '📚'}</span>
                    <span>{c.title}</span>
                  </button>
                ))}
              </div>

              {/* Course Overview Stats */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Jami darslar</span>
                  <span className="text-xl font-black text-gray-900">{courseLessons.length} ta</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Talabalar</span>
                  <span className="text-xl font-black text-primary">{studentsProgress.length} nafar</span>
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-gray-400 block">Tugatganlar</span>
                  <span className="text-xl font-black text-green-600">
                    {studentsProgress.filter(s => s.completedLessonsCount === s.totalLessons && s.totalLessons > 0).length} nafar
                  </span>
                </div>
              </div>
            </div>

            {/* Access Control & Permissions Section */}
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div>
                  <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                    <span>🔐 Foydalanuvchi Ruxsatlari (Access Control)</span>
                    <span className="text-[10px] bg-green-50 text-green-700 px-2 py-0.5 rounded font-mono font-bold">
                      {courseAccessList.filter(a => a.status === 'granted').length} ta ruxsat berilgan
                    </span>
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Faqat ruxsat berilgan talabalar darslarni tomosha qila oladi. Ruxsat berilganda talabaga Telegram orqali xabar boradi.
                  </p>
                </div>

                {courseAccessList.filter(a => a.status === 'pending').length > 0 && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-xl text-xs font-bold animate-pulse">
                    ⏳ {courseAccessList.filter(a => a.status === 'pending').length} ta yangi so'rov bor
                  </span>
                )}
              </div>

              {/* Quick Grant Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleGrantAccess();
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  placeholder="Mijoz kodi (masalan: YK-103) yoki Telegram ID..."
                  value={grantUserInput}
                  onChange={(e) => setGrantUserInput(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:border-primary focus:bg-white transition-colors"
                />
                <button
                  type="submit"
                  disabled={grantLoading || !grantUserInput.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5"
                >
                  {grantLoading ? 'Saqlanmoqda...' : '✅ Ruxsat berish'}
                </button>
              </form>

              {/* Access List Table */}
              <div className="space-y-2 pt-1">
                {courseAccessList.length === 0 ? (
                  <p className="text-xs text-gray-400 py-4 text-center">Foydalanuvchilar ro'yxati bo'sh.</p>
                ) : (
                  <div className="divide-y divide-gray-100 border border-gray-100 rounded-2xl overflow-hidden">
                    {courseAccessList.map((item) => {
                      const isGranted = item.status === 'granted';
                      const isPending = item.status === 'pending';

                      return (
                        <div
                          key={item.userId}
                          className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                            isPending ? 'bg-amber-50/50' : 'bg-white hover:bg-gray-50/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg text-xs">
                              {item.customerCode}
                            </span>
                            <div className="min-w-0">
                              <p className="font-bold text-gray-900 truncate">
                                {item.name || 'Foydalanuvchi'}
                                {item.username ? (
                                  <span className="text-gray-400 font-normal ml-1">(@{item.username})</span>
                                ) : null}
                              </p>
                              <p className="text-[10px] text-gray-400 flex items-center gap-1">
                                <span>ID: {item.telegramUserId || item.userId}</span>
                                {item.grantedAt && (
                                  <span>• {new Date(item.grantedAt).toLocaleDateString()}</span>
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isGranted ? (
                              <>
                                <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-md">
                                  ✓ Ruxsat berilgan
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRevokeAccess(item.customerCode || item.userId, item.name)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors"
                                >
                                  Bekor qilish
                                </button>
                              </>
                            ) : (
                              <>
                                {isPending ? (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md animate-pulse">
                                    ⏳ So'rov yuborgan
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                                    🚫 Ruxsat yo'q
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleGrantAccess(item.customerCode || item.userId)}
                                  className="px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition-colors"
                                >
                                  Ruxsat berish
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Section 1: Lessons List */}
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <span>Darslar ro'yxati ({courseLessons.length} ta)</span>
                  <span className="text-[10px] bg-blue-50 text-primary px-2 py-0.5 rounded font-mono font-bold">
                    Ketma-ket tartibda
                  </span>
                </h4>
                <button
                  onClick={() => setShowAddLessonModal(true)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  + Dars qo'shish
                </button>
              </div>

              {courseLessons.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Ushbu kursda hozircha darslar mavjud emas.</p>
              ) : (
                <div className="space-y-2.5">
                  {courseLessons.map((lesson) => {
                    const minutes = Math.floor(lesson.durationSeconds / 60);
                    const seconds = lesson.durationSeconds % 60;
                    const durationText = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                    return (
                      <div
                        key={lesson.id}
                        className="p-3.5 bg-gray-50 hover:bg-gray-100/80 rounded-2xl border border-gray-200/70 transition-all flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary font-mono font-bold text-xs flex items-center justify-center shrink-0">
                            #{lesson.order}
                          </span>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-bold text-gray-900 text-sm">{lesson.title}</h5>
                              <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-mono font-medium">
                                ⏱ {durationText}
                              </span>
                            </div>
                            {lesson.description && (
                              <p className="text-gray-500 text-[11px] leading-relaxed">{lesson.description}</p>
                            )}
                            <div className="flex items-center gap-3 pt-0.5 text-[11px]">
                              <span className="font-mono text-gray-400">ID: {lesson.youtubeVideoId}</span>
                              <a
                                href={`https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-red-600 hover:underline font-bold flex items-center gap-1"
                              >
                                <span>▶️ YouTube'da ko'rish</span>
                              </a>
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteLesson(lesson.id, lesson.title)}
                          className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 flex items-center justify-center shrink-0 transition-colors"
                          title="Darsni o'chirish"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Section 2: Students Progress Tracker */}
            <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-3">
              <div>
                <h4 className="font-bold text-sm text-gray-900">Talabalar progressi & monitoring</h4>
                <p className="text-xs text-gray-500">
                  Talabaning har bir darsni qanchalik tomosha qilganligi va keyingi darslarni ochish holati
                </p>
              </div>

              {studentsProgress.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">Talabalar ma'lumotlari topilmadi.</p>
              ) : (
                <div className="space-y-3">
                  {studentsProgress.map((student) => {
                    const isExpanded = expandedStudentId === student.userId;
                    const isCompleted = student.completedLessonsCount === student.totalLessons && student.totalLessons > 0;

                    return (
                      <div
                        key={student.userId}
                        className="p-4 bg-gray-50 rounded-2xl border border-gray-200/80 space-y-3 text-xs"
                      >
                        {/* Student Summary Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl text-xs">
                              {student.customerCode}
                            </span>
                            <div>
                              <h5 className="font-bold text-gray-900 text-sm">{student.name}</h5>
                              <p className="text-gray-500 text-[11px]">
                                {student.completedLessonsCount} / {student.totalLessons} dars tugatildi ({student.completionPercentage}%)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResetStudentProgress(student.userId, student.name)}
                              className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[11px] font-bold border border-red-200/60 transition-colors"
                              title="Dars progressini 0% ga qaytarish"
                            >
                              🔄 Reset
                            </button>
                            <button
                              onClick={() => setExpandedStudentId(isExpanded ? null : student.userId)}
                              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-xl text-[11px] font-bold border border-gray-200 transition-colors flex items-center gap-1"
                            >
                              <span>{isExpanded ? 'Yashirish' : 'Batafsil'}</span>
                              <span className="text-[9px]">{isExpanded ? '▲' : '▼'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isCompleted ? 'bg-green-500' : 'bg-primary'
                            }`}
                            style={{ width: `${student.completionPercentage}%` }}
                          />
                        </div>

                        {/* Expanded Lessons Detail Breakdown */}
                        {isExpanded && (
                          <div className="pt-2 border-t border-gray-200/70 space-y-2 animate-fade-in">
                            <span className="text-[10px] font-bold uppercase text-gray-400 block">
                              Darslar bo'yicha ko'rish holati:
                            </span>
                            <div className="space-y-1.5">
                              {student.lessons?.map((l: any) => {
                                const statusBadge = l.isCompleted ? (
                                  <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    <span>✅</span>
                                    <span>Tugatilgan</span>
                                  </span>
                                ) : l.isLocked ? (
                                  <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    <span>🔒</span>
                                    <span>Qulflangan</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                    <span>▶️</span>
                                    <span>{l.percentage}% ko'rilgan</span>
                                  </span>
                                );

                                return (
                                  <div
                                    key={l.lessonId}
                                    className="p-2.5 bg-white rounded-xl border border-gray-200 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-gray-400 text-[11px]">#{l.order}</span>
                                      <span className="font-bold text-gray-800">{l.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-[11px] text-gray-400">
                                        {l.maxWatchedSeconds}s / {l.durationSeconds}s
                                      </span>
                                      {statusBadge}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: RATES & SYSTEM SETTINGS */}
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
                  placeholder="nothing_related"
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
        {/* TAB 5: USERS & FULL WIPE */}
        {/* ========================================================================= */}
        {activeTab === 'USERS' && (() => {
          const filteredUsers = users.filter(u => {
            if (!userSearch.trim()) return true;
            const q = userSearch.toLowerCase();
            return (
              u.name?.toLowerCase().includes(q) ||
              u.customerCode?.toLowerCase().includes(q) ||
              u.phone?.toLowerCase().includes(q) ||
              String(u.telegramUserId).includes(q)
            );
          });

          return (
            <div className="space-y-4 animate-fade-in">
              {/* Top Stats & Wipe Header */}
              <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <div>
                    <h3 className="font-black text-base text-gray-900 flex items-center gap-2">
                      <span>👤 Mijozlar & Telegram Bot Boshqaruvi</span>
                      <span className="text-[11px] font-mono font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded-xl">
                        {users.length} nafar mijoz
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Mijozlarni ko'rish, holatini o'zgartirish va Telegram botdagi barcha tarixini noldan tozalash (Full Wipe).
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="px-2.5 py-1 bg-green-50 text-green-700 rounded-xl border border-green-100">
                      🟢 Faol: {users.filter(u => u.status !== 'blocked').length}
                    </span>
                    <span className="px-2.5 py-1 bg-red-50 text-red-700 rounded-xl border border-red-100">
                      🔴 Bloklangan: {users.filter(u => u.status === 'blocked').length}
                    </span>
                  </div>
                </div>

                {/* Quick Manual Wipe Bar */}
                <div className="bg-red-50/70 p-4 rounded-2xl border border-red-200 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">⚠️</span>
                    <span className="font-black text-xs text-red-900">Mijozni tezkor butunlay tozalash (Full Wipe):</span>
                  </div>
                  <p className="text-[11px] text-red-800/80 leading-relaxed">
                    Mijoz kodi (masalan: <b>YK-100</b>) yoki Telegram ID (masalan: <b>99887766</b>) kiriting. Bu amal uning botdagi suhbati, barcha yuklari va dars progressini butunlay yo'q qiladi.
                  </p>
                  <form onSubmit={handleManualWipe} className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={manualWipeInput}
                      onChange={(e) => setManualWipeInput(e.target.value)}
                      placeholder="Mijoz kodi (YK-###) yoki Telegram ID..."
                      className="flex-1 px-3.5 py-2.5 bg-white border border-red-200 rounded-xl text-xs font-bold text-gray-900 placeholder:text-gray-400 outline-none focus:border-red-500 font-mono"
                    />
                    <button
                      type="submit"
                      disabled={!manualWipeInput.trim()}
                      className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-md shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                    >
                      <span>🗑 Butunlay tozalash</span>
                    </button>
                  </form>
                </div>

                {/* Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Mijoz ismi, kodi (YK-###), telefon yoki Telegram ID bo'yicha qidirish..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary focus:bg-white text-xs font-medium text-gray-800 placeholder:text-gray-400 transition-all"
                  />
                  <svg className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Users List Cards */}
              <div className="space-y-2.5">
                {filteredUsers.length === 0 ? (
                  <div className="p-10 bg-white rounded-3xl border border-dashed border-gray-200 text-center space-y-2">
                    <span className="text-3xl block">👤</span>
                    <p className="text-xs font-bold text-gray-700">Mijozlar topilmadi</p>
                    <p className="text-[11px] text-gray-400">
                      {userSearch ? "Qidiruv so'rovi bo'yicha hech qanday mijoz topilmadi" : "Hozircha foydalanuvchilar ro'yxati bo'sh"}
                    </p>
                  </div>
                ) : (
                  filteredUsers.map(u => {
                    const isBlocked = u.status === 'blocked';
                    const userParcelsCount = parcels.filter(p => p.customerCode === u.customerCode).length;

                    return (
                      <div
                        key={u.id || u.customerCode || u.telegramUserId}
                        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft hover:border-gray-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="space-y-1.5 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded-lg text-xs">
                              {u.customerCode || 'YK-???'}
                            </span>
                            <span className="font-bold text-gray-900 text-sm">{u.name || 'Nomsiz'}</span>
                            {u.telegramUserId && (
                              <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-bold">
                                TG: {u.telegramUserId}
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isBlocked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {isBlocked ? '⛔ Bloklangan' : '✅ Faol'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                            {u.phone && <span>📞 {u.phone}</span>}
                            <span>•</span>
                            <span>📦 Yuklari: <b className="text-gray-800">{userParcelsCount} ta</b></span>
                            {u.defaultDeliveryBranch && (
                              <>
                                <span>•</span>
                                <span>🏢 {u.defaultDeliveryBranch.provider} {u.defaultDeliveryBranch.branchName}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* User Actions: Block & Full Wipe */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-colors border ${
                              isBlocked
                                ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {isBlocked ? 'Faollashtirish' : 'Bloklash'}
                          </button>

                          <button
                            onClick={() => setWipeTargetUser(u)}
                            className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl font-black text-[11px] transition-colors flex items-center gap-1 active:scale-95 shadow-sm"
                            title="Foydalanuvchi bot tarixi, yuklari va barcha ma'lumotlarini to'liq o'chirish"
                          >
                            <span>🗑 Butunlay o'chirish</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })()}



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

      {/* ========================================================================= */}
      {/* MODAL: ADD LESSON */}
      {/* ========================================================================= */}
      {showAddLessonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 animate-slide-up shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-lg">🎬</span>
                <h3 className="font-black text-base text-gray-900">Yangi dars qo'shish</h3>
              </div>
              <button
                onClick={() => setShowAddLessonModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddLesson} className="space-y-3 text-xs">
              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Kurs
                </label>
                <div className="px-3 py-2 bg-gray-100 rounded-xl font-bold text-gray-700">
                  {courses.find(c => c.id === selectedCourseId)?.title || selectedCourseId}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Dars sarlavhasi *
                </label>
                <input
                  type="text"
                  value={newLessonTitle}
                  onChange={(e) => setNewLessonTitle(e.target.value)}
                  placeholder="Masalan: 3. Ombor manzilini to'ldirish"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  YouTube havolasi yoki Video ID *
                </label>
                <input
                  type="text"
                  value={newLessonYoutube}
                  onChange={(e) => setNewLessonYoutube(e.target.value)}
                  placeholder="https://youtu.be/M7lc1UVf-VE yoki M7lc1UVf-VE"
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-900 outline-none focus:border-primary"
                  required
                />
                
                {/* Live Preview if YouTube ID recognized */}
                {(() => {
                  const val = newLessonYoutube.trim();
                  const match = val.match(/(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);
                  const parsedId = (match && match[1]) || (/^[a-zA-Z0-9_-]{11}$/.test(val) ? val : null);

                  if (parsedId) {
                    return (
                      <div className="mt-2 p-2.5 bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center gap-3 animate-fade-in">
                        <img
                          src={`https://img.youtube.com/vi/${parsedId}/mqdefault.jpg`}
                          alt="Video thumbnail"
                          className="w-20 h-12 object-cover rounded-lg border border-blue-200 shrink-0 bg-black"
                          onError={(e) => { (e.target as any).style.display = 'none'; }}
                        />
                        <div className="min-w-0 flex-1 text-[11px]">
                          <p className="font-bold text-blue-950 flex items-center gap-1">
                            <span>✓ Video ID aniqlandi:</span>
                            <span className="font-mono bg-blue-200/60 px-1.5 py-0.2 rounded font-black">{parsedId}</span>
                          </p>
                          <a
                            href={`https://www.youtube.com/watch?v=${parsedId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline font-bold inline-flex items-center gap-1 mt-0.5"
                          >
                            <span>▶️ YouTube'da ochib ko'rish</span>
                          </a>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Helpful YouTube upload tips */}
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                  <p className="font-bold mb-0.5">💡 YouTube'ga video yuklashda muhim sozlamalar:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                    <li>Kirish turi: <b>«Unlisted» (Доступ по ссылке)</b> qilib belgilang.</li>
                    <li>Kengaytirilgan sozlamalarda: <b>«Allow embedding» (Разрешить встраивание)</b> yoqilganligini tekshiring.</li>
                  </ul>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Taxminiy davomiyligi (sekundda) *
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={newLessonDuration}
                    onChange={(e) => setNewLessonDuration(e.target.value)}
                    placeholder="360"
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold font-mono text-gray-900 outline-none focus:border-primary"
                    required
                  />
                  <div className="flex gap-1 shrink-0">
                    {[
                      { label: '5 daq', sec: '300' },
                      { label: '10 daq', sec: '600' },
                      { label: '15 daq', sec: '900' },
                    ].map(preset => (
                      <button
                        key={preset.sec}
                        type="button"
                        onClick={() => setNewLessonDuration(preset.sec)}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-colors ${
                          newLessonDuration === preset.sec
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 block">
                  *(Talaba videoni boshlaganda, dars davomiyligi YouTube orqali avtomatik aniq vaqtga moslanadi).
                </span>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">
                  Dars tavsifi (ixtiyoriy)
                </label>
                <textarea
                  rows={2}
                  value={newLessonDesc}
                  onChange={(e) => setNewLessonDesc(e.target.value)}
                  placeholder="Dars haqida qisqacha ma'lumot..."
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 outline-none focus:border-primary"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLessonModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Bekor qilish
                </button>
                <button
                  type="submit"
                  disabled={addLessonLoading || !newLessonTitle.trim() || !newLessonYoutube.trim()}
                  className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-md shadow-primary/20 active:scale-95 transition-all"
                >
                  {addLessonLoading ? 'Saqlanmoqda...' : 'Darsni saqlash'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FULL WIPE USER CONFIRMATION */}
      {/* ========================================================================= */}
      {wipeTargetUser && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in modal-backdrop">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full space-y-4 animate-slide-up shadow-2xl border border-red-100">
            <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto shadow-inner">
              ⚠️
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-lg text-gray-900">
                Mijozni butunlay tozalash (Full Wipe)
              </h3>
              <p className="text-xs text-gray-500">
                Ushbu amalni ortga qaytarib bo'lmaydi!
              </p>
            </div>

            {/* Target info card */}
            <div className="bg-red-50/70 rounded-2xl p-3.5 border border-red-200/80 text-xs text-red-950 space-y-1.5">
              <div className="flex items-center justify-between font-bold">
                <span>Mijoz kodi:</span>
                <span className="font-mono bg-white px-2 py-0.5 rounded text-red-700 border border-red-200">
                  {wipeTargetUser.customerCode || 'Mavjud emas'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Ismi:</span>
                <span className="font-bold">{wipeTargetUser.name || 'Mijoz'}</span>
              </div>
              {wipeTargetUser.telegramUserId && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Telegram ID:</span>
                  <span className="font-mono font-bold">{wipeTargetUser.telegramUserId}</span>
                </div>
              )}
            </div>

            {/* What will be wiped list */}
            <div className="space-y-1.5 text-xs text-gray-600 bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
              <p className="font-bold text-gray-800 text-[11px] uppercase tracking-wider mb-1">Quyidagi barcha ma'lumotlar o'chiriladi:</p>
              <p className="flex items-start gap-1.5">
                <span className="text-red-500 font-bold shrink-0">✓</span>
                <span><b>Telegram bot tarixi:</b> Foydalanuvchining barcha suhbati va ro'yxatdan o'tish holati noldan boshlanadi.</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="text-red-500 font-bold shrink-0">✓</span>
                <span><b>Barcha yuklari:</b> Ushbu mijozga tegishli barcha kiritilgan treklar va jo'natmalar o'chiriladi.</span>
              </p>
              <p className="flex items-start gap-1.5">
                <span className="text-red-500 font-bold shrink-0">✓</span>
                <span><b>Akademiya darslari:</b> Ko'rilgan darslar progressi va kursga berilgan ruxsatlar bekor qilinadi.</span>
              </p>
            </div>

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              <button
                onClick={() => handleWipeUser(wipeTargetUser)}
                disabled={wipeLoading}
                className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-red-600/30 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {wipeLoading ? (
                  <span>Tozalanmoqda...</span>
                ) : (
                  <>
                    <span>🗑 Ha, barcha ma'lumotlarni butunlay tozalash</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setWipeTargetUser(null)}
                disabled={wipeLoading}
                className="w-full py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 transition-colors"
              >
                Bekor qilish
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
