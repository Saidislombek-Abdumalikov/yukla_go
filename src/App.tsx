import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AdminSettings,
  CourseItem,
  IconName,
  LessonItem,
  Screen,
  UserProfile,
} from "./types";
import { defaultCourse, defaultLessons, defaultSettings, store } from "./services/store";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    "arrow-left": <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
    expand: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />,
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="3" />
        <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
      </>
    ),
    pause: (
      <>
        <path d="M9 7v10M15 7v10" />
      </>
    ),
    play: <path d="m9 6 9 6-9 6Z" />,
    retry: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M18.5 16a7 7 0 1 1 .8-7.6L20 12" />
      </>
    ),
    shield: <path d="M12 3 5.5 5.7v5.5c0 4.1 2.7 7.8 6.5 9.8 3.8-2 6.5-5.7 6.5-9.8V5.7L12 3Z" />,
    volume: (
      <>
        <path d="M5 10v4h3l4 3V7L8 10H5Z" />
        <path d="M15 9.5a4 4 0 0 1 0 5" />
      </>
    ),
    "alert-triangle": (
      <>
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7h-6V1" />
        <path d="M20 1v6a9 9 0 1 0 1 8" />
      </>
    ),
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    user: (
      <>
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    close: <path d="M18 6 6 18M6 6l12 12" />,
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    >
      {paths[name]}
    </svg>
  );
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <span>Y</span>
    </div>
  );
}

function ProgressBar({
  value,
  max = 100,
  compact = false,
}: {
  value: number;
  max?: number;
  compact?: boolean;
}) {
  const width = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className={`progress-track ${compact ? "compact" : ""}`}>
      <div className="progress-fill" style={{ width: `${width}%` }} />
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  icon,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: IconName;
  type?: "button" | "submit";
}) {
  return (
    <button className="primary-button" onClick={onClick} type={type}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: IconName;
}) {
  return (
    <button className="secondary-button" onClick={onClick}>
      {icon && <Icon name={icon} />}
      <span>{children}</span>
    </button>
  );
}

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

// --- Telegram Bot Direct Link Screen (No Login Form) ---
function TelegramBotWelcomeScreen({ reason }: { reason?: string }) {
  const isNotRegistered = reason === "not_registered";
  const isBlocked = reason === "blocked";

  return (
    <main className="screen login-screen">
      <BrandMark />
      <div className="login-heading">
        <h1>Yukla Go Ta’lim</h1>
        <p>Yopiq amaliy ta’lim platformasi</p>
      </div>

      <div className="bot-link-card">
        <div className="bot-link-icon">
          <Icon name="shield" size={28} />
        </div>
        <h3>
          {isBlocked
            ? "Kirish to‘xtatilgan"
            : isNotRegistered
              ? "Ro‘yxatdan o‘tish zarur"
              : "Telegram bot orqali kiring"}
        </h3>
        <p>
          {isBlocked
            ? "Profilingiz administrator tomonidan bloklangan. Bot orqali qo‘llab-quvvatlash xizmatiga murojaat qiling."
            : isNotRegistered
              ? "Siz hali rasmiy botimizda ro‘yxatdan o‘tmadingiz. Darslarga kirish uchun botga kiring va /start buyrug‘ini yuboring."
              : "Ushbu video ta’lim platformasi foydalanuvchilar uchun yopiq hisoblanadi. Tashqi brauzer orqali to‘g‘ridan-to‘g‘ri kirish cheklangan. Darslarni ko‘rish uchun rasmiy Telegram botimiz orqali kiring."}
        </p>

        <a
          href="https://t.me/yuklakargobot"
          target="_blank"
          rel="noopener noreferrer"
          className="primary-button telegram-link-btn"
        >
          <span>Telegram botga o‘tish (@yuklakargobot)</span>
        </a>
      </div>
    </main>
  );
}

function ProfileModal({
  user,
  courses,
  onClose,
  onOpenProgress,
  onLogout,
}: {
  user: UserProfile;
  courses: CourseItem[];
  onClose: () => void;
  onOpenProgress: () => void;
  onLogout: () => void;
}) {
  const allowedCourses = useMemo(() => {
    return courses.filter((c) => user.coursesAccess?.[c.id] === "Faol");
  }, [courses, user]);

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="profile-modal-head">
          <h2>Mening profilim</h2>
          <button aria-label="Yopish" className="icon-button" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="profile-hero-card">
          <div className="profile-big-avatar">{user.initials || "U"}</div>
          <div>
            <strong>{user.name}</strong>
            <span>ID: {user.id}</span>
          </div>
        </div>

        <div className="profile-details-grid">
          <div className="profile-detail-row">
            <span>Telefon raqami:</span>
            <strong>{user.phone || "Kiritilmagan"}</strong>
          </div>
          <div className="profile-detail-row">
            <span>Ruxsat etilgan kurslar:</span>
            <strong>
              {allowedCourses.length > 0
                ? allowedCourses.map((c) => c.title).join(", ")
                : "Kurslar ruxsati berilmagan"}
            </strong>
          </div>
          <div className="profile-detail-row">
            <span>Ruxsat holati:</span>
            <span className={`quick-badge ${user.access === "Faol" ? "faol" : "blocked"}`}>
              {user.access}
            </span>
          </div>
        </div>

        <div className="profile-actions">
          <PrimaryButton
            onClick={() => {
              onClose();
              onOpenProgress();
            }}
          >
            O‘quv natijalarini ko‘rish
          </PrimaryButton>
          <button className="logout-button" onClick={onLogout} type="button">
            <Icon name="logout" size={16} />
            <span>Chiqish</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function LessonCard({
  index,
  lesson,
  state,
  currentPosition,
  onOpen,
}: {
  index: number;
  lesson: LessonItem;
  state: "complete" | "active" | "locked";
  currentPosition: number;
  onOpen: () => void;
}) {
  const isComplete = state === "complete";
  const isActive = state === "active";
  const isLocked = state === "locked";

  const totalSeconds = lesson.durationSeconds || 600;

  const parsedYt = useMemo(() => parseYouTubeVideo(lesson.videoUrl), [lesson.videoUrl]);
  const thumbnailSrc = lesson.thumbnailUrl || parsedYt.thumbnailUrl;
  const isShort = lesson.videoFormat === "shorts" || parsedYt.isShort;

  return (
    <button
      className={`lesson-card ${state}`}
      disabled={isLocked}
      onClick={isLocked ? undefined : onOpen}
    >
      <div className="lesson-thumbnail">
        {thumbnailSrc ? (
          <img alt={lesson.title} src={thumbnailSrc} />
        ) : (
          <div className="lesson-thumb-placeholder">
            <Icon name="play" size={24} />
          </div>
        )}
        <span className="lesson-number">{String(index + 1).padStart(2, "0")}</span>
        {isShort && <span className="shorts-badge">⚡ Shorts</span>}
        {isComplete && (
          <span className="thumb-status complete">
            <Icon name="check" size={15} />
          </span>
        )}
        {isActive && (
          <span className="thumb-status play">
            <Icon name="play" size={14} />
          </span>
        )}
        {isLocked && (
          <span className="thumb-status locked">
            <Icon name="lock" size={14} />
          </span>
        )}
      </div>

      <div className="lesson-copy">
        <div className="lesson-meta">
          <span>{index + 1}-dars</span>
          <span className="dot" />
          <Icon name="clock" size={14} />
          <span>{lesson.duration}</span>
          {isShort && (
            <>
              <span className="dot" />
              <span className="shorts-meta-tag">Shorts</span>
            </>
          )}
        </div>
        <div className="lesson-title">{lesson.title}</div>

        {isComplete && (
          <div className="lesson-status completed">
            <Icon name="check" size={15} /> Tugallangan
          </div>
        )}

        {isActive && (
          <div className="active-progress">
            <div className="lesson-status current">
              <span>Davom ettirish</span>
              <span>
                {formatTime(currentPosition)} / {formatTime(totalSeconds)}
              </span>
            </div>
            <ProgressBar value={currentPosition} max={totalSeconds} compact />
          </div>
        )}

        {isLocked && (
          <div className="lesson-status muted">
            <Icon name="lock" size={14} /> Oldingi darsni tugating
          </div>
        )}
      </div>

      {!isLocked && (
        <span className="card-chevron">
          <Icon name="chevron" size={18} />
        </span>
      )}
    </button>
  );
}

function Header({
  user,
  onOpenProfile,
}: {
  user: UserProfile;
  onOpenProfile: () => void;
}) {
  return (
    <header className="app-header">
      <div className="brand">
        <BrandMark />
        <div>
          <div className="brand-name">Yukla Go</div>
          <div className="private-label">
            <Icon name="shield" size={12} />
            Shaxsiy o‘quv hududi
          </div>
        </div>
      </div>
      <button
        aria-label="Profil ma’lumotlari"
        className="avatar"
        onClick={onOpenProfile}
        title={`${user.name} profilini ochish`}
      >
        {user.initials || "YG"}
      </button>
    </header>
  );
}

function LessonsHome({
  user,
  courses,
  activeCourseId,
  setActiveCourseId,
  lessons,
  lessonStates,
  progressMap,
  onOpenPlayer,
  onOpenProgress,
  onOpenProfile,
}: {
  user: UserProfile;
  courses: CourseItem[];
  activeCourseId: number;
  setActiveCourseId: (id: number) => void;
  lessons: LessonItem[];
  lessonStates: Record<number, "complete" | "active" | "locked">;
  progressMap: Record<number, { current: number; maxWatched: number; completed: boolean }>;
  onOpenPlayer: (lesson: LessonItem) => void;
  onOpenProgress: () => void;
  onOpenProfile: () => void;
}) {
  const allowedCourses = useMemo(() => {
    return courses.filter(
      (c) =>
        !user.coursesAccess ||
        Object.keys(user.coursesAccess).length === 0 ||
        user.coursesAccess[c.id] === "Faol" ||
        user.coursesAccess[String(c.id)] === "Faol"
    );
  }, [courses, user]);

  const activeCourse = useMemo(() => {
    if (courses.length === 0) return null;
    return (
      allowedCourses.find((c) => String(c.id) === String(activeCourseId)) ||
      allowedCourses[0] ||
      courses.find((c) => String(c.id) === String(activeCourseId)) ||
      courses[0] ||
      null
    );
  }, [allowedCourses, activeCourseId, courses]);

  const publishedLessons = useMemo(() => {
    if (!activeCourse) return [];
    return lessons.filter(
      (l) =>
        String(l.courseId) === String(activeCourse.id) &&
        l.status !== "Qoralama" &&
        l.status !== "Yashirilgan"
    );
  }, [lessons, activeCourse]);

  const completedCount = useMemo(() => {
    return publishedLessons.filter((l) => lessonStates[l.id] === "complete").length;
  }, [publishedLessons, lessonStates]);

  const totalCount = publishedLessons.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const nextLesson = useMemo(() => {
    return publishedLessons.find((l) => lessonStates[l.id] === "active");
  }, [publishedLessons, lessonStates]);

  if (!activeCourse) {
    return (
      <main className="screen home-screen">
        <Header onOpenProfile={onOpenProfile} user={user} />
        <section className="intro">
          <p className="eyebrow">Video darslar</p>
          <h1>Kurslar mavjud emas</h1>
          <p className="subtitle">Administrator tomonidan yangi darslar tez kunda yuklanadi.</p>
        </section>
        <div className="empty-panel-msg">
          <p>Hozircha faol kurslar mavjud emas.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="screen home-screen">
      <Header onOpenProfile={onOpenProfile} user={user} />

      {/* Multi-Course Switcher (if user has access to multiple courses) */}
      {allowedCourses.length > 1 && (
        <div className="user-course-selector">
          <label>Kursni tanlang:</label>
          <select
            value={activeCourse.id}
            onChange={(e) => setActiveCourseId(Number(e.target.value))}
          >
            {allowedCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <section className="intro">
        <p className="eyebrow">Video darslar</p>
        <h1>{activeCourse.title}</h1>
        <p className="subtitle">{activeCourse.description}</p>
      </section>

      <button className="course-progress-card" onClick={onOpenProgress}>
        <div className="progress-topline">
          <div>
            <span className="progress-label">Kurs jarayoni</span>
            <strong>
              {completedCount} / {totalCount} dars
            </strong>
          </div>
          <span className="percent-pill">{progressPercent}%</span>
        </div>
        <ProgressBar value={progressPercent} />
        <div className="progress-foot">
          <span>
            {nextLesson
              ? `Keyingi: ${nextLesson.title}`
              : completedCount === totalCount && totalCount > 0
                ? "Barcha darslar muvaffaqiyatli tugallandi!"
                : "Darslarni boshlang"}
          </span>
          <Icon name="chevron" size={16} />
        </div>
      </button>

      <div className="section-heading">
        <h2>Darslar</h2>
        <span>{totalCount} ta dars</span>
      </div>

      {publishedLessons.length === 0 ? (
        <div className="empty-panel-msg">
          <p>Ushbu kurs uchun darslar tez kunda yuklanadi.</p>
        </div>
      ) : (
        <div className="lesson-list">
          {publishedLessons.map((lesson, index) => {
            const state = lessonStates[lesson.id] || "locked";
            const currentPos = progressMap[lesson.id]?.current || 0;

            return (
              <LessonCard
                currentPosition={currentPos}
                index={index}
                key={lesson.id}
                lesson={lesson}
                onOpen={() => onOpenPlayer(lesson)}
                state={state}
              />
            );
          })}
        </div>
      )}

      <div className="safe-note">
        <Icon name="shield" size={17} />
        <span>Darslar faqat sizning foydalanishingiz uchun himoyalangan.</span>
      </div>
    </main>
  );
}

function VideoLoading() {
  return (
    <div aria-label="Video yuklanmoqda" className="loading-state">
      <div className="video-skeleton">
        <span className="spinner" />
        <span>Video yuklanmoqda...</span>
      </div>
      <div className="skeleton-line short" />
      <div className="skeleton-line wide" />
      <div className="skeleton-line medium" />
    </div>
  );
}

function VideoError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="error-state">
      <div className="error-icon">
        <Icon name="retry" size={26} />
      </div>
      <h2>Video ochilmadi</h2>
      <p>Internet aloqangizni tekshirib, qayta urinib ko‘ring.</p>
      <PrimaryButton icon="retry" onClick={onRetry}>
        Qayta urinish
      </PrimaryButton>
    </div>
  );
}

export function parseYouTubeVideo(url?: string): {
  videoId: string | null;
  isShort: boolean;
  embedUrl: string | null;
  thumbnailUrl: string | null;
} {
  if (!url || typeof url !== "string") {
    return { videoId: null, isShort: false, embedUrl: null, thumbnailUrl: null };
  }
  const trimmed = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    const videoId = trimmed;
    return {
      videoId,
      isShort: false,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
  const isShort = trimmed.includes("/shorts/");
  const match = trimmed.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|v\/|embed\/|shorts\/|live\/))([a-zA-Z0-9_-]{11})/i
  );
  if (match && match[1]) {
    const videoId = match[1];
    return {
      videoId,
      isShort,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
  return { videoId: null, isShort: false, embedUrl: null, thumbnailUrl: null };
}

function VideoPlayer({
  lesson,
  lessonIndex,
  user,
  settings,
  initialPosition,
  initialMaxWatched,
  isAlreadyCompleted,
  onBack,
  onComplete,
  onNextLesson,
  hasNextLesson,
}: {
  lesson: LessonItem;
  lessonIndex: number;
  user: UserProfile;
  settings: AdminSettings;
  initialPosition: number;
  initialMaxWatched: number;
  isAlreadyCompleted: boolean;
  onBack: () => void;
  onComplete: (lessonId: number) => void;
  onNextLesson?: () => void;
  hasNextLesson: boolean;
}) {
  const parsedYt = useMemo(() => parseYouTubeVideo(lesson.videoUrl), [lesson.videoUrl]);
  const isShort = lesson.videoFormat === "shorts" || parsedYt.isShort;
  const youtubeEmbedUrl = parsedYt.embedUrl;
  const isDirectVideo = useMemo(
    () => Boolean(lesson.videoUrl && !youtubeEmbedUrl && (lesson.videoUrl.endsWith(".mp4") || lesson.videoUrl.includes("video"))),
    [lesson.videoUrl, youtubeEmbedUrl]
  );

  const total = lesson.durationSeconds || 600;
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(initialPosition);
  const [maxWatched, setMaxWatched] = useState(Math.max(initialMaxWatched, initialPosition));
  const [notice, setNotice] = useState(false);
  const [completed, setCompleted] = useState(isAlreadyCompleted);
  const noticeTimer = useRef<number | undefined>(undefined);

  const currentRef = useRef(current);
  const maxWatchedRef = useRef(maxWatched);
  const completedRef = useRef(completed);

  currentRef.current = current;
  maxWatchedRef.current = maxWatched;
  completedRef.current = completed;

  // Save progress on unmount
  useEffect(() => {
    return () => {
      if (settings.autoSaveProgress) {
        store.saveLessonProgress(
          user.id,
          lesson.id,
          currentRef.current,
          maxWatchedRef.current,
          completedRef.current
        );
      }
    };
  }, [user.id, lesson.id, settings.autoSaveProgress]);

  // Video playback simulation loop (when not using youtube iframe)
  useEffect(() => {
    if (!playing || youtubeEmbedUrl) return;

    const timer = window.setInterval(() => {
      setCurrent((position) => {
        const next = Math.min(total, position + 1);
        const newMax = Math.max(maxWatchedRef.current, next);
        setMaxWatched(newMax);

        const thresholdPercent = settings.defaultCompletionPercent || 95;
        const targetSeconds = (total * thresholdPercent) / 100;

        if (next >= targetSeconds && !completedRef.current) {
          setCompleted(true);
          onComplete(lesson.id);
        }

        if (next >= total) {
          setPlaying(false);
        }

        if (settings.autoSaveProgress && next % 4 === 0) {
          store.saveLessonProgress(
            user.id,
            lesson.id,
            next,
            newMax,
            completedRef.current || next >= targetSeconds
          );
        }

        return next;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [playing, total, lesson.id, user.id, settings, onComplete, youtubeEmbedUrl]);

  // Anti-scrubbing protection
  const seek = (value: number) => {
    if (value > maxWatched + 2) {
      setCurrent(maxWatched);
      setNotice(true);
      window.clearTimeout(noticeTimer.current);
      noticeTimer.current = window.setTimeout(() => setNotice(false), 1800);
      return;
    }
    setCurrent(value);
  };

  const handleFinishLesson = () => {
    setCompleted(true);
    onComplete(lesson.id);
    if (hasNextLesson && onNextLesson) {
      onNextLesson();
    }
  };

  const watermarkText = useMemo(() => {
    if (!settings.dynamicWatermark) return null;
    if (settings.watermarkFormat === "id") return user.id;
    if (settings.watermarkFormat === "full") return `${user.name} (${user.id}) • Yukla Go`;
    return `${user.id} • Yukla Go`;
  }, [settings, user]);

  return (
    <main className="screen player-screen">
      <div className="player-header">
        <button aria-label="Orqaga" className="icon-button" onClick={onBack}>
          <Icon name="arrow-left" />
        </button>
        <span>{lessonIndex + 1}-dars</span>
        <span className="header-spacer" />
      </div>

      {youtubeEmbedUrl ? (
        <div className={`video-frame ${isShort ? "youtube-shorts-container" : "youtube-container"}`}>
          <iframe
            src={youtubeEmbedUrl}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="youtube-iframe"
          />
          {watermarkText && <span className="watermark floating-watermark">{watermarkText}</span>}
        </div>
      ) : isDirectVideo ? (
        <div className="video-frame direct-video-container">
          <video
            src={lesson.videoUrl}
            controls
            controlsList="nodownload"
            onContextMenu={(e) => e.preventDefault()}
            className="native-video-elem"
            onEnded={() => {
              setCompleted(true);
              onComplete(lesson.id);
            }}
          />
          {watermarkText && <span className="watermark floating-watermark">{watermarkText}</span>}
        </div>
      ) : lesson.videoUrl ? (
        <div className="video-frame youtube-container">
          <iframe
            src={lesson.videoUrl}
            title={lesson.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="youtube-iframe"
          />
          {watermarkText && <span className="watermark floating-watermark">{watermarkText}</span>}
        </div>
      ) : (
        <div className="video-frame no-video-notice-box">
          <div className="no-video-center">
            <Icon name="play" size={36} />
            <p>Ushbu dars uchun video havola biriktirilmagan</p>
          </div>
        </div>
      )}

      <section className="lesson-detail">
        <div className="lesson-header-flex">
          <div>
            <p className="eyebrow">
              {lessonIndex + 1}-dars {isShort && <span className="shorts-badge-small">⚡ Shorts</span>}
            </p>
            <h1>{lesson.title}</h1>
          </div>
        </div>

        <p className="lesson-description">
          {lesson.description ||
            "Xarid qilishdan oldin mahsulot sifati va ma’lumotlarini to‘g‘ri baholashni o‘rganing."}
        </p>

        {!youtubeEmbedUrl && (
          <div className="watch-progress">
            <div className="watch-row">
              <span>Ko‘rish jarayoni</span>
              <strong>
                {formatTime(current)} / {formatTime(total)}
              </strong>
            </div>
            <ProgressBar max={total} value={current} />
            <div className="watch-hint">
              <span>Ko‘rilgan qismga qaytishingiz mumkin</span>
              <span>{Math.round((maxWatched / total) * 100)}%</span>
            </div>
          </div>
        )}

        {completed ? (
          <div className="completion-card">
            <div className="completion-icon">
              <Icon name="check" size={22} />
            </div>
            <div>
              <h2>Dars tugallandi</h2>
              <p>Keyingi dars siz uchun ochildi.</p>
            </div>
          </div>
        ) : (
          <div className="resume-note">
            <span className="resume-icon">
              <Icon name="check" size={15} />
            </span>
            <div>
              <strong>Darsni ko‘rib bo‘lgach tasdiqlang</strong>
              <span>Keyingi darsga o‘tish uchun quyidagi tugmani bosing</span>
            </div>
          </div>
        )}

        <div className="player-actions">
          {completed && hasNextLesson ? (
            <PrimaryButton onClick={onNextLesson}>Keyingi dars</PrimaryButton>
          ) : !completed ? (
            <PrimaryButton icon="check" onClick={handleFinishLesson}>
              Darsni tugatish va keyingisiga o‘tish
            </PrimaryButton>
          ) : (
            <PrimaryButton onClick={onBack}>Barcha darslarga qaytish</PrimaryButton>
          )}
          <SecondaryButton onClick={onBack}>Darslar ro‘yxatiga qaytish</SecondaryButton>
        </div>
      </section>
    </main>
  );
}

function ProgressScreen({
  lessons,
  lessonStates,
  progressMap,
  onBack,
}: {
  lessons: LessonItem[];
  lessonStates: Record<number, "complete" | "active" | "locked">;
  progressMap: Record<number, { current: number; maxWatched: number; completed: boolean }>;
  onBack: () => void;
}) {
  const publishedLessons = useMemo(
    () => lessons.filter((l) => l.status !== "Qoralama" && l.status !== "Yashirilgan"),
    [lessons]
  );

  const completedCount = useMemo(() => {
    return publishedLessons.filter((l) => lessonStates[l.id] === "complete").length;
  }, [publishedLessons, lessonStates]);

  const activeCount = useMemo(() => {
    return publishedLessons.filter((l) => lessonStates[l.id] === "active").length;
  }, [publishedLessons, lessonStates]);

  const lockedCount = Math.max(0, publishedLessons.length - completedCount - activeCount);
  const total = publishedLessons.length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const circumference = 327;
  const strokeOffset = circumference - (circumference * percent) / 100;

  return (
    <main className="screen progress-screen">
      <div className="subpage-header">
        <button aria-label="Orqaga" className="icon-button" onClick={onBack}>
          <Icon name="arrow-left" />
        </button>
        <span>Natijalar</span>
        <span className="header-spacer" />
      </div>

      <section className="result-hero">
        <p className="eyebrow">Kurs jarayoni</p>
        <h1>Sizning natijangiz</h1>
        <div className="result-ring">
          <svg viewBox="0 0 120 120">
            <circle className="ring-track" cx="60" cy="60" r="52" />
            <circle
              className="ring-value"
              cx="60"
              cy="60"
              r="52"
              style={{ strokeDashoffset: strokeOffset }}
            />
          </svg>
          <div>
            <strong>{percent}%</strong>
            <span>bajarildi</span>
          </div>
        </div>
        <h2>
          {completedCount} / {total} dars tugallangan
        </h2>
        <p>
          {percent >= 100
            ? "Tabriklaymiz! Barcha darslarni muvaffaqiyatli yakunladingiz."
            : "Yaxshi boshlanish. Hozirgi darsni davom ettiring."}
        </p>
      </section>

      <section className="summary-grid">
        <div>
          <span className="summary-dot done">
            <Icon name="check" size={14} />
          </span>
          <strong>{completedCount}</strong>
          <span>Tugallangan</span>
        </div>
        <div>
          <span className="summary-dot now">
            <Icon name="play" size={13} />
          </span>
          <strong>{activeCount}</strong>
          <span>Hozirgi dars</span>
        </div>
        <div>
          <span className="summary-dot later">
            <Icon name="lock" size={13} />
          </span>
          <strong>{lockedCount}</strong>
          <span>Qolgan dars</span>
        </div>
      </section>

      <div className="section-heading progress-heading">
        <h2>Darslar holati</h2>
      </div>

      <div className="status-list">
        {publishedLessons.map((lesson, index) => {
          const state = lessonStates[lesson.id] || "locked";
          const prog = progressMap[lesson.id];
          const lessonSeconds = lesson.durationSeconds || 600;
          const currentPct = prog ? Math.round((prog.current / lessonSeconds) * 100) : 0;

          return (
            <div className={`status-row ${state}`} key={lesson.id}>
              <span className="status-number">{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{lesson.title}</strong>
                <span>
                  {state === "complete"
                    ? "Tugallangan"
                    : state === "active"
                      ? `Hozirgi dars · ${currentPct}%`
                      : "Qulflangan"}
                </span>
              </div>
              <span className="row-state">
                <Icon
                  name={state === "complete" ? "check" : state === "active" ? "play" : "lock"}
                  size={15}
                />
              </span>
            </div>
          );
        })}
      </div>

      <PrimaryButton onClick={onBack}>Darsni davom ettirish</PrimaryButton>
    </main>
  );
}

function SuspendedScreen({
  user,
  onLogout,
}: {
  user: UserProfile;
  onLogout: () => void;
}) {
  return (
    <main className="screen suspended-screen">
      <BrandMark />
      <div className="suspended-visual">
        <Icon name="alert-triangle" size={36} />
      </div>
      <h1>Kirish vaqtincha to‘xtatildi</h1>
      <p>
        Administrator tomonidan profilingizga kirish to‘xtatilgan. Darslarni davom ettirish uchun
        administrator bilan bog‘laning.
      </p>

      <div className="suspended-card">
        <div className="suspended-row">
          <span>Foydalanuvchi:</span>
          <strong>{user.name}</strong>
        </div>
        <div className="suspended-row">
          <span>Identifikator:</span>
          <strong>{user.id}</strong>
        </div>
      </div>

      <div className="suspended-actions">
        <SecondaryButton icon="logout" onClick={onLogout}>
          Telegram Botga qaytish
        </SecondaryButton>
      </div>
    </main>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("lessons");
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // Authenticated user state (strict Telegram Mini App check in production)
  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const [user, setUser] = useState<UserProfile | null>(() => (isLocalhost ? store.getAuthUser() : null));
  const [authError, setAuthError] = useState<string | undefined>(undefined);
  const [authLoading, setAuthLoading] = useState(true);

  // Dynamic store data
  const [courses, setCourses] = useState<CourseItem[]>(() => store.getCourses());
  const [activeCourseId, setActiveCourseId] = useState<number>(() => store.getActiveCourseId());
  const [lessons, setLessons] = useState<LessonItem[]>(() => store.getLessons());
  const [settings, setSettings] = useState<AdminSettings>(() => store.getSettings());
  const [userProgress, setUserProgress] = useState<Record<string | number, any>>(() => (user ? store.getUserProgress(user.id) : {}));

  // Auto load user from Telegram Mini App or link
  useEffect(() => {
    store.loadUserFromUrlOrStorage().then(({ user: loadedUser, error }) => {
      if (loadedUser) {
        setUser(loadedUser);
        setUserProgress(store.getUserProgress(loadedUser.id));
      } else {
        setUser(null);
        setAuthError(error);
      }
      setAuthLoading(false);
    });

    const doSync = () => {
      store.syncStateFromServer().then((data) => {
        if (data) {
          if (Array.isArray(data.courses)) setCourses(data.courses);
          if (Array.isArray(data.lessons)) setLessons(data.lessons);
          if (data.settings) setSettings(data.settings);
        }
      });
    };

    doSync();
    const interval = setInterval(doSync, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    store.logout();
    setUser(null);
    setProfileModalOpen(false);
    setScreen("lessons");
  };

  // Real-time synchronization listener (SSE from sync-server)
  useEffect(() => {
    const unsubscribe = store.subscribe((message) => {
      if (message.type === "UPDATE_LESSONS") {
        setLessons(message.payload);
      } else if (message.type === "UPDATE_COURSES") {
        setCourses(message.payload);
      } else if (message.type === "UPDATE_SETTINGS") {
        setSettings(message.payload);
      } else if (message.type === "UPDATE_USERS" && user) {
        const found = message.payload.find((u) => u.id === user.id);
        if (found) {
          setUser(found);
          store.setAuthUser(found);
        }
      } else if (message.type === "UPDATE_USER_ACCESS" && user) {
        if (message.payload.userIds?.includes(user.id)) {
          setUser((prev) => {
            if (!prev) return null;
            const updated = {
              ...prev,
              access: message.payload.access,
              coursesAccess: {
                ...(prev.coursesAccess || {}),
                ...(message.payload.courseId ? { [message.payload.courseId]: message.payload.access } : {}),
              },
            };
            store.setAuthUser(updated);
            return updated;
          });
        }
      } else if (message.type === "RESET_USER_PROGRESS" && user) {
        if (message.payload.userId === user.id) {
          setUserProgress({});
        }
      }
    });

    return unsubscribe;
  }, [user]);

  // Compute lesson states based on user progress and admin rules
  const { lessonStates, publishedLessons } = useMemo(() => {
    let published = lessons.filter(
      (l) =>
        String(l.courseId) === String(activeCourseId) &&
        l.status !== "Qoralama" &&
        l.status !== "Yashirilgan"
    );

    // Fallback: If no lessons match activeCourseId, use all non-draft lessons
    if (published.length === 0 && lessons.length > 0) {
      published = lessons.filter((l) => l.status !== "Qoralama" && l.status !== "Yashirilgan");
    }

    const states: Record<number, "complete" | "active" | "locked"> = {};
    let foundActive = false;

    published.forEach((l) => {
      const prog = user ? userProgress[l.id] || userProgress[String(l.id)] : undefined;
      const isComplete = Boolean(prog?.completed);

      if (isComplete) {
        states[l.id] = "complete";
      } else if (!settings.sequentialLessons) {
        states[l.id] = "active";
      } else {
        if (!foundActive) {
          states[l.id] = "active";
          foundActive = true;
        } else {
          states[l.id] = "locked";
        }
      }
    });

    if (published.length > 0 && !foundActive && published.some((l) => !userProgress[l.id]?.completed)) {
      const firstIncomplete = published.find((l) => !userProgress[l.id]?.completed);
      if (firstIncomplete) {
        states[firstIncomplete.id] = "active";
      }
    }

    return { lessonStates: states, publishedLessons: published };
  }, [lessons, activeCourseId, userProgress, settings.sequentialLessons, user]);

  const handleLessonComplete = (lessonId: number) => {
    if (!user) return;
    const lesson = lessons.find((l) => String(l.id) === String(lessonId));
    const total = lesson?.durationSeconds || 600;
    store.saveLessonProgress(user.id, Number(lessonId), total, total, true);
    setUserProgress(store.getUserProgress(user.id));
  };

  const activeLesson = useMemo(() => {
    if (activeLessonId !== null) {
      return (
        publishedLessons.find((l) => String(l.id) === String(activeLessonId)) ||
        lessons.find((l) => String(l.id) === String(activeLessonId)) ||
        publishedLessons[0] ||
        lessons[0] ||
        null
      );
    }
    return publishedLessons[0] || lessons[0] || null;
  }, [activeLessonId, publishedLessons, lessons]);

  const activeLessonIndex = useMemo(() => {
    if (!activeLesson) return 0;
    const idx = publishedLessons.findIndex((l) => String(l.id) === String(activeLesson.id));
    return idx >= 0 ? idx : 0;
  }, [activeLesson, publishedLessons]);

  const handleOpenPlayer = (lesson: LessonItem) => {
    setActiveLessonId(lesson.id);
    setScreen("player");
  };

  const handleNextLesson = () => {
    if (activeLessonIndex >= 0 && activeLessonIndex < publishedLessons.length - 1) {
      const next = publishedLessons[activeLessonIndex + 1];
      setActiveLessonId(next.id);
    } else {
      setScreen("lessons");
    }
  };

  // --- 0. Authentication loading screen ---
  if (authLoading) {
    return (
      <div className="app-shell" style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <BrandMark />
          <p style={{ color: "var(--ink-soft)", fontSize: "14px", fontWeight: 600 }}>Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  // --- 1. No user authenticated: Show Telegram Bot Welcome Screen (NO LOGIN FORM) ---
  if (!user) {
    return (
      <div className="app-shell">
        <TelegramBotWelcomeScreen reason={authError} />
      </div>
    );
  }

  // --- 2. Access suspended by Admin ---
  if (user.access === "To‘xtatilgan") {
    return (
      <div className="app-shell">
        <SuspendedScreen onLogout={handleLogout} user={user} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      {screen === "lessons" && (
        <LessonsHome
          activeCourseId={activeCourseId}
          courses={courses}
          lessonStates={lessonStates}
          lessons={lessons}
          onOpenPlayer={handleOpenPlayer}
          onOpenProfile={() => setProfileModalOpen(true)}
          onOpenProgress={() => setScreen("progress")}
          progressMap={userProgress}
          setActiveCourseId={setActiveCourseId}
          user={user}
        />
      )}

      {screen === "player" && activeLesson && (
        <VideoPlayer
          hasNextLesson={activeLessonIndex < publishedLessons.length - 1}
          initialMaxWatched={userProgress[activeLesson.id]?.maxWatched || 0}
          initialPosition={userProgress[activeLesson.id]?.current || 0}
          isAlreadyCompleted={Boolean(userProgress[activeLesson.id]?.completed)}
          key={activeLesson.id}
          lesson={activeLesson}
          lessonIndex={activeLessonIndex}
          onBack={() => setScreen("lessons")}
          onComplete={handleLessonComplete}
          onNextLesson={handleNextLesson}
          settings={settings}
          user={user}
        />
      )}

      {screen === "progress" && (
        <ProgressScreen
          lessonStates={lessonStates}
          lessons={publishedLessons}
          onBack={() => setScreen("lessons")}
          progressMap={userProgress}
        />
      )}

      {profileModalOpen && (
        <ProfileModal
          courses={courses}
          onClose={() => setProfileModalOpen(false)}
          onLogout={handleLogout}
          onOpenProgress={() => setScreen("progress")}
          user={user}
        />
      )}
    </div>
  );
}
