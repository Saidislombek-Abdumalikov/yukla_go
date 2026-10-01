/**
 * ==============================================================================
 * DEV ONLY MOCK DATA
 * ==============================================================================
 * IMPORTANT: This file is strictly for UI development preview during Stage 1.5.
 * It will be replaced by real Supabase API calls in Stage 3.
 * DO NOT use this for production logic.
 */

import { UserProfile, Parcel, ChinaWarehouseAddress } from '../types';

export const DEV_MOCK_USER: UserProfile = {
  id: "usr_mock_100",
  telegramUserId: 123456789,
  customerCode: "YK-100",
  name: "Saidislom",
  phone: "+998 90 123 45 67",
  phoneVerified: true,
  ofertaAccepted: true,
  status: "active",
  defaultDeliveryBranch: {
    provider: "BTS",
    branchName: "BTS Chorsu",
    region: "Namangan",
    address: "Namangan sh., Chorsu dahasi, 12-uy"
  }
};

export const DEV_MOCK_WAREHOUSE: ChinaWarehouseAddress = {
  receiver: "Yukla Go (YK-100)",
  phone: "13335957161",
  region: "浙江省金华市义乌市",
  address: "077库房/70099号 YK-100",
  customerCode: "YK-100"
};

export const DEV_MOCK_PARCELS: Parcel[] = [
  {
    id: "p_1",
    trackingNumber: "YT882910291CN",
    customerCode: "YK-100",
    status: "in_transit",
    paymentStatus: "pending",
    weightKg: 3.5,
    amount: 33.25,
    currency: "USD",
    chinaDate: "28.09.2026",
    estimatedArrival: "05.10.2026",
    deliveryBranchSnapshot: {
      provider: "BTS",
      branchName: "BTS Chorsu",
      region: "Namangan",
      address: "Namangan sh., Chorsu dahasi, 12-uy"
    },
    cargoAddressSnapshot: {
      warehouseCode: "077库房/70099号",
      fullAddress: "浙江省金华市义乌市 077库房/70099号 YK-100"
    },
    createdAt: "2026-09-28T10:00:00Z"
  },
  {
    id: "p_2",
    trackingNumber: "SF1092837465CN",
    customerCode: "YK-100",
    status: "uzbekistan",
    paymentStatus: "paid",
    weightKg: 1.2,
    amount: 11.40,
    currency: "USD",
    chinaDate: "25.09.2026",
    estimatedArrival: "01.10.2026",
    deliveryBranchSnapshot: {
      provider: "BTS",
      branchName: "BTS Chorsu",
      region: "Namangan",
      address: "Namangan sh., Chorsu dahasi, 12-uy"
    },
    createdAt: "2026-09-25T14:30:00Z"
  },
  {
    id: "p_3",
    trackingNumber: "YT991028374CN",
    customerCode: "YK-100",
    status: "delivered",
    paymentStatus: "paid",
    weightKg: 5.0,
    amount: 47.50,
    currency: "USD",
    chinaDate: "15.09.2026",
    estimatedArrival: "22.09.2026",
    deliveryBranchSnapshot: {
      provider: "BTS",
      branchName: "BTS Chorsu",
      region: "Namangan",
      address: "Namangan sh., Chorsu dahasi, 12-uy"
    },
    createdAt: "2026-09-15T08:00:00Z"
  }
];
