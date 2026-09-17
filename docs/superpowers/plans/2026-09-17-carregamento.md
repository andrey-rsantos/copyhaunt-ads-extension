# Carregamento inicial e repintura incremental — Implementation Plan

## Progresso

- **Estado:** concluído
- **Última tarefa concluída:** Task 4
- **Próxima tarefa:** —
- **Notas de retomada:** todas de 2026-09-17, no branch `carregamento` (worktree `.worktrees/carregamento`, base `b20f1b7`).
  - **Task 1:** `npx.cmd vitest run tests/content/arranque.test.ts` → 3/3; `npm.cmd test -- --run tests/content` → 14 arquivos, 102 testes; `npm.cmd test` → 56 arquivos, 512 testes; `npm.cmd run typecheck` limpo.
  - **Task 2:** `npx.cmd vitest run tests/content/agendamento.test.ts` → 2/2; `npm.cmd test` → 57 arquivos, 514 testes; typecheck limpo; `observer.ts` não precisou mudar.
  - **Task 3:** RED provado com `src/content/index.ts` de `main` (host nunca anexado, timeout 10 s); GREEN `npx.cmd playwright test e2e/carregamento.spec.ts e2e/ssr.spec.ts` → 2/2 em duas rodadas. Métricas reais (ms desde o início da navegação): DOMContentLoaded 2740 / 2792; primeiro host anexado 1447 / 1588 (antes do DCL); primeira bandeja observável 4846 / 4799; 26 bandejas na primeira tela; lote do HTML 30. Desvios do plano: o fixture do E2E usa `input[type="search"]` + `[role="combobox"]` (o HTML do plano não ancoraria em `acharLinhaDaBusca`); os marcos são medidos por MutationObserver injetado via `addInitScript` (instante real, não intervalo de sondagem).
  - **Task 4 (Steps 1 e 2):** `npm.cmd test` → 57 arquivos, 514 testes (uma reexecução sob carga teve 2 timeouts de 5 s em `tests/content/index.test.ts`, não reproduzidos na terceira rodada — flakiness já documentada no próprio teste); typecheck limpo; `npm.cmd run verify:build` → "manifest gerado OK: world MAIN preservado, permissões mínimas"; `npm.cmd run e2e` → 16/17 (`acoes.spec.ts` passou; `e2e/pipeline.spec.ts` falhou por receber 1 indexação da Meta ao vivo e passou isolado em seguida com 40 → 49 → 58 — instabilidade de rede de um teste com esperas fixas pré-existentes; o caminho de indexação não foi tocado). `git diff --check` limpo; sem permissão, rede, Instagram ou espera fixa nova no diff.
  - **Revisão final do branch:** sem defeito de código. Onda de correção (`0e871c7`): testes de reentrância do agendador e de `parar()` antes do body; `ssr.spec.ts` ignora iframes e imprime `replantios do host` (medido: 1 — a Meta não removeu o host ao hidratar a barra nessa rodada); `try/finally` no E2E determinístico. Após a onda: `npm.cmd test` → 57 arquivos, 516 testes; typecheck limpo; os dois specs E2E → 2/2.
  - **Task 4, Step 3 (validação na Biblioteca real, via roteiro Playwright descartável com a extensão carregada, PR #2):** host anexado com `readyState = loading` a 1316–1959 ms contra DOMContentLoaded a 2682–4283 ms (três rodadas); 1 inserção e 0 remoções do host até a página estabilizar (a Meta não o removeu ao hidratar a barra); posição do host idêntica ao anexar e no DCL (top 73 px, sem flicker); 26 bandejas na primeira tela; mineração com 2 lotes (indexações 40 → 49) atualizando estado, barra (89% → 100%), contadores e overlay (36 → 45 bandejas), encerrada em `concluido` com 45 aprovados; página de resultados com os 45 (SSR e lotes posteriores); 0 erros de hidratação e 0 erros/avisos ligados à extensão (só 403 e Permissions-Policy da própria Meta). O DevTools Performance não foi aberto: os marcos vieram de `performance.now()` no documento.
  - **Observações que ficam:** Comportamento novo não documentado no commit `5d5a690`: em aba em segundo plano o `requestAnimationFrame` não dispara, então a repintura espera a aba voltar (a mineração não depende da pintura). O log `pintados: N` conta cards conhecidos, não bandejas novas — pré-existente, agora aparece uma vez a mais por ciclo.

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Reduzir o tempo até a primeira interface visível da CopyHaunt e evitar repinturas completas redundantes durante capturas sucessivas, sem perder o lote SSR nem alterar o desenho passivo da coleta.

**Architecture:** Separar o bootstrap da interface do processamento SSR. A interface começará quando document.body existir; o lote inicial continuará sendo processado no DOMContentLoaded. Todas as solicitações de pintura passarão por um agendador compartilhado que consolida chamadas no próximo frame.

**Tech Stack:** TypeScript, Vitest, Playwright, Chrome MV3, MutationObserver, requestAnimationFrame.

**Spec:** docs/superpowers/specs/2026-09-17-carregamento-design.md

## Global Constraints

- Toda comunicação, documentação e mensagem de commit deverá permanecer em pt-BR; identificadores de código permanecerão em inglês.
- Seguir teste antes da implementação. Cada tarefa só será marcada como concluída depois da verificação correspondente.
- No PowerShell, usar npm.cmd e npx.cmd.
- Nunca executar npm.cmd run gravar:fixtures.
- Não usar espera fixa em testes; usar vi.waitFor, auto-waiting do Playwright ou um scheduler controlado pelo teste.
- Não adicionar permissões ao manifest.json, requisições de rede ou filtro de Instagram na mineração.
- Preservar a captura passiva, o processamento SSR, a configuração dinâmica, a compatibilidade MV3 e os fluxos já validados de pausa, parada, resultados e nova mineração.
- Atualizar o bloco Progresso e marcar cada checkbox somente depois da saída de verificação ser conferida.

## Estado inicial e mapa de arquivos

O estado inicial esperado antes da implementação é:

- src/content/index.ts aguarda DOMContentLoaded para chamar plantarEnxertos,
  lerLoteInicial, garantirObservador e repintar.
- src/content/anchor.ts contém a varredura completa de cards; ela não será
  reescrita nesta etapa porque o diagnóstico mediu aproximadamente 11 ms em
  uma página real.
- src/content/observer.ts observa mutações da grade e chama o callback de
  repintura.
- tests/content/ contém os testes unitários dos módulos de conteúdo.
- e2e/ssr.spec.ts valida a Biblioteca real e poderá receber apenas métricas
  observacionais.

---

## Task 1: iniciar a interface assim que o body existir

Arquivos:

- Criar src/content/arranque.ts.
- Criar tests/content/arranque.test.ts.
- Alterar src/content/index.ts.

- [x] **Step 1: escrever os testes que falham**

Criar tests/content/arranque.test.ts com os contratos:

~~~ts
import { describe, expect, it, vi } from 'vitest'
import { iniciarQuandoHouverBody } from '../../src/content/arranque'

describe('iniciarQuandoHouverBody', () => {
  it('inicia imediatamente quando o body já existe', () => {
    const iniciar = vi.fn()

    const controle = iniciarQuandoHouverBody(document, iniciar)

    expect(iniciar).toHaveBeenCalledOnce()
    controle.parar()
  })

  it('inicia quando o body surge sem esperar DOMContentLoaded', async () => {
    const doc = document.implementation.createHTMLDocument('teste')
    const body = doc.body
    doc.documentElement.removeChild(body)
    const iniciar = vi.fn()

    const controle = iniciarQuandoHouverBody(doc, iniciar)
    const novoBody = doc.createElement('body')
    doc.documentElement.appendChild(novoBody)

    await vi.waitFor(() => expect(iniciar).toHaveBeenCalledOnce())

    controle.parar()
  })

  it('não inicia duas vezes e permite encerrar a observação', async () => {
    const doc = document.implementation.createHTMLDocument('teste')
    const body = doc.body
    doc.documentElement.removeChild(body)
    const iniciar = vi.fn()
    const controle = iniciarQuandoHouverBody(doc, iniciar)

    doc.documentElement.appendChild(doc.createElement('body'))
    await vi.waitFor(() => expect(iniciar).toHaveBeenCalledOnce())
    doc.documentElement.appendChild(doc.createElement('body'))

    await Promise.resolve()
    expect(iniciar).toHaveBeenCalledOnce()
    controle.parar()
  })
})
~~~

O helper deverá expor esta interface:

~~~ts
export interface ControleArranque {
  parar(): void
}

export function iniciarQuandoHouverBody(
  doc: Document,
  iniciar: () => void,
): ControleArranque
~~~

- [x] **Step 2: executar a unidade em RED**

Executar:

~~~powershell
npx.cmd vitest run tests/content/arranque.test.ts
~~~

Resultado esperado antes da implementação: falha porque src/content/arranque.ts
e iniciarQuandoHouverBody ainda não existem.

- [x] **Step 3: implementar o helper mínimo**

Implementar src/content/arranque.ts com estas regras:

- Se doc.body existir, chamar iniciar imediatamente.
- Caso contrário, observar doc.documentElement com { childList: true }.
- Ao encontrar body, desconectar o MutationObserver, marcar o helper como
  encerrado e chamar iniciar uma única vez.
- parar() deverá ser idempotente, desconectar o observador e impedir qualquer
  chamada posterior.
- Não usar setTimeout, DOMContentLoaded ou atraso arbitrário.

- [x] **Step 4: integrar o bootstrap em src/content/index.ts**

Extrair as responsabilidades atuais para funções nomeadas:

~~~ts
function iniciarInterface(): void {
  configPronta = aplicarConfig()
  plantio = plantarEnxertos(document, montarEnxertos())
  garantirObservador()
  repintar()
}

function iniciarSsr(): void {
  lerLoteInicial()
  repintar()
}
~~~

Substituir o bloco que condiciona toda a inicialização a DOMContentLoaded por:

~~~ts
iniciarQuandoHouverBody(document, iniciarInterface)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', iniciarSsr, { once: true })
} else {
  iniciarSsr()
}
~~~

Manter o listener de raw-capture, o registro do interceptor e o restante da
configuração no mesmo nível de módulo. iniciarSsr deverá continuar sendo
executado uma única vez.

- [x] **Step 5: executar a unidade em GREEN e as regressões de conteúdo**

Executar:

~~~powershell
npx.cmd vitest run tests/content/arranque.test.ts
npm.cmd test -- --run tests/content
~~~

Esperado: os testes do helper e os testes existentes de conteúdo passam.

- [x] **Step 6: checkpoint**

Atualizar este plano:

- marcar os Steps 1 a 5 como [x];
- definir Última tarefa concluída como Task 1;
- definir Próxima tarefa como Task 2;
- registrar a saída dos comandos na nota de retomada.

Criar checkpoint:

~~~powershell
git add src/content/arranque.ts src/content/index.ts tests/content/arranque.test.ts docs/superpowers/plans/2026-09-17-carregamento.md
git commit -m "⚡ perf(content): iniciar interface ao encontrar body"
~~~

---

## Task 2: consolidar solicitações de repintura

Arquivos:

- Criar src/content/agendamento.ts.
- Criar tests/content/agendamento.test.ts.
- Alterar src/content/index.ts.
- Alterar a integração de src/content/observer.ts somente se o callback
  precisar receber a função agendada em vez de repintar diretamente.

- [x] **Step 1: escrever os testes que falham**

Criar tests/content/agendamento.test.ts com scheduler controlado:

~~~ts
import { describe, expect, it, vi } from 'vitest'
import { criarAgendadorRepintura } from '../../src/content/agendamento'

describe('criarAgendadorRepintura', () => {
  it('consolida várias solicitações antes do frame', () => {
    const repintar = vi.fn()
    const callbacks: Array<() => void> = []
    const agendar = criarAgendadorRepintura(repintar, callback => {
      callbacks.push(callback)
    })

    agendar()
    agendar()
    agendar()

    expect(callbacks).toHaveLength(1)
    expect(repintar).not.toHaveBeenCalled()

    callbacks[0]()

    expect(repintar).toHaveBeenCalledOnce()
  })

  it('permite uma nova repintura depois que o frame termina', () => {
    const repintar = vi.fn()
    const callbacks: Array<() => void> = []
    const agendar = criarAgendadorRepintura(repintar, callback => {
      callbacks.push(callback)
    })

    agendar()
    callbacks[0]()
    agendar()

    expect(callbacks).toHaveLength(2)
    callbacks[1]()
    expect(repintar).toHaveBeenCalledTimes(2)
  })
})
~~~

Definir a interface:

~~~ts
export function criarAgendadorRepintura(
  repintar: () => void,
  solicitarFrame: (callback: () => void) => void,
): () => void
~~~

- [x] **Step 2: executar a unidade em RED**

Executar:

~~~powershell
npx.cmd vitest run tests/content/agendamento.test.ts
~~~

Resultado esperado antes da implementação: falha porque o módulo e a função
ainda não existem.

- [x] **Step 3: implementar o agendador puro**

Implementar o estado mínimo:

~~~ts
let pendente = false

return () => {
  if (pendente) return
  pendente = true
  solicitarFrame(() => {
    pendente = false
    repintar()
  })
}
~~~

O callback deverá liberar pendente antes de executar repintar, permitindo que
uma solicitação gerada durante a pintura seja agendada para o próximo frame. O
módulo não deverá acessar window, document ou timers.

- [x] **Step 4: conectar todas as origens ao mesmo agendador**

Em src/content/index.ts, criar o adaptador de produção:

~~~ts
const agendarRepintura = criarAgendadorRepintura(
  repintar,
  callback => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(callback)
    } else {
      window.setTimeout(callback, 0)
    }
  },
)
~~~

Substituir as chamadas diretas originadas por:

- eventos raw-capture;
- MutationObserver da grade;
- finalização de lerLoteInicial;
- primeira pintura de iniciarInterface.

O observador deverá continuar observando a mesma raiz e usando os mesmos
limites de segurança; apenas o callback recebido deverá ser agendarRepintura.
Não remover a repintura após SSR.

- [x] **Step 5: executar GREEN e conferir comportamento**

Executar:

~~~powershell
npx.cmd vitest run tests/content/agendamento.test.ts
npm.cmd test -- --run tests/content
npm.cmd run typecheck
~~~

Esperado: o agendador passa, os testes de conteúdo passam e o TypeScript não
emite erros.

- [x] **Step 6: checkpoint**

Marcar os Steps 1 a 5 como [x], atualizar o bloco Progresso para indicar Task 3
como próxima tarefa e registrar as saídas.

Criar checkpoint:

~~~powershell
git add src/content/agendamento.ts src/content/index.ts src/content/observer.ts tests/content/agendamento.test.ts docs/superpowers/plans/2026-09-17-carregamento.md
git commit -m "⚡ perf(content): consolidar repinturas no próximo frame"
~~~

---

## Task 3: proteger o contrato com E2E e registrar métricas reais

Arquivos:

- Criar e2e/carregamento.spec.ts.
- Alterar e2e/ssr.spec.ts para registrar métricas, sem limiar rígido
  dependente da rede.

- [x] **Step 1: escrever o teste E2E que falha no bootstrap antigo**

Criar um cenário local no domínio permitido pela extensão. A página deverá
ter um body e uma barra mínima antes de um script parser-blocking:

~~~ts
import { expect, test } from './fixtures'

test('monta a interface antes de DOMContentLoaded', async ({ context }) => {
  let liberarScript!: () => void
  const scriptLiberado = new Promise<void>(resolve => {
    liberarScript = resolve
  })

  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', async route => {
    if (route.request().url().endsWith('/slow.js')) {
      await scriptLiberado
      await route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: [
        '<!doctype html>',
        '<html><body>',
        '<div aria-label="barra de ferramentas"></div>',
        '<script src="/ads/library/slow.js"></script>',
        '</body></html>',
      ].join(''),
    })
  })

  await page.goto('https://www.facebook.com/ads/library/?id=bootstrap', {
    waitUntil: 'commit',
  })

  await expect(page.locator('#copyhaunt-enxertos')).toBeAttached()
  expect(await page.evaluate(() => document.readyState)).toBe('loading')

  liberarScript()
  await page.waitForLoadState('domcontentloaded')
})
~~~

Se o seletor real do host for diferente, usar o atributo já emitido pelo
componente e manter o contrato explícito no teste; não trocar por uma espera
de tempo.

- [x] **Step 2: executar o E2E em RED**

Executar:

~~~powershell
npx.cmd playwright test e2e/carregamento.spec.ts
~~~

Resultado esperado antes das Tasks 1 e 2: falha ou expiração do auto-wait,
porque o bootstrap antigo só monta a interface depois de DOMContentLoaded.

- [x] **Step 3: executar GREEN e ajustar apenas o contrato necessário**

Após as Tasks 1 e 2, executar novamente o mesmo comando. O host deverá ser
anexado enquanto document.readyState ainda é loading. Se o teste falhar por
causa do fixture ou da rota, corrigir o cenário mantendo a mesma propriedade:
o script parser-blocking continua aberto até depois de o host ser detectado.

- [x] **Step 4: preservar o diagnóstico da Biblioteca real**

Em e2e/ssr.spec.ts, registrar com performance.now():

- início da navegação;
- DOMContentLoaded;
- primeiro host CopyHaunt anexado;
- primeiro overlay ou bandeja observável;
- quantidade de anúncios e resultado da leitura SSR.

Usar locators e expect.poll/auto-waiting para detectar os marcos. Não usar
waitForTimeout e não falhar o teste por um limite absoluto de segundos da Meta.
Os valores deverão aparecer no output para comparação antes/depois.

- [x] **Step 5: executar os testes E2E relacionados**

Executar:

~~~powershell
npx.cmd playwright test e2e/carregamento.spec.ts e2e/ssr.spec.ts
~~~

Conferir que o cenário determinístico passa e que o cenário real mantém a
validação SSR existente. Se o teste conhecido de e2e/acoes.spec.ts for
executado pela suíte completa e falhar apenas pela navegação instável,
reexecutá-lo isoladamente antes de classificar a alteração como regressão.

- [x] **Step 6: checkpoint**

Marcar os Steps 1 a 5 como [x], atualizar Progresso para Task 4 como próxima
tarefa e registrar os tempos observados no diagnóstico.

Criar checkpoint:

~~~powershell
git add e2e/carregamento.spec.ts e2e/ssr.spec.ts docs/superpowers/plans/2026-09-17-carregamento.md
git commit -m "🧪 test(e2e): proteger carregamento antes do DOMContentLoaded"
~~~

---

## Task 4: verificação final e encerramento do plano

Arquivos:

- Atualizar somente o bloco Progresso e as notas de retomada em
  docs/superpowers/plans/2026-09-17-carregamento.md.

- [x] **Step 1: rodar a verificação completa**

Executar, nesta ordem:

~~~powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npm.cmd run e2e
~~~

Não executar npm.cmd run gravar:fixtures.

- [x] **Step 2: revisar o diff e a política do build**

Executar:

~~~powershell
git diff --check
git status --short
git diff --stat HEAD~3..HEAD
~~~

Conferir especialmente:

- nenhuma permissão nova no manifest;
- nenhuma chamada de rede nova;
- nenhuma consulta de Instagram durante a mineração;
- nenhum waitForTimeout ou atraso fixo nos testes;
- SSR, resultados e ciclo de mineração continuam cobertos pelos testes
  existentes.

- [x] **Step 3: validação manual**

Com a extensão recarregada no Chrome:

1. Abrir a Biblioteca de Anúncios com o DevTools Performance aberto.
2. Confirmar que a interface CopyHaunt aparece antes de o documento concluir,
   quando o carregamento da página permitir observar essa fase.
3. Executar uma mineração com vários lotes e conferir que a barra, os badges e
   o overlay continuam sendo atualizados.
4. Abrir resultados e confirmar que os anúncios capturados pelo SSR e pelos
   lotes posteriores permanecem presentes.
5. Verificar no console o diagnóstico antes/depois, sem erros de runtime.

- [x] **Step 4: fechar o plano**

Só depois de todas as verificações:

- marcar os Steps 1 a 3 desta Task como [x];
- definir Estado: concluído;
- definir Última tarefa concluída: Task 4;
- definir Próxima tarefa: —;
- registrar os comandos, resultados e eventual instabilidade isolada;
- criar o checkpoint final:

~~~powershell
git add docs/superpowers/plans/2026-09-17-carregamento.md
git commit -m "📚 docs(plan): concluir plano de carregamento"
~~~

## Critério de conclusão

O plano estará concluído quando a interface puder iniciar com o body
disponível sem esperar DOMContentLoaded, quando capturas próximas
compartilharem uma única repintura por frame, quando o teste E2E determinístico
proteger esse contrato e quando a suíte completa e o build forem verificados
com saída conferida.
