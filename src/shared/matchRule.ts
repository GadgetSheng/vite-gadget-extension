import type { Rule } from './rule'

/**
 * 解析 `/pattern/flags`（flags 仅 gimsuy；缺省自动加 `i` 忽略大小写）。
 * 若尾部不是合法 flag 段则返回 null（避免把普通路径误当正则）。
 */
export function tryParseSlashRegex(pattern: string): RegExp | null {
  const s = pattern.trim()
  if (!s.startsWith('/') || s.length < 2) return null
  const last = s.lastIndexOf('/')
  if (last <= 0) return null
  const body = s.slice(1, last)
  const flagPart = s.slice(last + 1)
  if (flagPart !== '' && !/^[gimsuy]*$/i.test(flagPart)) return null
  const flags = flagPart.toLowerCase().includes('i') ? flagPart : flagPart + 'i'
  try {
    return new RegExp(body, flags)
  } catch {
    return null
  }
}

/** 生成若干「待匹配」URL 串（原始 + 解码），避免 path/query 编码导致子串对不上 */
export function urlMatchHaystacks(requestUrl: string): string[] {
  const u = String(requestUrl).trim()
  const set = new Set<string>()
  set.add(u)
  try {
    set.add(decodeURI(u))
  } catch {
    /* ignore */
  }
  try {
    set.add(decodeURIComponent(u))
  } catch {
    /* ignore */
  }
  return [...set]
}

function substringMatchOnHaystacks(haystacks: string[], rawPattern: string): boolean {
  const rawLower = rawPattern.toLowerCase()
  for (const cand of haystacks) {
    const h = cand.toLowerCase()
    if (h.includes(rawLower)) return true
    if (rawLower.startsWith('/') && rawLower.length > 1) {
      const noSlash = rawLower.slice(1)
      if (noSlash && h.includes(noSlash)) return true
    }
  }
  return false
}

/**
 * URL 匹配（**忽略大小写**子串；支持 decode 变体）：
 * - 默认：**子串包含**；以 `/` 开头的规则若整段未命中，会再试去掉首 `/`
 * - `re:表达式`：按正则匹配，强制 `i`，对原始与 decodeURI 任一命中即可
 * - `/pattern/flags`：`tryParseSlashRegex` 成功则按正则
 */
export function urlRuleMatches(requestUrl: string, urlPattern: string): boolean {
  const raw = urlPattern.trim()
  if (!raw) return false
  const u = String(requestUrl).trim()
  const haystacks = urlMatchHaystacks(u)

  if (raw.slice(0, 3).toLowerCase() === 're:') {
    const expr = raw.slice(3).trim()
    if (!expr) return false
    try {
      const re = new RegExp(expr, 'i')
      return haystacks.some((h) => re.test(h))
    } catch {
      return false
    }
  }

  const slashRx = tryParseSlashRegex(raw)
  if (slashRx) {
    try {
      return haystacks.some((h) => slashRx.test(h))
    } catch {
      return false
    }
  }

  return substringMatchOnHaystacks(haystacks, raw)
}

export function methodMatches(ruleMethod: string, requestMethod: string): boolean {
  const rm = (ruleMethod || 'GET').toUpperCase()
  if (rm === '*') return true
  return rm === (requestMethod || 'GET').toUpperCase()
}

export function isMockEnabled(rule: Rule): boolean {
  return Boolean(rule.responsePayload?.trim())
}

/**
 * 自上而下第一条：global 开、规则启用、URL+Method 命中
 */
export function findMatchingRule(
  rules: Rule[],
  globalEnabled: boolean,
  requestUrl: string,
  requestMethod: string,
): Rule | undefined {
  if (!globalEnabled) return undefined
  return rules.find(
    (r) => r.enabled && urlRuleMatches(requestUrl, r.urlPrefix) && methodMatches(r.method, requestMethod),
  )
}

/** 解析多行 `Key: Value`，非法行跳过 */
export function parseResponseHeadersBlock(block: string): Headers {
  const headers = new Headers()
  if (!block?.trim()) {
    headers.set('Content-Type', 'application/json')
    return headers
  }
  const lines = block.split(/\r?\n/)
  let any = false
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const idx = t.indexOf(':')
    if (idx <= 0) continue
    const key = t.slice(0, idx).trim()
    const val = t.slice(idx + 1).trim()
    if (!key) continue
    try {
      headers.append(key, val)
      any = true
    } catch {
      /* ignore invalid header names */
    }
  }
  if (!any) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}
