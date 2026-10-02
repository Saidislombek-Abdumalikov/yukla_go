import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TabHome from './components/TabHome';
import TabMyParcels from './components/TabMyParcels';
import TabCalculator from './components/TabCalculator';
import TabProfile from './components/TabProfile';
import AddTrackModal from './components/AddTrackModal';
import AdminDashboard from './components/admin/AdminDashboard';
import OutsideTelegram from './components/OutsideTelegram';
import { Tab } from './types';
import { api } from './services/api';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAdminPreview, setIsAdminPreview] = useState(false);

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
    }

    const initData = tg?.initData;
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const isDevEnv = import.meta.env.DEV || isLocalhost || window.location.search.includes('preview=true') || window.location.search.includes('dev=true');

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

    // Check URL hash for admin preview
    if (window.location.hash === '#admin') {
      setIsAdminPreview(true);
    }
  }, []);

  const handleTrackAdded = () => {
    setRefreshKey(prev => prev + 1);
    setActiveTab(Tab.MY_PARCELS);
  };

  // If opened directly outside Telegram in a normal browser
  if (!isTelegramEnv) {
    return (
      <OutsideTelegram 
        onPreviewMode={() => {
          setIsTelegramEnv(true);
          setAuthLoading(false);
        }} 
      />
    );
  }

  // Admin Preview Mode
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
              href="https://t.me/yuklago_bot"
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
        return <TabProfile />;
      default:
        return (
          <TabHome 
            refreshTrigger={refreshKey}
            onNavigate={setActiveTab} 
            onAddClick={() => setIsAddModalOpen(true)} 
          />
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#1F2937]">
      {/* Background Soft Accent Glows */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-100/40 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-sky-100/30 rounded-full blur-[100px] pointer-events-none z-0"></div>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-md mx-auto min-h-screen px-4 pt-4 pb-28 safe-area-top">
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

export default App;
