import { Link } from 'react-router-dom'
import Card from '../components/Card.jsx'
import { supabase } from '../lib/supabase.js'

const stats = [
  { label: 'Today', value: '0h 0m' },
  { label: 'This Week', value: '0h 0m' },
  { label: 'Sessions', value: '0' },
  { label: 'Streak', value: '0 days' },
]

export default function Home() {
  return (
    <div className="px-4 pt-8 pb-6 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm" style={{ color: '#6b6b78' }}>Good morning</p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: '#e8e8ec' }}>Ready to focus?</h1>
        </div>
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs px-3 py-1.5 rounded-lg"
          style={{ color: '#6b6b78', border: '1px solid #2a2a30' }}
        >
          Sign out
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value }) => (
          <Card key={label}>
            <p className="text-xs mb-1" style={{ color: '#6b6b78' }}>{label}</p>
            <p className="text-xl font-semibold" style={{ color: '#e8e8ec' }}>{value}</p>
          </Card>
        ))}
      </div>

      <Card>
        <p className="text-sm font-medium mb-3" style={{ color: '#6b6b78' }}>Quick Start</p>
        <Link
          to="/timer"
          className="flex items-center justify-center w-full py-3 rounded-xl font-semibold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#7c6af7', color: '#fff' }}
        >
          Start Focus Session
        </Link>
      </Card>

      <Card>
        <p className="text-sm font-medium mb-3" style={{ color: '#6b6b78' }}>Recent Sessions</p>
        <p className="text-sm text-center py-4" style={{ color: '#6b6b78' }}>No sessions yet. Start focusing!</p>
      </Card>
    </div>
  )
}
