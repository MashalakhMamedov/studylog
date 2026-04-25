import { createContext, useContext, useState, useEffect } from 'react'

export const COLORS = [
  { name: 'Indigo',  value: '#6366f1' },
  { name: 'Violet',  value: '#8b5cf6' },
  { name: 'Blue',    value: '#3b82f6' },
  { name: 'Cyan',    value: '#06b6d4' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Amber',   value: '#f59e0b' },
  { name: 'Rose',    value: '#f43f5e' },
  { name: 'Pink',    value: '#ec4899' },
]

const ThemeContext = createContext(null)

export function useTheme() {
  return useContext(ThemeContext)
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'dark'
  )
  const [accentColor, setAccentColorState] = useState(
    () => localStorage.getItem('studylog-accent') || '#6366f1'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accentColor)
  }, [accentColor])

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }

  function setAccentColor(color) {
    setAccentColorState(color)
    localStorage.setItem('studylog-accent', color)
    document.documentElement.style.setProperty('--accent', color)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, accentColor, setAccentColor }}>
      {children}
    </ThemeContext.Provider>
  )
}
