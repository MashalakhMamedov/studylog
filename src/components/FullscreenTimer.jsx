import { useState, useEffect, useRef } from 'react'

function fmtFullTime(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export default function FullscreenTimer({ totalSeconds, running, segment, onPause, onResume, onFinish, onExit }) {
  const [controlsVisible, setControlsVisible] = useState(true)
  const [confirmingStop, setConfirmingStop]   = useState(false)
  const hideRef = useRef(null)

  // ── Auto-hide controls ────────────────────────────────────────────────────

  function scheduleHide() {
    clearTimeout(hideRef.current)
    hideRef.current = setTimeout(() => {
      setControlsVisible(false)
      setConfirmingStop(false)
    }, 3000)
  }

  function showControls() {
    setControlsVisible(true)
    scheduleHide()
  }

  useEffect(() => {
    scheduleHide()
    return () => clearTimeout(hideRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Wake Lock ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let wl = null

    async function acquire() {
      try { wl = await navigator.wakeLock?.request('screen') } catch {}
    }

    acquire()

    function onVis() {
      if (!document.hidden) acquire()
    }
    document.addEventListener('visibilitychange', onVis)

    return () => {
      wl?.release().catch(() => {})
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // ── Exit on browser-native fullscreen dismiss (Esc / Android back) ────────

  useEffect(() => {
    function onFsChange() {
      if (!document.fullscreenElement) onExit()
    }
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [onExit])

  // ── Interaction handlers ──────────────────────────────────────────────────

  function handleBackgroundTap() {
    if (confirmingStop) setConfirmingStop(false)
    showControls()
  }

  function handlePauseResume(e) {
    e.stopPropagation()
    running ? onPause() : onResume()
    showControls()
  }

  function handleStopTap(e) {
    e.stopPropagation()
    setConfirmingStop(true)
    clearTimeout(hideRef.current) // keep controls visible during confirmation
  }

  function handleConfirmStop(e) {
    e.stopPropagation()
    onExit()
    onFinish()
  }

  function handleCancelStop(e) {
    e.stopPropagation()
    setConfirmingStop(false)
    showControls()
  }

  function handleExit(e) {
    e.stopPropagation()
    onExit()
  }

  // ── Derived display values ────────────────────────────────────────────────

  const courseLine   = [segment.courseEmoji, segment.courseName].filter(Boolean).join(' ')
  const resourceLine = segment.resourceName

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none overflow-hidden"
      style={{
        backgroundColor: '#0a0a0b',
        cursor: controlsVisible ? 'default' : 'none',
        touchAction: 'none',
      }}
      onClick={handleBackgroundTap}
    >

      {/* ── Exit button — top right ─────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 400ms ease',
          pointerEvents: controlsVisible ? 'auto' : 'none',
        }}
      >
        <button
          onClick={handleExit}
          aria-label="Exit fullscreen"
          style={{
            position: 'absolute', top: 20, right: 20,
            width: 44, height: 44, borderRadius: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'transparent',
            color: 'rgba(255,255,255,0.38)',
            border: '1px solid rgba(255,255,255,0.12)',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 20, height: 20 }}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* ── Center content — always visible, breathing ──────────────────── */}
      <div
        className="flex flex-col items-center gap-5 px-8 text-center"
        style={{ animation: 'breathe 4s ease-in-out infinite' }}
      >
        {/* Timer */}
        <span
          className="font-mono tabular-nums tracking-tight leading-none"
          style={{
            fontSize: 'clamp(64px, 18vw, 108px)',
            fontWeight: 700,
            color: '#ffffff',
            letterSpacing: '-0.03em',
          }}
        >
          {fmtFullTime(totalSeconds)}
        </span>

        {/* Course + resource */}
        <div className="flex flex-col items-center gap-1">
          <span style={{ color: 'rgba(255,255,255,0.52)', fontSize: 17, fontWeight: 500, lineHeight: 1.3 }}>
            {courseLine}
          </span>
          {resourceLine && (
            <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 14, lineHeight: 1.3 }}>
              {resourceLine}
            </span>
          )}
        </div>

        {/* Status */}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: running ? 'rgba(16,185,129,0.75)' : 'rgba(255,255,255,0.22)',
            transition: 'color 400ms ease',
          }}
        >
          {running ? 'Recording' : 'Paused'}
        </span>
      </div>

      {/* ── Bottom controls ─────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 52,
          left: 0, right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          opacity: controlsVisible ? 1 : 0,
          transition: 'opacity 400ms ease',
          pointerEvents: controlsVisible ? 'auto' : 'none',
        }}
      >
        {confirmingStop ? (

          /* Stop confirmation */
          <div
            className="flex flex-col items-center gap-5"
            onClick={e => e.stopPropagation()}
          >
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
              Finish and save this session?
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={handleCancelStop}
                style={{
                  padding: '11px 28px', borderRadius: 24,
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: 'rgba(255,255,255,0.75)',
                  backgroundColor: 'transparent',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Keep Going
              </button>
              <button
                onClick={handleConfirmStop}
                style={{
                  padding: '11px 28px', borderRadius: 24,
                  backgroundColor: '#10B981',
                  color: '#fff',
                  border: 'none',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Finish
              </button>
            </div>
          </div>

        ) : (

          /* Normal controls */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>

              {/* Pause / Resume */}
              <button
                onClick={handlePauseResume}
                aria-label={running ? 'Pause' : 'Resume'}
                style={{
                  width: 68, height: 68, borderRadius: 34,
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {running ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 28, height: 28 }}>
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 28, height: 28 }}>
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                )}
              </button>

              {/* Finish / Stop */}
              <button
                onClick={handleStopTap}
                aria-label="Finish session"
                style={{
                  width: 52, height: 52, borderRadius: 26,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.13)',
                  color: 'rgba(255,255,255,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 22, height: 22 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </button>
            </div>

            {/* Tap hint */}
            <p style={{ color: 'rgba(255,255,255,0.18)', fontSize: 11, margin: 0 }}>
              Tap anywhere to hide controls
            </p>
          </>
        )}
      </div>

    </div>
  )
}
