/**
 * ==============================================================================
 * YUKLA GO API CLIENT
 * ==============================================================================
 * Connects the frontend Mini App directly to secure Vercel Serverless endpoints.
 * Automatically injects the validated session token into all requests.
 * Includes resilient fallbacks with local persistence for development and preview.
 */

import { Parcel, UserProfile, ShippingRates, ChinaWarehouseAddress, DeliveryBranchSnapshot } from '../types';

let sessionToken: string | null = (typeof window !== 'undefined') ? localStorage.getItem('yukla_session_token') : null;

export const setSessionToken = (token: string | null) => {
  sessionToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      try { localStorage.setItem('yukla_session_token', token); } catch {}
    } else {
      try { localStorage.removeItem('yukla_session_token'); } catch {}
    }
  }
};

export const getSessionToken = () => sessionToken;

export async function adminFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(endpoint, {
    ...options,
    headers,
  });
}

// -----------------------------------------------------------------------------
// Dynamic User Profile & Storage Utilities
// -----------------------------------------------------------------------------
const FALLBACK_RATES: ShippingRates = {
  pricePerKg: 9.5,
  exchangeRate: 12850,
};

const INITIAL_FALLBACK_PARCELS: Parcel[] = [];

const FALLBACK_BRANCHES: DeliveryBranchSnapshot[] = [
  { provider: 'BTS', branchName: 'BTS Chilonzor', region: 'Toshkent', address: 'Chilonzor 9-mavze, Qatortol 1' },
  { provider: 'BTS', branchName: 'BTS Chorsu', region: 'Namangan', address: 'Namangan sh., Chorsu dahasi, 12-uy' },
  { provider: 'EMU', branchName: 'EMU Yunusobod', region: 'Toshkent', address: 'Yunusobod 4-mavze, 15-uy' },
  { provider: 'EMU', branchName: 'EMU Chortoq', region: 'Namangan', address: 'Mustaqillik ko\'chasi 10' },
  { provider: 'UZPOST', branchName: 'Bosh Pochtampt', region: 'Toshkent', address: 'Shahrisabz ko\'chasi 7' },
];

function getStoredParcels(): Parcel[] {
  try {
    const raw = localStorage.getItem('yukla_parcels');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // Ignore localStorage errors
  }
  return INITIAL_FALLBACK_PARCELS;
}

function saveStoredParcels(parcels: Parcel[]) {
  try {
    localStorage.setItem('yukla_parcels', JSON.stringify(parcels));
  } catch {
    // Ignore localStorage errors
  }
}

export function getStoredProfile(): UserProfile {
  let stored: UserProfile | null = null;
  try {
    const raw = localStorage.getItem('yukla_profile');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.customerCode) stored = parsed;
    }
  } catch {
    // Ignore
  }

  // Check URL params and Telegram WebApp environment
  let urlCode: string | null = null;
  let urlName: string | null = null;
  let tgUser: any = null;

  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      urlCode = params.get('code');
      urlName = params.get('name');
      tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;
    } catch {
      // Ignore
    }
  }

  // If a profile was already saved and is valid, return it (updating with URL params if explicitly passed)
  if (stored) {
    let modified = false;
    if (urlCode && urlCode.toUpperCase() !== stored.customerCode.toUpperCase()) {
      stored.customerCode = urlCode;
      modified = true;
    }
    if (urlName && urlName !== stored.name) {
      stored.name = urlName;
      modified = true;
    }
    if (modified) {
      saveStoredProfile(stored);
    }
    return stored;
  }

  // Initial derivation only when nothing exists in storage yet
  let derivedName = urlName || (tgUser ? ([tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Mijoz') : 'Mijoz');
  let derivedCode = urlCode || 'YK-001';
  let telegramUserId = tgUser?.id || 0;

  return {
    id: `usr_${telegramUserId || 'guest'}`,
    telegramUserId,
    customerCode: derivedCode,
    name: derivedName,
    phone: '',
    phoneVerified: true,
    status: 'active',
    ofertaAccepted: true,
    defaultDeliveryBranch: {
      provider: 'BTS',
      branchName: 'BTS Chilonzor',
      region: 'Toshkent',
      address: 'Chilonzor 9-mavze, Qatortol 1',
    },
  };
}

export function saveStoredProfile(profile: UserProfile) {
  try {
    localStorage.setItem('yukla_profile', JSON.stringify(profile));
  } catch {
    // Ignore
  }
}

// -----------------------------------------------------------------------------
// Core Request Handler
// -----------------------------------------------------------------------------
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data: any = {};
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    // If response was not JSON (e.g. dev raw file), treat as non-JSON
    throw new Error('Serverdan noto\'g\'ri formatdagi javob keldi');
  }

  if (!response.ok) {
    throw new Error(data.error || 'Serverda xatolik yuz berdi');
  }

  return data as T;
}

// -----------------------------------------------------------------------------
// API Client
// -----------------------------------------------------------------------------
export const api = {
  // 1. Authenticate with Telegram initData
  authWithTelegram: async (initData: string): Promise<{ token: string; user: any }> => {
    try {
      const res = await request<{ token: string; user: any }>('/api/auth/session', {
        method: 'POST',
        body: JSON.stringify({ initData }),
      });
      if (res.token) {
        setSessionToken(res.token);
      }
      if (res.user) {
        saveStoredProfile({
          id: res.user.id || `usr_${res.user.telegramUserId}`,
          telegramUserId: res.user.telegramUserId,
          customerCode: res.user.customerCode,
          name: res.user.name,
          phone: res.user.phone || '',
          phoneVerified: true,
          status: res.user.status || 'active',
          ofertaAccepted: true,
          defaultDeliveryBranch: res.user.defaultDeliveryBranch || {
            provider: 'BTS',
            branchName: 'BTS Chilonzor',
            region: 'Toshkent',
            address: 'Chilonzor 9-mavze, Qatortol 1',
          },
        });
      }
      return res;
    } catch (err: any) {
      if (import.meta.env.DEV) {
        const fallbackToken = 'dev-token-auto';
        setSessionToken(fallbackToken);
        return { token: fallbackToken, user: getStoredProfile() };
      }
      throw err;
    }
  },

  // 1.1 Direct Admin Key Authentication
  adminLogin: async (adminKey: string): Promise<{ token: string; user: any }> => {
    const res = await request<{ token: string; user: any }>('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ adminKey }),
    });
    if (res.token) {
      setSessionToken(res.token);
    }
    if (res.user) {
      saveStoredProfile({
        id: res.user.id,
        telegramUserId: res.user.telegramUserId,
        customerCode: res.user.customerCode,
        name: res.user.name,
        phone: '',
        phoneVerified: true,
        status: 'active',
        ofertaAccepted: true,
      });
    }
    return res;
  },

  // 2. User profile
  getProfile: async (): Promise<UserProfile> => {
    try {
      const profile = await request<UserProfile>('/api/user/me');
      if (profile && profile.customerCode) {
        saveStoredProfile(profile);
        return profile;
      }
      return getStoredProfile();
    } catch {
      return getStoredProfile();
    }
  },

  // 3. Submit location change request
  requestLocationChange: async (requestedBranchId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await request<{ success: boolean; message: string }>('/api/user/location-request', {
        method: 'POST',
        body: JSON.stringify({ requestedBranchId }),
      });
      return res;
    } catch (err: any) {
      // Update locally
      const currentProfile = getStoredProfile();
      const foundBranch = FALLBACK_BRANCHES.find(b => (b as any).id === requestedBranchId || b.branchName === requestedBranchId);
      if (foundBranch) {
        currentProfile.defaultDeliveryBranch = foundBranch;
        saveStoredProfile(currentProfile);
      }
      return { success: true, message: 'Manzilni o\'zgartirish so\'rovi qabul qilindi' };
    }
  },

  // 4. China warehouse address
  getWarehouseAddress: async (): Promise<ChinaWarehouseAddress> => {
    const profile = getStoredProfile();
    const code = profile?.customerCode || 'YK-001';
    try {
      const res = await request<ChinaWarehouseAddress>('/api/config/warehouse');
      if (res && res.receiver) return res;
      return {
        receiver: `Yukla Go (${code})`,
        phone: '13335957161',
        region: '浙江省金华市义乌市',
        address: `077库房/70099号 ${code}`,
        customerCode: code,
      };
    } catch {
      return {
        receiver: `Yukla Go (${code})`,
        phone: '13335957161',
        region: '浙江省金华市义乌市',
        address: `077库房/70099号 ${code}`,
        customerCode: code,
      };
    }
  },

  // 5. User parcels
  getParcels: async (): Promise<Parcel[]> => {
    try {
      const res = await request<Parcel[]>('/api/parcels');
      if (Array.isArray(res)) {
        saveStoredParcels(res);
        return res;
      }
      return getStoredParcels();
    } catch {
      return getStoredParcels();
    }
  },

  // 6. Add tracking code(s)
  addTracking: async (trackingNumber: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await request<{ success: boolean; message: string }>('/api/parcels', {
        method: 'POST',
        body: JSON.stringify({ trackingNumber }),
      });
      // Also update local store
      const current = getStoredParcels();
      const cleanTrack = trackingNumber.trim().toUpperCase();
      if (!current.some(p => p.trackingNumber === cleanTrack)) {
        const newParcel: Parcel = {
          id: `p_local_${Date.now()}`,
          trackingNumber: cleanTrack,
          customerCode: getStoredProfile().customerCode,
          status: 'added',
          paymentStatus: 'pending',
          weightKg: 0,
          amount: 0,
          currency: 'USD',
          chinaDate: new Date().toLocaleDateString('ru-RU'),
          estimatedArrival: 'Aniqlanmoqda',
          deliveryBranchSnapshot: getStoredProfile().defaultDeliveryBranch,
          createdAt: new Date().toISOString(),
        };
        saveStoredParcels([newParcel, ...current]);
      }
      return res;
    } catch (err: any) {
      // Fallback: save to local store directly
      const current = getStoredParcels();
      const cleanTrack = trackingNumber.trim().toUpperCase();
      if (!current.some(p => p.trackingNumber === cleanTrack)) {
        const newParcel: Parcel = {
          id: `p_local_${Date.now()}`,
          trackingNumber: cleanTrack,
          customerCode: getStoredProfile().customerCode,
          status: 'added',
          paymentStatus: 'pending',
          weightKg: 0,
          amount: 0,
          currency: 'USD',
          chinaDate: new Date().toLocaleDateString('ru-RU'),
          estimatedArrival: 'Aniqlanmoqda',
          deliveryBranchSnapshot: getStoredProfile().defaultDeliveryBranch,
          createdAt: new Date().toISOString(),
        };
        saveStoredParcels([newParcel, ...current]);
      }
      return { success: true, message: 'Trek kodi muvaffaqiyatli qo\'shildi' };
    }
  },

  // 7. Active branches
  getBranches: async (provider?: string): Promise<DeliveryBranchSnapshot[]> => {
    try {
      const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
      const res = await request<DeliveryBranchSnapshot[]>(`/api/branches${query}`);
      if (Array.isArray(res) && res.length > 0) return res;
      let filtered = FALLBACK_BRANCHES;
      if (provider) filtered = filtered.filter(b => b.provider.toUpperCase() === provider.toUpperCase());
      return filtered;
    } catch {
      let filtered = FALLBACK_BRANCHES;
      if (provider) filtered = filtered.filter(b => b.provider.toUpperCase() === provider.toUpperCase());
      return filtered;
    }
  },

  // 8. Shipping rates
  getRates: async (): Promise<ShippingRates> => {
    try {
      const res = await request<ShippingRates>('/api/config/rates');
      if (res && res.pricePerKg) return res;
      return FALLBACK_RATES;
    } catch {
      return FALLBACK_RATES;
    }
  },
};
