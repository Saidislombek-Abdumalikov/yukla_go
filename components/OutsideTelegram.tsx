import React from 'react';

interface OutsideTelegramProps {
  onAdminClick?: () => void;
}

const OutsideTelegram: React.FC<OutsideTelegramProps> = ({ onAdminClick }) => {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center animate-fade-in select-none">
      <div className="w-full max-w-sm bg-white p-8 rounded-[36px] shadow-soft border border-gray-100 space-y-6">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl mx-auto flex items-center justify-center text-4xl shadow-soft">
          📦
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Yukla Go</h1>
          <p className="text-gray-500 text-xs leading-relaxed px-2">
            Ilovadan foydalanish uchun rasmiy Telegram botimiz orqali kiring.
          </p>
        </div>

        <a
          href="https://t.me/yuklakargobot"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-4 px-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <span>Telegram orqali kirish</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
      </div>

      {/* Discreet admin entry point without exposing buttons or tokens */}
      <div className="mt-8 text-center">
        <button
          type="button"
          onClick={() => {
            if (onAdminClick) {
              onAdminClick();
            } else {
              window.location.hash = '#admin';
            }
          }}
          className="text-[11px] text-gray-400/80 hover:text-gray-600 transition-colors p-2"
          title="Admin"
        >
          🔒 Boshqaruv
        </button>
      </div>
    </div>
  );
};

export default OutsideTelegram;
