import React, { useState, useEffect, useRef } from 'react';
import type { Lesson, UserProfile } from '../../types';

interface LessonPlayerProps {
  lesson: Lesson;
  user: UserProfile | null;
  onLessonCompleted: (lessonId: string) => void;
  onNextLesson?: () => void;
  hasNextLesson?: boolean;
}

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const LessonPlayer: React.FC<LessonPlayerProps> = ({
  lesson,
  user,
  onLessonCompleted,
  onNextLesson,
  hasNextLesson = false,
}) => {
  const containerId = `yt_player_${lesson.id}`;
  const playerRef = useRef<any>(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(lesson.lastPositionSeconds || 0);
  const [maxWatched, setMaxWatched] = useState(lesson.maxWatchedSeconds || 0);
  const [isCompleted, setIsCompleted] = useState(lesson.isCompleted);
  const [seekWarning, setSeekWarning] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync state if lesson changes
  useEffect(() => {
    setMaxWatched(lesson.maxWatchedSeconds || 0);
    setCurrentTime(lesson.lastPositionSeconds || 0);
    setIsCompleted(lesson.isCompleted);
  }, [lesson.id]);

  // Load YouTube IFrame API script
  useEffect(() => {
    let checkInterval: any = null;

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      // Destroy previous instance if exists
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
      }

      const initialStart = Math.min(lesson.lastPositionSeconds || 0, lesson.maxWatchedSeconds || 0);

      playerRef.current = new window.YT.Player(containerId, {
        videoId: lesson.youtubeVideoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          start: initialStart,
        },
        events: {
          onReady: () => {
            setIsPlayerReady(true);
          },
          onStateChange: (event: any) => {
            // 1: PLAYING, 2: PAUSED, 0: ENDED
            if (event.data === 1) {
              setIsPlaying(true);
            } else {
              setIsPlaying(false);
            }

            if (event.data === 0) {
              handleComplete();
            }
          },
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      if (!document.getElementById('youtube-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };

      checkInterval = setInterval(() => {
        if (window.YT && window.YT.Player && !isPlayerReady) {
          initPlayer();
          clearInterval(checkInterval);
        }
      }, 500);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [lesson.id, lesson.youtubeVideoId]);

  // Strict Forward-Seek Protection & Max Time Tracker
  useEffect(() => {
    const monitorInterval = setInterval(() => {
      if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      try {
        const curr = playerRef.current.getCurrentTime();
        if (typeof curr !== 'number' || isNaN(curr)) return;

        setCurrentTime(curr);

        // FORWARD-SEEK PREVENTION:
        // If user tries to skip ahead further than they have already watched (+ 2.5s buffer)
        if (curr > maxWatched + 2.5 && !isCompleted) {
          // Snap back immediately!
          playerRef.current.seekTo(maxWatched, true);
          setSeekWarning("⚠️ Darsni oldinga o'tkazish taqiqlangan! Darsni to'liq ko'rishingiz lozim.");
          setTimeout(() => setSeekWarning(null), 3000);
          return;
        }

        // If advancing naturally, update max watched time
        if (curr > maxWatched) {
          setMaxWatched(curr);
        }

        // Check if reached completion threshold (95% of video)
        if (curr >= lesson.durationSeconds * 0.95 && !isCompleted) {
          handleComplete();
        }
      } catch {}
    }, 400);

    return () => clearInterval(monitorInterval);
  }, [maxWatched, isCompleted, lesson.durationSeconds]);

  // Periodic Server Progress Heartbeat (Every 5 seconds while playing)
  useEffect(() => {
    if (!isPlaying) return;

    const heartbeat = setInterval(() => {
      syncProgressToServer(maxWatched, isCompleted);
    }, 5000);

    return () => clearInterval(heartbeat);
  }, [isPlaying, maxWatched, isCompleted]);

  const syncProgressToServer = async (watchedSec: number, completedState: boolean) => {
    try {
      await fetch('/api/academy/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          watchedSeconds: Math.floor(watchedSec),
          completed: completedState,
        }),
      });
    } catch {}
  };

  const handleComplete = () => {
    if (isCompleted) return;
    setIsCompleted(true);
    syncProgressToServer(lesson.durationSeconds, true);
    onLessonCompleted(lesson.id);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = Math.min(
    100,
    Math.round((maxWatched / (lesson.durationSeconds || 1)) * 100)
  );

  const watermarkText = `${user?.customerCode || 'YK-100'} • ${user?.name || 'Mijoz'}`;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Player Container with Aspect Ratio */}
      <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800 group">
        
        {/* YouTube IFrame target element */}
        <div id={containerId} className="w-full h-full pointer-events-auto" />

        {/* Floating Moving Watermark (Anti-Leak Protection) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          <div className="watermark-drift absolute text-white/30 text-[10px] sm:text-xs font-mono font-black tracking-widest uppercase select-none px-2 py-0.5 rounded bg-black/20 backdrop-blur-[1px] border border-white/10">
            {watermarkText}
          </div>
        </div>

        {/* Seek Warning Overlay */}
        {seekWarning && (
          <div className="absolute top-3 left-3 right-3 z-30 animate-slide-up pointer-events-none">
            <div className="bg-red-600/90 backdrop-blur-md text-white text-xs font-bold py-2 px-3 rounded-xl shadow-lg text-center">
              {seekWarning}
            </div>
          </div>
        )}

        {/* Completion Banner */}
        {isCompleted && (
          <div className="absolute bottom-2 right-2 z-20 pointer-events-none">
            <span className="bg-green-600/90 text-white text-[10px] font-black uppercase px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm flex items-center gap-1">
              ✓ Dars yakunlandi
            </span>
          </div>
        )}
      </div>

      {/* Progress & Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-soft space-y-2">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-gray-900">{lesson.title}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] ${
            isCompleted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-primary'
          }`}>
            {isCompleted ? '✅ Yakunlangan' : `${progressPercent}% ko'rildi`}
          </span>
        </div>

        {/* Custom Progress Bar */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 rounded-full ${
              isCompleted ? 'bg-green-600' : 'bg-primary'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-gray-400 font-mono">
          <span>{formatSeconds(currentTime)} / {formatSeconds(lesson.durationSeconds)}</span>
          <span className="text-gray-500 font-sans font-medium">
            {isCompleted ? 'Keyingi dars ochildi!' : 'Keyingi dars ochilishi uchun darsni oxirigacha ko\'ring'}
          </span>
        </div>

        {/* Next Lesson Action */}
        {isCompleted && hasNextLesson && onNextLesson && (
          <div className="pt-2">
            <button
              onClick={onNextLesson}
              className="w-full py-3 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all"
            >
              <span>Keyingi darsga o'tish</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Embedded CSS for Floating Drift Animation */}
      <style>{`
        @keyframes watermarkDrift {
          0% { top: 10%; left: 10%; }
          25% { top: 60%; left: 60%; }
          50% { top: 20%; left: 75%; }
          75% { top: 70%; left: 20%; }
          100% { top: 10%; left: 10%; }
        }
        .watermark-drift {
          animation: watermarkDrift 28s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
};

export default LessonPlayer;
