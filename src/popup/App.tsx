import { useMemo, useState } from 'react'
import { DEMO_RULES, emptyDemoRule, type DemoRuleRow } from './demoData'
import './App.css'

export default function App() {
  const [globalOn, setGlobalOn] = useState(true)
  const [rules, setRules] = useState<DemoRuleRow[]>(() => DEMO_RULES.map((r) => ({ ...r })))
  const [expandedId, setExpandedId] = useState<string | null>(DEMO_RULES[0]?.id ?? null)

  const mockHint = useMemo(
    () => '演示模式：按钮与开关仅更新本页状态，不写 storage、不拦截网络。',
    [],
  )

  const toggleRule = (id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ruleOn: !r.ruleOn } : r)))
  }

  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id))
    setExpandedId((cur) => (cur === id ? null : cur))
  }

  const addRule = () => {
    const row = emptyDemoRule()
    setRules((prev) => [...prev, row])
    setExpandedId(row.id)
  }

  const resetDemo = () => {
    setRules(DEMO_RULES.map((r) => ({ ...r })))
    setGlobalOn(true)
    setExpandedId(DEMO_RULES[0]?.id ?? null)
  }

  return (
    <div className="demo-app">
      <header className="demo-header">
        <div className="demo-header__titles">
          <h1 className="demo-title">API 模拟</h1>
          <p className="demo-sub">{mockHint}</p>
        </div>
        <button
          type="button"
          className={`demo-play ${globalOn ? 'is-on' : ''}`}
          onClick={() => setGlobalOn((v) => !v)}
          aria-pressed={globalOn}
          title="全局总开关（演示）"
        >
          <span className="demo-play__icon" aria-hidden>
            {globalOn ? '▶' : '■'}
          </span>
          {globalOn ? '运行中' : '已暂停'}
        </button>
      </header>

      <div className="demo-toolbar">
        <button type="button" className="demo-btn demo-btn--primary" onClick={addRule}>
          ＋ 新建规则
        </button>
        <div className="demo-toolbar__ghost">
          <button type="button" className="demo-btn demo-btn--ghost" disabled title="Demo 未接入">
            导出
          </button>
          <button type="button" className="demo-btn demo-btn--ghost" disabled title="Demo 未接入">
            导入
          </button>
          <button type="button" className="demo-btn demo-btn--ghost" onClick={resetDemo}>
            重置展示数据
          </button>
        </div>
      </div>

      <ul className="demo-list" aria-label="规则列表">
        {rules.map((rule) => {
          const expanded = expandedId === rule.id
          const mockOn = Boolean(rule.responsePayload?.trim())
          return (
            <li
              key={rule.id}
              className={`demo-card ${rule.ruleOn ? 'is-rule-on' : ''} ${!globalOn ? 'is-global-off' : ''}`}
            >
              <div className="demo-card__main">
                <img
                  className="demo-card__cover"
                  src={rule.coverImage}
                  alt=""
                  width={72}
                  height={48}
                  decoding="async"
                />
                <div className="demo-card__body">
                  <div className="demo-card__row1">
                    <span className="demo-card__label">{rule.label}</span>
                    <span className={`demo-method demo-method--${rule.method === '*' ? 'any' : rule.method.toLowerCase()}`}>
                      {rule.method}
                    </span>
                  </div>
                  <div className="demo-card__url" title="前缀匹配">
                    {rule.urlPrefix}
                  </div>
                  <div className="demo-card__meta">
                    <span>Delay {rule.delayMs} ms</span>
                    <span className="demo-dot" aria-hidden />
                    <span>状态 {rule.statusCode}</span>
                    <span className="demo-dot" aria-hidden />
                    <span className={mockOn ? 'tag-mock' : 'tag-pass'}>{mockOn ? 'Mock 响应' : '仅改写 / 透传'}</span>
                  </div>
                </div>
                <div className="demo-card__actions">
                  <button
                    type="button"
                    className={`demo-switch ${rule.ruleOn ? 'is-on' : ''}`}
                    onClick={() => toggleRule(rule.id)}
                    aria-pressed={rule.ruleOn}
                    title="规则开关（演示）"
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
                    title="删除（演示）"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {expanded && (
                <div className="demo-card__detail">
                  <label className="demo-field">
                    <span className="demo-field__label">Request payload</span>
                    <textarea readOnly rows={4} value={rule.requestPayload || '（空）'} className="demo-textarea" />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Response payload</span>
                    <textarea readOnly rows={5} value={rule.responsePayload || '（空，不发 Mock）'} className="demo-textarea" />
                  </label>
                  <label className="demo-field">
                    <span className="demo-field__label">Response headers</span>
                    <textarea readOnly rows={3} value={rule.responseHeaders || '（空）'} className="demo-textarea" />
                  </label>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {rules.length === 0 && (
        <p className="demo-empty">暂无规则。点击「新建规则」或「重置展示数据」。</p>
      )}
    </div>
  )
}
