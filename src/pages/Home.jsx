import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import SwipeableRow from '../components/SwipeableRow.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 21) return 'Good evening'
  return 'Good night'
}

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatHeaderDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function weekStartStr() {
  const now = new Date()
  const diff = now.getDay() === 0 ? 6 : now.getDay() - 1
  const mon = new Date(now)
  mon.setDate(now.getDate() - diff)
  return localDateStr(mon)
}

function currentWeekDays() {
  const today = new Date()
  const todayStr = localDateStr(today)
  const daysFromMonday = today.getDay() === 0 ? 6 : today.getDay() - 1
  const monday = new Date(today)
  monday.setDate(today.getDate() - daysFromMonday)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const dateStr = localDateStr(d)
    return {
      date: dateStr,
      label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][i],
      isToday: dateStr === todayStr,
      isFuture: dateStr > todayStr,
    }
  })
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

function fmtMins(m) {
  if (!m) return '0m'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min}m`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function fmtRelativeTime(createdAt) {
  if (!createdAt) return ''
  const diff = (Date.now() - new Date(createdAt).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 172800) return 'Yesterday'
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const ENERGY_COLOR = {
  high: '#10B981',
  medium: '#F59E0B',
  low: '#EF4444',
  post_night_shift: '#8B5CF6',
}

// ── Stats computation ─────────────────────────────────────────────────────────

function computeStats(allSessions) {
  const todayStr = localDateStr()
  const wStart = weekStartStr()
  const weekDays = currentWeekDays()

  const todaySessions = allSessions.filter(s => s.date === todayStr)
  const todayMins = todaySessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)
  const todayPages = todaySessions.reduce((sum, s) => {
    const p = parseInt(s.pages_covered)
    return sum + (isNaN(p) ? 0 : p)
  }, 0)

  const dayMap = Object.fromEntries(weekDays.map(d => [d.date, 0]))
  allSessions.forEach(s => {
    if (s.date in dayMap) dayMap[s.date] += (s.duration_minutes || 0)
  })
  const chartData = weekDays.map(d => ({ ...d, minutes: dayMap[d.date] }))

  const weekSessionsMap = {}
  allSessions.forEach(s => {
    if (s.date >= wStart && s.course_id) {
      weekSessionsMap[s.course_id] = (weekSessionsMap[s.course_id] || 0) + 1
    }
  })

  return {
    todayMins,
    todaySessionCount: todaySessions.length,
    todayPages,
    chartData,
    weekSessionsMap,
    streak: calcStreak(allSessions),
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { session: authSession } = useAuth()
  const { theme, toggleTheme } = useTheme()

  const [allSessions, setAllSessions] = useState(null)
  const [activeCourses, setActiveCourses] = useState(null)
  const [recentSessions, setRecentSessions] = useState(null)

  const stats = useMemo(() => allSessions ? computeStats(allSessions) : null, [allSessions])
  const loading = allSessions === null

  const firstName = authSession?.user?.user_metadata?.full_name?.split(' ')[0] ?? ''
  const greetingText = firstName ? `${greeting()}, ${firstName}` : greeting()

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('id, date, duration_minutes, pages_covered, course_id'),
      supabase.from('courses').select('id, name, emoji, color').eq('status', 'active').order('name'),
      supabase.from('sessions')
        .select('id, date, duration_minutes, pages_covered, focus_type, energy_level, notes, created_at, course_id, courses(name, emoji, color), resources(name)')
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(([{ data: s }, { data: c }, { data: r }]) => {
      setAllSessions(s ?? [])
      setActiveCourses(c ?? [])
      setRecentSessions(r ?? [])
    })
  }, [])

  async function handleDeleteSession(id) {
    setRecentSessions(prev => prev?.filter(s => s.id !== id) ?? [])
    setAllSessions(prev => prev?.filter(s => s.id !== id) ?? [])
    await supabase.from('sessions').delete().eq('id', id)
  }

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">

      {/* 1 — Greeting */}
      <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '0ms' }}>
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--text-1)' }}>
              {greetingText}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>{formatHeaderDate()}</p>
            <p className="text-sm font-medium" style={{ color: '#10B981' }}>
              {loading
                ? <span style={{ color: 'var(--text-3)' }}>·  ·  ·</span>
                : stats.streak > 0
                  ? `${stats.streak}-day streak 🔥`
                  : 'Start a streak today'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-4">
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
      </div>

      {/* 2 — Today's Stats */}
      <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '80ms' }}>
        <TodayStatsCard stats={stats} loading={loading} />
      </div>

      {/* 3 — Weekly Bar Chart */}
      <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '160ms' }}>
        <WeeklyBarChart chartData={stats?.chartData} loading={loading} />
      </div>

      {/* 4 — Quick Actions */}
      <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '240ms' }}>
        <QuickActions />
      </div>

      {/* 5 — Active Courses */}
      {!loading && activeCourses?.length > 0 && (
        <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '320ms' }}>
          <CoursesRow courses={activeCourses} weekSessionsMap={stats?.weekSessionsMap ?? {}} />
        </div>
      )}

      {/* 6 — Recent Sessions */}
      {(loading || recentSessions?.length > 0) && (
        <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '400ms' }}>
          <RecentSessionsList sessions={recentSessions} loading={loading} onDelete={handleDeleteSession} />
        </div>
      )}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TodayStatsCard({ stats, loading }) {
  return (
    <div className="rounded-xl px-5 py-4" style={{ backgroundColor: '#111113' }}>
      <div className="flex items-center">
        <div className="flex-1 text-center">
          {loading
            ? <Skel h={26} />
            : <p className="text-xl font-bold leading-none" style={{ color: '#10B981' }}>
                {fmtMins(stats?.todayMins ?? 0)}
              </p>
          }
          <p className="text-xs mt-1.5" style={{ color: '#6b7280' }}>studied</p>
        </div>

        <div style={{ width: 1, height: 40, backgroundColor: 'var(--border)', flexShrink: 0 }} />

        <div className="flex-1 text-center">
          {loading
            ? <Skel h={26} />
            : <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-1)' }}>
                {stats?.todaySessionCount ?? 0}
              </p>
          }
          <p className="text-xs mt-1.5" style={{ color: '#6b7280' }}>sessions</p>
        </div>

        <div style={{ width: 1, height: 40, backgroundColor: 'var(--border)', flexShrink: 0 }} />

        <div className="flex-1 text-center">
          {loading
            ? <Skel h={26} />
            : <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-1)' }}>
                {stats?.todayPages ?? 0}
              </p>
          }
          <p className="text-xs mt-1.5" style={{ color: '#6b7280' }}>pages</p>
        </div>
      </div>
    </div>
  )
}

function WeeklyBarChart({ chartData, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl p-4" style={{ backgroundColor: '#111113' }}>
        <BarSkeleton />
      </div>
    )
  }

  const max = Math.max(...(chartData?.map(d => d.minutes) ?? [0]), 1)

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#111113' }}>
      {/* Bar columns — fixed height, bars grow from bottom */}
      <div className="flex gap-1" style={{ height: 116 }}>
        {chartData?.map(({ date, minutes, isToday }) => {
          const barH = minutes === 0 ? 2 : Math.max(8, Math.round((minutes / max) * 100))
          const opacity = isToday ? 1 : minutes > 0 ? 0.6 : 0.18

          return (
            <div
              key={date}
              className="flex-1 flex flex-col items-center justify-end"
              style={{ gap: 3 }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: '#6b7280',
                  height: 13,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  lineHeight: 1,
                }}
              >
                {minutes > 0 ? fmtMins(minutes) : ''}
              </span>
              <div
                style={{
                  width: '100%',
                  height: barH,
                  backgroundColor: '#10B981',
                  opacity,
                  borderRadius: minutes === 0 ? 1 : '3px 3px 0 0',
                }}
              />
            </div>
          )
        })}
      </div>

      {/* Day labels */}
      <div className="flex gap-1 mt-2">
        {chartData?.map(({ date, label, isToday }) => (
          <div key={date} className="flex-1 text-center">
            <span
              style={{
                fontSize: 11,
                color: isToday ? '#10B981' : '#6b7280',
                fontWeight: isToday ? 600 : 400,
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function QuickActions() {
  const navigate = useNavigate()

  return (
    <div className="flex gap-3">
      <button
        onClick={() => navigate('/session?mode=focus')}
        className="flex-1 flex items-center gap-3 px-4 py-4 rounded-xl text-left"
        style={{ backgroundColor: '#111113', border: '1px solid #10B981' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" className="w-5 h-5 flex-shrink-0">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Start Focus</p>
          <p className="text-xs" style={{ color: '#6b7280' }}>Timer session</p>
        </div>
      </button>

      <button
        onClick={() => navigate('/session?mode=log')}
        className="flex-1 flex items-center gap-3 px-4 py-4 rounded-xl text-left"
        style={{ backgroundColor: '#111113', border: '1px solid #10B981' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" className="w-5 h-5 flex-shrink-0">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Log Session</p>
          <p className="text-xs" style={{ color: '#6b7280' }}>Add manually</p>
        </div>
      </button>
    </div>
  )
}

function CoursesRow({ courses, weekSessionsMap }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Your Courses</p>
        <Link to="/courses" className="text-xs font-medium" style={{ color: '#10B981' }}>See all</Link>
      </div>
      <div
        className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {courses.map(course => {
          const weekCount = weekSessionsMap[course.id] || 0
          return (
            <Link
              key={course.id}
              to={`/course/${course.id}`}
              className="flex-shrink-0 rounded-xl p-3 flex flex-col gap-1.5"
              style={{
                width: 140,
                backgroundColor: '#111113',
                borderLeft: `3px solid ${course.color}`,
              }}
            >
              <span className="text-2xl leading-none">{course.emoji}</span>
              <p
                className="text-sm font-semibold leading-tight"
                style={{ color: 'var(--text-1)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              >
                {course.name}
              </p>
              <p className="text-xs" style={{ color: '#6b7280' }}>
                {weekCount} session{weekCount !== 1 ? 's' : ''} this week
              </p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function RecentSessionsList({ sessions, loading, onDelete }) {
  return (
    <div>
      <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>Recent Sessions</p>
      {loading
        ? <div className="space-y-2">{[0, 1, 2].map(i => <Skel key={i} h={72} />)}</div>
        : <div className="space-y-2">{sessions.map(s => <SessionCard key={s.id} s={s} onDelete={onDelete} />)}</div>
      }
    </div>
  )
}

function SessionCard({ s, onDelete }) {
  const [confirming, setConfirming] = useState(false)
  const course = s.courses
  if (!course) return null

  const energyColor = ENERGY_COLOR[s.energy_level] ?? '#6b7280'

  return (
    <>
      <SwipeableRow onDelete={() => setConfirming(true)}>
        <div className="rounded-xl p-3 relative" style={{ backgroundColor: '#111113' }}>
          {/* Trash */}
          <button
            onClick={() => setConfirming(true)}
            className="absolute top-3 right-3 p-1"
            style={{ color: 'var(--text-3)' }}
            aria-label="Delete session"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
          </button>

          {/* Course + duration */}
          <div className="flex items-center gap-2 pr-8">
            <span className="text-base leading-none flex-shrink-0">{course.emoji}</span>
            <p className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--text-1)' }}>
              {course.name}
            </p>
            <span className="text-sm font-bold flex-shrink-0" style={{ color: '#10B981' }}>
              {fmtMins(s.duration_minutes)}
            </span>
          </div>

          {/* Resource + energy dot + time */}
          <div className="flex items-center gap-2 mt-1.5 pr-8">
            <p className="text-xs truncate flex-1" style={{ color: '#9ca3af' }}>
              {[s.resources?.name, s.pages_covered ? `p.${s.pages_covered}` : null].filter(Boolean).join(' · ') || '—'}
            </p>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {s.energy_level && (
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: energyColor }}
                  title={s.energy_level}
                />
              )}
              <span className="text-xs" style={{ color: '#6b7280' }}>
                {fmtRelativeTime(s.created_at)}
              </span>
            </div>
          </div>
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

// ── Skeleton helpers ──────────────────────────────────────────────────────────

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
    <div className="flex items-end gap-1" style={{ height: '80px' }}>
      {[55, 30, 70, 45, 85, 35, 60].map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm animate-pulse"
          style={{ height: `${h}%`, backgroundColor: 'var(--bg-surf)' }}
        />
      ))}
    </div>
  )
}
