import type {
  AdminSettings,
  CourseItem,
  CourseProgressMap,
  LessonItem,
  UserProfile,
} from "../types";

export const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
let sessionToken = "";
let saveQueue: Promise<unknown> = Promise.resolve();
async function api(path: string, options: RequestInit = {}) {
 const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}`, ...options.headers }, signal: AbortSignal.timeout(15000) });
 if (!res.ok) throw new Error(`Server: ${res.status}`);
 return res.json();
}
export const BROADCAST_CHANNEL_NAME = "yukla_go_channel";

export const STORAGE_KEYS = {
  AUTH_USER: "yukla_go_auth_user",
  COURSES: "yukla_go_courses",
  ACTIVE_COURSE_ID: "yukla_go_active_course_id",
  COURSE: "yukla_go_course",
  LESSONS: "yukla_go_lessons",
  SETTINGS: "yukla_go_settings",
  PROGRESS: "yukla_go_progress",
} as const;

export const defaultCourse: CourseItem | null = null;

export const defaultSettings: AdminSettings = {
  defaultCompletionPercent: 100,
  autoSaveProgress: true,
  sequentialLessons: true,
  dynamicWatermark: true,
  watermarkFormat: "id-brand",
};

export const defaultLessons: LessonItem[] = [];

function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`Error reading localStorage key "${key}":`, err);
    return fallback;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`Error writing localStorage key "${key}":`, err);
  }
}

let broadcastChannel: BroadcastChannel | null = null;
function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
  }
  return broadcastChannel;
}

export type AdminSyncMessage =
  | { type: "INIT"; payload: any }
  | { type: "UPDATE_LESSONS"; payload: LessonItem[] }
  | { type: "UPDATE_COURSE"; payload: CourseItem }
  | { type: "UPDATE_COURSES"; payload: CourseItem[] }
  | { type: "UPDATE_SETTINGS"; payload: AdminSettings }
  | { type: "UPDATE_USER_ACCESS"; payload: { userIds: string[]; courseId?: number; access: UserProfile["access"] } }
  | { type: "UPDATE_USERS"; payload: UserProfile[] }
  | { type: "RESET_USER_PROGRESS"; payload: { userId: string; lessonId?: number } }
  | { type: "USER_PROGRESS_UPDATED"; payload: { userId: string; lessonId: number; current: number; maxWatched: number; completed: boolean } };

export const store = {
  // --- Link-based Direct Authentication ---
  getAuthUser(): UserProfile | null {
    return safeGetItem<UserProfile | null>(STORAGE_KEYS.AUTH_USER, null);
  },

  setAuthUser(user: UserProfile | null): void {
    if (user) {
      safeSetItem(STORAGE_KEYS.AUTH_USER, user);
    } else {
      try {
        localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
      } catch {}
    }
  },

  async loadUserFromUrlOrStorage(): Promise<{ user: UserProfile | null; error?: "browser_not_allowed" | "not_registered" | "blocked" | "network" }> {
    if (typeof window === "undefined") return { user: null };

    const tg = (window as any).Telegram?.WebApp;
    if (!tg?.initData) return { user: null, error: "browser_not_allowed" };
    try {
      tg.ready(); tg.expand();
      const auth = await api("/auth/telegram", { method: "POST", body: JSON.stringify({ initData: tg.initData }) });
      sessionToken = auth.token;
      const data = await api("/user");
      this.setAuthUser(data.user);
      safeSetItem(STORAGE_KEYS.PROGRESS, { [data.user.id]: data.progress || {} });
      return { user: data.user };
    } catch { this.setAuthUser(null); return { user: null, error: "network" }; }
  },

  logout(): void {
    sessionToken = "";
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } catch (e) {
      console.warn("Error removing auth user:", e);
    }
  },

  // --- Data Accessors ---
  async syncStateFromServer(): Promise<{ courses: CourseItem[]; lessons: LessonItem[]; settings: AdminSettings } | null> {
    try {
      if (!sessionToken) return null;
      const data = await api("/state");
      if (data.user) {
        this.setAuthUser(data.user);
        safeSetItem(STORAGE_KEYS.PROGRESS, { [data.user.id]: data.progress || {} });
      }
      {
        if (Array.isArray(data.courses)) {
          this.setCourses(data.courses);
        }
        if (Array.isArray(data.lessons)) {
          const old = this.getLessons();
          data.lessons = data.lessons.map((lesson: LessonItem) => {
            const prev = old.find(p => String(p.id) === String(lesson.id));
            return prev?.videoUrl && lesson.videoUrl && prev.mediaKey === lesson.mediaKey && (prev.mediaExpiresAt || 0) > Date.now() + 600000
              ? { ...lesson, videoUrl: prev.videoUrl, mediaExpiresAt: prev.mediaExpiresAt } : lesson;
          });
          this.setLessons(data.lessons);
        }
        if (data.settings) {
          this.setSettings(data.settings);
        }
        return data;
      }
    } catch (err) {
      console.warn("Could not sync state from server:", err);
    }
    return null;
  },

  getCourses(): CourseItem[] {
    return safeGetItem<CourseItem[]>(STORAGE_KEYS.COURSES, []);
  },

  setCourses(courses: CourseItem[]) {
    safeSetItem(STORAGE_KEYS.COURSES, courses);
    this.broadcast({ type: "UPDATE_COURSES", payload: courses });
  },

  getActiveCourseId(): number {
    return safeGetItem<number>(STORAGE_KEYS.ACTIVE_COURSE_ID, 1);
  },

  setActiveCourseId(id: number): void {
    safeSetItem(STORAGE_KEYS.ACTIVE_COURSE_ID, id);
  },

  getCourse(): CourseItem | null {
    const list = this.getCourses();
    return list[0] || null;
  },

  setCourse(course: CourseItem) {
    safeSetItem(STORAGE_KEYS.COURSE, course);
    this.broadcast({ type: "UPDATE_COURSE", payload: course });
  },

  getLessons(): LessonItem[] {
    return safeGetItem<LessonItem[]>(STORAGE_KEYS.LESSONS, []);
  },

  setLessons(lessons: LessonItem[]) {
    safeSetItem(STORAGE_KEYS.LESSONS, lessons);
    this.broadcast({ type: "UPDATE_LESSONS", payload: lessons });
  },

  getSettings(): AdminSettings {
    return safeGetItem<AdminSettings>(STORAGE_KEYS.SETTINGS, defaultSettings);
  },

  setSettings(settings: AdminSettings) {
    safeSetItem(STORAGE_KEYS.SETTINGS, settings);
    this.broadcast({ type: "UPDATE_SETTINGS", payload: settings });
  },

  getAllProgress(): Record<string, CourseProgressMap> {
    return safeGetItem<Record<string, CourseProgressMap>>(STORAGE_KEYS.PROGRESS, {});
  },

  getUserProgress(userId: string): CourseProgressMap {
    const all = this.getAllProgress();
    return all[userId] || {};
  },

  saveLessonProgress(userId: string, lessonId: number, current: number, maxWatched: number, completed: boolean) {
    const task = saveQueue.catch(() => {}).then(async () => {
      const result = await api("/progress", { method: "POST", body: JSON.stringify({ lessonId, current, maxWatched }) });
      const all = this.getAllProgress();
      all[userId] = { ...(all[userId] || {}), [lessonId]: { ...result.progress, lastUpdated: Date.now() } };
      safeSetItem(STORAGE_KEYS.PROGRESS, all);
      const message: AdminSyncMessage = { type: "USER_PROGRESS_UPDATED", payload: { userId, lessonId, ...result.progress } };
      window.dispatchEvent(new CustomEvent("eucla-progress", { detail: message }));
      return result.progress;
    });
    saveQueue = task;
    return task;
  },

  resetUserProgress(userId: string) {
    const all = this.getAllProgress();
    delete all[userId];
    safeSetItem(STORAGE_KEYS.PROGRESS, all);
    this.broadcast({ type: "RESET_USER_PROGRESS", payload: { userId } });
  },

  // --- Real-time Sync (SSE + BroadcastChannel) ---
  broadcast(message: AdminSyncMessage) {
    try {
      const ch = getBroadcastChannel();
      ch?.postMessage(message);
    } catch {}
  },

  subscribe(callback: (message: AdminSyncMessage) => void): () => void {
    const handleBroadcast = (event: MessageEvent) => {
      if (event.data && typeof event.data === "object") {
        callback(event.data as AdminSyncMessage);
      }
    };

    const ch = getBroadcastChannel();
    ch?.addEventListener("message", handleBroadcast);

    const onProgress = (event: Event) => callback((event as CustomEvent).detail);
    window.addEventListener("eucla-progress", onProgress);
    return () => { ch?.removeEventListener("message", handleBroadcast); window.removeEventListener("eucla-progress", onProgress); };

  },
};
