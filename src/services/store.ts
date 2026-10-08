import type {
  AdminSettings,
  CourseItem,
  CourseProgressMap,
  LessonItem,
  UserProfile,
} from "../types";

export const API_BASE = "http://localhost:5000/api";
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
  defaultCompletionPercent: 95,
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

    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch {}
    }

    const tgUser = tg?.initDataUnsafe?.user;
    const tgUserId = tgUser?.id;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const userId = urlParams.get("u") || urlParams.get("id");
    const code = urlParams.get("code");

    // 1. If inside Telegram Mini App with detected Telegram User ID
    if (tgUserId) {
      try {
        const baseUrl = !isLocalhost ? "" : API_BASE;
        const res = await fetch(`${baseUrl}/api/user?tg_id=${encodeURIComponent(tgUserId)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            this.setAuthUser(data.user);
            return { user: data.user };
          }
        } else if (res.status === 404) {
          this.setAuthUser(null);
          return { user: null, error: "not_registered" };
        } else if (res.status === 403) {
          this.setAuthUser(null);
          return { user: null, error: "blocked" };
        }
      } catch (err) {
        console.warn("Could not verify Telegram user:", err);
      }
    }

    // 2. If token/code/u provided in URL (fallback / link entry)
    if (token || userId || code) {
      try {
        const query = token
          ? `token=${encodeURIComponent(token)}`
          : code
            ? `code=${encodeURIComponent(code)}`
            : `u=${encodeURIComponent(userId!)}`;
        const baseUrl = !isLocalhost ? "" : API_BASE;
        const res = await fetch(`${baseUrl}/api/user?${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            this.setAuthUser(data.user);
            return { user: data.user };
          }
        } else if (res.status === 404) {
          this.setAuthUser(null);
          return { user: null, error: "not_registered" };
        } else if (res.status === 403) {
          this.setAuthUser(null);
          return { user: null, error: "blocked" };
        }
      } catch (err) {
        console.warn("Could not fetch user from API:", err);
      }
    }

    // 3. Localhost Development Mode (for local development on PC)
    if (isLocalhost) {
      const stored = this.getAuthUser();
      return { user: stored };
    }

    // 4. In Production on Web Browser (Outside Telegram Mini App):
    // Strictly reject standalone browser entry! Clear any saved session!
    this.setAuthUser(null);
    return { user: null, error: "browser_not_allowed" };
  },

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } catch (e) {
      console.warn("Error removing auth user:", e);
    }
  },

  // --- Data Accessors ---
  async syncStateFromServer(): Promise<{ courses: CourseItem[]; lessons: LessonItem[]; settings: AdminSettings } | null> {
    try {
      const baseUrl = typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1" ? "" : API_BASE;
      const res = await fetch(`${baseUrl}/api/state`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.courses)) {
          this.setCourses(data.courses);
        }
        if (Array.isArray(data.lessons)) {
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

  saveLessonProgress(
    userId: string,
    lessonId: number,
    current: number,
    maxWatched: number,
    completed: boolean
  ) {
    const all = this.getAllProgress();
    const userProgress = all[userId] || {};
    const prev = userProgress[lessonId];

    userProgress[lessonId] = {
      current,
      maxWatched: Math.max(prev?.maxWatched || 0, maxWatched, current),
      completed: completed || prev?.completed || false,
      lastUpdated: Date.now(),
    };

    all[userId] = userProgress;
    safeSetItem(STORAGE_KEYS.PROGRESS, all);

    this.broadcast({
      type: "USER_PROGRESS_UPDATED",
      payload: {
        userId,
        lessonId,
        current,
        maxWatched: userProgress[lessonId].maxWatched,
        completed: userProgress[lessonId].completed,
      },
    });

    // Sync to API
    fetch(`${API_BASE}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        lessonId,
        current,
        maxWatched: userProgress[lessonId].maxWatched,
        completed: userProgress[lessonId].completed,
      }),
    }).catch(() => {});
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

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`${API_BASE}/events`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "INIT" && data.payload) {
            const state = data.payload;
            if (state.courses) this.setCourses(state.courses);
            if (state.lessons) this.setLessons(state.lessons);
            if (state.settings) this.setSettings(state.settings);
            if (state.progress) {
              safeSetItem(STORAGE_KEYS.PROGRESS, state.progress);
            }
          }
          callback(data as AdminSyncMessage);
        } catch {}
      };
    } catch {}

    return () => {
      ch?.removeEventListener("message", handleBroadcast);
      if (eventSource) {
        eventSource.close();
      }
    };
  },
};
