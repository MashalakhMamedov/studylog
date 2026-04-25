import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: '#0a0a0b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            fontSize: '15px',
            fontWeight: 600,
            color: '#6366f1',
            letterSpacing: '0.02em',
          }}
        >
          StudyLog
        </span>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return children
}
