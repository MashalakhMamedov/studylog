import { NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useTimer } from '../context/TimerContext.jsx'
import { supabase } from '../lib/supabase.js'

const tabs = [
  {
    to: '/',
    label: 'Home',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/timer',
    label: 'Focus',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: '/sessions',
    label: 'Log',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    to: '/resources',
    label: 'Materials',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    to: '/courses',
    label: 'Courses',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.5 : 2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const { phase } = useTimer()
  const timerRunning = phase === 'running'
  const [activeCourses, setActiveCourses] = useState(null)

  useEffect(() => {
    supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .then(({ count }) => {
        if (count !== null) setActiveCourses(count)
      })
  }, [])

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 pb-safe"
      style={{ backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border)', height: '64px' }}
    >
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors"
          style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--text-2)' })}
        >
          {({ isActive }) => (
            <>
              {/* Top indicator bar */}
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: isActive ? '24px' : '0px',
                  height: '2px',
                  borderRadius: '0 0 2px 2px',
                  backgroundColor: 'var(--accent)',
                  transition: 'width 0.2s ease',
                }}
              />

              {/* Icon wrapper — with pulsing dot for Focus tab when timer running */}
              <span className="relative">
                {icon(isActive)}
                {to === '/timer' && timerRunning && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: '#E63946',
                      animation: 'timerPulse 1.4s ease-in-out infinite',
                    }}
                  />
                )}
                {/* Courses count badge */}
                {to === '/courses' && activeCourses !== null && activeCourses > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      minWidth: '14px',
                      height: '14px',
                      borderRadius: '7px',
                      backgroundColor: '#E63946',
                      color: '#fff',
                      fontSize: '9px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      padding: '0 3px',
                    }}
                  >
                    {activeCourses}
                  </span>
                )}
              </span>

              <span style={{ fontSize: '11px', fontWeight: isActive ? 600 : 500 }}>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
