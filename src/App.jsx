import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { useTheme } from './context/ThemeContext.jsx'
import { TimerProvider, useTimer, fmtTime } from './context/TimerContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BottomNav from './components/BottomNav.jsx'
import Home from './pages/Home.jsx'
import Session from './pages/Session.jsx'
import StatsPage from './pages/StatsPage.jsx'
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import Quiz from './pages/Quiz.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'

function FloatingTimerPill() {
  const { phase, totalSeconds, running, resetAll } = useTimer()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (phase !== 'running' || pathname === '/session') return null

  return (
    <div
      onClick={() => navigate('/session')}
      style={{
        position: 'fixed',
        bottom: '72px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 45,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 14px 8px 16px',
        backgroundColor: '#1a1a1d',
        border: '1px solid #2a2a2d',
        borderRadius: '999px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.55)',
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: '12px', color: running ? '#E63946' : '#666' }}>⏱</span>
      <span
        style={{
          color: '#fff',
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: '0.02em',
        }}
      >
        {fmtTime(totalSeconds)}
      </span>
      {!running && (
        <span style={{ color: '#666', fontSize: '11px' }}>paused</span>
      )}
      <button
        onClick={e => { e.stopPropagation(); resetAll() }}
        aria-label="Stop session"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.1)',
          border: 'none',
          color: 'rgba(255,255,255,0.55)',
          cursor: 'pointer',
          flexShrink: 0,
          marginLeft: '2px',
          padding: 0,
        }}
      >
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: '9px', height: '9px' }}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      </button>
    </div>
  )
}

const PAGE_TITLES = {
  '/session':  'Session',
  '/stats':    'Stats',
  '/courses':  'Courses',
  '/quiz':     'Quiz',
  '/settings': 'Settings',
}

function PageTitleBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const title = PAGE_TITLES[pathname]
  if (!title) return null

  return (
    <div
      className="flex items-center gap-2 px-4"
      style={{
        height: '52px',
        borderBottom: '1px solid var(--border)',
        backgroundColor: 'var(--bg)',
      }}
    >
      {(pathname === '/quiz' || pathname === '/settings') && (
        <button
          onClick={() => navigate(-1)}
          className="flex items-center justify-center w-7 h-7 -ml-1 rounded-lg"
          style={{ color: 'var(--text-2)' }}
          aria-label="Back"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      <h1 className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h1>
    </div>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const { phase } = useTimer()
  const isAuth = pathname === '/login'
  const showPill = phase === 'running' && pathname !== '/session' && !isAuth

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: isAuth ? '0' : showPill ? '120px' : '64px',
        }}
      >
        <div className="max-w-lg mx-auto">
          {!isAuth && <PageTitleBar />}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/session" element={<ProtectedRoute><Session /></ProtectedRoute>} />
            <Route path="/timer" element={<Navigate to="/session" replace />} />
            <Route path="/sessions" element={<Navigate to="/session" replace />} />
            <Route path="/focus" element={<Navigate to="/session" replace />} />
            <Route path="/log" element={<Navigate to="/session?mode=log" replace />} />
            <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="/course/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Routes>
        </div>
      </main>
      {!isAuth && <BottomNav />}
      {!isAuth && <FloatingTimerPill />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <TimerProvider>
        <Layout />
      </TimerProvider>
    </BrowserRouter>
  )
}
