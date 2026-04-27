import { NavLink } from 'react-router-dom'
import { useCourses } from '../context/CoursesContext.jsx'
import { useTimer } from '../context/TimerContext.jsx'

const tabs = [
  {
    to: '/',
    label: 'Home',
    icon: (active) => active ? (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    to: '/session',
    label: 'Session',
    icon: (active) => active ? (
      <svg viewBox="0 0 24 24" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <polyline points="12 6 12 12 16 14" fill="none" stroke="var(--bg-card)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    icon: (active) => active ? (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <rect x="4" y="11" width="4" height="9" rx="1" />
        <rect x="10" y="5" width="4" height="15" rx="1" />
        <rect x="16" y="8" width="4" height="12" rx="1" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
        <rect x="4" y="11" width="4" height="9" rx="1" />
        <rect x="10" y="5" width="4" height="15" rx="1" />
        <rect x="16" y="8" width="4" height="12" rx="1" />
      </svg>
    ),
  },
  {
    to: '/courses',
    label: 'Courses',
    icon: (active) => active ? (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
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
  const { activeCourseCount } = useCourses()
  const timerRunning = phase === 'running'

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex items-center px-2 pb-safe"
      style={{ backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border)', height: '64px' }}
    >
      {tabs.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className="relative flex flex-1 flex-col items-center gap-1 px-2 py-2 rounded-xl transition-colors"
          style={({ isActive }) => ({ color: isActive ? 'var(--accent)' : 'var(--text-2)' })}
        >
          {({ isActive }) => (
            <>
              {/* Icon wrapper — with pulsing dot for Focus tab when timer running */}
              <span className="relative">
                {icon(isActive)}
                {to === '/session' && timerRunning && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-2px',
                      right: '-2px',
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent)',
                      animation: 'timerPulse 1.4s ease-in-out infinite',
                    }}
                  />
                )}
                {/* Courses count badge */}
                {to === '/courses' && activeCourseCount !== null && activeCourseCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-6px',
                      minWidth: '14px',
                      height: '14px',
                      borderRadius: '7px',
                      backgroundColor: 'var(--accent)',
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
                    {activeCourseCount}
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
