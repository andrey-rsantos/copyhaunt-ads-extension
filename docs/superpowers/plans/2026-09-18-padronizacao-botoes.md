# Padronização de botões e barra de mineração Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir os controles nativos e inconsistentes da extensão por uma hierarquia visual única, alinhada à IDV, incluindo o recolhimento da barra de mineração concluída.

**Architecture:** Os enxertos de conteúdo continuarão isolados no Shadow DOM. A barra de mineração ganhará variantes semânticas por `data-acao`, preservará o cartão concluído ao recolher e o reabrirá pelo botão Minerar. Gavetas, resultados e painel usarão classes/estados existentes, sem criar uma biblioteca nova de componentes.

**Tech Stack:** TypeScript, DOM nativo, CSS dentro de Shadow DOM, React/TSX, Vitest, jsdom.

**Spec:** `CopyHaunt-IDV.md` e `botoes-preview.html`

## Progresso

- **Estado:** concluído
- **Última tarefa concluída:** revisão manual do proprietário
- **Próxima tarefa:** —
- **Notas de retomada:** revisão manual aprovada. `botoes-preview.html` foi confirmado como artefato temporário e será removido no checkpoint de fechamento.

## Global Constraints

- Usar `#08070D`, `#111019`, `#7C3AED`, `#A855F7`, `#C4A7FF` e `#B8B5C6` conforme `CopyHaunt-IDV.md`.
- Ações principais usam fundo roxo e texto branco; ações secundárias usam `#181621` com contorno `#302B3D`.
- Ícones devem ser outline, com traço arredondado, e controles precisam ter foco visível.
- Não alterar controles pertencentes à Meta.
- Testes novos devem falhar antes da implementação e não podem usar espera fixa.
- Não adicionar dependências para ícones; reutilizar SVG inline já adotado pelo projeto.
- Após a revisão manual aprovada, registrar o fechamento no checkpoint correspondente.

### Task 1: Padronizar a barra de mineração e permitir recolher/expandir

**Files:**
- Modify: `src/content/progresso.ts`
- Modify: `src/content/index.ts`
- Modify: `src/content/enxertos.ts`
- Modify: `src/content/estilo.ts`
- Test: `tests/content/progresso.test.ts`
- Test: `tests/content/enxertos.test.ts`

**Interfaces:**
- `AcoesProgresso` produzirá o callback `aoRecolher`.
- `montarBotao` será reutilizável para restaurar o botão Minerar no mesmo Shadow DOM.
- A barra manterá o cartão concluído em memória durante o recolhimento; expandir apenas o recoloca no lugar, sem iniciar nova mineração.

- [x] **Step 1: Escrever testes falhando para o controle de recolhimento**

  Em `tests/content/progresso.test.ts`, ampliar o helper `acoes` com `aoRecolher` e adicionar:

  ```ts
  it('mostra o controle de recolher somente em estado terminal', () => {
    const cartao = montarProgresso(document, acoes())

    atualizarProgresso(cartao, progresso({ estado: 'minerando' }), 100)
    expect(cartao.querySelector('[data-acao="recolher"]')).toBeNull()

    atualizarProgresso(cartao, progresso({ estado: 'concluido' }), 100)
    expect(cartao.querySelector<HTMLButtonElement>('[data-acao="recolher"]')).not.toBeNull()
  })

  it('dispara o callback de recolher', () => {
    const aoRecolher = vi.fn()
    const cartao = montarProgresso(document, acoes({ aoRecolher }))
    atualizarProgresso(cartao, progresso({ estado: 'concluido' }), 100)

    cartao.querySelector<HTMLButtonElement>('[data-acao="recolher"]')?.click()

    expect(aoRecolher).toHaveBeenCalledTimes(1)
  })
  ```

- [x] **Step 2: Rodar o teste e confirmar RED**

  Run: `npm.cmd test -- tests/content/progresso.test.ts`

  Expected: FAIL porque `AcoesProgresso` ainda não possui `aoRecolher` e a barra não cria `[data-acao="recolher"]`.

- [x] **Step 3: Implementar o controle terminal e os estilos das variantes**

  Em `src/content/progresso.ts`, criar o botão de recolher com SVG de seta para a esquerda, `aria-label="Recolher mineração"` e `title="Recolher mineração"`; mostrar esse controle junto de `resultados` e `repetir` somente quando `TERMINAIS.has(p.estado)`.

  Em `src/content/estilo.ts`, remover a dependência do estilo nativo e estilizar os botões por ação:

  ```css
  :host(#copyhaunt-enxertos) .progresso button {
    min-height: 28px;
    padding: 0 10px;
    border: 0;
    border-radius: 8px;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
  :host(#copyhaunt-enxertos) .progresso [data-acao="resultados"] {
    background: #7C3AED;
    color: #FFFFFF;
  }
  :host(#copyhaunt-enxertos) .progresso [data-acao="repetir"],
  :host(#copyhaunt-enxertos) .progresso [data-acao="parar"] {
    background: #181621;
    color: #FFFFFF;
    box-shadow: inset 0 0 0 1px #302B3D;
  }
  :host(#copyhaunt-enxertos) .progresso [data-acao="recolher"] {
    width: 28px;
    padding: 0;
    background: transparent;
    color: #C4A7FF;
  }
  :host(#copyhaunt-enxertos) .progresso button:focus-visible {
    outline: 2px solid #A855F7;
    outline-offset: 2px;
  }
  ```

- [x] **Step 4: Implementar o estado recolhido sem iniciar mineração**

  Em `src/content/enxertos.ts`, extrair a montagem do elemento `.botao` para `montarBotao(doc, enxerto)` e reutilizar `montarIcone`.

  Em `src/content/index.ts`, o callback `aoRecolher` deve substituir o cartão por um botão `data-chave="minerar"`, variante `solido`, com o mesmo ícone de picareta. O callback desse botão deve substituir o botão pelo cartão concluído preservado. O clique não deve abrir a gaveta nem criar um novo motor.

- [x] **Step 5: Rodar os testes da Task 1**

  Run: `npm.cmd test -- tests/content/progresso.test.ts tests/content/enxertos.test.ts`

  Expected: PASS, incluindo os testes existentes de replantio e callbacks.

### Task 2: Unificar os controles das gavetas de mineração e tempo ativo

**Files:**
- Modify: `src/content/gaveta-minerar.ts`
- Modify: `src/content/gaveta-calendario.ts`
- Modify: `src/content/estilo.ts`
- Test: `tests/content/gaveta-minerar.test.ts`
- Test: `tests/content/gaveta-calendario.test.ts`

**Interfaces:**
- Campos numéricos usarão a classe `.campo` em vez de `style.cssText`.
- Presets usarão `.preset` e `aria-pressed`; o estado selecionado será expresso por `data-selecionado="true"`.
- O CTA de cada gaveta continuará sendo `[data-acao="iniciar"]` ou `[data-acao="aplicar"]`.

- [x] **Step 1: Escrever testes falhando para classes e estado visual sem inline style**

  Adicionar aos testes existentes:

  ```ts
  it('usa variantes visuais próprias nos controles da gaveta', () => {
    const el = montarMinerar(document, URL_ATUAL, agora, () => {})

    expect(el.querySelector('[data-campo="colacaoMinima"]')?.className).toBe('campo')
    expect(el.querySelector('[data-acao="iniciar"]')?.className).toBe('acao acao--primaria')
  })
  ```

  E em `tests/content/gaveta-calendario.test.ts`:

  ```ts
  it('marca o preset selecionado por atributo sem depender de estilo inline', () => {
    const el = montarCalendario(document, { diasMin: 14, diasMax: null }, () => {})
    const ativo = el.querySelector<HTMLElement>('[data-preset="14"]')

    expect(ativo?.className).toBe('preset')
    expect(ativo?.dataset.selecionado).toBe('true')
    expect(ativo?.style.cssText).toBe('')
  })
  ```

- [x] **Step 2: Rodar os testes e confirmar RED**

  Run: `npm.cmd test -- tests/content/gaveta-minerar.test.ts tests/content/gaveta-calendario.test.ts`

  Expected: FAIL porque os campos não têm `.campo`, o CTA não tem a variante e os presets ainda usam `style.cssText`.

- [x] **Step 3: Implementar as classes e os estados CSS**

  Remover `style.cssText` de `campo` e `botaoPreset`. Atualizar `atualizarSelecao` para definir `data-selecionado` e manter `aria-pressed`. Adicionar em `CSS_GAVETA` os estilos de `.campo`, `.acao`, `.acao--primaria`, `.preset`, `.preset[data-selecionado="true"]`, hover e foco visível.

- [x] **Step 4: Rodar os testes da Task 2**

  Run: `npm.cmd test -- tests/content/gaveta-minerar.test.ts tests/content/gaveta-calendario.test.ts`

  Expected: PASS.

### Task 3: Padronizar ações da página de resultados e do painel

**Files:**
- Modify: `src/resultados/CartaoResultado.tsx`
- Modify: `src/resultados/LinksMenu.tsx`
- Modify: `src/resultados/resultados.css`
- Modify: `src/panel/App.tsx`
- Test: `tests/resultados-ui.test.tsx`
- Test: `tests/panel-ui.test.tsx`

**Interfaces:**
- Ações do card terão as classes `.botao botao--primario`, `.botao botao--secundario` e `.botao botao--icone`.
- Menus de links/cópias manterão seus itens em estilo de menu, sem receber o tratamento de CTA do card.
- O painel exibirá o preset ativo com contorno roxo por `aria-pressed="true"`.

- [x] **Step 1: Escrever testes falhando para a hierarquia das ações**

  Em `tests/resultados-ui.test.tsx`, acrescentar asserções aos testes que renderizam um card: `Links` e `Copiar` devem ter `.botao--secundario`, e `Baixar` deve ter `.botao--primario`. Acrescentar um caso que selecione `14+ Dias` no painel e confira `aria-pressed="true"` com a classe de estado ativo.

- [x] **Step 2: Rodar os testes e confirmar RED**

  Run: `npm.cmd test -- tests/resultados-ui.test.tsx`

  Expected: FAIL porque os componentes ainda não expõem as classes de variante.

- [x] **Step 3: Implementar as classes e tokens CSS**

  Adicionar as classes sem alterar o texto nem os fluxos de copiar, links, Instagram ou download. Em `resultados.css`, substituir os seletores genéricos de `resultado-acoes` por variantes explícitas, preservando a animação de cópia. Em `App.tsx`, aplicar classe ativa baseada no estado `selecionado`.

- [x] **Step 4: Rodar os testes da Task 3**

  Run: `npm.cmd test -- tests/resultados-ui.test.tsx`

  Expected: PASS.

### Task 4: Verificação integrada e revisão da working tree

**Files:**
- Modify: `docs/superpowers/plans/2026-09-18-padronizacao-botoes.md`

- [x] **Step 1: Rodar a suíte de conteúdo e UI**

  Run: `npm.cmd test -- tests/content tests/resultados-ui.test.tsx`

  Expected: PASS.

- [x] **Step 2: Rodar typecheck e build**

  Run: `npm.cmd run typecheck; npm.cmd run verify:build`

  Expected: typecheck limpo; build e manifest válidos, sem permissões novas.

- [x] **Step 3: Conferir o diff e registrar o estado**

  Run: `git diff --check; git status --short; git diff --stat`

  Expected: nenhum erro de whitespace; alterações restritas aos arquivos do plano e ao preview temporário; nenhum commit criado.

- [x] **Step 4: Atualizar o bloco Progresso**

  Marcar somente as tarefas realmente verificadas, registrar a saída dos comandos e manter explícito que o commit foi deliberadamente adiado para revisão manual.
