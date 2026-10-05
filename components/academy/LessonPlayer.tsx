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

  // States
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(lesson.lastPositionSeconds || 0);
  const [maxWatched, setMaxWatched] = useState(lesson.maxWatchedSeconds || 0);
  const [duration, setDuration] = useState(lesson.durationSeconds || 360);
  const [isCompleted, setIsCompleted] = useState(lesson.isCompleted);
  const [seekWarning, setSeekWarning] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Refs to avoid interval restart thrashing
  const maxWatchedRef = useRef(lesson.maxWatchedSeconds || 0);
  const isCompletedRef = useRef(lesson.isCompleted);
  const durationRef = useRef(lesson.durationSeconds || 360);
  const isSeekingLockRef = useRef(false);
  const isPlayingRef = useRef(false);
  const lastRoundedSecRef = useRef(-1);

  // Keep refs in sync
  useEffect(() => {
    maxWatchedRef.current = lesson.maxWatchedSeconds || 0;
    setMaxWatched(lesson.maxWatchedSeconds || 0);
    isCompletedRef.current = lesson.isCompleted;
    setIsCompleted(lesson.isCompleted);
    durationRef.current = lesson.durationSeconds || 360;
    setDuration(lesson.durationSeconds || 360);
    setCurrentTime(lesson.lastPositionSeconds || 0);
    setPlayerError(null);
  }, [lesson.id]);

  // Load YouTube IFrame API and Initialize Player
  useEffect(() => {
    let isMounted = true;
    let pollInterval: any = null;

    const setupPlayer = () => {
      if (!isMounted || !window.YT || !window.YT.Player) return;

      const initialStart = Math.min(
        lesson.lastPositionSeconds || 0,
        maxWatchedRef.current || 0
      );

      // If player already exists and is healthy, just load the new video for instant playback without lag!
      if (playerRef.current && typeof playerRef.current.cueVideoById === 'function') {
        try {
          playerRef.current.cueVideoById({
            videoId: lesson.youtubeVideoId,
            startSeconds: initialStart,
          });
          setIsPlayerReady(true);
          setPlayerError(null);
          return;
        } catch {
          // Fall through to rebuild if cue failed
        }
      }

      // Destroy old instance if needed
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }

      try {
        playerRef.current = new window.YT.Player(containerId, {
          videoId: lesson.youtubeVideoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            fs: 1,
            start: initialStart,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsPlayerReady(true);
              setPlayerError(null);
              // Read real video duration if available
              const d = event.target?.getDuration?.();
              if (d && d > 0) {
                const roundedD = Math.round(d);
                setDuration(roundedD);
                durationRef.current = roundedD;
              }
            },
            onStateChange: (event: any) => {
              if (!isMounted) return;
              // 1: PLAYING, 2: PAUSED, 0: ENDED
              if (event.data === 1) {
                setIsPlaying(true);
                isPlayingRef.current = true;
                // Update duration once playing
                const d = playerRef.current?.getDuration?.();
                if (d && d > 0) {
                  const roundedD = Math.round(d);
                  setDuration(roundedD);
                  durationRef.current = roundedD;
                }
              } else {
                setIsPlaying(false);
                isPlayingRef.current = false;
              }

              // Finished video
              if (event.data === 0) {
                triggerComplete();
              }
            },
            onError: (event: any) => {
              if (!isMounted) return;
              const code = event.data;
              if (code === 101 || code === 150) {
                setPlayerError("Ushbu video egasi uni boshqa saytlarda (embed) ko'rishga ruxsat bermagan. YouTube Studio'da 'Allow embedding' sozlamasini yoqing.");
              } else if (code === 100 || code === 105) {
                setPlayerError("Video topilmadi yoki YouTube'da 'Private' qilib qo'yilgan. Uni 'Unlisted' ga o'zgartiring.");
              } else if (code === 2) {
                setPlayerError("Noto'g'ri YouTube video ID yoki havola.");
              } else {
                setPlayerError("Video yuklashda xatolik yuz berdi.");
              }
            },
          },
        });
      } catch (e) {
        console.error('Failed to init YT player:', e);
      }
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      if (!document.getElementById('youtube-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'youtube-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
      }

      const prevReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prevReady) prevReady();
        setupPlayer();
      };

      pollInterval = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(pollInterval);
          setupPlayer();
        }
      }, 300);
    }

    return () => {
      isMounted = false;
      if (pollInterval) clearInterval(pollInterval);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {}
        playerRef.current = null;
      }
    };
  }, [lesson.id, lesson.youtubeVideoId]);

  // High-performance Monitor Loop (Single interval, Zero thrashing)
  useEffect(() => {
    const monitorInterval = setInterval(() => {
      if (!playerRef.current || typeof playerRef.current.getCurrentTime !== 'function') return;

      try {
        const curr = playerRef.current.getCurrentTime();
        if (typeof curr !== 'number' || isNaN(curr)) return;

        const rounded = Math.floor(curr);
        if (rounded !== lastRoundedSecRef.current) {
          lastRoundedSecRef.current = rounded;
          setCurrentTime(curr);
        }

        // FORWARD-SEEK CLAMPING (ANTI-CHEAT):
        // If user scrubs forward beyond maxWatched + 2.5s and not completed
        if (curr > maxWatchedRef.current + 2.5 && !isCompletedRef.current) {
          if (!isSeekingLockRef.current) {
            isSeekingLockRef.current = true;
            playerRef.current.seekTo(maxWatchedRef.current, true);
            setSeekWarning("⚠️ Darsni oldinga o'tkazish cheklangan. Darsni ketma-ket ko'rishingiz lozim.");
            setTimeout(() => {
              isSeekingLockRef.current = false;
            }, 600);
            setTimeout(() => {
              setSeekWarning(null);
            }, 3000);
          }
          return;
        }

        // Natural progress advance
        if (curr > maxWatchedRef.current) {
          maxWatchedRef.current = curr;
          setMaxWatched(curr);
        }

        // Completion threshold: 95% of duration
        const targetDuration = durationRef.current || lesson.durationSeconds || 360;
        if (curr >= targetDuration * 0.95 && !isCompletedRef.current) {
          triggerComplete();
        }
      } catch {}
    }, 450);

    return () => clearInterval(monitorInterval);
  }, [lesson.id]);

  // Periodic Server Progress Heartbeat (Every 5 seconds while playing)
  useEffect(() => {
    if (!isPlaying) return;

    const heartbeat = setInterval(() => {
      syncProgressToServer(maxWatchedRef.current, isCompletedRef.current);
    }, 5000);

    return () => clearInterval(heartbeat);
  }, [isPlaying, lesson.id]);

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

  const triggerComplete = () => {
    if (isCompletedRef.current) return;
    isCompletedRef.current = true;
    setIsCompleted(true);
    const targetDur = durationRef.current || lesson.durationSeconds || 360;
    syncProgressToServer(targetDur, true);
    onLessonCompleted(lesson.id);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const effectiveDuration = duration || lesson.durationSeconds || 360;
  const progressPercent = Math.min(
    100,
    Math.round((maxWatched / (effectiveDuration || 1)) * 100)
  );

  const watermarkText = `${user?.customerCode || 'YK-100'} • ${user?.name || 'Mijoz'}`;

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Player Container with 16:9 Aspect Ratio */}
      <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-gray-800 group">
        
        {/* YouTube IFrame target element */}
        <div id={containerId} className="w-full h-full pointer-events-auto" />

        {/* Floating Moving Watermark (GPU-Accelerated 60fps) */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          <div className="watermark-drift absolute top-0 left-0 text-white/35 text-[10px] sm:text-xs font-mono font-black tracking-widest uppercase select-none px-2.5 py-1 rounded bg-black/25 backdrop-blur-[2px] border border-white/10 shadow-sm will-change-transform">
            {watermarkText}
          </div>
        </div>

        {/* Error Fallback Card if video fails to embed */}
        {playerError && (
          <div className="absolute inset-0 z-30 bg-gray-900/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl">
              ⚠️
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="font-bold text-sm">Videoni yuklab bo'lmadi</h4>
              <p className="text-xs text-gray-300 leading-relaxed">{playerError}</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={`https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <span>▶️ YouTube'da ko'rish</span>
              </a>
              <button
                onClick={() => {
                  setPlayerError(null);
                  window.location.reload();
                }}
                className="px-3.5 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all"
              >
                Qayta yuklash
              </button>
            </div>
          </div>
        )}

        {/* Seek Warning Overlay */}
        {seekWarning && (
          <div className="absolute top-3 left-3 right-3 z-30 animate-slide-up pointer-events-none">
            <div className="bg-red-600/90 backdrop-blur-md text-white text-xs font-bold py-2.5 px-3.5 rounded-xl shadow-lg text-center border border-red-500/30">
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
          <span className="text-gray-900 truncate max-w-[70%]">{lesson.title}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 ${
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
          <span>{formatSeconds(currentTime)} / {formatSeconds(effectiveDuration)}</span>
          <span className="text-gray-500 font-sans font-medium text-right">
            {isCompleted ? 'Keyingi dars ochildi!' : 'Keyingi dars ochilishi uchun darsni to\'liq ko\'ring'}
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

      {/* GPU-Accelerated Hardware Animation (Zero CPU Lag) */}
      <style>{`
        @keyframes watermarkDriftGPU {
          0% { transform: translate3d(20px, 15px, 0); }
          25% { transform: translate3d(calc(100% - 180px), 110px, 0); }
          50% { transform: translate3d(calc(100% - 150px), 30px, 0); }
          75% { transform: translate3d(30px, 120px, 0); }
          100% { transform: translate3d(20px, 15px, 0); }
        }
        .watermark-drift {
          animation: watermarkDriftGPU 32s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LessonPlayer;
