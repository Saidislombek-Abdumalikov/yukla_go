/**
 * ==============================================================================
 * YUKLA GO API CLIENT (STAGE 5)
 * ==============================================================================
 * Connects the frontend Mini App directly to secure Vercel Serverless endpoints.
 * Automatically injects the validated session token into all requests.
 */

import { Parcel, UserProfile, ShippingRates, ChinaWarehouseAddress, DeliveryBranchSnapshot } from '../types';

let sessionToken: string | null = null;

export const setSessionToken = (token: string | null) => {
  sessionToken = token;
};

export const getSessionToken = () => sessionToken;

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

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || 'Serverda xatolik yuz berdi');
  }

  return data as T;
}

export const api = {
  // 1. Authenticate with Telegram initData
  authWithTelegram: async (initData: string): Promise<{ token: string; user: any }> => {
    const res = await request<{ token: string; user: any }>('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({ initData }),
    });
    if (res.token) {
      setSessionToken(res.token);
    }
    return res;
  },

  // 2. User profile
  getProfile: async (): Promise<UserProfile> => {
    return request<UserProfile>('/api/user/me');
  },

  // 3. Submit location change request
  requestLocationChange: async (requestedBranchId: string): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>('/api/user/location-request', {
      method: 'POST',
      body: JSON.stringify({ requestedBranchId }),
    });
  },

  // 4. China warehouse address
  getWarehouseAddress: async (): Promise<ChinaWarehouseAddress> => {
    return request<ChinaWarehouseAddress>('/api/config/warehouse');
  },

  // 5. User parcels
  getParcels: async (): Promise<Parcel[]> => {
    return request<Parcel[]>('/api/parcels');
  },

  // 6. Add tracking code(s)
  addTracking: async (trackingNumber: string): Promise<{ success: boolean; message: string }> => {
    return request<{ success: boolean; message: string }>('/api/parcels', {
      method: 'POST',
      body: JSON.stringify({ trackingNumber }),
    });
  },

  // 7. Active branches
  getBranches: async (provider?: string): Promise<DeliveryBranchSnapshot[]> => {
    const query = provider ? `?provider=${encodeURIComponent(provider)}` : '';
    return request<DeliveryBranchSnapshot[]>(`/api/branches${query}`);
  },

  // 8. Shipping rates
  getRates: async (): Promise<ShippingRates> => {
    return request<ShippingRates>('/api/config/rates');
  },
};
