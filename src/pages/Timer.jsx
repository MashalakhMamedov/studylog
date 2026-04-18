import { useState, useEffect, useRef } from 'react'
import Card from '../components/Card.jsx'
import { formatDuration } from '../lib/utils.js'

const MODES = [
  { label: 'Focus', duration: 25 * 60 },
  { label: 'Short Break', duration: 5 * 60 },
  { label: 'Long Break', duration: 15 * 60 },
]

export default function Timer() {
  const [modeIdx, setModeIdx] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(MODES[0].duration)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    setSecondsLeft(MODES[modeIdx].duration)
    setRunning(false)
  }, [modeIdx])

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(s => {
          if (s <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            return 0
          }
          return s - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const total = MODES[modeIdx].duration
  const progress = (total - secondsLeft) / total
  const r = 88
  const circumference = 2 * Math.PI * r

  const minutes = Math.floor(secondsLeft / 60).toString().padStart(2, '0')
  const seconds = (secondsLeft % 60).toString().padStart(2, '0')

  function reset() {
    setRunning(false)
    setSecondsLeft(MODES[modeIdx].duration)
  }

  return (
    <div className="px-4 pt-8 pb-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: '#e8e8ec' }}>Focus Timer</h1>

      <div className="flex gap-2">
        {MODES.map(({ label }, i) => (
          <button
            key={label}
            onClick={() => setModeIdx(i)}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-colors"
            style={{
              backgroundColor: modeIdx === i ? '#7c6af7' : '#1a1a1e',
              color: modeIdx === i ? '#fff' : '#6b6b78',
              border: '1px solid #2a2a30',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col items-center py-4">
        <svg width="200" height="200" className="-rotate-90">
          <circle cx="100" cy="100" r={r} fill="none" stroke="#2a2a30" strokeWidth="8" />
          <circle
            cx="100" cy="100" r={r} fill="none"
            stroke="#7c6af7" strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>
        <div className="absolute flex flex-col items-center" style={{ marginTop: '72px' }}>
          <span className="text-5xl font-bold tabular-nums" style={{ color: '#e8e8ec' }}>
            {minutes}:{seconds}
          </span>
          <span className="text-sm mt-1" style={{ color: '#6b6b78' }}>{MODES[modeIdx].label}</span>
        </div>
      </div>

      <div className="flex gap-3 justify-center pt-20">
        <button
          onClick={reset}
          className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ backgroundColor: '#1a1a1e', color: '#6b6b78', border: '1px solid #2a2a30' }}
        >
          Reset
        </button>
        <button
          onClick={() => setRunning(r => !r)}
          className="px-10 py-3 rounded-xl font-semibold text-sm"
          style={{ backgroundColor: '#7c6af7', color: '#fff' }}
        >
          {running ? 'Pause' : 'Start'}
        </button>
      </div>
    </div>
  )
}
