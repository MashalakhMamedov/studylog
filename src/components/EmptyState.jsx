export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionIcon: ActionIcon,
  onAction,
  compact = false,
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? 'gap-3 py-8' : 'gap-4 py-16'}`}>
      {Icon && (
        <div
          className="flex items-center justify-center rounded-2xl"
          style={{
            width: compact ? 52 : 64,
            height: compact ? 52 : 64,
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-3)',
          }}
        >
          <Icon size={compact ? 26 : 32} strokeWidth={1.7} />
        </div>
      )}

      <div className="space-y-1 max-w-[280px]">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
          {title}
        </p>
        {description && (
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          {ActionIcon && <ActionIcon size={16} strokeWidth={2.4} />}
          {actionLabel}
        </button>
      )}
    </div>
  )
}
