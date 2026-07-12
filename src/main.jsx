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

if (typeof window !== 'undefined' && sessionStorage.getItem('e2e:enabled') === '1') {
  // Merge defaults without clobbering values a test pre-set via an init script.
  const e2e = (window.__LINGO_E2E__ = window.__LINGO_E2E__ || {})
  e2e.ttsEvents = e2e.ttsEvents || []
  // Default the PWA install prompt to `disabled` so non-PWA specs are not
  // affected by the bottom install card; PWA specs opt into other modes.
  e2e.pwaInstall = e2e.pwaInstall || { mode: 'disabled', promptOutcome: null }
}

// Register the PWA service worker (offline caching).
import { registerSW } from 'virtual:pwa-register'
registerSW({ immediate: true })

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <App />
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
)
