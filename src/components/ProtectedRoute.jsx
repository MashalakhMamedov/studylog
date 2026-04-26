import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo.jsx'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div
        style={{
          minHeight: 'calc(100vh - 116px)',
          backgroundColor: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 16px',
        }}
        aria-live="polite"
        aria-busy="true"
      >
        <Logo variant="splash" size={70} />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return children
}
