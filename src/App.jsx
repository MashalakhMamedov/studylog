import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { TimerProvider, useTimer, fmtTime } from './context/TimerContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BottomNav from './components/BottomNav.jsx'
import Home from './pages/Home.jsx'
import Timer from './pages/Timer.jsx'
import Sessions from './pages/Sessions.jsx'
import Resources from './pages/Resources.jsx'
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import Quiz from './pages/Quiz.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'

function FloatingTimerBar() {
  const { phase, totalSeconds, segments, running } = useTimer()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  if (phase !== 'running' || pathname === '/timer') return null
  const seg = segments[segments.length - 1]
  if (!seg) return null

  return (
    <div
      onClick={() => navigate('/timer')}
      className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 cursor-pointer select-none"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        height: '44px',
      }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span style={{ color: running ? '#E63946' : 'var(--text-2)', fontSize: '14px' }}>⏱</span>
        <span className="font-bold tabular-nums text-sm" style={{ color: 'var(--text-1)' }}>
          {fmtTime(totalSeconds)}
        </span>
        <span style={{ color: 'var(--border)' }}>·</span>
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold truncate"
          style={{ backgroundColor: seg.courseColor + '22', color: seg.courseColor, maxWidth: '160px' }}
        >
          {seg.courseEmoji} {seg.courseName}
        </span>
        {!running && (
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-2)' }}>— Paused</span>
        )}
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-2)' }}>
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </div>
  )
}

const PAGE_TITLES = {
  '/timer':     'Focus Timer',
  '/sessions':  'Log Session',
  '/resources': 'Materials',
  '/courses':   'Courses',
  '/quiz':      'Quiz',
  '/settings':  'Settings',
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
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>{title}</h1>
    </div>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const { phase } = useTimer()
  const isAuth = pathname === '/login'
  const showTimerBar = phase === 'running' && pathname !== '/timer' && !isAuth

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg)' }}>
      <FloatingTimerBar />
      <main
        className="flex-1 overflow-y-auto"
        style={{
          paddingBottom: isAuth ? '0' : '64px',
          paddingTop: showTimerBar ? '44px' : '0',
        }}
      >
        <div className="max-w-lg mx-auto">
          {!isAuth && <PageTitleBar />}
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/timer" element={<ProtectedRoute><Timer /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
            <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
            <Route path="/course/:id" element={<ProtectedRoute><CourseDetail /></ProtectedRoute>} />
            <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          </Routes>
        </div>
      </main>
      {!isAuth && <BottomNav />}
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
