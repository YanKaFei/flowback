export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'todo' | 'doing' | 'done'
export type Confidence = 'explicit' | 'inferred' | 'unconfirmed'
export type DateStatus = 'confirmed' | 'relative' | 'unknown'
export type RiskType = 'owner_gap' | 'due_conflict' | 'due_unclear' | 'decision_unconfirmed'
export type RiskStatus = 'open' | 'acknowledged' | 'resolved'
export type Severity = 'high' | 'medium' | 'low'
export type AnalysisMode = 'ai' | 'demo'

export interface ProjectSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  taskCount: number
  doneCount: number
  openRiskCount: number
  sourceCount: number
}

export interface StoredImage {
  path: string
  name: string
  mime: string
}

export interface SourceRecord {
  id: string
  projectId: string
  kind: 'text' | 'image' | 'mixed'
  rawText: string
  images: StoredImage[]
  fileNames: string[]
  mode: AnalysisMode
  model: string | null
  createdAt: string
}

export interface DraftTask {
  id: string
  title: string
  owner: string | null
  dueLabel: string | null
  dueDate: string | null
  dateStatus: DateStatus
  priority: Priority
  status: TaskStatus
  confidence: Confidence
  sourceQuote: string
  speaker: string | null
  evidenceQuote: string | null
  needsConfirmation: boolean
  note: string | null
}

export interface DraftRisk {
  id: string
  type: RiskType
  severity: Severity
  title: string
  detail: string
  sourceQuote: string
  taskRef: string | null
  include: boolean
}

export interface ExtractionRecord {
  id: string
  sourceId: string
  projectId: string
  status: 'draft' | 'confirmed'
  summary: string
  payload: {
    summary: string
    tasks: DraftTask[]
    risks: DraftRisk[]
    warnings: string[]
  }
  mode: AnalysisMode
  model: string | null
  warnings: string[]
  createdAt: string
  updatedAt: string
}

export interface ExtractionDetail {
  extraction: ExtractionRecord
  source: SourceRecord
  project: ProjectSummary
}

export interface TaskRecord {
  id: string
  projectId: string
  sourceId: string
  extractionId: string | null
  title: string
  owner: string | null
  dueLabel: string | null
  dueDate: string | null
  dateStatus: DateStatus
  priority: Priority
  status: TaskStatus
  confidence: Confidence
  sourceQuote: string
  speaker: string | null
  evidenceQuote: string | null
  needsConfirmation: boolean
  note: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface RiskRecord {
  id: string
  projectId: string
  taskId: string | null
  sourceId: string
  extractionId: string | null
  type: RiskType
  severity: Severity
  status: RiskStatus
  title: string
  detail: string
  sourceQuote: string
  resolutionNote: string | null
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface TaskEventRecord {
  id: string
  taskId: string
  type: string
  fromValue: string | null
  toValue: string | null
  note: string | null
  createdAt: string
}

export interface ProjectBundle {
  project: ProjectSummary
  sources: SourceRecord[]
  extractions: ExtractionRecord[]
  tasks: TaskRecord[]
  risks: RiskRecord[]
  events: TaskEventRecord[]
}

export interface AnalyzeResult {
  projectId: string
  sourceId: string
  extractionId: string
  mode: AnalysisMode
  model: string | null
  summary: string
  taskCount: number
  riskCount: number
}

export interface AuthConfig {
  wechatLogin: boolean
  devAuth: boolean
  appIdConfigured: boolean
}

export interface AuthSessionResult {
  token: string
  expiresAt: string
  user: {
    id: string
    displayName: string
  }
}

export interface HealthResult {
  ai: {
    configured: boolean
    model: string
    vision: boolean
  }
}

export interface ImageInput {
  name: string
  mime: string
  dataUrl: string
}

export interface TaskEditValue {
  id: string
  title: string
  owner: string | null
  dueLabel: string | null
  dueDate: string | null
  dateStatus: DateStatus
  priority: Priority
  status: TaskStatus
  needsConfirmation: boolean
  evidenceQuote: string | null
  note: string | null
}

export interface SelectedImage {
  path: string
  name: string
  mime: string
  dataUrl: string
  bytes: number
}
