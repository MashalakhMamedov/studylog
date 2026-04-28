import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function ResetPassword() {
  const navigate = useNavigate()
  const { accentColor } = useTheme()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg)' }}>
        <p className="text-sm" style={{ color: 'var(--text-2)' }}>Verifying reset link…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>New Password</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}>Enter your new password below</p>
        </div>

        {success ? (
          <p className="text-center text-sm" style={{ color: accentColor }}>
            Password updated! Redirecting…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-3">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
              <input
                type="password"
                required
                minLength={6}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            </div>

            {error && (
              <p className="text-sm text-center" style={{ color: '#f87171' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
              style={{ backgroundColor: accentColor, color: '#fff' }}
            >
              {loading ? '…' : 'Update Password'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
