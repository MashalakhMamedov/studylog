export default function Toast({ message = 'Session logged', error = false }) {
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
        <span className="flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: error ? '#ef4444' : '#22c55e' }}>
          {error
            ? <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" className="w-3 h-3"><polyline points="20 6 9 17 4 12" /></svg>
          }
        </span>
        <span className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-1)' }}>{message}</span>
      </div>
    </div>
  )
}
