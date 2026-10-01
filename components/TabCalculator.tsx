
import React, { useState, useEffect } from 'react';
import { getAppSettings } from '../services/storageService';
import { CargoType, AppSettings } from '../types';

const TabCalculator: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());
  const [inputValue, setInputValue] = useState<string>("");
  // Force AVIA type
  const [cargoType] = useState<CargoType>(CargoType.AVIA);
  const [isBulk, setIsBulk] = useState(false);
  
  // Calculated values
  const [results, setResults] = useState({
      price: 0,
      rate: 0
  });

  // Ensure settings are fresh
  useEffect(() => {
    const currentSettings = getAppSettings();
    if (currentSettings) {
        setSettings(currentSettings);
    }
  }, []);

  useEffect(() => {
    // Parse input safely
    let weight = 0;
    const cleanInput = inputValue.replace(',', '.');
    if (cleanInput && !isNaN(parseFloat(cleanInput))) {
        weight = parseFloat(cleanInput);
    }

    // Get rates safely (AVIA ONLY)
    const rate = isBulk ? settings.prices.avia.bulk : settings.prices.avia.standard;

    setResults({
        price: weight * rate,
        rate
    });
  }, [inputValue, isBulk, settings]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = e.target.value;
      
      // Allow clearing
      if (val === '') {
          setInputValue('');
          return;
      }

      // Replace comma with dot for logic
      val = val.replace(',', '.');

      // Validate: allow numbers and one decimal point
      if (/^\d*\.?\d*$/.test(val)) {
          // Limit length
          if (val.length <= 6) {
              setInputValue(val);
          }
      }
  };

  const handlePreset = (val: number) => setInputValue(val.toString());

  return (
    <div className="flex flex-col h-full animate-fade-in pb-32 overflow-y-auto no-scrollbar">
      {/* Header */}
      <div className="flex justify-between items-center px-1 py-2 shrink-0">
        <h2 className="text-xl font-bold text-text">Kalkulyator</h2>
        <div className="bg-white/50 backdrop-blur-sm px-3 py-1 rounded-lg border border-gray-200 text-[10px] font-bold text-gray-500">
            1 USD = {settings.exchangeRate.toLocaleString()} UZS
        </div>
      </div>

      <div className="flex flex-col gap-4">
          
          {/* Service Indicator (Fixed to AVIA) */}
          <div className="bg-blue-50 p-3 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-center gap-2 shrink-0">
               <span className="text-xl">✈️</span>
               <span className="font-black text-blue-600 tracking-wide text-sm">AVIA (Havo Yo'li)</span>
          </div>

          {/* Result Card (ORANGE GRADIENT) */}
          <div className="bg-gradient-to-br from-[#fe7d08] to-[#cc5a00] rounded-3xl p-5 text-white shadow-lg shadow-orange-900/30 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl"></div>
              
              <div className="relative z-10 flex flex-col items-center justify-center py-2">
                  <span className="text-[10px] font-medium text-orange-100 uppercase tracking-widest mb-1">Jami Hisob</span>
                  
                  <div className="flex items-start justify-center gap-1">
                      <span className="text-2xl font-bold mt-1 text-orange-200">$</span>
                      <span className="text-5xl font-black tracking-tight text-white">{results.price.toFixed(2)}</span>
                  </div>
                  
                  <div className="mt-2 bg-black/20 px-3 py-1 rounded-lg">
                     <p className="text-white/90 font-bold text-xs">
                        ≈ {(results.price * settings.exchangeRate).toLocaleString()} UZS
                     </p>
                  </div>
                  
                  <div className="mt-3 text-xs text-orange-200 font-medium">
                      Tarif: ${results.rate.toFixed(1)} / kg
                  </div>
              </div>
          </div>

          {/* Input & Controls */}
          <div className="bg-white rounded-[24px] p-5 shadow-soft border border-gray-100 flex flex-col justify-center">
              
              {/* Input */}
              <div className="relative mb-6 text-center">
                  <p className="text-[10px] text-gray-400 font-bold uppercase mb-2">Yuk Og'irligi (kg)</p>
                  <input
                      type="text"
                      inputMode="decimal"
                      value={inputValue}
                      onChange={handleInputChange}
                      placeholder="0"
                      className="text-4xl font-black text-center w-full bg-transparent outline-none text-gray-800 placeholder-gray-200"
                  />
              </div>

             {/* Presets */}
            <div className="grid grid-cols-4 gap-2 mb-6">
                {[0.5, 1, 5, 10].map((val) => (
                    <button 
                        key={val}
                        onClick={() => handlePreset(val)}
                        className="py-2.5 rounded-xl text-xs font-bold bg-gray-50 text-gray-600 border border-gray-100 hover:bg-gray-100 active:scale-95"
                    >
                        {val} kg
                    </button>
                ))}
            </div>

            {/* Bulk Toggle */}
            <div 
                onClick={() => setIsBulk(!isBulk)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer active:scale-[0.98] ${isBulk ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-transparent'}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${isBulk ? 'bg-orange-100 text-orange-600' : 'bg-white text-gray-400 shadow-sm'}`}>
                        📦
                    </div>
                    <div>
                        <p className={`font-bold text-xs ${isBulk ? 'text-orange-900' : 'text-gray-700'}`}>Katta Hajm</p>
                        <p className="text-[10px] text-gray-400">50sm+ yoki 5+ dona</p>
                    </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors relative ${isBulk ? 'bg-orange-500' : 'bg-gray-300'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${isBulk ? 'left-5' : 'left-1'}`}></div>
                </div>
            </div>
          </div>
      </div>
    </div>
  );
};

export default TabCalculator;
