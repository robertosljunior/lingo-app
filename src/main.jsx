import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted fonts (bundled by Vite → available offline).
import '@fontsource/manrope/400.css'
import '@fontsource/manrope/500.css'
import '@fontsource/manrope/600.css'
import '@fontsource/manrope/700.css'
import '@fontsource/manrope/800.css'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/500.css'

import './styles/tokens.css'
import { AppProvider } from './store.jsx'
import App from './App.jsx'

// Register the PWA service worker (offline caching). Injected by vite-plugin-pwa.
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
)
