/** 与 inject / storage / Popup 共用的规则与存储形状 */

export const SCHEMA_VERSION = 1

export const STORAGE_KEYS = {
  schemaVersion: 'schemaVersion',
  globalEnabled: 'globalEnabled',
  rules: 'rules',
  /** Gadget 风格全局变量：name -> 原始字符串值 */
  variables: 'variables',
} as const

/** 变量名仅字母、数字、下划线 */
export type GadgetVariables = Record<string, string>

/** 旧版存储（迁移用） */
export interface LegacyMockRule {
  id: string
  urlPattern: string
  method: string
  status: number
  responseBody: string
  delayMs?: number
  active: boolean
}

export interface Rule {
  id: string
  label: string
  /** URL 匹配：普通文本为忽略大小写的子串；`re:…` 为正则；`/pat/flags` 为正则字面量（自动含 i）。 */
  urlPrefix: string
  method: string
  delayMs: number
  statusCode: number
  requestPayload: string
  responsePayload: string
  /** Response hook：自定义 JS（Mock 时基于 Response payload；透传 fetch 时基于真实响应体） */
  responseSnippet: string
  responseHeaders: string
  enabled: boolean
}

export interface ExtensionState {
  schemaVersion: number
  globalEnabled: boolean
  rules: Rule[]
  variables: GadgetVariables
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2, 12)
}

export function createEmptyRule(): Rule {
  return {
    id: newId(),
    label: '新规则',
    urlPrefix: '',
    method: '*',
    delayMs: 0,
    statusCode: 200,
    requestPayload: '',
    responsePayload: '',
    responseSnippet: '',
    responseHeaders: 'Content-Type: application/json',
    enabled: true,
  }
}

function isLegacyRule(row: unknown): row is LegacyMockRule {
  if (!row || typeof row !== 'object') return false
  const r = row as Record<string, unknown>
  return 'urlPattern' in r && !('urlPrefix' in r)
}

function migrateOneRule(row: unknown): Rule {
  if (row && typeof row === 'object' && 'urlPrefix' in row) {
    const r = row as Rule
    return {
      id: typeof r.id === 'string' ? r.id : newId(),
      label: typeof r.label === 'string' ? r.label : '',
      urlPrefix: typeof r.urlPrefix === 'string' ? r.urlPrefix : '',
      method: typeof r.method === 'string' ? r.method : 'GET',
      delayMs: typeof r.delayMs === 'number' ? r.delayMs : 0,
      statusCode: typeof r.statusCode === 'number' ? r.statusCode : 200,
      requestPayload:
        typeof r.requestPayload === 'string' ? r.requestPayload : '',
      responsePayload:
        typeof r.responsePayload === 'string' ? r.responsePayload : '',
      responseSnippet:
        typeof r.responseSnippet === 'string' ? r.responseSnippet : '',
      responseHeaders:
        typeof r.responseHeaders === 'string'
          ? r.responseHeaders
          : 'Content-Type: application/json',
      enabled: typeof r.enabled === 'boolean' ? r.enabled : true,
    }
  }
  if (isLegacyRule(row)) {
    return {
      id: row.id || newId(),
      label: '',
      urlPrefix: row.urlPattern || '',
      method: row.method === 'ALL' ? '*' : row.method || 'GET',
      delayMs: row.delayMs ?? 0,
      statusCode: row.status ?? 200,
      requestPayload: '',
      responsePayload: row.responseBody ?? '',
      responseSnippet: '',
      responseHeaders: 'Content-Type: application/json',
      enabled: row.active !== false,
    }
  }
  return createEmptyRule()
}

export function migrateRulesFromStorage(raw: unknown): Rule[] {
  if (!Array.isArray(raw)) return []
  return raw.map(migrateOneRule)
}

export function migrateVariablesFromStorage(raw: unknown): GadgetVariables {
  if (!raw || typeof raw !== 'object') return {}
  const out: GadgetVariables = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== 'string' || !k) continue
    if (typeof v === 'string') out[k] = v
    else if (v === null || typeof v === 'number' || typeof v === 'boolean')
      out[k] = String(v)
    else out[k] = JSON.stringify(v)
  }
  return out
}
