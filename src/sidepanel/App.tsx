import './App.css'

export default function App() {
  return (
    <div className="sidepanel-guide">
      <h1 className="sidepanel-guide__title">API 模拟</h1>
      <p className="sidepanel-guide__text">
        规则与总开关请在扩展的 <strong>Popup</strong> 中配置：点击浏览器工具栏上的扩展图标打开面板。
      </p>
      <p className="sidepanel-guide__hint">Side Panel 仅作说明，避免与 Popup 双入口。</p>
    </div>
  )
}
