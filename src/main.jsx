import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// WebView2 데스크탑 앱에서 PWA Service Worker의 autoUpdate가
// 설치 완료 시 페이지를 강제 reload하여 환영 화면이 소멸되는 버그가 있어 비활성화합니다.
// registerSW({ immediate: true })


createRoot(document.getElementById('root')).render(
  <App />
)
