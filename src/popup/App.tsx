import type { ChangeEventHandler } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createEmptyRule,
  migrateRulesFromStorage,
  migrateVariablesFromStorage,
  SCHEMA_VERSION,
  type Rule,
  type GadgetVariables,
} from '@/shared/rule'
import { isMockEnabled } from '@/shared/matchRule'
import { getExtensionState, setExtensionState } from '@/storage'
import { coverSvg } from './demoData'
import { PayloadTabsEditor } from './PayloadTabsEditor'
import { VariablesEditor } from './VariablesEditor'
import './App.css'

const METHOD_OPTIONS = [
  '*',
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
] as const

const ACCENTS = [
  '#22d3ee',
  '#a3e635',
  '#fbbf24',
  '#c084fc',
  '#fb7185',
  '#38bdf8',
]

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
  const [variables, setVariables] = useState<GadgetVariables>({})
  const [globalEnabled, setGlobalEnabled] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  /** 顶部「规则 / 变量」主视图切换 */
  const [mainTab, setMainTab] = useState<'rules' | 'variables'>('rules')
  const [hydrated, setHydrated] = useState(false)
  const [varEditorKey, setVarEditorKey] = useState(0)
  const skipRulesPersist = useRef(true)
  const skipGlobalPersist = useRef(true)
  const skipVariablesPersist = useRef(true)

  useEffect(() => {
    let cancelled = false
    void getExtensionState().then((s) => {
      if (cancelled) return
      setRules(s.rules)
      setVariables(s.variables)
      setGlobalEnabled(s.globalEnabled)
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

  useEffect(() => {
    if (!hydrated) return
    if (skipVariablesPersist.current) {
      skipVariablesPersist.current = false
      return
    }
    const t = window.setTimeout(() => {
      void setExtensionState({ variables })
    }, 400)
    return () => window.clearTimeout(t)
  }, [variables, hydrated])

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
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    )
  }, [])

  const handleExport = useCallback(() => {
    const data = {
      schemaVersion: SCHEMA_VERSION,
      globalEnabled,
      rules,
      variables,
    }
    const dataStr = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`
    const a = document.createElement('a')
    a.href = dataStr
    a.download = 'gadget-mock-rules.json'
    a.click()
  }, [globalEnabled, rules, variables])

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
            variables?: unknown
          }
          if (!raw.rules || !Array.isArray(raw.rules)) {
            window.alert('文件格式错误：需要包含 rules 数组')
            return
          }
          const nextRules = migrateRulesFromStorage(raw.rules)
          const nextGlobal = raw.globalEnabled !== false
          const nextVars = migrateVariablesFromStorage(raw.variables)
          setRules(nextRules)
          setVariables(nextVars)
          setGlobalEnabled(nextGlobal)
          setVarEditorKey((k) => k + 1)
          void setExtensionState({
            rules: nextRules,
            globalEnabled: nextGlobal,
            variables: nextVars,
          })
          setExpandedId(null)
        } catch {
          window.alert('无法解析 JSON')
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    []
  )

  return (
    <div className="demo-app">
      <div className="demo-top-sticky">
        <header className="demo-header">
          <div className="demo-header__brand">
            <h1 className="demo-title">Gadet-Mock</h1>
            <div
              className="demo-header__tabs"
              role="tablist"
              aria-label="主视图"
            >
              <button
                type="button"
                role="tab"
                className={`demo-header__tab ${mainTab === 'rules' ? 'is-active' : ''}`}
                aria-selected={mainTab === 'rules'}
                onClick={() => setMainTab('rules')}
              >
                规则
              </button>
              <button
                type="button"
                role="tab"
                className={`demo-header__tab ${mainTab === 'variables' ? 'is-active' : ''}`}
                aria-selected={mainTab === 'variables'}
                onClick={() => setMainTab('variables')}
                title="编辑全局自定义变量"
              >
                变量
              </button>
            </div>
          </div>
          <div className="demo-header__actions">
            <button
              type="button"
              className="demo-btn demo-btn--primary"
              onClick={addRule}
            >
              ＋ 新建
            </button>
            <button
              type="button"
              className="demo-btn demo-btn--ghost"
              onClick={handleExport}
              title="导出 JSON"
            >
              导出
            </button>
            <label
              className="demo-btn demo-btn--ghost import-label"
              title="导入 JSON"
            >
              导入
              <input
                type="file"
                accept="application/json,.json"
                onChange={handleImport}
                hidden
              />
            </label>
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
          </div>
        </header>
      </div>

      <main className="demo-main">
        {hydrated && mainTab === 'variables' ? (
          <VariablesEditor
            key={varEditorKey}
            initialVariables={variables}
            onChange={setVariables}
          />
        ) : null}
        {mainTab === 'rules' ? (
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
                    <button
                      type="button"
                      className="demo-card__cover-btn"
                      onClick={() => setExpandedId(expanded ? null : rule.id)}
                      aria-expanded={expanded}
                      title={expanded ? '收起详情' : '展开详情'}
                      aria-label={expanded ? '收起详情' : '展开详情'}
                    >
                      <img
                        className="demo-card__cover"
                        src={coverForRule(rule)}
                        alt=""
                        width={72}
                        height={48}
                        decoding="async"
                      />
                    </button>
                    <div className="demo-card__body">
                      <div className="demo-card__row1">
                        <input
                          className="demo-inline-input demo-inline-input--label"
                          value={rule.label}
                          onChange={(e) =>
                            updateRule(rule.id, { label: e.target.value })
                          }
                          placeholder="别名"
                          aria-label="规则别名"
                        />
                        <select
                          className="demo-method-select"
                          value={rule.method}
                          onChange={(e) =>
                            updateRule(rule.id, { method: e.target.value })
                          }
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
                        onChange={(e) =>
                          updateRule(rule.id, { urlPrefix: e.target.value })
                        }
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
                            onChange={(e) =>
                              updateRule(rule.id, {
                                delayMs: Number(e.target.value) || 0,
                              })
                            }
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
                            onChange={(e) =>
                              updateRule(rule.id, {
                                statusCode: Number(e.target.value) || 200,
                              })
                            }
                          />
                        </label>
                        <span className="demo-dot" aria-hidden />
                        <span className={mockOn ? 'tag-mock' : 'tag-pass'}>
                          {mockOn ? 'Mock 响应' : '仅改写 / 透传'}
                        </span>
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
                      <PayloadTabsEditor
                        requestPayload={rule.requestPayload}
                        responsePayload={rule.responsePayload}
                        responseHeaders={rule.responseHeaders}
                        responseSnippet={rule.responseSnippet}
                        onFieldChange={(field, value) =>
                          updateRule(rule.id, { [field]: value })
                        }
                        responseJsonHint={hint}
                      />
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : null}

        {mainTab === 'rules' && rules.length === 0 && hydrated && (
          <p className="demo-empty">暂无规则。点击「新建」开始配置。</p>
        )}
      </main>
    </div>
  )
}
