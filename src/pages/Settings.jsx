import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const VERSION = '1.0.0'

const CHANGELOG = [
  {
    version: 'v1.0.0',
    label: 'Initial Release',
    notes: 'Course & resource management, session logging, focus timer, dashboard stats',
  },
]

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }) {
  return (
    <div>
      <p
        className="text-[11px] font-semibold uppercase tracking-wider mb-2 px-1"
        style={{ color: 'var(--text-2)' }}
      >
        {title}
      </p>
      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {children}
      </div>
    </div>
  )
}

function Row({ children, noBorder }) {
  return (
    <div
      className="px-4 py-3.5"
      style={noBorder ? {} : { borderBottom: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}

// ── Delete account modal ──────────────────────────────────────────────────────

function DeleteModal({ onClose, userId }) {
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function confirm() {
    if (input !== 'DELETE') return
    setBusy(true)
    setErr('')
    try {
      // Delete data in FK-safe order
      await supabase.from('quiz_results').delete().eq('user_id', userId)
      await supabase.from('sessions').delete().eq('user_id', userId)
      await supabase.from('resources').delete().eq('user_id', userId)
      await supabase.from('courses').delete().eq('user_id', userId)
      // Optional RPC to remove auth record (requires a server-side Supabase function)
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
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="space-y-1.5">
          <p className="font-bold text-base" style={{ color: 'var(--text-1)' }}>Delete account?</p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
            This will permanently delete all your data — courses, sessions, quiz results, and resources.
            This action cannot be undone.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>
            Type <span className="font-bold" style={{ color: 'var(--text-1)' }}>DELETE</span> to confirm
          </p>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="DELETE"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-surf)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
            autoFocus
          />
        </div>

        {err && <p className="text-xs" style={{ color: '#E63946' }}>{err}</p>}

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
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{
              backgroundColor: '#E63946',
              color: '#fff',
              opacity: input !== 'DELETE' || busy ? 0.4 : 1,
            }}
          >
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { session } = useAuth()
  const email = session?.user?.email ?? ''
  const userId = session?.user?.id

  const [showDelete, setShowDelete] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)

  async function handleExport() {
    setExporting(true)
    setExportDone(false)
    try {
      const { data: rows } = await supabase
        .from('sessions')
        .select('date, duration_minutes, pages_covered, focus_type, energy_level, notes, courses(name), resources(name)')
        .order('date', { ascending: false })

      const sessions = rows ?? []
      const headers = ['date', 'course', 'resource', 'duration_minutes', 'pages_covered', 'focus_type', 'energy_level', 'notes']
      const csvRows = sessions.map(s =>
        [
          s.date ?? '',
          s.courses?.name ?? '',
          s.resources?.name ?? '',
          s.duration_minutes ?? '',
          s.pages_covered ?? '',
          s.focus_type ?? '',
          s.energy_level ?? '',
          (s.notes ?? '').replace(/"/g, '""'),
        ].map(v => `"${v}"`).join(',')
      )

      const csv = [headers.join(','), ...csvRows].join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `studydeck-export-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page-enter px-4 pt-6 pb-10 space-y-6">

      {/* Account */}
      <Section title="Account">
        <Row>
          <p className="text-[11px] font-medium mb-0.5" style={{ color: 'var(--text-2)' }}>Signed in as</p>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>{email}</p>
        </Row>
        <Row>
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full text-left text-sm font-semibold py-0.5"
            style={{ color: 'var(--text-1)' }}
          >
            Sign Out
          </button>
        </Row>
        <Row noBorder>
          <button
            onClick={() => setShowDelete(true)}
            className="w-full text-left text-sm font-semibold py-0.5"
            style={{ color: '#E63946' }}
          >
            Delete Account…
          </button>
        </Row>
      </Section>

      {/* Data */}
      <Section title="Data">
        <Row noBorder>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Export All Data</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                Sessions as CSV — date, course, resource, duration, pages, focus type, energy, notes
              </p>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex-shrink-0 ml-3 px-3 py-1.5 rounded-xl text-xs font-semibold transition-opacity"
              style={{
                backgroundColor: exportDone ? '#2A9D8F22' : 'var(--bg-surf)',
                color: exportDone ? '#2A9D8F' : 'var(--text-1)',
                border: '1px solid var(--border)',
                opacity: exporting ? 0.5 : 1,
              }}
            >
              {exporting ? 'Exporting…' : exportDone ? 'Downloaded!' : 'Export CSV'}
            </button>
          </div>
        </Row>
      </Section>

      {/* Preferences */}
      <Section title="Preferences">
        <Row noBorder>
          <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-2)' }}>Coming soon</p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
            Theme toggle, notification preferences, data export settings
          </p>
        </Row>
      </Section>

      {/* About */}
      <Section title="About">
        <Row>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>StudyDeck</p>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
            >
              v{VERSION}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--text-2)' }}>
            Track your study sessions at the resource level
          </p>
        </Row>
        <Row noBorder>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Built by{' '}
            <a
              href="https://github.com/Mashalakh"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline"
              style={{ color: 'var(--text-1)' }}
            >
              Mash
            </a>
          </p>
        </Row>
      </Section>

      {/* Changelog */}
      <Section title="Changelog">
        {CHANGELOG.map((entry, i) => (
          <Row key={entry.version} noBorder={i === CHANGELOG.length - 1}>
            <div className="flex items-start gap-3">
              <span
                className="flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full mt-0.5"
                style={{ backgroundColor: '#E6394622', color: '#E63946' }}
              >
                {entry.version}
              </span>
              <div>
                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>
                  {entry.label}
                </p>
                <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  {entry.notes}
                </p>
              </div>
            </div>
          </Row>
        ))}
      </Section>

      {showDelete && (
        <DeleteModal userId={userId} onClose={() => setShowDelete(false)} />
      )}
    </div>
  )
}
