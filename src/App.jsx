import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import BottomNav from './components/BottomNav.jsx'
import Home from './pages/Home.jsx'
import Timer from './pages/Timer.jsx'
import Sessions from './pages/Sessions.jsx'
import Resources from './pages/Resources.jsx'
import Courses from './pages/Courses.jsx'
import Login from './pages/Login.jsx'

function Layout() {
  const { pathname } = useLocation()
  const isAuth = pathname === '/login'

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#0a0a0b' }}>
      <main className="flex-1 overflow-y-auto" style={{ paddingBottom: isAuth ? '0' : '64px' }}>
        <div className="max-w-lg mx-auto">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/timer" element={<ProtectedRoute><Timer /></ProtectedRoute>} />
            <Route path="/sessions" element={<ProtectedRoute><Sessions /></ProtectedRoute>} />
            <Route path="/resources" element={<ProtectedRoute><Resources /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
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
      <Layout />
    </BrowserRouter>
  )
}
