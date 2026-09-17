// 必须最先求值：api.ts 在加载时就把 window.gugu 抓走（见 tauri-bridge 注释）
import './tauri-bridge'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
