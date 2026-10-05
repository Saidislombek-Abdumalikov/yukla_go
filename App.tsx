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

const ADMIN_TELEGRAM_IDS = [7232597769, 5059829001];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isCargoMode, setIsCargoMode] = useState(false);
  const [isAdminPreview, setIsAdminPreview] = useState(false);

  // Check if current user is an authorized admin
  const currentTgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  const isDev = import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname.includes('ngrok');
  const isAdminUser = Boolean(
    (currentTgId && ADMIN_TELEGRAM_IDS.includes(Number(currentTgId))) ||
    (isDev && (window.location.search.includes('admin=true') || window.location.hash === '#admin'))
  );

  // Authentication & environment states
  const [isTelegramEnv, setIsTelegramEnv] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg && typeof tg.ready === 'function') {
      tg.ready();
      tg.expand();
      try {
        tg.enableClosingConfirmation();
      } catch (e) {
        // Ignored
      }
      try {
        // Telegram Bot API 7.7+: Disables pull-down-to-close gesture during scrolling
        if (typeof (tg as any).disableVerticalSwipes === 'function') {
          (tg as any).disableVerticalSwipes();
        }
      } catch (e) {
        // Ignored
      }
    }

    const initData = tg?.initData;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isTunnel = window.location.hostname.includes('ngrok') || window.location.hostname.includes('loca.lt');
    const isDevEnv = import.meta.env.DEV || isLocalhost || isTunnel || window.location.search.includes('preview=true') || window.location.search.includes('dev=true');

    if (!initData && !isDevEnv) {
      setIsTelegramEnv(false);
      setAuthLoading(false);
      return;
    }

    // Attempt authentication if initData is present
    if (initData) {
      api.authWithTelegram(initData)
        .then(() => {
          setAuthLoading(false);
        })
        .catch((err) => {
          console.warn('Auth issue:', err.message);
          setAuthError(err.message);
          setAuthLoading(false);
        });
    } else {
      // Dev / Preview mode: preload profile
      api.getProfile().finally(() => {
        setAuthLoading(false);
      });
    }

    // Check URL parameters and hash for specific apps
    const checkModes = () => {
      const search = window.location.search;
      const hash = window.location.hash;

      if (hash === '#admin' || search.includes('admin=true')) {
        setIsAdminPreview(true);
      } else {
        setIsAdminPreview(false);
      }

      if (search.includes('app=cargo') || hash === '#cargo') {
        setIsCargoMode(true);
      } else {
        setIsCargoMode(false);
      }
    };

    checkModes();
    window.addEventListener('hashchange', checkModes);
    return () => window.removeEventListener('hashchange', checkModes);
  }, [isAdminUser]);

  const handleTrackAdded = () => {
    setRefreshKey(prev => prev + 1);
    setActiveTab(Tab.MY_PARCELS);
  };

  // 1. Admin Mode (Protected by secure passkey & server-side role validation)
  if (isAdminPreview) {
    return (
      <AdminDashboard 
        onBack={() => {
          setIsAdminPreview(false);
          window.location.hash = '';
        }} 
      />
    );
  }

  // 2. If opened directly outside Telegram in a browser
  if (!isTelegramEnv) {
    return (
      <OutsideTelegram 
        onAdminClick={() => {
          setIsAdminPreview(true);
          window.location.hash = '#admin';
        }} 
      />
    );
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6">
        <div className="animate-spin h-8 w-8 border-3 border-primary border-t-transparent rounded-full mb-3"></div>
        <p className="text-xs font-bold text-gray-500">Yuklanmoqda...</p>
      </div>
    );
  }

  // Auth Error (e.g. Needs onboarding or blocked)
  if (authError) {
    return (
      <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-soft space-y-4">
          <span className="text-3xl block">⚠️</span>
          <h3 className="font-black text-gray-900 text-base">Diqqat</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{authError}</p>
          <div className="space-y-2">
            <a
              href="https://t.me/yuklakargobot"
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 bg-primary text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20"
            >
              Telegram botga o'tish
            </a>
            <button
              onClick={() => setAuthError(null)}
              className="block w-full py-2 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-xl text-xs font-medium"
            >
              Ko'rish rejimida davom etish
            </button>
          </div>
        </div>
      </div>
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
