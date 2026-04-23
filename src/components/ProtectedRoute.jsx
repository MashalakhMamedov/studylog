import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo'

export default function ProtectedRoute({ children }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center">
        <Logo variant="splash" size={72} />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return children
}
