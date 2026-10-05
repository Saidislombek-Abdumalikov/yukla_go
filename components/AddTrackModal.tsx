import React, { useState } from 'react';
import { api } from '../services/api';

interface AddTrackModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const AddTrackModal: React.FC<AddTrackModalProps> = ({ onClose, onAdded }) => {
  const [trackInput, setTrackInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const cleaned = trackInput.trim();
    if (!cleaned) return;

    setLoading(true);
    try {
      // Split by comma or newlines for multiple tracks
      const trackIds = cleaned
        .split(/[\n,]+/)
        .map(id => id.trim().toUpperCase())
        .filter(id => id.length > 0);

      if (trackIds.length === 0) {
        setError('Trek raqamini kiriting');
        setLoading(false);
        return;
      }

      // Add each tracking code
      for (const id of trackIds) {
        await api.addTracking(id);
      }

      onAdded();
      handleClose();
    } catch (err: any) {
      setError(err?.message || 'Xatolik yuz berdi. Qayta urinib ko\'ring.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 modal-backdrop">
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleClose}
      ></div>
      
      <div className={`bg-white w-full max-w-sm rounded-[32px] p-6 shadow-2xl z-10 relative transform transition-all duration-300 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-slide-up'}`}>
        <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>

        <h3 className="text-xl font-black text-gray-900 mb-1 text-center">Track qo'shish</h3>
        <p className="text-gray-500 text-xs text-center mb-5">
          Xitoy buyurtmangizning kuzatuv (track) raqamini kiriting
        </p>
        
        <form onSubmit={handleAdd} className="space-y-4">
          <div>
            <textarea 
              value={trackInput}
              onChange={(e) => setTrackInput(e.target.value)}
              placeholder="Masalan: YT882910291CN"
              autoFocus
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-mono font-bold text-base uppercase resize-none text-gray-800 placeholder:text-gray-400 placeholder:font-sans placeholder:font-normal placeholder:text-sm"
            />
            {error && (
              <p className="text-xs text-red-500 font-medium mt-1 text-center">{error}</p>
            )}
          </div>

          <button 
            type="submit"
            disabled={loading || !trackInput.trim()}
            className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all active:scale-95 ${
              loading || !trackInput.trim() 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
                : 'bg-primary text-white shadow-lg shadow-primary/20 hover:bg-primary-dark'
            }`}
          >
            {loading ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
          </button>
          
          <button 
            type="button"
            onClick={handleClose}
            className="w-full py-2 text-gray-400 font-medium text-xs hover:text-gray-600 transition-colors"
          >
            Bekor qilish
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddTrackModal;
