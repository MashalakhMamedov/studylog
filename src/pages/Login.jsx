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
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: '#0a0a0b' }}>
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: '#e8e8ec' }}>StudyLog</h1>
          <p className="mt-2 text-sm" style={{ color: '#6b6b78' }}>Track your focus sessions</p>
        </div>

        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #2a2a30' }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError('') }}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: mode === m ? '#7c6af7' : '#111113',
                color: mode === m ? '#fff' : '#6b6b78',
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
              style={{ backgroundColor: '#111113', border: '1px solid #2a2a30', color: '#e8e8ec' }}
            />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#111113', border: '1px solid #2a2a30', color: '#e8e8ec' }}
            />
          </div>

          {error && (
            <p
              className="text-sm text-center"
              style={{ color: error.startsWith('Account created') ? '#7c6af7' : '#f87171' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
            style={{ backgroundColor: '#7c6af7', color: '#fff' }}
          >
            {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

      </div>
    </div>
  )
}
