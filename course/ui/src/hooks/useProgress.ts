import { useState, useCallback } from 'react'

const STORAGE_KEY = 'scalar_course_progress'

export interface CourseProgress {
  completedLessons: string[]
  quizScores: Record<string, number>
  moduleUnlocked: string[]
  lastVisited?: string
}

const DEFAULT_PROGRESS: CourseProgress = {
  completedLessons: [],
  quizScores: {},
  moduleUnlocked: ['m0'],
  lastVisited: undefined,
}

function load(): CourseProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROGRESS
    return { ...DEFAULT_PROGRESS, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_PROGRESS
  }
}

function save(p: CourseProgress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {}
}

export function useProgress() {
  const [progress, setProgress] = useState<CourseProgress>(load)

  const markLessonComplete = useCallback((lessonId: string, nextModuleId?: string) => {
    setProgress((prev) => {
      const updated: CourseProgress = {
        ...prev,
        completedLessons: prev.completedLessons.includes(lessonId)
          ? prev.completedLessons
          : [...prev.completedLessons, lessonId],
        moduleUnlocked: nextModuleId && !prev.moduleUnlocked.includes(nextModuleId)
          ? [...prev.moduleUnlocked, nextModuleId]
          : prev.moduleUnlocked,
        lastVisited: lessonId,
      }
      save(updated)
      return updated
    })
  }, [])

  const saveQuizScore = useCallback((lessonId: string, score: number) => {
    setProgress((prev) => {
      const updated = { ...prev, quizScores: { ...prev.quizScores, [lessonId]: score } }
      save(updated)
      return updated
    })
  }, [])

  const isLessonComplete = useCallback(
    (lessonId: string) => progress.completedLessons.includes(lessonId),
    [progress],
  )

  // All modules are freely navigable — no quiz gate on navigation
  const isModuleUnlocked = useCallback(
    (_moduleId: string) => true,
    [],
  )

  const resetProgress = useCallback(() => {
    save(DEFAULT_PROGRESS)
    setProgress(DEFAULT_PROGRESS)
  }, [])

  return { progress, markLessonComplete, saveQuizScore, isLessonComplete, isModuleUnlocked, resetProgress }
}
