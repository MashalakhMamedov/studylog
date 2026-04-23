import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import Card from '../components/Card.jsx'
import SwipeableRow from '../components/SwipeableRow.jsx'
import Logo from '../components/Logo'

// ── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function localDateStr(d = new Date()) {
  // YYYY-MM-DD in local time — avoids UTC midnight offset issues
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function weekStartStr() {
  const now = new Date()
  const diff = now.getDay() === 0 ? 6 : now.getDay() - 1 // days back to Monday
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)
  return localDateStr(mon)
}

function last7Days() {
  const today = new Date()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - (6 - i))
    return {
      date: localDateStr(d),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      isToday: i === 6,
    }
  })
}

const FOCUS_LABEL = {
  deep_focus:   'Deep Focus',
  light_review: 'Light Review',
  practice:     'Practice',
  video:        'Video Lecture',
  project:      'Project Work',
}

const ENERGY_COLOR = { high: '#2A9D8F', medium: '#E9C46A', low: '#E76F51', post_night_shift: '#E63946' }
const ENERGY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', post_night_shift: 'Post-Night-Shift' }

function fmtRelativeDate(dateStr) {
  const todayStr = localDateStr()
  if (dateStr === todayStr) return 'Today'
  const d = new Date()
  d.setDate(d.getDate() - 1)
  if (dateStr === localDateStr(d)) return 'Yesterday'
  const [y, m, day] = dateStr.split('-').map(Number)
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return y === new Date().getFullYear() ? `${day} ${months[m - 1]}` : `${day} ${months[m - 1]} ${y}`
}

function fmtMins(m) {
  if (!m) return '0m'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function calcStreak(sessions) {
  const dates = new Set(sessions.map(s => s.date))
  let streak = 0
  const cursor = new Date()
  if (!dates.has(localDateStr(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (dates.has(localDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// ── Data crunching ───────────────────────────────────────────────────────────

function crunch(sessions, quizResults = []) {
  const wStart = weekStartStr()
  const days = last7Days()
  const dayMap = Object.fromEntries(days.map(d => [d.date, 0]))
  const courseMap = {}
  let weekMins = 0, totalMins = 0

  sessions.forEach(({ date, duration_minutes: mins, course_id, courses: c }) => {
    totalMins += mins
    if (date >= wStart) weekMins += mins
    if (date in dayMap) dayMap[date] += mins

    if (c && course_id) {
      if (!courseMap[course_id]) {
        courseMap[course_id] = { name: c.name, emoji: c.emoji, color: c.color, weekMins: 0, totalMins: 0, count: 0, avgScore: null }
      }
      courseMap[course_id].totalMins += mins
      courseMap[course_id].count++
      if (date >= wStart) courseMap[course_id].weekMins += mins
    }
  })

  // Merge quiz averages
  const quizAccum = {}
  quizResults.forEach(({ course_id, score_percent }) => {
    if (!quizAccum[course_id]) quizAccum[course_id] = { sum: 0, n: 0 }
    quizAccum[course_id].sum += Number(score_percent)
    quizAccum[course_id].n++
  })
  Object.entries(quizAccum).forEach(([id, { sum, n }]) => {
    if (courseMap[id]) courseMap[id].avgScore = Math.round(sum / n)
  })

  return {
    weekMins, totalMins,
    totalSessions: sessions.length,
    streak: calcStreak(sessions),
    studiedToday: sessions.some(s => s.date === localDateStr()),
    chartData: days.map(d => ({ ...d, minutes: dayMap[d.date] })),
    courses: Object.values(courseMap).sort((a, b) => b.weekMins - a.weekMins || b.totalMins - a.totalMins),
  }
}

const EMPTY = crunch([], [])

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState(null)   // null = loading
  const [quizResults, setQuizResults] = useState([])
  const [recentSessions, setRecentSessions] = useState(null)
  const stats = useMemo(() => (sessions ? crunch(sessions, quizResults) : EMPTY), [sessions, quizResults])

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('date, duration_minutes, course_id, courses(name, emoji, color)'),
      supabase.from('quiz_results').select('course_id, score_percent'),
      supabase.from('sessions')
        .select('id, date, duration_minutes, pages_covered, focus_type, energy_level, notes, courses(name, emoji, color), resources(name)')
        .order('date', { ascending: false })
        .limit(8),
    ]).then(([{ data: s }, { data: q }, { data: r }]) => {
      setSessions(s ?? [])
      setQuizResults(q ?? [])
      setRecentSessions(r ?? [])
    })
  }, [])

  const loading = sessions === null
  const { theme, toggleTheme } = useTheme()

  async function handleDeleteSession(id) {
    setRecentSessions(prev => prev.filter(s => s.id !== id))
    setSessions(prev => prev ? prev.filter(s => s.id !== id) : prev)
    await supabase.from('sessions').delete().eq('id', id)
  }

  return (
    <div className="page-enter px-4 pt-8 pb-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <Logo variant="full" size={28} />
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => navigate('/settings')}
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ color: 'var(--text-2)', border: '1px solid var(--border)' }}
            aria-label="Settings"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Streak */}
      <StreakBanner streak={stats.streak} studiedToday={stats.studiedToday} loading={loading} />

      {/* 3 Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard label="This Week" value={fmtMins(stats.weekMins)} loading={loading} />
        <StatCard label="All Time"  value={fmtMins(stats.totalMins)} loading={loading} />
        <StatCard label="Sessions"  value={String(stats.totalSessions)} loading={loading} />
      </div>

      {/* 7-day activity chart */}
      <Card>
        <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-1)' }}>Last 7 Days</p>
        {loading ? <BarSkeleton /> : <BarChart data={stats.chartData} />}
      </Card>

      {/* Per-course breakdown */}
      {(loading || stats.courses.length > 0) && (
        <Card>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>By Course</p>
          {loading
            ? <div className="space-y-2">{[0,1,2].map(i => <Skel key={i} h={52} />)}</div>
            : <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {stats.courses.map(c => <CourseRow key={c.name} course={c} />)}
              </div>
          }
        </Card>
      )}

      {/* Recent sessions */}
      {(loading || (recentSessions && recentSessions.length > 0)) && (
        <Card>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Recent Sessions</p>
          {loading
            ? <div className="space-y-3">{[0,1,2].map(i => <Skel key={i} h={56} />)}</div>
            : <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {recentSessions.map(s => <SessionCard key={s.id} s={s} onDelete={handleDeleteSession} />)}
              </div>
          }
        </Card>
      )}

      {/* Empty state for new users */}
      {!loading && sessions?.length === 0 && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <span className="text-5xl">📖</span>
          <div className="space-y-1">
            <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>No sessions yet</p>
            <p className="text-xs" style={{ color: 'var(--text-2)' }}>Start your first focus session to begin tracking your progress</p>
          </div>
        </div>
      )}

      {/* Quick start */}
      <Link
        to="/session"
        className="flex items-center justify-center w-full py-3.5 rounded-2xl font-semibold text-sm"
        style={{ backgroundColor: '#E63946', color: '#fff' }}
      >
        Start Focus Session
      </Link>

    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function StreakBanner({ streak, studiedToday, loading }) {
  if (loading) return <Skel h={64} />

  const hot = streak > 0
  const sub = hot
    ? (studiedToday ? 'Nice work! Come back tomorrow to keep it going.' : 'Study today to keep your streak alive!')
    : 'Log a session today to start your streak.'

  return (
    <div
      className="flex items-center gap-4 px-4 py-3.5 rounded-2xl"
      style={{
        backgroundColor: hot ? 'var(--streak-hot-bg)' : 'var(--bg-card)',
        border: `1px solid ${hot ? 'var(--tinted-red)' : 'var(--border)'}`,
      }}
    >
      <span className="text-3xl leading-none flex-shrink-0">{hot ? '🔥' : '💤'}</span>
      <div className="min-w-0">
        <p className="font-bold text-base leading-tight" style={{ color: 'var(--text-1)' }}>
          {hot ? `${streak}-day streak` : 'No streak yet'}
        </p>
        <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-2)' }}>{sub}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, loading }) {
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-[10px] font-medium mb-1.5 leading-none" style={{ color: 'var(--text-2)' }}>{label}</p>
      {loading
        ? <Skel h={22} />
        : <p className="text-lg font-bold leading-none" style={{ color: 'var(--text-1)' }}>{value}</p>
      }
    </div>
  )
}

function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.minutes), 1)
  const BAR_H = 80 // px for 100%

  return (
    <div>
      {/* Bars */}
      <div className="flex items-end gap-1.5" style={{ height: `${BAR_H}px` }}>
        {data.map(({ date, minutes, isToday }) => {
          const pct = minutes / max
          const barH = minutes === 0 ? 3 : Math.max(6, Math.round(pct * BAR_H))
          return (
            <div
              key={date}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${barH}px`,
                backgroundColor: isToday
                  ? '#E63946'
                  : minutes > 0 ? 'var(--tinted-red)' : 'var(--border)',
              }}
            />
          )
        })}
      </div>

      {/* Day labels + minute labels */}
      <div className="flex gap-1.5 mt-2">
        {data.map(({ date, label, minutes, isToday }) => (
          <div key={date} className="flex-1 text-center space-y-0.5">
            <p className="text-[10px] font-medium" style={{ color: isToday ? '#E63946' : 'var(--text-2)' }}>{label}</p>
            {minutes > 0 && (
              <p className="text-[9px]" style={{ color: isToday ? 'var(--bar-today-label)' : 'var(--text-3)' }}>
                {fmtMins(minutes)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function scoreColor(pct) {
  if (pct >= 80) return '#2A9D8F'
  if (pct >= 60) return '#E9C46A'
  return '#E63946'
}

function CourseRow({ course: c }) {
  return (
    <div className="flex items-center gap-3 py-3">
      {/* Color dot + emoji */}
      <div className="relative flex-shrink-0">
        <span className="text-xl leading-none">{c.emoji}</span>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border"
          style={{ backgroundColor: c.color, borderColor: 'var(--bg-card)' }}
        />
      </div>

      {/* Name + counts */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: 'var(--text-1)' }}>{c.name}</p>
          {c.avgScore !== null && (
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ backgroundColor: scoreColor(c.avgScore) + '22', color: scoreColor(c.avgScore) }}
            >
              {c.avgScore}%
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
          {c.count} session{c.count !== 1 ? 's' : ''} · {fmtMins(c.totalMins)} total
        </p>
      </div>

      {/* Week hours */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmtMins(c.weekMins)}</p>
        <p className="text-[10px]" style={{ color: 'var(--text-2)' }}>this week</p>
      </div>
    </div>
  )
}

function SessionCard({ s, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const course = s.courses
  if (!course) return null

  return (
    <>
      <SwipeableRow onDelete={() => setConfirming(true)}>
        <div className="py-3 pr-8 relative">
          {/* Trash button */}
          <button
            onClick={() => setConfirming(true)}
            className="absolute top-3 right-0 p-1"
            style={{ color: 'var(--text-2)' }}
            aria-label="Delete session"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </button>

          {/* Row 1: course chip + duration + date */}
          <div className="flex items-center justify-between gap-2">
            <span
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold truncate"
              style={{ backgroundColor: course.color + '22', color: course.color, maxWidth: '55%' }}
            >
              {course.emoji} {course.name}
            </span>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{fmtMins(s.duration_minutes)}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-2)' }}>{fmtRelativeDate(s.date)}</span>
            </div>
          </div>

          {/* Row 2: resource + pages */}
          {(s.resources?.name || s.pages_covered) && (
            <p className="text-xs mt-1.5 truncate" style={{ color: 'var(--text-2)' }}>
              {[s.resources?.name, s.pages_covered].filter(Boolean).join(' · ')}
            </p>
          )}

          {/* Row 3: focus + energy badges */}
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {s.focus_type && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: '#E6394622', color: '#E63946' }}
              >
                {FOCUS_LABEL[s.focus_type] ?? s.focus_type}
              </span>
            )}
            {s.energy_level && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{ backgroundColor: ENERGY_COLOR[s.energy_level] + '22', color: ENERGY_COLOR[s.energy_level] }}
              >
                {ENERGY_LABEL[s.energy_level] ?? s.energy_level}
              </span>
            )}
          </div>

          {/* Notes */}
          {s.notes && (
            <p className="text-xs italic mt-1.5 truncate" style={{ color: 'var(--text-2)' }}>
              {s.notes}
            </p>
          )}
        </div>
      </SwipeableRow>

      {confirming && (
        <DeleteConfirmModal
          onConfirm={() => { onDelete(s.id); setConfirming(false) }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  )
}

function DeleteConfirmModal({ onConfirm, onCancel }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onCancel()}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="space-y-1">
          <p className="font-bold" style={{ color: 'var(--text-1)' }}>Delete this session?</p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>This can't be undone.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#E63946', color: '#fff' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton helpers ─────────────────────────────────────────────────────────

function Skel({ h }) {
  return (
    <div
      className="w-full rounded-xl animate-pulse"
      style={{ height: `${h}px`, backgroundColor: 'var(--bg-surf)' }}
    />
  )
}

function BarSkeleton() {
  return (
    <div className="flex items-end gap-1.5" style={{ height: '80px' }}>
      {[60, 35, 75, 50, 90, 40, 65].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm animate-pulse"
          style={{ height: `${h}%`, backgroundColor: 'var(--bg-surf)' }}
        />
      ))}
    </div>
  )
}
