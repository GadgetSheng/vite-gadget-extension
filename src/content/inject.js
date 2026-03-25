/* 页面 MAIN world：与 src/shared/matchRule.ts 逻辑保持一致 */
let tweakGlobalEnabled = true
let tweakRules = []

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
  if (!tweakGlobalEnabled) return undefined
  const list = tweakRules || []
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

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  const d = event.data
  if (d && d.type === 'TWEAK_UPDATE_RULES') {
    tweakGlobalEnabled = d.globalEnabled !== false
    tweakRules = Array.isArray(d.rules) ? d.rules : []
    if (window === window.top) {
      const n = tweakRules.filter((r) => r.enabled).length
      console.info(
        '%c[gadget-mock]%c 规则已同步（顶层页面）',
        'color:#042f2e;background:#2dd4bf;padding:2px 6px;border-radius:4px;font-weight:700;',
        'color:inherit;',
        { enabledRules: n, globalOn: tweakGlobalEnabled },
      )
    }
  }
})

const originalFetch = window.fetch
window.fetch = async function tweakFetch(...args) {
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
    const headers = parseHeaders(rule.responseHeaders)
    const status = Number(rule.statusCode) || 200
    logGadgetMock(rule, url, method, 'MOCK 响应', {
      status,
      delayMs: Number(rule.delayMs) || 0,
      bodyPreview: String(rule.responsePayload).slice(0, 200),
    })
    return new Response(rule.responsePayload, { status, headers })
  }

  if (rule.delayMs) await sleep(Number(rule.delayMs) || 0)

  const bodyStr =
    rule.requestPayload != null && String(rule.requestPayload).length > 0
      ? String(rule.requestPayload)
      : null
  if (!bodyStr) {
    logGadgetMock(rule, url, method, '命中规则 · 透传网络', {
      delayMs: Number(rule.delayMs) || 0,
      note: 'Response 为空，未配置 Request 改写',
    })
    return originalFetch.apply(this, args)
  }

  logGadgetMock(rule, url, method, '改写请求体', {
    bodyPreview: bodyStr.slice(0, 200),
  })

  if (typeof resource === 'string') {
    return originalFetch(resource, {
      ...(config || {}),
      method: (config && config.method) || 'GET',
      body: bodyStr,
    })
  }

  if (resource instanceof Request) {
    const req = resource
    try {
      return originalFetch(
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
      return originalFetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: bodyStr,
      })
    }
  }

  return originalFetch.apply(this, args)
}

const originalXHROpen = XMLHttpRequest.prototype.open
const originalXHRSend = XMLHttpRequest.prototype.send

XMLHttpRequest.prototype.open = function (...args) {
  this._tweak_method = args[0]
  this._tweak_url = args[1]
  return originalXHROpen.apply(this, args)
}

XMLHttpRequest.prototype.send = function (...args) {
  const method = this._tweak_method || 'GET'
  const url = resolveUrl(this._tweak_url || '')

  const rule = findRule(url, method)
  if (!rule) {
    return originalXHRSend.apply(this, args)
  }

  if (isMockEnabled(rule)) {
    const runMock = () => {
      const status = Number(rule.statusCode) || 200
      const body = rule.responsePayload
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

  const bodyStr =
    rule.requestPayload != null && String(rule.requestPayload).length > 0
      ? String(rule.requestPayload)
      : null
  if (bodyStr && (args[0] == null || typeof args[0] === 'string')) {
    logGadgetMock(rule, url, method, '改写请求体 (XHR)', { bodyPreview: bodyStr.slice(0, 200) })
    return originalXHRSend.call(this, bodyStr)
  }

  logGadgetMock(rule, url, method, '命中规则 · 透传网络 (XHR)', {
    note: 'Response 为空或未配置可改写的请求体',
  })
  return originalXHRSend.apply(this, args)
}
