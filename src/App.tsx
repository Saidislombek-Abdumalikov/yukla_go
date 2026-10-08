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
    maximize: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />,
    minimize: <path d="M4 14h6v6M20 10h-6V4M14 14h6v6M10 10H4V4" />,
    "rewind-10": (
      <>
        <path d="M11 17l-5-5 5-5" />
        <path d="M18 17l-5-5 5-5" />
      </>
    ),
    "forward-10": (
      <>
        <path d="M6 17l5-5-5-5" />
        <path d="M13 17l5-5-5-5" />
      </>
    ),
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
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </>
    ),
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
        <h1>Yukla GO Ta’lim</h1>
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
    return courses.filter(
      (c) =>
        user.coursesAccess?.[c.id] === "Faol" ||
        user.coursesAccess?.[String(c.id)] === "Faol"
    );
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

  const thumbnailSrc = lesson.thumbnailUrl || "";
  const isShort = lesson.videoFormat === "shorts";

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
          <div className="brand-name">Yukla GO</div>
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
        user.coursesAccess?.[c.id] === "Faol" ||
        user.coursesAccess?.[String(c.id)] === "Faol"
    );
  }, [courses, user]);

  const activeCourse = useMemo(() => {
    if (allowedCourses.length === 0) return null;
    return (
      allowedCourses.find((c) => String(c.id) === String(activeCourseId)) ||
      allowedCourses[0]
    );
  }, [allowedCourses, activeCourseId]);

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

  if (courses.length === 0) {
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

  if (!activeCourse) {
    return (
      <main className="screen home-screen">
        <Header onOpenProfile={onOpenProfile} user={user} />
        <section className="intro">
          <p className="eyebrow">Video darslar</p>
          <h1>Kurslarga ruxsat kutilmoqda</h1>
          <p className="subtitle">Administrator sizga darslarga kirish huquqini berganidan so‘ng darslar ochiladi.</p>
        </section>
        <div className="empty-panel-msg">
          <p>⏳ Sizning akkauntingiz (<code>{user.id}</code>) ro‘yxatga olingan. Administrator tez orada sizga tegishli kurslarni faollashtiradi.</p>
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
            onChange={(e) => setActiveCourseId(e.target.value as unknown as number)}
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

type VideoQuality = "1080p" | "720p" | "480p" | "auto";

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

  // Dynamic video dimensions detected automatically from video metadata
  const [videoDimensions, setVideoDimensions] = useState<{
    width: number;
    height: number;
    aspectRatio: string;
    isVertical: boolean;
  } | null>(null);

  // Quality Control: default strictly to 720p HD minimum
  const [quality, setQuality] = useState<VideoQuality>("720p");
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);

  // Double-tap splash indicator
  const [doubleTapSplash, setDoubleTapSplash] = useState<"-10s" | "+10s" | null>(null);
  const splashTimerRef = useRef<number | undefined>(undefined);

  const total = lesson.durationSeconds || 600;
  const [duration, setDuration] = useState(total);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(initialPosition);
  const [maxWatched, setMaxWatched] = useState(Math.max(initialMaxWatched, initialPosition));
  const [completed, setCompleted] = useState(isAlreadyCompleted);
  const [speed, setSpeed] = useState<1 | 1.25 | 1.5 | 2>(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [centerPulse, setCenterPulse] = useState<"play" | "pause" | null>(null);
  const [scrubNotice, setScrubNotice] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<number | undefined>(undefined);
  const pulseTimeoutRef = useRef<number | undefined>(undefined);
  const noticeTimerRef = useRef<number | undefined>(undefined);
  const lastTapRef = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const currentRef = useRef(current);
  const maxWatchedRef = useRef(maxWatched);
  const completedRef = useRef(completed);
  currentRef.current = current;
  maxWatchedRef.current = maxWatched;
  completedRef.current = completed;

  // Auto-hide controls after 2.6s of idle playback
  const showControlsTemporarily = () => {
    setControlsVisible(true);
    if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    if (playing) {
      controlsTimeoutRef.current = window.setTimeout(() => {
        setControlsVisible(false);
        setQualityMenuOpen(false);
      }, 2600);
    }
  };

  useEffect(() => {
    if (playing) {
      showControlsTemporarily();
    } else {
      setControlsVisible(true);
      if (controlsTimeoutRef.current) window.clearTimeout(controlsTimeoutRef.current);
    }
  }, [playing]);

  const showScrubWarning = () => {
    setScrubNotice(true);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setScrubNotice(false), 2400);
  };

  const triggerDoubleTapSplash = (type: "-10s" | "+10s") => {
    setDoubleTapSplash(type);
    if (splashTimerRef.current) window.clearTimeout(splashTimerRef.current);
    splashTimerRef.current = window.setTimeout(() => setDoubleTapSplash(null), 600);
  };

  const handleSelectQuality = (q: VideoQuality) => {
    setQuality(q);
    setQualityMenuOpen(false);
    showControlsTemporarily();
  };

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      const active = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(active);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

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
        ).catch(() => {});
      }
    };
  }, [user.id, lesson.id, settings.autoSaveProgress]);

  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;
  const persist = async () => {
    if (savingRef.current) { pendingSaveRef.current = true; return; }
    savingRef.current = true;
    setSaving(true);
    try {
      const result = await store.saveLessonProgress(user.id, lesson.id, currentRef.current, maxWatchedRef.current, false);
      setSaveError("");
      if (result.completed && !completedRef.current) {
        completedRef.current = true; setCompleted(true); completeRef.current(lesson.id);
      }
    } catch { setSaveError("Progress saqlanmadi. Internetni tekshirib qayta saqlang."); }
    finally { savingRef.current = false; setSaving(false); if (pendingSaveRef.current) { pendingSaveRef.current = false; void persistRef.current(); } }
  };
  const persistRef = useRef(persist); persistRef.current = persist;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => { void persistRef.current(); }, 5000);
    return () => window.clearInterval(timer);
  }, [playing, lesson.id]);

  // Control Actions
  const togglePlay = () => {
    const next = !playing;
    setPlaying(next);
    setCenterPulse(next ? "play" : "pause");
    if (pulseTimeoutRef.current) window.clearTimeout(pulseTimeoutRef.current);
    pulseTimeoutRef.current = window.setTimeout(() => setCenterPulse(null), 650);

    if (videoRef.current) {
      if (next) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    }

    showControlsTemporarily();
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    const isFs = Boolean(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement ||
      isFullscreen
    );

    if (!isFs) {
      if (container.requestFullscreen) {
        container.requestFullscreen().catch(() => setIsFullscreen(true));
      } else if ((container as any).webkitRequestFullscreen) {
        (container as any).webkitRequestFullscreen();
      } else {
        setIsFullscreen(true);
      }
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
      setIsFullscreen(false);
    }
  };

  const handleRewind10 = () => {
    const target = Math.max(0, current - 10);
    setCurrent(target);
    if (videoRef.current) videoRef.current.currentTime = target;
    showControlsTemporarily();
  };

  const handleForward10 = () => {
    // Respect anti-scrubbing
    if (current + 10 > maxWatched + 2) {
      showScrubWarning();
      return;
    }
    const target = Math.min(duration, current + 10);
    setCurrent(target);
    if (videoRef.current) videoRef.current.currentTime = target;
    showControlsTemporarily();
  };

  const handleSeek = (newTime: number) => {
    // Enforce anti-scrubbing: cannot skip past watched point
    if (newTime > maxWatched + 2) {
      showScrubWarning();
      const clamped = maxWatched;
      setCurrent(clamped);
      if (videoRef.current) videoRef.current.currentTime = clamped;
      return;
    }
    setCurrent(newTime);
    if (videoRef.current) videoRef.current.currentTime = newTime;
    showControlsTemporarily();
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrubberTrackRef.current) return;
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = Math.round(pct * duration);
    handleSeek(targetTime);
  };

  const speeds: (1 | 1.25 | 1.5 | 2)[] = [1, 1.25, 1.5, 2];
  const handleToggleSpeed = () => {
    const idx = speeds.indexOf(speed);
    const nextSpeed = speeds[(idx + 1) % speeds.length];
    setSpeed(nextSpeed);
    if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
    showControlsTemporarily();
  };

  const handleFinishLesson = () => { void persistRef.current(); };

  // Smart tap handling (single tap: show controls / toggle play; double tap left/right: 10s seek)
  const handleShieldTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const now = Date.now();
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const isLeft = clickX < width * 0.38;
    const isRight = clickX > width * 0.62;

    if (now - lastTapRef.current.time < 300) {
      // Double tap detected!
      if (isLeft) {
        handleRewind10();
        triggerDoubleTapSplash("-10s");
      } else if (isRight) {
        handleForward10();
        triggerDoubleTapSplash("+10s");
      } else {
        togglePlay();
      }
      lastTapRef.current = { time: 0, x: clickX };
    } else {
      lastTapRef.current = { time: now, x: clickX };
      showControlsTemporarily();
    }
  };

  // Dynamic security watermark
  const [watermarkPos, setWatermarkPos] = useState({ top: 16, left: 16 });
  useEffect(() => {
    const timer = setInterval(() => {
      setWatermarkPos({
        top: Math.floor(10 + Math.random() * 65),
        left: Math.floor(6 + Math.random() * 65),
      });
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const watermarkText = useMemo(() => {
    if (!settings.dynamicWatermark) return null;
    if (settings.watermarkFormat === "id") return user.id;
    if (settings.watermarkFormat === "full") return `${user.name} (${user.id}) • Yukla GO`;
    return `${user.id} • Yukla GO`;
  }, [settings, user]);

  const watchedPercent = duration > 0 ? (maxWatched / duration) * 100 : 0;
  const currentPercent = duration > 0 ? (current / duration) * 100 : 0;

  const isPhoneMode = videoDimensions?.isVertical === true;

  // --- Quality Label ---
  const qualityLabel = quality === "1080p" ? "1080p HD" : quality === "720p" ? "720p HD" : quality === "480p" ? "480p" : "Avto";

  return (
    <main className="screen player-screen">
      {/* Top Header outside player (Visible when not in fullscreen) */}
      {!isFullscreen && (
        <div className="player-header">
          <button aria-label="Orqaga" className="icon-button" onClick={onBack}>
            <Icon name="arrow-left" />
          </button>
          <span>{lessonIndex + 1}-dars</span>
          <span className="header-spacer" />
        </div>
      )}

      {/* --- Custom In-App Video Player --- */}
      {lesson.videoUrl ? (
        <div
          ref={containerRef}
          className={`custom-video-player ${videoDimensions?.isVertical ? "is-vertical-video" : "is-horizontal-video"} ${isFullscreen ? "is-fullscreen" : ""} ${!controlsVisible && playing ? "hide-controls" : ""}`}
          style={!isFullscreen && videoDimensions ? { aspectRatio: videoDimensions.aspectRatio } : undefined}
          onMouseMove={showControlsTemporarily}
          onTouchStart={showControlsTemporarily}
          onContextMenu={(e) => e.preventDefault()}
        >
          {/* Top Bar Overlay */}
          <div className="player-overlay-top">
            <div className="player-top-left">
              <button
                type="button"
                className="player-back-pill"
                onClick={onBack}
                title="Darslarga qaytish"
              >
                <Icon name="arrow-left" size={16} />
                <span>Darslar</span>
              </button>
              <span className="player-lesson-badge">
                {lessonIndex + 1}-dars
              </span>
            </div>

            <div className="player-top-right">
              {/* Quality Selector */}
              <div className="player-quality-wrapper">
                <button
                  type="button"
                  className="player-pill-btn quality-pill"
                  onClick={() => setQualityMenuOpen((prev) => !prev)}
                  title="Video sifati"
                >
                  <Icon name="settings" size={14} />
                  <span>{qualityLabel}</span>
                </button>

                {qualityMenuOpen && (
                  <div className="player-quality-dropdown">
                    <p className="quality-dropdown-title">Video sifati</p>
                    <button
                      type="button"
                      className={`quality-opt-btn ${quality === "1080p" ? "active" : ""}`}
                      onClick={() => handleSelectQuality("1080p")}
                    >
                      <span>1080p Full HD</span>
                      {quality === "1080p" && <Icon name="check" size={14} />}
                    </button>
                    <button
                      type="button"
                      className={`quality-opt-btn ${quality === "720p" ? "active" : ""}`}
                      onClick={() => handleSelectQuality("720p")}
                    >
                      <span>720p HD (Tavsiya etiladi)</span>
                      {quality === "720p" && <Icon name="check" size={14} />}
                    </button>
                    <button
                      type="button"
                      className={`quality-opt-btn ${quality === "480p" ? "active" : ""}`}
                      onClick={() => handleSelectQuality("480p")}
                    >
                      <span>480p Standart</span>
                      {quality === "480p" && <Icon name="check" size={14} />}
                    </button>
                    <button
                      type="button"
                      className={`quality-opt-btn ${quality === "auto" ? "active" : ""}`}
                      onClick={() => handleSelectQuality("auto")}
                    >
                      <span>Avto (Tejamkor)</span>
                      {quality === "auto" && <Icon name="check" size={14} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Speed Button */}
              <button
                type="button"
                className="player-pill-btn"
                onClick={handleToggleSpeed}
                title="Tezlikni o‘zgartirish"
              >
                {speed}x
              </button>
            </div>
          </div>

          {/* Media Box: 100% Native HTML5 Video Player */}
          <div className="custom-player-media-box">
            <video
              ref={videoRef}
              src={lesson.videoUrl}
              playsInline
              preload="auto"
              className="custom-player-native-video"
              onLoadedMetadata={(e) => {
                const d = Math.floor(e.currentTarget.duration);
                if (d > 0 && !isNaN(d)) setDuration(d);
                if (initialPosition > 0) {
                  e.currentTarget.currentTime = initialPosition;
                }
                const w = e.currentTarget.videoWidth;
                const h = e.currentTarget.videoHeight;
                if (w > 0 && h > 0) {
                  setVideoDimensions({
                    width: w,
                    height: h,
                    aspectRatio: `${w} / ${h}`,
                    isVertical: h > w,
                  });
                }
              }}
              onTimeUpdate={(e) => {
                const t = Math.floor(e.currentTarget.currentTime);
                currentRef.current = t;
                maxWatchedRef.current = Math.max(maxWatchedRef.current, t);
                setCurrent(t); setMaxWatched(maxWatchedRef.current);
              }}
              onSeeking={(e) => { if (!completedRef.current && e.currentTarget.currentTime > maxWatchedRef.current + 0.5) e.currentTarget.currentTime = maxWatchedRef.current; }}
              onError={() => setSaveError("Video ochilmadi. Admin video manzilini tekshirishi kerak.")}
              onWaiting={() => setControlsVisible(true)}
              onPlay={() => setPlaying(true)}
              onPause={() => { setPlaying(false); void persistRef.current(); }}
              onEnded={() => {
                setPlaying(false);
                const video = videoRef.current;
                if (video) { currentRef.current = Math.floor(video.currentTime); maxWatchedRef.current = Math.max(maxWatchedRef.current, currentRef.current); }
                void persistRef.current();
              }}
            />
          </div>

          {/* Interactive Click Shield (Tap anywhere to play/pause, Double-tap left/right to rewind/forward) */}
          <div
            className="custom-player-click-shield"
            onClick={handleShieldTap}
          />

          {/* Double-tap splash feedback (-10s / +10s) */}
          {doubleTapSplash && (
            <div className={`double-tap-splash splash-${doubleTapSplash === "-10s" ? "left" : "right"}`}>
              <Icon name={doubleTapSplash === "-10s" ? "rewind-10" : "forward-10"} size={36} />
              <span>{doubleTapSplash === "-10s" ? "10 soniya orqaga" : "10 soniya oldinga"}</span>
            </div>
          )}

          {/* Center Play/Pause Animated Pulse */}
          <div className={`center-pulse-indicator ${centerPulse ? "active" : ""}`}>
            <Icon name={centerPulse === "pause" ? "pause" : "play"} size={32} />
          </div>

          {/* Anti-Scrubbing Toast Warning */}
          {scrubNotice && (
            <div className="anti-scrub-notice">
              <span>⚠️ Darsni to‘liq ko‘rishingiz kerak. Oldinga o‘tkazish cheklangan.</span>
            </div>
          )}

          {/* Floating Dynamic Security Watermark */}
          {watermarkText && (
            <div
              className="dynamic-security-watermark"
              style={{ top: `${watermarkPos.top}%`, left: `${watermarkPos.left}%` }}
            >
              <span>{watermarkText}</span>
            </div>
          )}

          {/* Bottom Controls Overlay */}
          <div className="player-overlay-bottom">
            {/* Scrubber Progress Bar */}
            <div
              ref={scrubberTrackRef}
              className="player-scrubber-container"
              onClick={handleScrubberClick}
            >
              <div className="player-scrubber-track">
                <div
                  className="player-scrubber-watched"
                  style={{ width: `${Math.min(100, watchedPercent)}%` }}
                />
                <div
                  className="player-scrubber-progress"
                  style={{ width: `${Math.min(100, currentPercent)}%` }}
                />
                <div
                  className="player-scrubber-thumb"
                  style={{ left: `${Math.min(100, currentPercent)}%` }}
                />
              </div>
            </div>

            {/* Buttons Row */}
            <div className="player-controls-row">
              <div className="player-controls-left">
                <button
                  type="button"
                  className="player-icon-btn primary-play"
                  onClick={togglePlay}
                  title={playing ? "To‘xtatish" : "O‘ynatish"}
                >
                  <Icon name={playing ? "pause" : "play"} size={22} />
                </button>
                <button
                  type="button"
                  className="player-skip-btn"
                  onClick={handleRewind10}
                  title="10 soniya orqaga"
                >
                  <Icon name="rewind-10" size={14} />
                  <span>10s</span>
                </button>
                <button
                  type="button"
                  className="player-skip-btn"
                  onClick={handleForward10}
                  title="10 soniya oldinga"
                >
                  <span>10s</span>
                  <Icon name="forward-10" size={14} />
                </button>
                <span className="player-time-text">
                  {formatTime(current)} / {formatTime(duration)}
                </span>
              </div>

              <div className="player-controls-right">
                {hasNextLesson && onNextLesson && (
                  <button
                    type="button"
                    className={`player-next-lesson-btn ${completed ? "highlighted" : ""}`}
                    onClick={() => { if (completed) onNextLesson?.(); }}
                    title="Keyingi darsga o‘tish"
                  >
                    <span>Keyingi dars</span>
                    <Icon name="chevron" size={16} />
                  </button>
                )}
                {/* Single, clean Fullscreen button */}
                <button
                  type="button"
                  className="player-icon-btn"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Kichraytirish" : "To‘liq ekran (Fullscreen)"}
                >
                  <Icon name={isFullscreen ? "minimize" : "maximize"} size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="video-frame no-video-notice-box">
          <div className="no-video-center">
            <Icon name="play" size={36} />
            <p>Ushbu dars uchun video havola biriktirilmagan</p>
          </div>
        </div>
      )}

      {/* Lesson Details & Completion Section (Shown when not in fullscreen) */}
      {!isFullscreen && (
        <section className="lesson-detail">
          <div className="lesson-header-flex">
            <div>
              <p className="eyebrow">{lessonIndex + 1}-dars</p>
              <h1>{lesson.title}</h1>
            </div>
          </div>

          <p className="lesson-description">
            {lesson.description ||
              "Xarid qilishdan oldin mahsulot sifati va ma’lumotlarini to‘g‘ri baholashni o‘rganing."}
          </p>

          {/* Watch Progress Overview */}
          <div className="watch-progress">
            <div className="watch-row">
              <span>Ko‘rish jarayoni</span>
              <strong>
                {formatTime(current)} / {formatTime(duration)}
              </strong>
            </div>
            <ProgressBar max={duration} value={current} />
            <div className="watch-hint">
              <span>Ko‘rilgan qismga qaytishingiz mumkin</span>
              <span>{Math.round((maxWatched / Math.max(1, duration)) * 100)}%</span>
            </div>
          </div>

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
                <strong>Darsni oxirigacha tomosha qiling</strong>
                <span>Progress saqlangach keyingi dars ochiladi</span>
              </div>
            </div>
          )}

          {saveError && <p role="alert">{saveError}</p>}
          {saving && <p role="status">Saqlanmoqda…</p>}
          <div className="player-actions">
            {completed && hasNextLesson ? (
              <PrimaryButton onClick={() => { if (completed) onNextLesson?.(); }}>Keyingi dars</PrimaryButton>
            ) : !completed ? (
              <PrimaryButton icon="check" onClick={handleFinishLesson}>
                Progressni saqlash / qayta urinish
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={onBack}>Barcha darslarga qaytish</PrimaryButton>
            )}
            <SecondaryButton onClick={onBack}>Darslar ro‘yxatiga qaytish</SecondaryButton>
          </div>
        </section>
      )}
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

  // Auto load user from Telegram Mini App or link + load courses synchronously
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await store.loadUserFromUrlOrStorage();
        if (cancelled) return;
        if (result.user) {
          setUser(result.user); setUserProgress(store.getUserProgress(result.user.id));
          const data = await store.syncStateFromServer();
          if (data && !cancelled) { setCourses(data.courses); setLessons(data.lessons); setSettings(data.settings); const first = data.courses.find(c => result.user?.coursesAccess?.[c.id] === "Faol"); if (first) setActiveCourseId(first.id); }
        } else { setUser(null); setAuthError(result.error); }
      } finally { if (!cancelled) setAuthLoading(false); }
    })();

    let syncing = false;
    const doSync = () => {
      if (syncing || document.hidden) return;
      syncing = true;
      store.syncStateFromServer().then((data) => {
        if (data) {
          if (Array.isArray(data.courses)) setCourses(data.courses);
          if (Array.isArray(data.lessons)) setLessons(data.lessons);
          if (data.settings) setSettings(data.settings);
          const latest = store.getAuthUser();
          if (latest) { setUser(latest); setUserProgress(store.getUserProgress(latest.id)); }
        }
      }).finally(() => { syncing = false; });
    };

    const interval = setInterval(doSync, 30000);
    return () => { cancelled = true; clearInterval(interval); };
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
      if (message.type === "USER_PROGRESS_UPDATED" && user && message.payload.userId === user.id) {
        setUserProgress(store.getUserProgress(user.id));
      } else if (message.type === "UPDATE_LESSONS") {
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

  const handleLessonComplete = (_lessonId: number) => {
    if (!user) return;
    setUserProgress(store.getUserProgress(user.id));
    void store.syncStateFromServer().then(data => { if (data) setLessons(data.lessons); });
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
      if (lessonStates[next.id] === "locked" || !next.videoUrl) return;
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
