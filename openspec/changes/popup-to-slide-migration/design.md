## Context

当前扩展使用 browser extension popup 作为主交互界面。Popup 存在以下限制：
- 窗口尺寸受限（通常 300x400px）
- 关闭 popup 后 React 树销毁，数据需重新从 storage 加载
- 无法与页面内容同时存在

Chrome Side Panel API 提供持久侧边面板，生命周期与 tab 绑定，可保持连接。

## Goals / Non-Goals

**Goals:**
- 使用 Chrome Side Panel API 实现持久侧边面板
- 保持现有所有功能（规则 CRUD、变量管理、导入导出）
- 提供更大的内容展示空间

**Non-Goals:**
- 不改变数据存储结构（继续使用 chrome.storage）
- 不实现多窗口支持
- 不修改 content script 逻辑

## Decisions

1. **Side Panel 替代 Popup**

   Chrome Side Panel API（Chrome 120+）提供与 popup 相同的权限模型，但拥有持久生命周期和更大视口。

   替代方案对比：
   - `browser.action.popup`：受限于尺寸和生命周期
   - `sidePanel`（新）：持久、较大视口、API 简洁

2. **入口文件结构**

   创建 `src/sidepanel/` 目录，复制 popup 逻辑并调整为 side panel 环境。
   - `src/sidepanel/index.html`：side panel 入口
   - `src/sidepanel/main.tsx`：渲染入口
   - 复用 `src/popup/App.tsx` 作为主组件（可能需小幅调整）

3. **Manifest 配置变更**

   ```json
   {
     "side_panel": {
       "default_path": "sidepanel/index.html"
     },
     "permissions": ["sidePanel"]
   }
   ```
   移除原有的 `browser_action` popup 配置。

4. **Vite 构建配置调整**

   在 `vite.config.ts` 中添加 `sidepanel` 入口的打包配置，与 popup 并行构建。

## Risks / Trade-offs

- **[风险] Chrome 版本要求**：Side Panel API 仅在 Chrome 120+ 可用，低版本用户无法使用
  - **缓解**：旧版本 popup 作为 fallback 暂不删除，待完全迁移后清理

- **[风险] 工具栏图标点击行为**：用户习惯点击扩展图标打开 popup
  - **缓解**：side panel 可通过工具栏图标触发打开（`chrome.sidePanel.setOptions`），体验一致