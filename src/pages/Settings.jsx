import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme, COLORS } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'

const FOCUS_DURATIONS = [25, 45, 60]
const APP_VERSION = 'v1.3'

const CHANGELOG = [
  {
    version: 'v1.3',
    notes: 'Empty states, shimmer skeleton loading, visual polish, and clearer first-run guidance across courses, materials, home, and sessions',
  },
  {
    version: 'v1.2',
    notes: 'Home dashboard refresh, fullscreen focus timer, resilient timer tracking, richer material management, PWA icon updates',
  },
  {
    version: 'v1.1',
    notes: 'New navigation, course detail pages, session tracking, customizable themes',
  },
  {
    version: 'v1.0',
    notes: 'Initial release',
  },
]

// ── Primitives ────────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <p style={{
      color: 'var(--text-3)',
      fontSize: '11px',
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      fontWeight: 600,
      marginBottom: '8px',
      paddingLeft: '4px',
    }}>
      {children}
    </p>
  )
}

function Card({ children }) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
      {children}
    </div>
  )
}

function Row({ children, noBorder, style }) {
  return (
    <div
      style={{
        padding: '14px 16px',
        ...(noBorder ? {} : { borderBottom: '1px solid var(--border)' }),
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ── Delete modal ──────────────────────────────────────────────────────────────

function DeleteModal({ onClose, userId }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function confirm() {
    if (input !== 'DELETE') return
    setBusy(true)
    setErr('')
    try {
      await supabase.from('quiz_results').delete().eq('user_id', userId)
      await supabase.from('sessions').delete().eq('user_id', userId)
      await supabase.from('resources').delete().eq('user_id', userId)
      await supabase.from('courses').delete().eq('user_id', userId)
      await supabase.rpc('delete_user').catch(() => {})
      await supabase.auth.signOut()
    } catch {
      setErr('Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}
      >
        <div className="space-y-1.5">
          <p className="font-bold text-base" style={{ color: 'var(--text-1)' }}>Delete account?</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            This will permanently delete your account and all data — courses, sessions, quiz results, and resources.
            This action cannot be undone.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            Type <span className="font-bold" style={{ color: 'var(--text-1)' }}>DELETE</span> to confirm
          </p>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            autoFocus
          />
        </div>

        {err && <p className="text-xs" style={{ color: '#ef4444' }}>{err}</p>}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy || input !== 'DELETE'}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{
              backgroundColor: '#ef4444',
              color: '#fff',
              opacity: input !== 'DELETE' || busy ? 0.4 : 1,
            }}
          >
            {busy ? 'Deleting…' : 'Delete Account'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { session } = useAuth()
  const { accentColor, setAccentColor } = useTheme()

  const meta = session?.user?.user_metadata ?? {}
  const savedFirstName = meta.first_name || meta.full_name?.split(' ')[0] || ''
  const email = session?.user?.email ?? ''
  const userId = session?.user?.id

  const [nameEditing, setNameEditing] = useState(false)
  const [nameValue, setNameValue] = useState(savedFirstName)
  const [nameSaving, setNameSaving] = useState(false)
  const nameInputRef = useRef(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  async function saveName() {
    const trimmed = nameValue.trim()
    if (trimmed === savedFirstName) { setNameEditing(false); return }
    setNameSaving(true)
    await supabase.auth.updateUser({ data: { first_name: trimmed } })
    setNameSaving(false)
    setNameEditing(false)
  }

  function clearPasswordStatus() {
    setPasswordMessage('')
    setPasswordError('')
  }

  async function savePassword() {
    clearPasswordStatus()

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordSaving(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordSaving(false)

    if (error) {
      setPasswordError(error.message || 'Could not update password. Please try again.')
    } else {
      setNewPassword('')
      setConfirmPassword('')
      setPasswordMessage('Password updated.')
    }
  }

  const [focusDuration, setFocusDurationState] = useState(
    () => parseInt(localStorage.getItem('studylog-focus-duration') || '25', 10)
  )
  const [dangerExpanded, setDangerExpanded] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const selectedColor = COLORS.find(c => c.value === accentColor) ?? COLORS[0]

  function setFocusDuration(mins) {
    setFocusDurationState(mins)
    localStorage.setItem('studylog-focus-duration', String(mins))
  }

  return (
    <div className="page-enter px-4 pt-5 pb-12 space-y-7">

      {/* ── PROFILE ───────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Profile</SectionLabel>
        <Card>
          {/* Name row */}
          <Row>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>First name</p>
                {nameEditing ? (
                  <input
                    ref={nameInputRef}
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameValue(savedFirstName); setNameEditing(false) } }}
                    autoFocus
                    placeholder="Your first name"
                    className="w-full text-sm outline-none rounded-lg px-2 py-1"
                    style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                  />
                ) : (
                  <p className="text-sm font-semibold" style={{ color: savedFirstName ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {savedFirstName || 'Not set'}
                  </p>
                )}
              </div>
              {nameEditing ? (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setNameValue(savedFirstName); setNameEditing(false) }}
                    className="text-xs px-3 py-1.5 rounded-lg"
                    style={{ color: 'var(--text-2)', backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveName}
                    disabled={nameSaving}
                    className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50"
                    style={{ backgroundColor: accentColor, color: '#fff' }}
                  >
                    {nameSaving ? '…' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setNameEditing(true); setTimeout(() => nameInputRef.current?.focus(), 0) }}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg"
                  style={{ color: accentColor, backgroundColor: `${accentColor}18`, border: `1px solid ${accentColor}30` }}
                >
                  {savedFirstName ? 'Edit' : 'Set name'}
                </button>
              )}
            </div>
          </Row>

          {/* Email row */}
          <Row>
            <p className="text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>Email</p>
            <p className="text-sm" style={{ color: 'var(--text-1)' }}>{email}</p>
          </Row>

          <Row noBorder>
            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm font-semibold"
              style={{ color: '#ef4444', background: 'none', padding: 0 }}
            >
              Sign Out
            </button>
          </Row>
        </Card>
      </div>

      {/* ── SECURITY ──────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Security</SectionLabel>
        <Card>
          <Row noBorder>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Change Password</p>
            <div className="space-y-3">
              <input
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); clearPasswordStatus() }}
                placeholder="New password"
                autoComplete="new-password"
                minLength={6}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); clearPasswordStatus() }}
                placeholder="Confirm password"
                autoComplete="new-password"
                minLength={6}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              />

              {passwordError && <p className="text-xs" style={{ color: '#ef4444' }}>{passwordError}</p>}
              {passwordMessage && <p className="text-xs" style={{ color: accentColor }}>{passwordMessage}</p>}

              <button
                onClick={savePassword}
                disabled={passwordSaving || !newPassword || !confirmPassword}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{
                  backgroundColor: newPassword && confirmPassword && !passwordSaving ? accentColor : 'var(--bg-surf)',
                  color: newPassword && confirmPassword && !passwordSaving ? '#fff' : 'var(--text-2)',
                  border: newPassword && confirmPassword && !passwordSaving ? 'none' : '1px solid var(--border)',
                }}
              >
                {passwordSaving ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </Row>
        </Card>
      </div>

      {/* ── APPEARANCE ────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Appearance</SectionLabel>
        <Card>
          <Row noBorder>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Accent Color</p>

            {/* 4×2 swatch grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {COLORS.map(c => {
                const active = c.value === accentColor
                return (
                  <button
                    key={c.value}
                    onClick={() => setAccentColor(c.value)}
                    aria-label={c.name}
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: c.value,
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      outline: active ? `2px solid ${c.value}` : 'none',
                      outlineOffset: '3px',
                      flexShrink: 0,
                    }}
                  >
                    {active && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" style={{ width: '14px', height: '14px' }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>{selectedColor.name}</p>
          </Row>
        </Card>
      </div>

      {/* ── PREFERENCES ───────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Preferences</SectionLabel>
        <Card>
          <Row noBorder>
            <p className="text-sm font-semibold mb-2.5" style={{ color: 'var(--text-1)' }}>Default Focus Duration</p>
            <div
              className="flex p-1 rounded-xl"
              style={{ backgroundColor: 'var(--bg-surf)' }}
            >
              {FOCUS_DURATIONS.map(mins => (
                <button
                  key={mins}
                  onClick={() => setFocusDuration(mins)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold"
                  style={focusDuration === mins
                    ? { backgroundColor: accentColor, color: '#fff' }
                    : { backgroundColor: 'transparent', color: 'var(--text-3)' }
                  }
                >
                  {mins} min
                </button>
              ))}
            </div>
          </Row>
        </Card>
      </div>

      {/* ── ABOUT ─────────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>About</SectionLabel>
        <Card>
          <Row>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>StudyLog</p>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor, fontWeight: 600 }}
              >
                {APP_VERSION}
              </span>
            </div>
          </Row>

          {CHANGELOG.map((entry, i) => (
            <Row key={entry.version} noBorder={i === CHANGELOG.length - 1}>
              <div className="flex items-start gap-2.5">
                <span
                  className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5"
                  style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)' }}
                >
                  {entry.version}
                </span>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
                  {entry.notes}
                </p>
              </div>
            </Row>
          ))}

          <Row noBorder style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Made by Mash</p>
          </Row>
        </Card>
      </div>

      {/* ── DANGER ZONE ───────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>Danger Zone</SectionLabel>
        <Card>
          <button
            onClick={() => setDangerExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            style={{ color: 'var(--text-1)' }}
          >
            <span className="text-sm font-semibold">Account Actions</span>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                width: '16px',
                height: '16px',
                color: 'var(--text-3)',
                transform: dangerExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {dangerExpanded && (
            <div style={{ borderTop: '1px solid var(--border)', padding: '16px' }}>
              <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ backgroundColor: '#ef4444', color: '#fff' }}
              >
                Delete My Account
              </button>
            </div>
          )}
        </Card>
      </div>

      {showDeleteModal && (
        <DeleteModal userId={userId} onClose={() => setShowDeleteModal(false)} />
      )}
    </div>
  )
}
