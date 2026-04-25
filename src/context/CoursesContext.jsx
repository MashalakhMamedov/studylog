import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const CoursesContext = createContext(null)

export function CoursesProvider({ children }) {
  const { session, loading } = useAuth()
  const [activeCourseCount, setActiveCourseCount] = useState(null)

  const refreshActiveCourseCount = useCallback(async () => {
    if (!session?.user) {
      setActiveCourseCount(null)
      return
    }

    const { count, error } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')

    if (!error) setActiveCourseCount(count ?? 0)
  }, [session?.user?.id])

  useEffect(() => {
    if (!loading) refreshActiveCourseCount()
  }, [loading, refreshActiveCourseCount])

  return (
    <CoursesContext.Provider value={{ activeCourseCount, refreshActiveCourseCount }}>
      {children}
    </CoursesContext.Provider>
  )
}

export function useCourses() {
  return useContext(CoursesContext)
}
