import type { ChangeEventHandler } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createEmptyRule, migrateRulesFromStorage, SCHEMA_VERSION, type Rule } from '@/shared/rule'
import { isMockEnabled } from '@/shared/matchRule'
import { getExtensionState, setExtensionState } from '@/storage'
import { coverSvg } from './demoData'
import './App.css'

const METHOD_OPTIONS = ['*', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const ACCENTS = ['#22d3ee', '#a3e635', '#fbbf24', '#c084fc', '#fb7185', '#38bdf8']

function coverForRule(rule: Rule): string {
  const n = [...rule.id].reduce((a, c) => a + c.charCodeAt(0), 0)
  const accent = ACCENTS[n % ACCENTS.length]
  const text = (rule.label || rule.method || 'RULE').slice(0, 14)
  return coverSvg(text, accent)
}

function jsonHint(value: string): string | null {
  const t = value.trim()
  if (!t) return null
  try {
    JSON.parse(t)
    return null
  } catch {
    return '非合法 JSON，将以纯文本作为响应体'
  }
}

export default function App() {
  const [rules, setRules] = useState<Rule[]>([])
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const skipRulesPersist = useRef(true)
  const skipGlobalPersist = useRef(true)

  useEffect(() => {
    let cancelled = false
    void getExtensionState().then((s) => {
      if (cancelled) return
      setRules(s.rules)
      setGlobalEnabled(s.globalEnabled)
      if (s.rules[0]) setExpandedId(s.rules[0].id)
      setHydrated(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (skipRulesPersist.current) {
      skipRulesPersist.current = false
      return
    }
    const t = window.setTimeout(() => {
      void setExtensionState({ rules })
    }, 400)
    return () => window.clearTimeout(t)
  }, [rules, hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (skipGlobalPersist.current) {
      skipGlobalPersist.current = false
      return
    }
    void setExtensionState({ globalEnabled })
  }, [globalEnabled, hydrated])

  const updateRule = useCallback((id: string, patch: Partial<Rule>) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }, [])

  const addRule = useCallback(() => {
    const row = createEmptyRule()
    setRules((prev) => [...prev, row])
    setExpandedId(row.id)
  }, [])

  const removeRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
    setExpandedId((cur) => (cur === id ? null : cur))
  }, [])

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)))
  }, [])

  const handleExport = useCallback(() => {
    const data = {
      schemaVersion: SCHEMA_VERSION,
      globalEnabled,
      rules,
    }
    const dataStr = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`
    const a = document.createElement('a')
    a.href = dataStr
    a.download = 'gadget-mock-rules.json'
    a.click()
  }, [globalEnabled, rules])

  const handleImport: ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      const file = event.target.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const raw = JSON.parse(String(reader.result)) as {
            rules?: unknown
            globalEnabled?: boolean
          }
          if (!raw.rules || !Array.isArray(raw.rules)) {
            window.alert('文件格式错误：需要包含 rules 数组')
            return
          }
          const nextRules = migrateRulesFromStorage(raw.rules)
          const nextGlobal = raw.globalEnabled !== false
          setRules(nextRules)
          setGlobalEnabled(nextGlobal)
          void setExtensionState({ rules: nextRules, globalEnabled: nextGlobal })
          if (nextRules[0]) setExpandedId(nextRules[0].id)
        } catch {
          window.alert('无法解析 JSON')
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    [],
  )

  const subline =
    'URL：忽略大小写子串 / re: / /pattern/flags。Method 建议用 *（列表接口多为 GET，写 POST 会不命中）。Console 执行 sessionStorage.setItem("gadget-mock-debug","1") 可看每次请求是否检查规则。Response 非空则 Mock。'

  return (
    <div className="demo-app">
      <header className="demo-header">
        <div className="demo-header__titles">
          <h1 className="demo-title">API 模拟</h1>
          <p className="demo-sub">{subline}</p>
        </div>
        <button
          type="button"
          className={`demo-play ${globalEnabled ? 'is-on' : ''}`}
          onClick={() => setGlobalEnabled((v) => !v)}
          aria-pressed={globalEnabled}
          title="全局总开关"
        >
          <span className="demo-play__icon" aria-hidden>
            {globalEnabled ? '▶' : '■'}
          </span>
          {globalEnabled ? '运行中' : '已暂停'}
        </button>
      </header>

      <div className="demo-toolbar">
        <button type="button" className="demo-btn demo-btn--primary" onClick={addRule}>
          ＋ 新建规则
        </button>
        <div className="demo-toolbar__ghost">
          <button type="button" className="demo-btn demo-btn--ghost" onClick={handleExport} title="导出 JSON">
            导出
          </button>
          <label className="demo-btn demo-btn--ghost import-label" title="导入 JSON">
            导入
            <input type="file" accept="application/json,.json" onChange={handleImport} hidden />
          </label>
        </div>
      </div>

      <ul className="demo-list" aria-label="规则列表">
        {rules.map((rule) => {
          const expanded = expandedId === rule.id
          const mockOn = isMockEnabled(rule)
          const hint = jsonHint(rule.responsePayload)
          return (
            <li
              key={rule.id}
              className={`demo-card ${rule.enabled ? 'is-rule-on' : ''} ${!globalEnabled ? 'is-global-off' : ''}`}
            >
              <div className="demo-card__main">
                <img
                  className="demo-card__cover"
                  src={coverForRule(rule)}
                  alt=""
                  width={72}
                  height={48}
                  decoding="async"
                />
                <div className="demo-card__body">
                  <div className="demo-card__row1">
                    <input
                      className="demo-inline-input demo-inline-input--label"
                      value={rule.label}
                      onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                      placeholder="别名"
                      aria-label="规则别名"
                    />
                    <select
                      className="demo-method-select"
                      value={rule.method}
                      onChange={(e) => updateRule(rule.id, { method: e.target.value })}
                      aria-label="HTTP 方法"
                    >
                      {METHOD_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    className="demo-inline-input demo-inline-input--url"
                    value={rule.urlPrefix}
                    onChange={(e) => updateRule(rule.id, { urlPrefix: e.target.value })}
                    placeholder="子串、re:…、或 /pattern/i"
                    title="子串(忽略大小写) · re:正则 · /pattern/flags"
                    aria-label="URL 匹配片段"
                  />
                  <div className="demo-card__meta">
                    <label className="demo-meta-field">
                      Delay
                      <input
                        type="number"
                        min={0}
                        className="demo-meta-input"
                        value={rule.delayMs}
                        onChange={(e) => updateRule(rule.id, { delayMs: Number(e.target.value) || 0 })}
                      />
                      ms
                    </label>
                    <span className="demo-dot" aria-hidden />
                    <label className="demo-meta-field">
                      状态
                      <input
                        type="number"
                        min={0}
                        max={599}
                        className="demo-meta-input demo-meta-input--status"
                        value={rule.statusCode}
                        onChange={(e) => updateRule(rule.id, { statusCode: Number(e.target.value) || 200 })}
                      />
                    </label>
                    <span className="demo-dot" aria-hidden />
                    <span className={mockOn ? 'tag-mock' : 'tag-pass'}>{mockOn ? 'Mock 响应' : '仅改写 / 透传'}</span>
                  </div>
                </div>
                <div className="demo-card__actions">
                  <button
                    type="button"
                    className={`demo-switch ${rule.enabled ? 'is-on' : ''}`}
                    onClick={() => toggleRule(rule.id)}
                    aria-pressed={rule.enabled}
                    title="规则开关"
                  >
                    <span className="demo-switch__knob" />
                  </button>
                  <button
                    type="button"
                    className="demo-icon-btn"
                    onClick={() => setExpandedId(expanded ? null : rule.id)}
                    aria-expanded={expanded}
                    title={expanded ? '收起详情' : '展开详情'}
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                  <button
                    type="button"
                    className="demo-icon-btn demo-icon-btn--danger"
                    onClick={() => removeRule(rule.id)}
                    title="删除"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="demo-card__detail">
                  <label className="demo-field">
                    <span className="demo-field__label">Request payload</span>
                    <textarea
                      rows={4}
                      value={rule.requestPayload}
                      onChange={(e) => updateRule(rule.id, { requestPayload: e.target.value })}
                      className="demo-textarea"
                      placeholder="非 Mock 时整段替换请求体"
                    />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Response payload</span>
                    <textarea
                      rows={5}
                      value={rule.responsePayload}
                      onChange={(e) => updateRule(rule.id, { responsePayload: e.target.value })}
                      className="demo-textarea"
                      placeholder="非空则 Mock，不发起真实请求"
                    />
                    {hint && <p className="demo-json-hint">{hint}</p>}
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Response headers</span>
                    <textarea
                      rows={3}
                      value={rule.responseHeaders}
                      onChange={(e) => updateRule(rule.id, { responseHeaders: e.target.value })}
                      className="demo-textarea"
                      placeholder={'Content-Type: application/json'}
                    />
                  </label>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {rules.length === 0 && hydrated && (
        <p className="demo-empty">暂无规则。点击「新建规则」开始配置。</p>
      )}
    </div>
  )
}
