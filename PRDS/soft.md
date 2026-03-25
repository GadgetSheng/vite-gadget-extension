# 浏览器内可定制 API 模拟器（扩展）— 产品文档

> 基于原「需求概述」扩展：在浏览器内通过规则拦截/改写请求或返回 Mock 响应，多规则、可单独开关、全局总开关。技术栈：Chrome 扩展（MV3）+ 现有 Vite + CRXJS 工程。

---

## 1. 产品定位与目标

### 1.1 一句话

在**不依赖外部 Mock 服务**的前提下，让前端/测试在真实页面环境里，按规则对指定 HTTP 请求进行**请求体改写**或**直接返回伪造响应**，用于联调、演示、异常场景复现。

### 1.2 目标用户

- 前端开发：本地页面调用后端 API 时临时替身或改参。
- QA / 自测：固定响应、延迟、错误码，做边界测试。

### 1.3 成功标准（可验收）

- 用户能在 UI 中配置多条规则，每条可独立启用/禁用。
- 存在**全局总开关**；关闭时扩展对网络行为零影响（或明确文档化的最小影响）。
- 匹配到的请求可按规则：**改写请求体**和/或**短路返回 Mock**（含自定义状态码、Header、Body、延迟）。
- 规则持久化，刷新页面后仍生效（在总开关与规则开关打开的前提下）。

---

## 2. 用户场景（User Stories）

| 场景 | 行为 |
|------|------|
| 联调占位 | 某接口后端未就绪，对 `GET /api/user` 直接返回固定 JSON。 |
| 改参调试 | 对 `POST /api/order` 在发出前把 body 中某字段改为测试值。 |
| 慢网/超时 | 对某 URL 增加固定 `Delay(ms)` 再转发或再返回 Mock。 |
| 多环境切换 | 多条规则对应不同路径前缀，只开其中几条模拟「部分可用」。 |

---

## 3. 功能需求

### 3.1 规则模型（建议字段）

与原流程一致，并建议补充语义说明：

| 字段 | 说明 |
|------|------|
| **Label** | 展示用别名，便于列表识别。 |
| **URL** | **首版（已确认）**：**前缀匹配**——请求 URL 以规则中填写的字符串为前缀即命中（例如规则填 `https://api.example.com/v1`，则 `https://api.example.com/v1/users` 命中）。大小写、尾斜杠等细节见决策记录。 |
| **HTTP Method** | 如 GET、POST、`*` 表示任意。 |
| **Delay (ms)** | 在应用 Mock 或改写后转发前等待（若同时存在「改写 + 真请求」，顺序需在实现中固定并写进文档）。 |
| **Request payload** | 可选；**仅当本条规则未启用 Mock 响应时生效**——对即将发出的真实请求做请求体改写（整段替换 vs 合并 JSON 仍可在实现阶段定稿）。若已启用 Mock，此项**不参与**（不发网）。 |
| **Response payload** | 启用 **Mock 响应** 时的 body。**已确认**：是否走 Mock 见下「Request vs Response」；未走 Mock 时本字段不生效，请求走真实网络 + 可选 Request 改写。 |
| **Response headers** | Mock 响应头；需约定与浏览器安全头冲突时的策略（见非功能）。 |
| **规则开关** | 单条启用/禁用。 |
| **全局总开关（Play）** | 一键关闭所有拦截逻辑。 |

### 3.2 匹配优先级

- 当多条规则同时匹配同一请求时，需定义：**第一条命中即停** / **最具体优先** / **用户拖拽排序**。建议在首版采用**列表顺序，自上而下第一条命中**以降低复杂度。

### 3.3 行为模式（已确认：问题 2 = A）

1. **仅改写请求**：匹配后修改请求体（及可选 Header），请求仍发往真实网络。  
2. **Mock 响应**：匹配后不发送真实请求，直接返回配置的 status + headers + body（经 Delay 后返回）。

**同一条规则同时填写 Request 与 Response 时（问题 2A）**：**只要该规则被判定为「已启用 Mock 响应」，则一律走 Mock**——**不发起真实网络请求**，且 **Request payload 改写不生效**。**仅当未启用 Mock** 时，才应用 Request 改写并发网。

**「已启用 Mock 响应」的判定（首版建议，可与 UI 一致微调）**：以 **Response payload 非空**作为启用 Mock 的默认条件；若需 **无 body** 的 Mock（如 204），首版可用占位说明（例如仍填 `{}`）或增加独立「强制 Mock / 无 body」控件（列入后续迭代亦可）。

### 3.4 规则管理

- 新建空规则、编辑、删除、复制（可选）。
- 导入/导出 JSON（可选，利于团队共享规则）。

### 3.5 交互入口（已确认：问题 3 = A）

**首版唯一主入口：Popup** — `+` 新建规则 → 编辑字段 → 单条规则开关 → 全局 Play。

**Side Panel**：不作为首版配置入口；实现阶段可与 manifest 对齐——若仓库仍保留 `side_panel`，建议**移除规则编辑**或**整页引导打开 Popup**，避免双入口与状态分叉。后续若需宽屏编辑体验，再单独开需求评估 Side Panel。

---

## 4. 非功能需求

- **性能**：拦截逻辑应轻量，避免明显拖慢页面 fetch/XHR。
- **安全**：Mock 响应不应自动绕过 CSP 对页面脚本的限制；需明确扩展只影响**由页面发起的、被钩子覆盖的请求**。
- **隐私**：规则与 payload 存 **`chrome.storage.local`（已确认，仅本机）**；跨配置文件同步或云同步若需要另开 PRD；首版不使用 `storage.sync`。
- **可观测性（建议）**：可选「最近命中日志」便于调试（仅内存或最近 N 条），避免默认长期记录敏感数据。

---

## 5. 技术架构与关键实现方案（MV3）

### 5.1 为何不能仅靠 Service Worker 拦截页面请求

Manifest V3 下，扩展的 **Service Worker** 的 `fetch` 事件**收不到网页文档里的 `fetch()`/`XHR`**。`declarativeNetRequest` 适合改 URL、header、重定向等，对**任意 JSON 请求体改写**和**合成响应体**支持有限或不适用。因此业界常见做法是：**在页面的主世界（Main World）注入脚本，包装 `window.fetch` 与 `XMLHttpRequest`**。

当前仓库已有 `content_scripts` 与 `web_accessible_resources` 中的 `inject.js`，方向与上述一致。

### 5.2 推荐数据流

1. **配置 UI**（**仅 Popup**，见 3.5）：读写 **`chrome.storage.local`** 中的规则列表 + 全局开关（首版不启用 `storage.sync`）。
2. **Content Script**：在文档启动早期将 `inject.js` 注入 **MAIN** world（`chrome.scripting.executeScript({ world: 'MAIN' })` 或动态 `<script src="chrome-extension://.../inject.js">`），保证尽量早于业务请求。
3. **Inject 脚本**：
   - 从 `chrome.runtime.sendMessage` 或首次由 content script **注入初始规则快照**（因 MAIN world 访问 storage 不便，通常由 content script 转发）。
   - 包装 `fetch` / `XHR`：匹配规则 → `delay` → 若 Mock 则返回 `Response` 对象或伪造 XHR 回调；若仅改写则修改 init/body 后调用原始 fetch/XHR。
4. **规则热更新**：storage `onChanged` 时 content script 通知 inject 更新内存规则。

### 5.3 权限与 manifest（实现时要落地的点）

- `storage`：已有。
- `scripting` + `activeTab` 或 `matches`：按注入策略申请（全站注入需 `<all_urls>` 或用户可接受的主机权限范围）。
- `host_permissions`：若 Mock 模式仍要「改写后发真实请求」，页面本身会发请求，一般**不额外要求**扩展具备该 API 的 host 权限；但若用 `chrome.debugger` 等方案则过重，不推荐首版。

### 5.4 Delay 语义

- **Mock**：在返回合成响应前 `await delay`。
- **改写 + 真请求**：在调用原始 `fetch` 前 delay，以模拟慢请求。

### 5.5 测试建议

- fixture 页面：内置或本地 HTML，发起多种 `fetch`/XHR 组合。
- 单元测试：规则匹配函数（URL + Method）、payload 合并逻辑。

---

## 6. 风险与限制

- **CSP / nonce**：部分站点 CSP 可能阻止内联或外部注入脚本；`web_accessible_resources` + 扩展注入相对常规脚本注入更可控，但仍有个别页面极端策略导致失效，需在文档中说明。
- **非 fetch/XHR 请求**：如 `navigator.sendBeacon`、图片标签、WebSocket 等，首版可明确**不在范围内**。
- **Service Worker 页面**：PWA 内请求与主文档上下文需验证是否均需注入。

---

## 7. 里程碑建议（仅产品节奏，非开发排期）

1. **MVP**：单规则、**URL 前缀匹配**、Method 精确、Mock 响应 + 全局开关 + 列表规则开关。
2. **v1.1**：请求体改写 + Delay + 规则排序与命中策略文档化。
3. **v1.2**：导入导出、简单命中日志（可选）。

---

## 决策记录

| 日期 | 议题 | 结论 |
|------|------|------|
| 2025-03-25 | 问题 1：URL 匹配方式 | **A — 前缀匹配**。实现约定：按完整 URL 字符串前缀比较；建议规范化（如比较前对规则与请求 URL 做统一处理：**去除尾部多余 `/`** 或**不自动去除**二选一时，实现与 UI 提示保持一致；**协议 + 主机需写全**，避免仅填 path 导致与 `fetch` 绝对 URL 不一致）。 |
| 2025-03-25 | 问题 2：同规则下 Request 与 Response 并存 | **A — Mock 优先**。只要规则被判定为**已启用 Mock 响应**，则**不发真实请求**，**Request payload 不参与**；**仅未启用 Mock** 时才做 Request 改写并发网。首版 Mock 启用建议以 **Response payload 非空**为准；无 body 场景见 3.3 说明。 |
| 2025-03-25 | 问题 3：主 UI | **A — 仅 Popup** 作为规则配置与总开关入口。Side Panel 首版不承担配置；实现上避免与 Popup 双写同一套规则 UI。 |
| 2025-03-25 | 问题 4：规则存储 | **A — 仅本机 `chrome.storage.local`**。首版不用 `storage.sync`；跨设备需求可走后续「导出/导入」或单独同步方案。 |

---

## 8. 待确认项

当前 PRD 中列出的 **问题 1–4 均已决策**；若范围变更，请在本节或「决策记录」中追加条目。

---

## 附录：原始需求摘要（保留）

- 浏览器扩展作为浏览器内可定制 API 模拟服务器。  
- 通过规则捕获/修改 HTTP；匹配时可重写请求体或返回 Mock；多规则、单独开关。  
- 流程：Popup → `+` 建规则 → 编辑 URL/Method/Delay/Label/Request/Response/Headers → 规则开关 → 全局 Play。  
- 技术：浏览器插件，基于现有项目目录结构。
