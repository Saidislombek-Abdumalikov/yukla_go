import React, { useState, useEffect } from 'react';
import { DEV_DEFAULT_RATES } from '../constants';
import { api } from '../services/api';
import { ShippingRates } from '../types';

const TabCalculator: React.FC = () => {
  const [rates, setRates] = useState<ShippingRates>(DEV_DEFAULT_RATES);
  const [weightInput, setWeightInput] = useState<string>('');

  useEffect(() => {
    const fetchRates = () => api.getRates().then(setRates).catch(() => {});
    fetchRates();
    window.addEventListener('focus', fetchRates);
    return () => window.removeEventListener('focus', fetchRates);
  }, []);

  const weight = parseFloat(weightInput.replace(',', '.')) || 0;
  const estimatedUsd = weight * rates.pricePerKg;
  const estimatedUzs = estimatedUsd * rates.exchangeRate;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(',', '.');
    if (val === '' || /^\d*\.?\d*$/.test(val)) {
      if (val.length <= 6) {
        setWeightInput(val);
      }
    }
  };

  const handlePreset = (kg: number) => {
    setWeightInput(kg.toString());
  };

  return (
    <div className="space-y-5 pb-32 animate-fade-in">
      
      {/* Header */}
      <div className="flex justify-between items-center px-1 pt-1">
        <h2 className="text-2xl font-black text-gray-900 tracking-tight">Kalkulyator</h2>
        <div className="bg-white px-3 py-1 rounded-xl border border-gray-200 text-[10px] font-bold text-gray-500 shadow-sm">
          1 USD = {rates.exchangeRate.toLocaleString()} UZS
        </div>
      </div>

      {/* Result Card */}
      <div className="w-full bg-gradient-to-br from-[#185A96] to-[#114270] rounded-3xl p-6 text-white shadow-xl shadow-blue-900/15 relative overflow-hidden text-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-200 block mb-1">
          Taxminiy yetkazib berish narxi
        </span>

        <div className="flex items-baseline justify-center gap-1 my-2">
          <span className="text-2xl font-bold text-blue-200">$</span>
          <span className="text-5xl font-black tracking-tight">{estimatedUsd.toFixed(2)}</span>
        </div>

        <div className="inline-block bg-white/10 backdrop-blur-sm px-4 py-1.5 rounded-xl border border-white/10 mt-1">
          <p className="text-xs font-bold text-blue-100">
            ≈ {Math.round(estimatedUzs).toLocaleString()} UZS
          </p>
        </div>

        <p className="text-[10px] text-blue-200 mt-3 font-medium">
          Tarif: ${rates.pricePerKg} / kg (Havo yo'li)
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white rounded-3xl p-5 shadow-soft border border-gray-100 space-y-4">
        <div>
          <label className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mb-2 text-center">
            Yuk og'irligi (kg)
          </label>
          <div className="relative max-w-xs mx-auto">
            <input
              type="text"
              inputMode="decimal"
              value={weightInput}
              onChange={handleInputChange}
              placeholder="0"
              className="w-full text-center text-3xl font-black py-3 px-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary focus:bg-white transition-all text-gray-900 font-mono"
            />
          </div>
        </div>

        {/* Quick kg Presets */}
        <div className="flex justify-center gap-2 pt-1">
          {[0.5, 1, 2, 5, 10].map(val => (
            <button
              key={val}
              type="button"
              onClick={() => handlePreset(val)}
              className="py-1.5 px-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-bold text-gray-700 transition-colors active:scale-95"
            >
              {val} kg
            </button>
          ))}
        </div>
      </div>

      {/* Information Note */}
      <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-blue-900/80 leading-relaxed">
        <p className="font-bold text-blue-900 mb-1">ℹ️ Eslatma</p>
        <p className="text-[11px]">
          Ushbu hisob-kitob taxminiy hisoblanadi. Yakuniy to'lov miqdori yuk omborga yetib kelib, haqiqiy og'irligi va gabarit o'lchamlari o'lchanganidan so'ng aniqlanadi.
        </p>
      </div>

    </div>
  );
};

export default TabCalculator;
