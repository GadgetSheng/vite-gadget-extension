/** 展示用静态数据（含「封面图」占位，内联 SVG data URI，无需外网） */

export interface DemoRuleRow {
  id: string
  label: string
  /** 展示用封面：data URI SVG */
  coverImage: string
  urlPrefix: string
  method: string
  delayMs: number
  statusCode: number
  requestPayload: string
  responsePayload: string
  responseHeaders: string
  ruleOn: boolean
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function coverSvg(label: string, accent: string): string {
  const safe = escapeXml(label)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="96" viewBox="0 0 144 96">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#0c0c0f" stop-opacity="1"/>
  </linearGradient></defs>
  <rect width="144" height="96" rx="8" fill="#141418"/>
  <rect width="144" height="96" rx="8" fill="url(#g)"/>
  <text x="72" y="54" text-anchor="middle" fill="#e4e4e7" font-size="11" font-family="ui-monospace,monospace">${safe}</text>
</svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

export const DEMO_RULES: DemoRuleRow[] = [
  {
    id: 'demo-1',
    label: '用户资料 Mock',
    coverImage: coverSvg('GET /user', '#22d3ee'),
    urlPrefix: 'https://api.example.com/v1/users',
    method: 'GET',
    delayMs: 0,
    statusCode: 200,
    requestPayload: '—',
    responsePayload:
      '{\n  "id": "u_1024",\n  "name": "演示用户",\n  "avatar": "https://picsum.photos/seed/user/64/64"\n}',
    responseHeaders: 'Content-Type: application/json',
    ruleOn: true,
  },
  {
    id: 'demo-2',
    label: '下单改写（仅请求）',
    coverImage: coverSvg('POST order', '#a3e635'),
    urlPrefix: 'https://api.example.com/v1/orders',
    method: 'POST',
    delayMs: 400,
    statusCode: 200,
    requestPayload:
      '{\n  "sku": "DEMO-SKU",\n  "qty": 1,\n  "note": "由扩展演示数据注入"\n}',
    responsePayload: '',
    responseHeaders: '—',
    ruleOn: false,
  },
  {
    id: 'demo-3',
    label: '慢速列表',
    coverImage: coverSvg('DELAY', '#fbbf24'),
    urlPrefix: 'https://cdn.example.com/assets',
    method: '*',
    delayMs: 2000,
    statusCode: 200,
    requestPayload: '—',
    responsePayload: '{\n  "items": [],\n  "meta": { "demo": true }\n}',
    responseHeaders: 'Content-Type: application/json\nX-Mock-By: gadget-demo',
    ruleOn: true,
  },
]

export function emptyDemoRule(): DemoRuleRow {
  return {
    id: `new-${Date.now()}`,
    label: '新规则（演示）',
    coverImage: coverSvg('NEW', '#94a3b8'),
    urlPrefix: '',
    method: '*',
    delayMs: 0,
    statusCode: 200,
    requestPayload: '',
    responsePayload: '{}',
    responseHeaders: 'Content-Type: application/json',
    ruleOn: false,
  }
}
