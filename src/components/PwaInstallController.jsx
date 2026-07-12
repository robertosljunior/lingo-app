import { useEffect, useState } from 'react'
import { dismissInstallPrompt, getInstallEligibility, initPwaInstallController, isStandalone, loadFabiolaState, markStandaloneLaunch, requestInstall, saveFabiolaState, FABIOLA_VOICE_ID } from '../lib/pwa-install-controller.js'

export default function PwaInstallController(){
  const [eligible,setEligible]=useState(null)
  const [voice,setVoice]=useState(()=>loadFabiolaState())
  useEffect(()=>{ initPwaInstallController(); const t=setTimeout(()=>setEligible(getInstallEligibility({allowManualFallback:true})),1200); return()=>clearTimeout(t)},[])
  useEffect(()=>{ if(markStandaloneLaunch() || isStandalone()){ startFabiolaDownload(setVoice) } },[])
  if(voice.fabiola_status && voice.fabiola_status!=='ready') return <VoiceBanner state={voice} onRetry={()=>startFabiolaDownload(setVoice,true)} />
  if(!eligible?.eligible) return null
  return <div className="card" role="dialog" aria-label="Instalar o aplicativo" style={{position:'fixed',left:16,right:16,bottom:16,zIndex:50,padding:16,boxShadow:'var(--shadow-lg)'}}>
    <div style={{fontWeight:800,fontSize:16}}>Instalar o aplicativo</div>
    <p className="muted" style={{fontSize:13,lineHeight:1.45,margin:'6px 0 12px'}}>Use as lições e vozes offline mesmo sem internet.</p>
    {eligible.mode==='manual' && <p style={{fontSize:13}}>Para instalar, abra o menu do navegador e escolha “Adicionar à Tela de Início”.</p>}
    <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}><button className="btn btn-secondary" onClick={()=>{dismissInstallPrompt();setEligible(null)}}>Agora não</button>{eligible.mode==='prompt'&&<button className="btn btn-primary" onClick={async()=>{await requestInstall();setEligible(null)}}>Instalar</button>}</div>
  </div>
}
function VoiceBanner({state,onRetry}){ const label={waiting:'Aguardando internet',downloading:'Baixando',validating:'Validando',failed:'Falha — tentar novamente'}[state.fabiola_status]||'Baixando'; return <div className="card" style={{position:'fixed',left:16,right:16,bottom:16,zIndex:45,padding:14}}><div style={{fontWeight:800}}>Preparando a voz em português</div><div className="muted" style={{fontSize:12}}>A explicação falada ficará disponível offline.</div><div style={{fontSize:13,marginTop:6}}>{label}{state.fabiola_progress!=null?` · ${state.fabiola_progress}%`:''}</div>{state.fabiola_status==='failed'&&<button className="btn btn-sm btn-secondary" onClick={onRetry}>Tentar novamente</button>}</div> }
async function startFabiolaDownload(setVoice,force=false){
  const cur=loadFabiolaState(); if(!force && (cur.fabiola_status==='ready'||cur.fabiola_auto_download_started)) return
  if(navigator.onLine===false){ setVoice(saveFabiolaState({fabiola_status:'waiting'})); return }
  setVoice(saveFabiolaState({fabiola_auto_download_started:true,fabiola_status:'downloading',fabiola_progress:0,fabiola_model_version:'1'}))
  import('../lib/audio/tts-piper.js').then(async p=>{ const have=await p.storedVoices(); if(have.includes(FABIOLA_VOICE_ID)){ setVoice(saveFabiolaState({fabiola_status:'ready',fabiola_progress:100})); return } await p.downloadVoice(FABIOLA_VOICE_ID,(pct)=>setVoice(saveFabiolaState({fabiola_status:'downloading',fabiola_progress:pct}))); setVoice(saveFabiolaState({fabiola_status:'ready',fabiola_progress:100})) }).catch(()=>setVoice(saveFabiolaState({fabiola_status:'failed'})))
}
