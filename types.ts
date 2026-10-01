
export enum Tab {
  HOME = 'HOME',
  MY_PARCELS = 'MY_PARCELS',
  CALCULATOR = 'CALCULATOR',
  SUPPORT = 'SUPPORT',
  PROFILE = 'PROFILE',
}

export enum CargoType {
  AVTO = 'AVTO',
  AVIA = 'AVIA',
}

export interface TrackingEvent {
  date: string;
  time: string;
  status: string;
  location: string;
  completed: boolean;
}

export interface ParcelData {
  id: string;
  sender: string; 
  receiver: string; 
  weight: string;
  boxCode?: string; 
  price?: number; 
  history: TrackingEvent[];
}

export interface SavedTrack {
  id: string;
  note?: string; 
  addedAt: number;
}

export interface UserProfile {
  name: string;
  phone: string;
  clientId: string; 
  registeredAt: number;
  lastActive?: number;
}

export interface AppSettings {
  exchangeRate: number; 
  prices: {
    avto: {
      standard: number;
      bulk: number; 
    };
    avia: {
      standard: number;
      bulk: number;
    };
  };
  deliveryTime: {
    avto: string;
    avia: string;
  };
}

export interface ClientActivity {
  id: string;
  name: string;
  clientId: string;
  phone: string;
  lastActive?: string;
  parcelsCount?: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      API_KEY: string;
    }
  }
  interface Window {
    Telegram: {
      WebApp: {
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation: () => void;
        MainButton: {
          text: string;
          show: () => void;
          hide: () => void;
          onClick: (cb: () => void) => void;
        };
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          }
        }
      };
    };
  }
}
