'use client';

import React, { useMemo } from 'react';

interface DraftTimerProps {
  seconds: number;
  running: boolean;
  onRunningChange: (running: boolean) => void;
  onSecondsChange: (seconds: number) => void;
  totalSeconds: number;
}

export function DraftTimer({
  seconds,
  running,
  onRunningChange,
  onSecondsChange,
  totalSeconds,
}: DraftTimerProps) {
  const isOvertime = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const minutes = Math.floor(absSeconds / 60);
  const secs = absSeconds % 60;
  const timeString = `${isOvertime ? '-' : ''}${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const timerColor = useMemo(() => {
    if (isOvertime) return '#dc2626';
    if (seconds === 0) return '#dc2626';
    if (seconds < 10) return '#ef4444';
    if (seconds < 30) return '#f97316';
    return 'var(--color-text)';
  }, [seconds, isOvertime]);

  const handleReset = () => {
    onRunningChange(false);
    onSecondsChange(totalSeconds);
  };

  return (
    <div className="flex items-center gap-1">
      {/* Play/Pause */}
      <button
        onClick={() => onRunningChange(!running)}
        className={`px-2 py-1.5 rounded text-sm font-medium transition-colors ${
          running
            ? 'text-red-500 hover:bg-red-500/10'
            : 'text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10'
        }`}
        title={running ? 'Pause' : 'Start'}
      >
        {running ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-2.5zM11.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h2.5a.75.75 0 00.75-.75V3.75a.75.75 0 00-.75-.75h-2.5z" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
          </svg>
        )}
      </button>

      {/* Time Display */}
      <span
        className="font-mono font-medium text-sm tabular-nums min-w-[52px] text-center px-1 py-1.5"
        style={{
          color: timerColor,
          animation: isOvertime ? 'timerBlink 1s ease-in-out infinite' : seconds === 0 ? 'timerBlink 0.6s ease-in-out infinite' : seconds < 10 && running ? 'timerPulse 1s ease-in-out infinite' : 'none',
        }}
      >
        {timeString}
      </span>

      {/* Reset */}
      <button
        onClick={handleReset}
        className="px-2 py-1.5 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)] transition-colors"
        title="Reset timer"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes timerPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes timerBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}} />
    </div>
  );
}

export default DraftTimer;
