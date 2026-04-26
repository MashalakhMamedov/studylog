import { useContext } from 'react'
import { TimerContext, fmtTime } from '../context/TimerContext'
import { useNavigate, useLocation } from 'react-router-dom'

export default function FloatingTimer() {
  const { phase, totalSeconds, running, resetAll } = useContext(TimerContext)
  const navigate = useNavigate()
  const location = useLocation()

  const isOnFocusTab = location.pathname === '/session'

  if (phase !== 'running' || isOnFocusTab) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        backgroundColor: '#1a1a1d',
        border: '1px solid #2a2a2d',
        borderRadius: '999px',
        padding: '8px 14px 8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span
        onClick={() => navigate('/session')}
        style={{ color: '#ffffff', fontFamily: 'monospace', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <span style={{ fontSize: '11px', color: running ? '#E63946' : '#666' }}>⏱</span>
        {fmtTime(totalSeconds)}
        {!running && <span style={{ color: '#666', fontSize: '11px' }}>paused</span>}
      </span>
      <button
        onClick={e => { e.stopPropagation(); resetAll() }}
        style={{
          background: 'none',
          border: 'none',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '0.85rem',
          padding: '2px 4px',
          display: 'flex',
          alignItems: 'center',
        }}
        aria-label="Stop session"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '10px', height: '10px' }}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>
    </div>
  )
}
