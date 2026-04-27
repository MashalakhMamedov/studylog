import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, Clock3, CirclePlay, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import SwipeableRow from '../components/SwipeableRow.jsx'
import BottomSheet from '../components/BottomSheet.jsx'
import EmptyState from '../components/EmptyState.jsx'
import { SkeletonCard } from '../components/Skeleton.jsx'

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
  return new Date().toLocaleDateString(navigator.language, { weekday: 'long', day: 'numeric', month: 'long' })
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

function fmtCardDuration(m) {
  if (!m) return '0 min'
  const h = Math.floor(m / 60)
  const min = m % 60
  if (h === 0) return `${min} min`
  if (min === 0) return `${h}h`
  return `${h}h ${min}m`
}

function fmtRelativeTime(createdAt) {
  if (!createdAt) return ''
  const diff = (Date.now() - new Date(createdAt).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) {
    const mins = Math.floor(diff / 60)
    return `${mins} minute${mins === 1 ? '' : 's'} ago`
  }
  if (diff < 86400) {
    const hours = Math.floor(diff / 3600)
    return `${hours} hour${hours === 1 ? '' : 's'} ago`
  }
  if (diff < 172800) return 'Yesterday'
  if (diff < 604800) return new Date(createdAt).toLocaleDateString('en-US', { weekday: 'short' })
  return new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Count-up animation ────────────────────────────────────────────────────────

function useCountUp(target, duration = 600) {
  const [count, setCount] = useState(0)
  const rafRef = useRef(null)
  useEffect(() => {
    if (target == null) { setCount(0); return }
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setCount(target); return
    }
    let startTime = null
    function tick(now) {
      if (!startTime) startTime = now
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(target * eased))
      if (progress < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration])
  return count
}

const ENERGY_COLOR = {
  high: '#22c55e',
  medium: '#eab308',
  low: '#ef4444',
  post_night_shift: '#8b5cf6',
}

const ENERGY_LABEL = { high: 'High', medium: 'Medium', low: 'Low', post_night_shift: 'Post-Night-Shift' }

const FOCUS_LABEL = {
  deep_focus: 'Deep Focus', light_review: 'Light Review',
  practice: 'Practice', video: 'Video Lecture', project: 'Project Work',
}

// ── Stats computation ─────────────────────────────────────────────────────────

function computeStats(allSessions, courses = []) {
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

  const todayCourseMap = {}
  todaySessions.forEach(s => {
    if (s.course_id) todayCourseMap[s.course_id] = (todayCourseMap[s.course_id] || 0) + (s.duration_minutes || 0)
  })
  const topCourseId = Object.entries(todayCourseMap).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null
  const topCourseToday = courses.find(c => c.id === topCourseId) ?? null

  return {
    todayMins,
    todaySessionCount: todaySessions.length,
    todayPages,
    chartData,
    weekSessionsMap,
    streak: calcStreak(allSessions),
    topCourseToday,
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  const { session: authSession } = useAuth()
  const { theme, toggleTheme, accentColor } = useTheme()

  const [allSessions, setAllSessions] = useState(null)
  const [activeCourses, setActiveCourses] = useState(null)
  const [recentSessions, setRecentSessions] = useState(null)
  const [deleteError, setDeleteError] = useState(false)
  const [hasError, setHasError] = useState(false)

  const stats = useMemo(
    () => allSessions && activeCourses ? computeStats(allSessions, activeCourses) : null,
    [allSessions, activeCourses]
  )
  const loading = allSessions === null || activeCourses === null

  const meta = authSession?.user?.user_metadata ?? {}
  const firstName = meta.first_name || meta.full_name?.split(' ')[0] || ''
  const greetingText = firstName ? `${greeting()}, ${firstName}` : greeting()

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('id, date, duration_minutes, pages_covered, course_id'),
      supabase.from('courses').select('id, name, emoji, color').eq('status', 'active').order('name'),
      supabase.from('sessions')
        .select('id, date, duration_minutes, pages_covered, focus_type, energy_level, notes, created_at, course_id, courses(name, emoji, color), resources(name)')
        .order('created_at', { ascending: false })
        .limit(7),
    ]).then(([{ data: s }, { data: c }, { data: r }]) => {
      setAllSessions(s ?? [])
      setActiveCourses(c ?? [])
      setRecentSessions(r ?? [])
    }).catch(() => {
      setAllSessions([])
      setActiveCourses([])
      setRecentSessions([])
      setHasError(true)
    })
  }, [])

  useEffect(() => {
    if (!deleteError) return
    const t = setTimeout(() => setDeleteError(false), 3000)
    return () => clearTimeout(t)
  }, [deleteError])

  async function handleDeleteSession(id) {
    const { error } = await supabase.from('sessions').delete().eq('id', id).eq('user_id', authSession.user.id)
    if (error) { setDeleteError(true); return }
    setRecentSessions(prev => prev?.filter(s => s.id !== id) ?? [])
    setAllSessions(prev => prev?.filter(s => s.id !== id) ?? [])
  }

  return (
    <div className="px-4 pt-8 pb-6 space-y-6">

      {/* 1 — Greeting */}
      <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '0ms' }}>
        <div className="flex items-start justify-between">
          <div className="space-y-0.5 min-w-0 flex-1">
            <h1 className="text-2xl font-semibold leading-tight" style={{ color: 'var(--text-1)' }}>
              {greetingText}
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>{formatHeaderDate()}</p>
            <p className="text-sm font-medium" style={{ color: accentColor }}>
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

      {hasError ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-2)' }}>
          Could not load data. Try refreshing.
        </p>
      ) : (
        <>
          {/* 2 — Today's Summary */}
          <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '80ms' }}>
            <TodaySummaryCard stats={stats} loading={loading} />
          </div>

          {/* 3 — Weekly Dots */}
          <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '160ms' }}>
            <WeeklyDots chartData={stats?.chartData} loading={loading} />
          </div>
        </>
      )}

      {/* 4 — Quick Actions */}
      <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '240ms' }}>
        <QuickActions />
      </div>

      {!hasError && (
        <>
          {/* 5 — Active Courses */}
          {!loading && activeCourses?.length > 0 && (
            <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '320ms' }}>
              <CoursesRow courses={activeCourses} weekSessionsMap={stats?.weekSessionsMap ?? {}} />
            </div>
          )}

          {/* 6 — Recent Sessions */}
          {(loading || recentSessions !== null) && (
            <div style={{ animation: 'sectionFadeIn 400ms ease both', animationDelay: '400ms' }}>
              <RecentSessionsList sessions={recentSessions} loading={loading} onDelete={handleDeleteSession} />
            </div>
          )}
        </>
      )}

      {deleteError && <Toast message="Could not delete session. Try again." />}

    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TodaySummaryCard({ stats, loading }) {
  const { accentColor } = useTheme()
  const navigate = useNavigate()
  const animatedMins = useCountUp(stats?.todayMins ?? null)
  const animatedCount = useCountUp(stats?.todaySessionCount ?? null)

  if (loading) {
    return (
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <Skel h={52} />
      </div>
    )
  }

  if (stats.todaySessionCount === 0) {
    return (
      <div
        className="rounded-xl px-4 py-3 flex items-center gap-4"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <CalendarClock size={22} strokeWidth={1.7} className="flex-shrink-0" style={{ color: 'var(--text-3)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>No study sessions today yet</p>
        </div>
        <button
          onClick={() => navigate('/session?mode=focus')}
          className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap"
          style={{ backgroundColor: accentColor, color: '#fff' }}
        >
          <CirclePlay size={14} strokeWidth={2.4} />
          Start a session
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center">
        <div className="flex-1 text-center">
          <p className="text-xl font-semibold tabular-nums leading-none" style={{ color: accentColor }}>
            {fmtMins(animatedMins)}
          </p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>studied</p>
        </div>

        <div style={{ width: 1, height: 36, backgroundColor: 'var(--border)', flexShrink: 0 }} />

        <div className="flex-1 text-center">
          <p className="text-xl font-semibold tabular-nums leading-none" style={{ color: 'var(--text-1)' }}>
            {animatedCount}
          </p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>sessions</p>
        </div>

        <div style={{ width: 1, height: 36, backgroundColor: 'var(--border)', flexShrink: 0 }} />

        <div className="flex-1 text-center px-1">
          {stats.topCourseToday ? (
            <>
              <p className="text-xl leading-none">{stats.topCourseToday.emoji}</p>
              <p
                className="text-xs mt-1.5 truncate"
                style={{ color: 'var(--text-3)' }}
                title={stats.topCourseToday.name}
              >
                {stats.topCourseToday.name}
              </p>
            </>
          ) : (
            <p className="text-xl font-bold leading-none" style={{ color: 'var(--text-3)' }}>—</p>
          )}
        </div>
      </div>
    </div>
  )
}

function WeeklyDots({ chartData, loading }) {
  const { accentColor } = useTheme()

  if (loading) {
    return (
      <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <Skel h={38} />
      </div>
    )
  }

  return (
    <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between">
        {chartData?.map(({ date, label, minutes, isToday, isFuture }) => {
          const studied = minutes > 0
          return (
            <div key={date} className="flex flex-col items-center gap-2">
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isToday ? 700 : 500,
                  color: isToday ? accentColor : 'var(--text-3)',
                  lineHeight: 1,
                }}
              >
                {label}
              </span>
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor: studied ? accentColor : 'transparent',
                  border: isToday && !studied
                    ? `2px solid ${accentColor}`
                    : studied ? 'none'
                    : '1.5px solid var(--border)',
                  opacity: isFuture ? 0.25 : 1,
                  flexShrink: 0,
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function QuickActions() {
  const navigate = useNavigate()
  const { accentColor } = useTheme()

  const actions = [
    {
      label: 'Focus',
      href: '/session?mode=focus',
      primary: true,
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
        </svg>
      ),
    },
    {
      label: 'Log',
      href: '/session?mode=log',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    },
    {
      label: 'Material',
      href: '/courses',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      ),
    },
  ]

  return (
    <div className="flex gap-2.5">
      {actions.map(({ label, href, primary, icon }) => (
        <button
          key={label}
          onClick={() => navigate(href)}
          className="flex-1 flex flex-col items-center gap-2 py-3.5 rounded-xl"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: primary ? `1px solid ${accentColor}44` : '1px solid var(--border)',
            color: primary ? accentColor : 'var(--text-3)',
          }}
        >
          {icon}
          <span style={{ fontSize: 11, fontWeight: 600, lineHeight: 1 }}>{label}</span>
        </button>
      ))}
    </div>
  )
}

function CoursesRow({ courses, weekSessionsMap }) {
  const { accentColor } = useTheme()
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Your Courses</p>
        <Link to="/courses" className="text-xs font-medium" style={{ color: accentColor }}>See all</Link>
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
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
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
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
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
  const { accentColor } = useTheme()
  const [selected, setSelected] = useState(null)

  function handleDelete(id) {
    onDelete(id)
    setSelected(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Recent Sessions</p>
        <Link to="/session?mode=log" className="text-xs font-medium" style={{ color: accentColor }}>See all</Link>
      </div>
      {loading
        ? <div className="space-y-2">{[0, 1, 2].map(i => <Skel key={i} h={72} />)}</div>
        : sessions.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title="Your study sessions will appear here"
            description="Log a session or use the focus timer to get started"
            compact
          />
        ) : <div className="space-y-2">{sessions.map((s, i) => (
            <div key={s.id} className="stagger-in" style={{ animationDelay: `${Math.min(i, 5) * 50}ms` }}>
              <SessionCard s={s} onDelete={onDelete} onTap={() => setSelected(s)} />
            </div>
          ))}</div>
      }
      <SessionDetailSheet
        session={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
      />
    </div>
  )
}

function SessionCard({ s, onDelete, onTap }) {
  const [confirming, setConfirming] = useState(false)
  const course = s.courses
  if (!course) return null

  const accent = course.color || '#6366f1'
  const resourceText = [s.resources?.name, s.pages_covered ? `p.${s.pages_covered}` : null].filter(Boolean).join(' · ') || '—'

  return (
    <SwipeableRow onDelete={() => setConfirming(true)} bg="#111113">
      <div
        className="relative w-full rounded-xl p-3 pr-10 text-left transition-colors hover:bg-[#1a1a1d] active:bg-[#1a1a1d]"
        style={{ backgroundColor: '#111113', borderLeft: `3px solid ${accent}` }}
      >
        {confirming ? (
          <div className="flex items-center justify-end gap-2 min-h-[58px] text-xs">
            <span style={{ color: '#f87171' }}>Delete?</span>
            <button onClick={() => onDelete(s.id)} className="font-semibold" style={{ color: '#ef4444' }}>
              ✓ Yes
            </button>
            <button onClick={() => setConfirming(false)} className="font-semibold" style={{ color: '#9ca3af' }}>
              ✗ No
            </button>
          </div>
        ) : (
          <>
            <button onClick={onTap} className="block w-full text-left">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base leading-none flex-shrink-0">{course.emoji}</span>
                <p className="text-sm font-bold truncate" style={{ color: '#fff' }}>
                  {course.name}
                </p>
              </div>
              <p className="mt-1 text-xs truncate" style={{ color: '#9ca3af' }}>
                {resourceText}
              </p>
              <div className="flex items-center justify-between gap-3 mt-1.5 text-xs">
                <span className="font-medium tabular-nums" style={{ color: '#9ca3af' }}>
                  {fmtCardDuration(s.duration_minutes)}
                </span>
                <span className="truncate text-right" style={{ color: '#9ca3af' }}>
                  {fmtRelativeTime(s.created_at)}
                </span>
              </div>
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="absolute right-2.5 top-2.5 p-1"
              style={{ color: '#6b7280' }}
              aria-label="Delete session"
            >
              <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </>
        )}
      </div>
    </SwipeableRow>
  )

}

function SessionDetailSheet({ session: s, open, onClose, onDelete }) {
  const { accentColor } = useTheme()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { if (!open) setConfirming(false) }, [open])

  if (!s) return null

  const course = s.courses
  const energyColor = ENERGY_COLOR[s.energy_level] ?? 'var(--text-3)'

  function fmtDetailDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString(navigator.language, {
      weekday: 'long', day: 'numeric', month: 'long',
    })
  }

  function fmtDetailTime(iso) {
    return new Date(iso).toLocaleTimeString(navigator.language, { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-5 pb-10">

        {/* Course header */}
        <div className="flex items-center gap-3 pb-4 mb-1" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-3xl leading-none flex-shrink-0">{course?.emoji}</span>
          <div className="min-w-0">
            <p className="font-bold text-base leading-tight" style={{ color: 'var(--text-1)' }}>
              {course?.name}
            </p>
            <span
              className="inline-block mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${course?.color}22`, color: course?.color }}
            >
              {fmtMins(s.duration_minutes)}
            </span>
          </div>
        </div>

        {/* Detail rows */}
        <div>
          <DetailRow label="Date">{fmtDetailDate(s.date)}</DetailRow>
          <DetailRow label="Logged at">{fmtDetailTime(s.created_at)}</DetailRow>
          {s.resources?.name && (
            <DetailRow label="Resource">{s.resources.name}</DetailRow>
          )}
          {s.pages_covered && (
            <DetailRow label="Pages">{s.pages_covered}</DetailRow>
          )}
          {s.focus_type && (
            <DetailRow label="Focus">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
              >
                {FOCUS_LABEL[s.focus_type] ?? s.focus_type}
              </span>
            </DetailRow>
          )}
          {s.energy_level && (
            <DetailRow label="Energy">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${energyColor}22`, color: energyColor }}
              >
                {ENERGY_LABEL[s.energy_level] ?? s.energy_level}
              </span>
            </DetailRow>
          )}
        </div>

        {/* Notes */}
        {s.notes && (
          <div className="py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-3)' }}>Notes</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-1)' }}>{s.notes}</p>
          </div>
        )}

        {/* Delete */}
        <div className="pt-5">
          {confirming ? (
            <div className="space-y-3">
              <p className="text-sm text-center" style={{ color: 'var(--text-2)' }}>
                Delete this session? This can't be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirming(false)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: 'var(--bg-surf)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => onDelete(s.id)}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: '#ef4444', color: '#fff' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ backgroundColor: '#ef444418', color: '#ef4444', border: '1px solid #ef444428' }}
            >
              Delete Session
            </button>
          )}
        </div>
      </div>
    </BottomSheet>
  )
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm flex-shrink-0" style={{ color: 'var(--text-3)' }}>{label}</span>
      <span className="text-sm font-medium text-right" style={{ color: 'var(--text-1)' }}>{children}</span>
    </div>
  )
}

// ── Skeleton helpers ──────────────────────────────────────────────────────────

function Skel({ h }) {
  return <SkeletonCard height={h} radius={12} />
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }) {
  return (
    <div className="fixed top-16 left-0 right-0 flex justify-center z-[70] pointer-events-none px-4">
      <div
        className="flex items-center gap-2 px-4 py-3 rounded-2xl pointer-events-auto"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          animation: 'toastSlideDown 250ms ease both',
        }}
      >
        <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: '#ef4444' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </span>
        <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{message}</span>
      </div>
    </div>
  )
}
