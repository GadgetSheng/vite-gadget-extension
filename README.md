# gadget-extension（API 模拟）

基于 React + Vite + CRXJS 的 Chrome 扩展（MV3）：在页面内按规则对 `fetch` / `XMLHttpRequest` 匹配 URL（**忽略大小写**子串；或 `re:` 正则；或 `/pattern/flags` 正则字面量）。支持 **Mock 响应**（Response payload 非空）或 **改写请求体**。命中后在**页面控制台**打印 `[gadget-mock]`。规则仅在 **Popup** 编辑，存 `chrome.storage.local`。

产品说明见 [PRDS/soft.md](PRDS/soft.md)。

## Quick Start

1. 安装依赖：`npm install`
2. 开发：`npm run dev`，在 `chrome://extensions/` 以「加载已解压的扩展程序」选择 `dist`（与 CRXJS 一致）。
3. 构建：`npm run build`
4. 单元测试（规则匹配逻辑）：`npm test`（通过 `npx vitest@2.1.9` 运行，与仓库中 Vitest 配置一致）

## 手工验收

打开 [fixtures/mock-demo.html](fixtures/mock-demo.html)（本地文件即可）。在 Popup 中新增规则：URL 匹配片段填 `gadget-mock-demo`（或 `example.com/api` 等请求 URL 中会出现的子串），Response payload 填任意非空 JSON，开启全局与规则后点击页面上的 fetch / XHR 按钮，应看到 Mock 内容。

## 排错

- **Method**：列表/查询接口在 Network 里多为 **GET**，规则里若写 **POST** 不会命中。请改为 **`*`** 或与 Headers 里方法一致；保存后看 Console 是否出现 **`[gadget-mock] 规则已同步（顶层页面）`**。
- 若仍无 Mock：在页面 Console 执行 `sessionStorage.setItem('gadget-mock-debug','1')` 后刷新，再发请求，会打印 **`未命中`** 或 **Method 不一致**。
- **iframe**：已开启 `all_frames`，子框架内请求也会被注入；若请求来自扩展后台或非页面环境则无法拦截。
- Content script 使用 **`document_start`** 注入，并尽量提前加载 `inject.js`，减少「首屏请求早于挂钩」的竞态；匹配时会对 URL 做 **decodeURI / decodeURIComponent** 变体比对，减轻编码导致的假阴性。
- 规则填 `/queryWorkBenchList` 时，也会匹配 URL 中出现的 **`queryWorkBenchList`**（无前导 `/` 亦可）。

## 限制说明

- 仅拦截页面上下文中的 **fetch** 与 **XHR**，不包含 `sendBeacon`、`<img>`、WebSocket 等。
- 注入脚本运行在页面 **MAIN world**，恶意页面理论上可篡改同类钩子；本扩展定位为开发/自测工具。
- 部分站点 **CSP** 可能限制脚本注入，导致本扩展不生效。
- Side Panel 仅展示引导文案，配置请使用工具栏图标打开 Popup。

## Project Structure

- `src/popup/` — 规则编辑 Popup
- `src/content/main.tsx` — 注入桥接 + `storage` 同步
- `src/content/inject.js` — 页面内 fetch/XHR 包装（与 `src/shared/matchRule.ts` 语义对齐）
- `src/shared/` — 共享类型与匹配纯函数（含单测）
- `manifest.config.ts` — 扩展清单

## Documentation

- [CRXJS](https://crxjs.dev/vite-plugin)
- [Vite](https://vitejs.dev/)
