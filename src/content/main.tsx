import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './views/App.tsx'
import { getRules } from '../storage'

console.log('[Tweak Clone] Content script loaded.')

// 1. Inject the mocking script into the page's MAIN world
const script = document.createElement('script')
// Note: In dev mode this is .ts, CRXJS might map it.
// If there are issues, we will adjust the extension injection method.
script.src = chrome.runtime.getURL('src/content/inject.ts')
script.onload = () => {
  script.remove()
}
;(document.head || document.documentElement).appendChild(script)

// 2. Establish the bridge to send rules to the injected script
const sendRulesToPage = async () => {
  const rules = await getRules()
  window.postMessage({ type: 'TWEAK_UPDATE_RULES', rules }, '*')
}

// Send rules initially after a short delay to ensure script is injected and ready
setTimeout(sendRulesToPage, 100)

// Listen for rule changes from storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.rules) {
    sendRulesToPage()
  }
})

// Optional: keep the floating UI if needed, or remove it. Let's keep it for now.
const container = document.createElement('div')
container.id = 'crxjs-app'
document.body.appendChild(container)
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
