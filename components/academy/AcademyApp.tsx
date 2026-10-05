import React, { useState, useEffect } from 'react';
import type { Course, Lesson, UserProfile, CourseAccessStatus } from '../../types';
import LessonPlayer from './LessonPlayer';
import { api } from '../../services/api';

interface AcademyAppProps {
  onBackToCargo?: () => void;
}

const AcademyApp: React.FC<AcademyAppProps> = ({ onBackToCargo }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Course Access Control State
  const [hasAccess, setHasAccess] = useState<boolean>(true);
  const [accessStatus, setAccessStatus] = useState<CourseAccessStatus>('granted');
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  // Load user profile and courses
  useEffect(() => {
    api.getProfile().then(setUser).catch(() => {});
    loadCourses();
  }, []);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/academy/courses').then(r => r.json()).catch(() => []);
      const courseList = Array.isArray(res) ? res : [];
      setCourses(courseList);

      // Auto-select first course
      if (courseList.length > 0 && !selectedCourse) {
        handleSelectCourse(courseList[0]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCourse = async (course: Course) => {
    setSelectedCourse(course);
    setLoading(true);
    setRequestSent(false);
    try {
      const res = await fetch(`/api/academy/courses?courseId=${course.id}`).then(r => r.json()).catch(() => ({}));
      
      // Check if access is denied
      if (res && res.hasAccess === false) {
        setHasAccess(false);
        setAccessStatus(res.accessStatus || 'none');
        setLessons([]);
        setActiveLesson(null);
        return;
      }

      setHasAccess(true);
      setAccessStatus('granted');
      const lessonList: Lesson[] = Array.isArray(res) ? res : (res.lessons || []);
      setLessons(lessonList);

      // Pick first unlocked incomplete lesson, or first lesson
      const nextUp = lessonList.find(l => !l.isLocked && !l.isCompleted) || lessonList.find(l => !l.isLocked) || lessonList[0];
      if (nextUp && !nextUp.isLocked) {
        setActiveLesson(nextUp);
      } else {
        setActiveLesson(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendAccessRequest = async () => {
    if (!selectedCourse) return;
    setRequestLoading(true);
    try {
      await fetch('/api/academy/request-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          name: user?.name,
          customerCode: user?.customerCode,
          telegramUserId: user?.telegramUserId,
        }),
      });
      setRequestSent(true);
      setAccessStatus('pending');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleLessonCompleted = (lessonId: string) => {
    // Optimistically mark current lesson as completed and unlock next lesson in local state
    setLessons(prev => {
      const idx = prev.findIndex(l => l.id === lessonId);
      return prev.map((l, i) => {
        if (l.id === lessonId) return { ...l, isCompleted: true };
        if (idx !== -1 && i === idx + 1) return { ...l, isLocked: false };
        return l;
      });
    });

    // Refresh lessons lock/unlock state from server
    if (selectedCourse) {
      fetch(`/api/academy/courses?courseId=${selectedCourse.id}`)
        .then(r => r.json())
        .then(data => {
          const list = Array.isArray(data) ? data : (data?.lessons || []);
          if (list.length > 0) {
            setLessons(list);
          }
        })
        .catch(() => {});
    }

    // Refresh courses completion count
    fetch('/api/academy/courses')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setCourses(data);
      })
      .catch(() => {});
  };

  const handleNextLesson = () => {
    if (!activeLesson) return;
    const currentIndex = lessons.findIndex(l => l.id === activeLesson.id);
    if (currentIndex !== -1 && currentIndex + 1 < lessons.length) {
      const next = lessons[currentIndex + 1];
      setActiveLesson({ ...next, isLocked: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const currentLessonIndex = activeLesson ? lessons.findIndex(l => l.id === activeLesson.id) : -1;
  const hasNextLesson = currentLessonIndex !== -1 && currentLessonIndex + 1 < lessons.length;

  return (
    <div className="space-y-4 pb-24 animate-fade-in text-gray-900">
      
      {/* Top Header */}
      <div className="flex justify-between items-center px-1 pt-1">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎓</span>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">
              Yukla Go Akademiya
            </h1>
          </div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">
            Video Darslar & Amaliy Ko'nikmalar
          </p>
        </div>

        <div className="flex items-center gap-2">
          {user?.customerCode && (
            <div className="bg-primary/10 text-primary px-3 py-1.5 rounded-xl text-xs font-mono font-black border border-primary/20 shadow-sm">
              {user.customerCode}
            </div>
          )}
          {onBackToCargo && (
            <button
              onClick={onBackToCargo}
              className="px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 text-primary rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1 active:scale-95"
              title="Kargo buyurtmalariga qaytish"
            >
              <span>📦 Kargo</span>
              <span className="text-[10px]">&rarr;</span>
            </button>
          )}
        </div>
      </div>

      {/* Course Switcher (Horizontal Tabs) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 scroll-x-smooth">
        {courses.map(c => {
          const isSelected = selectedCourse?.id === c.id;
          const completed = c.completedLessonsCount || 0;
          const total = c.lessonsCount || 0;
          return (
            <button
              key={c.id}
              onClick={() => handleSelectCourse(c)}
              className={`p-3 rounded-2xl border text-left shrink-0 transition-all flex items-center gap-3 min-w-[220px] ${
                isSelected
                  ? 'bg-gradient-to-r from-[#185A96] to-[#114270] text-white border-transparent shadow-md'
                  : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-800'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                isSelected ? 'bg-white/10' : 'bg-gray-100'
              }`}>
                {c.icon || '📚'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-xs truncate leading-snug">{c.title}</p>
                <p className={`text-[10px] font-mono mt-0.5 ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                  {completed} / {total} dars yakunlandi
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* If unauthorized (no access to this course) */}
      {!hasAccess ? (
        <div className="bg-white rounded-3xl p-6 border border-amber-200/80 shadow-soft text-center space-y-4">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 text-amber-700 rounded-2xl flex items-center justify-center text-3xl mx-auto shadow-sm">
            🔒
          </div>

          <div className="space-y-1.5">
            <h3 className="font-black text-lg text-gray-900">
              Ushbu kursga kirish yopiq
            </h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              &laquo;{selectedCourse?.title || 'Video darslik'}&raquo; faqat admin tomonidan ruxsat berilgan talabalar uchun ochiq.
            </p>
          </div>

          {/* User Profile Card */}
          <div className="bg-gray-50 rounded-2xl p-3.5 border border-gray-100 flex items-center justify-between text-left max-w-sm mx-auto">
            <div>
              <p className="text-[10px] text-gray-400 font-bold uppercase">Sizning profilingiz</p>
              <p className="text-xs font-bold text-gray-800">
                {user?.name || 'Foydalanuvchi'}{' '}
                <span className="text-primary font-mono font-black">({user?.customerCode || 'YK-???'})</span>
              </p>
            </div>
            <div>
              {accessStatus === 'pending' || requestSent ? (
                <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-xl">
                  ⏳ Kutilmoqda
                </span>
              ) : (
                <span className="text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-xl border border-red-100">
                  🚫 Ruxsat yo'q
                </span>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 max-w-sm mx-auto space-y-2.5">
            {requestSent || accessStatus === 'pending' ? (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-xs text-blue-900 font-medium">
                ✅ So'rovingiz adminga yuborildi! Admin ruxsat berishi bilan Telegram botingiz orqali xabar olasiz.
              </div>
            ) : (
              <button
                onClick={handleSendAccessRequest}
                disabled={requestLoading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-[#185A96] to-[#114270] text-white rounded-2xl text-xs font-black shadow-md hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {requestLoading ? (
                  <span>Yuborilmoqda...</span>
                ) : (
                  <>
                    <span>📩 Admindan ruxsat so'rash</span>
                  </>
                )}
              </button>
            )}

            <a
              href="https://t.me/nothing_related"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs font-bold text-gray-500 hover:text-primary pt-1 transition-colors"
            >
              Admin bilan to'g'ridan-to'g'ri bog'lanish: <span className="text-primary font-mono underline">@nothing_related</span>
            </a>
          </div>
        </div>
      ) : (
        <>
          {/* Active Video Player Section */}
          {activeLesson && (
            <div className="space-y-3">
              <LessonPlayer
                lesson={activeLesson}
                user={user}
                onLessonCompleted={handleLessonCompleted}
                onNextLesson={handleNextLesson}
                hasNextLesson={hasNextLesson}
              />
            </div>
          )}

          {/* Course Lessons List */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-soft space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100">
              <div>
                <h3 className="font-black text-sm text-gray-900">
                  {selectedCourse?.title || 'Darslar ro\'yxati'}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Darslar ketma-ket tartibda ochiladi
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-xl">
                {lessons.filter(l => l.isCompleted).length} / {lessons.length}
              </span>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs font-bold text-gray-400">Yuklanmoqda...</div>
            ) : lessons.length === 0 ? (
              <div className="py-8 text-center text-xs font-bold text-gray-400">Bu kursda hali darslar yo'q</div>
            ) : (
              <div className="space-y-2">
                {lessons.map((l, index) => {
                  const isCurrent = activeLesson?.id === l.id;
                  const formatMin = Math.round(l.durationSeconds / 60);

                  return (
                    <div
                      key={l.id}
                      onClick={() => {
                        if (!l.isLocked) {
                          setActiveLesson(l);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        l.isLocked
                          ? 'bg-gray-50/70 border-gray-100 opacity-60 cursor-not-allowed'
                          : isCurrent
                          ? 'bg-blue-50/70 border-primary/40 shadow-sm cursor-pointer'
                          : 'bg-white hover:bg-gray-50 border-gray-100 cursor-pointer shadow-soft'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status Icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                          l.isCompleted
                            ? 'bg-green-100 text-green-700'
                            : l.isLocked
                            ? 'bg-gray-100 text-gray-400'
                            : isCurrent
                            ? 'bg-primary text-white shadow-sm'
                            : 'bg-blue-50 text-primary'
                        }`}>
                          {l.isCompleted ? (
                            '✓'
                          ) : l.isLocked ? (
                            '🔒'
                          ) : (
                            '▶'
                          )}
                        </div>

                        <div className="min-w-0">
                          <p className={`font-bold text-xs truncate ${
                            isCurrent ? 'text-primary' : 'text-gray-900'
                          }`}>
                            {l.title}
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                            <span>⏱ {formatMin} daqiqa</span>
                            {l.isLocked && <span className="text-amber-600 font-medium">• Oldingi darsni ko'ring</span>}
                            {l.isCompleted && <span className="text-green-600 font-medium">• Yakunlandi</span>}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {l.isCompleted ? (
                          <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-md border border-green-200">
                            Tayyor
                          </span>
                        ) : l.isLocked ? (
                          <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                            Qulflangan
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                            Ochilgan
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

    </div>
  );
};

export default AcademyApp;
