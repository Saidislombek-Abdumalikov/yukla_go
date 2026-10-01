
import React, { useState } from 'react';
import { saveUserTrack } from '../services/storageService';

interface AddTrackModalProps {
  onClose: () => void;
  onAdded: () => void;
}

const AddTrackModal: React.FC<AddTrackModalProps> = ({ onClose, onAdded }) => {
  const [trackInput, setTrackInput] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 300);
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackInput.trim()) return;
    
    // Split by comma, filter out empty strings, and trim each ID
    const trackIds = trackInput
      .split(',')
      .map(id => id.trim())
      .filter(id => id.length > 0);

    if (trackIds.length === 0) return;

    // Save each track ID
    trackIds.forEach(id => {
      saveUserTrack(id);
    });

    onAdded();
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
        onClick={handleClose}
      ></div>
      
      <div className={`bg-white w-full max-w-sm rounded-[32px] p-8 shadow-2xl z-10 relative transform transition-all duration-300 ${isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-slide-up'}`}>
        <h3 className="text-2xl font-black text-text mb-2 text-center">Yuk Qo'shish</h3>
        <p className="text-text-secondary text-sm text-center mb-6 px-2">
          Track ID raqamlarini kiriting. Bir nechta bo'lsa vergul (,) bilan ajrating.
        </p>
        
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="relative">
             <textarea 
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                placeholder="785..., 786..., 787..."
                autoFocus
                rows={3}
                className="w-full pl-4 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all uppercase font-bold text-lg resize-none"
             />
          </div>
          <button 
              type="submit"
              className="w-full bg-primary text-white py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 active:scale-95 transition-transform"
          >
              Ro'yxatga qo'shish
          </button>
          <button 
            type="button"
            onClick={handleClose}
            className="w-full py-2 text-text-secondary font-medium text-sm"
          >
            Bekor qilish
          </button>
        </form>
      </div>
    </div>
  );
};

export default AddTrackModal;
