/**
 * Response hook（对齐常见 Response hook 语义）：在页面内用 new Function 执行用户片段。
 * inject.js 需保持相同行为。
 */

export function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** lodash.merge 子集：仅合并普通对象；源为对象则递归 */
export function merge(target: unknown, ...sources: unknown[]): unknown {
  if (!sources.length) return target
  if (!isPlainObject(target)) return sources[0]
  for (const src of sources) {
    if (src == null) continue
    if (!isPlainObject(src)) continue
    for (const key of Object.keys(src)) {
      const sv = src[key]
      const tv = (target as Record<string, unknown>)[key]
      if (isPlainObject(sv) && isPlainObject(tv)) {
        merge(tv, sv)
      } else {
        ;(target as Record<string, unknown>)[key] = sv
      }
    }
  }
  return target
}

export function pick<T extends object>(obj: T | null | undefined, keys: string[]): Partial<T> {
  if (obj == null || typeof obj !== 'object') return {}
  const out: Partial<T> = {}
  for (const k of keys) {
    if (k in obj) {
      ;(out as Record<string, unknown>)[k] = (obj as Record<string, unknown>)[k]
    }
  }
  return out
}

export function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(a) || Array.isArray(b)) return false
  const ak = Object.keys(a as object)
  const bk = Object.keys(b as object)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (!isEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false
  }
  return true
}

export function createGadgetLodash() {
  return { merge, pick, isEqual }
}

/** chance.js 占位：任意方法调用返回 null，避免抛错 */
export function createChanceStub(): unknown {
  return new Proxy(
    {},
    {
      get() {
        return () => null
      },
    },
  )
}

/**
 * 将原始响应文本解析为 hook 的 `response`：trim 后尝试 JSON.parse，失败则整段字符串。
 */
export function parseHookResponseRaw(text: string): unknown {
  const s = text.trim()
  if (!s) return ''
  try {
    return JSON.parse(s) as unknown
  } catch {
    return text
  }
}

/**
 * 将用户脚本返回值转为 Response body 字符串。
 * `undefined` 回退为未改动的原始文本。
 */
export function stringifySnippetResult(result: unknown, fallbackRaw: string): string {
  if (result === undefined) return fallbackRaw
  if (result === null) return 'null'
  if (typeof result === 'string') return result
  if (typeof result === 'number' || typeof result === 'boolean') return JSON.stringify(result)
  if (typeof result === 'bigint') return String(result)
  if (typeof result === 'object') {
    try {
      return JSON.stringify(result)
    } catch {
      return String(result)
    }
  }
  return String(result)
}

export interface RunResponseSnippetOptions {
  snippet: string
  /** 作为解析 `response` 的原始文本（Mock 时为 Response payload；透传时为响应体文本） */
  responseRaw: string
  url: string
  method: string
  body: string
  /** Gadget 全局变量解析后的 `vars` */
  hookVars?: Record<string, unknown>
  onError?: (err: unknown) => void
}

export function runResponseSnippet(opts: RunResponseSnippetOptions): string {
  const { snippet, responseRaw, url, method, body, hookVars, onError } = opts
  const t = snippet.trim()
  if (!t) return responseRaw

  const response = parseHookResponseRaw(responseRaw)
  const vars: Record<string, unknown> =
    hookVars && typeof hookVars === 'object' ? { ...hookVars } : {}
  const chance = createChanceStub()
  const _ = createGadgetLodash()

  try {
    const fn = new Function(
      'response',
      'url',
      'method',
      'body',
      'vars',
      'chance',
      '_',
      `"use strict";\n${t}`,
    ) as (
      r: unknown,
      u: string,
      m: string,
      b: string,
      v: Record<string, unknown>,
      c: unknown,
      lodash: ReturnType<typeof createGadgetLodash>,
    ) => unknown

    const result = fn(response, url, method, body, vars, chance, _)
    return stringifySnippetResult(result, responseRaw)
  } catch (e) {
    const log = onError ?? ((err: unknown) => console.error('[gadget-mock] response snippet', err))
    log(e)
    return responseRaw
  }
}
