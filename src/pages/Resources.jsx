import { useState } from 'react'
import Card from '../components/Card.jsx'

const categories = ['All', 'Notes', 'Links', 'Files']

export default function Resources() {
  const [active, setActive] = useState('All')

  return (
    <div className="px-4 pt-8 pb-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: '#e8e8ec' }}>Materials</h1>
        <button
          className="w-9 h-9 flex items-center justify-center rounded-xl text-lg font-bold"
          style={{ backgroundColor: '#7c6af7', color: '#fff' }}
        >
          +
        </button>
      </div>

      <div className="flex gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{
              backgroundColor: active === cat ? '#7c6af7' : '#1a1a1e',
              color: active === cat ? '#fff' : '#6b6b78',
              border: '1px solid #2a2a30',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      <Card>
        <div className="text-center py-8 space-y-2">
          <p className="text-lg" style={{ color: '#6b6b78' }}>No materials yet</p>
          <p className="text-sm" style={{ color: '#6b6b78' }}>Add notes, links, or files to get started</p>
        </div>
      </Card>
    </div>
  )
}
