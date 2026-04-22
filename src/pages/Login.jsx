import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password })

    setLoading(false)

    if (error) {
      setError(error.message)
    } else if (mode === 'signup') {
      setError('')
      setMode('login')
      setPassword('')
      setError('Account created — you can now log in.')
    } else {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>StudyDeck</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}>Track your focus sessions</p>
        </div>

        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: mode === m ? '#E63946' : 'var(--bg-card)',
                color: mode === m ? '#fff' : 'var(--text-2)',
              }}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
          </div>

          {error && (
            <p
              className="text-sm text-center"
              style={{ color: error.startsWith('Account created') ? '#E63946' : '#f87171' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
            style={{ backgroundColor: '#E63946', color: '#fff' }}
          >
            {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

      </div>
    </div>
  )
}
