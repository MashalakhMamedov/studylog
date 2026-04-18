export default function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-4 ${className}`}
      style={{ backgroundColor: '#111113', border: '1px solid #2a2a30' }}
    >
      {children}
    </div>
  )
}
