import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TabHome from './components/TabHome';
import TabMyParcels from './components/TabMyParcels';
import TabCalculator from './components/TabCalculator';
import TabProfile from './components/TabProfile';
import AddTrackModal from './components/AddTrackModal';
import AdminDashboard from './components/admin/AdminDashboard';
import OutsideTelegram from './components/OutsideTelegram';
import AcademyApp from './components/academy/AcademyApp';
import { Tab } from './types';
import { api } from './services/api';

type Phase = 'loading' | 'ready' | 'error' | 'outside';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCargoMode, setIsCargoMode] = useState(false);
  const [isAdminPreview, setIsAdminPreview] = useState(false);

  // Who is using the app is decided by the SERVER from Telegram's signed data. Nothing else.
  const [phase, setPhase] = useState<Phase>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [role, setRole] = useState<string>('customer');
  const [attempt, setAttempt] = useState(0);
  const isAdminUser = role === 'admin' || role === 'super_admin';

  // Telegram setup + login. Every button in the bot opens the same app, and every
  // open signs in again from Telegram's initData, so all buttons give the same account.
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && typeof tg.ready === 'function') {
      tg.ready();
      tg.expand();
      try { tg.enableClosingConfirmation(); } catch (e) { /* ignored */ }
      try {
        if (typeof (tg as any).disableVerticalSwipes === 'function') (tg as any).disableVerticalSwipes();
      } catch (e) { /* ignored */ }
    }

    const initData = tg?.initData;
    if (!initData) {
      setPhase('outside');
      return;
    }

    let cancelled = false;
    setPhase('loading');
    setAuthError(null);
    api.authWithTelegram(initData)
      .then((res) => {
        if (cancelled) return;
        setRole(res.user?.role || 'customer');
        setPhase('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setAuthError(err?.message || 'Kirishda xatolik yuz berdi');
        setPhase('error');
      });
    return () => { cancelled = true; };
  }, [attempt]);

  // Session expired mid-use -> sign in again automatically
  useEffect(() => {
    const onExpired = () => setAttempt(a => a + 1);
    window.addEventListener('yukla-auth-expired', onExpired);
    return () => window.removeEventListener('yukla-auth-expired', onExpired);
  }, []);

  // Link modes (#admin, app=cargo)
  useEffect(() => {
    const checkModes = () => {
      setIsAdminPreview(window.location.hash === '#admin');
      setIsCargoMode(window.location.search.includes('app=cargo') || window.location.hash === '#cargo');
    };
    checkModes();
    window.addEventListener('hashchange', checkModes);
    return () => window.removeEventListener('hashchange', checkModes);
  }, []);

  const handleTrackAdded = () => {
    setRefreshKey(prev => prev + 1);
    setActiveTab(Tab.MY_PARCELS);
  };

  if (phase === 'outside') {
    return <OutsideTelegram />;
  }

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6">
        <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mb-3"></div>
        <p className="text-xs font-bold text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-soft space-y-4">
          <span className="text-3xl block">⚠️</span>
          <h3 className="font-black text-gray-900 text-base">Kirib bo'lmadi</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{authError}</p>
          <button
            onClick={() => setAttempt(a => a + 1)}
            className="block w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20"
          >
            Qayta urinish
          </button>
        </div>
      </div>
    );
  }

  // Admin dashboard: only when the SERVER says this Telegram account is an admin.
  if (isAdminPreview && isAdminUser) {
    return (
      <AdminDashboard
        onBack={() => {
          setIsAdminPreview(false);
          window.location.hash = '';
        }}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case Tab.HOME:
        return (
          <TabHome 
            refreshTrigger={refreshKey}
            onNavigate={setActiveTab} 
            onAddClick={() => setIsAddModalOpen(true)} 
            onOpenAcademy={() => {
              setIsCargoMode(false);
              window.location.hash = '';
            }}
          />
        );
      case Tab.MY_PARCELS:
        return (
          <TabMyParcels 
            refreshTrigger={refreshKey} 
            onAddClick={() => setIsAddModalOpen(true)}
          />
        );
      case Tab.CALCULATOR:
        return <TabCalculator />;
      case Tab.PROFILE:
        return (
          <TabProfile 
            onOpenAcademy={() => {
              setIsCargoMode(false);
              window.location.hash = '';
            }} 
          />
        );
      default:
        return (
          <TabHome 
            refreshTrigger={refreshKey}
            onNavigate={setActiveTab} 
            onAddClick={() => setIsAddModalOpen(true)} 
            onOpenAcademy={() => {
              setIsCargoMode(false);
              window.location.hash = '';
            }}
          />
        );
    }
  };

  // 4. Preserved Cargo Flow (Hidden by default for future release, accessible via #cargo)
  if (isCargoMode) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] text-[#1F2937]">
        {/* Background Soft Accent Glows */}
        <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-100/30 rounded-full blur-[100px] pointer-events-none z-0"></div>

        {/* Main Content Area */}
        <main className="relative z-10 max-w-md mx-auto min-h-screen px-4 pt-4 pb-36 safe-area-top">
          {renderContent()}
        </main>

        {/* Add Track Modal */}
        {isAddModalOpen && (
          <AddTrackModal 
            onClose={() => setIsAddModalOpen(false)} 
            onAdded={handleTrackAdded}
          />
        )}

        {/* Bottom Floating Navigation */}
        <Navbar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          onAddClick={() => setIsAddModalOpen(true)} 
        />
      </div>
    );
  }

  // 5. PRIMARY DEFAULT MODE: Video Lessons & Academy (100% focused for release!)
  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1F2937]">
      <main className="relative z-10 max-w-md mx-auto min-h-screen px-4 pt-4 pb-20 safe-area-top">
        <AcademyApp />
      </main>

      {/* Floating Admin Switcher: ONLY visible to authorized admin IDs, NEVER shown to regular users */}
      {isAdminUser && (
        <div className="fixed bottom-4 right-4 z-50">
          <button
            onClick={() => {
              setIsAdminPreview(true);
              window.location.hash = '#admin';
            }}
            className="px-4 py-2.5 bg-gradient-to-r from-gray-950 to-gray-800 hover:from-black hover:to-gray-900 text-white rounded-2xl text-xs font-black shadow-2xl border border-gray-700/80 flex items-center gap-1.5 active:scale-95 transition-all"
            title="Admin Dashboardga o'tish"
          >
            <span>👑 Admin Panel</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
