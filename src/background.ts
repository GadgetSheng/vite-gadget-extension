import { STORAGE_KEYS } from '@/shared/rule'
import { getExtensionState } from '@/storage'

/** 总开关关闭：暗色图标；开启：亮色图标 */
const ICON = {
  off: { 48: 'public/dark.png' },
  on: { 48: 'public/light.png' },
} as const

async function applyToolbarIcon(globalEnabled: boolean): Promise<void> {
  await chrome.action.setIcon({
    path: globalEnabled ? ICON.on : ICON.off,
  })
}

async function syncIconFromStorage(): Promise<void> {
  const s = await getExtensionState()
  await applyToolbarIcon(s.globalEnabled)
}

chrome.runtime.onInstalled.addListener(() => {
  void syncIconFromStorage()
})
chrome.runtime.onStartup.addListener(() => {
  void syncIconFromStorage()
})
void syncIconFromStorage()

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  const ch = changes[STORAGE_KEYS.globalEnabled]
  if (!ch) return
  const enabled = ch.newValue !== false
  void applyToolbarIcon(enabled)
})
