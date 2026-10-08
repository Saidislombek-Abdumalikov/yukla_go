export type UserAccessStatus = "Faol" | "To‘xtatilgan" | "Muddati tugagan";

export interface UserProfile {
  id: string; // e.g. "YK-104"
  token?: string;
  name: string;
  initials: string;
  phone: string;
  coursesAccess?: Record<string | number, UserAccessStatus>;
  course?: string;
  courseId?: number;
  access: UserAccessStatus;
  lesson?: string;
  activity?: string;
  done?: string;
  progress?: number;
}

export interface AdminSettings {
  defaultCompletionPercent: number; // e.g. 95%
  autoSaveProgress: boolean; // true
  sequentialLessons: boolean; // true: lessons unlock in sequential order
  dynamicWatermark: boolean; // true
  watermarkFormat: "id" | "id-brand" | "full";
}

export interface LessonItem {
  id: number;
  courseId?: number;
  title: string;
  description?: string;
  duration: string; // e.g. "12:10"
  durationSeconds: number; // in seconds
  status: "Faol" | "Tayyor" | "Qoralama" | "Yashirilgan";
  videoUrl?: string;
  videoFormat?: "auto" | "standard" | "shorts";
  thumbnailUrl?: string;
  color?: string;
  viewers?: number;
  completion?: number;
}

export interface CourseItem {
  id: number;
  title: string;
  description: string;
  lessons: number;
  users: number;
  completion: number;
  status: "Faol" | "Qoralama" | "Yashirilgan" | "Arxivlangan";
  updated: string;
  tone: string;
}

export interface UserLessonProgress {
  current: number; // in seconds
  maxWatched: number; // in seconds
  completed: boolean;
  lastUpdated: number; // timestamp
}

export type CourseProgressMap = Record<number, UserLessonProgress>; // lessonId -> progress

export type Screen = "lessons" | "player" | "progress";

export type IconName =
  | "arrow-left"
  | "check"
  | "chevron"
  | "clock"
  | "expand"
  | "maximize"
  | "minimize"
  | "rewind-10"
  | "forward-10"
  | "lock"
  | "pause"
  | "play"
  | "retry"
  | "shield"
  | "volume"
  | "alert-triangle"
  | "refresh"
  | "logout"
  | "user"
  | "close"
  | "settings";
