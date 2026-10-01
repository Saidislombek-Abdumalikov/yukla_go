
import React, { useState, useRef, useEffect } from 'react';
import { sendMessageToGemini } from '../services/geminiService';
import { ChatMessage } from '../types';

const SUGGESTIONS_UZ = [
  "10kg kiyim qancha bo'ladi?",
  "Ombor manzili qayerda?",
  "Batareya mumkinmi?",
  "Yetkazib berish vaqti?"
];

const TabSupport: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Assalomu alaykum! Men YAQIIN CARGO AI yordamchisiman. Sizga qanday yordam bera olaman?' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    let fullResponse = "";
    // Create a placeholder message for the model
    setMessages(prev => [...prev, { role: 'model', text: '' }]);

    try {
        const stream = sendMessageToGemini(text);
        
        for await (const chunk of stream) {
            fullResponse += chunk;
            setMessages(prev => {
                const newMsgs = [...prev];
                const lastMsg = newMsgs[newMsgs.length - 1];
                if (lastMsg.role === 'model') {
                    lastMsg.text = fullResponse;
                }
                return newMsgs;
            });
        }
    } catch (e) {
         setMessages(prev => [...prev, { role: 'model', text: "Uzur, xatolik yuz berdi.", isError: true }]);
    } finally {
        setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-fade-in bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
      
      {/* Header */}
      <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
            </div>
            <div>
            <h2 className="font-bold text-gray-900">Yordamchi</h2>
            <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <p className="text-xs text-gray-500">Online • AI</p>
            </div>
            </div>
        </div>

        <a 
            href="https://t.me/yaqiin" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-primary hover:bg-primary-dark text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-1 shadow-sm active:scale-95"
        >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.02.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Bog'lanish
        </a>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                msg.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none' 
                : 'bg-white text-gray-800 border border-gray-100 rounded-tl-none'
              } ${msg.isError ? 'bg-red-50 text-red-600 border-red-100' : ''}`}
            >
              {msg.text || (isTyping && idx === messages.length -1 ? <span className="animate-pulse">...</span> : '')}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestions (Only show if few messages or idle) */}
      {messages.length < 3 && (
         <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 overflow-x-auto no-scrollbar flex gap-2">
            {SUGGESTIONS_UZ.map((faq, i) => (
               <button 
                  key={i} 
                  onClick={() => handleSend(faq)}
                  className="whitespace-nowrap px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-primary hover:bg-blue-50 transition-colors"
               >
                  {faq}
               </button>
            ))}
         </div>
      )}

      {/* Input */}
      <div className="p-3 bg-white border-t border-gray-100">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Xabar yozing..."
            className="flex-1 px-4 py-3 bg-gray-100 border-transparent focus:bg-white border focus:border-primary rounded-xl outline-none text-sm transition-all"
            disabled={isTyping}
          />
          <button 
            type="submit"
            disabled={!input.trim() || isTyping}
            className="bg-primary text-white p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-dark transition-colors"
          >
            <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default TabSupport;
