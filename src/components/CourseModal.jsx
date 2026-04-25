import { useTheme } from '../context/ThemeContext.jsx'

export const COLOR_SWATCHES = [
  '#E63946', '#6366f1', '#a855f7', '#ec4899',
  '#ef4444', '#fb923c', '#f59e0b', '#84cc16',
  '#10b981', '#06b6d4', '#0ea5e9', '#64748b',
]

export const STATUS_OPTIONS = ['active', 'backlog', 'completed']
export const PRIORITY_OPTIONS = ['high', 'medium', 'low']
export const STATUS_COLOR = { active: '#22c55e', backlog: '#f59e0b', completed: '#a1a1aa' }
export const PRIORITY_COLOR = { high: '#ef4444', medium: '#eab308', low: 'var(--text-3)' }
export const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 }
export const EMPTY_COURSE_FORM = {
  name: '', emoji: '📚', color: '#E63946',
  status: 'active', priority: 'medium', exam_date: '',
}

export function CourseModal({ form, setForm, editing, saving, error, onSave, onClose }) {
  const { accentColor } = useTheme()
  const canSave = form.name.trim().length > 0 && !saving

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: 'var(--modal-overlay)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-1)' }}>
            {editing ? 'Edit Course' : 'New Course'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--text-2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Emoji + Name */}
        <div className="flex gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Emoji</label>
            <input
              type="text"
              value={form.emoji}
              onChange={e => setForm(f => ({ ...f, emoji: e.target.value }))}
              className="w-14 h-10 rounded-xl text-center text-xl outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              maxLength={2}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. PEED"
              maxLength={60}
              className="h-10 px-3 rounded-xl text-sm w-full outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
              onKeyDown={e => e.key === 'Enter' && canSave && onSave()}
            />
          </div>
        </div>

        {/* Color swatches */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Color</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map((c, i) => (
              <button
                key={i}
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className="w-7 h-7 rounded-full transition-transform"
                style={{
                  backgroundColor: c,
                  transform: form.color === c ? 'scale(1.25)' : 'scale(1)',
                  outline: form.color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Status + Priority */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="h-10 px-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Priority</label>
            <select
              value={form.priority}
              onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
              className="h-10 px-3 rounded-xl text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
            >
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Exam date */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Exam Date (optional)</label>
          <input
            type="date"
            value={form.exam_date || ''}
            onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))}
            className="h-10 px-3 rounded-xl text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-surf)', border: '1px solid var(--border)', color: 'var(--text-1)' }}
          />
        </div>

        {/* Live preview */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
          <div className="h-1" style={{ backgroundColor: form.color }} />
          <div className="px-3 py-2.5 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-surf)' }}>
            <span className="text-2xl leading-none">{form.emoji}</span>
            <div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-1)' }}>{form.name || 'Course name'}</p>
              <p className="text-xs capitalize" style={{ color: 'var(--text-2)' }}>{form.status} · {form.priority}</p>
            </div>
          </div>
        </div>

        {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}

        <button
          onClick={onSave}
          disabled={!canSave}
          className="w-full py-3 rounded-xl font-semibold text-sm"
          style={{
            backgroundColor: canSave ? accentColor : 'var(--bg-surf)',
            color: canSave ? '#fff' : 'var(--text-2)',
            border: canSave ? 'none' : '1px solid var(--border)',
          }}
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Course'}
        </button>
      </div>
    </div>
  )
}
