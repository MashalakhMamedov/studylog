import { useState, useRef } from 'react'
import { useTheme } from '../context/ThemeContext.jsx'

const REVEAL_W = 68

export default function SwipeableRow({ onDelete, children, bg = 'var(--bg-card)' }) {
  const { accentColor } = useTheme()
  const [dx, setDx] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const startX = useRef(null)

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX
    setSwiping(true)
  }

  function onTouchMove(e) {
    if (startX.current === null) return
    const diff = startX.current - e.touches[0].clientX
    setDx(Math.max(0, Math.min(REVEAL_W, diff)))
  }

  function onTouchEnd() {
    startX.current = null
    setSwiping(false)
    setDx(prev => (prev > REVEAL_W / 2 ? REVEAL_W : 0))
  }

  return (
    <div className="relative overflow-hidden">
      {/* Delete zone revealed on swipe */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center"
        style={{ width: `${REVEAL_W}px`, backgroundColor: accentColor }}
      >
        <button
          onClick={onDelete}
          className="flex items-center justify-center w-full h-full"
          aria-label="Delete"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" className="w-5 h-5">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6M9 6V4h6v2" />
          </svg>
        </button>
      </div>

      {/* Sliding content */}
      <div
        style={{
          transform: `translateX(-${dx}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease',
          backgroundColor: bg,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}
