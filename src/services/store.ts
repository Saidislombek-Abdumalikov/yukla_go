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

export const defaultCourse: CourseItem = {
  id: 1,
  title: "Xitoydan tovar olib kelish asoslari",
  description: "Import jarayonini boshidan oxirigacha o‘rganing. Oddiy, ishonchli va bosqichma-bosqich.",
  lessons: 8,
  users: 0,
  completion: 0,
  status: "Faol",
  updated: "Bugun, 10:24",
  tone: "blue",
};

export const defaultSettings: AdminSettings = {
  defaultCompletionPercent: 95,
  autoSaveProgress: true,
  sequentialLessons: true,
  dynamicWatermark: true,
  watermarkFormat: "id-brand",
};

export const defaultLessons: LessonItem[] = [
  {
    id: 1,
    courseId: 1,
    title: "Xitoydan buyurtma berish qanday ishlaydi?",
    description: "Import asoslari, platformalar va dastlabki tayyorgarlik jarayoni.",
    duration: "08:00",
    durationSeconds: 480,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1575295126001-2b4a7190c57f?auto=format&fit=crop&w=480&q=80",
    color: "lesson-blue",
  },
  {
    id: 2,
    courseId: 1,
    title: "Mahsulotni to‘g‘ri tanlash",
    description: "Xarid qilishdan oldin mahsulot sifati va ma’lumotlarini to‘g‘ri baholashni o‘rganing.",
    duration: "12:10",
    durationSeconds: 730,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1563719544898-deea3078afa1?auto=format&fit=crop&w=480&q=80",
    color: "lesson-indigo",
  },
  {
    id: 3,
    courseId: 1,
    title: "Sotuvchini tekshirish",
    description: "Ishonchli sotuvchilarni tanlash, ularning reytingi va baholarini o‘rganish.",
    duration: "09:00",
    durationSeconds: 540,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1676093864425-ff2652ecf75e?auto=format&fit=crop&w=480&q=80",
    color: "lesson-cyan",
  },
  {
    id: 4,
    courseId: 1,
    title: "Narx va sifatni solishtirish",
    description: "Haqiqiy narxlarni bilish, chegirmalar va ommaviy xarid shartlari.",
    duration: "11:00",
    durationSeconds: 660,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1724709162875-fe100dd0e04b?auto=format&fit=crop&w=480&q=80",
    color: "lesson-slate",
  },
  {
    id: 5,
    courseId: 1,
    title: "Buyurtmani to‘g‘ri rasmiylashtirish",
    description: "Kargo manzili, qabul qiluvchi ma’lumotlari va buyurtma tasdiqlash.",
    duration: "10:00",
    durationSeconds: 600,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1575295126001-2b4a7190c57f?auto=format&fit=crop&w=480&q=80",
    color: "lesson-amber",
  },
  {
    id: 6,
    courseId: 1,
    title: "Sotuvchi bilan muloqot",
    description: "Xitoylik yetkazib beruvchilar bilan samarali suhbat qurish usullari.",
    duration: "07:00",
    durationSeconds: 420,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1563719544898-deea3078afa1?auto=format&fit=crop&w=480&q=80",
    color: "lesson-blue",
  },
  {
    id: 7,
    courseId: 1,
    title: "Xavfsiz xarid qilish",
    description: "To‘lov xavfsizligi, firibgarlikdan himoyalanish va kafolatlar.",
    duration: "08:00",
    durationSeconds: 480,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1676093864425-ff2652ecf75e?auto=format&fit=crop&w=480&q=80",
    color: "lesson-indigo",
  },
  {
    id: 8,
    courseId: 1,
    title: "Yakuniy tavsiyalar",
    description: "Tovarni kutib olish, bojxona va birinchi muvaffaqiyatli xarid xulosalari.",
    duration: "06:00",
    durationSeconds: 360,
    status: "Faol",
    thumbnailUrl: "https://images.unsplash.com/photo-1724709162875-fe100dd0e04b?auto=format&fit=crop&w=480&q=80",
    color: "lesson-cyan",
  },
];

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

  async loadUserFromUrlOrStorage(): Promise<UserProfile | null> {
    if (typeof window === "undefined") return null;

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const userId = urlParams.get("u") || urlParams.get("id");
    const code = urlParams.get("code");
    const name = urlParams.get("name");
    const phone = urlParams.get("phone");

    if (token || userId || code) {
      try {
        const query = token
          ? `token=${encodeURIComponent(token)}`
          : code
            ? `code=${encodeURIComponent(code)}`
            : `u=${encodeURIComponent(userId!)}`;
        const baseUrl = typeof window !== "undefined" && window.location.hostname !== "localhost" ? "" : API_BASE;
        const res = await fetch(`${baseUrl}/api/user?${query}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.user) {
            this.setAuthUser(data.user);
            return data.user;
          }
        }
      } catch (err) {
        console.warn("Could not fetch user from API, falling back to URL params:", err);
      }

      // Fallback: If URL has code or user identity from bot link, authenticate directly!
      const userCode = code || userId || "YK-100";
      const userName = name ? decodeURIComponent(name) : "Hurmatli talaba";
      const initials = userName
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "YG";

      const fallbackUser: UserProfile = {
        id: userCode,
        name: userName,
        phone: phone ? decodeURIComponent(phone) : "",
        access: "Faol",
        coursesAccess: { 1: "Faol", 2: "Faol" },
        initials,
      };
      this.setAuthUser(fallbackUser);
      return fallbackUser;
    }

    // Return stored user
    return this.getAuthUser();
  },

  logout(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    } catch (e) {
      console.warn("Error removing auth user:", e);
    }
  },

  // --- Data Accessors ---
  getCourses(): CourseItem[] {
    return safeGetItem<CourseItem[]>(STORAGE_KEYS.COURSES, [defaultCourse]);
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

  getCourse(): CourseItem {
    return safeGetItem<CourseItem>(STORAGE_KEYS.COURSE, defaultCourse);
  },

  setCourse(course: CourseItem) {
    safeSetItem(STORAGE_KEYS.COURSE, course);
    this.broadcast({ type: "UPDATE_COURSE", payload: course });
  },

  getLessons(): LessonItem[] {
    return safeGetItem<LessonItem[]>(STORAGE_KEYS.LESSONS, defaultLessons);
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
