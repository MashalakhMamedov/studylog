import React from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function Logo({ variant = 'full', size = 32 }) {
  const { accentColor } = useTheme()
  if (variant === 'icon') {
    return (
      <img
        src="/logo.png"
        alt="StudyLog"
        style={{ height: size, width: size }}
        className="rounded-md object-contain"
      />
    );
  }

  if (variant === 'splash') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div
            className="absolute inset-0 rounded-full blur-2xl opacity-15"
            style={{ backgroundColor: accentColor }}
          />
          <img
            src="/logo.png"
            alt="StudyLog"
            style={{ height: size, width: size }}
            className="relative rounded-md object-contain"
          />
        </div>
        <span
          className="text-white font-semibold tracking-[0.12em]"
          style={{ fontSize: size * 0.28 }}
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
        className="rounded-md object-contain"
      />
      <span
        className="text-white font-semibold"
        style={{ fontSize: size * 0.6 }}
      >
        StudyLog
      </span>
    </div>
  );
}
