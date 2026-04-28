import { useState } from 'react'
import Toast from '../components/ui/Toast.jsx'

export function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtMins(minutes = 0) {
  const total = Math.max(0, Math.round(minutes || 0))
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function calcStreak(sessions) {
  const dates = new Set(sessions.map(s => s.date))
  let streak = 0
  const cursor = new Date()
  if (!dates.has(localDateStr(cursor))) cursor.setDate(cursor.getDate() - 1)
  while (dates.has(localDateStr(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const showToast = (message, type = 'success') => setToast({ message, type })
  const dismissToast = () => setToast(null)
  const ToastComponent = toast ? <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} /> : null
  return { showToast, ToastComponent }
}
