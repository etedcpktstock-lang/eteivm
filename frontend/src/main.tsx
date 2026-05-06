import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/plain-ui.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div data-theme="corporate" className="min-h-screen bg-base-200 text-base-content">
      <App />
    </div>
  </StrictMode>,
)
