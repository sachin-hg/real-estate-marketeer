export type QuestionType = 'mcq' | 'fillin' | 'tf'

export interface MCQQuestion {
  type: 'mcq'
  stem: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface FillInQuestion {
  type: 'fillin'
  stem: string
  answer: string
  hint?: string
  explanation?: string
}

export interface TFQuestion {
  type: 'tf'
  stem: string
  answer: boolean
  explanation: string
}

export type Question = MCQQuestion | FillInQuestion | TFQuestion

export interface TodoItem {
  marker: string          // the exact string to match, e.g. "???"
  lineHint: string        // short hint shown in the code margin
  whyItMatters: string    // longer WHY explanation for the popover
  correctCode: string     // the code that replaces the marker on reveal
  quizIndex?: number      // which mid-lesson quiz gates this reveal (0-based)
}

export interface CodeExample {
  language: string
  code: string
  filename?: string
  highlightLines?: number[]
}

export interface BrokenCode {
  code: string            // full code with "???" markers
  todos: TodoItem[]
}

export interface ProductionRef {
  file: string            // e.g. "agents/researcher.py"
  startLine: number
  endLine: number
  excerpt?: string        // pre-extracted lines
  annotations?: Array<{ line: number; text: string }>
}

export interface CalloutItem {
  type: 'insight' | 'mistake' | 'tip' | 'warning'
  title: string
  body: string
}

export interface ConceptSection {
  heading?: string
  body: string            // markdown
  callouts?: CalloutItem[]
  codeExample?: CodeExample
}

export interface Lesson {
  id: string
  title: string
  durationMin: number
  concept: ConceptSection[]
  brokenCode?: BrokenCode
  midQuiz?: Question[]    // gates typewriter reveal if present
  completeCode?: CodeExample
  productionRef?: ProductionRef
  endQuiz?: Question[]
  pyodideCode?: string    // initial code for the runner
  pyodideExpected?: string
}

export interface Module {
  id: string              // "m0", "m1", ..., "m12"
  title: string
  subtitle: string
  durationMin: number
  pipelineVersion?: string  // "v1", "v2", etc. — which spine version it builds
  lessons: Lesson[]
  tags: string[]
  difficulty: 'intro' | 'beginner' | 'intermediate' | 'advanced'
}

export interface CourseProgress {
  completedLessons: string[]    // lesson IDs like "m2-l1"
  quizScores: Record<string, number>   // lessonId → score 0-1
  moduleUnlocked: string[]      // module IDs unlocked
  lastVisited?: string
}
