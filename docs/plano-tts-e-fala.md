# Plano: TTS com voz natural, fala→texto e sugestões adaptativas (Android)

Análise e planejamento para evoluir o App Idiomas com áudio de qualidade
(vários sotaques de inglês), reconhecimento de fala e exercícios sugeridos a
partir das dificuldades reais de cada pessoa da família. Plataforma-alvo:
**somente Android**, uso familiar, **offline-first**, sem distribuição.

---

## 1. Onde estamos hoje

A aplicação é um **PWA React + Vite** (não é um app Android nativo — roda no
Chrome do Android, instalável pela tela inicial):

| Área | Estado atual |
|---|---|
| TTS | `src/lib/speech.js` — wrapper mínimo da Web Speech API (`speechSynthesis`), voz padrão do sistema, `rate 0.95`, sem escolha de voz/sotaque |
| Uso do TTS | Ditado (`listen_type`) em `Exercise.jsx` e botão "Ouvir" em `Review.jsx` — os demais tipos de exercício não têm áudio |
| Fala→texto (STT) | Inexistente |
| NLP | Compromise em Web Worker (`nlp-worker.js`), contrato já preparado para trocar/adicionar engine (wink-nlp citado no README) |
| Banco offline | Já existe: IndexedDB via `idb` (`storage.js`) com stores `lessons`, `questions`, `answers`, `mistakes`, `settings` |
| Dificuldades | Já há rollup de erros por `mistake_type` na store `mistakes` — base pronta para sugestões adaptativas |

Conclusão importante: **não é preciso trocar de tecnologia**. Tudo que foi
pedido (TTS natural com sotaques, STT, NLP melhor, sugestões por dificuldade,
banco offline) é viável dentro do PWA atual. Um empacotamento nativo
(Capacitor/TWA) fica como opção de fase final apenas se o microfone/vozes do
navegador decepcionarem na prática.

---

## 2. Panorama: TTS e fala→texto disponíveis no Android

### 2.1 TTS (texto → voz)

| Opção | Como roda | Sotaques de inglês | Offline | Peso | Qualidade |
|---|---|---|---|---|---|
| **Web Speech API** (`speechSynthesis`) — já usamos | Engine de TTS do próprio Android ("Speech Services by Google") exposta ao Chrome | `en-US`, `en-GB`, `en-AU`, `en-IN`, `en-NG`… conforme vozes instaladas no aparelho | Sim, se o pacote de voz for baixado nas configurações do Android | 0 MB no app | Boa (vozes neurais do Google no Android moderno), varia por aparelho |
| **Piper TTS** via WASM (`piper-tts-web` / `vits-web`, modelos `rhasspy/piper-voices`) | ONNX na CPU do navegador, 100% dentro do app | Muitas vozes `en_US` (lessac, amy, ryan…) e `en_GB` (alba, alan, cori, jenny…) | Sim, total (modelo cacheado) | ~20–75 MB por voz (download único) | Muito boa, 3–5× tempo real em CPU modesta — roda bem em celular |
| **Kokoro** (`kokoro-js`, 82M params, StyleTTS2) | ONNX via WASM ou WebGPU | 21 vozes premium americanas e britânicas | Sim, total | ~90–300 MB conforme quantização | Excelente ("parece gente"), mas pesado para celulares fracos |
| **sherpa-onnx WASM** | Runtime alternativo p/ Piper/Kokoro | idem | Sim | idem | Alternativa se as libs acima travarem |
| **TextToSpeech nativo** (só com wrapper Capacitor/TWA) | API `android.speech.tts` | Todos os sotaques do engine Google | Sim | 0 MB | Igual à Web Speech API, porém com controle total |

### 2.2 Fala → texto (STT)

| Opção | Como roda | Offline | Peso | Observações |
|---|---|---|---|---|
| **Web Speech API** (`SpeechRecognition`) | Chrome Android envia áudio ao servidor Google (reconhecimento on-device está chegando via `processLocally`, pacotes ~60 MB) | Historicamente não; on-device em rollout | 0 MB | Grátis, ótima acurácia, streaming com resultados parciais; há bugs conhecidos de microfone cortando no Android — precisa de retry/UX defensiva |
| **Moonshine** (`@huggingface/transformers`, `onnx-community/moonshine-tiny/base`) | ONNX no navegador, feito para on-device em inglês | Sim, total | tiny ~30 MB / base ~130 MB | Projetado para streaming em CPU de dispositivo — candidato ideal de fallback offline |
| **Vosk** (`vosk-browser`) | Kaldi em WASM, streaming em tempo real | Sim, total | modelo `en` small ~40 MB | Maduro, leve, acurácia menor que Whisper/Moonshine mas suficiente p/ conferir frases curtas |
| **Whisper** (`whisper-web` / transformers.js) | ONNX WASM/WebGPU | Sim | tiny/base quantizado ~40–80 MB | Melhor acurácia offline, porém latência maior em celular (não é streaming de verdade) |
| **SpeechRecognizer nativo** (só com Capacitor) | Reconhecimento on-device do Android (o mesmo do Gboard) | Sim | 0 MB | Melhor experiência de mic no Android; exige empacotar o app |

### 2.3 NLP para correção e diagnóstico

- **Compromise** (já embarcado): POS, tempos verbais — mantém.
- **wink-nlp** (~3 MB com modelo `wink-eng-lite-web-model`): tokenização, POS,
  lematização e sentenças mais precisos que Compromise; o contrato do worker já
  foi desenhado para recebê-lo. Ganho direto: classificação de `mistake_type`
  mais confiável (verb_tense, question_structure, plural, artigos).
- A "sugestão baseada em dificuldade" **não precisa de modelo grande**: os
  dados já existem nas stores `answers` + `mistakes`; falta a camada de
  agendamento/seleção (ver Fase 4).

---

## 3. Recomendação de arquitetura

Manter o PWA e criar uma camada de abstração de áudio com fallback em cascata:

```
src/lib/audio/
  tts.js            # API única: speak(text, {accent, rate}), stop(), voices()
  tts-system.js     # engine 1: Web Speech API (hoje: speech.js)
  tts-piper.js      # engine 2: Piper WASM em Web Worker (opt-in, download por voz)
  stt.js            # API única: listen({lang, onPartial}) -> transcript
  stt-web.js        # engine 1: SpeechRecognition (Chrome, online)
  stt-local.js      # engine 2: Moonshine ou Vosk em Web Worker (offline)
  audio-cache.js    # frases sintetizadas pelo Piper cacheadas (Cache API/IndexedDB)
```

- O usuário escolhe em **Configurações**: sotaque (🇺🇸 🇬🇧 🇦🇺 🇮🇳…), voz,
  velocidade e engine ("Sistema" grátis vs. "Voz neural offline" com download).
- Piper roda em Web Worker (mesmo padrão do `nlp-worker.js`) e o áudio gerado
  é cacheado por `hash(texto+voz)` — a frase só é sintetizada uma vez.
- Modelos (Piper/Moonshine) são baixados sob demanda e cacheados pelo service
  worker (Workbox já está no projeto) — depois disso, 100% offline.

---

## 4. Fases de implementação

### Fase 1 — TTS pleno com o que já existe (esforço: baixo)
1. Evoluir `speech.js`: enumerar vozes (`getVoices()` + evento
   `voiceschanged`), permitir escolher **sotaque e voz**, velocidade normal e
   **modo tartaruga** (à la Duolingo, `rate ~0.6`).
2. Persistir `tts_accent`, `tts_voice`, `tts_rate` na store `settings`.
3. Botão de ouvir em **todos** os tipos de exercício com resposta em inglês
   (hoje só ditado e revisão) + tocar a resposta correta automaticamente após
   corrigir (configurável).
4. Ouvir **palavra por palavra** ao tocar em um token no diff de resposta.
5. Tela de Configurações: seção "Áudio" com teste de voz e instrução para
   baixar vozes offline do Google TTS no Android.

### Fase 2 — Voz neural offline com sotaques (esforço: médio)
1. Integrar **Piper** (`piper-tts-web`) em Web Worker com 2 vozes iniciais:
   uma `en_US` e uma `en_GB` (expansível: `en_AU`/`en_IN` não existem no Piper,
   mas há dezenas de vozes US/GB; sotaques extras podem vir da engine do
   sistema).
2. UI de download/gerenciamento de vozes em Configurações (tamanho, excluir).
3. `audio-cache.js` + pré-síntese das frases da aula ao importá-la (aula fica
   "ouvível" instantaneamente e offline).
4. Fallback automático: Piper indisponível → Web Speech API.
5. (Opcional, se os aparelhos da família tiverem WebGPU) avaliar **Kokoro**
   como voz "premium" — qualidade excepcional, download maior.

### Fase 3 — Fala→texto e exercícios de pronúncia (esforço: médio/alto)
1. Novo tipo de exercício **`speak_sentence`**: o app mostra/fala a frase e o
   aluno **fala em inglês**; e modo "responda falando" para `answer_question`.
2. `stt-web.js` com `SpeechRecognition` (`lang: en-US`, resultados parciais na
   tela, retry no bug de mic do Android).
3. `stt-local.js` com **Moonshine tiny** (1ª escolha) ou **Vosk small** como
   caminho offline, rodando em Web Worker.
4. **Score de pronúncia aproximado**: comparar a transcrição com
   `expected_answer` reutilizando o `correction-engine.js` (alinhamento
   palavra a palavra → destacar palavras não reconhecidas). Não é análise
   fonética real, mas é exatamente o nível de feedback do Duolingo.
5. Gravar em `answers`: `spoken_transcript` e `pronunciation_score`, que
   alimentam o rollup de dificuldades.

### Fase 4 — NLP melhor + sugestões pelas dificuldades (esforço: médio)
1. Adicionar **wink-nlp** atrás do contrato existente do worker
   (`nlp_library` já existe em settings) e refinar `mistake_type`.
2. **Perfil de dificuldade por pessoa**: como o app é familiar, criar store
   `profiles` (ou campo `profile_id` em `answers`) para separar os dados de
   cada membro da família.
3. **Revisão espaçada (SRS)**: store `srs { question_key, profile_id, box,
   due_at }` com caixas de Leitner — errou volta pra caixa 1, acertou avança.
   Nova entrada na Home: "Revisão do dia" com as questões vencidas.
4. **Gerador local de treino dirigido**: sessão montada a partir dos maiores
   `mistake_type` (reaplicar questões erradas, variar exercício da mesma frase:
   traduzir → montar → ditado → falar).
5. O `export-engine.js` já gera prompt para o ChatGPT criar aulas novas —
   enriquecer o prompt com o perfil de dificuldade e o histórico de pronúncia.

### Fase 5 (condicional) — Empacotamento nativo
Somente se, no uso real, o microfone do Chrome ou as vozes do sistema forem
insatisfatórios: embrulhar o mesmo código com **Capacitor** (ou TWA via
Bubblewrap) para usar `TextToSpeech` e `SpeechRecognizer` nativos (offline,
todos os sotaques do engine Google, mic estável). Zero reescrita de UI.

---

## 5. Mudanças no banco offline (IndexedDB, `DB_VERSION: 2`)

| Alteração | Para quê |
|---|---|
| `settings`: `tts_engine`, `tts_accent`, `tts_voice`, `tts_rate`, `stt_engine`, `active_profile` | Preferências de áudio e perfil ativo |
| Nova store `profiles { profile_id*, name }` | Vários membros da família no mesmo aparelho |
| Nova store `srs { key* (profile:lesson:question), box, due_at, last_result }` | Revisão espaçada |
| `answers`: + `profile_id`, `spoken_transcript`, `pronunciation_score` | Dados de fala e por pessoa |
| Cache API (`audio-v1`, `models-v1`) | Áudios Piper sintetizados e modelos ONNX |

Migração no `upgrade()` do `idb`; respostas antigas recebem `profile_id`
padrão.

---

## 6. Riscos e mitigação

- **`SpeechRecognition` exige internet** (hoje) e tem bug de mic no Android →
  sempre oferecer o caminho offline (Moonshine/Vosk) e UX de re-tentativa.
- **Peso dos modelos** (20–130 MB) → download opt-in por voz/modelo, com
  gerenciador em Configurações; o app continua funcionando 100% sem eles.
- **Aparelhos fracos** → Piper é CPU-only e leve; Kokoro/Whisper só como
  opt-in; medir no celular mais fraco da família antes de promover a padrão.
- **iOS não é alvo** (Safari bloqueia SpeechRecognition em PWA) — ok, escopo é
  só Android.
- **Autoplay de áudio** exige gesto do usuário no primeiro toque da sessão →
  destravar o áudio no botão "Começar".

## 7. Ordem sugerida de entrega

1. **Fase 1** entrega valor imediato com custo quase zero (só front-end).
2. **Fase 4.2/4.3** (perfis + SRS) pode andar em paralelo, pois não depende de
   áudio e multiplica o valor pedagógico.
3. **Fase 2** (Piper) → **Fase 3** (fala) → **Fase 4.1/4.4** (wink-nlp +
   treino dirigido) → **Fase 5** só se necessário.
