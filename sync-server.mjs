import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "database.json");
const PORT = 5000;

const defaultState = {
  users: [],
  courses: [
    {
      id: 1,
      title: "Xitoydan tovar olib kelish asoslari",
      description: "Import jarayonini boshidan oxirigacha o‘rganing. Oddiy, ishonchli va bosqichma-bosqich.",
      lessons: 8,
      users: 0,
      completion: 0,
      status: "Faol",
      updated: "Bugun, 10:24",
      tone: "blue",
    },
    {
      id: 2,
      title: "1688 platformasida ishlash",
      description: "Mahsulot topish, tekshirish va buyurtma berish amaliyoti",
      lessons: 2,
      users: 0,
      completion: 0,
      status: "Faol",
      updated: "Kecha, 18:40",
      tone: "navy",
    },
    {
      id: 3,
      title: "Yetkazib beruvchini tekshirish",
      description: "Ishonchli hamkorlarni aniqlash bo‘yicha amaliy kurs",
      lessons: 0,
      users: 0,
      completion: 0,
      status: "Qoralama",
      updated: "12 iyun, 14:12",
      tone: "sand",
    },
  ],
  lessons: [
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
      viewers: 0,
      completion: 0,
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
      viewers: 0,
      completion: 0,
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
      viewers: 0,
      completion: 0,
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
      viewers: 0,
      completion: 0,
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
      viewers: 0,
      completion: 0,
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
      viewers: 0,
      completion: 0,
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
      viewers: 0,
      completion: 0,
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
      viewers: 0,
      completion: 0,
    },
    {
      id: 9,
      courseId: 2,
      title: "1688 ilovasini o‘rnatish va ro‘yxatdan o‘tish",
      description: "1688 platformasiga ulanish va hisob yaratish qo‘llanmasi.",
      duration: "07:30",
      durationSeconds: 450,
      status: "Faol",
      thumbnailUrl: "https://images.unsplash.com/photo-1563719544898-deea3078afa1?auto=format&fit=crop&w=480&q=80",
      color: "lesson-navy",
      viewers: 0,
      completion: 0,
    },
    {
      id: 10,
      courseId: 2,
      title: "1688 da tovar qidirish usullari (Rasm va matn)",
      description: "Eng arzon va sifatli mahsulotlarni topish texnikasi.",
      duration: "11:15",
      durationSeconds: 675,
      status: "Faol",
      thumbnailUrl: "https://images.unsplash.com/photo-1575295126001-2b4a7190c57f?auto=format&fit=crop&w=480&q=80",
      color: "lesson-indigo",
      viewers: 0,
      completion: 0,
    },
  ],
  settings: {
    adminPassword: "admin",
    defaultCompletionPercent: 95,
    autoSaveProgress: true,
    sequentialLessons: true,
    dynamicWatermark: true,
    watermarkFormat: "id-brand",
  },
  progress: {},
};

let db = { ...defaultState };

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      db = {
        ...defaultState,
        ...parsed,
        settings: { ...defaultState.settings, ...(parsed.settings || {}) },
      };
    } else {
      saveDb();
    }
  } catch (err) {
    console.error("Error reading database:", err);
    db = { ...defaultState };
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

loadDb();

// Server-Sent Events subscribers
const sseClients = new Set();

function broadcastEvent(type, payload) {
  saveDb();
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // 1. SSE Real-time Events Stream
  if (pathname === "/api/events" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    res.write(`data: ${JSON.stringify({ type: "INIT", payload: db })}\n\n`);
    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
    return;
  }

  // 2. Full State
  if (pathname === "/api/state" && req.method === "GET") {
    return sendJson(res, 200, db);
  }

  // 3. Admin Login / Password Check
  if (pathname === "/api/auth/admin" && req.method === "POST") {
    try {
      const { password } = await parseBody(req);
      const expected = db.settings.adminPassword || "admin";
      if (password === expected) {
        return sendJson(res, 200, { success: true });
      }
      return sendJson(res, 401, { success: false, error: "Parol noto‘g‘ri kiritildi" });
    } catch {
      return sendJson(res, 400, { success: false, error: "Noto‘g‘ri so‘rov" });
    }
  }

  // 4. Get User By Token or ID (User App link entry)
  if (pathname === "/api/user" && req.method === "GET") {
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("u") || url.searchParams.get("id");
    const code = url.searchParams.get("code");

    const user = db.users.find(
      (u) =>
        (token && u.token === token) ||
        (userId && u.id.toLowerCase() === userId.toLowerCase()) ||
        (code && u.id.toLowerCase() === code.toLowerCase())
    );

    if (!user) {
      return sendJson(res, 404, { success: false, error: "Foydalanuvchi topilmadi" });
    }

    return sendJson(res, 200, { success: true, user });
  }

  // 5. Telegram Bot Register User
  if (pathname === "/api/bot/register" && req.method === "POST") {
    try {
      const { name, phone, telegramId } = await parseBody(req);
      if (!name || !phone) {
        return sendJson(res, 400, { success: false, error: "Ism va telefon raqam talab qilinadi" });
      }

      // Check if user with phone or telegramId already exists
      const cleanPhone = phone.replace(/[\s+]/g, "");
      let existing = db.users.find(
        (u) =>
          u.phone.replace(/[\s+]/g, "") === cleanPhone ||
          (telegramId && u.telegramId && String(u.telegramId) === String(telegramId))
      );

      if (existing) {
        // Return existing user with their link
        return sendJson(res, 200, {
          success: true,
          isNew: false,
          user: existing,
          token: existing.token,
        });
      }

      const id = `YK-${Math.floor(100 + Math.random() * 900)}`;
      const token = `yk_${crypto.randomBytes(8).toString("hex")}`;
      const initials = name
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "YG";

      // By default grant access to course 1
      const defaultCoursesAccess = {};
      if (db.courses.length > 0) {
        defaultCoursesAccess[db.courses[0].id] = "Faol";
      }

      const newUser = {
        id,
        telegramId: telegramId || null,
        token,
        name: name.trim(),
        initials,
        phone,
        registeredAt: new Date().toLocaleDateString("uz-UZ"),
        coursesAccess: defaultCoursesAccess, // e.g. { 1: "Faol" }
        access: "Faol",
        progress: 0,
        done: "0 / 8",
        activity: "Hozirgina",
      };

      db.users.unshift(newUser);

      // Update courses user count
      db.courses = db.courses.map((c) => {
        if (defaultCoursesAccess[c.id] === "Faol") {
          return { ...c, users: (c.users || 0) + 1 };
        }
        return c;
      });

      broadcastEvent("UPDATE_USERS", db.users);
      broadcastEvent("UPDATE_COURSES", db.courses);

      return sendJson(res, 201, {
        success: true,
        isNew: true,
        user: newUser,
        token: newUser.token,
      });
    } catch (e) {
      console.error("BOT REGISTER ERROR:", e);
      return sendJson(res, 400, { success: false, error: e.message || "Ro‘yxatdan o‘tishda xatolik" });
    }
  }

  // 6. Update Lessons (Reorder or save)
  if (pathname === "/api/lessons" && req.method === "POST") {
    try {
      const { lessons, courseId } = await parseBody(req);
      if (Array.isArray(lessons)) {
        if (courseId) {
          // Replace only lessons belonging to this course
          const otherLessons = db.lessons.filter((l) => l.courseId !== Number(courseId));
          db.lessons = [...otherLessons, ...lessons];
        } else {
          db.lessons = lessons;
        }
        broadcastEvent("UPDATE_LESSONS", db.lessons);
        return sendJson(res, 200, { success: true, lessons: db.lessons });
      }
      return sendJson(res, 400, { error: "Lessons must be an array" });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 7. Add Lesson to a specific Course
  if (pathname === "/api/lessons/add" && req.method === "POST") {
    try {
      const lessonData = await parseBody(req);
      const courseId = Number(lessonData.courseId) || (db.courses[0]?.id || 1);
      const newLesson = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        courseId,
        title: lessonData.title || "Yangi video dars",
        description: lessonData.description || "",
        duration: lessonData.duration || "10:00",
        durationSeconds: Number(lessonData.durationSeconds) || 600,
        videoUrl: lessonData.videoUrl || "",
        videoFormat: lessonData.videoFormat || "auto",
        status: lessonData.status || "Faol",
        thumbnailUrl: typeof lessonData.thumbnailUrl === "string" ? lessonData.thumbnailUrl.trim() : "",
        color: "lesson-blue",
        viewers: 0,
        completion: 0,
      };

      db.lessons.push(newLesson);

      // Update course's lesson count
      db.courses = db.courses.map((c) => {
        if (c.id === courseId) {
          const count = db.lessons.filter((l) => l.courseId === courseId).length;
          return { ...c, lessons: count };
        }
        return c;
      });

      broadcastEvent("UPDATE_LESSONS", db.lessons);
      broadcastEvent("UPDATE_COURSES", db.courses);
      return sendJson(res, 201, { success: true, lesson: newLesson });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 7.1 Update / Edit Lesson
  if (pathname === "/api/lessons/update" && req.method === "POST") {
    try {
      const { id, title, duration, durationSeconds, videoUrl, videoFormat, thumbnailUrl, description, status, courseId } =
        await parseBody(req);
      db.lessons = db.lessons.map((l) => {
        if (String(l.id) === String(id) || Number(l.id) === Number(id)) {
          return {
            ...l,
            title: title !== undefined ? title : l.title,
            duration: duration !== undefined ? duration : l.duration,
            durationSeconds: durationSeconds !== undefined ? Number(durationSeconds) : l.durationSeconds,
            videoUrl: videoUrl !== undefined ? videoUrl : (l.videoUrl || ""),
            videoFormat: videoFormat !== undefined ? videoFormat : (l.videoFormat || "auto"),
            thumbnailUrl: thumbnailUrl !== undefined ? thumbnailUrl.trim() : (l.thumbnailUrl || ""),
            description: description !== undefined ? description : l.description,
            status: status !== undefined ? status : l.status,
            courseId: courseId !== undefined ? Number(courseId) : l.courseId,
          };
        }
        return l;
      });
      broadcastEvent("UPDATE_LESSONS", db.lessons);
      return sendJson(res, 200, { success: true, lessons: db.lessons });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 8. Delete Lesson
  if (pathname === "/api/lessons/delete" && req.method === "POST") {
    try {
      const { lessonId } = await parseBody(req);
      const target = db.lessons.find((l) => l.id === Number(lessonId));
      if (target) {
        db.lessons = db.lessons.filter((l) => l.id !== Number(lessonId));
        db.courses = db.courses.map((c) => {
          if (c.id === target.courseId) {
            const count = db.lessons.filter((l) => l.courseId === target.courseId).length;
            return { ...c, lessons: count };
          }
          return c;
        });
        broadcastEvent("UPDATE_LESSONS", db.lessons);
        broadcastEvent("UPDATE_COURSES", db.courses);
        return sendJson(res, 200, { success: true });
      }
      return sendJson(res, 404, { error: "Lesson not found" });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 9. Courses: Add, Update & Delete
  if (pathname === "/api/courses/add" && req.method === "POST") {
    try {
      const courseData = await parseBody(req);
      const newCourse = {
        id: Date.now(),
        title: courseData.title || "Yangi video kurs",
        description: courseData.description || "",
        lessons: 0,
        users: 0,
        completion: 0,
        status: courseData.status || "Faol",
        updated: "Hozirgina",
        tone: "blue",
      };
      db.courses.unshift(newCourse);
      broadcastEvent("UPDATE_COURSES", db.courses);
      return sendJson(res, 201, { success: true, course: newCourse });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  if (pathname === "/api/courses/update" && req.method === "POST") {
    try {
      const { id, title, description, status } = await parseBody(req);
      db.courses = db.courses.map((c) => {
        if (c.id === Number(id)) {
          return {
            ...c,
            title: title !== undefined ? title : c.title,
            description: description !== undefined ? description : c.description,
            status: status !== undefined ? status : c.status,
            updated: "Hozirgina",
          };
        }
        return c;
      });
      broadcastEvent("UPDATE_COURSES", db.courses);
      return sendJson(res, 200, { success: true, courses: db.courses });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  if (pathname === "/api/courses/delete" && req.method === "POST") {
    try {
      const { courseId } = await parseBody(req);
      const targetId = Number(courseId);
      db.courses = db.courses.filter((c) => c.id !== targetId);
      db.lessons = db.lessons.filter((l) => l.courseId !== targetId);
      broadcastEvent("UPDATE_COURSES", db.courses);
      broadcastEvent("UPDATE_LESSONS", db.lessons);
      return sendJson(res, 200, { success: true });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  if (pathname === "/api/courses" && req.method === "POST") {
    try {
      const { courses } = await parseBody(req);
      if (Array.isArray(courses)) {
        db.courses = courses;
        broadcastEvent("UPDATE_COURSES", courses);
        return sendJson(res, 200, { success: true, courses });
      }
      return sendJson(res, 400, { error: "Courses must be an array" });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 10. Per-course User Access Update
  if (pathname === "/api/users/access" && req.method === "POST") {
    try {
      const { userIds, courseId, access } = await parseBody(req);
      if (Array.isArray(userIds) && access) {
        db.users = db.users.map((u) => {
          if (userIds.includes(u.id)) {
            const coursesAccess = { ...(u.coursesAccess || {}) };
            if (courseId) {
              coursesAccess[courseId] = access;
            } else {
              // Set for all courses
              db.courses.forEach((c) => {
                coursesAccess[c.id] = access;
              });
            }
            return {
              ...u,
              access: access,
              coursesAccess,
            };
          }
          return u;
        });

        broadcastEvent("UPDATE_USERS", db.users);
        broadcastEvent("UPDATE_USER_ACCESS", { userIds, courseId, access });
        return sendJson(res, 200, { success: true, users: db.users });
      }
      return sendJson(res, 400, { error: "Invalid parameters" });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 11. Add User Manually from Admin
  if (pathname === "/api/users/add" && req.method === "POST") {
    try {
      const { name, phone, coursesAccess } = await parseBody(req);
      if (!name) {
        return sendJson(res, 400, { error: "Ism kiritilmadi" });
      }
      const id = `YK-${Math.floor(100 + Math.random() * 900)}`;
      const token = `yk_${crypto.randomBytes(8).toString("hex")}`;
      const initials = name
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "YG";

      const newUser = {
        id,
        token,
        name: name.trim(),
        initials,
        phone: phone || "+998 90 000 00 00",
        registeredAt: new Date().toLocaleDateString("uz-UZ"),
        coursesAccess: coursesAccess || { 1: "Faol" },
        access: "Faol",
        progress: 0,
        done: "0 / 8",
        activity: "Hozirgina qo‘shildi",
      };

      db.users.unshift(newUser);
      broadcastEvent("UPDATE_USERS", db.users);
      return sendJson(res, 201, { success: true, user: newUser });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 12. Delete User
  if (pathname === "/api/users/delete" && req.method === "POST") {
    try {
      const { userId } = await parseBody(req);
      db.users = db.users.filter((u) => u.id !== userId);
      delete db.progress[userId];
      broadcastEvent("UPDATE_USERS", db.users);
      return sendJson(res, 200, { success: true });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 13. Reset User Progress
  if (pathname === "/api/users/progress/reset" && req.method === "POST") {
    try {
      const { userId, lessonId } = await parseBody(req);
      if (userId && db.progress[userId]) {
        if (lessonId !== undefined) {
          delete db.progress[userId][lessonId];
        } else {
          db.progress[userId] = {};
        }
        db.users = db.users.map((u) => {
          if (u.id === userId) {
            return { ...u, progress: 0, done: "0 / 8" };
          }
          return u;
        });
        broadcastEvent("UPDATE_USERS", db.users);
        broadcastEvent("RESET_USER_PROGRESS", { userId, lessonId });
      }
      return sendJson(res, 200, { success: true });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 14. Update Settings
  if (pathname === "/api/settings" && req.method === "POST") {
    try {
      const newSettings = await parseBody(req);
      db.settings = { ...db.settings, ...newSettings };
      broadcastEvent("UPDATE_SETTINGS", db.settings);
      return sendJson(res, 200, { success: true, settings: db.settings });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 15. Student Save Lesson Progress
  if (pathname === "/api/progress" && req.method === "POST") {
    try {
      const { userId, lessonId, current, maxWatched, completed } = await parseBody(req);
      if (!db.progress[userId]) {
        db.progress[userId] = {};
      }
      const prev = db.progress[userId][lessonId];
      db.progress[userId][lessonId] = {
        current,
        maxWatched: Math.max(prev?.maxWatched || 0, maxWatched, current),
        completed: completed || prev?.completed || false,
        lastUpdated: Date.now(),
      };

      const totalLessons = db.lessons.filter((l) => l.status === "Faol").length || 8;
      const completedLessons = Object.values(db.progress[userId]).filter((p) => p.completed).length;
      const pct = Math.round((completedLessons / totalLessons) * 100);

      db.users = db.users.map((u) => {
        if (u.id === userId) {
          return {
            ...u,
            progress: pct,
            done: `${completedLessons} / ${totalLessons}`,
            activity: "Hozirgina",
          };
        }
        return u;
      });

      broadcastEvent("USER_PROGRESS_UPDATED", {
        userId,
        lessonId,
        current,
        maxWatched: db.progress[userId][lessonId].maxWatched,
        completed: db.progress[userId][lessonId].completed,
      });
      broadcastEvent("UPDATE_USERS", db.users);

      return sendJson(res, 200, { success: true });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 404
  return sendJson(res, 404, { error: "Endpoint not found" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Yukla Go Sync Server running at http://localhost:${PORT}`);
});
