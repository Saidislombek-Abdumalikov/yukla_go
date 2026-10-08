import { createClient } from "@supabase/supabase-js"
import { createHash } from "node:crypto"
import {
  check,
  equal,
  admins,
  escapeHtml,
  signSession,
  readSession,
  telegramIdentity,
  ensureStudent,
} from "../server/security.mjs"
import { botUpdate, homeKeyboard } from "../server/bot.mjs"
let db
const DEFAULT_SETTINGS = {
  defaultCompletionPercent: 100,
  autoSaveProgress: true,
  sequentialLessons: true,
  dynamicWatermark: true,
  watermarkFormat: "id-brand",
}
const getBotToken = () =>
  process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || ""
function getSupabase() {
  if (!db) {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
      throw new Error("Missing database environment")
    db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
  }
  return db
}
async function getSettings(db) {
  const row = check(
    await db
      .from("app_settings")
      .select("value")
      .eq("key", "eucla_lms")
      .maybeSingle(),
  )
  const value = row?.value || {}
  return {
    ...DEFAULT_SETTINGS,
    dynamicWatermark: value.dynamicWatermark !== false,
    watermarkFormat: ["id", "id-brand", "full"].includes(value.watermarkFormat)
      ? value.watermarkFormat
      : "id-brand",
  }
}
async function callTelegram(method, params) {
  const r = await fetch(
    `https://api.telegram.org/bot${getBotToken()}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(
        method === "answerCallbackQuery" ? 2500 : 15000,
      ),
    },
  )
  const data = await r.json()
  if (!data.ok) throw new Error(`Telegram ${method} failed`)
  return data
}
async function sendTelegramMessage(chatId, text, reply_markup) {
  try {
    return await callTelegram("sendMessage", {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      reply_markup,
    })
  } catch {
    console.error("Telegram notification failed; saved data preserved")
  }
}
async function getCachedCourses(db) {
  return (
    check(await db.from("academy_courses").select("*").order("order")) || []
  )
}
function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(str || ""),
  )
}

async function findUserByAnyId(supabase, uid) {
  if (!uid) return null
  const str = String(uid).trim()
  if (isUUID(str)) {
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("id", str)
      .maybeSingle()
    if (data) return data
  }
  const { data: byCode } = await supabase
    .from("users")
    .select("*")
    .eq("customer_code", str)
    .maybeSingle()
  if (byCode) return byCode
  const num = Number(str)
  if (!isNaN(num) && num > 0) {
    const { data: byTg } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_user_id", num)
      .maybeSingle()
    if (byTg) return byTg
  }
  return null
}

export function sendSafeJson(res, status, data) {
  res.setHeader?.("Content-Type", "application/json")
  res.setHeader?.("Cache-Control", "no-store")
  if (res.status && res.json) return res.status(status).json(data)
  res.statusCode = status
  return res.end(JSON.stringify(data))
}
export default async function handler(req, res) {
  const origin = req.headers?.origin
  const allowed = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin)
    res.setHeader("Vary", "Origin")
  }
  res.setHeader?.("Access-Control-Allow-Headers", "Content-Type, Authorization")
  res.setHeader?.("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  if (req.method === "OPTIONS") {
    res.statusCode = 204
    return res.end()
  }
  const url = new URL(req.url || "/api", "http://localhost")
  const route = req.query?.__path || url.searchParams.get("__path")
  const normalizedPath = route
    ? "/api/" + String(route).replace(/^\//, "")
    : url.pathname.replace(/\/$/, "")
  const parseBody = async () => {
    if (typeof req.body === "object" && req.body) return req.body
    if (typeof req.body === "string") return JSON.parse(req.body)
    let b = ""
    for await (const c of req) {
      b += c
      if (b.length > 1_000_000) throw new Error("Body too large")
    }
    return b ? JSON.parse(b) : {}
  }
  try {
    const supabase = getSupabase()
    if (normalizedPath === "/api/bot/webhook") {
      if (req.method !== "POST")
        return sendSafeJson(res, 405, { error: "POST required" })
      if (
        !process.env.TELEGRAM_WEBHOOK_SECRET ||
        !equal(
          req.headers["x-telegram-bot-api-secret-token"],
          process.env.TELEGRAM_WEBHOOK_SECRET,
        )
      )
        return sendSafeJson(res, 401, { error: "Unauthorized" })
      const update = await parseBody()
      if (!Number.isSafeInteger(update.update_id))
        return sendSafeJson(res, 400, { error: "Invalid update" })
      const claimed = check(
        await supabase.rpc("eucla_claim_update", { p_id: update.update_id }),
      )
      if (!claimed) {
        const previous = check(
          await supabase
            .from("bot_updates")
            .select("status")
            .eq("update_id", update.update_id)
            .maybeSingle(),
        )
        return sendSafeJson(res, previous?.status === "done" ? 200 : 503, {
          ok: previous?.status === "done",
        })
      }
      try {
        await botUpdate(update, supabase, callTelegram)
        check(
          await supabase
            .from("bot_updates")
            .update({ status: "done", touched_at: new Date().toISOString() })
            .eq("update_id", update.update_id),
        )
      } catch (err) {
        await supabase
          .from("bot_updates")
          .update({ status: "failed" })
          .eq("update_id", update.update_id)
        throw err
      }
      return sendSafeJson(res, 200, { ok: true })
    }
    if (normalizedPath === "/api/auth/admin" && req.method === "POST") {
      const ip = String(
        req.headers["x-forwarded-for"] ||
          req.socket?.remoteAddress ||
          "unknown",
      ).split(",")[0]
      const key = createHash("sha256").update(ip).digest("hex")
      if (!check(await supabase.rpc("eucla_login_attempt", { p_key: key })))
        return sendSafeJson(res, 429, {
          error: "15 daqiqadan keyin qayta urinib ko‘ring.",
        })
      const { password } = await parseBody()
      if (
        !process.env.ADMIN_PASSWORD ||
        !equal(password, process.env.ADMIN_PASSWORD)
      )
        return sendSafeJson(res, 401, { error: "Parol noto‘g‘ri" })
      return sendSafeJson(res, 200, {
        success: true,
        token: signSession({ role: "admin" }),
      })
    }
    if (normalizedPath === "/api/auth/telegram" && req.method === "POST") {
      return sendSafeJson(res, 403, {
        error:
          "Foydalanuvchi ilovasi vaqtincha yopiq. Telegram botdan foydalaning.",
      })
      const { initData } = await parseBody()
      const from = telegramIdentity(initData, getBotToken())
      if (!from)
        return sendSafeJson(res, 401, { error: "Telegram orqali oching" })
      const u = await ensureStudent(supabase, from)
      if (u.status === "blocked")
        return sendSafeJson(res, 403, { error: "Hisob to‘xtatilgan" })
      return sendSafeJson(res, 200, {
        success: true,
        token: signSession({ role: "student", uid: u.id, tg: from.id }),
      })
    }
    const auth = readSession(
      String(req.headers?.authorization || "").replace(/^Bearer /, ""),
    )
    if (!auth) return sendSafeJson(res, 401, { error: "Qayta kiring" })
    const admin = auth.role === "admin"
    if (!admin)
      return sendSafeJson(res, 403, {
        error:
          "Foydalanuvchi ilovasi vaqtincha yopiq. Telegram botdan foydalaning.",
      })
    const user = admin
      ? null
      : check(
          await supabase.from("users").select("*").eq("id", auth.uid).single(),
        )
    if (!admin && (!user || user.status !== "active"))
      return sendSafeJson(res, 403, { error: "Hisob to‘xtatilgan" })
    if (normalizedPath === "/api/progress" && req.method === "POST") {
      if (admin)
        return sendSafeJson(res, 403, { error: "Student session required" })
      const body = await parseBody()
      const current = Number(body.current),
        max = Number(body.maxWatched)
      if (
        !body.lessonId ||
        ![current, max].every(
          (n) => Number.isFinite(n) && n >= 0 && n <= 2147483647,
        )
      )
        return sendSafeJson(res, 400, { error: "Invalid progress" })
      const result = await supabase.rpc("eucla_progress", {
        p_user: user.id,
        p_lesson: String(body.lessonId),
        p_position: Math.floor(current),
        p_max: Math.floor(max),
      })
      if (result.error)
        return sendSafeJson(res, 403, {
          error:
            "Progress saqlanmadi. Kurs ruxsati va oldingi darsni tekshiring.",
        })
      return sendSafeJson(res, 200, { success: true, progress: result.data })
    }
    if (normalizedPath === "/api/user" && req.method === "GET") {
      if (admin)
        return sendSafeJson(res, 400, { error: "Student session required" })
      const access =
        check(
          await supabase
            .from("academy_access")
            .select("course_id,status")
            .eq("user_id", user.id),
        ) || []
      const progress =
        check(
          await supabase
            .from("academy_user_progress")
            .select("*")
            .eq("user_id", user.id),
        ) || []
      return sendSafeJson(res, 200, {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          initials: user.name.slice(0, 2).toUpperCase(),
          phone: user.phone,
          access: "Faol",
          coursesAccess: Object.fromEntries(
            access.map((a) => [
              a.course_id,
              a.status === "granted" ? "Faol" : "To‘xtatilgan",
            ]),
          ),
        },
        progress: Object.fromEntries(
          progress.map((p) => [
            p.lesson_id,
            {
              current: p.last_position_seconds,
              maxWatched: p.max_watched_seconds,
              completed: p.completed,
            },
          ]),
        ),
      })
    }
    if (normalizedPath === "/api/state" && req.method === "GET") {
      const courses = await getCachedCourses(supabase),
        lessons =
          check(
            await supabase
              .from("academy_lessons")
              .select("*")
              .order("order")
              .order("id"),
          ) || []
      let grants = [],
        progress = [],
        users = []
      if (admin) {
        ;[grants, progress, users] = await Promise.all([
          supabase.from("academy_access").select("*"),
          supabase.from("academy_user_progress").select("*"),
          supabase
            .from("users")
            .select("*")
            .order("created_at", { ascending: false }),
        ]).then((rs) => rs.map(check))
      } else {
        ;[grants, progress] = await Promise.all([
          supabase.from("academy_access").select("*").eq("user_id", user.id),
          supabase
            .from("academy_user_progress")
            .select("*")
            .eq("user_id", user.id),
        ]).then((rs) => rs.map(check))
      }
      const courseList = admin ? courses : courses.filter((c) => c.active)
      const visible = lessons.filter((l) =>
        courseList.some((c) => c.id === l.course_id),
      )
      const done = new Set(
        progress.filter((p) => p.completed).map((p) => p.lesson_id),
      )
      const lessonList = await Promise.all(
        visible.map(async (l) => {
          const granted =
            admin ||
            grants.some(
              (a) => a.course_id === l.course_id && a.status === "granted",
            )
          const unlocked =
            admin ||
            visible
              .filter((p) => p.course_id === l.course_id)
              .slice(
                0,
                visible
                  .filter((p) => p.course_id === l.course_id)
                  .findIndex((p) => p.id === l.id),
              )
              .every((p) => done.has(p.id))
          let source = { url: l.youtube_video_id }
          try {
            if (l.youtube_video_id?.startsWith("{"))
              source = JSON.parse(l.youtube_video_id)
          } catch {}
          let playable = source.url || ""
          return {
            telegramVideoReady: !!l.telegram_file_id,
            id: l.id,
            courseId: l.course_id,
            title: l.title,
            description: l.description || "",
            durationSeconds: l.duration_seconds,
            duration: `${Math.floor(l.duration_seconds / 60)}:${String(l.duration_seconds % 60).padStart(2, "0")}`,
            videoUrl:
              granted && unlocked ? (admin ? source.url : playable) : "",
            previewUrl: granted && unlocked ? playable : "",
            mediaKey: source.url || "",
            mediaExpiresAt: Date.now() + 4 * 3600 * 1000,
            videoFormat: source.format || "standard",
            thumbnailUrl: source.thumb || "",
            status: "Faol",
            color: "lesson-blue",
          }
        }),
      )
      const rows = users.map((u) => {
        const own = grants.filter((a) => a.user_id === u.id),
          complete = progress.filter(
            (p) => p.user_id === u.id && p.completed,
          ).length
        return {
          id: u.id,
          supabaseId: u.id,
          telegramId: u.telegram_user_id,
          name: u.name,
          phone: u.phone,
          initials: u.name.slice(0, 2),
          access: own.some((a) => a.status === "granted")
            ? "Faol"
            : "Kutilmoqda",
          coursesAccess: Object.fromEntries(
            own.map((a) => [
              a.course_id,
              a.status === "granted" ? "Faol" : "To‘xtatilgan",
            ]),
          ),
          progress: lessons.length
            ? Math.round((complete / lessons.length) * 100)
            : 0,
          done: `${complete} / ${lessons.length}`,
          activity: "Faol",
        }
      })
      return sendSafeJson(res, 200, {
        courses: courseList.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description || "",
          status: c.active ? "Faol" : "Qoralama",
          lessons: visible.filter((l) => l.course_id === c.id).length,
          tone: c.icon || "blue",
        })),
        lessons: lessonList,
        ...(admin
          ? { users: rows }
          : {
              user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                initials: user.name.slice(0, 2),
                access: "Faol",
                coursesAccess: Object.fromEntries(
                  grants.map((a) => [
                    a.course_id,
                    a.status === "granted" ? "Faol" : "To‘xtatilgan",
                  ]),
                ),
              },
              progress: Object.fromEntries(
                progress.map((p) => [
                  p.lesson_id,
                  {
                    current: p.last_position_seconds,
                    maxWatched: p.max_watched_seconds,
                    completed: p.completed,
                  },
                ]),
              ),
            }),
        settings: await getSettings(supabase),
      })
    }
    if (!admin)
      return sendSafeJson(res, 403, { error: "Admin ruxsati talab qilinadi" })
    if (normalizedPath === "/api/upload/sign" && req.method === "POST") {
      return sendSafeJson(res, 410, {
        error:
          "Videoni Telegram botga video sifatida yuboring, keyin darsga biriktiring.",
      })
    }
    if (normalizedPath === "/api/settings") {
      if (req.method === "POST") {
        const body = await parseBody()
        const value = {
          dynamicWatermark: body.dynamicWatermark !== false,
          watermarkFormat: ["id", "id-brand", "full"].includes(
            body.watermarkFormat,
          )
            ? body.watermarkFormat
            : "id-brand",
        }
        check(
          await supabase
            .from("app_settings")
            .upsert({
              key: "eucla_lms",
              value,
              updated_at: new Date().toISOString(),
            }),
        )
        return sendSafeJson(res, 200, {
          success: true,
          settings: await getSettings(supabase),
        })
      }
      return sendSafeJson(res, 200, { settings: await getSettings(supabase) })
    }
    if (normalizedPath === "/api/users/add")
      return sendSafeJson(res, 400, {
        error:
          "Talaba botda /start bosishi kerak. So‘ng ro‘yxatdan tanlab kursga ruxsat bering.",
      })
    if (normalizedPath === "/api/lessons" && req.method === "POST") {
      const { lessons } = await parseBody()
      if (!Array.isArray(lessons))
        return sendSafeJson(res, 400, { error: "Invalid lessons" })
      for (let i = 0; i < lessons.length; i++)
        check(
          await supabase
            .from("academy_lessons")
            .update({ order: i + 1 })
            .eq("id", String(lessons[i].id)),
        )
      return sendSafeJson(res, 200, { success: true })
    }
    if (normalizedPath === "/api/users/access" && req.method === "POST") {
      const body = await parseBody()
      const { userIds, courseId, access } = body

      if (
        !Array.isArray(userIds) ||
        !courseId ||
        !["Faol", "To‘xtatilgan"].includes(access)
      ) {
        return sendSafeJson(res, 400, { error: "Parametrlar noto‘g‘ri" })
      }

      const processedUsers = new Set()
      for (const uid of userIds) {
        const user = await findUserByAnyId(supabase, uid)

        if (user && !processedUsers.has(user.id)) {
          processedUsers.add(user.id)
          if (access === "Faol") {
            // Grant course access
            if (courseId) {
              check(await supabase.from("academy_access").upsert(
                  {
                    user_id: user.id,
                    course_id: String(courseId),
                    status: "granted",
                    granted_at: new Date().toISOString(),
                  },
                  { onConflict: "user_id,course_id" },
                ))
            } else {
              const { data: allCourses } = await supabase
                .from("academy_courses")
                .select("id")
              if (allCourses && allCourses.length > 0) {
                for (const c of allCourses) {
                  check(await supabase.from("academy_access").upsert(
                      {
                        user_id: user.id,
                        course_id: String(c.id),
                        status: "granted",
                        granted_at: new Date().toISOString(),
                      },
                      { onConflict: "user_id,course_id" },
                    ))
                }
              }
            }
            // Set user status to active

            // INSTANT TELEGRAM NOTIFICATION TO STUDENT WITH PHYSICAL REPLY KEYBOARD
            if (user.telegram_user_id) {
              let courseTitle = "Video darslar"
              if (courseId) {
                const courses = await getCachedCourses(supabase)
                const courseRow = (courses || []).find(
                  (c) => String(c.id) === String(courseId),
                )
                if (courseRow?.title) courseTitle = courseRow.title
              }

              const mainKb = await Promise.resolve(homeKeyboard)
              await sendTelegramMessage(
                user.telegram_user_id,
                `💎 <b>Tabriklaymiz!</b> ✨\n\n` +
                  `Sizga <b>«${escapeHtml(courseTitle)}»</b> uchun Premium ruxsat berildi! 🚀\n\n` +
                  `Darslarni boshlashingiz mumkin 👇`,
                {
                  keyboard: mainKb,
                  resize_keyboard: true,
                },
              )
            }
          } else {
            // Revoke access
            if (courseId) {
              check(
                await supabase
                  .from("academy_access")
                  .delete()
                  .eq("user_id", user.id)
                  .eq("course_id", String(courseId)),
              )
            } else {
              await supabase
                .from("academy_access")
                .delete()
                .eq("user_id", user.id)
            }
          }
        }
      }

      return sendSafeJson(res, 200, { success: true })
    }

    // 5. ADMIN USER DELETE ENDPOINT (/api/users/delete)
    if (normalizedPath === "/api/users/delete" && req.method === "POST") {
      const body = await parseBody()
      const uid = body.userId || body.id
      if (uid) {
        const user = await findUserByAnyId(supabase, uid)
        if (user) {
          check(
            await supabase
              .from("academy_access")
              .delete()
              .eq("user_id", user.id),
          )
          check(
            await supabase
              .from("academy_user_progress")
              .delete()
              .eq("user_id", user.id),
          )
          check(
            await supabase
              .from("cargo_applications")
              .delete()
              .eq("telegram_user_id", user.telegram_user_id),
          )
          check(await supabase.from("users").delete().eq("id", user.id))
        } else if (isUUID(uid)) {
          check(await supabase.from("users").delete().eq("id", uid))
        } else {
          check(await supabase.from("users").delete().eq("customer_code", uid))
        }
      }
      return sendSafeJson(res, 200, { success: true })
    }

    // 6. ADMIN COURSES CRUD
    if (normalizedPath === "/api/courses/add" && req.method === "POST") {
      const { title, description } = await parseBody()
      const id = String(Date.now())
      const newCourse = {
        id,
        title: title || "Yangi kurs",
        description: description || "",
        active: true,
        order: 1,
      }
      check(await supabase.from("academy_courses").insert(newCourse))

      return sendSafeJson(res, 200, {
        success: true,
        courseId: id,
        course: {
          id,
          title: newCourse.title,
          description: newCourse.description,
          lessons: 0,
          users: 0,
          completion: 0,
          status: "Faol",
          updated: "Bugun",
          tone: "blue",
        },
      })
    }

    if (normalizedPath === "/api/courses/update" && req.method === "POST") {
      const body = await parseBody()
      const courseId = body.id || body.courseId
      if (courseId) {
        check(
          await supabase
            .from("academy_courses")
            .update({
              title: body.title,
              description: body.description,
              active: body.status === "Faol",
              updated_at: new Date().toISOString(),
            })
            .eq("id", String(courseId)),
        )
      }
      return sendSafeJson(res, 200, { success: true })
    }

    if (normalizedPath === "/api/courses/delete" && req.method === "POST") {
      const body = await parseBody()
      const courseId = body.id || body.courseId
      if (courseId) {
        check(
          await supabase
            .from("academy_courses")
            .delete()
            .eq("id", String(courseId)),
        )
        check(
          await supabase
            .from("academy_lessons")
            .delete()
            .eq("course_id", String(courseId)),
        )
      }
      return sendSafeJson(res, 200, { success: true })
    }

    // 7. ADMIN LESSONS CRUD
    if (normalizedPath === "/api/lessons/add" && req.method === "POST") {
      const body = await parseBody()
      const id = String(body.id || body.lessonId || Date.now())
      const { data: countData } = await supabase
        .from("academy_lessons")
        .select("id")
        .eq("course_id", String(body.courseId))
      const nextOrder = (countData?.length || 0) + 1

      let videoIdToSave = body.videoUrl || ""
      if (body.videoUrl && (body.videoFormat || body.thumbnailUrl)) {
        videoIdToSave = JSON.stringify({
          url: body.videoUrl,
          format: body.videoFormat || "shorts",
          thumb: body.thumbnailUrl || "",
        })
      }

      const lessonRecord = {
        id,
        course_id: String(body.courseId),
        title: body.title || "Yangi dars",
        description: body.description || "",
        youtube_video_id: videoIdToSave,
        duration_seconds: Number(body.durationSeconds) || 600,
        order: body.order ? Number(body.order) : nextOrder,
      }

      const { data, error } = await supabase
        .from("academy_lessons")
        .upsert(lessonRecord, { onConflict: "id" })
        .select()
        .single()

      if (error) {
        console.error("Lesson upsert failed")
        return sendSafeJson(res, 500, { error: "Amal bajarilmadi" })
      }

      return sendSafeJson(res, 200, {
        success: true,
        lessonId: id,
        lesson: {
          id,
          courseId: lessonRecord.course_id,
          title: lessonRecord.title,
          description: lessonRecord.description,
          duration: body.duration || "10:00",
          durationSeconds: lessonRecord.duration_seconds,
          videoUrl: body.videoUrl || "",
          videoFormat: body.videoFormat || "shorts",
          thumbnailUrl: body.thumbnailUrl || "",
          status: "Faol",
          color: "lesson-blue",
        },
      })
    }

    if (normalizedPath === "/api/lessons/update" && req.method === "POST") {
      const body = await parseBody()
      const lessonId = body.id || body.lessonId
      if (lessonId) {
        let videoIdToSave = body.videoUrl
        const { data: cur } = await supabase
          .from("academy_lessons")
          .select("youtube_video_id")
          .eq("id", String(lessonId))
          .maybeSingle()

        let curParsed = {}
        try {
          if (cur?.youtube_video_id?.startsWith("{")) {
            curParsed = JSON.parse(cur.youtube_video_id)
          }
        } catch {}

        if (body.videoUrl && (body.videoFormat || body.thumbnailUrl)) {
          const keepFileId =
            curParsed.url === body.videoUrl ? curParsed.file_id : undefined
          videoIdToSave = JSON.stringify({
            url: body.videoUrl,
            format: body.videoFormat || "shorts",
            thumb: body.thumbnailUrl || "",
            ...(keepFileId ? { file_id: keepFileId } : {}),
          })
        } else if (!body.videoUrl && (body.videoFormat || body.thumbnailUrl)) {
          let curRaw = curParsed.url || cur?.youtube_video_id || ""
          if (curRaw) {
            videoIdToSave = JSON.stringify({
              url: curRaw,
              format: body.videoFormat || "shorts",
              thumb: body.thumbnailUrl || "",
              ...(curParsed.file_id ? { file_id: curParsed.file_id } : {}),
            })
          }
        }

        const updateData = {
          updated_at: new Date().toISOString(),
        }
        if (body.title !== undefined) updateData.title = body.title
        if (body.description !== undefined)
          updateData.description = body.description
        if (videoIdToSave !== undefined)
          updateData.youtube_video_id = videoIdToSave
        if (body.durationSeconds !== undefined)
          updateData.duration_seconds = Number(body.durationSeconds)
        if (body.courseId !== undefined)
          updateData.course_id = String(body.courseId)

        const { error } = await supabase
          .from("academy_lessons")
          .update(updateData)
          .eq("id", String(lessonId))

        if (error) {
          console.error("Lesson update failed")
          return sendSafeJson(res, 500, { error: "Amal bajarilmadi" })
        }
      }
      return sendSafeJson(res, 200, { success: true })
    }

    if (normalizedPath === "/api/lessons/delete" && req.method === "POST") {
      const body = await parseBody()
      const lessonId = body.id || body.lessonId
      if (lessonId) {
        const { error } = await supabase
          .from("academy_lessons")
          .delete()
          .eq("id", String(lessonId))

        if (error) {
          console.error("Lesson delete failed")
          return sendSafeJson(res, 500, { error: "Amal bajarilmadi" })
        }
        await supabase
          .from("academy_user_progress")
          .delete()
          .eq("lesson_id", String(lessonId))
      }
      return sendSafeJson(res, 200, { success: true })
    }

    return sendSafeJson(res, 404, {
      error: "API endpoint topilmadi",
      path: normalizedPath,
    })
  } catch (err) {
    console.error("API request failed")
    return sendSafeJson(res, 500, {
      error: "Server xatosi. Qayta urinib ko‘ring.",
    })
  }
}
