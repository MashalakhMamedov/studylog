export default function Card({ children, className = '', hoverable = false }) {
  return (
    <div
      className={`rounded-2xl p-4 ${hoverable ? 'hoverable-card' : ''} ${className}`}
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      {children}
    </div>
  )
}
