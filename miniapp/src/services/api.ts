import Taro from '@tarojs/taro'
import type {
  AnalyzeResult,
  AuthConfig,
  AuthSessionResult,
  DraftRisk,
  DraftTask,
  ExtractionDetail,
  HealthResult,
  ImageInput,
  ProjectBundle,
  ProjectSummary,
  RiskRecord,
  RiskStatus,
  TaskRecord,
} from '@/types'

/**
 * DevTools / H5 preview:
 * - H5 requests use `/api` and are proxied to 4317 by the Taro dev server.
 * - WeChat DevTools calls 127.0.0.1 directly (enable "不校验合法域名").
 * - A real phone can never call 127.0.0.1; use an HTTPS domain and add it to
 *   the WeChat request legal-domain list. Build with TARO_APP_API_BASE.
 */
const configuredBase = process.env.TARO_APP_API_BASE?.trim()

export const API_BASE_URL =
  process.env.TARO_ENV === 'h5'
    ? ''
    : configuredBase || 'http://127.0.0.1:4317'

export class ApiError extends Error {
  code: string
  statusCode: number

  constructor(message: string, code = 'REQUEST_FAILED', statusCode = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.statusCode = statusCode
  }
}

type ApiErrorBody = {
  error?: {
    code?: string
    message?: string
  }
}

type RawResponse<T> = {
  statusCode: number
  data: T & ApiErrorBody
}

const TOKEN_KEY = 'flowback.sessionToken'
const SESSION_EXPIRES_KEY = 'flowback.sessionExpiresAt'
const DEVICE_KEY = 'flowback.deviceId'

async function rawRequest<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  data?: unknown,
  token?: string,
): Promise<RawResponse<T>> {
  try {
    const response = await Taro.request<T & ApiErrorBody>({
      url: `${API_BASE_URL}${path}`,
      method,
      data,
      timeout: 60000,
      header: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    })
    return { statusCode: response.statusCode, data: response.data as T & ApiErrorBody }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : '网络连接失败，请检查服务地址'
    throw new ApiError(`无法连接 FlowBack 服务：${message}`, 'NETWORK_ERROR')
  }
}

function readToken(): string {
  try {
    return String(Taro.getStorageSync(TOKEN_KEY) || '')
  } catch {
    return ''
  }
}

function storeSession(result: AuthSessionResult) {
  try {
    Taro.setStorageSync(TOKEN_KEY, result.token)
    Taro.setStorageSync(SESSION_EXPIRES_KEY, result.expiresAt)
  } catch {
    throw new ApiError('无法保存登录态，请检查小程序存储权限。', 'SESSION_STORAGE_FAILED')
  }
}

export function clearSession() {
  try {
    Taro.removeStorageSync(TOKEN_KEY)
    Taro.removeStorageSync(SESSION_EXPIRES_KEY)
  } catch {
    // A stale token will simply fail on the next request.
  }
}

function deviceId(): string {
  try {
    const existing = String(Taro.getStorageSync(DEVICE_KEY) || '')
    if (existing.length >= 8) return existing
    const created = `dev-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random()
      .toString(36)
      .slice(2)}`
    Taro.setStorageSync(DEVICE_KEY, created)
    return created
  } catch {
    return `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function throwFromResponse<T>(response: RawResponse<T>): T {
  if (response.statusCode >= 400) {
    throw new ApiError(
      response.data?.error?.message || `请求失败（${response.statusCode}）`,
      response.data?.error?.code || 'REQUEST_FAILED',
      response.statusCode,
    )
  }
  return response.data
}

export function getAuthConfig(): Promise<AuthConfig> {
  return rawRequest<AuthConfig>('/api/auth/config', 'GET').then((response) =>
    throwFromResponse(response),
  )
}

async function devLogin(): Promise<string> {
  const response = await rawRequest<AuthSessionResult>('/api/auth/dev', 'POST', {
    deviceId: deviceId(),
  })
  const result = throwFromResponse(response)
  storeSession(result)
  return result.token
}

async function wechatLogin(): Promise<string> {
  let code = ''
  try {
    const login = await Taro.login()
    code = login.code || ''
  } catch {
    throw new ApiError('无法获取微信登录 code，请重新打开小程序。', 'WECHAT_LOGIN_FAILED')
  }
  if (!code) {
    throw new ApiError('微信登录未返回 code。', 'WECHAT_LOGIN_FAILED')
  }
  const response = await rawRequest<AuthSessionResult>('/api/auth/wechat', 'POST', {
    code,
  })
  const result = throwFromResponse(response)
  storeSession(result)
  return result.token
}

let sessionPromise: Promise<string> | null = null

export function ensureSession(): Promise<string> {
  const existing = readToken()
  if (existing) return Promise.resolve(existing)
  if (sessionPromise) return sessionPromise

  sessionPromise = (async () => {
    const config = await getAuthConfig()
    if (process.env.TARO_ENV !== 'h5' && config.wechatLogin) {
      try {
        return await wechatLogin()
      } catch (error) {
        if (!config.devAuth) throw error
        // DevTools with touristappid can still use the local-only fallback.
      }
    }
    if (config.devAuth) return devLogin()
    if (config.wechatLogin) {
      throw new ApiError(
        '当前环境无法完成微信登录，请在微信中重新打开小程序。',
        'WECHAT_LOGIN_FAILED',
      )
    }
    throw new ApiError(
      '服务端尚未配置微信登录。请配置 WECHAT_APP_ID、WECHAT_APP_SECRET，并重新构建小程序。',
      'WECHAT_AUTH_NOT_CONFIGURED',
    )
  })().finally(() => {
    sessionPromise = null
  })

  return sessionPromise
}

async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
  data?: unknown,
  auth = true,
): Promise<T> {
  let token = auth ? await ensureSession() : ''
  let response = await rawRequest<T>(path, method, data, token)
  if (response.statusCode === 401 && auth) {
    clearSession()
    token = await ensureSession()
    response = await rawRequest<T>(path, method, data, token)
  }
  return throwFromResponse(response)
}

export function getHealth() {
  return request<HealthResult>('/api/health', 'GET', undefined, false)
}

export function listProjects() {
  return request<{ projects: ProjectSummary[] }>('/api/projects')
}

export function analyzeChat(input: { text: string; images: ImageInput[] }) {
  return request<AnalyzeResult>('/api/analyze', 'POST', {
    text: input.text,
    images: input.images,
  })
}

export function getExtraction(id: string) {
  return request<ExtractionDetail>(`/api/extractions/${id}`)
}

export function saveDraft(
  id: string,
  input: { tasks: DraftTask[]; risks: DraftRisk[]; summary?: string },
) {
  return request<{ savedAt: string }>(`/api/extractions/${id}`, 'PATCH', input)
}

export function confirmExtraction(
  id: string,
  input: { tasks: DraftTask[]; risks: DraftRisk[] },
) {
  return request<{ projectId: string; taskIds: string[] }>(
    `/api/extractions/${id}/confirm`,
    'POST',
    input,
  )
}

export function getProjectBundle(id: string) {
  return request<ProjectBundle>(`/api/projects/${id}`)
}

export function deleteProject(id: string) {
  return request<{ ok: boolean }>(`/api/projects/${id}`, 'DELETE')
}

export function updateTask(
  id: string,
  input: Partial<{
    title: string
    owner: string | null
    dueLabel: string | null
    dueDate: string | null
    dateStatus: string
    priority: string
    status: string
    note: string | null
  }>,
) {
  return request<{ task: TaskRecord; events: unknown[] }>(
    `/api/tasks/${id}`,
    'PATCH',
    input,
  )
}

export function updateRisk(
  id: string,
  input: Partial<{
    status: RiskStatus
    note: string | null
    title: string
    detail: string
  }>,
) {
  return request<{ risk: RiskRecord }>(`/api/risks/${id}`, 'PATCH', input)
}
