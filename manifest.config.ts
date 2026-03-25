import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/dark.png',
  },
  action: {
    default_icon: {
      48: 'public/dark.png',
    },
    default_popup: 'src/popup/index.html',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: [
    'storage',
  ],
  content_scripts: [{
    js: ['src/content/main.tsx'],
    matches: ['<all_urls>'],
    /** 尽早注入，减少首屏请求早于 inject.js 加载的竞态 */
    run_at: 'document_start',
    /** 子 frame 内的 fetch/XHR 也需注入，否则 iframe 里发的请求不会被 Mock */
    all_frames: true,
  }],
  web_accessible_resources: [{
    resources: ['src/content/inject.js', 'public/light.png'],
    matches: ['<all_urls>'],
  }],
})
