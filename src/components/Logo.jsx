import React from 'react';

export default function Logo({ variant = 'full', size = 40 }) {
  if (variant === 'icon') {
    return (
      <img
        src="/logo.png"
        alt="StudyLog"
        style={{ height: size, width: size }}
        className="block object-contain"
      />
    );
  }

  if (variant === 'splash') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div>
          <img
            src="/logo.png"
            alt="StudyLog"
            style={{ height: size, width: size }}
            className="block object-contain"
          />
        </div>
        <span
          className="font-semibold"
          style={{ color: 'var(--text-1)', fontSize: size * 0.28, letterSpacing: '0.08em' }}
        >
          StudyLog
        </span>
      </div>
    );
  }

  // variant === "full" (default): icon + text side by side
  return (
    <div className="flex items-center gap-2">
      <img
        src="/logo.png"
        alt="StudyLog"
        style={{ height: size, width: size }}
        className="block object-contain"
      />
      <span
        className="font-semibold"
        style={{ color: 'var(--text-1)', fontSize: size * 0.6 }}
      >
        StudyLog
      </span>
    </div>
  );
}
