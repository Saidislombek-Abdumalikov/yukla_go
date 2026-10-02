import React from 'react';

interface OutsideTelegramProps {
  onPreviewMode?: () => void;
}

const OutsideTelegram: React.FC<OutsideTelegramProps> = ({ onPreviewMode }) => {
  return (
    <div className="min-h-screen bg-[#F5F7FA] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="w-full max-w-sm bg-white p-8 rounded-[36px] shadow-soft border border-gray-100 space-y-5">
        <div className="w-20 h-20 bg-primary/10 text-primary rounded-3xl mx-auto flex items-center justify-center text-3xl font-black shadow-soft">
          📦
        </div>

        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Yukla Go</h1>
          <p className="text-gray-500 text-xs mt-2 leading-relaxed">
            Yukla Go ilovasi faqat rasmiy Telegram boti orqali ishlaydi.
          </p>
        </div>

        <a
          href="https://t.me/yuklago_bot"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-4 bg-primary hover:bg-primary-dark text-white rounded-2xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 active:scale-95"
        >
          <span>Telegram botni ochish</span>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>

        {onPreviewMode && (
          <button
            type="button"
            onClick={onPreviewMode}
            className="w-full py-2.5 px-4 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-2xl font-bold text-xs transition-colors"
          >
            Demo / Ko'rish rejimida ochish
          </button>
        )}
      </div>
    </div>
  );
};

export default OutsideTelegram;
