## Why

当前 popup 页面以 browser extension popup 的形式存在，受限于 browser popup 的尺寸和生命周期（关闭 popup 后内容销毁）。用户需要更稳定的面板来管理 mock 规则，且希望获得更大的可视空间。

迁移到 slide 面板可以提供：
- 持久存在的内容区域，不受 popup 生命周期影响
- 更大的布局空间，支持更复杂的内容展示
- 与侧边栏体验一致的操作习惯

## What Changes

- 将 popup 页面从 browser extension popup 迁移到 slide panel（侧边滑动面板）
- 使用 Chrome Side Panel API 实现面板功能
- 保持所有现有功能（规则管理、变量管理、导入导出）
- 移除原有的 popup 相关文件

## Capabilities

### New Capabilities
- `slide-panel`: 实现基于 Chrome Side Panel API 的滑动面板，作为主要交互界面

### Modified Capabilities
- (无 spec 级别变更，功能保持一致)

## Impact

- 代码变更：涉及 manifest.json（移除 popup 配置，添加 side_panel）、新建 slide 入口文件
- 依赖变更：需要 Chrome 120+（Side Panel API 最低要求）
- 移除：src/popup 目录