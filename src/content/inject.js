/* 页面 MAIN world：与 src/shared/matchRule.ts 逻辑保持一致 */
let gadgetGlobalEnabled = true
let gadgetRules = []
let gadgetVariables = {}

function gadgetMockDebugOn() {
  try {
    return sessionStorage.getItem('gadget-mock-debug') === '1'
  } catch {
    return false
  }
}

/** 与 src/shared/matchRule.ts 一致：子串(忽略大小写) / re: / /pat/flags */
function tryParseSlashRegex(pattern) {
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

function urlMatchHaystacks(requestUrl) {
  const u = String(requestUrl).trim()
  const set = new Set()
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

function substringMatchOnHaystacks(haystacks, rawPattern) {
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

function urlRuleMatches(requestUrl, urlPattern) {
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

function logGadgetMock(rule, requestUrl, method, outcome, detail) {
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
    info,
  )
}

function methodMatches(ruleMethod, requestMethod) {
  const rm = (ruleMethod || 'GET').toUpperCase()
  if (rm === '*') return true
  return rm === (requestMethod || 'GET').toUpperCase()
}

function isMockEnabled(rule) {
  return !!(rule.responsePayload && String(rule.responsePayload).trim())
}

function findRule(requestUrl, requestMethod) {
  if (!gadgetGlobalEnabled) return undefined
  const list = gadgetRules || []
  let urlHitWrongMethod = null
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
      },
    )
  } else if (gadgetMockDebugOn() && list.some((r) => r.enabled)) {
    console.log('[gadget-mock] 未命中（URL 与启用规则均不匹配）', {
      url: requestUrl,
      method: String(requestMethod || 'GET').toUpperCase(),
      patterns: list.filter((r) => r.enabled).map((r) => ({ method: r.method, url: r.urlPrefix })),
    })
  }
  return undefined
}

function parseHeaders(block) {
  const h = {}
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
function formatUnquotedReplacement(raw) {
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

function expandGadgetVariables(text, vars) {
  if (text == null || text === '') return text
  let out = String(text)
  out = out.replace(/"\$gadget\.var\.([A-Za-z0-9_]+)"/g, function (full, name) {
    if (!(name in vars)) return full
    return JSON.stringify(vars[name])
  })
  out = out.replace(/\$gadget\.var\.([A-Za-z0-9_]+)/g, function (match, name) {
    if (!(name in vars)) return match
    return formatUnquotedReplacement(vars[name])
  })
  return out
}

function parseVariablesForHook(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  const keys = Object.keys(raw)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = raw[k]
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

function normalizeVariablesPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  const keys = Object.keys(raw)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = raw[k]
    if (typeof v === 'string') out[k] = v
    else if (v === null || typeof v === 'number' || typeof v === 'boolean') out[k] = String(v)
    else out[k] = JSON.stringify(v)
  }
  return out
}

/* --- response snippet（与 src/shared/responseSnippetRunner.ts 一致）--- */
function isPlainObject(x) {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

function mergeG(target) {
  const sources = Array.prototype.slice.call(arguments, 1)
  if (!sources.length) return target
  if (!isPlainObject(target)) return sources[0]
  for (let si = 0; si < sources.length; si++) {
    const src = sources[si]
    if (src == null) continue
    if (!isPlainObject(src)) continue
    const keys = Object.keys(src)
    for (let ki = 0; ki < keys.length; ki++) {
      const key = keys[ki]
      const sv = src[key]
      const tv = target[key]
      if (isPlainObject(sv) && isPlainObject(tv)) {
        mergeG(tv, sv)
      } else {
        target[key] = sv
      }
    }
  }
  return target
}

function pickG(obj, keys) {
  if (obj == null || typeof obj !== 'object') return {}
  const out = {}
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (k in obj) out[k] = obj[k]
  }
  return out
}

function isEqualG(a, b) {
  if (Object.is(a, b)) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) {
      if (!isEqualG(a[i], b[i])) return false
    }
    return true
  }
  if (Array.isArray(a) || Array.isArray(b)) return false
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (let j = 0; j < ak.length; j++) {
    const k = ak[j]
    if (!isEqualG(a[k], b[k])) return false
  }
  return true
}

function gadgetLodash() {
  return { merge: mergeG, pick: pickG, isEqual: isEqualG }
}

function chanceStub() {
  return new Proxy(
    {},
    {
      get: function () {
        return function () {
          return null
        }
      },
    },
  )
}

function parseHookResponseRaw(text) {
  const s = String(text).trim()
  if (!s) return ''
  try {
    return JSON.parse(s)
  } catch {
    return text
  }
}

function stringifySnippetResult(result, fallbackRaw) {
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

function runResponseSnippet(opts) {
  const snippet = opts.snippet
  const responseRaw = opts.responseRaw
  const url = opts.url
  const method = opts.method
  const body = opts.body
  const hookVars = opts.hookVars && typeof opts.hookVars === 'object' ? opts.hookVars : {}
  const t = String(snippet).trim()
  if (!t) return responseRaw

  const response = parseHookResponseRaw(responseRaw)
  const vars = {}
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
      '"use strict";\n' + t,
    )
    const result = fn(response, url, method, body, vars, chance, _)
    return stringifySnippetResult(result, responseRaw)
  } catch (e) {
    console.error('[gadget-mock] response snippet', e)
    return responseRaw
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function resolveUrl(url) {
  try {
    return new URL(String(url), document.baseURI).href
  } catch {
    return String(url)
  }
}

async function normalizeBodyPart(b) {
  if (b == null) return ''
  if (typeof b === 'string') return b
  if (typeof URLSearchParams !== 'undefined' && b instanceof URLSearchParams) return b.toString()
  if (typeof Blob !== 'undefined' && b instanceof Blob) {
    try {
      return await b.text()
    } catch {
      return ''
    }
  }
  return ''
}

async function getOutboundRequestBodyForHook(resource, config, bodyReplace) {
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

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const d = event.data
  if (d && d.type === 'GADGET_UPDATE_RULES') {
    gadgetGlobalEnabled = d.globalEnabled !== false
    gadgetRules = Array.isArray(d.rules) ? d.rules : []
    gadgetVariables = normalizeVariablesPayload(d.variables)
  }
})

const originalFetch = window.fetch
window.fetch = async function gadgetFetch(...args) {
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
    (config && config.method) || (resource instanceof Request ? resource.method : 'GET')

  const rule = findRule(url, method)
  if (!rule) {
    return originalFetch.apply(this, args)
  }

  if (isMockEnabled(rule)) {
    if (rule.delayMs) await sleep(Number(rule.delayMs) || 0)
    const expHeaders = expandGadgetVariables(String(rule.responseHeaders || ''), gadgetVariables)
    const headers = parseHeaders(expHeaders)
    const status = Number(rule.statusCode) || 200
    const bodyForHook = expandGadgetVariables(
      await getOutboundRequestBodyForHook(resource, config, null),
      gadgetVariables,
    )
    const expPayload = expandGadgetVariables(String(rule.responsePayload), gadgetVariables)
    const hookVars = parseVariablesForHook(gadgetVariables)
    const sn = expandGadgetVariables(String(rule.responseSnippet || ''), gadgetVariables).trim()
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
  const bodyStr = bodyStrRaw ? expandGadgetVariables(bodyStrRaw, gadgetVariables) : null

  const snPass = expandGadgetVariables(String(rule.responseSnippet || ''), gadgetVariables).trim()
  const hookVarsPass = parseVariablesForHook(gadgetVariables)
  const requestBodyForHook = bodyStrRaw
    ? String(bodyStr)
    : expandGadgetVariables(await getOutboundRequestBodyForHook(resource, config, null), gadgetVariables)

  let res
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
          }),
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

const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function (...args) {
  this._gadget_method = args[0]
  this._gadget_url = args[1]
  return originalXHROpen.apply(this, args)
}

XMLHttpRequest.prototype.send = function (...args) {
  const method = this._gadget_method || 'GET'
  const url = resolveUrl(this._gadget_url || '')

  const rule = findRule(url, method)
  if (!rule) {
    return originalXHRSend.apply(this, args)
  }

  if (isMockEnabled(rule)) {
    const runMock = () => {
      const status = Number(rule.statusCode) || 200
      const xhrBody = args[0] != null && typeof args[0] === 'string' ? String(args[0]) : ''
      const bodyForHook = expandGadgetVariables(xhrBody, gadgetVariables)
      const expPayload = expandGadgetVariables(String(rule.responsePayload), gadgetVariables)
      const hookVars = parseVariablesForHook(gadgetVariables)
      const sn = expandGadgetVariables(String(rule.responseSnippet || ''), gadgetVariables).trim()
      let body = expPayload
      if (sn) {
        body = runResponseSnippet({
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
        bodyPreview: String(body).slice(0, 200),
      })
      Object.defineProperty(this, 'readyState', { value: 4, configurable: true })
      Object.defineProperty(this, 'status', { value: status, configurable: true })
      Object.defineProperty(this, 'response', { value: body, configurable: true })
      Object.defineProperty(this, 'responseText', { value: body, configurable: true })

      const ev = new Event('readystatechange')
      const loadEv = new Event('load')
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
  const bodyStr = bodyStrRaw ? expandGadgetVariables(bodyStrRaw, gadgetVariables) : null
  if (bodyStr && (args[0] == null || typeof args[0] === 'string')) {
    logGadgetMock(rule, url, method, '改写请求体 (XHR)', { bodyPreview: bodyStr.slice(0, 200) })
    return originalXHRSend.call(this, bodyStr)
  }

  logGadgetMock(rule, url, method, '命中规则 · 透传网络 (XHR)', {
    note: 'Response 为空或未配置可改写的请求体',
  })
  return originalXHRSend.apply(this, args)
}
