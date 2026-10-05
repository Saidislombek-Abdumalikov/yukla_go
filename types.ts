export enum Tab {
  HOME = 'HOME',
  MY_PARCELS = 'MY_PARCELS',
  CALCULATOR = 'CALCULATOR',
  PROFILE = 'PROFILE',
}

export type ParcelStatus = 
  | 'added'            // Kiritildi
  | 'china_warehouse'  // Xitoy omborida
  | 'in_transit'        // Yo'lda
  | 'uzbekistan'       // O'zbekistonda
  | 'delivered';       // Yetkazildi

export type PaymentStatus = 'pending' | 'paid';

export interface DeliveryBranchSnapshot {
  provider: 'EMU' | 'BTS' | 'UZPOST' | string;
  branchName: string;
  region: string;
  address: string;
}

export interface Parcel {
  id: string;
  trackingNumber: string;
  customerCode: string; // e.g. YK-100
  status: ParcelStatus;
  paymentStatus: PaymentStatus;
  weightKg: number;
  amount: number;
  currency: string;
  chinaDate?: string;
  estimatedArrival?: string;
  deliveryBranchSnapshot?: DeliveryBranchSnapshot;
  cargoAddressSnapshot?: {
    warehouseCode: string;
    fullAddress: string;
  };
  cargoSubmittedAt?: string | null;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  telegramUserId: number;
  customerCode: string; // e.g. YK-100
  name: string;
  phone: string;
  phoneVerified: boolean;
  defaultDeliveryBranch?: DeliveryBranchSnapshot;
  ofertaAccepted: boolean;
  status: 'active' | 'blocked';
}

export interface ChinaWarehouseAddress {
  receiver: string;
  phone: string;
  region: string;
  address: string;
  customerCode: string;
}

export interface ShippingRates {
  pricePerKg: number;
  exchangeRate: number; // 1 USD = ? UZS
}

export interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  order: number;
  lessonsCount?: number;
  completedLessonsCount?: number;
}

export interface Lesson {
  id: string;
  courseId: string;
  order: number;
  title: string;
  description?: string;
  youtubeVideoId: string;
  durationSeconds: number;
  isLocked: boolean;
  isCompleted: boolean;
  maxWatchedSeconds: number;
  lastPositionSeconds: number;
}

export interface UserLessonProgress {
  userId: string;
  lessonId: string;
  maxWatchedSeconds: number;
  lastPositionSeconds: number;
  completed: boolean;
  updatedAt: string;
}

export interface StudentProgressSummary {
  userId: string;
  name: string;
  customerCode: string;
  completedCount: number;
  totalLessons: number;
  progressPercent: number;
  lessons?: {
    lessonId: string;
    title: string;
    order: number;
    completed: boolean;
    watchedPercent: number;
  }[];
}

export type CourseAccessStatus = 'granted' | 'pending' | 'none';

export interface CourseAccessItem {
  userId: string;
  customerCode: string;
  name: string;
  telegramUserId?: number;
  courseId: string;
  status: CourseAccessStatus;
  grantedAt?: string;
  requestedAt?: string;
}

export interface CourseLessonsResponse {
  hasAccess: boolean;
  accessStatus: CourseAccessStatus;
  lessons: Lesson[];
  message?: string;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        enableClosingConfirmation: () => void;
        initData?: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
          };
        };
      };
    };
  }
}
