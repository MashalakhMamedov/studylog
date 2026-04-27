export const FOCUS_TYPES = [
  { value: 'deep_focus',   label: 'Deep Focus' },
  { value: 'light_review', label: 'Light Review' },
  { value: 'practice',     label: 'Practice' },
  { value: 'video',        label: 'Video Lecture' },
  { value: 'project',      label: 'Project Work' },
]

export const ENERGY_LEVELS = [
  { value: 'high',             label: 'High' },
  { value: 'medium',           label: 'Medium' },
  { value: 'low',              label: 'Low' },
  { value: 'post_night_shift', label: 'Post-Night-Shift' },
]

export const FOCUS_LABEL = {
  deep_focus:   'Deep Focus',
  light_review: 'Light Review',
  practice:     'Practice',
  video:        'Video Lecture',
  project:      'Project Work',
}

export const ENERGY_COLOR = {
  high:             '#22c55e',
  medium:           '#eab308',
  low:              '#ef4444',
  post_night_shift: '#8b5cf6',
}

// Note: CourseDetail.jsx used 'Post-Night' (truncated). Standardised to 'Post-Night-Shift'.
export const ENERGY_LABEL = {
  high:             'High',
  medium:           'Medium',
  low:              'Low',
  post_night_shift: 'Post-Night-Shift',
}

export const MAX_DURATION_MINUTES = 720

export const DEFAULT_POM_SETTINGS = {
  workMin:        25,
  shortBreakMin:  5,
  longBreakMin:   15,
  longBreakAfter: 4,
}
