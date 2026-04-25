export function SkeletonBlock({ className = '', style }) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={style}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard({ height = 72, radius = 12, className = '' }) {
  return (
    <SkeletonBlock
      className={`w-full ${className}`}
      style={{ height: `${height}px`, borderRadius: `${radius}px` }}
    />
  )
}
