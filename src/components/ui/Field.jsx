export default function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</label>
      {children}
    </div>
  )
}
