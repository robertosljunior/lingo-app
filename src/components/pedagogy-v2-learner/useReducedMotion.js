// useReducedMotion.js — Slice V2.17 (§30). Returns true when animations should
// be suppressed: either the OS `prefers-reduced-motion: reduce` media query is
// on, OR the app's explicit setting requests it. The learner UX must not depend
// on an internal setting alone — the media query is the primary signal.

import { useEffect, useState } from 'react'

export function useReducedMotion(settingOverride = false) {
  const [systemReduced, setSystemReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e) => setSystemReduced(e.matches)
    // addEventListener is the modern API; fall back for older engines.
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [])

  return systemReduced || !!settingOverride
}
