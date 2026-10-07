import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, "database.json");
const PORT = 5000;
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const SUPABASE_URL = "https://dajlwaqoqcnwrrhyvmtw.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhamx3YXFvcWNud3JyaHl2bXR3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTIwOTk4NSwiZXhwIjoyMTA2Nzg1OTg1fQ.12KfEAK7aU17B2bidfcxeag8P0yLlKJq8QAhoq5mhAs";

let supabase = null;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
} catch (e) {
  console.warn("Could not init Supabase in sync-server:", e.message);
}

const defaultState = {
  users: [],
  courses: [],
  lessons: [],
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

// Push an event to all connected SSE clients
const sseClients = new Set();
function pushSseEvent(type, payload) {
  const data = JSON.stringify({ type, payload, timestamp: Date.now() });
  for (const client of sseClients) {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

async function broadcastEvent(type, payload) {
  saveDb();
  try {
    await syncToSupabase();
  } catch {}
  pushSseEvent(type, payload);
}

// 1. Sync Courses & Lessons to Supabase
async function syncToSupabase() {
  if (!supabase) return;
  try {
    // 1. Sync Courses
    const { data: remoteCourses } = await supabase.from("academy_courses").select("id");
    const currentCourseIds = db.courses.map((c) => String(c.id));

    if (remoteCourses) {
      for (const rc of remoteCourses) {
        if (!currentCourseIds.includes(String(rc.id))) {
          try {
            await supabase.from("academy_access").delete().eq("course_id", rc.id);
            await supabase.from("academy_lessons").delete().eq("course_id", rc.id);
            await supabase.from("academy_courses").delete().eq("id", rc.id);
          } catch {}
        }
      }
    }

    for (let i = 0; i < db.courses.length; i++) {
      const c = db.courses[i];
      await supabase.from("academy_courses").upsert({
        id: String(c.id),
        title: c.title,
        description: c.description || "",
        category: c.status || "Faol",
        icon: c.tone || "blue",
        order: i + 1,
        active: c.status === "Faol",
      });
    }

    // 2. Sync Lessons
    const { data: remoteLessons } = await supabase.from("academy_lessons").select("id");
    const currentLessonIds = db.lessons.map((l) => String(l.id));

    if (remoteLessons) {
      for (const rl of remoteLessons) {
        if (!currentLessonIds.includes(String(rl.id))) {
          try {
            await supabase.from("academy_user_progress").delete().eq("lesson_id", rl.id);
            await supabase.from("academy_lessons").delete().eq("id", rl.id);
          } catch {}
        }
      }
    }

    for (let i = 0; i < db.lessons.length; i++) {
      const l = db.lessons[i];
      const videoMeta = JSON.stringify({
        url: l.videoUrl || "",
        format: l.videoFormat || "auto",
        thumb: l.thumbnailUrl || "",
      });
      await supabase.from("academy_lessons").upsert({
        id: String(l.id),
        course_id: String(l.courseId),
        title: l.title,
        description: l.description || "",
        youtube_video_id: videoMeta,
        duration_seconds: l.durationSeconds || 600,
        order: i + 1,
      });
    }
  } catch (err) {
    console.warn("⚠️ Supabase sync error:", err.message);
  }
}

// 2. Real-time Sync Users from Supabase (Telegram bot registrations)
async function syncUsersFromSupabase() {
  if (!supabase) return;
  try {
    const { data: supaUsers, error: uErr } = await supabase
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (uErr) {
      console.warn("⚠️ Error fetching users from Supabase:", uErr.message);
      return;
    }

    if (!supaUsers) return;

    const { data: supaAccess } = await supabase.from("academy_access").select("*");
    const { data: supaProgress } = await supabase.from("academy_user_progress").select("*");

    const accessMap = {};
    if (supaAccess) {
      for (const a of supaAccess) {
        if (!accessMap[a.user_id]) accessMap[a.user_id] = {};
        accessMap[a.user_id][String(a.course_id)] = a.status === "granted" ? "Faol" : "To‘xtatilgan";
      }
    }

    const progressMap = {};
    if (supaProgress) {
      for (const p of supaProgress) {
        if (!progressMap[p.user_id]) progressMap[p.user_id] = {};
        progressMap[p.user_id][String(p.lesson_id)] = {
          completed: p.completed,
          maxWatched: p.max_watched_seconds || 0,
          current: p.last_position_seconds || 0,
        };
      }
    }

    const totalLessons = db.lessons.length;

    const formattedUsers = supaUsers.map((u) => {
      const initials = (u.name || "U")
        .trim()
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2) || "YG";

      const userAccess = accessMap[u.id] || {};
      const userProg = progressMap[u.id] || {};
      const completedCount = Object.values(userProg).filter((pr) => pr.completed).length;
      const percent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

      return {
        id: u.customer_code || u.id,
        supabaseId: u.id,
        telegramId: u.telegram_user_id,
        name: u.name || "Hurmatli talaba",
        initials,
        phone: u.phone || "",
        registeredAt: u.created_at ? new Date(u.created_at).toLocaleDateString("uz-UZ") : "Hozirgina",
        coursesAccess: userAccess,
        access: u.status === "blocked" ? "To‘xtatilgan" : "Faol",
        progress: percent,
        done: `${completedCount} / ${totalLessons}`,
        activity: "Faol",
      };
    });

    const prevJson = JSON.stringify(db.users);
    const nextJson = JSON.stringify(formattedUsers);

    if (prevJson !== nextJson) {
      db.users = formattedUsers;
      try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
      } catch {}
      pushSseEvent("UPDATE_USERS", db.users);
    }
  } catch (err) {
    console.warn("⚠️ syncUsersFromSupabase error:", err.message);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
    syncToSupabase().catch(() => {});
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// Initial bootstrap
loadDb();
syncUsersFromSupabase().catch(() => {});
syncToSupabase().catch(() => {});

// Background polling every 2.5 seconds to detect new Telegram bot registrations in real time
setInterval(() => {
  syncUsersFromSupabase().catch(() => {});
}, 2500);

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
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Expose-Headers": "*",
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.setHeader("Access-Control-Expose-Headers", "*");

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Expose-Headers": "*",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  // 0. Static Video & File Streaming (Supports HTTP 206 Partial Content Range Requests for Video Seeking)
  if (pathname.startsWith("/uploads/") && req.method === "GET") {
    const filename = path.basename(pathname);
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      res.writeHead(404, {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "text/plain",
      });
      return res.end("File not found");
    }
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === ".mp4"
        ? "video/mp4"
        : ext === ".webm"
        ? "video/webm"
        : ext === ".mov"
        ? "video/quicktime"
        : ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".png"
        ? "image/png"
        : "application/octet-stream";

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunksize,
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": stat.size,
        "Content-Type": contentType,
        "Accept-Ranges": "bytes",
        "Access-Control-Allow-Origin": "*",
      });
      fs.createReadStream(filePath).pipe(res);
    }
    return;
  }

  // 0.1 Video / Asset Upload Endpoint (Saves to local uploads/ and uploads to Supabase Storage)
  if (pathname === "/api/upload" && req.method === "POST") {
    try {
      const contentTypeHeader = req.headers["content-type"] || "";
      const rawName =
        req.headers["x-filename"] ||
        url.searchParams.get("name") ||
        `video_${Date.now()}.mp4`;
      const cleanBaseName = path
        .basename(decodeURIComponent(rawName))
        .replace(/[^a-zA-Z0-9_.-]/g, "_");
      const uniqueName = `${Date.now()}_${cleanBaseName}`;
      const localFilePath = path.join(UPLOADS_DIR, uniqueName);

      // Support multipart or direct binary stream
      if (contentTypeHeader.includes("multipart/form-data")) {
        const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
        const boundary = boundaryMatch ? boundaryMatch[1] || boundaryMatch[2] : null;

        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", async () => {
          try {
            const buffer = Buffer.concat(chunks);
            let fileData = buffer;

            if (boundary) {
              const boundaryBuf = Buffer.from(`--${boundary}`);
              const startIdx = buffer.indexOf(boundaryBuf);
              if (startIdx !== -1) {
                const headerEnd = buffer.indexOf(Buffer.from("\r\n\r\n"), startIdx);
                if (headerEnd !== -1) {
                  const dataStart = headerEnd + 4;
                  const nextBoundary = buffer.indexOf(boundaryBuf, dataStart);
                  const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : buffer.length;
                  fileData = buffer.slice(dataStart, dataEnd);
                }
              }
            }

            fs.writeFileSync(localFilePath, fileData);

            let supabasePublicUrl = null;
            if (supabase) {
              try {
                const ext = path.extname(uniqueName).toLowerCase();
                const mimeType =
                  ext === ".webm"
                    ? "video/webm"
                    : ext === ".mov"
                    ? "video/quicktime"
                    : ext === ".jpg" || ext === ".jpeg"
                    ? "image/jpeg"
                    : ext === ".png"
                    ? "image/png"
                    : "video/mp4";

                const { error: upErr } = await supabase.storage
                  .from("videos")
                  .upload(uniqueName, fileData, {
                    contentType: mimeType,
                    upsert: true,
                  });

                if (!upErr) {
                  const { data: pubData } = supabase.storage
                    .from("videos")
                    .getPublicUrl(uniqueName);
                  supabasePublicUrl = pubData?.publicUrl || null;
                } else {
                  console.warn("Supabase storage upload error:", upErr.message);
                }
              } catch (sErr) {
                console.warn("Supabase upload exception:", sErr.message);
              }
            }

            const localUrl = `http://${req.headers.host || "localhost:5000"}/uploads/${uniqueName}`;
            return sendJson(res, 200, {
              success: true,
              url: supabasePublicUrl || localUrl,
              localUrl,
              filename: uniqueName,
              size: fileData.length,
            });
          } catch (e) {
            console.error("Multipart process error:", e);
            return sendJson(res, 500, { success: false, error: e.message });
          }
        });
        return;
      }

      // Direct binary stream (Streamed directly to disk, supports 200-300MB+ with zero RAM overhead)
      console.log(`[UPLOAD] Receiving binary upload: ${uniqueName}`);
      req.setTimeout(0); // Disable request timeout for large files
      const fileStream = fs.createWriteStream(localFilePath);
      let totalBytes = 0;

      req.on("data", (chunk) => {
        totalBytes += chunk.length;
      });

      req.pipe(fileStream);

      fileStream.on("error", (err) => {
        console.error("[UPLOAD] File write error:", err);
        return sendJson(res, 500, { success: false, error: "Faylni diskka yozishda xatolik" });
      });

      fileStream.on("finish", async () => {
        const sizeMB = (totalBytes / (1024 * 1024)).toFixed(1);
        console.log(`[UPLOAD] Saved to disk: ${uniqueName} (${sizeMB} MB)`);
        
        let supabasePublicUrl = null;
        const MAX_SUPABASE_SIZE = 50 * 1024 * 1024; // Supabase free tier maximum is 50MB

        if (supabase && totalBytes <= MAX_SUPABASE_SIZE) {
          try {
            console.log(`[UPLOAD] Uploading to Supabase Storage: ${uniqueName}...`);
            const ext = path.extname(uniqueName).toLowerCase();
            const mimeType =
              ext === ".webm"
                ? "video/webm"
                : ext === ".mov"
                ? "video/quicktime"
                : "video/mp4";

            const fileBuffer = fs.readFileSync(localFilePath);
            const { error: upErr } = await supabase.storage
              .from("videos")
              .upload(uniqueName, fileBuffer, {
                contentType: mimeType,
                upsert: true,
              });

            if (!upErr) {
              const { data: pubData } = supabase.storage
                .from("videos")
                .getPublicUrl(uniqueName);
              supabasePublicUrl = pubData?.publicUrl || null;
              console.log(`[UPLOAD] Supabase Storage success: ${supabasePublicUrl}`);
            } else {
              console.warn("[UPLOAD] Supabase storage notice:", upErr.message);
            }
          } catch (sErr) {
            console.warn("[UPLOAD] Supabase upload exception:", sErr.message);
          }
        } else if (totalBytes > MAX_SUPABASE_SIZE) {
          console.log(`[UPLOAD] File size (${sizeMB} MB) exceeds Supabase free tier limit (50MB). Stored locally on high-speed HTTP 206 streaming engine.`);
        }

        const localUrl = `http://${req.headers.host || "localhost:5000"}/uploads/${uniqueName}`;
        console.log(`[UPLOAD] Video URL: ${supabasePublicUrl || localUrl}`);
        return sendJson(res, 200, {
          success: true,
          url: supabasePublicUrl || localUrl,
          localUrl,
          filename: uniqueName,
          size: totalBytes,
        });
      });
      req.on("error", (err) => {
        console.error("Upload error:", err);
        return sendJson(res, 500, { success: false, error: err.message });
      });
      return;
    } catch (err) {
      console.error("Upload route error:", err);
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

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

  // 2. Full State (admin or app fetch)
  if (pathname === "/api/state" && req.method === "GET") {
    await syncUsersFromSupabase();
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

  // 4. Get User By Token, tg_id, or ID (User App link entry)
  if (pathname === "/api/user" && req.method === "GET") {
    const token = url.searchParams.get("token");
    const userId = url.searchParams.get("u") || url.searchParams.get("id");
    const code = url.searchParams.get("code");
    const tgId = url.searchParams.get("tg_id");

    let user = db.users.find(
      (u) =>
        (tgId && (String(u.telegramId) === String(tgId) || String(u.telegram_user_id) === String(tgId))) ||
        (token && u.token === token) ||
        (userId && (u.id.toLowerCase() === userId.toLowerCase() || (u.supabaseId && u.supabaseId.toLowerCase() === userId.toLowerCase()))) ||
        (code && u.id.toLowerCase() === code.toLowerCase())
    );

    // If not found in local db, try Supabase if connected
    if (!user && supabase && tgId) {
      try {
        const { data: supaUser } = await supabase
          .from("users")
          .select("*")
          .eq("telegram_user_id", Number(tgId))
          .maybeSingle();

        if (supaUser && supaUser.onboarding_completed) {
          const initials = (supaUser.name || "U")
            .trim()
            .split(" ")
            .map((w) => w[0])
            .join("")
            .toUpperCase()
            .slice(0, 2) || "YG";

          // Fetch user's access
          const { data: dbAcc } = await supabase
            .from("academy_access")
            .select("course_id, status")
            .eq("user_id", supaUser.id);

          const coursesAccess = {};
          if (dbAcc) {
            for (const a of dbAcc) {
              coursesAccess[String(a.course_id)] = a.status === "granted" ? "Faol" : "To‘xtatilgan";
            }
          }

          user = {
            id: supaUser.customer_code || supaUser.id,
            supabaseId: supaUser.id,
            telegramId: supaUser.telegram_user_id,
            name: supaUser.name || "Talaba",
            initials,
            phone: supaUser.phone || "",
            access: supaUser.status === "blocked" ? "To‘xtatilgan" : "Faol",
            coursesAccess,
            progress: 0,
            done: `0 / ${db.lessons.length}`,
            activity: "Hozirgina",
          };
        }
      } catch (err) {
        console.warn("Supabase user fetch fallback error:", err.message);
      }
    }

    if (!user) {
      return sendJson(res, 404, { success: false, notRegistered: true, error: "Foydalanuvchi topilmadi" });
    }

    return sendJson(res, 200, { success: true, user });
  }

  // 5. Telegram Bot Register User (Fallback endpoint)
  if (pathname === "/api/bot/register" && req.method === "POST") {
    try {
      const { name, phone, telegramId } = await parseBody(req);
      if (!name || !phone) {
        return sendJson(res, 400, { success: false, error: "Ism va telefon raqam talab qilinadi" });
      }

      const cleanPhone = phone.replace(/[\s+]/g, "");
      let existing = db.users.find(
        (u) =>
          u.phone.replace(/[\s+]/g, "") === cleanPhone ||
          (telegramId && u.telegramId && String(u.telegramId) === String(telegramId))
      );

      if (existing) {
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

      const newUser = {
        id,
        telegramId: telegramId || null,
        token,
        name: name.trim(),
        initials,
        phone,
        registeredAt: new Date().toLocaleDateString("uz-UZ"),
        coursesAccess: {},
        access: "Faol",
        progress: 0,
        done: `0 / ${db.lessons.length}`,
        activity: "Hozirgina",
      };

      db.users.unshift(newUser);
      broadcastEvent("UPDATE_USERS", db.users);

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

  // 10. Per-course User Access Update (Synchronized with Supabase academy_access)
  if (pathname === "/api/users/access" && req.method === "POST") {
    try {
      const { userIds, courseId, access } = await parseBody(req);
      if (Array.isArray(userIds) && access) {
        const newSupaStatus = access === "Faol" ? "granted" : "revoked";

        for (const id of userIds) {
          const target = db.users.find(
            (u) =>
              u.id === id ||
              u.supabaseId === id ||
              (u.customer_code && u.customer_code === id) ||
              (u.telegramId && String(u.telegramId) === String(id))
          );
          const supaUserId = target?.supabaseId || id;

          // Update local memory
          if (target) {
            target.coursesAccess = target.coursesAccess || {};
            if (courseId) {
              target.coursesAccess[courseId] = access;
            } else {
              db.courses.forEach((c) => {
                target.coursesAccess[c.id] = access;
              });
            }
          }

          // Persist directly to Supabase academy_access
          if (supabase) {
            try {
              if (access === "Faol") {
                if (courseId) {
                  await supabase.from("academy_access").upsert(
                    {
                      user_id: supaUserId,
                      course_id: String(courseId),
                      status: "granted",
                      granted_at: new Date().toISOString(),
                    },
                    { onConflict: "user_id,course_id" }
                  );
                } else {
                  for (const c of db.courses) {
                    await supabase.from("academy_access").upsert(
                      {
                        user_id: supaUserId,
                        course_id: String(c.id),
                        status: "granted",
                        granted_at: new Date().toISOString(),
                      },
                      { onConflict: "user_id,course_id" }
                    );
                  }
                }
              } else {
                // Revoke access -> remove row from academy_access
                if (courseId) {
                  await supabase
                    .from("academy_access")
                    .delete()
                    .eq("user_id", supaUserId)
                    .eq("course_id", String(courseId));
                } else {
                  await supabase
                    .from("academy_access")
                    .delete()
                    .eq("user_id", supaUserId);
                }
              }
            } catch (err) {
              console.warn("Supabase access update error:", err.message);
            }
          }
        }

        try {
          fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf-8");
        } catch {}
        pushSseEvent("UPDATE_USERS", db.users);
        pushSseEvent("UPDATE_USER_ACCESS", { userIds, courseId, access });
        return sendJson(res, 200, { success: true, users: db.users });
      }
      return sendJson(res, 400, { error: "Invalid parameters" });
    } catch (err) {
      console.error("User access update error:", err);
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
        coursesAccess: coursesAccess || {},
        access: "Faol",
        progress: 0,
        done: `0 / ${db.lessons.length}`,
        activity: "Hozirgina qo‘shildi",
      };

      db.users.unshift(newUser);
      broadcastEvent("UPDATE_USERS", db.users);
      return sendJson(res, 201, { success: true, user: newUser });
    } catch {
      return sendJson(res, 400, { error: "Bad request" });
    }
  }

  // 12. Delete User (Synchronized with Supabase users, academy_access, academy_user_progress)
  if (pathname === "/api/users/delete" && req.method === "POST") {
    try {
      const { userId } = await parseBody(req);
      const target = db.users.find(
        (u) =>
          u.id === userId ||
          u.supabaseId === userId ||
          (u.customer_code && u.customer_code === userId) ||
          (u.telegramId && String(u.telegramId) === String(userId))
      );
      const supaUserId = target?.supabaseId || userId;

      if (supabase) {
        try {
          await supabase.from("academy_user_progress").delete().eq("user_id", supaUserId);
          await supabase.from("academy_access").delete().eq("user_id", supaUserId);
          await supabase.from("users").delete().eq("id", supaUserId);
        } catch (sErr) {
          console.warn("Error deleting user from Supabase:", sErr.message);
        }
      }

      db.users = db.users.filter(
        (u) => u.id !== userId && u.supabaseId !== userId && u.supabaseId !== supaUserId
      );
      delete db.progress[userId];
      delete db.progress[supaUserId];
      saveDb();
      pushSseEvent("UPDATE_USERS", db.users);
      return sendJson(res, 200, { success: true });
    } catch (err) {
      console.error("User delete error:", err);
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
            return { ...u, progress: 0, done: `0 / ${db.lessons.length}` };
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

server.timeout = 0; // Disable timeout for large 200-300MB video uploads
server.requestTimeout = 0; // Disable request timeout
server.keepAliveTimeout = 600000; // 10 minutes keep-alive
server.headersTimeout = 60000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Yukla Go Sync Server running at http://localhost:${PORT}`);
});
