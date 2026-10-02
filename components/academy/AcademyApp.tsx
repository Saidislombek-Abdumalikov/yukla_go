import React, { useState, useEffect } from 'react';
import type { Course, Lesson, UserProfile } from '../../types';
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
    try {
      const res = await fetch(`/api/academy/courses?courseId=${course.id}`).then(r => r.json()).catch(() => []);
      const lessonList: Lesson[] = Array.isArray(res) ? res : [];
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

  const handleLessonCompleted = (lessonId: string) => {
    // Refresh lessons lock/unlock state
    if (selectedCourse) {
      fetch(`/api/academy/courses?courseId=${selectedCourse.id}`)
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) {
            setLessons(data);
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
      if (!next.isLocked) {
        setActiveLesson(next);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
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

      {/* Course Switcher (Horizontal Tabs) */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
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

    </div>
  );
};

export default AcademyApp;
