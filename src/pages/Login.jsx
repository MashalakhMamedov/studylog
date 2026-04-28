import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const navigate = useNavigate()
  const { accentColor } = useTheme()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [firstName, setFirstName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showResend, setShowResend] = useState(false)
  const [resendStatus, setResendStatus] = useState('') // '' | 'loading' | 'sent' | 'error'

  async function handleResend() {
    setResendStatus('loading')
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    if (error) {
      setResendStatus('error')
    } else {
      setResendStatus('sent')
      setTimeout(() => setResendStatus(''), 3000)
    }
  }

  async function handleForgotPassword() {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Enter your email address first.')
      return
    }

    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail)
    setLoading(false)

    if (error) {
      setError(error.message)
    } else {
      setError('Password reset email sent. Check your inbox for the reset link.')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { data: { first_name: firstName.trim() } },
          })

    setLoading(false)

    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('Please confirm your email before logging in. Check your inbox.')
        setShowResend(true)
      } else {
        setError(error.message)
        setShowResend(false)
      }
    } else if (mode === 'signup') {
      setError('')
      setMode('login')
      setPassword('')
      setShowResend(false)
      setResendStatus('')
      setError('Account created — check your email and click the confirmation link before logging in.')
    } else {
      navigate('/', { replace: true })
    }
  }

  const successMessage =
    error.startsWith('Account created') ||
    error.startsWith('Password reset email sent')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>StudyLog</h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-2)' }}>Track your focus sessions</p>
        </div>

        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          {['login', 'signup'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); setShowResend(false); setResendStatus('') }}
              className="flex-1 py-2.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: mode === m ? accentColor : 'var(--bg-card)',
                color: mode === m ? '#fff' : 'var(--text-2)',
              }}
            >
              {m === 'login' ? 'Log In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                required
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="First name"
                autoComplete="given-name"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
            )}
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
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
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            />
            {mode === 'login' && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={loading}
                  className="text-xs font-medium disabled:opacity-60"
                  style={{ color: accentColor }}
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="space-y-2 text-center">
              <p
                className="text-sm"
                style={{ color: successMessage ? accentColor : '#f87171' }}
              >
                {error}
              </p>
              {showResend && (
                resendStatus === 'sent' ? (
                  <p className="text-xs" style={{ color: '#22c55e' }}>Email sent!</p>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resendStatus === 'loading'}
                      className="text-xs font-medium underline underline-offset-2 disabled:opacity-60"
                      style={{ color: '#f87171' }}
                    >
                      {resendStatus === 'loading' ? 'Sending…' : 'Resend confirmation email'}
                    </button>
                    {resendStatus === 'error' && (
                      <p className="text-xs mt-1" style={{ color: '#ef4444' }}>Failed to send. Try again.</p>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-60"
            style={{ backgroundColor: accentColor, color: '#fff' }}
          >
            {loading ? '...' : mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

      </div>
    </div>
  )
}
