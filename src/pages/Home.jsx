import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'
import Card from '../components/Card.jsx'

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
  const [sessions, setSessions] = useState(null)   // null = loading
  const [quizResults, setQuizResults] = useState([])
  const stats = useMemo(() => (sessions ? crunch(sessions, quizResults) : EMPTY), [sessions, quizResults])

  useEffect(() => {
    Promise.all([
      supabase.from('sessions').select('date, duration_minutes, course_id, courses(name, emoji, color)'),
      supabase.from('quiz_results').select('course_id, score_percent'),
    ]).then(([{ data: s }, { data: q }]) => {
      setSessions(s ?? [])
      setQuizResults(q ?? [])
    })
  }, [])

  const loading = sessions === null

  return (
    <div className="px-4 pt-8 pb-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: '#6b6b78' }}>{greeting()}</p>
          <h1 className="text-2xl font-bold mt-0.5" style={{ color: '#e8e8ec' }}>Ready to focus?</h1>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: '#6b6b78', border: '1px solid #2a2a30' }}
        >
          Sign out
        </button>
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
        <p className="text-sm font-semibold mb-4" style={{ color: '#e8e8ec' }}>Last 7 Days</p>
        {loading ? <BarSkeleton /> : <BarChart data={stats.chartData} />}
      </Card>

      {/* Per-course breakdown */}
      {(loading || stats.courses.length > 0) && (
        <Card>
          <p className="text-sm font-semibold mb-3" style={{ color: '#e8e8ec' }}>By Course</p>
          {loading
            ? <div className="space-y-2">{[0,1,2].map(i => <Skel key={i} h={52} />)}</div>
            : <div className="divide-y" style={{ borderColor: '#1d1d24' }}>
                {stats.courses.map(c => <CourseRow key={c.name} course={c} />)}
              </div>
          }
        </Card>
      )}

      {/* Quick start */}
      <Link
        to="/timer"
        className="flex items-center justify-center w-full py-3.5 rounded-2xl font-semibold text-sm"
        style={{ backgroundColor: '#7c6af7', color: '#fff' }}
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
        backgroundColor: hot ? '#1f1a2e' : '#111113',
        border: `1px solid ${hot ? '#3d2d70' : '#2a2a30'}`,
      }}
    >
      <span className="text-3xl leading-none flex-shrink-0">{hot ? '🔥' : '💤'}</span>
      <div className="min-w-0">
        <p className="font-bold text-base leading-tight" style={{ color: '#e8e8ec' }}>
          {hot ? `${streak}-day streak` : 'No streak yet'}
        </p>
        <p className="text-xs mt-0.5 leading-snug" style={{ color: '#6b6b78' }}>{sub}</p>
      </div>
    </div>
  )
}

function StatCard({ label, value, loading }) {
  return (
    <div className="rounded-2xl p-3" style={{ backgroundColor: '#111113', border: '1px solid #2a2a30' }}>
      <p className="text-[10px] font-medium mb-1.5 leading-none" style={{ color: '#6b6b78' }}>{label}</p>
      {loading
        ? <Skel h={22} />
        : <p className="text-lg font-bold leading-none" style={{ color: '#e8e8ec' }}>{value}</p>
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
                  ? '#7c6af7'
                  : minutes > 0 ? '#3a3064' : '#1d1d26',
              }}
            />
          )
        })}
      </div>

      {/* Day labels + minute labels */}
      <div className="flex gap-1.5 mt-2">
        {data.map(({ date, label, minutes, isToday }) => (
          <div key={date} className="flex-1 text-center space-y-0.5">
            <p className="text-[10px] font-medium" style={{ color: isToday ? '#7c6af7' : '#6b6b78' }}>{label}</p>
            {minutes > 0 && (
              <p className="text-[9px]" style={{ color: isToday ? '#a89ff7' : '#4a4a58' }}>
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
  if (pct >= 80) return '#10b981'
  if (pct >= 60) return '#f59e0b'
  return '#ef4444'
}

function CourseRow({ course: c }) {
  return (
    <div className="flex items-center gap-3 py-3">
      {/* Color dot + emoji */}
      <div className="relative flex-shrink-0">
        <span className="text-xl leading-none">{c.emoji}</span>
        <span
          className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border"
          style={{ backgroundColor: c.color, borderColor: '#111113' }}
        />
      </div>

      {/* Name + counts */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold leading-tight truncate" style={{ color: '#e8e8ec' }}>{c.name}</p>
          {c.avgScore !== null && (
            <span
              className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold"
              style={{ backgroundColor: scoreColor(c.avgScore) + '22', color: scoreColor(c.avgScore) }}
            >
              {c.avgScore}%
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: '#6b6b78' }}>
          {c.count} session{c.count !== 1 ? 's' : ''} · {fmtMins(c.totalMins)} total
        </p>
      </div>

      {/* Week hours */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold" style={{ color: '#e8e8ec' }}>{fmtMins(c.weekMins)}</p>
        <p className="text-[10px]" style={{ color: '#6b6b78' }}>this week</p>
      </div>
    </div>
  )
}

// ── Skeleton helpers ─────────────────────────────────────────────────────────

function Skel({ h }) {
  return (
    <div
      className="w-full rounded-xl animate-pulse"
      style={{ height: `${h}px`, backgroundColor: '#1a1a1e' }}
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
          style={{ height: `${h}%`, backgroundColor: '#1a1a1e' }}
        />
      ))}
    </div>
  )
}
