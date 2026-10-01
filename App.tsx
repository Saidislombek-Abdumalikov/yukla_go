
import { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import TabHome from './components/TabHome';
import TabCalculator from './components/TabCalculator';
import TabProfile from './components/TabProfile';
import TabMyParcels from './components/TabMyParcels';
import TabSupport from './components/TabSupport';
import Registration from './components/Registration';
import AdminDashboard from './components/AdminDashboard';
import AddTrackModal from './components/AddTrackModal';
import { Tab } from './types';
import { getUserProfile, logoutUser, syncGlobalSettings, registerUserActivity } from './services/storageService';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.HOME);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      try {
        window.Telegram.WebApp.enableClosingConfirmation();
      } catch (e) {
        console.log('Closing confirmation not supported');
      }
    }

    const profile = getUserProfile();
    if (profile && profile.clientId && profile.phone) {
      setIsRegistered(true);
      // Update activity timestamp for tracking
      registerUserActivity(profile);
    }
    
    syncGlobalSettings();
  }, []);

  const handleLogout = () => {
      logoutUser();
      setIsRegistered(false);
      setActiveTab(Tab.HOME);
  };

  const handleTrackAdded = () => {
      setRefreshKey(prev => prev + 1);
      setActiveTab(Tab.MY_PARCELS);
  };

  if (isAdminMode) {
      return <AdminDashboard onLogout={() => {
        setIsAdminMode(false);
        if (window.location.hash === '#admin') {
            history.pushState("", document.title, window.location.pathname + window.location.search);
        }
      }} />;
  }

  if (!isRegistered) {
    return (
      <Registration 
        onRegister={() => setIsRegistered(true)} 
        onAdminLogin={() => {
          setIsAdminMode(true);
        }} 
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case Tab.HOME: return <TabHome onNavigate={setActiveTab} />;
      case Tab.MY_PARCELS: return <TabMyParcels refreshTrigger={refreshKey} />;
      case Tab.CALCULATOR: return <TabCalculator />;
      case Tab.SUPPORT: return <TabSupport />;
      case Tab.PROFILE: return <TabProfile onLogout={handleLogout} />;
      default: return <TabHome onNavigate={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen pb-safe-bottom">
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-orange-200/30 rounded-full blur-[100px] pointer-events-none z-0"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-yellow-200/20 rounded-full blur-[100px] pointer-events-none z-0"></div>

      <main className="relative z-10 max-w-md mx-auto min-h-screen px-5 pt-6 pb-24 safe-area-top h-full">
        {renderContent()}
      </main>

      {isAddModalOpen && (
          <AddTrackModal 
            onClose={() => setIsAddModalOpen(false)} 
            onAdded={handleTrackAdded}
          />
      )}

      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onAddClick={() => setIsAddModalOpen(true)}
      />
    </div>
  );
}

export default App;
