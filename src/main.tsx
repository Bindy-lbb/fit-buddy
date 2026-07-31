import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// HashRouter：托管在 Supabase Storage 上没有 SPA 重写规则，
// /g/ABC234 这类深链接直接访问会 404，只有 #/g/ABC234 能保证任何时候都落回 index.html
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
