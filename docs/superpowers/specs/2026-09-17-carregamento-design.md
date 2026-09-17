# Carregamento inicial e repintura — Design

## Contexto e evidências

A investigação de 17/09/2026 encontrou dois pontos distintos:

- O content script é injetado em document_start, mas src/content/index.ts
  espera DOMContentLoaded para iniciar a interface.
- Na Biblioteca real, DOMContentLoaded ocorreu entre aproximadamente 3,1 s e
  4,2 s; o HTML tinha cerca de 1,5 MB a 2,0 MB.
- A varredura atual de acharCards custou aproximadamente 11 ms em uma árvore
  com 8.311 elementos e encontrou 26 anúncios. Ela não é o gargalo primário da
  primeira pintura.
- Cada captura com anúncios novos chama repintar() imediatamente. O
  observador da grade também pode solicitar novas repinturas. Em uma mineração
  longa, isso repete a varredura completa e o trabalho de DOM mais vezes do que
  o necessário.
- O processamento SSR deve continuar acontecendo depois que o documento
  terminou de ser montado, para não perder os scripts JSON iniciais.

## Objetivo

Exibir os controles da CopyHaunt assim que o body existir, sem aguardar
DOMContentLoaded, e consolidar repinturas próximas em um único ciclo do
navegador, preservando a captura passiva, o SSR e o comportamento atual da
extensão.

## Decisões de arquitetura

### Bootstrap em duas fases

1. Um helper observa a criação do body e executa a inicialização da interface
   uma única vez.
2. A interface instala enxertos, observador e uma primeira pintura assim que o
   body está disponível.
3. O lote SSR continua sendo lido uma única vez no DOMContentLoaded — ou
   imediatamente se o documento já tiver passado desse estado — e então
   solicita uma repintura.
4. O interceptor e o listener de mensagens continuam sendo registrados no
   carregamento do módulo, como já ocorre hoje.

Assim, a barra e os controles podem aparecer durante o carregamento, enquanto
os dados iniciais continuam aguardando o ponto seguro para leitura dos scripts
JSON.

### Agendamento compartilhado de repintura

As chamadas originadas por raw-capture, pelo observador da grade e pelo
processamento SSR passam por um agendador único. Chamadas feitas antes do
próximo frame são consolidadas em uma só execução. O agendador recebe a
função de solicitar o frame por injeção, o que permite testá-lo sem espera
fixa.

### Limites

- Não adicionar permissões ao manifest.
- Não adicionar consultas de rede.
- Não reintroduzir filtro de Instagram na mineração.
- Não reescrever acharCards nesta etapa: a medição mostrou que sua execução
  isolada não explica o atraso inicial.
- Não criar um orçamento rígido contra a Biblioteca real, cuja rede e
  conteúdo são variáveis; o teste determinístico cobrirá o contrato de
  inicialização e o diagnóstico real continuará registrando tempos.

## Verificação esperada

- Testes unitários cobrem o bootstrap sem DOMContentLoaded e o coalescimento
  do agendador.
- Um teste E2E mantém um script parser-blocking aberto e confirma que a
  interface aparece enquanto o documento ainda não disparou
  DOMContentLoaded.
- O diagnóstico da Biblioteca real registra DOMContentLoaded, primeira
  montagem do host e primeira pintura observável, sem transformar variação de
  rede em falha falsa.
- npm.cmd test, npm.cmd run typecheck, npm.cmd run verify:build e npm.cmd run
  e2e continuam passando, considerando a instabilidade conhecida e isolada de
  e2e/acoes.spec.ts.
