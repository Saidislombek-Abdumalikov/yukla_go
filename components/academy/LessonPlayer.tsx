import React, { useState, useEffect, useRef } from 'react';
import type { Lesson, UserProfile } from '../../types';
import { adminFetch } from '../../services/api';

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
  const playerBoxRef = useRef<HTMLDivElement>(null);

  // Playback States
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(lesson.lastPositionSeconds || 0);
  const [maxWatched, setMaxWatched] = useState(lesson.maxWatchedSeconds || 0);
  const [duration, setDuration] = useState(lesson.durationSeconds || 360);
  const [isCompleted, setIsCompleted] = useState(lesson.isCompleted);
  const [seekWarning, setSeekWarning] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // Security & Custom Controls States
  const [showControls, setShowControls] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isScreenShieldActive, setIsScreenShieldActive] = useState(false);
  const hideControlsTimerRef = useRef<any>(null);

  // Refs for high-performance monitor loop
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

  // Anti-Screen Recording & Visibility Protection Listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App backgrounded or screen capture started
        if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
          try {
            playerRef.current.pauseVideo();
          } catch {}
        }
        setIsPlaying(false);
        setIsScreenShieldActive(true);
      }
    };

    const handleWindowBlur = () => {
      // User switched window or pulled down notification/screen recording shade
      if (playerRef.current && typeof playerRef.current.pauseVideo === 'function') {
        try {
          playerRef.current.pauseVideo();
        } catch {}
      }
      setIsPlaying(false);
      setIsScreenShieldActive(true);
    };

    // Block inspect and shortcut keys
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'PrintScreen' ||
        e.key === 'F12' ||
        (e.ctrlKey && (e.key === 's' || e.key === 'u' || e.key === 'p' || e.key === 'c'))
      ) {
        e.preventDefault();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Listen for native Fullscreen API changes
  useEffect(() => {
    const handleFsChange = () => {
      const isFull = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    document.addEventListener('mozfullscreenchange', handleFsChange);
    document.addEventListener('MSFullscreenChange', handleFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
      document.removeEventListener('mozfullscreenchange', handleFsChange);
      document.removeEventListener('MSFullscreenChange', handleFsChange);
    };
  }, []);

  // Controls Auto-Hide timer (Fast and snappy: 1300ms)
  const scheduleControlsHide = () => {
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    setShowControls(true);
    hideControlsTimerRef.current = setTimeout(() => {
      if (isPlayingRef.current) {
        setShowControls(false);
      }
    }, 1300);
  };

  const handlePlayerContainerClick = () => {
    if (!showControls) {
      scheduleControlsHide();
    } else {
      togglePlayPause();
    }
  };

  const togglePlayPause = () => {
    if (!playerRef.current) return;
    try {
      if (isPlayingRef.current) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        isPlayingRef.current = false;
        setShowControls(true);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
        isPlayingRef.current = true;
        scheduleControlsHide();
      }
    } catch {}
  };

  const handleRewind10 = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playerRef.current) return;
    const target = Math.max(0, currentTime - 10);
    playerRef.current.seekTo(target, true);
    setCurrentTime(target);
    scheduleControlsHide();
  };

  const handleForward10 = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playerRef.current) return;
    const target = Math.min(maxWatchedRef.current, currentTime + 10);
    if (currentTime + 10 > maxWatchedRef.current && !isCompletedRef.current) {
      setSeekWarning("⚠️ Darsni oldinga o'tkazish cheklangan. Darsni to'liq ko'rishingiz lozim.");
      setTimeout(() => setSeekWarning(null), 2500);
      return;
    }
    playerRef.current.seekTo(target, true);
    setCurrentTime(target);
    scheduleControlsHide();
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!playerRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch {}
    scheduleControlsHide();
  };

  const toggleFullscreen = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const box = playerBoxRef.current;
    try {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );

      if (!isCurrentlyFullscreen && box) {
        // Expand Telegram WebApp if supported
        try { (window as any).Telegram?.WebApp?.expand?.(); } catch {}

        if (box.requestFullscreen) {
          await box.requestFullscreen();
        } else if ((box as any).webkitRequestFullscreen) {
          await (box as any).webkitRequestFullscreen();
        } else if ((box as any).mozRequestFullScreen) {
          await (box as any).mozRequestFullScreen();
        } else if ((box as any).msRequestFullscreen) {
          await (box as any).msRequestFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        } else {
          setIsFullscreen(false);
        }
      }
    } catch {
      // In mobile webviews that disallow requestFullscreen, toggle CSS state
      setIsFullscreen(prev => !prev);
    }
    scheduleControlsHide();
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!playerRef.current) return;

    if (val > maxWatchedRef.current + 2 && !isCompletedRef.current) {
      setSeekWarning("⚠️ Darsni oldinga o'tkazish cheklangan.");
      setTimeout(() => setSeekWarning(null), 2500);
      playerRef.current.seekTo(maxWatchedRef.current, true);
      setCurrentTime(maxWatchedRef.current);
      return;
    }

    playerRef.current.seekTo(val, true);
    setCurrentTime(val);
    scheduleControlsHide();
  };

  // Load YouTube IFrame API and Initialize Protected Player
  useEffect(() => {
    let isMounted = true;
    let pollInterval: any = null;

    const setupPlayer = () => {
      if (!isMounted || !window.YT || !window.YT.Player) return;

      const initialStart = Math.min(
        lesson.lastPositionSeconds || 0,
        maxWatchedRef.current || 0
      );

      // If player already exists, cue new video
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
          // Rebuild on error
        }
      }

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
            controls: 0, // HIDE ALL YOUTUBE CONTROLS, SHARE BUTTONS & LOGOS
            rel: 0, // No external recommendations
            modestbranding: 1, // Remove branding
            playsinline: 1, // Mobile inline playback
            iv_load_policy: 3, // Disable annotations
            fs: 0, // Disable native YouTube fullscreen (no link leak)
            disablekb: 1, // Disable keyboard hotkeys
            cc_load_policy: 0, // DISABLING SUBTITLES / CAPTIONS
            cc_lang_pref: 'none',
            hl: 'uz',
            start: initialStart,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return;
              setIsPlayerReady(true);
              setPlayerError(null);
              // Explicitly turn off closed captions / subtitles module
              try {
                if (typeof event.target?.unloadModule === 'function') {
                  event.target.unloadModule('captions');
                  event.target.unloadModule('cc');
                }
                if (typeof event.target?.setOption === 'function') {
                  event.target.setOption('captions', 'track', {});
                }
              } catch {}
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
                scheduleControlsHide();
                const d = playerRef.current?.getDuration?.();
                if (d && d > 0) {
                  const roundedD = Math.round(d);
                  setDuration(roundedD);
                  durationRef.current = roundedD;
                }
              } else {
                setIsPlaying(false);
                isPlayingRef.current = false;
                setShowControls(true);
              }

              if (event.data === 0) {
                triggerComplete();
              }
            },
            onError: (event: any) => {
              if (!isMounted) return;
              const code = event.data;
              if (code === 101 || code === 150) {
                setPlayerError("Ushbu video egasi uni boshqa saytlarda ko'rishga ruxsat bermagan. YouTube Studio'da 'Allow embedding' sozlamasini yoqing.");
              } else if (code === 100 || code === 105) {
                setPlayerError("Video topilmadi yoki 'Private' holatida. Uni 'Unlisted' ga o'zgartiring.");
              } else {
                setPlayerError("Video yuklashda xatolik yuz berdi. Internet aloqasini tekshiring.");
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

  // High-performance Monitor Loop (Anti-cheat & Progress)
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

        // Advance natural watched progress
        if (curr > maxWatchedRef.current) {
          maxWatchedRef.current = curr;
          setMaxWatched(curr);
        }

        // 95% threshold triggers completion
        const targetDuration = durationRef.current || lesson.durationSeconds || 360;
        if (curr >= targetDuration * 0.95 && !isCompletedRef.current) {
          triggerComplete();
        }
      } catch {}
    }, 450);

    return () => clearInterval(monitorInterval);
  }, [lesson.id]);

  // Periodic Server Heartbeat (Every 5 seconds while playing)
  useEffect(() => {
    if (!isPlaying) return;

    const heartbeat = setInterval(() => {
      syncProgressToServer(maxWatchedRef.current, isCompletedRef.current);
    }, 5000);

    return () => clearInterval(heartbeat);
  }, [isPlaying, lesson.id]);

  const syncProgressToServer = async (watchedSec: number, completedState: boolean) => {
    try {
      await adminFetch('/api/academy/progress', {
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

  // Dynamic micro-badge watermark text (Subtle, clean, non-intrusive)
  const tgId = user?.telegramUserId || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '';
  const customerCode = user?.customerCode || '';
  const watermarkText = tgId ? `ID:${tgId} • ${customerCode}` : (customerCode || 'YUKLA');

  return (
    <div className="space-y-3 animate-fade-in select-none" onContextMenu={e => e.preventDefault()}>
      
      {/* Player Box Container */}
      <div 
        ref={playerBoxRef}
        onClick={handlePlayerContainerClick}
        className={`relative w-full bg-black overflow-hidden shadow-2xl border border-gray-800 transition-all ${
          isFullscreen 
            ? 'fixed inset-0 z-50 rounded-none w-screen h-screen flex items-center justify-center' 
            : 'aspect-video rounded-3xl'
        }`}
      >
        {/* Protected YouTube IFrame Target (POINTER-EVENTS DISABLED TO PREVENT LINK LEAKS) */}
        <div id={containerId} className="w-full h-full pointer-events-none select-none scale-[1.01]" />

        {/* Dynamic GPU-Accelerated Drifting Micro Watermark */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          <div className="watermark-drift absolute top-0 left-0 text-white/30 text-[8px] sm:text-[9px] font-mono tracking-wider uppercase select-none px-2 py-0.5 rounded-md bg-black/25 backdrop-blur-[1px] border border-white/5 shadow-sm will-change-transform">
            {watermarkText}
          </div>
        </div>

        {/* Interactive Custom Controls Overlay */}
        <div 
          className={`absolute inset-0 z-20 flex flex-col justify-between p-4 bg-gradient-to-t from-black/85 via-transparent to-black/50 transition-opacity duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Top Bar: Title & In-App Fullscreen Toggle */}
          <div className="flex items-center justify-between text-white" onClick={e => e.stopPropagation()}>
            <span className="text-xs font-bold truncate max-w-[80%] drop-shadow">
              {lesson.title}
            </span>
            <button
              onClick={toggleFullscreen}
              className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center text-xs font-bold transition-all active:scale-95"
              title={isFullscreen ? "Kichik ekran" : "To'liq ekran"}
            >
              {isFullscreen ? '✕' : '⛶'}
            </button>
          </div>

          {/* Center Controls: Rewind 10s, Play/Pause, Forward 10s */}
          <div className="flex items-center justify-center gap-6 text-white my-auto" onClick={e => e.stopPropagation()}>
            <button
              onClick={handleRewind10}
              className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center text-sm font-bold transition-all active:scale-90"
              title="10 soniya orqaga"
            >
              ↺ 10
            </button>

            <button
              onClick={togglePlayPause}
              className="w-16 h-16 rounded-full bg-primary hover:bg-primary-dark text-white flex items-center justify-center text-2xl font-bold shadow-xl shadow-primary/30 transition-all active:scale-90"
              title={isPlaying ? "Pauza" : "Ijro etish"}
            >
              {isPlaying ? '⏸' : '▶️'}
            </button>

            <button
              onClick={handleForward10}
              className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md flex items-center justify-center text-sm font-bold transition-all active:scale-90"
              title="10 soniya oldinga"
            >
              ↻ 10
            </button>
          </div>

          {/* Bottom Bar: Scrubber, Timers & Audio Mute */}
          <div className="space-y-2" onClick={e => e.stopPropagation()}>
            {/* Custom Range Scrubber */}
            <div className="relative w-full flex items-center">
              <input
                type="range"
                min={0}
                max={effectiveDuration}
                step={1}
                value={currentTime}
                onChange={handleScrubberChange}
                className="w-full h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-white/90 font-mono">
              <div className="flex items-center gap-2">
                <span>{formatSeconds(currentTime)} / {formatSeconds(effectiveDuration)}</span>
                <button
                  onClick={toggleMute}
                  className="px-2 py-0.5 rounded bg-white/15 hover:bg-white/25 text-[10px] font-sans font-bold"
                >
                  {isMuted ? '🔇 Ovoz o\'chiq' : '🔊 Ovoz yoqiq'}
                </button>
              </div>

              {isCompleted && (
                <span className="text-green-400 font-sans font-bold text-[10px] bg-green-950/60 px-2 py-0.5 rounded-full border border-green-500/30">
                  ✓ Yakunlandi
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Anti-Screen Recording & Blackout Shield */}
        {isScreenShieldActive && (
          <div className="absolute inset-0 z-40 bg-black flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-3xl shadow-lg border border-amber-500/30">
              🔒
            </div>
            <div className="space-y-1 max-w-xs">
              <h4 className="font-black text-sm tracking-wide">Xavfsizlik Himoyasi Faol</h4>
              <p className="text-xs text-gray-400 leading-relaxed">
                Video faqat Telegram ilovasi ichida ko'rish uchun mo'ljallangan. Ekran yozish yoki ilovadan chiqish vaqtida video to'xtatiladi.
              </p>
            </div>
            <button
              onClick={() => {
                setIsScreenShieldActive(false);
                if (playerRef.current && typeof playerRef.current.playVideo === 'function') {
                  try {
                    playerRef.current.playVideo();
                    setIsPlaying(true);
                    isPlayingRef.current = true;
                  } catch {}
                }
              }}
              className="px-5 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold shadow-md shadow-primary/30 transition-all active:scale-95"
            >
              ▶️ Darsni davom ettirish
            </button>
          </div>
        )}

        {/* Error Fallback Card (WITHOUT any external YouTube links) */}
        {playerError && (
          <div className="absolute inset-0 z-40 bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center text-2xl border border-red-500/30">
              ⚠️
            </div>
            <div className="space-y-1 max-w-sm">
              <h4 className="font-bold text-sm">Videoni yuklab bo'lmadi</h4>
              <p className="text-xs text-gray-400 leading-relaxed">{playerError}</p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => {
                  setPlayerError(null);
                  window.location.reload();
                }}
                className="px-4 py-2 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                Qayta yuklash
              </button>
            </div>
          </div>
        )}

        {/* Forward Seek Warning Overlay */}
        {seekWarning && (
          <div className="absolute top-3 left-3 right-3 z-30 animate-slide-up pointer-events-none">
            <div className="bg-red-600/95 backdrop-blur-md text-white text-xs font-bold py-2.5 px-3.5 rounded-xl shadow-lg text-center border border-red-500/30">
              {seekWarning}
            </div>
          </div>
        )}
      </div>

      {/* Progress Card below video */}
      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-soft space-y-2">
        <div className="flex justify-between items-center text-xs font-bold">
          <span className="text-gray-900 truncate max-w-[70%]">{lesson.title}</span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] shrink-0 font-bold ${
            isCompleted ? 'bg-green-100 text-green-700' : 'bg-primary/10 text-primary'
          }`}>
            {isCompleted ? '✅ Yakunlangan' : `${progressPercent}% ko'rildi`}
          </span>
        </div>

        {/* Horizontal Progress Bar */}
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
          <span className="text-gray-500 font-sans font-medium text-right text-[10px]">
            {isCompleted ? 'Keyingi dars ochiq!' : 'Keyingi dars ochilishi uchun darsni oxirigacha ko\'ring'}
          </span>
        </div>

        {/* Next Lesson Action */}
        {isCompleted && hasNextLesson && onNextLesson && (
          <div className="pt-2">
            <button
              onClick={onNextLesson}
              className="w-full py-3.5 bg-primary hover:bg-primary-dark text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-primary/20 active:scale-95 transition-all"
            >
              <span>Keyingi darsga o'tish</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* GPU-Accelerated Hardware Animation (Zero Lag, Subtle Drift) */}
      <style>{`
        @keyframes watermarkDriftGPU {
          0% { transform: translate3d(10px, 10px, 0); }
          25% { transform: translate3d(calc(100% - 130px), 48px, 0); }
          50% { transform: translate3d(calc(100% - 130px), 12px, 0); }
          75% { transform: translate3d(12px, 54px, 0); }
          100% { transform: translate3d(10px, 10px, 0); }
        }
        .watermark-drift {
          animation: watermarkDriftGPU 36s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default LessonPlayer;
