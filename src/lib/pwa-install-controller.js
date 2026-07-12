export const INSTALL_STORAGE_KEY = 'pwa_install_state'
export const FABIOLA_STORAGE_KEY = 'pwa_fabiola_state'
export const FABIOLA_VOICE_ID = 'pt_BR-fabiola-medium'
const DISMISS_MS = 7 * 86400000
let deferredPrompt = null
function nowIso(){ return new Date().toISOString() }
export function loadInstallState(){ try { return JSON.parse(localStorage.getItem(INSTALL_STORAGE_KEY) || '{}') } catch { return {} } }
export function saveInstallState(patch){ const next={...loadInstallState(),...patch}; localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(next)); return next }
// Deterministic E2E hook. It is NEVER present in a production build — only
// Playwright init scripts set `window.__LINGO_E2E__`. When present it lets a test
// pin the install state (disabled / eligible / standalone / manual_instructions)
// so the REAL controller logic runs against controlled inputs, instead of the
// controller being globally hidden. Reading it does not change production
// behavior because production never defines the global.
export function getE2EPwaState(){ try { return (typeof window!=='undefined' && window.__LINGO_E2E__ && window.__LINGO_E2E__.pwaInstall) || null } catch { return null } }
export function isStandalone(){ const e2e=getE2EPwaState(); if(e2e) return e2e.mode==='standalone'; return !!(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone) }
export function isMobileLike(){ if(getE2EPwaState()) return true; return matchMedia?.('(max-width: 768px)')?.matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) }
export function initPwaInstallController(){
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event)=>{ event.preventDefault(); deferredPrompt=event; saveInstallState({ install_prompt_status:'eligible', install_prompt_seen_at: nowIso(), has_programmatic_prompt:true }) })
  window.addEventListener('appinstalled', ()=>{ deferredPrompt=null; saveInstallState({ install_prompt_status:'installed', installed_at: nowIso() }); markStandaloneLaunch() })
}
export function getInstallEligibility({ allowManualFallback=false }={}){
  const st=loadInstallState()
  const e2e=getE2EPwaState()
  if(e2e){
    // Deterministic E2E path — still honors persisted install/dismiss state so
    // "dismissed → não reaparece" and "accepted → installed" behave for real.
    if(st.install_prompt_status==='installed' || e2e.mode==='standalone') return { eligible:false, reason:'installed' }
    if(e2e.mode==='disabled') return { eligible:false, reason:'e2e_disabled' }
    if(st.install_prompt_dismissed_at && Date.now()-Date.parse(st.install_prompt_dismissed_at)<DISMISS_MS) return { eligible:false, reason:'dismissed_recently' }
    if(e2e.mode==='eligible') return { eligible:true, mode:'prompt' }
    if(e2e.mode==='manual_instructions') return { eligible:true, mode:'manual' }
    return { eligible:false, reason:'e2e_disabled' }
  }
  if(isStandalone() || st.install_prompt_status==='installed') return { eligible:false, reason:'installed' }
  if(!isMobileLike()) return { eligible:false, reason:'not_mobile' }
  if(st.install_prompt_dismissed_at && Date.now()-Date.parse(st.install_prompt_dismissed_at)<DISMISS_MS) return { eligible:false, reason:'dismissed_recently' }
  if(deferredPrompt) return { eligible:true, mode:'prompt' }
  if(allowManualFallback) return { eligible:true, mode:'manual' }
  return { eligible:false, reason:'no_prompt_event' }
}
export async function requestInstall(){
  const e2e=getE2EPwaState()
  if(e2e){
    // Simulate the native prompt deterministically and exercise the real persist
    // logic. Track call count so a test can assert the prompt fires exactly once.
    window.__LINGO_E2E__.pwaInstall._promptCalls=(window.__LINGO_E2E__.pwaInstall._promptCalls||0)+1
    const outcome=e2e.promptOutcome||'accepted'
    saveInstallState({ install_prompt_status: outcome==='accepted'?'installed':'dismissed', install_prompt_dismissed_at: outcome==='accepted'?null:nowIso() })
    return { ok: outcome==='accepted', outcome }
  }
  if(!deferredPrompt) return { ok:false, code:'PWA_PROMPT_UNAVAILABLE' }
  const ev=deferredPrompt; deferredPrompt=null; await ev.prompt(); const choice=await ev.userChoice.catch(()=>({outcome:'dismissed'}))
  saveInstallState({ install_prompt_status: choice.outcome==='accepted'?'installed':'dismissed', install_prompt_dismissed_at: choice.outcome==='accepted'?null:nowIso() })
  return { ok: choice.outcome==='accepted', outcome: choice.outcome }
}
export function dismissInstallPrompt(){ saveInstallState({ install_prompt_status:'dismissed', install_prompt_dismissed_at: nowIso() }) }
export function markStandaloneLaunch(){ if(!isStandalone()) return false; const st=JSON.parse(localStorage.getItem(FABIOLA_STORAGE_KEY)||'{}'); if(!st.first_standalone_launch_completed){ localStorage.setItem(FABIOLA_STORAGE_KEY, JSON.stringify({...st, first_standalone_launch_completed:true})) ; return true } return false }
export function loadFabiolaState(){ try { return JSON.parse(localStorage.getItem(FABIOLA_STORAGE_KEY)||'{}') } catch { return {} } }
export function saveFabiolaState(patch){ const next={...loadFabiolaState(),...patch}; localStorage.setItem(FABIOLA_STORAGE_KEY, JSON.stringify(next)); return next }
