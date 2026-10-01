import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { convertExcelRowToParcel, updateGlobalTrackingData, getAppSettings, saveAppSettings } from '../services/storageService';
import { ParcelData, AppSettings } from '../types';

const AdminUpload: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  
  // App Logic State
  const [activeTab, setActiveTab] = useState<'upload' | 'settings'>('upload');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState<{ processed: number; errors: number } | null>(null);
  
  // Settings State
  const [settings, setSettings] = useState<AppSettings>(getAppSettings());

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Updated PIN to s08121719
    if (pin === 's08121719') {
      setIsAuthenticated(true);
    } else {
      alert('PIN kod noto\'g\'ri');
      setPin('');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(`${file.name} o'qilmoqda...`);
    setStats(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        let headerRowIndex = 0;

        for (let i = 0; i < Math.min(aoa.length, 20); i++) {
            const row = aoa[i];
            if (!row || !Array.isArray(row)) continue;
            
            const rowStr = JSON.stringify(row);
            if (rowStr.includes('追踪代码') || rowStr.includes('Tracking') || rowStr.includes('Track No')) {
                headerRowIndex = i;
                break;
            }
        }

        const data = XLSX.utils.sheet_to_json(ws, { range: headerRowIndex });

        const newParcels: ParcelData[] = [];
        let errors = 0;

        data.forEach((row: any) => {
            const parcel = convertExcelRowToParcel(row);
            if (parcel) {
                newParcels.push(parcel);
            } else {
                if (Object.keys(row).length > 2) errors++;
            }
        });

        if (newParcels.length > 0) {
            updateGlobalTrackingData(newParcels);
            setMessage(`${file.name} yuklandi: ${newParcels.length} ta yuk yangilandi.`);
            setStats({ processed: newParcels.length, errors });
        } else {
            setMessage('Faylda yuk ma\'lumotlari topilmadi.');
        }

      } catch (error) {
        console.error(error);
        setMessage('Xatolik: Excel fayl formati noto\'g\'ri.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSaveSettings = () => {
    saveAppSettings(settings);
    alert('Sozlamalar saqlandi!');
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-2xl">
          <h3 className="text-center font-bold text-lg mb-4">Admin Kirish</h3>
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="password" 
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="PIN kiriting" 
              className="w-full text-center text-xl tracking-widest p-3 border rounded-xl"
              autoFocus
            />
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 py-2 text-gray-500">Bekor qilish</button>
              <button type="submit" className="flex-1 py-2 bg-gray-900 text-white rounded-xl">Kirish</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl animate-fade-in overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-4 border-b border-gray-100">
            <h3 className="font-bold text-lg text-gray-900">Admin Panel</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">Yopish</button>
        </div>

        <div className="flex p-2 gap-2 bg-gray-50">
            <button 
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'upload' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
            >
                Excel Yuklash
            </button>
            <button 
                onClick={() => setActiveTab('settings')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'settings' ? 'bg-white shadow-sm text-primary' : 'text-gray-500'}`}
            >
                Narxlarni O'zgartirish
            </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {activeTab === 'upload' ? (
              <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800">
                      <p className="font-semibold mb-1">Yo'riqnoma:</p>
                      <p>Excel fayllarni yuklang. Tizim avtomatik ravishda sarlavha qatorini qidiradi.</p>
                  </div>

                  <label className="block w-full cursor-pointer">
                      <input 
                          type="file" 
                          accept=".xlsx, .xls" 
                          onChange={handleFileUpload} 
                          className="hidden" 
                          disabled={uploading}
                      />
                      <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors">
                          {uploading ? (
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                          ) : (
                              <>
                                  <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                                  <span className="text-sm text-gray-500 font-medium">Excel fayl tanlash</span>
                              </>
                          )}
                      </div>
                  </label>

                  {message && (
                      <div className={`text-center text-sm p-2 rounded-lg ${message.includes('Xatolik') || message.includes('topilmadi') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                          {message}
                      </div>
                  )}
                  
                  {stats && (
                      <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-green-50 p-2 rounded-lg">
                              <p className="text-xl font-bold text-green-700">{stats.processed}</p>
                              <p className="text-[10px] uppercase text-green-600 font-bold">Qo'shildi</p>
                          </div>
                          <div className="bg-red-50 p-2 rounded-lg">
                              <p className="text-xl font-bold text-red-700">{stats.errors}</p>
                              <p className="text-[10px] uppercase text-red-600 font-bold">Xatolik</p>
                          </div>
                      </div>
                  )}
              </div>
          ) : (
              <div className="space-y-5">
                  <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Dollar Kursi (UZS)</label>
                      <input 
                          type="number" 
                          value={settings.exchangeRate}
                          onChange={(e) => setSettings({...settings, exchangeRate: Number(e.target.value)})}
                          className="w-full p-3 border rounded-xl text-lg font-bold"
                      />
                  </div>

                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <span className="text-xl">🚛</span> AVTO Narxlar ($)
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                          <div>
                              <label className="text-xs text-gray-500">Standart</label>
                              <input 
                                  type="number" step="0.1"
                                  value={settings.prices.avto.standard}
                                  onChange={(e) => setSettings({...settings, prices: {...settings.prices, avto: {...settings.prices.avto, standard: Number(e.target.value)}}})}
                                  className="w-full p-2 border rounded-lg font-semibold"
                              />
                          </div>
                          <div>
                              <label className="text-xs text-gray-500">Hajm</label>
                              <input 
                                  type="number" step="0.1"
                                  value={settings.prices.avto.bulk}
                                  onChange={(e) => setSettings({...settings, prices: {...settings.prices, avto: {...settings.prices.avto, bulk: Number(e.target.value)}}})}
                                  className="w-full p-2 border rounded-lg font-semibold"
                              />
                          </div>
                      </div>
                  </div>

                  <button 
                      onClick={handleSaveSettings}
                      className="w-full py-3 bg-primary text-white rounded-xl font-bold shadow-lg shadow-blue-200 active:scale-95 transition-transform"
                  >
                      Saqlash
                  </button>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminUpload;