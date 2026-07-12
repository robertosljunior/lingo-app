export const INSTALL_STORAGE_KEY = 'pwa_install_state'
export const FABIOLA_STORAGE_KEY = 'pwa_fabiola_state'
export const FABIOLA_VOICE_ID = 'pt_BR-fabiola-medium'
const DISMISS_MS = 7 * 86400000
let deferredPrompt = null
function nowIso(){ return new Date().toISOString() }
export function loadInstallState(){ try { return JSON.parse(localStorage.getItem(INSTALL_STORAGE_KEY) || '{}') } catch { return {} } }
export function saveInstallState(patch){ const next={...loadInstallState(),...patch}; localStorage.setItem(INSTALL_STORAGE_KEY, JSON.stringify(next)); return next }
export function isStandalone(){ return !!(window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone) }
export function isMobileLike(){ return matchMedia?.('(max-width: 768px)')?.matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) }
export function initPwaInstallController(){
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (event)=>{ event.preventDefault(); deferredPrompt=event; saveInstallState({ install_prompt_status:'eligible', install_prompt_seen_at: nowIso(), has_programmatic_prompt:true }) })
  window.addEventListener('appinstalled', ()=>{ deferredPrompt=null; saveInstallState({ install_prompt_status:'installed', installed_at: nowIso() }); markStandaloneLaunch() })
}
export function getInstallEligibility({ allowManualFallback=false }={}){
  const st=loadInstallState(); if(isStandalone() || st.install_prompt_status==='installed') return { eligible:false, reason:'installed' }
  if(!isMobileLike()) return { eligible:false, reason:'not_mobile' }
  if(st.install_prompt_dismissed_at && Date.now()-Date.parse(st.install_prompt_dismissed_at)<DISMISS_MS) return { eligible:false, reason:'dismissed_recently' }
  if(deferredPrompt) return { eligible:true, mode:'prompt' }
  if(allowManualFallback) return { eligible:true, mode:'manual' }
  return { eligible:false, reason:'no_prompt_event' }
}
export async function requestInstall(){
  if(!deferredPrompt) return { ok:false, code:'PWA_PROMPT_UNAVAILABLE' }
  const ev=deferredPrompt; deferredPrompt=null; await ev.prompt(); const choice=await ev.userChoice.catch(()=>({outcome:'dismissed'}))
  saveInstallState({ install_prompt_status: choice.outcome==='accepted'?'installed':'dismissed', install_prompt_dismissed_at: choice.outcome==='accepted'?null:nowIso() })
  return { ok: choice.outcome==='accepted', outcome: choice.outcome }
}
export function dismissInstallPrompt(){ saveInstallState({ install_prompt_status:'dismissed', install_prompt_dismissed_at: nowIso() }) }
export function markStandaloneLaunch(){ if(!isStandalone()) return false; const st=JSON.parse(localStorage.getItem(FABIOLA_STORAGE_KEY)||'{}'); if(!st.first_standalone_launch_completed){ localStorage.setItem(FABIOLA_STORAGE_KEY, JSON.stringify({...st, first_standalone_launch_completed:true})) ; return true } return false }
export function loadFabiolaState(){ try { return JSON.parse(localStorage.getItem(FABIOLA_STORAGE_KEY)||'{}') } catch { return {} } }
export function saveFabiolaState(patch){ const next={...loadFabiolaState(),...patch}; localStorage.setItem(FABIOLA_STORAGE_KEY, JSON.stringify(next)); return next }
