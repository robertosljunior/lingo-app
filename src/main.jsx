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
import { ErrorBoundary } from './components/error-boundary.jsx'
import { installGlobalErrorLogging } from './lib/error-log.js'

// Capture uncaught errors/rejections into the persistent diagnostic log
// before anything else can fail.
installGlobalErrorLogging()

// Register the PWA service worker (offline caching + COOP/COEP injection).
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

// Cross-origin isolation (→ SharedArrayBuffer → multi-threaded WASM for the
// CPU AI backend) comes from headers the service worker stamps on navigations,
// so the first load — served before the worker controls the page — is never
// isolated. Reload once when the worker takes over; the sessionStorage guard
// stops any loop on browsers that ignore the injected headers.
if ('serviceWorker' in navigator && !window.crossOriginIsolated && !sessionStorage.getItem('coi-reload')) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    sessionStorage.setItem('coi-reload', '1')
    window.location.reload()
  }, { once: true })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
)
