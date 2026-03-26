/* 页面 MAIN world：与 src/shared/matchRule.ts 逻辑保持一致 */
import type { Rule, GadgetVariables } from '@/shared/rule'

let gadgetGlobalEnabled = true
let gadgetRules: Rule[] = []
let gadgetVariables: GadgetVariables = {}

function gadgetMockDebugOn(): boolean {
  try {
    return sessionStorage.getItem('gadget-mock-debug') === '1'
  } catch {
    return false
  }
}

function tryParseSlashRegex(pattern: unknown): RegExp | null {
  const s = String(pattern).trim()
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

function urlMatchHaystacks(requestUrl: string): string[] {
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

function substringMatchOnHaystacks(
  haystacks: string[],
  rawPattern: string
): boolean {
  const rawLower = String(rawPattern).toLowerCase()
  for (let i = 0; i < haystacks.length; i++) {
    const h = String(haystacks[i]).toLowerCase()
    if (h.includes(rawLower)) return true
    if (rawLower.startsWith('/') && rawLower.length > 1) {
      const noSlash = rawLower.slice(1)
      if (noSlash && h.includes(noSlash)) return true
    }
  }
  return false
}

function urlRuleMatches(requestUrl: string, urlPattern: string): boolean {
  const raw = String(urlPattern).trim()
  if (!raw) return false
  const u = String(requestUrl).trim()
  const haystacks = urlMatchHaystacks(u)

  if (raw.slice(0, 3).toLowerCase() === 're:') {
    const expr = raw.slice(3).trim()
    if (!expr) return false
    try {
      const re = new RegExp(expr, 'i')
      for (let j = 0; j < haystacks.length; j++) {
        if (re.test(haystacks[j])) return true
      }
      return false
    } catch {
      return false
    }
  }

  const slashRx = tryParseSlashRegex(raw)
  if (slashRx) {
    try {
      for (let k = 0; k < haystacks.length; k++) {
        if (slashRx.test(haystacks[k])) return true
      }
      return false
    } catch {
      return false
    }
  }

  return substringMatchOnHaystacks(haystacks, raw)
}

interface LogDetail {
  status?: number
  delayMs?: number
  bodyPreview?: string
  note?: string
  [key: string]: unknown
}

function logGadgetMock(
  rule: Rule,
  requestUrl: string,
  method: string,
  outcome: string,
  detail?: LogDetail
): void {
  const info = {
    label: rule.label || '(无别名)',
    ruleId: rule.id,
    requestUrl,
    method: String(method || 'GET').toUpperCase(),
    outcome,
    ...(detail || {}),
  }
  console.info(
    '%c[gadget-mock]%c ' + outcome,
    'color:#042f2e;background:#2dd4bf;padding:2px 6px;border-radius:4px;font-weight:700;',
    'color:inherit;font-weight:600;',
    info
  )
}

function methodMatches(ruleMethod: string, requestMethod: string): boolean {
  const rm = (ruleMethod || 'GET').toUpperCase()
  if (rm === '*') return true
  return rm === (requestMethod || 'GET').toUpperCase()
}

function isMockEnabled(rule: Rule): boolean {
  return !!(rule.responsePayload && String(rule.responsePayload).trim())
}

function findRule(requestUrl: string, requestMethod: string): Rule | undefined {
  if (!gadgetGlobalEnabled) return undefined
  const list = gadgetRules || []
  let urlHitWrongMethod: Rule | null = null
  for (let i = 0; i < list.length; i++) {
    const r = list[i]
    if (!r.enabled) continue
    if (!urlRuleMatches(requestUrl, r.urlPrefix)) continue
    if (!methodMatches(r.method, requestMethod)) {
      if (!urlHitWrongMethod) urlHitWrongMethod = r
      continue
    }
    return r
  }
  if (urlHitWrongMethod) {
    console.warn(
      '%c[gadget-mock]%c URL 已命中规则但 Method 不一致（Mock 未生效）',
      'color:#422006;background:#fcd34d;padding:2px 6px;border-radius:4px;font-weight:700;',
      'color:inherit;',
      {
        label: urlHitWrongMethod.label || urlHitWrongMethod.id,
        ruleMethod: urlHitWrongMethod.method,
        requestMethod: String(requestMethod || 'GET').toUpperCase(),
        url: requestUrl,
        hint: '在 Popup 将 Method 改为与 Network 一致，或改为 *',
      }
    )
  } else if (gadgetMockDebugOn() && list.some((r) => r.enabled)) {
    console.log('[gadget-mock] 未命中（URL 与启用规则均不匹配）', {
      url: requestUrl,
      method: String(requestMethod || 'GET').toUpperCase(),
      patterns: list
        .filter((r) => r.enabled)
        .map((r) => ({ method: r.method, url: r.urlPrefix })),
    })
  }
  return undefined
}

function parseHeaders(block: unknown): Record<string, string> {
  const h: Record<string, string> = {}
  const text = block == null ? '' : String(block)
  if (!text.trim()) {
    h['Content-Type'] = 'application/json'
    return h
  }
  let any = false
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const val = line.slice(idx + 1).trim()
    if (!key) continue
    h[key] = val
    any = true
  }
  if (!any) h['Content-Type'] = 'application/json'
  return h
}

/* --- Gadget Variables（与 src/shared/gadgetVariables.ts 一致）--- */
function formatUnquotedReplacement(raw: unknown): string {
  const t = String(raw).trim()
  try {
    const j = JSON.parse(t)
    if (typeof j === 'number' || typeof j === 'boolean' || j === null) {
      return JSON.stringify(j)
    }
  } catch {
    /* use string */
  }
  return JSON.stringify(t)
}

function expandGadgetVariables(text: unknown, vars: GadgetVariables): string {
  if (text == null || text === '') return text as string
  let out = String(text)
  out = out.replace(
    /"\$gadget\.var\.([A-Za-z0-9_]+)"/g,
    function (full: string, name: string) {
      if (!(name in vars)) return full
      return JSON.stringify(vars[name])
    }
  )
  out = out.replace(
    /\$gadget\.var\.([A-Za-z0-9_]+)/g,
    function (match: string, name: string) {
      if (!(name in vars)) return match
      return formatUnquotedReplacement(vars[name])
    }
  )
  return out
}

function parseVariablesForHook(raw: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (!raw || typeof raw !== 'object') return out
  const keys = Object.keys(raw)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = (raw as Record<string, unknown>)[k]
    if (!k) continue
    const t = String(v).trim()
    try {
      out[k] = JSON.parse(t)
    } catch {
      out[k] = v
    }
  }
  return out
}

function normalizeVariablesPayload(raw: unknown): GadgetVariables {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: GadgetVariables = {}
  const keys = Object.keys(raw)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = (raw as Record<string, unknown>)[k]
    if (typeof v === 'string') out[k] = v
    else if (v === null || typeof v === 'number' || typeof v === 'boolean')
      out[k] = String(v)
    else out[k] = JSON.stringify(v)
  }
  return out
}

/* --- response snippet（与 src/shared/responseSnippetRunner.ts 一致）--- */
function isPlainObject(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function mergeG<T extends Record<string, unknown>>(
  target: T,
  ...sources: unknown[]
): T {
  if (!sources.length) return target
  if (!isPlainObject(target)) return sources[0] as T
  for (let si = 0; si < sources.length; si++) {
    const src = sources[si]
    if (src == null) continue
    if (!isPlainObject(src)) continue
    const keys = Object.keys(src)
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki]
      const sv = src[key]
      const tv = (target as Record<string, unknown>)[key]
      if (isPlainObject(sv) && isPlainObject(tv)) {
        mergeG(tv, sv)
      } else {
        ;(target as Record<string, unknown>)[key] = sv
      }
    }
  }
  return target
}

function pickG(obj: unknown, keys: string[]): Record<string, unknown> {
  if (obj == null || typeof obj !== 'object') return {}
  const out: Record<string, unknown> = {}
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (k in (obj as Record<string, unknown>))
      out[k] = (obj as Record<string, unknown>)[k]
  }
  return out
}

function isEqualG(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  )
    return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!isEqualG(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(a) || Array.isArray(b)) return false
  const ak = Object.keys(a as Record<string, unknown>)
  const bk = Object.keys(b as Record<string, unknown>)
  if (ak.length !== bk.length) return false
  for (let j = 0; j < ak.length; j++) {
    const k = ak[j]
    if (
      !isEqualG(
        (a as Record<string, unknown>)[k],
        (b as Record<string, unknown>)[k]
      )
    )
      return false
  }
  return true
}

interface GadgetLodash {
  merge: typeof mergeG
  pick: typeof pickG
  isEqual: typeof isEqualG
}

function gadgetLodash(): GadgetLodash {
  return { merge: mergeG, pick: pickG, isEqual: isEqualG }
}

interface ChanceStub {
  [key: string]: () => null
}

function chanceStub(): ChanceStub {
  return new Proxy({} as ChanceStub, {
    get: function () {
      return function () {
        return null
      }
    },
  })
}

function parseHookResponseRaw(text: string): unknown {
  const s = String(text).trim()
  if (!s) return ''
  try {
    return JSON.parse(s)
  } catch {
    return text
  }
}

function stringifySnippetResult(result: unknown, fallbackRaw: string): string {
  if (result === undefined) return fallbackRaw
  if (result === null) return 'null'
  if (typeof result === 'string') return result
  if (typeof result === 'number' || typeof result === 'boolean')
    return JSON.stringify(result)
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

interface RunResponseSnippetOptions {
  snippet: string
  responseRaw: string
  url: string
  method: string
  body: string
  hookVars: Record<string, unknown>
}

function runResponseSnippet(opts: RunResponseSnippetOptions): string {
  const snippet = opts.snippet
  const responseRaw = opts.responseRaw
  const url = opts.url
  const method = opts.method
  const body = opts.body
  const hookVars =
    opts.hookVars && typeof opts.hookVars === 'object' ? opts.hookVars : {}
  const t = String(snippet).trim()
  if (!t) return responseRaw

  const response = parseHookResponseRaw(responseRaw)
  const vars: Record<string, unknown> = {}
  const hk = Object.keys(hookVars)
  for (let vi = 0; vi < hk.length; vi++) {
    const k = hk[vi]
    vars[k] = hookVars[k]
  }
  const chance = chanceStub()
  const _ = gadgetLodash()

  try {
    const fn = new Function(
      'response',
      'url',
      'method',
      'body',
      'vars',
      'chance',
      '_',
      '"use strict";\n' + t
    )
    const result = fn(response, url, method, body, vars, chance, _)
    return stringifySnippetResult(result, responseRaw)
  } catch (e) {
    console.error('[gadget-mock] response snippet', e)
    return responseRaw
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveUrl(url: string): string {
  try {
    return new URL(String(url), document.baseURI).href
  } catch {
    return String(url)
  }
}

async function normalizeBodyPart(b: unknown): Promise<string> {
  if (b == null) return ''
  if (typeof b === 'string') return b
  if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams)
    return b.toString()
  if (typeof Blob !== 'undefined' && b instanceof Blob) {
    try {
      return await b.text()
    } catch {
      return ''
    }
  }
  return ''
}

async function getOutboundRequestBodyForHook(
  resource: RequestInfo | URL,
  config: RequestInit | undefined,
  bodyReplace: string | null
): Promise<string> {
  if (bodyReplace != null && String(bodyReplace).length > 0) {
    return String(bodyReplace)
  }
  if (config && config.body != null) {
    return await normalizeBodyPart(config.body)
  }
  if (resource instanceof Request && resource.body) {
    try {
      const c = resource.clone()
      return await c.text()
    } catch {
      return ''
    }
  }
  return ''
}

interface GadgetUpdateRulesMessage {
  type: 'GADGET_UPDATE_RULES'
  globalEnabled: boolean
  rules: Rule[]
  variables: GadgetVariables
}

window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== window) return
  const d = event.data as GadgetUpdateRulesMessage
  if (d && d.type === 'GADGET_UPDATE_RULES') {
    gadgetGlobalEnabled = d.globalEnabled !== false
    gadgetRules = Array.isArray(d.rules) ? d.rules : []
    gadgetVariables = normalizeVariablesPayload(d.variables)
  }
})

const originalFetch = window.fetch
window.fetch = async function gadgetFetch(
  ...args: [input: RequestInfo | URL, init?: RequestInit]
): Promise<Response> {
  const [resource, config] = args
  let url = ''
  if (typeof resource === 'string') {
    url = resolveUrl(resource)
  } else if (resource instanceof Request) {
    url = resource.url
  } else {
    url = resource ? String(resource) : ''
  }

  const method =
    (config && config.method) ||
    (resource instanceof Request ? resource.method : 'GET')

  const rule = findRule(url, method)
  if (!rule) {
    return originalFetch.apply(this, args)
  }

  if (isMockEnabled(rule)) {
    if (rule.delayMs) await sleep(Number(rule.delayMs) || 0)
    const expHeaders = expandGadgetVariables(
      String(rule.responseHeaders || ''),
      gadgetVariables
    )
    const headers = parseHeaders(expHeaders)
    const status = Number(rule.statusCode) || 200
    const bodyForHook = expandGadgetVariables(
      await getOutboundRequestBodyForHook(resource, config, null),
      gadgetVariables
    )
    const expPayload = expandGadgetVariables(
      String(rule.responsePayload),
      gadgetVariables
    )
    const hookVars = parseVariablesForHook(gadgetVariables)
    const sn = expandGadgetVariables(
      String(rule.responseSnippet || ''),
      gadgetVariables
    ).trim()
    let payloadOut = expPayload
    if (sn) {
      payloadOut = runResponseSnippet({
        snippet: sn,
        responseRaw: expPayload,
        url,
        method,
        body: bodyForHook,
        hookVars,
      })
    }
    logGadgetMock(rule, url, method, 'MOCK 响应', {
      status,
      delayMs: Number(rule.delayMs) || 0,
      bodyPreview: String(payloadOut).slice(0, 200),
    })
    return new Response(payloadOut, { status, headers })
  }

  if (rule.delayMs) await sleep(Number(rule.delayMs) || 0)

  const bodyStrRaw =
    rule.requestPayload != null && String(rule.requestPayload).length > 0
      ? String(rule.requestPayload)
      : null
  const bodyStr = bodyStrRaw
    ? expandGadgetVariables(bodyStrRaw, gadgetVariables)
    : null

  const snPass = expandGadgetVariables(
    String(rule.responseSnippet || ''),
    gadgetVariables
  ).trim()
  const hookVarsPass = parseVariablesForHook(gadgetVariables)
  const requestBodyForHook = bodyStrRaw
    ? String(bodyStr)
    : expandGadgetVariables(
        await getOutboundRequestBodyForHook(resource, config, null),
        gadgetVariables
      )

  let res: Response
  if (!bodyStr) {
    logGadgetMock(rule, url, method, '命中规则 · 透传网络', {
      delayMs: Number(rule.delayMs) || 0,
      note: 'Response 为空，未配置 Request 改写',
    })
    res = await originalFetch.apply(this, args)
  } else {
    logGadgetMock(rule, url, method, '改写请求体', {
      bodyPreview: bodyStr.slice(0, 200),
    })

    if (typeof resource === 'string') {
      res = await originalFetch(resource, {
        ...(config || {}),
        method: (config && config.method) || 'GET',
        body: bodyStr,
      })
    } else if (resource instanceof Request) {
      const req = resource
      try {
        res = await originalFetch(
          new Request(req.url, {
            method: req.method,
            headers: req.headers,
            body: bodyStr,
            mode: req.mode,
            credentials: req.credentials,
            cache: req.cache,
            redirect: req.redirect,
            referrer: req.referrer,
            referrerPolicy: req.referrerPolicy,
            integrity: req.integrity,
            keepalive: req.keepalive,
            signal: req.signal,
          })
        )
      } catch {
        res = await originalFetch(req.url, {
          method: req.method,
          headers: req.headers,
          body: bodyStr,
        })
      }
    } else {
      res = await originalFetch.apply(this, args)
    }
  }

  if (!snPass) return res

  const text = await res.clone().text()
  const out = runResponseSnippet({
    snippet: snPass,
    responseRaw: text,
    url,
    method,
    body: requestBodyForHook,
    hookVars: hookVarsPass,
  })
  return new Response(out, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  })
}

interface GadgetXHR extends XMLHttpRequest {
  _gadget_method?: string
  _gadget_url?: string
}

const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function (
  this: GadgetXHR,
  method: string,
  url: string | URL,
  ...rest: unknown[]
): void {
  this._gadget_method = method
  this._gadget_url = String(url)
  ;(originalXHROpen as any).apply(this, [method, url, ...rest])
}

XMLHttpRequest.prototype.send = function (
  this: GadgetXHR,
  body?: Document | XMLHttpRequestBodyInit | null
): void {
  const method = this._gadget_method || 'GET'
  const url = resolveUrl(this._gadget_url || '')

  const rule = findRule(url, method)
  if (!rule) {
    originalXHRSend.call(this, body)
    return
  }

  if (isMockEnabled(rule)) {
    const runMock = () => {
      const status = Number(rule.statusCode) || 200
      const xhrBody =
        body != null && typeof body === 'string' ? String(body) : ''
      const bodyForHook = expandGadgetVariables(xhrBody, gadgetVariables)
      const expPayload = expandGadgetVariables(
        String(rule.responsePayload),
        gadgetVariables
      )
      const hookVars = parseVariablesForHook(gadgetVariables)
      const sn = expandGadgetVariables(
        String(rule.responseSnippet || ''),
        gadgetVariables
      ).trim()
      let responseBody = expPayload
      if (sn) {
        responseBody = runResponseSnippet({
          snippet: sn,
          responseRaw: expPayload,
          url,
          method,
          body: bodyForHook,
          hookVars,
        })
      }
      logGadgetMock(rule, url, method, 'MOCK 响应 (XHR)', {
        status,
        delayMs: Number(rule.delayMs) || 0,
        bodyPreview: String(responseBody).slice(0, 200),
      })
      Object.defineProperty(this, 'readyState', {
        value: 4,
        configurable: true,
      })
      Object.defineProperty(this, 'status', {
        value: status,
        configurable: true,
      })
      Object.defineProperty(this, 'response', {
        value: responseBody,
        configurable: true,
      })
      Object.defineProperty(this, 'responseText', {
        value: responseBody,
        configurable: true,
      })

      const ev = new ProgressEvent('readystatechange')
      const loadEv = new ProgressEvent('load')
      if (this.onreadystatechange) this.onreadystatechange(ev)
      if (this.onload) this.onload(loadEv)
      this.dispatchEvent(ev)
      this.dispatchEvent(loadEv)
    }
    const d = Number(rule.delayMs) || 0
    if (d) setTimeout(runMock, d)
    else runMock()
    return
  }

  const bodyStrRaw =
    rule.requestPayload != null && String(rule.requestPayload).length > 0
      ? String(rule.requestPayload)
      : null
  const bodyStr = bodyStrRaw
    ? expandGadgetVariables(bodyStrRaw, gadgetVariables)
    : null
  if (bodyStr && (body == null || typeof body === 'string')) {
    logGadgetMock(rule, url, method, '改写请求体 (XHR)', {
      bodyPreview: bodyStr.slice(0, 200),
    })
    originalXHRSend.call(this, bodyStr)
    return
  }

  logGadgetMock(rule, url, method, '命中规则 · 透传网络 (XHR)', {
    note: 'Response 为空或未配置可改写的请求体',
  })
  originalXHRSend.call(this, body)
}
