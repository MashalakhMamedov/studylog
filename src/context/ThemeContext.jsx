import { createContext, useContext, useState, useEffect } from 'react'

export const COLORS = [
  { name: 'Emerald', value: '#10B981' },
  { name: 'Blue',    value: '#3B82F6' },
  { name: 'Cyan',    value: '#06B6D4' },
  { name: 'Amber',   value: '#F59E0B' },
  { name: 'Orange',  value: '#F97316' },
  { name: 'Red',     value: '#EF4444' },
  { name: 'Purple',  value: '#8B5CF6' },
  { name: 'Pink',    value: '#EC4899' },
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
    () => localStorage.getItem('studylog-accent') || '#10B981'
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
