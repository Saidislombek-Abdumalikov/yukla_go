
import React from 'react';
import { Tab } from '../types';

interface NavbarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  onAddClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onAddClick }) => {
  const navItemsLeft = [
    { id: Tab.HOME, label: 'Asosiy', icon: (active: boolean) => (
      <svg className={`w-6 h-6 transition-all ${active ? 'fill-primary' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
    )},
    { id: Tab.MY_PARCELS, label: 'Yuklarim', icon: (active: boolean) => (
      <svg className={`w-6 h-6 transition-all ${active ? 'fill-primary' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
    )},
  ];

  const navItemsRight = [
    { id: Tab.CALCULATOR, label: 'Hisoblash', icon: (active: boolean) => (
      <svg className={`w-6 h-6 transition-all ${active ? 'fill-primary' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
    )},
    { id: Tab.PROFILE, label: 'Profil', icon: (active: boolean) => (
      <svg className={`w-6 h-6 transition-all ${active ? 'fill-primary' : 'fill-none stroke-current'}`} viewBox="0 0 24 24" strokeWidth={active ? 0 : 2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    )},
  ];

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-1.5 flex justify-between items-center max-w-md mx-auto relative">
        
        {/* Left Side */}
        <div className="flex flex-1 justify-around">
          {navItemsLeft.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl transition-all duration-300 ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                {item.icon(isActive)}
                <span className="text-[10px] font-bold mt-1">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Central Add Button */}
        <div className="relative -top-6 px-2">
            <button 
                onClick={onAddClick}
                className="w-14 h-14 bg-primary rounded-2xl shadow-glow shadow-primary/40 flex items-center justify-center text-white active:scale-90 transition-transform"
            >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
            </button>
        </div>

        {/* Right Side */}
        <div className="flex flex-1 justify-around">
          {navItemsRight.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl transition-all duration-300 ${isActive ? 'text-primary' : 'text-text-secondary'}`}
              >
                {item.icon(isActive)}
                <span className="text-[10px] font-bold mt-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Navbar;
