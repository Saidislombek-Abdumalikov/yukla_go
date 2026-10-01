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

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAdminPreview, setIsAdminPreview] = useState(false);

  // Check Telegram WebApp environment
  const [isTelegramEnv, setIsTelegramEnv] = useState<boolean>(true);
  const [devPreviewActive, setDevPreviewActive] = useState<boolean>(false);

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
      // If opened in Telegram, initData is present
      if (!tg.initData && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setIsTelegramEnv(false);
      }
    } else {
      // In local dev, allow by default; in production web browser, gatekeep
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        setIsTelegramEnv(false);
      }
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
  if (!isTelegramEnv && !devPreviewActive) {
    return <OutsideTelegram onDevBypass={() => setDevPreviewActive(true)} />;
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

  const renderContent = () => {
    switch (activeTab) {
      case Tab.HOME:
        return <TabHome onNavigate={setActiveTab} onAddClick={() => setIsAddModalOpen(true)} />;
      case Tab.MY_PARCELS:
        return <TabMyParcels refreshTrigger={refreshKey} />;
      case Tab.CALCULATOR:
        return <TabCalculator />;
      case Tab.PROFILE:
        return <TabProfile />;
      default:
        return <TabHome onNavigate={setActiveTab} onAddClick={() => setIsAddModalOpen(true)} />;
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
