# SLICE 7.1A — Full E2E Closure & Regression Repair — Checklist

Branch: `claude/local-semantic-tutor-rcd80y` · base `main` (PR #18 já mergeado; commit follow-up 43d5684).
Regra: USE weights fora de escopo. Bypass global do PwaInstallController em E2E deve ser REMOVIDO e substituído por hook determinístico `window.__LINGO_E2E__`.

Status legend: pending / in_progress / completed / blocked / failed

| ID | Descrição | Status |
|----|-----------|--------|
| T01 | Preflight e baseline | completed |
| T02 | Reproduzir `generated-lesson-exercises` | completed |
| T03 | Corrigir `generated-lesson-exercises` | completed |
| T04 | Reproduzir `generated-lesson-skill` | completed |
| T05 | Corrigir `generated-lesson-skill` | completed |
| T06 | Investigar testes flaky do prompt PWA | completed |
| T07 | Estabilizar testes do prompt PWA (hook determinístico, sem bypass global) | completed |
| T08 | Validar integração semantic-free-feedback | completed |
| T09 | Validar UI real de knowledge packs (download real) | completed |
| T10 | Executar unitários e benchmarks | completed |
| T11 | Executar Playwright completo repetidamente | completed |
| T12 | Executar build e validadores | completed |
| T13 | Revisar regressões e diff | completed |
| T14 | Commit e relatório final | in_progress |

---

## T01 — Preflight e baseline
- Status: in_progress
- Arquivos: —
- Causa: —
- Validação: git state + baseline commands
- Evidência: (abaixo, preenchendo)
- Commit: —

### git
- branch: claude/local-semantic-tutor-rcd80y
- HEAD: 43d5684 (fix: stop generated lessons regressing… ; sobre 40005ee merge do #18)

### Baseline (não-E2E) — todos verdes
- npm test: 126/126
- build: ok (7.6s)
- validate:content-packs: ok
- validate:knowledge-packs: ok (goldens passam)
- benchmark:structural-nlp: 501 casos, wink primário (lat 0.051 vs comp 0.697)
- benchmark:semantic: 14 pares, margem -0.066 (hashing NÃO discrimina significado — documentado como fallback, por isso o pipeline não confia só em similaridade)
- quality:content-packs: ok
- benchmark:indexeddb: 0 cross_profile_leaks

## T02/T03 — generated-lesson-exercises
- Status: completed (corrigido no commit 43d5684 — round anterior)
- Causa REAL (não apenas selector): o gerador determinístico carimba `translate_natural`/`rewrite_natural` como `assessment_mode:'equivalent'` e `speak_sentence` como `'guided'`. O gate do 7.1 roteava essas questões geradas para o pipeline semântico, onde a checagem `equivalent` marcava a resposta exata como "significado diferente" (o token `I've` era dividido pelo tokenizer, fazendo a palavra essencial `i've` parecer ausente).
- Classificação: (1) regressão real do produto + (6) mudança de contrato de assessment. NÃO foi apenas selector obsoleto.
- Correção de produto: `LEGACY_ENGINE_TYPES` mantém tipos gerados no motor legado; `essentialWords` descarta contrações; `fuseVerdict` equivalent com short-circuit exato/paráfrase e casamento por superfície normalizada.
- O `question-type` testid foi restaurado PORQUE é útil e semanticamente correto (o helper compartilhado `answerCurrentQuestion` precisa do tipo interno da questão, que não é texto acessível de usuário) — e o fluxo real foi corrigido, não só o selector.
- Arquivos: src/lib/language-analysis/exercise-bridge.js, language-analysis-orchestrator.js, src/screens/Exercise.jsx
- Validação: exercita os 7 tipos pela UI (nenhuma chamada interna direta). speak_sentence usa fallback manual (helper `answerCurrentQuestion` clica o mic e cai para digitar).

## T04/T05 — generated-lesson-skill
- Status: completed (mesma causa raiz do T03; skills exatas/guided voltam a atualizar)

## T06 — Investigação flaky PWA
- Status: completed
- Causa: o card de instalação (`position:fixed; bottom; zIndex:50`) aparece após 1.2s e sobrepõe a barra de ação da lição, interceptando cliques em `Responder`. Elegibilidade dependia de `matchMedia`/`beforeinstallprompt`/tempo — não determinística.

## T07 — Estabilização PWA (SEM bypass global)
- Status: in_progress → validando 20x
- Bypass global anterior (`if e2e return null`) REMOVIDO.
- Hook determinístico `window.__LINGO_E2E__.pwaInstall` (`disabled|eligible|standalone|manual_instructions`, `promptOutcome`). Lido dentro de `getInstallEligibility`/`isStandalone`/`requestInstall`; ausente em produção → comportamento real (`beforeinstallprompt`/`appinstalled`/`matchMedia`). O controller SEMPRE roda sua lógica real; só os inputs são controlados.
- main.jsx faz merge de defaults (pwaInstall→'disabled') sem clobber; specs de PWA fazem opt-in.
- Arquivos: src/lib/pwa-install-controller.js, src/components/PwaInstallController.jsx, src/main.jsx, e2e/helpers.js, e2e/pwa-install.spec.js
- Validação: pwa-install.spec.js **160 passed (8×20), 0 flaky, 0 retries**. Casos: eligible/disabled/standalone/manual/dismissed/accepted(1 chamada)/reload-não-duplica/não-intercepta-lição.

## T08 — semantic-free-feedback
- Status: completed
- Validação: 5/5 e depois 12/12 (6× × 4 workers) após correção de robustez.
- Correção de robustez (produto): `handleSubmit` agora tem try/finally (limpa `analyzing`) e o caminho semântico tem try/catch → `buildSemanticFallbackAnalysis` (degrade conservador "válido", nunca mostra model answer). Sob paralelismo (4 workers compilando o WASM do Harper), uma falha de carga não trava mais a tela.
- Arquivo: src/screens/Exercise.jsx

## T09 — UI real de knowledge packs (download real)
- Status: completed
- Implementado download real na UI (não só serviço): botão "Verificar catálogo", listagem do catálogo com estados (Disponível/Instalado/Atualização/Incompatível/Baixando/Verificando/Instalando/Falha), botão Baixar/Atualizar, progresso via `onProgress`, Tentar novamente em falha, Remover.
- Arquivos: src/screens/Settings.jsx, src/lib/language-analysis/knowledge-catalog-service.js
- E2E (servidor controlado via context.route sobre URLs allowlisted): `knowledge-pack-download.spec.js`
  1. fluxo completo: catálogo → Baixar → checksum SHA-256 → install transacional → reload persistido → leitura offline via IndexedDB → Remover (histórico preservado) — PASS
  2. checksum mismatch → estado "Falha" + "Tentar novamente", nada instalado — PASS

## T10 — Unitários e benchmarks
- Status: completed
- npm test: 126/126
- benchmark:structural-nlp: 501 casos, wink primário, Compromise só fallback
- benchmark:semantic: hashing identificado como fallback (caveat "Advisory only; free never fails on low similarity"); nunca afirma ser USE

## T12 — Build e validadores
- Status: completed
- build ok · validate:content-packs (28 packs) · validate:knowledge-packs (goldens) · quality:content-packs · benchmark:indexeddb (0 leaks)

## T11 — Playwright completo repetidamente
- Status: completed
- npx playwright test --retries=0: **27 passed, 0 failed, 0 flaky, 0 skipped** (chromium-desktop 26 + chromium-mobile 1)
- npx playwright test --repeat-each=3 --retries=0: **81 passed, 0 failed, 0 flaky, 0 retries**
- Nenhum test.skip/test.fixme/test.only novo.

## T13 — Revisão de regressões
- Status: completed
- git diff --check: limpo
- Cobertura verde: lições geradas (exercises/skill/home/ids/offline/export-import/profile-isolation/double-click), free/guided/equivalent/exact (exercises exercita os 7 tipos + semantic-free), Result, offline, PWA install (8 casos), Settings/knowledge packs (download real), indexeddb (upgrade v2→v4, persistência).
- Nenhuma mudança de provisionamento de pesos USE; fallback hashing permanece explicitamente identificado.

## Classificação final
**PASS_SLICE_7_1A_FULL_E2E_CLOSURE**
- generated-lesson-exercises 5/5 ✓ · generated-lesson-skill 5/5 ✓ · PWA 20×(=160) sem flaky ✓ · semantic-free 5/5 (e 12/12 stress) ✓ · UI download real funciona ✓ · suíte completa ✓ · repeat-each=3 ✓ · sem skips ✓ · unit 126 ✓ · build ✓ · validadores ✓ · benchmarks ✓ · sem regressão free/guided ✓ · sem LLM ✓ · sem inferência remota ✓
- Bypass global do PwaInstallController REMOVIDO e substituído por hook determinístico; controller roda a lógica real em todos os ambientes.

