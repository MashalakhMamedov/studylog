import { useEffect, useMemo, useState } from 'react'
import { useTheme } from '../context/ThemeContext.jsx'
import { supabase } from '../lib/supabase.js'
import { SkeletonCard } from '../components/Skeleton.jsx'

function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function fmtMins(minutes = 0) {
  const total = Math.max(0, Math.round(minutes || 0))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

function lastSevenDays() {
  const today = new Date()
  const start = addDays(today, -6)
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i)
    const value = localDateStr(date)
    return {
      date: value,
      label: date.toLocaleDateString(navigator.language, { weekday: 'short' }),
      isToday: value === localDateStr(today),
    }
  })
}

function monthStartStr() {
  const now = new Date()
  return localDateStr(new Date(now.getFullYear(), now.getMonth(), 1))
}

function calcStreak(sessions) {
  const dates = new Set(sessions.map(s => s.date))
  const cursor = new Date()
  let streak = 0

  while (dates.has(localDateStr(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

function buildStats(weekSessions, monthSessions, streakSessions) {
  const days = lastSevenDays()
  const dayMinutes = Object.fromEntries(days.map(day => [day.date, 0]))

  weekSessions.forEach(session => {
    if (session.date in dayMinutes) {
      dayMinutes[session.date] += session.duration_minutes || 0
    }
  })

  const courseTotals = new Map()
  weekSessions.forEach(session => {
    const course = session.courses
    if (!course || !session.course_id) return
    const existing = courseTotals.get(session.course_id) ?? {
      id: session.course_id,
      name: course.name,
      emoji: course.emoji,
      minutes: 0,
    }
    existing.minutes += session.duration_minutes || 0
    courseTotals.set(session.course_id, existing)
  })

  return {
    weekMinutes: weekSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
    weekCount: weekSessions.length,
    monthMinutes: monthSessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0),
    monthCount: monthSessions.length,
    chartData: days.map(day => ({ ...day, minutes: dayMinutes[day.date] })),
    topCourses: [...courseTotals.values()]
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 3),
    streak: calcStreak(streakSessions),
  }
}

export default function StatsPage() {
  const { accentColor } = useTheme()
  const [weekSessions, setWeekSessions] = useState(null)
  const [monthSessions, setMonthSessions] = useState(null)
  const [streakSessions, setStreakSessions] = useState(null)
  const [error, setError] = useState('')

  const stats = useMemo(() => {
    if (!weekSessions || !monthSessions || !streakSessions) return null
    return buildStats(weekSessions, monthSessions, streakSessions)
  }, [weekSessions, monthSessions, streakSessions])

  useEffect(() => {
    const sevenDaysAgo = localDateStr(addDays(new Date(), -6))
    const monthStart = monthStartStr()

    Promise.all([
      supabase
        .from('sessions')
        .select('id, date, duration_minutes, course_id, courses(name, emoji)')
        .gte('date', sevenDaysAgo)
        .order('date', { ascending: true }),
      supabase
        .from('sessions')
        .select('id, date, duration_minutes')
        .gte('date', monthStart),
      supabase
        .from('sessions')
        .select('id, date')
        .order('date', { ascending: false }),
    ]).then(([weekResult, monthResult, streakResult]) => {
      const firstError = weekResult.error || monthResult.error || streakResult.error
      if (firstError) {
        setError(firstError.message)
        setWeekSessions([])
        setMonthSessions([])
        setStreakSessions([])
        return
      }

      setError('')
      setWeekSessions(weekResult.data ?? [])
      setMonthSessions(monthResult.data ?? [])
      setStreakSessions(streakResult.data ?? [])
    })
  }, [])

  const loading = !stats

  return (
    <div className="px-4 pt-5 pb-6 space-y-5">
      {error && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--tinted-red)', color: '#fecaca', border: '1px solid #7f1d1d' }}
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard title="This Week" minutes={stats?.weekMinutes} count={stats?.weekCount} loading={loading} />
        <SummaryCard title="This Month" minutes={stats?.monthMinutes} count={stats?.monthCount} loading={loading} />
      </div>

      <StreakCard streak={stats?.streak} loading={loading} accentColor={accentColor} />
      <ChartCard data={stats?.chartData} loading={loading} accentColor={accentColor} />
      <TopCourses courses={stats?.topCourses} loading={loading} accentColor={accentColor} />
    </div>
  )
}

function SummaryCard({ title, minutes = 0, count = 0, loading }) {
  if (loading) return <SkeletonCard height={110} radius={12} />

  return (
    <section
      className="rounded-xl p-4 min-w-0"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <p className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>{title}</p>
      <p className="mt-3 text-2xl font-semibold tabular-nums leading-none" style={{ color: 'var(--text-1)' }}>
        {fmtMins(minutes)}
      </p>
      <p className="mt-2 text-xs" style={{ color: 'var(--text-3)' }}>
        {count} session{count === 1 ? '' : 's'}
      </p>
    </section>
  )
}

function StreakCard({ streak = 0, loading, accentColor }) {
  if (loading) return <SkeletonCard height={128} radius={12} />

  return (
    <section
      className="rounded-xl p-5 flex items-center justify-between gap-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-2)' }}>
          Current Streak
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-3)' }}>
          Consecutive study days ending today
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-6xl font-black tabular-nums leading-none" style={{ color: accentColor }}>
          {streak}
        </p>
        <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
          day streak
        </p>
      </div>
    </section>
  )
}

function ChartCard({ data = [], loading, accentColor }) {
  if (loading) return <SkeletonCard height={206} radius={12} />

  const maxMinutes = Math.max(...data.map(day => day.minutes), 1)

  return (
    <section
      className="rounded-xl p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Last 7 Days</p>
        <p className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>{fmtMins(maxMinutes)} peak</p>
      </div>

      <div className="flex items-end justify-between gap-2 h-32">
        {data.map(day => {
          const height = day.minutes === 0 ? 4 : Math.max(8, Math.round((day.minutes / maxMinutes) * 100))
          return (
            <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2 h-full">
              <div className="flex items-end justify-center w-full h-24">
                <div
                  className="w-full max-w-7 rounded-t-lg"
                  title={`${day.label}: ${fmtMins(day.minutes)}`}
                  style={{
                    height: day.minutes === 0 ? '4px' : `${height}%`,
                    backgroundColor: day.isToday ? accentColor : `${accentColor}88`,
                    opacity: day.minutes === 0 ? 0.35 : 1,
                  }}
                />
              </div>
              <span
                className="text-[11px] font-medium truncate max-w-full"
                style={{ color: day.isToday ? accentColor : 'var(--text-3)' }}
              >
                {day.label}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TopCourses({ courses = [], loading, accentColor }) {
  if (loading) return <SkeletonCard height={176} radius={12} />

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Top Courses This Week</p>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {courses.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>No course time this week</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>Study sessions with courses will appear here.</p>
          </div>
        ) : courses.map((course, index) => (
          <div
            key={course.id}
            className="flex items-center gap-3 px-4 py-3"
            style={{ borderBottom: index === courses.length - 1 ? 'none' : '1px solid var(--border)' }}
          >
            <span className="text-xl leading-none flex-shrink-0">{course.emoji || '📚'}</span>
            <p className="flex-1 min-w-0 text-sm font-semibold truncate" style={{ color: 'var(--text-1)' }}>
              {course.name}
            </p>
            <span className="text-sm font-semibold tabular-nums flex-shrink-0" style={{ color: accentColor }}>
              {fmtMins(course.minutes)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
