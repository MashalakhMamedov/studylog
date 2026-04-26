import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { TimerProvider, useTimer } from './context/TimerContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BottomNav from './components/BottomNav.jsx'
import FloatingTimer from './components/FloatingTimer.jsx'
import Home from './pages/Home.jsx'
import Session from './pages/Session.jsx'
import StatsPage from './pages/StatsPage.jsx'
import Courses from './pages/Courses.jsx'
import CourseDetail from './pages/CourseDetail.jsx'
import Quiz from './pages/Quiz.jsx'
import Settings from './pages/Settings.jsx'
import Login from './pages/Login.jsx'


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
      {!isAuth && <FloatingTimer />}
    </div>
  )
}

export default function App() {
  return (
    <TimerProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </TimerProvider>
  )
}
