import Card from '../components/Card.jsx'

export default function Sessions() {
  return (
    <div className="px-4 pt-8 pb-6 space-y-6">
      <h1 className="text-2xl font-bold" style={{ color: '#e8e8ec' }}>Session Log</h1>

      <div className="flex gap-2">
        {['All', 'Today', 'Week', 'Month'].map(filter => (
          <button
            key={filter}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: filter === 'All' ? '#7c6af7' : '#1a1a1e', color: filter === 'All' ? '#fff' : '#6b6b78', border: '1px solid #2a2a30' }}
          >
            {filter}
          </button>
        ))}
      </div>

      <Card>
        <div className="text-center py-8 space-y-2">
          <p className="text-lg" style={{ color: '#6b6b78' }}>No sessions recorded yet</p>
          <p className="text-sm" style={{ color: '#6b6b78' }}>Complete a focus session to see it here</p>
        </div>
      </Card>
    </div>
  )
}
