/**
 * ==============================================================================
 * API SERVICE (PLACEHOLDER FOR STAGE 3)
 * ==============================================================================
 * This service provides the client interface for Yukla Go's backend API.
 * Real endpoints will be connected in Stage 3 using secure JWT sessions.
 */

import { Parcel, UserProfile, ShippingRates, ChinaWarehouseAddress } from '../types';
import { DEV_MOCK_USER, DEV_MOCK_WAREHOUSE, DEV_MOCK_PARCELS } from '../dev/mockData';
import { DEV_DEFAULT_RATES } from '../constants';

// Placeholder API client
export const api = {
  // User profile
  getProfile: async (): Promise<UserProfile> => {
    // In Stage 3: return fetch('/api/user/me').then(r => r.json());
    return DEV_MOCK_USER;
  },

  // China warehouse address with interpolated YK code
  getWarehouseAddress: async (): Promise<ChinaWarehouseAddress> => {
    // In Stage 3: return fetch('/api/config/warehouse').then(r => r.json());
    return DEV_MOCK_WAREHOUSE;
  },

  // User's parcels
  getParcels: async (): Promise<Parcel[]> => {
    // In Stage 3: return fetch('/api/parcels').then(r => r.json());
    return DEV_MOCK_PARCELS;
  },

  // Add new tracking number(s)
  addTracking: async (trackingNumber: string): Promise<{ success: boolean; message?: string }> => {
    // In Stage 3: POST /api/parcels
    console.log('[DEV API] Adding tracking:', trackingNumber);
    return { success: true };
  },

  // Shipping rates
  getRates: async (): Promise<ShippingRates> => {
    // In Stage 3: return fetch('/api/config/rates').then(r => r.json());
    return DEV_DEFAULT_RATES;
  }
};
