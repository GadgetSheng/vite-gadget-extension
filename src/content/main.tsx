import { getExtensionState } from '../storage'

const MSG_TYPE = 'GADGET_UPDATE_RULES'

console.log('[gadget-extension] Content script loaded.')

function postRulesToPage(
  globalEnabled: boolean,
  rules: unknown[],
  variables: Record<string, string>
) {
  window.postMessage(
    {
      type: MSG_TYPE,
      globalEnabled,
      rules,
      variables,
    },
    '*'
  )
}

async function pushStateToPage() {
  const state = await getExtensionState()
  postRulesToPage(state.globalEnabled, state.rules, state.variables)
}

const injectScriptUrl = chrome.runtime.getURL('src/content/inject.js')
const script = document.createElement('script')
script.src = injectScriptUrl
/** 尽量按插入顺序执行，缩短与页面首包 fetch 的竞态窗口 */
script.async = false
script.onload = () => {
  script.remove()
  void pushStateToPage()
}
script.onerror = (e) => {
  console.error(
    '[gadget-extension] Failed to load inject script:',
    injectScriptUrl,
    e
  )
}
;(document.head || document.documentElement).appendChild(script)

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return
  if (changes.rules || changes.globalEnabled || changes.variables) {
    void pushStateToPage()
  }
})
