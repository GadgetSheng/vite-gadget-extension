import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: pkg.name,
  version: pkg.version,
  icons: {
    48: 'public/logo.png',
  },
  action: {
    default_icon: {
      48: 'public/logo.png',
    },
    default_popup: 'src/popup/index.html',
  },
  permissions: [
    'storage',
    'sidePanel',
    'contentSettings',
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
    resources: ['src/content/inject.js'],
    matches: ['<all_urls>'],
  }],
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },
})
