export default function Logo({ variant = 'icon' }) {
  const img = (
    <img
      src="/logo.png"
      alt="StudyLog"
      className="h-8 w-8 rounded-md object-contain"
    />
  );

  const text = (
    <span className="text-white font-semibold text-lg leading-none tracking-tight select-none">
      StudyLog
    </span>
  );

  if (variant === 'icon') return img;

  if (variant === 'splash') {
    return (
      <div className="flex flex-col items-center gap-4">
        {img}
        <span className="text-white font-semibold tracking-[0.12em] leading-none select-none">
          StudyLog
        </span>
      </div>
    );
  }

  // full (default)
  return (
    <div className="flex items-center gap-2.5">
      {img}
      {text}
    </div>
  );
}
