import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme, COLORS } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/utils.js'
import { version } from '../../package.json'

const FOCUS_DURATIONS = [25, 45, 60]

const CHANGELOG = [
  'Safer resource link validation',
  'Timer resets correctly after logout',
  'Better save/delete error handling',
  'Improved Quiz light mode support',
  'Fixed material drag sorting and persistence',
  'Added account security improvements',
  'Added query limits and performance improvements',
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

function AccordionSection({ title, open, onToggle, isLast, children }) {
  return (
    <section style={{ borderBottom: isLast ? 'none' : '1px solid #2a2a2d' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-left"
        style={{
          backgroundColor: '#1a1a1d',
          color: '#fff',
          padding: '15px 16px',
        }}
      >
        <span className="text-sm font-bold">{title}</span>
        <span aria-hidden="true" className="text-sm">{open ? '▲' : '▼'}</span>
      </button>
      <div
        style={{
          maxHeight: open ? '2200px' : '0',
          opacity: open ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 260ms ease, opacity 180ms ease',
        }}
      >
        <div style={{ padding: '16px' }}>
          {children}
        </div>
      </div>
    </section>
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
      const { error } = await supabase.rpc('delete_user')
      if (error) {
        setErr('Account deletion failed. Please contact support.')
        setBusy(false)
        return
      }

      await supabase.from('quiz_results').delete().eq('user_id', userId)
      await supabase.from('sessions').delete().eq('user_id', userId)
      await supabase.from('resources').delete().eq('user_id', userId)
      await supabase.from('courses').delete().eq('user_id', userId)
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
  const [nameError, setNameError] = useState('')
  const nameInputRef = useRef(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [openSections, setOpenSections] = useState({
    account: true,
    preferences: false,
    about: false,
  })

  async function saveName() {
    const trimmed = nameValue.trim()
    if (trimmed === savedFirstName) { setNameError(''); setNameEditing(false); return }
    setNameError('')
    setNameSaving(true)
    const { error } = await supabase.auth.updateUser({ data: { first_name: trimmed } })
    setNameSaving(false)
    if (error) {
      setNameError(error.message || 'Could not update first name. Please try again.')
      showToast('Failed to save name', 'error')
      return
    }
    setNameEditing(false)
    showToast('Name updated')
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

  const { showToast, ToastComponent } = useToast()
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

  function toggleSection(section) {
    setOpenSections(current => ({
      ...current,
      [section]: !current[section],
    }))
  }

  return (
    <div className="page-enter px-4 pt-5 pb-12 space-y-7">
      <div style={{ border: '1px solid #2a2a2d', borderRadius: '12px', overflow: 'hidden' }}>
        <AccordionSection
          title="Account"
          open={openSections.account}
          onToggle={() => toggleSection('account')}
        >

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
                  <>
                    <input
                      ref={nameInputRef}
                      value={nameValue}
                      onChange={e => { setNameValue(e.target.value); setNameError('') }}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameValue(savedFirstName); setNameError(''); setNameEditing(false) } }}
                      autoFocus
                      placeholder="Your first name"
                      className="w-full text-sm outline-none rounded-lg px-2 py-1"
                      style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
                    />
                    {nameError && <p className="text-xs mt-1" style={{ color: '#ef4444' }}>{nameError}</p>}
                  </>
                ) : (
                  <p className="text-sm font-semibold" style={{ color: savedFirstName ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {savedFirstName || 'Not set'}
                  </p>
                )}
              </div>
              {nameEditing ? (
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => { setNameValue(savedFirstName); setNameError(''); setNameEditing(false) }}
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
                  onClick={() => { setNameError(''); setNameEditing(true); setTimeout(() => nameInputRef.current?.focus(), 0) }}
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
          <Row>
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

          <Row noBorder>
            <button
              onClick={() => setDangerExpanded(v => !v)}
              className="w-full flex items-center justify-between text-left"
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
              <div style={{ borderTop: '1px solid var(--border)', marginTop: '14px', paddingTop: '14px' }}>
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
          </Row>
        </Card>
      </div>

        </AccordionSection>
        <AccordionSection
          title="Preferences"
          open={openSections.preferences}
          onToggle={() => toggleSection('preferences')}
        >

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

        </AccordionSection>
        <AccordionSection
          title="About"
          open={openSections.about}
          onToggle={() => toggleSection('about')}
          isLast
        >

      {/* ── ABOUT ─────────────────────────────────────────────────────────── */}
      <div>
        <SectionLabel>About StudyLog</SectionLabel>
        <Card>
          <Row>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>StudyLog</p>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor, fontWeight: 600 }}
              >
                v{version}
              </span>
            </div>
          </Row>

          <Row>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
              StudyLog is a resource-level study tracker built to help students track what they studied, where they left off, and how their effort compounds over time.
            </p>
          </Row>

          <Row>
            <p className="text-xs mb-1" style={{ color: 'var(--text-3)' }}>Creator</p>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>Built by Mashalakh, an engineering student.</p>
          </Row>

          <Row noBorder>
            <p className="text-xs mb-2.5" style={{ color: 'var(--text-3)' }}>Changelog</p>
            <ul className="space-y-2">
              {CHANGELOG.map(item => (
                <li key={item} className="flex items-start gap-2 text-sm leading-snug" style={{ color: 'var(--text-2)' }}>
                  <span
                    aria-hidden="true"
                    className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: accentColor }}
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Row>
        </Card>
      </div>

        </AccordionSection>
      </div>

      {/* ── DANGER ZONE ───────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <DeleteModal userId={userId} onClose={() => setShowDeleteModal(false)} />
      )}
      {ToastComponent}
    </div>
  )
}
