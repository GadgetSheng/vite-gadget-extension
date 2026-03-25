import {
  closeSearchPanel,
  findNext,
  getSearchQuery,
  SearchQuery,
  setSearchQuery,
} from '@codemirror/search'
import { EditorView, runScopeHandlers } from '@codemirror/view'
import type { Panel, ViewUpdate } from '@codemirror/view'

/**
 * 精简搜索面板：仅搜索框 + 后缀开关（参考 VS Code 风格），Enter 跳转下一处匹配。
 */
export function createCompactSearchPanel(view: EditorView): Panel {
  return new CompactSearchPanel(view)
}

class CompactSearchPanel implements Panel {
  dom: HTMLElement
  top = true
  private view: EditorView
  private query: SearchQuery
  private searchField: HTMLInputElement
  private caseBtn: HTMLButtonElement
  private wordBtn: HTMLButtonElement
  private reBtn: HTMLButtonElement
  private commitBound: () => void
  private keydownBound: (e: KeyboardEvent) => void

  constructor(view: EditorView) {
    this.view = view
    this.query = getSearchQuery(view.state)
    this.commitBound = this.commit.bind(this)
    this.keydownBound = this.onKeydown.bind(this)

    this.searchField = document.createElement('input')
    this.searchField.type = 'text'
    this.searchField.className = 'cm-textfield cm-search-compact__input'
    this.searchField.setAttribute('main-field', 'true')
    this.searchField.setAttribute('aria-label', '搜索')
    this.searchField.placeholder = '搜索'
    this.searchField.value = this.query.search
    this.searchField.autocomplete = 'off'
    this.searchField.spellcheck = false

    this.caseBtn = this.makeToggle('Aa', '区分大小写', this.query.caseSensitive)
    this.wordBtn = this.makeToggle('ab', '全字匹配', this.query.wholeWord, true)
    this.reBtn = this.makeToggle('.*', '正则表达式', this.query.regexp)

    const suffix = document.createElement('div')
    suffix.className = 'cm-search-compact__suffix'
    suffix.append(this.caseBtn, this.wordBtn, this.reBtn)

    const inputWrap = document.createElement('div')
    inputWrap.className = 'cm-search-compact__input-wrap'
    inputWrap.append(this.searchField, suffix)

    const closeBtn = document.createElement('button')
    closeBtn.type = 'button'
    closeBtn.className = 'cm-search-compact__close'
    closeBtn.setAttribute('aria-label', '关闭搜索')
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => closeSearchPanel(this.view))

    const row = document.createElement('div')
    row.className = 'cm-search-compact__row'
    row.append(inputWrap, closeBtn)

    this.dom = document.createElement('div')
    this.dom.className = 'cm-panel cm-search cm-search--compact'
    this.dom.append(row)

    this.searchField.addEventListener('input', this.commitBound)
    this.caseBtn.addEventListener('click', () => this.toggleBtn(this.caseBtn))
    this.wordBtn.addEventListener('click', () => this.toggleBtn(this.wordBtn))
    this.reBtn.addEventListener('click', () => this.toggleBtn(this.reBtn))
    this.dom.addEventListener('keydown', this.keydownBound)
  }

  private makeToggle(
    label: string,
    title: string,
    pressed: boolean,
    wholeWordStyle?: boolean,
  ): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'cm-search-compact__toggle'
    if (wholeWordStyle) btn.classList.add('cm-search-compact__toggle--word')
    btn.title = title
    btn.setAttribute('aria-pressed', pressed ? 'true' : 'false')
    btn.setAttribute('aria-label', title)
    btn.textContent = label
    return btn
  }

  private toggleBtn(btn: HTMLButtonElement) {
    const next = btn.getAttribute('aria-pressed') !== 'true'
    btn.setAttribute('aria-pressed', next ? 'true' : 'false')
    this.commit()
  }

  private pressed(btn: HTMLButtonElement): boolean {
    return btn.getAttribute('aria-pressed') === 'true'
  }

  /**
   * findNext 末尾会 selectSearchInput 全选搜索框，下一键会整段替换，表现为只能输入一个字符。
   * 在微任务里把光标移回输入末尾，便于连续输入。
   */
  private findNextKeepSearchCaret() {
    const el = this.searchField
    findNext(this.view)
    queueMicrotask(() => {
      el.focus()
      const len = el.value.length
      el.setSelectionRange(len, len)
    })
  }

  private commit() {
    const next = new SearchQuery({
      search: this.searchField.value,
      caseSensitive: this.pressed(this.caseBtn),
      regexp: this.pressed(this.reBtn),
      wholeWord: this.pressed(this.wordBtn),
      literal: true,
      replace: '',
    })
    if (next.eq(this.query)) return
    this.query = next
    this.view.dispatch({ effects: setSearchQuery.of(next) })
    if (next.valid) this.findNextKeepSearchCaret()
  }

  private onKeydown(e: KeyboardEvent) {
    if (runScopeHandlers(this.view, e, 'search-panel')) {
      e.preventDefault()
      return
    }
    if (e.key === 'Enter' && e.target === this.searchField) {
      e.preventDefault()
      this.findNextKeepSearchCaret()
    }
  }

  mount() {
    this.searchField.focus()
    this.searchField.select()
  }

  update(update: ViewUpdate) {
    for (const tr of update.transactions) {
      for (const effect of tr.effects) {
        if (effect.is(setSearchQuery) && !effect.value.eq(this.query)) {
          this.setQuery(effect.value)
        }
      }
    }
  }

  private setQuery(q: SearchQuery) {
    this.query = q
    this.searchField.value = q.search
    this.caseBtn.setAttribute('aria-pressed', q.caseSensitive ? 'true' : 'false')
    this.wordBtn.setAttribute('aria-pressed', q.wholeWord ? 'true' : 'false')
    this.reBtn.setAttribute('aria-pressed', q.regexp ? 'true' : 'false')
  }

  destroy() {
    this.searchField.removeEventListener('input', this.commitBound)
    this.dom.removeEventListener('keydown', this.keydownBound)
  }
}
