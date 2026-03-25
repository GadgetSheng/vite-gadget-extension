import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { openSearchPanel, search } from '@codemirror/search'
import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createCompactSearchPanel } from './compactSearchPanel'

export type PayloadField = 'requestPayload' | 'responsePayload' | 'responseHeaders' | 'responseSnippet'

type TabId = 'response' | 'request' | 'headers' | 'snippet'

const TAB_TO_FIELD: Record<TabId, PayloadField> = {
  response: 'responsePayload',
  request: 'requestPayload',
  headers: 'responseHeaders',
  snippet: 'responseSnippet',
}

const PLACEHOLDERS: Record<TabId, string> = {
  request: '非 Mock 时整段替换请求体',
  response: '非空则 Mock，不发起真实请求',
  headers: 'Content-Type: application/json',
  snippet: 'return _.merge(response, { … })',
}

const editorChrome = EditorView.theme(
  {
    '&': { fontSize: '11px' },
    '.cm-scroller': {
      borderRadius: '8px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    '.cm-gutters': {
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      color: '#71717a',
    },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(255, 255, 255, 0.06)' },
    '.cm-activeLine': { backgroundColor: 'rgba(255, 255, 255, 0.04)' },
    '.cm-content': {
      fontFamily: "ui-monospace, 'Cascadia Code', Consolas, monospace",
      caretColor: '#e4e4e7',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#e4e4e7' },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(45, 212, 191, 0.25) !important',
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(56, 189, 248, 0.18)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'rgba(250, 204, 21, 0.45)',
      boxShadow: 'inset 0 0 0 1px rgba(250, 204, 21, 0.65)',
    },
  },
  { dark: true },
)

/** 禁用「上一处」快捷键，仅保留 Enter / Mod-g 等向前搜索 */
const searchNoPrevKeymap = Prec.high(
  keymap.of([
    { key: 'Shift-Mod-g', run: () => true, preventDefault: true },
    { key: 'Shift-F3', run: () => true, preventDefault: true },
  ]),
)

export interface PayloadTabsEditorProps {
  requestPayload: string
  responsePayload: string
  responseHeaders: string
  responseSnippet: string
  onFieldChange: (field: PayloadField, value: string) => void
  /** Shown under editor when Response tab is active */
  responseJsonHint?: string | null
}

export function PayloadTabsEditor({
  requestPayload,
  responsePayload,
  responseHeaders,
  responseSnippet,
  onFieldChange,
  responseJsonHint,
}: PayloadTabsEditorProps) {
  const [tab, setTab] = useState<TabId>('response')
  const cmRef = useRef<ReactCodeMirrorRef>(null)
  const lastFocusedViewRef = useRef<EditorView | null>(null)

  const value = useMemo(() => {
    switch (tab) {
      case 'request':
        return requestPayload
      case 'response':
        return responsePayload
      case 'headers':
        return responseHeaders
      case 'snippet':
        return responseSnippet
      default:
        return ''
    }
  }, [tab, requestPayload, responsePayload, responseHeaders, responseSnippet])

  const focusTracker = useMemo(
    () =>
      EditorView.domEventHandlers({
        focus(_e, view) {
          lastFocusedViewRef.current = view
          return false
        },
      }),
    [],
  )

  const extensions = useMemo(() => {
    const base = [
      search({ top: true, literal: true, createPanel: createCompactSearchPanel }),
      searchNoPrevKeymap,
      editorChrome,
      focusTracker,
    ]
    if (tab === 'headers') {
      return base
    }
    if (tab === 'snippet') {
      return [javascript({ jsx: true, typescript: true }), ...base]
    }
    return [json(), ...base]
  }, [tab, focusTracker])

  const handleChange = useCallback(
    (next: string) => {
      onFieldChange(TAB_TO_FIELD[tab], next)
    },
    [onFieldChange, tab],
  )

  const handleFormat = useCallback(() => {
    if (tab === 'headers') return
    const raw = value
    const t = raw.trim()
    if (!t) return
    try {
      const formatted = JSON.stringify(JSON.parse(t), null, 2)
      onFieldChange(TAB_TO_FIELD[tab], formatted)
    } catch {
      window.alert('无法解析 JSON，请修正后再格式化')
    }
  }, [tab, value, onFieldChange])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      window.alert('复制失败，请检查浏览器剪贴板权限')
    }
  }, [value])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'f' && e.key !== 'F') return
      e.preventDefault()
      e.stopPropagation()
      const view = lastFocusedViewRef.current ?? cmRef.current?.view
      if (view) openSearchPanel(view)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const onCreateEditor = useCallback((view: EditorView) => {
    lastFocusedViewRef.current = view
  }, [])

  const jsonTab = tab === 'request' || tab === 'response'

  return (
    <div className="payload-tabs-editor">
      <div className="payload-tabs-editor__bar">
        <div className="payload-tabs-editor__tabs" role="tablist" aria-label="Mock 载荷">
          <button
            type="button"
            role="tab"
            className={`payload-tabs-editor__tab ${tab === 'response' ? 'is-active' : ''}`}
            aria-selected={tab === 'response'}
            onClick={() => setTab('response')}
          >
            Response payload
          </button>
          <button
            type="button"
            role="tab"
            className={`payload-tabs-editor__tab ${tab === 'request' ? 'is-active' : ''}`}
            aria-selected={tab === 'request'}
            onClick={() => setTab('request')}
          >
            Request payload
          </button>
          <button
            type="button"
            role="tab"
            className={`payload-tabs-editor__tab ${tab === 'headers' ? 'is-active' : ''}`}
            aria-selected={tab === 'headers'}
            onClick={() => setTab('headers')}
          >
            Response headers
          </button>
          <button
            type="button"
            role="tab"
            className={`payload-tabs-editor__tab ${tab === 'snippet' ? 'is-active' : ''}`}
            aria-selected={tab === 'snippet'}
            onClick={() => setTab('snippet')}
          >
            Response snippet
          </button>
        </div>
        <div className="payload-tabs-editor__tools">
          <button
            type="button"
            className="payload-tabs-editor__icon-btn"
            onClick={handleFormat}
            disabled={!jsonTab}
            title="格式化 JSON"
            aria-label="格式化 JSON"
          >
            ≡
          </button>
          <button
            type="button"
            className="payload-tabs-editor__icon-btn"
            onClick={handleCopy}
            title="复制当前内容"
            aria-label="复制当前内容"
          >
            ⧉
          </button>
        </div>
      </div>

      <div className="payload-tabs-editor__panel" role="tabpanel">
        <CodeMirror
          ref={cmRef}
          value={value}
          height="200px"
          theme="dark"
          basicSetup={{ lineNumbers: true, foldGutter: false, searchKeymap: true }}
          extensions={extensions}
          placeholder={PLACEHOLDERS[tab]}
          onChange={handleChange}
          onCreateEditor={onCreateEditor}
          className="payload-tabs-editor__cm"
        />
      </div>

      {tab === 'response' && responseJsonHint ? (
        <p className="demo-json-hint">{responseJsonHint}</p>
      ) : null}

      {tab === 'snippet' ? (
        <p className="payload-tabs-editor__snippet-hint">
          ：可访问 <code>response</code>（Mock 时为下方 Response payload 解析结果；透传 <code>fetch</code> 时为真实响应体）、
          <code>url</code>、<code>method</code>、<code>body</code>、<code>vars</code>（见 Popup「自定义变量」）、<code>chance</code>（占位）、
          <code>_</code>（<code>merge</code> / <code>pick</code> / <code>isEqual</code>）。代码体需 <code>return</code>；抛错或仅
          <code>undefined</code> 时回退为未跑脚本的响应文本。透传路径下 <strong>XHR</strong> 不执行 snippet。
        </p>
      ) : null}

      <p className="payload-tabs-editor__hint">在此编辑 Mock 响应等内容；⌘F / Ctrl+F 在编辑器内查找</p>
    </div>
  )
}
