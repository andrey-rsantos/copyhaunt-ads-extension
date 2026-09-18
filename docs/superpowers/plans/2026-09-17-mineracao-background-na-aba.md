# Mineração em segundo plano na aba atual Implementation Plan

> **Para agentes de implementação:** OBRIGATÓRIO: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam checkboxes (`- [ ]`) para acompanhar o estado.

**Objetivo:** fazer a mineração continuar naturalmente quando o usuário troca de aba, minimiza o Chrome ou deixa de visualizar a Biblioteca de Anúncios, sem exigir checkbox, sem abrir aba técnica e sem mudar o fluxo visual da mineração.

**Arquitetura:** a mineração continua sendo iniciada e executada pelo content script da aba atual. O `Minerador` mantém o scroll e a captura passiva nessa mesma página; o relógio em Web Worker já reduz o impacto do throttling de timers em abas ocultas. A interface de progresso permanece no mesmo card e não precisa sincronizar estado entre abas. Eventos de ciclo de vida da página servem apenas para persistir um parcial seguro quando a aba estiver sendo descarregada.

**Stack:** Chrome Manifest V3, TypeScript, content script, Web Worker para relógio, `chrome.storage.local`, Vitest e Playwright.

**Spec:** `RASC.txt` e `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md`, com a decisão de produto registrada nesta sessão: “sair da tela” significa trocar de aba/minimizar; fechar a aba ou navegar para outro site encerra a página e preserva o parcial.

## Progresso

- **Estado:** concluído
- **Última tarefa concluída:** Task 3 — validação focada e E2E completa
- **Próxima tarefa:** —
- **Notas de retomada:** a abordagem anterior de aba dedicada foi descartada antes de commit. A base de implementação é o commit `dac554e`; o relógio em Web Worker já existe. Task 1 confirmou que o motor permanece agnóstico à visibilidade e não inicia coordenador externo. Task 2 adicionou checkpoint `minerando`, fila de gravação, fronteira de ciclo de vida e rótulo de último checkpoint. Task 3 foi validada com E2E focado (1/1) e suíte completa (19/19). O teste usa evento de ciclo de vida simulado porque o Chromium headless deste runner mantém `visibilityState` como `visible` mesmo após outra página receber foco. Não adicionar checkbox nem coordenador de segunda aba.

## Decisão técnica e limites

O service worker não participa da mineração. Isso preserva o content script como hub, mantém a observação passiva das requisições da Meta e evita abrir uma aba que o usuário não pediu. A aba da Ad Library pode ficar oculta e continuar executando, mas o Chrome pode congelar ou descartar páginas em situações de pressão de memória ou Energy Saver.

Referências técnicas:

- [Throttling de abas em segundo plano](https://developer.chrome.com/blog/background_tabs)
- [Page Lifecycle API](https://developer.chrome.com/docs/web-platform/page-lifecycle-api)
- [Freezing no Energy Saver](https://developer.chrome.com/blog/freezing-on-energy-saver)
- [Service workers de extensões](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers)

Esses limites devem aparecer na documentação interna e orientar os testes; não devemos prometer que uma aba fechada ou descartada continuará minerando.

## Restrições globais

- Não adicionar checkbox, permissão, aba auxiliar, documento `offscreen` ou nova requisição à Meta.
- Manter a coleta passiva: o motor somente rola a página e reage ao que o interceptador capturou.
- Trocar de aba, minimizar o navegador e retornar à Ad Library devem preservar o mesmo motor, o mesmo progresso e os mesmos controles.
- Ao ficar oculta, a página deve salvar um checkpoint do parcial sem interromper o motor; esse checkpoint é a melhor recuperação possível se a aba for fechada depois.
- Fechar a aba, navegar para outro site ou ser descartada não deve abrir aba substituta. Se o navegador não entregar o evento de ciclo de vida, não prometer recuperação além do último checkpoint.
- Não parar a mineração apenas porque `document.visibilityState === 'hidden'`.
- Não usar espera fixa nos testes. Não executar `npm.cmd run gravar:fixtures`.
- Preservar pausa, retomada, parada, resultados e minerar novamente.
- Não alterar `RASC.txt` para marcar o item como feito antes da validação manual do usuário.
- Não fazer commit nesta rodada; deixar o diff para revisão manual.

## Comportamento esperado

1. O usuário abre **Minerar**, ajusta os critérios e clica em **Iniciar mineração**.
2. A interface troca para o card de progresso como já acontece hoje.
3. O usuário pode mudar de aba, minimizar o Chrome ou trabalhar em outro aplicativo.
4. A aba original continua conduzindo a rolagem e recebendo as respostas reais da Meta.
5. Ao voltar, o card mostra o progresso atualizado e os controles continuam operacionais.
6. Ao ficar oculta, a extensão grava um checkpoint do parcial; se a aba for fechada ou navegar para fora da Ad Library, não tenta recriar a sessão em outra aba.

## Task 1 — Cobrir a continuidade sem visibilidade e preservar o fluxo atual

- [x] Comprovar que a mineração não depende de `visibilityState === 'visible'` e não abre abas auxiliares.

**Arquivos:** `src/core/miner.ts`, `src/core/clock.ts`, `src/content/index.ts`, `tests/miner.test.ts`, `tests/content-mineracao.test.ts` e um teste focado novo se necessário.

### Teste primeiro (RED)

- Adicionar um teste do motor com um documento oculto simulado, alternando `document.visibilityState` antes e durante o laço, e comprovar que as rolagens, lotes e progresso continuam.
- Cobrir que iniciar uma mineração não chama `chrome.tabs.create`, `chrome.runtime.sendMessage` para delegação ou qualquer outro coordenador externo.
- Cobrir que o pedido padrão continua sem nova opção de UI e que o card de progresso aparece na mesma aba.
- Rodar antes da implementação:
  `npm.cmd test -- tests/miner.test.ts tests/content-mineracao.test.ts`

### Implementação

- Corrigir qualquer guarda, listener ou caminho que pause a mineração ao detectar a aba oculta.
- Reutilizar `relogioDeWorker()` sem criar nova infraestrutura de abas.
- Remover qualquer vestígio da abordagem descartada caso tenha sido reintroduzido durante a execução.
- Manter o `Minerador` agnóstico ao estado visual da aba; a única fonte de parada continua sendo o usuário, o fim dos resultados, o limite ou um erro real da página.

### Verificação

`npm.cmd test -- tests/miner.test.ts tests/content-mineracao.test.ts` e `npm.cmd run typecheck`.

## Task 2 — Criar checkpoint ao ocultar a página

- [x] Persistir um checkpoint ao ocultar a página, sem interromper a mineração em troca de aba.

**Arquivos:** `src/content/index.ts`, `src/content/resultados.ts`, `src/content/controle-mineracao.ts`, possivelmente `src/core/resultados.ts`, e testes em `tests/content/resultados.test.ts`, `tests/content/controle-mineracao.test.ts` ou novos testes focados.

### Teste primeiro (RED)

- Cobrir que `visibilitychange` para `hidden` não grava um resultado interrompido nem chama `motor.interromper()`.
- Cobrir que `visibilitychange` para `hidden` grava no máximo um checkpoint com estado `minerando`, sem lançar erro síncrono, sem chamar `motor.interromper()` e sem tentar abrir uma nova aba.
- Cobrir que `pagehide` chama o mesmo caminho de checkpoint como fallback best-effort, sem depender de uma Promise para bloquear o descarregamento.
- Cobrir idempotência: múltiplos eventos de ciclo de vida não sobrescrevem o resultado com uma segunda gravação concorrente.
- Cobrir que uma mineração concluída não é rebaixada para parcial quando um evento tardio chega.
- Rodar antes da implementação:
  `npm.cmd test -- tests/content/resultados.test.ts tests/content/controle-mineracao.test.ts`

### Implementação

- Adicionar uma fronteira pequena e testável para o ciclo de vida, em vez de espalhar listeners pelo `index.ts`.
- Usar o snapshot que o motor já possui (`progresso()` e `encontrados()`) e persistir `estado: 'minerando'` como “último checkpoint”, sem fingir que a sessão terminou.
- Ajustar o rótulo da tela de resultados para distinguir “último checkpoint” de resultado final ou parcial pausado/interrompido.
- Reutilizar a fila de storage existente para evitar corrida entre pausa, parada, finalização e `pagehide`.
- Não persistir a cada rolagem: salvar no máximo uma vez por transição para `hidden`, além das ações já existentes de pausa/parada.
- Garantir que o fluxo normal de troca de aba não interrompa o motor; o navegador deve continuar com o mesmo motor em memória.

### Verificação

`npm.cmd test -- tests/content/resultados.test.ts tests/content/controle-mineracao.test.ts` e `npm.cmd run typecheck`.

## Task 3 — Validar no navegador e registrar a garantia real

- [x] Validar troca de aba, retorno, minimização e encerramento da página com Playwright.

**Arquivos:** novo `e2e/mineracao-background.spec.ts`, eventualmente `e2e/fixtures.ts`, documentação deste plano e, após aprovação manual, `RASC.txt`.

### Teste primeiro (RED)

- Criar um cenário determinístico que inicia a mineração na aba da Ad Library e confirma que o progresso sobe.
- Abrir uma segunda página no mesmo contexto, trazê-la para frente e verificar por `expect.poll` que a mineração da primeira aba continua avançando sem criar uma segunda aba da Ad Library.
- Voltar à primeira aba e confirmar que o card de progresso, pausa e resultados continuam presentes.
- Ocultar a aba e depois fechá-la ou navegar para fora para verificar que o último checkpoint permanece, sem erro não tratado e sem aba substituta.
- Rodar antes da implementação:
  `npm.cmd run e2e -- e2e/mineracao-background.spec.ts`

### Verificação final

- Usar locators, eventos e `expect.poll`; não usar `waitForTimeout` como sincronização.
- Rodar:
  `npm.cmd test`
  `npm.cmd run typecheck`
  `npm.cmd run verify:build`
  `npm.cmd run e2e`
  `git diff --check`
- Confirmar que o manifest não ganhou permissões e que nenhuma chamada `chrome.tabs.create` foi adicionada ao fluxo da mineração.
- Atualizar o bloco Progresso após cada Task, com a saída real dos comandos.
- Somente depois da revisão manual mover o item de `RASC.txt` para a seção de feitos e preparar um commit separado.

**Verificação executada:** `npm.cmd test` (60 arquivos, 545 testes), `npm.cmd run typecheck`, `npm.cmd run verify:build`, `npm.cmd run e2e -- e2e/mineracao-background.spec.ts` (1/1), `npm.cmd run e2e` (19/19) e `git diff --check`.

## Critério de conclusão

- O usuário não precisa marcar nenhuma opção adicional.
- A mineração começa na aba atual e continua ao trocar de aba ou minimizar o navegador.
- Ao retornar, o mesmo card exibe o progresso e os controles funcionam.
- Não existe aba técnica ou delegação para service worker.
- Ocultar a aba preserva um checkpoint; fechamento/navegação não recria a sessão e não promete recuperação além desse checkpoint.
- A coleta continua passiva e o manifest permanece com permissões mínimas.
- Vitest, typecheck, build/manifest e Playwright passam.
- A documentação deixa claro que “background” significa aba oculta; aba fechada ou descartada não pode continuar sem outra página.
