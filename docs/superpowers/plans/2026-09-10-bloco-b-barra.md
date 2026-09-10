# Bloco B — a interface na barra da Meta · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Sem essa skill carregada, siga `AGENTS.md`, seção "O plano é o estado".

## Progresso

- **Estado:** em andamento
- **Última tarefa concluída:** Task 2 — plantar os enxertos e mantê-los vivos
- **Próxima tarefa:** Task 3
- **Notas de retomada:** A Task 1 foi validada contra a Meta real antes de ser executada, e a primeira versão da regra falhou lá: subir procurando o primeiro flex-row devolve um wrapper interno do campo de busca, com 20 px de altura. O plano e o spec da âncora foram corrigidos antes do despacho, e o teste de regressão que trava isso está em `tests/content/barra.test.ts`. Também caiu a afirmação de que a barra teria duas formas por largura: entre 762 e 1602 px ela foi sempre `row`, e a forma de coluna era estado transitório de carregamento. O suporte a `coluna` ficou no código por ser barato. Na Task 2, a revisão pegou um vazamento que os testes não veriam: a folha de estilo é compartilhada com as bandejas dos cards, e o `:host` do CSS_ENXERTOS venceria o `all: initial` delas, dando `display: flex` ao host da bandeja e empurrando o conteúdo de todo card para baixo. A regra foi escopada para `:host(#copyhaunt-enxertos)` e dois testes de texto travam o caminho. Suíte: 373 testes, 38 arquivos.

**Goal:** Plantar na barra de filtros da Meta os três enxertos do spec — o `?`,
o calendário e o Minerar — de modo que uma mineração real comece por um botão,
e não por um comando no console.

**Architecture:** O motor já existe e está provado. Este plano não toca nele:
constrói a camada de interface que o chama. Um módulo puro acha a barra e
decide onde inserir; um módulo de plantio mantém os enxertos vivos contra a
reciclagem da Meta; três módulos de gaveta desenham o conteúdo. O disparo
reaproveita `iniciarMineracao`, que já está escrito em `src/content/index.ts`.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, Shadow DOM.

**Spec:** `docs/superpowers/specs/2026-09-10-bloco-b-integracao-design.md`

**Levantamento da âncora:** `docs/superpowers/specs/2026-09-10-ancora-barra-de-filtros.md`
— leia antes da Task 1. É o resultado da incerteza 4 do spec, e contém os
achados que este plano obedece.

**Plano irmão, ainda não escrito:** a página de resultados em aba própria, a
gravação dos aprovados que a alimenta, e o clique no ícone da extensão que a
reabre. Depende deste. Ao fim deste plano os aprovados existem em memória e
saem no console — já filtrados por Instagram quando o toggle estiver ligado —,
mas ninguém ainda os vê numa tela.

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e os hosts atuais. Se uma
  tarefa parecer pedir permissão nova, pare: o desenho está errado.
- **Nada aqui pode emitir requisição.** A seção 2 do spec de 2026-09-05 abre
  uma única exceção, o Instagram ao clique, e ela não está neste plano. Se
  você escrever `fetch` ou `XMLHttpRequest` em qualquer arquivo deste plano,
  está errado.
- **Degradar em silêncio** (spec, 7.7). Âncora não encontrada significa
  enxerto que não aparece, e nada mais quebrado. Nunca deixe subir exceção
  por falta de âncora.
- **Todo enxerto vive em shadow root**, criado por `criarShadow` de
  `src/content/estilo.ts`. O CSS da Meta não alcança o nosso, e o nosso não
  alcança o deles.
- **Nunca guardar referência ao `input[type="search"]`.** A Meta troca esse nó
  a cada busca nova — medido. Toda operação reexecuta a busca pelo documento.
- **Nenhuma profundidade fixa de DOM no código.** Os 17 níveis medidos são
  diagnóstico, não regra. Quem escrever `parentElement` dezessete vezes
  reintroduz a fragilidade que `src/content/anchor.ts` evita.
- **`npm.cmd` e `npx.cmd`** no PowerShell do Windows.
- **Nunca rodar `npm run gravar:fixtures`.** Ele regrava as fixtures contra a
  Meta ao vivo e destrói a base de comparação dos testes.
- **Quem commita é o revisor.** O executor escreve a mensagem em `.commit-msg`
  na raiz e para.
- **Commits** no padrão de `AGENTS.md`: tipo em inglês, texto em pt-BR,
  descrição no infinitivo.
- **Teste antes da implementação.** Cada tarefa nomeia o teste que falha
  primeiro.
- **Nada de espera por tempo fixo em teste.** Use `vi.waitFor` ou o relógio
  falso de `src/core/clock.ts`.

## As decisões já tomadas, para não serem redecididas

Tomadas pelo dono do projeto em 2026-09-10, depois do levantamento da âncora.

| Questão | Decisão |
|---|---|
| Barra em duas linhas, na tela estreita | Calendário e Minerar **acompanham a busca**, na linha dela |
| Onde os resultados vivem | **Página própria da extensão**, em aba separada — plano irmão |
| Minerar de novo | **Substitui** o resultado anterior — plano irmão |
| Reabrir a tela depois de fechada | **Clique no ícone da extensão** — plano irmão |

## O que o levantamento da âncora obriga

Três fatos medidos, que as tarefas abaixo já incorporam. Não os redescubra.

1. `input[type="search"]` é único na página. É a âncora.
2. Numa busca nova a Meta **troca o nó do input** e **preserva a barra**.
3. A barra tem duas formas, decididas em JS sobre `innerWidth`: uma linha
   acima de ~1280 px, duas linhas por volta de 1036 px.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `src/content/barra.ts` | **Criar.** Puro. Acha a barra e a fila onde a busca está. Não toca no DOM da Meta |
| `src/content/enxertos.ts` | **Criar.** Planta, replanta e remove os enxertos. Dono do observador e do `resize` |
| `src/content/gaveta.ts` | **Criar.** Mecânica comum das três gavetas: abrir, fechar, uma só por vez |
| `src/content/gaveta-exemplos.ts` | **Criar.** Conteúdo do `?` (spec, 7.5) |
| `src/content/gaveta-calendario.ts` | **Criar.** Conteúdo do calendário (spec, 7.2) |
| `src/content/gaveta-minerar.ts` | **Criar.** Critérios, alvo e a linha "Vai varrer" (spec, 7.2) |
| `src/content/progresso.ts` | **Criar.** O cartão que substitui o botão durante a varredura (spec, 7.9) |
| `src/core/ordenacao.ts` | **Criar.** Puro. Decide se a URL precisa de recarga para ordenar (spec, 7.6) |
| `src/content/pos-instagram.ts` | **Criar.** O pós-filtro de Instagram sobre os aprovados, depois do laço (spec, 6.4) |
| `src/content/estilo.ts` | **Modificar.** Acrescentar o CSS dos enxertos e das gavetas |
| `src/content/index.ts` | **Modificar.** Chamar o plantio, aposentar o painel flutuante, ligar o disparo |
| `src/manifest.config.ts` | **Modificar.** Sair o `web_accessible_resources` do painel aposentado |

---

## Task 1: Achar a barra e a fila onde a busca está

Módulo puro, testável em jsdom, que não toca em nada. É a fundação: se esta
tarefa errar, todas as outras plantam no lugar errado.

**Files:**
- Create: `src/content/barra.ts`
- Test: `tests/content/barra.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `acharBarraDeFiltros(doc: Document): HTMLElement | null`
  - `acharLinhaDaBusca(doc: Document): HTMLElement | null`
  - `type FormaDaBarra = 'linha' | 'coluna'`
  - `formaDaBarra(doc: Document): FormaDaBarra | null`

- [x] **Step 1: Escrever os testes que falham**

Criar `tests/content/barra.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  acharBarraDeFiltros,
  acharLinhaDaBusca,
  formaDaBarra,
} from '../../src/content/barra'

/** A forma de uma linha, medida em 1282 px: [país] [categoria] [busca]. */
function montarFormaLinha(): void {
  document.body.innerHTML = `
    <div id="ruido"><input type="radio"></div>
    <div id="barra" style="display:flex;flex-direction:row">
      <div id="pais"><div role="combobox">Brazil</div></div>
      <div id="categoria"><div role="combobox">All ads</div></div>
      <div id="envelope-busca"><div><input type="search"></div></div>
    </div>
  `
}

/** A forma de duas linhas, medida em 1036 px. */
function montarFormaColuna(): void {
  document.body.innerHTML = `
    <div id="barra" style="display:flex;flex-direction:column">
      <div id="linha-filtros" style="display:flex;flex-direction:row">
        <div><div role="combobox">Brazil</div></div>
        <div><div role="combobox">All ads</div></div>
      </div>
      <div id="linha-busca" style="display:flex;flex-direction:row">
        <div id="envelope-busca"><div><input type="search"></div></div>
      </div>
    </div>
  `
}

describe('acharBarraDeFiltros', () => {
  it('acha o ancestral mais próximo da busca que também tem combobox', () => {
    montarFormaLinha()
    expect(acharBarraDeFiltros(document)?.id).toBe('barra')
  })

  it('acha a barra também na forma de duas linhas', () => {
    montarFormaColuna()
    expect(acharBarraDeFiltros(document)?.id).toBe('barra')
  })

  it('devolve null sem busca na página, em vez de lançar', () => {
    document.body.innerHTML = '<div><div role="combobox">só isso</div></div>'
    expect(acharBarraDeFiltros(document)).toBeNull()
  })

  it('devolve null quando há busca mas nenhum combobox', () => {
    document.body.innerHTML = '<div><input type="search"></div>'
    expect(acharBarraDeFiltros(document)).toBeNull()
  })
})

describe('formaDaBarra', () => {
  it('reconhece a forma de uma linha', () => {
    montarFormaLinha()
    expect(formaDaBarra(document)).toBe('linha')
  })

  it('reconhece a forma de duas linhas', () => {
    montarFormaColuna()
    expect(formaDaBarra(document)).toBe('coluna')
  })

  it('devolve null quando não há barra', () => {
    document.body.innerHTML = ''
    expect(formaDaBarra(document)).toBeNull()
  })
})

describe('acharLinhaDaBusca', () => {
  it('na forma de uma linha, é a própria barra', () => {
    montarFormaLinha()
    expect(acharLinhaDaBusca(document)?.id).toBe('barra')
  })

  it('na forma de duas linhas, é a linha de baixo e não a barra', () => {
    montarFormaColuna()
    expect(acharLinhaDaBusca(document)?.id).toBe('linha-busca')
  })

  it('devolve null quando não há busca', () => {
    document.body.innerHTML = '<div role="combobox">nada</div>'
    expect(acharLinhaDaBusca(document)).toBeNull()
  })

  /**
   * Regressão medida contra a Meta real em 2026-09-10: a busca fica dentro de
   * wrappers que também são flex-row, com 20 px de altura. Uma regra que suba
   * procurando o primeiro flex-row cai num deles, e os botões vão parar dentro
   * da caixa de busca.
   */
  it('ignora os wrappers flex-row internos do campo de busca', () => {
    document.body.innerHTML = `
      <div id="barra" style="display:flex;flex-direction:row">
        <div><div role="combobox">Brazil</div></div>
        <div id="envelope-busca">
          <div id="wrapper-interno" style="display:flex;flex-direction:row">
            <input type="search">
          </div>
        </div>
      </div>
    `
    expect(acharLinhaDaBusca(document)?.id).toBe('barra')
  })
})
```

- [x] **Step 2: Rodar e confirmar que falham**

Run: `npx.cmd vitest run tests/content/barra.test.ts`

Expected: FAIL com `Failed to resolve import "../../src/content/barra"`.

- [x] **Step 3: Escrever a implementação**

Criar `src/content/barra.ts`:

```ts
/**
 * A barra de filtros da Meta, achada pelo que ela significa, não por onde
 * ela está.
 *
 * O levantamento de 2026-09-10 mediu: `input[type="search"]` é único na
 * página — 1 entre 253 `input`, todo o resto `type="radio"` —, os `id` são
 * gerados (`js_2`, `js_f`) e as classes são 32 a 51 strings ofuscadas por
 * controle. Sobra o tipo do campo, que é semântico.
 *
 * A profundidade medida foi de 17 níveis, e esse número não aparece aqui de
 * propósito: é exatamente o que quebra quando a Meta mexe no aninhamento.
 * Mesmo espírito de `acharCards` em `./anchor.ts`.
 */

/** Duas formas, decididas pela Meta em JS sobre `innerWidth`. */
export type FormaDaBarra = 'linha' | 'coluna'

function acharBusca(doc: Document): HTMLInputElement | null {
  return doc.querySelector('input[type="search"]')
}

/**
 * O ancestral mais próximo da busca que também contenha um combobox.
 *
 * Nunca lança e nunca devolve o `body`: sem âncora, o chamador degrada em
 * silêncio (spec, 7.7).
 */
export function acharBarraDeFiltros(doc: Document): HTMLElement | null {
  const busca = acharBusca(doc)
  if (!busca) return null

  let el = busca.parentElement
  while (el && el !== doc.body) {
    if (el.querySelector('[role="combobox"]')) return el
    el = el.parentElement
  }
  return null
}

export function formaDaBarra(doc: Document): FormaDaBarra | null {
  const barra = acharBarraDeFiltros(doc)
  if (!barra) return null
  const dir = doc.defaultView?.getComputedStyle(barra).flexDirection
  return dir === 'column' ? 'coluna' : 'linha'
}

/**
 * A fila onde os enxertos entram.
 *
 * **Não suba procurando o primeiro flex-row.** Essa regra foi escrita, testada
 * contra a Meta real em 2026-09-10, e falhou: ela devolve um wrapper interno
 * do próprio campo de busca, com 1246 px de largura e **20 px de altura**. Os
 * botões acabariam dentro da caixa de busca.
 *
 * A regra certa é mais simples. Na forma normal a barra já é a fila, e o
 * `append` cai depois da busca, que é o último controle dela. Só na forma de
 * coluna é preciso descer um nível, para o enxerto acompanhar a busca em vez
 * de virar uma terceira linha — decisão do dono do projeto em 2026-09-10.
 */
export function acharLinhaDaBusca(doc: Document): HTMLElement | null {
  const busca = acharBusca(doc)
  const barra = acharBarraDeFiltros(doc)
  if (!busca || !barra) return null

  if (formaDaBarra(doc) === 'linha') return barra

  for (const filho of Array.from(barra.children)) {
    if (filho.contains(busca)) return filho as HTMLElement
  }
  return barra
}
```

- [x] **Step 4: Rodar e confirmar que passam**

Run: `npx.cmd vitest run tests/content/barra.test.ts`

Expected: PASS, 10 testes.

- [x] **Step 5: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

Expected: tudo passa, nada quebrou.

- [x] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): achar a barra de filtros da Meta por sinal semântico

O que foi feito:
- Localizar a barra pelo ancestral mais próximo da busca que tenha combobox
- Distinguir as duas formas da barra e achar a fila onde a busca está

Como foi feito:
- A âncora é `input[type="search"]`, único na página entre 253 inputs
- Sem profundidade fixa e sem classe CSS, como em `anchor.ts`

Considerações:
- Os 17 níveis medidos ficaram fora do código de propósito: é o número que
  quebra quando a Meta mexe no aninhamento
- Sem âncora, devolve null em vez de lançar, para o chamador degradar em
  silêncio como a seção 7.7 do spec exige
```

E pare. Quem commita é o revisor.

---
## Task 2: Plantar os enxertos e mantê-los vivos

Um host único para os três botões, em shadow root, plantado na fila da busca.
Vive contra duas forças: a Meta reconstruindo o DOM, e o `resize` que troca a
forma da barra.

**Files:**
- Create: `src/content/enxertos.ts`
- Test: `tests/content/enxertos.test.ts`
- Modify: `src/content/estilo.ts` — acrescentar `CSS_ENXERTOS`

**Interfaces:**
- Consumes: `acharLinhaDaBusca` da Task 1; `criarShadow` de `./estilo`;
  `observarGrade` de `./observer`.
- Produces:
  - `interface Enxerto { chave: string; glifo: string; titulo: string; variante: 'contorno' | 'solido'; aoClicar: (botao: HTMLElement) => void }`
  - `plantarEnxertos(doc: Document, enxertos: Enxerto[]): Plantio`
  - `interface Plantio { parar(): void; hospedeiro(): HTMLElement | null }`
  - `const ID_ENXERTOS = 'copyhaunt-enxertos'`

- [x] **Step 1: Escrever os testes que falham**

Criar `tests/content/enxertos.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ID_ENXERTOS,
  plantarEnxertos,
  type Enxerto,
  type Plantio,
} from '../../src/content/enxertos'

let plantio: Plantio | null = null

afterEach(() => {
  plantio?.parar()
  plantio = null
  document.body.innerHTML = ''
})

function montarBarra(): void {
  document.body.innerHTML = `
    <div id="barra" style="display:flex;flex-direction:row">
      <div><div role="combobox">Brazil</div></div>
      <div id="envelope-busca"><input type="search"></div>
    </div>
  `
}

function doisEnxertos(aoClicar = () => {}): Enxerto[] {
  return [
    {
      chave: 'calendario',
      glifo: '📅',
      titulo: '7+ dias no ar',
      variante: 'contorno',
      aoClicar,
    },
    {
      chave: 'minerar',
      glifo: 'Minerar',
      titulo: 'Minerar',
      variante: 'solido',
      aoClicar,
    },
  ]
}

describe('plantarEnxertos', () => {
  it('planta o host dentro da fila da busca', () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    const host = document.getElementById(ID_ENXERTOS)
    expect(host).not.toBeNull()
    expect(host?.parentElement?.id).toBe('barra')
  })

  it('planta os botões pedidos dentro do shadow root', () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    const shadow = document.getElementById(ID_ENXERTOS)?.shadowRoot
    const botoes = shadow?.querySelectorAll('[data-chave]')
    expect(botoes?.length).toBe(2)
    expect(shadow?.querySelector('[data-chave="minerar"]')).not.toBeNull()
  })

  it('não duplica quando chamado duas vezes', () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())
    const segundo = plantarEnxertos(document, doisEnxertos())

    expect(document.querySelectorAll(`#${ID_ENXERTOS}`).length).toBe(1)
    segundo.parar()
  })

  it('chama aoClicar com o botão clicado', () => {
    montarBarra()
    const espiao = vi.fn()
    plantio = plantarEnxertos(document, doisEnxertos(espiao))

    const shadow = document.getElementById(ID_ENXERTOS)?.shadowRoot
    const botao = shadow?.querySelector<HTMLElement>('[data-chave="minerar"]')
    botao?.click()

    expect(espiao).toHaveBeenCalledTimes(1)
    expect(espiao.mock.calls[0][0]).toBe(botao)
  })

  it('degrada em silêncio quando não há âncora', () => {
    document.body.innerHTML = '<div>sem busca, sem combobox</div>'
    expect(() => {
      plantio = plantarEnxertos(document, doisEnxertos())
    }).not.toThrow()
    expect(document.getElementById(ID_ENXERTOS)).toBeNull()
  })

  it('replanta quando a Meta remove o host', async () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    document.getElementById(ID_ENXERTOS)?.remove()
    expect(document.getElementById(ID_ENXERTOS)).toBeNull()

    await vi.waitFor(() => {
      expect(document.getElementById(ID_ENXERTOS)).not.toBeNull()
    })
  })

  it('replanta quando a Meta troca a barra inteira', async () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())

    // É o que acontece numa busca nova: nó do input trocado, barra refeita.
    montarBarra()

    await vi.waitFor(() => {
      const host = document.getElementById(ID_ENXERTOS)
      expect(host).not.toBeNull()
      expect(host?.parentElement?.id).toBe('barra')
    })
  })

  it('parar desliga o replantio', async () => {
    montarBarra()
    plantio = plantarEnxertos(document, doisEnxertos())
    plantio.parar()
    plantio = null

    document.getElementById(ID_ENXERTOS)?.remove()

    // Sem esperar por tempo: forçar uma mutação e conferir que segue ausente.
    document.body.appendChild(document.createElement('div'))
    await Promise.resolve()
    expect(document.getElementById(ID_ENXERTOS)).toBeNull()
  })
})
```

- [x] **Step 2: Rodar e confirmar que falham**

Run: `npx.cmd vitest run tests/content/enxertos.test.ts`

Expected: FAIL com `Failed to resolve import "../../src/content/enxertos"`.

- [x] **Step 3: Acrescentar o CSS dos enxertos**

Em `src/content/estilo.ts`, acrescentar ao fim do arquivo, antes de
`criarShadow`:

```ts
/**
 * Estilo dos enxertos na barra da Meta.
 *
 * Cores de `CopyHaunt-IDV.md`. A altura de 36 px é a dos controles da Meta,
 * medida em 2026-09-10 — nada aqui pode mudar a altura da fila, ou a barra
 * inteira se desloca.
 */
export const CSS_ENXERTOS = `
  /* Escopado ao host dos enxertos de propósito. Esta folha é compartilhada
     com as bandejas dos cards, cujo host é um div sem estilo próprio que
     conta com o \`all: initial\` de CSS_BANDEJA para não ocupar espaço. Um
     \`:host\` solto aqui venceria aquele por vir depois, daria \`display:flex\`
     ao host da bandeja e empurraria o conteúdo de todo card para baixo. */
  :host(#copyhaunt-enxertos) { all: initial; display: flex; align-items: center; }

  .fila {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: 8px;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  /* O divisor separa o nosso do da Meta: dois enxertos avulsos viram um
     produto quando têm uma fronteira visível (spec, 7.1). */
  .divisor {
    width: 1px;
    height: 24px;
    background: rgba(124, 58, 237, 0.28);
    margin-right: 2px;
  }

  .botao {
    height: 36px;
    padding: 0 14px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
    transition: filter 150ms ease;
  }
  .botao:hover { filter: brightness(1.12); }

  .botao[data-variante="solido"] {
    background: #7C3AED;
    color: #FFFFFF;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.18);
  }
  .botao[data-variante="contorno"] {
    background: transparent;
    color: #7C3AED;
    box-shadow: inset 0 0 0 1.5px #7C3AED;
  }
  .botao[data-aberto] { filter: brightness(1.2); }
`
```

E, dentro de `criarShadow`, trocar a folha aplicada para incluir as duas: onde
hoje está `style.textContent = CSS_BANDEJA`, passar a
`style.textContent = CSS_BANDEJA + CSS_ENXERTOS`. Faça o mesmo na função
`folhaCompartilhada`, que monta a folha adotável — as duas precisam do mesmo
conteúdo, senão o navegador com `adoptedStyleSheets` vê um CSS e o sem vê
outro.

- [x] **Step 4: Escrever a implementação**

Criar `src/content/enxertos.ts`:

```ts
import { acharLinhaDaBusca } from './barra'
import { criarShadow } from './estilo'
import { observarGrade, type Observacao } from './observer'

/**
 * Os enxertos na barra da Meta.
 *
 * Um host só para os três botões, e não um host por botão: a gaveta precisa
 * de um ponto de ancoragem estável, e três hosts irmãos dariam três.
 *
 * A disciplina de replantio é a mesma da bandeja (`./observer.ts`), pelo
 * mesmo motivo: a Meta reconstrói o DOM sem avisar. Mas há uma diferença
 * medida em 2026-09-10 que vale registrar — a barra **não** é reciclada pela
 * rolagem, ao contrário dos cards. Ela é refeita ao trocar de busca, e a
 * forma dela muda no `resize`.
 */

export const ID_ENXERTOS = 'copyhaunt-enxertos'

export interface Enxerto {
  chave: string
  /** O que aparece no botão. Texto ou glifo. */
  glifo: string
  titulo: string
  /** Papel visual: o calendário é secundário, Minerar é a ação (spec, 7.1). */
  variante: 'contorno' | 'solido'
  aoClicar: (botao: HTMLElement) => void
}

export interface Plantio {
  parar(): void
  /** O host atual, ou null se não houver âncora agora. */
  hospedeiro(): HTMLElement | null
}

function montarHost(doc: Document, enxertos: Enxerto[]): HTMLElement {
  const host = doc.createElement('div')
  host.id = ID_ENXERTOS

  const shadow = criarShadow(host)
  const fila = doc.createElement('div')
  fila.className = 'fila'

  const divisor = doc.createElement('div')
  divisor.className = 'divisor'
  fila.appendChild(divisor)

  for (const e of enxertos) {
    const botao = doc.createElement('div')
    botao.className = 'botao'
    botao.dataset.chave = e.chave
    botao.dataset.variante = e.variante
    botao.title = e.titulo
    botao.textContent = e.glifo
    botao.addEventListener('click', (ev) => {
      // A barra da Meta tem os seus próprios listeners; sem isto, clicar no
      // nosso botão também mexe no que está atrás.
      ev.stopPropagation()
      e.aoClicar(botao)
    })
    fila.appendChild(botao)
  }

  shadow.appendChild(fila)
  return host
}

/**
 * Planta os enxertos e os mantém plantados.
 *
 * Idempotente: com o host já no lugar certo, não faz nada. Sem âncora, não
 * faz nada e não reclama — spec, 7.7.
 */
export function plantarEnxertos(
  doc: Document,
  enxertos: Enxerto[],
): Plantio {
  let observacao: Observacao | null = null
  let parado = false

  const plantar = (): void => {
    if (parado) return

    const linha = acharLinhaDaBusca(doc)
    if (!linha) return

    const existente = doc.getElementById(ID_ENXERTOS)
    if (existente?.parentElement === linha) return

    // Host órfão de um plantio anterior, numa barra que a Meta já descartou.
    existente?.remove()
    linha.appendChild(montarHost(doc, enxertos))
  }

  plantar()

  // O `body` sobrevive a tudo; a barra, não. Mesmo motivo documentado em
  // `garantirObservador` no content script.
  observacao = observarGrade(doc.body, plantar, 150)
  doc.defaultView?.addEventListener('resize', plantar)

  return {
    parar() {
      parado = true
      observacao?.parar()
      doc.defaultView?.removeEventListener('resize', plantar)
      doc.getElementById(ID_ENXERTOS)?.remove()
    },
    hospedeiro: () => doc.getElementById(ID_ENXERTOS),
  }
}
```

- [x] **Step 5: Rodar e confirmar que passam**

Run: `npx.cmd vitest run tests/content/enxertos.test.ts`

Expected: PASS, 8 testes.

Se `replanta quando a Meta troca a barra inteira` falhar por tempo, **não
aumente espera nenhuma**: confirme que `observarGrade` está observando
`doc.body` e não a barra. Um observador preso na barra antiga não dispara —
foi esse exato erro que o comentário de `garantirObservador` registra.

- [x] **Step 6: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

Expected: tudo passa.

- [x] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): plantar os enxertos da CopyHaunt na barra da Meta

O que foi feito:
- Plantar um host em shadow root na fila da busca, com os botões pedidos
- Replantar quando a Meta refaz a barra, e reposicionar no resize

Como foi feito:
- Host único para os três botões, para a gaveta ter uma âncora só
- Observador no body, não na barra: observador preso na barra antiga não
  dispara depois que ela é trocada

Considerações:
- A barra não é reciclada pela rolagem, ao contrário dos cards; ela é refeita
  ao trocar de busca e muda de forma no resize
- Sem âncora, nada é plantado e nada é lançado, como a seção 7.7 exige
```

E pare. Quem commita é o revisor.

---
## Task 3: A mecânica das gavetas

Só uma gaveta aberta por vez (spec, 7.1). Esta tarefa entrega a mecânica vazia;
as três seguintes só fornecem conteúdo.

**Files:**
- Create: `src/content/gaveta.ts`
- Test: `tests/content/gaveta.test.ts`
- Modify: `src/content/estilo.ts` — acrescentar `CSS_GAVETA` ao mesmo bloco de
  `CSS_ENXERTOS`, e incluí-lo nas duas montagens de folha.

**Interfaces:**
- Consumes: nada além do DOM.
- Produces:
  - `abrirGaveta(shadow: ShadowRoot, botao: HTMLElement, conteudo: HTMLElement): void`
  - `fecharGaveta(shadow: ShadowRoot): void`
  - `gavetaAberta(shadow: ShadowRoot): string | null` — a `chave` do botão dono
  - `alternarGaveta(shadow: ShadowRoot, botao: HTMLElement, montar: () => HTMLElement): void`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/content/gaveta.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  abrirGaveta,
  alternarGaveta,
  fecharGaveta,
  gavetaAberta,
} from '../../src/content/gaveta'

let shadow: ShadowRoot
let botaoA: HTMLElement
let botaoB: HTMLElement

beforeEach(() => {
  document.body.innerHTML = '<div id="host"></div>'
  const host = document.getElementById('host') as HTMLElement
  shadow = host.attachShadow({ mode: 'open' })

  botaoA = document.createElement('div')
  botaoA.dataset.chave = 'calendario'
  botaoB = document.createElement('div')
  botaoB.dataset.chave = 'minerar'
  shadow.append(botaoA, botaoB)
})

function conteudo(texto: string): HTMLElement {
  const div = document.createElement('div')
  div.textContent = texto
  return div
}

describe('gaveta', () => {
  it('não há gaveta aberta no começo', () => {
    expect(gavetaAberta(shadow)).toBeNull()
  })

  it('abrir mostra o conteúdo e registra o dono', () => {
    abrirGaveta(shadow, botaoA, conteudo('faixa de dias'))

    expect(gavetaAberta(shadow)).toBe('calendario')
    expect(shadow.querySelector('.gaveta')?.textContent).toContain(
      'faixa de dias',
    )
  })

  it('marca o botão dono como aberto', () => {
    abrirGaveta(shadow, botaoA, conteudo('x'))
    expect(botaoA.dataset.aberto).toBe('1')
  })

  it('abrir a segunda fecha a primeira: só uma por vez', () => {
    abrirGaveta(shadow, botaoA, conteudo('primeira'))
    abrirGaveta(shadow, botaoB, conteudo('segunda'))

    expect(gavetaAberta(shadow)).toBe('minerar')
    expect(shadow.querySelectorAll('.gaveta').length).toBe(1)
    expect(shadow.querySelector('.gaveta')?.textContent).toContain('segunda')
    expect(botaoA.dataset.aberto).toBeUndefined()
  })

  it('fechar remove a gaveta e a marca do botão', () => {
    abrirGaveta(shadow, botaoA, conteudo('x'))
    fecharGaveta(shadow)

    expect(gavetaAberta(shadow)).toBeNull()
    expect(shadow.querySelector('.gaveta')).toBeNull()
    expect(botaoA.dataset.aberto).toBeUndefined()
  })

  it('fechar sem nada aberto não quebra', () => {
    expect(() => fecharGaveta(shadow)).not.toThrow()
  })

  it('alternar abre quando fechada e fecha quando é a mesma', () => {
    alternarGaveta(shadow, botaoA, () => conteudo('x'))
    expect(gavetaAberta(shadow)).toBe('calendario')

    alternarGaveta(shadow, botaoA, () => conteudo('x'))
    expect(gavetaAberta(shadow)).toBeNull()
  })

  it('alternar troca quando o dono é outro', () => {
    alternarGaveta(shadow, botaoA, () => conteudo('a'))
    alternarGaveta(shadow, botaoB, () => conteudo('b'))
    expect(gavetaAberta(shadow)).toBe('minerar')
  })

  it('monta o conteúdo só quando abre, não a cada alternância', () => {
    let montagens = 0
    const montar = () => {
      montagens += 1
      return conteudo('x')
    }

    alternarGaveta(shadow, botaoA, montar)
    alternarGaveta(shadow, botaoA, montar)

    expect(montagens).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx.cmd vitest run tests/content/gaveta.test.ts`

Expected: FAIL com `Failed to resolve import "../../src/content/gaveta"`.

- [ ] **Step 3: Acrescentar o CSS da gaveta**

Em `src/content/estilo.ts`, acrescentar junto de `CSS_ENXERTOS`:

```ts
/** A gaveta que se abre sob os enxertos. Uma por vez (spec, 7.1). */
export const CSS_GAVETA = `
  .gaveta {
    position: absolute;
    top: 44px;
    right: 0;
    min-width: 300px;
    padding: 16px;
    border-radius: 14px;
    background: #08070D;
    color: #FFFFFF;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.25);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    z-index: 2147483647;
  }

  .gaveta h3 {
    margin: 0 0 10px;
    font-family: Sora, Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 14px;
    font-weight: 600;
  }

  .gaveta .linha {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
  }

  .gaveta .nota {
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    color: #C4A7FF;
    font-size: 12px;
  }

  .gaveta .acao {
    width: 100%;
    margin-top: 12px;
    height: 38px;
    border: 0;
    border-radius: 10px;
    background: #7C3AED;
    color: #FFFFFF;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .gaveta .acao:hover { filter: brightness(1.12); }
`
```

E inclua `CSS_GAVETA` nas duas montagens de folha, ao lado de `CSS_BANDEJA` e
`CSS_ENXERTOS`. O host dos enxertos precisa de `position: relative` para a
gaveta se posicionar por ele — acrescente `position: relative` à regra
`:host(#copyhaunt-enxertos)` de `CSS_ENXERTOS`, **mantendo o escopo**:

```
  :host(#copyhaunt-enxertos) {
    all: initial;
    display: flex;
    align-items: center;
    position: relative;
  }
```

**Nunca troque isso por um `:host` sem escopo.** A folha é compartilhada com
as bandejas dos cards, e um `:host` solto aqui daria `display: flex` ao host
delas, empurrando o conteúdo de todo card para baixo. `tests/content/enxertos.test.ts`
trava esse caminho.

- [ ] **Step 4: Escrever a implementação**

Criar `src/content/gaveta.ts`:

```ts
/**
 * A mecânica das gavetas dos enxertos.
 *
 * Uma aberta por vez (spec, 7.1). Este módulo não sabe o que vai dentro:
 * recebe um elemento pronto e cuida de mostrar, trocar e esconder.
 *
 * Tudo acontece dentro do shadow root dos enxertos, então nada aqui pode
 * vazar para o DOM da Meta nem sofrer o CSS dela.
 */

const CLASSE = 'gaveta'
const ATRIBUTO_DONO = 'data-dono'

/** A `chave` do botão dono da gaveta aberta, ou null. */
export function gavetaAberta(shadow: ShadowRoot): string | null {
  const g = shadow.querySelector(`.${CLASSE}`)
  return g?.getAttribute(ATRIBUTO_DONO) ?? null
}

export function fecharGaveta(shadow: ShadowRoot): void {
  const g = shadow.querySelector(`.${CLASSE}`)
  if (!g) return

  const dono = g.getAttribute(ATRIBUTO_DONO)
  if (dono) {
    const botao = shadow.querySelector<HTMLElement>(`[data-chave="${dono}"]`)
    delete botao?.dataset.aberto
  }
  g.remove()
}

export function abrirGaveta(
  shadow: ShadowRoot,
  botao: HTMLElement,
  conteudo: HTMLElement,
): void {
  // Fechar antes de abrir é o que garante "uma por vez" sem cada chamador
  // ter de lembrar disso.
  fecharGaveta(shadow)

  const chave = botao.dataset.chave ?? ''
  const g = document.createElement('div')
  g.className = CLASSE
  g.setAttribute(ATRIBUTO_DONO, chave)
  // Clique dentro da gaveta não pode fechar a gaveta nem chegar à Meta.
  g.addEventListener('click', (ev) => ev.stopPropagation())
  g.appendChild(conteudo)

  shadow.appendChild(g)
  botao.dataset.aberto = '1'
}

/**
 * O gesto do botão: abre, ou fecha se já for a dele.
 *
 * `montar` só é chamado quando a gaveta vai de fato abrir. Montar para
 * depois descartar seria construir DOM à toa a cada segundo clique.
 */
export function alternarGaveta(
  shadow: ShadowRoot,
  botao: HTMLElement,
  montar: () => HTMLElement,
): void {
  const chave = botao.dataset.chave ?? ''
  if (gavetaAberta(shadow) === chave) {
    fecharGaveta(shadow)
    return
  }
  abrirGaveta(shadow, botao, montar())
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npx.cmd vitest run tests/content/gaveta.test.ts`

Expected: PASS, 9 testes.

- [ ] **Step 6: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

Expected: tudo passa.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): abrir uma gaveta por vez sob os enxertos

Como foi feito:
- Fechar antes de abrir, para "uma por vez" não depender de cada chamador
- O conteúdo só é montado quando a gaveta abre de fato
```

E pare. Quem commita é o revisor.

---

## Task 4: A gaveta de exemplos, no `?`

O menor dos três conteúdos, e o primeiro a provar a mecânica inteira ligada a
um enxerto real. Clicar num exemplo escreve na busca da Meta.

**Files:**
- Create: `src/content/gaveta-exemplos.ts`
- Test: `tests/content/gaveta-exemplos.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `const EXEMPLOS: ReadonlyArray<{ termo: string; explica: string }>`
  - `montarExemplos(doc: Document, aoEscolher: (termo: string) => void): HTMLElement`
  - `escreverNaBusca(doc: Document, termo: string): boolean`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/content/gaveta-exemplos.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  EXEMPLOS,
  escreverNaBusca,
  montarExemplos,
} from '../../src/content/gaveta-exemplos'

describe('EXEMPLOS', () => {
  it('traz os cinco exemplos da seção 7.5 do spec', () => {
    expect(EXEMPLOS.length).toBe(5)
    expect(EXEMPLOS.map((e) => e.termo)).toEqual([
      'receitas',
      'receitas api.whatsapp.com',
      '"receita de bolo"',
      'hotmart.com',
      'emagrecimento kiwify.com',
    ])
  })

  it('nenhum exemplo usa operador, que a medição mostrou zerar a busca', () => {
    for (const e of EXEMPLOS) {
      expect(e.termo).not.toMatch(/\b(and|or)\b/i)
    }
  })
})

describe('montarExemplos', () => {
  it('lista um item por exemplo, com termo e explicação', () => {
    const el = montarExemplos(document, () => {})
    const itens = el.querySelectorAll('[data-termo]')

    expect(itens.length).toBe(5)
    expect(el.textContent).toContain('anúncios sobre receitas')
  })

  it('clicar num item devolve o termo daquele item', () => {
    const espiao = vi.fn()
    const el = montarExemplos(document, espiao)

    el.querySelector<HTMLElement>('[data-termo="hotmart.com"]')?.click()

    expect(espiao).toHaveBeenCalledWith('hotmart.com')
  })
})

describe('escreverNaBusca', () => {
  it('escreve o termo no campo da Meta e devolve true', () => {
    document.body.innerHTML = '<input type="search">'
    const campo = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )

    expect(escreverNaBusca(document, 'hotmart.com')).toBe(true)
    expect(campo?.value).toBe('hotmart.com')
  })

  it('dispara o evento input, sem o qual o React da Meta ignora', () => {
    document.body.innerHTML = '<input type="search">'
    const campo = document.querySelector<HTMLInputElement>(
      'input[type="search"]',
    )
    const espiao = vi.fn()
    campo?.addEventListener('input', espiao)

    escreverNaBusca(document, 'x')

    expect(espiao).toHaveBeenCalledTimes(1)
  })

  it('devolve false sem campo de busca, em vez de lançar', () => {
    document.body.innerHTML = ''
    expect(escreverNaBusca(document, 'x')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx.cmd vitest run tests/content/gaveta-exemplos.test.ts`

Expected: FAIL com `Failed to resolve import`.

- [ ] **Step 3: Escrever a implementação**

Criar `src/content/gaveta-exemplos.ts`:

```ts
/**
 * A gaveta do `?`: exemplos, sem regras nem jargão (spec, 7.5).
 *
 * **Não há aviso de operadores.** Detectar `and`/`or` e alertar foi proposto
 * e recusado em 2026-09-10: os exemplos ensinam o padrão certo, e um alerta a
 * mais pesa contra quem só quer buscar. A medição fica registrada para o caso
 * de a decisão precisar ser revista — `receitas and api.whatsapp.com` devolve
 * 0 resultados contra ~9.700 sem o `and`.
 */

export const EXEMPLOS = [
  { termo: 'receitas', explica: 'anúncios sobre receitas' },
  {
    termo: 'receitas api.whatsapp.com',
    explica: 'receitas que vendem por WhatsApp',
  },
  { termo: '"receita de bolo"', explica: 'a frase exata, nessa ordem' },
  { termo: 'hotmart.com', explica: 'anúncios que levam para a Hotmart' },
  {
    termo: 'emagrecimento kiwify.com',
    explica: 'emagrecimento vendido pela Kiwify',
  },
] as const

export function montarExemplos(
  doc: Document,
  aoEscolher: (termo: string) => void,
): HTMLElement {
  const raiz = doc.createElement('div')

  const titulo = doc.createElement('h3')
  titulo.textContent = 'Exemplos de busca'
  raiz.appendChild(titulo)

  for (const e of EXEMPLOS) {
    const linha = doc.createElement('div')
    linha.className = 'linha'
    linha.dataset.termo = e.termo
    linha.style.cursor = 'pointer'

    const termo = doc.createElement('strong')
    termo.textContent = e.termo

    const explica = doc.createElement('span')
    explica.textContent = e.explica
    explica.style.color = '#C4A7FF'

    linha.append(termo, explica)
    linha.addEventListener('click', () => aoEscolher(e.termo))
    raiz.appendChild(linha)
  }

  return raiz
}

/**
 * Escreve o termo no campo de busca da Meta.
 *
 * O `value` é escrito pelo setter do protótipo, e não pela propriedade: o
 * React guarda o valor anterior no nó e ignora uma atribuição direta, então
 * o campo mostraria o texto e o estado interno dele continuaria vazio.
 *
 * O campo é buscado agora, nunca guardado: a Meta troca esse nó a cada busca
 * nova — medido em 2026-09-10.
 */
export function escreverNaBusca(doc: Document, termo: string): boolean {
  const campo = doc.querySelector<HTMLInputElement>('input[type="search"]')
  if (!campo) return false

  const janela = doc.defaultView
  const setter = janela
    ? Object.getOwnPropertyDescriptor(
        janela.HTMLInputElement.prototype,
        'value',
      )?.set
    : undefined

  if (setter) setter.call(campo, termo)
  else campo.value = termo

  campo.dispatchEvent(new Event('input', { bubbles: true }))
  campo.focus()
  return true
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx.cmd vitest run tests/content/gaveta-exemplos.test.ts`

Expected: PASS, 7 testes.

- [ ] **Step 5: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

Expected: tudo passa.

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): oferecer exemplos de busca na gaveta do ponto de interrogação

Como foi feito:
- O valor entra pelo setter do protótipo do input, senão o React da Meta
  guarda o valor antigo e ignora o texto escrito

Considerações:
- Sem aviso de operadores, por decisão de 2026-09-10: os exemplos ensinam o
  padrão e um alerta a mais pesa contra quem só quer buscar
```

E pare. Quem commita é o revisor.

---
## Task 5: O calendário — a faixa de tempo ativo

O único enxerto que reescreve a URL (spec, 7.2). A aritmética da faixa já
existe em `src/core/dateFilter.ts`; esta tarefa acrescenta as duas funções que
faltam — o rótulo e a leitura de volta — e desenha a gaveta.

**Files:**
- Modify: `src/core/dateFilter.ts` — acrescentar `rotuloDaFaixa` e `lerFaixaDaUrl`
- Create: `src/content/gaveta-calendario.ts`
- Test: `tests/core/dateFilter.test.ts` — acrescentar aos testes existentes
- Test: `tests/content/gaveta-calendario.test.ts`

**Interfaces:**
- Consumes: `FaixaDias`, `PRESETS`, `montarUrlFiltro` de `src/core/dateFilter`.
- Produces:
  - `rotuloDaFaixa(faixa: FaixaDias): string`
  - `lerFaixaDaUrl(url: string, agora: Date): FaixaDias`
  - `montarCalendario(doc: Document, inicial: FaixaDias, aoAplicar: (f: FaixaDias) => void): HTMLElement`

- [ ] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/core/dateFilter.test.ts`:

```ts
import { lerFaixaDaUrl, rotuloDaFaixa } from '../../src/core/dateFilter'

describe('rotuloDaFaixa', () => {
  it('só mínimo vira "7+ dias no ar"', () => {
    expect(rotuloDaFaixa({ diasMin: 7, diasMax: null })).toBe('7+ dias no ar')
  })

  it('faixa fechada vira "7–30 dias no ar", com travessão', () => {
    expect(rotuloDaFaixa({ diasMin: 7, diasMax: 30 })).toBe(
      '7–30 dias no ar',
    )
  })

  it('só máximo vira "até 30 dias no ar"', () => {
    expect(rotuloDaFaixa({ diasMin: null, diasMax: 30 })).toBe(
      'até 30 dias no ar',
    )
  })

  it('faixa vazia vira "Tempo ativo"', () => {
    expect(rotuloDaFaixa({ diasMin: null, diasMax: null })).toBe('Tempo ativo')
  })
})

describe('lerFaixaDaUrl', () => {
  const agora = new Date('2026-09-10T12:00:00Z')

  it('lê de volta o que montarUrlFiltro escreveu', () => {
    const url = montarUrlFiltro(
      'https://www.facebook.com/ads/library/?q=x',
      { diasMin: 7, diasMax: 30 },
      agora,
    )
    expect(lerFaixaDaUrl(url, agora)).toEqual({ diasMin: 7, diasMax: 30 })
  })

  it('lê a faixa aberta de um lado só', () => {
    const url = montarUrlFiltro(
      'https://www.facebook.com/ads/library/?q=x',
      { diasMin: 14, diasMax: null },
      agora,
    )
    expect(lerFaixaDaUrl(url, agora)).toEqual({ diasMin: 14, diasMax: null })
  })

  it('URL sem filtro devolve faixa vazia', () => {
    expect(
      lerFaixaDaUrl('https://www.facebook.com/ads/library/?q=x', agora),
    ).toEqual({ diasMin: null, diasMax: null })
  })

  it('data ilegível vira null em vez de NaN', () => {
    expect(
      lerFaixaDaUrl(
        'https://www.facebook.com/ads/library/?start_date[max]=ontem',
        agora,
      ),
    ).toEqual({ diasMin: null, diasMax: null })
  })
})
```

Criar `tests/content/gaveta-calendario.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { montarCalendario } from '../../src/content/gaveta-calendario'

const VAZIA = { diasMin: null, diasMax: null }

describe('montarCalendario', () => {
  it('oferece os cinco atalhos da seção 7.2', () => {
    const el = montarCalendario(document, VAZIA, () => {})
    const atalhos = [...el.querySelectorAll('[data-preset]')].map(
      (a) => a.textContent,
    )
    expect(atalhos).toEqual(['3+', '5+', '14+', '30+', '60+'])
  })

  it('parte dos valores recebidos', () => {
    const el = montarCalendario(document, { diasMin: 7, diasMax: 30 }, () => {})
    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')

    expect(min?.value).toBe('7')
    expect(max?.value).toBe('30')
  })

  it('um atalho move o mínimo e não mexe no máximo', () => {
    const el = montarCalendario(document, { diasMin: 3, diasMax: 30 }, () => {})
    el.querySelector<HTMLElement>('[data-preset="14"]')?.click()

    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')

    expect(min?.value).toBe('14')
    expect(max?.value).toBe('30')
  })

  it('aplicar entrega a faixa digitada', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, VAZIA, espiao)

    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    if (min) min.value = '5'

    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({ diasMin: 5, diasMax: null })
  })

  it('campo vazio vira null, não zero', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, { diasMin: 7, diasMax: 30 }, espiao)

    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')
    if (max) max.value = ''

    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({ diasMin: 7, diasMax: null })
  })

  it('faixa invertida não aplica e avisa na própria gaveta', () => {
    const espiao = vi.fn()
    const el = montarCalendario(document, VAZIA, espiao)

    const min = el.querySelector<HTMLInputElement>('[data-campo="diasMin"]')
    const max = el.querySelector<HTMLInputElement>('[data-campo="diasMax"]')
    if (min) min.value = '30'
    if (max) max.value = '7'

    el.querySelector<HTMLElement>('[data-acao="aplicar"]')?.click()

    expect(espiao).not.toHaveBeenCalled()
    expect(el.textContent).toContain('mínimo não pode ser maior')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

```
npx.cmd vitest run tests/core/dateFilter.test.ts tests/content/gaveta-calendario.test.ts
```

Expected: FAIL — `rotuloDaFaixa is not a function` e o import da gaveta sem
resolver.

- [ ] **Step 3: Acrescentar as duas funções puras**

Em `src/core/dateFilter.ts`, ao fim do arquivo:

```ts
/**
 * O rótulo do botão, que mostra o filtro em vigor (spec, 7.2).
 *
 * O travessão de `7–30` é `en dash`, não hífen: é intervalo, e a tipografia
 * de `CopyHaunt-IDV.md` pede o traço de intervalo.
 */
export function rotuloDaFaixa(faixa: FaixaDias): string {
  const { diasMin, diasMax } = faixa

  if (diasMin !== null && diasMax !== null) {
    return `${diasMin}–${diasMax} dias no ar`
  }
  if (diasMin !== null) return `${diasMin}+ dias no ar`
  if (diasMax !== null) return `até ${diasMax} dias no ar`
  return 'Tempo ativo'
}

/**
 * A faixa que a URL em vigor representa — o inverso de `montarUrlFiltro`.
 *
 * Sem isto o botão mente depois de qualquer recarga: a URL carrega o filtro,
 * e a gaveta abriria em branco. A inversão é a mesma da ida, e pelo mesmo
 * motivo: `start_date[max]` guarda o mínimo de dias no ar.
 */
export function lerFaixaDaUrl(url: string, agora: Date): FaixaDias {
  const p = new URL(url).searchParams
  return {
    diasMin: diasDesde(p.get('start_date[max]'), agora),
    diasMax: diasDesde(p.get('start_date[min]'), agora),
  }
}

function diasDesde(iso: string | null, agora: Date): number | null {
  if (!iso) return null

  const quando = new Date(`${iso}T00:00:00Z`).getTime()
  if (Number.isNaN(quando)) return null

  const dias = Math.round((agora.getTime() - quando) / UM_DIA)
  return dias >= 1 ? dias : null
}
```

- [ ] **Step 4: Escrever a gaveta**

Criar `src/content/gaveta-calendario.ts`:

```ts
import { PRESETS, type FaixaDias } from '../core/dateFilter'

/**
 * A gaveta do calendário: o tempo ativo, que é o filtro que a Meta não
 * oferece direito (spec, 7.2).
 *
 * Dois campos e cinco atalhos. O slider desenhado no spec fica para quando
 * houver queixa dos campos: dois números fazem o mesmo trabalho, e um slider
 * de faixa com dois pontos é bem mais código do que este arquivo inteiro.
 *
 * ponytail: dois campos numéricos no lugar do slider de faixa do spec. Se o
 * ajuste fino incomodar, o slider entra sem mudar a interface deste módulo.
 */
export function montarCalendario(
  doc: Document,
  inicial: FaixaDias,
  aoAplicar: (faixa: FaixaDias) => void,
): HTMLElement {
  const raiz = doc.createElement('div')

  const titulo = doc.createElement('h3')
  titulo.textContent = 'Tempo ativo'
  raiz.appendChild(titulo)

  const atalhos = doc.createElement('div')
  atalhos.className = 'linha'
  raiz.appendChild(atalhos)

  const campoMin = campoNumero(doc, 'diasMin', inicial.diasMin)
  const campoMax = campoNumero(doc, 'diasMax', inicial.diasMax)

  for (const p of PRESETS) {
    const atalho = doc.createElement('span')
    atalho.dataset.preset = String(p)
    atalho.textContent = `${p}+`
    atalho.style.cssText =
      'cursor:pointer;padding:4px 10px;border-radius:8px;' +
      'box-shadow:inset 0 0 0 1px rgba(196,167,255,0.4)'
    // O atalho move só o mínimo (spec, 7.2): quem já apertou uma faixa não
    // quer perder o outro lado ao clicar num número.
    atalho.addEventListener('click', () => {
      campoMin.value = String(p)
    })
    atalhos.appendChild(atalho)
  }

  raiz.appendChild(linhaRotulada(doc, 'No ar há pelo menos', campoMin))
  raiz.appendChild(linhaRotulada(doc, 'No ar há no máximo', campoMax))

  const aviso = doc.createElement('div')
  aviso.className = 'nota'
  aviso.hidden = true
  raiz.appendChild(aviso)

  const aplicar = doc.createElement('button')
  aplicar.className = 'acao'
  aplicar.dataset.acao = 'aplicar'
  aplicar.textContent = 'Aplicar na página'
  aplicar.addEventListener('click', () => {
    const faixa = {
      diasMin: lerCampo(campoMin),
      diasMax: lerCampo(campoMax),
    }

    if (
      faixa.diasMin !== null &&
      faixa.diasMax !== null &&
      faixa.diasMin > faixa.diasMax
    ) {
      // Faixa invertida devolveria interseção vazia, e a Biblioteca abriria
      // sem resultado nenhum — parece defeito nosso.
      aviso.hidden = false
      aviso.textContent = 'O mínimo não pode ser maior que o máximo.'
      return
    }

    aviso.hidden = true
    aoAplicar(faixa)
  })
  raiz.appendChild(aplicar)

  return raiz
}

function campoNumero(
  doc: Document,
  campo: string,
  valor: number | null,
): HTMLInputElement {
  const el = doc.createElement('input')
  el.type = 'number'
  el.min = '1'
  el.max = '365'
  el.dataset.campo = campo
  el.value = valor === null ? '' : String(valor)
  el.style.cssText =
    'width:80px;padding:6px 8px;border-radius:8px;border:0;' +
    'background:#1A1622;color:#FFF;font:inherit'
  return el
}

function linhaRotulada(
  doc: Document,
  texto: string,
  campo: HTMLElement,
): HTMLElement {
  const linha = doc.createElement('div')
  linha.className = 'linha'

  const rotulo = doc.createElement('span')
  rotulo.textContent = texto

  linha.append(rotulo, campo)
  return linha
}

/** Campo vazio é critério desligado, e desligado é `null` — nunca zero. */
function lerCampo(el: HTMLInputElement): number | null {
  const bruto = el.value.trim()
  if (bruto === '') return null

  const n = Number(bruto)
  return Number.isInteger(n) && n >= 1 && n <= 365 ? n : null
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

```
npx.cmd vitest run tests/core/dateFilter.test.ts tests/content/gaveta-calendario.test.ts
```

Expected: PASS — 8 novos em `dateFilter`, 6 na gaveta.

- [ ] **Step 6: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

Expected: tudo passa.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): oferecer o tempo ativo na gaveta do calendário

O que foi feito:
- Acrescentar o rótulo da faixa e a leitura da faixa de volta pela URL
- Desenhar a gaveta com dois campos, cinco atalhos e o aplicar

Como foi feito:
- `lerFaixaDaUrl` inverte `montarUrlFiltro`, para o botão não mentir depois
  de uma recarga
- Faixa invertida é barrada na gaveta, com aviso: aplicada, devolveria
  interseção vazia e pareceria defeito nosso

Considerações:
- Dois campos numéricos no lugar do slider de faixa do spec, marcado com
  comentário ponytail. O slider entra sem mudar a interface do módulo
```

E pare. Quem commita é o revisor.

---

## Task 6: A gaveta Minerar

Os critérios que só nós temos, o alvo, e a linha "Vai varrer" — que não é
decoração (spec, 7.2).

**O toggle "Possui Instagram" entra aqui**, e o pós-filtro que o sustenta é a
Task 10. A consulta já existe — `buscarInstagram` em `src/content/instagram.ts`,
com cache por `pageId` —, e a lista de aprovados existe ao fim da varredura, em
`minerador.encontrados()`. Nada disso depende da tela de resultados.

**Files:**
- Create: `src/core/busca-descrita.ts`
- Create: `src/content/gaveta-minerar.ts`
- Test: `tests/core/busca-descrita.test.ts`
- Test: `tests/content/gaveta-minerar.test.ts`

**Interfaces:**
- Consumes: `Criterios` de `src/core/criteria`; `lerFaixaDaUrl` da Task 5.
- Produces:
  - `descreverBusca(url: string, agora: Date): string`
  - `interface PedidoMineracao { criterios: Criterios; limiteEncontrados: number }`
  - `montarMinerar(doc, urlAtual, agora, aoIniciar: (p: PedidoMineracao) => void): HTMLElement`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/core/busca-descrita.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { descreverBusca } from '../../src/core/busca-descrita'

const agora = new Date('2026-09-10T12:00:00Z')
const BASE = 'https://www.facebook.com/ads/library/'

describe('descreverBusca', () => {
  it('declara o termo, o país e o status', () => {
    const d = descreverBusca(
      `${BASE}?q=emagrecimento&country=BR&active_status=active`,
      agora,
    )
    expect(d).toContain('emagrecimento')
    expect(d).toContain('Brasil')
    expect(d).toContain('Ativos')
  })

  it('traduz o formato quando a Meta o carrega', () => {
    const d = descreverBusca(`${BASE}?q=x&country=BR&media_type=video`, agora)
    expect(d).toContain('Vídeo')
  })

  it('não inventa formato quando é "all"', () => {
    const d = descreverBusca(`${BASE}?q=x&country=BR&media_type=all`, agora)
    expect(d).not.toContain('Vídeo')
    expect(d).not.toContain('Imagem')
  })

  it('inclui o tempo ativo que a URL carrega', () => {
    const d = descreverBusca(
      `${BASE}?q=x&country=BR&start_date[max]=2026-09-03`,
      agora,
    )
    expect(d).toContain('7+ dias no ar')
  })

  it('sem termo, diz que a busca está vazia em vez de mentir', () => {
    const d = descreverBusca(`${BASE}?country=BR`, agora)
    expect(d).toContain('busca vazia')
  })

  it('país desconhecido aparece pelo código, sem quebrar', () => {
    const d = descreverBusca(`${BASE}?q=x&country=ZZ`, agora)
    expect(d).toContain('ZZ')
  })
})
```

Criar `tests/content/gaveta-minerar.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { montarMinerar } from '../../src/content/gaveta-minerar'

const agora = new Date('2026-09-10T12:00:00Z')
const URL_ATUAL =
  'https://www.facebook.com/ads/library/?q=emagrecimento&country=BR&active_status=active'

describe('montarMinerar', () => {
  it('mostra a linha "Vai varrer" com a busca em vigor', () => {
    const el = montarMinerar(document, URL_ATUAL, agora, () => {})
    const resumo = el.querySelector('[data-papel="vai-varrer"]')

    expect(resumo?.textContent).toContain('emagrecimento')
    expect(resumo?.textContent).toContain('Brasil')
  })

  it('começa nos padrões: colação 5, presença 10, alvo 100', () => {
    const el = montarMinerar(document, URL_ATUAL, agora, () => {})
    const v = (c: string) =>
      el.querySelector<HTMLInputElement>(`[data-campo="${c}"]`)?.value

    expect(v('colacaoMinima')).toBe('5')
    expect(v('presencaMinima')).toBe('10')
    expect(v('limiteEncontrados')).toBe('100')
  })

  it('iniciar entrega os critérios e o alvo', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao).toHaveBeenCalledWith({
      criterios: {
        colacaoMinima: 5,
        diasMin: null,
        diasMax: null,
        presencaMinima: 10,
      },
      limiteEncontrados: 100,
      exigirInstagram: false,
    })
  })

  it('avisa que o Instagram roda ao final e pode reduzir o total', () => {
    const el = montarMinerar(document, URL_ATUAL, agora, () => {})
    const nota = el.querySelector('[data-papel="nota-instagram"]')

    expect(nota?.textContent).toContain('ao final')
    expect(nota?.textContent).toContain('aprovados')
    expect(nota?.textContent).not.toContain('durante a varredura.')
  })

  it('o toggle do Instagram viaja no pedido quando ligado', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    const ig = el.querySelector<HTMLInputElement>(
      '[data-campo="exigirInstagram"]',
    )
    if (ig) ig.checked = true

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao.mock.calls[0][0].exigirInstagram).toBe(true)
  })

  it('herda o tempo ativo da URL como critério do motor', () => {
    const espiao = vi.fn()
    const el = montarMinerar(
      document,
      `${URL_ATUAL}&start_date[max]=2026-09-03`,
      agora,
      espiao,
    )

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao.mock.calls[0][0].criterios.diasMin).toBe(7)
  })

  it('alvo fora de 1 a 100 não inicia e avisa', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    const alvo = el.querySelector<HTMLInputElement>(
      '[data-campo="limiteEncontrados"]',
    )
    if (alvo) alvo.value = '500'

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao).not.toHaveBeenCalled()
    expect(el.textContent).toContain('entre 1 e 100')
  })

  it('critério zerado vira null, que é critério desligado', () => {
    const espiao = vi.fn()
    const el = montarMinerar(document, URL_ATUAL, agora, espiao)

    const colacao = el.querySelector<HTMLInputElement>(
      '[data-campo="colacaoMinima"]',
    )
    if (colacao) colacao.value = ''

    el.querySelector<HTMLElement>('[data-acao="iniciar"]')?.click()

    expect(espiao.mock.calls[0][0].criterios.colacaoMinima).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

```
npx.cmd vitest run tests/core/busca-descrita.test.ts tests/content/gaveta-minerar.test.ts
```

Expected: FAIL, imports sem resolver.

- [ ] **Step 3: Escrever a descrição da busca**

Criar `src/core/busca-descrita.ts`:

```ts
import { lerFaixaDaUrl, rotuloDaFaixa } from './dateFilter'

/**
 * A linha "Vai varrer", que declara a URL herdada.
 *
 * **Não é decoração** (spec, 7.2). Sem ela o usuário aperta Minerar sem
 * perceber que os filtros da Meta estão valendo — e essa herança é o que faz
 * o desenho inteiro funcionar, já que o nosso painel deixou de ter campos de
 * mercado, plataforma, formato e status.
 */

const PAISES: Record<string, string> = {
  ALL: 'Todos os países',
  BR: 'Brasil',
  PT: 'Portugal',
  US: 'Estados Unidos',
}

const FORMATOS: Record<string, string> = {
  video: 'Vídeo',
  image: 'Imagem',
  meme: 'Imagem e texto',
}

const STATUS: Record<string, string> = {
  active: 'Ativos',
  inactive: 'Inativos',
  all: 'Ativos e inativos',
}

export function descreverBusca(url: string, agora: Date): string {
  const p = new URL(url).searchParams
  const partes: string[] = []

  const termo = p.get('q')?.trim()
  partes.push(termo ? termo : '(busca vazia)')

  const pais = p.get('country')
  if (pais) partes.push(PAISES[pais] ?? pais)

  const formato = p.get('media_type')
  if (formato && formato !== 'all') partes.push(FORMATOS[formato] ?? formato)

  const status = p.get('active_status')
  if (status) partes.push(STATUS[status] ?? status)

  const faixa = lerFaixaDaUrl(url, agora)
  if (faixa.diasMin !== null || faixa.diasMax !== null) {
    partes.push(rotuloDaFaixa(faixa))
  }

  return partes.join(' · ')
}
```

- [ ] **Step 4: Escrever a gaveta**

Criar `src/content/gaveta-minerar.ts`:

```ts
import { descreverBusca } from '../core/busca-descrita'
import { CRITERIOS_PADRAO, type Criterios } from '../core/criteria'
import { lerFaixaDaUrl } from '../core/dateFilter'

/**
 * A gaveta do Minerar: os critérios que só nós temos, mais o alvo.
 *
 * Mercado, plataforma, formato e status não estão aqui de propósito — são da
 * Meta, e vivem na barra dela (spec, 7.3). O tempo ativo também não: quem o
 * define é o calendário, que reescreve a URL, e daqui ele é apenas herdado.
 *
 * O toggle "Possui Instagram" é pós-filtro, nunca pré-filtro (spec, 6.4): ele
 * roda depois do laço, sobre os aprovados. A gaveta diz isso em uma linha,
 * porque o total final pode diminuir e isso precisa ser esperado.
 */

export interface PedidoMineracao {
  criterios: Criterios
  limiteEncontrados: number
  /** Pós-filtro: descarta aprovados sem Instagram, ao fim da varredura. */
  exigirInstagram: boolean
}

export function montarMinerar(
  doc: Document,
  urlAtual: string,
  agora: Date,
  aoIniciar: (pedido: PedidoMineracao) => void,
): HTMLElement {
  const raiz = doc.createElement('div')

  const titulo = doc.createElement('h3')
  titulo.textContent = 'Minerar'
  raiz.appendChild(titulo)

  const colacao = campo(doc, 'colacaoMinima', CRITERIOS_PADRAO.colacaoMinima)
  const presenca = campo(doc, 'presencaMinima', CRITERIOS_PADRAO.presencaMinima)
  const alvo = campo(doc, 'limiteEncontrados', 100)

  const instagram = doc.createElement('input')
  instagram.type = 'checkbox'
  instagram.dataset.campo = 'exigirInstagram'

  raiz.appendChild(linha(doc, 'Criativos repetidos', colacao))
  raiz.appendChild(linha(doc, 'Anúncios do anunciante', presenca))
  raiz.appendChild(linha(doc, 'Possui Instagram', instagram))

  const notaIg = doc.createElement('div')
  notaIg.className = 'nota'
  notaIg.dataset.papel = 'nota-instagram'
  // Exigido pela seção 7.2: o total final pode diminuir, e o usuário precisa
  // saber disso antes de apertar, não depois.
  notaIg.textContent =
    'Verificado ao final, só nos anúncios aprovados — não durante a varredura. Pode reduzir o total.'
  raiz.appendChild(notaIg)

  raiz.appendChild(linha(doc, 'Quantidade de aprovados', alvo))

  const resumo = doc.createElement('div')
  resumo.className = 'nota'
  resumo.dataset.papel = 'vai-varrer'
  resumo.textContent = `Vai varrer: ${descreverBusca(urlAtual, agora)}`
  raiz.appendChild(resumo)

  const aviso = doc.createElement('div')
  aviso.className = 'nota'
  aviso.hidden = true
  raiz.appendChild(aviso)

  const iniciar = doc.createElement('button')
  iniciar.className = 'acao'
  iniciar.dataset.acao = 'iniciar'
  iniciar.textContent = '▶ Iniciar mineração'
  iniciar.addEventListener('click', () => {
    const limite = ler(alvo)

    // O motor lança `RangeError` fora de 1 a 100 (`miner.ts`, construtor).
    // Barrar aqui transforma exceção em recado.
    if (limite === null || limite < 1 || limite > 100) {
      aviso.hidden = false
      aviso.textContent = 'A quantidade de aprovados deve ser entre 1 e 100.'
      return
    }

    aviso.hidden = true
    const faixa = lerFaixaDaUrl(urlAtual, agora)

    aoIniciar({
      criterios: {
        colacaoMinima: ler(colacao),
        presencaMinima: ler(presenca),
        // Herdados da URL: quem os define é o calendário.
        diasMin: faixa.diasMin,
        diasMax: faixa.diasMax,
      },
      limiteEncontrados: limite,
      exigirInstagram: instagram.checked,
    })
  })
  raiz.appendChild(iniciar)

  return raiz
}

function campo(
  doc: Document,
  nome: string,
  valor: number | null,
): HTMLInputElement {
  const el = doc.createElement('input')
  el.type = 'number'
  el.min = '1'
  el.dataset.campo = nome
  el.value = valor === null ? '' : String(valor)
  el.style.cssText =
    'width:80px;padding:6px 8px;border-radius:8px;border:0;' +
    'background:#1A1622;color:#FFF;font:inherit'
  return el
}

function linha(doc: Document, texto: string, campo: HTMLElement): HTMLElement {
  const l = doc.createElement('div')
  l.className = 'linha'

  const rotulo = doc.createElement('span')
  rotulo.textContent = texto

  l.append(rotulo, campo)
  return l
}

/** Campo vazio é critério desligado (`criteria.ts`), e desligado é `null`. */
function ler(el: HTMLInputElement): number | null {
  const bruto = el.value.trim()
  if (bruto === '') return null

  const n = Number(bruto)
  return Number.isInteger(n) && n >= 1 ? n : null
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

```
npx.cmd vitest run tests/core/busca-descrita.test.ts tests/content/gaveta-minerar.test.ts
```

Expected: PASS — 6 em `busca-descrita`, 6 na gaveta.

- [ ] **Step 6: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

Expected: tudo passa.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): pedir os critérios da mineração na gaveta do Minerar

O que foi feito:
- Declarar a busca herdada na linha "Vai varrer"
- Oferecer criativos repetidos, anúncios do anunciante e alvo de aprovados

Como foi feito:
- O tempo ativo é herdado da URL, não redigitado: quem o define é o calendário
- O alvo é barrado fora de 1 a 100 na gaveta, porque o motor lança RangeError
  nessa faixa e exceção não é recado

Considerações:
- O toggle do Instagram só viaja no pedido; quem o aplica é a Task 10, depois
  do laço, como a seção 6.4 exige
```

E pare. Quem commita é o revisor.

---
## Task 7: A ordenação, e a recarga que ela obriga

Os escalados precisam vir primeiro, senão a mineração rola muito mais para
achar o mesmo (spec, 7.6). Módulo puro; quem navega é o content script.

**Atenção ao que o levantamento mediu:** a Meta **reescreve a URL sozinha ao
carregar**, acrescentando `sort_data[mode]=total_impressions` e
`sort_data[direction]=desc` a uma URL que não os tinha. A decisão de recarregar
tem de ser tomada com a URL **em vigor no momento do clique**, não com a URL
que o usuário digitou. Feita antes da reescrita, a recarga dispara à toa.

**Files:**
- Create: `src/core/ordenacao.ts`
- Test: `tests/core/ordenacao.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `precisaOrdenar(url: string): boolean`
  - `urlOrdenada(url: string): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/core/ordenacao.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { precisaOrdenar, urlOrdenada } from '../../src/core/ordenacao'

const BASE = 'https://www.facebook.com/ads/library/?q=x&country=BR'
const ORDENADA =
  `${BASE}&sort_data[mode]=total_impressions&sort_data[direction]=desc`

describe('precisaOrdenar', () => {
  it('URL sem ordenação precisa', () => {
    expect(precisaOrdenar(BASE)).toBe(true)
  })

  it('URL já ordenada não precisa', () => {
    expect(precisaOrdenar(ORDENADA)).toBe(false)
  })

  it('ordenação por outro modo precisa ser corrigida', () => {
    expect(
      precisaOrdenar(`${BASE}&sort_data[mode]=recency&sort_data[direction]=desc`),
    ).toBe(true)
  })

  it('modo certo com direção errada precisa', () => {
    expect(
      precisaOrdenar(
        `${BASE}&sort_data[mode]=total_impressions&sort_data[direction]=asc`,
      ),
    ).toBe(true)
  })
})

describe('urlOrdenada', () => {
  it('acrescenta os dois parâmetros', () => {
    const p = new URL(urlOrdenada(BASE)).searchParams
    expect(p.get('sort_data[mode]')).toBe('total_impressions')
    expect(p.get('sort_data[direction]')).toBe('desc')
  })

  it('preserva os demais parâmetros', () => {
    const p = new URL(urlOrdenada(BASE)).searchParams
    expect(p.get('q')).toBe('x')
    expect(p.get('country')).toBe('BR')
  })

  it('é idempotente: aplicar de novo não precisa de nova recarga', () => {
    expect(precisaOrdenar(urlOrdenada(BASE))).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx.cmd vitest run tests/core/ordenacao.test.ts`

Expected: FAIL, import sem resolver.

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/ordenacao.ts`:

```ts
/**
 * A ordenação por impressões, e a recarga que ela obriga (spec, 7.6).
 *
 * Antes, quem escrevia estes parâmetros era o filtro de data, de carona. Sem
 * painel montando URL, iniciar a mineração passa a verificar a URL em vigor.
 *
 * **Chame com a URL do momento do clique.** A Meta reescreve a URL sozinha
 * ao carregar, acrescentando exatamente estes dois parâmetros — medido em
 * 2026-09-10. Decidir com a URL digitada dispararia recarga à toa.
 */

const MODO = 'total_impressions'
const DIRECAO = 'desc'

export function precisaOrdenar(url: string): boolean {
  const p = new URL(url).searchParams
  return (
    p.get('sort_data[mode]') !== MODO ||
    p.get('sort_data[direction]') !== DIRECAO
  )
}

export function urlOrdenada(url: string): string {
  const u = new URL(url)
  u.searchParams.set('sort_data[mode]', MODO)
  u.searchParams.set('sort_data[direction]', DIRECAO)
  return u.toString()
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx.cmd vitest run tests/core/ordenacao.test.ts`

Expected: PASS, 7 testes.

- [ ] **Step 5: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(miner): decidir quando a mineração precisa recarregar para ordenar

Considerações:
- A decisão precisa usar a URL em vigor no clique: a Meta acrescenta esses
  mesmos parâmetros sozinha ao carregar, e decidir antes disso recarregaria
  à toa
```

E pare. Quem commita é o revisor.

---

## Task 8: O cartão de progresso

Iniciada a varredura, o botão Minerar dá lugar a um cartão com contadores e
Pausar (spec, 7.9). Ele fica na página, não numa gaveta: a mineração é longa,
e uma gaveta que precisa ficar aberta para o usuário ver o progresso prende a
interface.

**Files:**
- Create: `src/content/progresso.ts`
- Test: `tests/content/progresso.test.ts`
- Modify: `src/content/estilo.ts` — acrescentar `CSS_PROGRESSO` e incluí-lo
  nas duas montagens de folha

**Interfaces:**
- Consumes: `Progresso` e `EstadoMineracao` de `src/core/miner`.
- Produces:
  - `montarProgresso(doc: Document, aoPausar: () => void): HTMLElement`
  - `atualizarProgresso(cartao: HTMLElement, p: Progresso, alvo: number): void`
  - `rotuloDoEstado(estado: EstadoMineracao): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/content/progresso.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import {
  atualizarProgresso,
  montarProgresso,
  rotuloDoEstado,
} from '../../src/content/progresso'
import type { Progresso } from '../../src/core/miner'

function progresso(p: Partial<Progresso> = {}): Progresso {
  return {
    estado: 'minerando',
    analisados: 0,
    encontrados: 0,
    rolagens: 0,
    ...p,
  }
}

describe('rotuloDoEstado', () => {
  it('traduz cada estado do motor para o vocabulário do usuário', () => {
    expect(rotuloDoEstado('minerando')).toBe('Minerando')
    expect(rotuloDoEstado('pausado')).toBe('Pausado')
    expect(rotuloDoEstado('concluido')).toBe('Concluído')
    expect(rotuloDoEstado('esgotado')).toBe('Fim dos resultados')
  })

  it('não fala de risco ao usuário, como a seção 6.2 exige', () => {
    // `limite-seguranca` e `incompreensivel` são vocabulário nosso.
    expect(rotuloDoEstado('limite-seguranca')).toBe('Mineração encerrada')
    expect(rotuloDoEstado('incompreensivel')).toBe('Mineração encerrada')
    expect(rotuloDoEstado('limite-seguranca')).not.toMatch(/risco|bloqueio/i)
  })
})

describe('cartão de progresso', () => {
  it('mostra os três contadores', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(
      c,
      progresso({ analisados: 152, encontrados: 18, rolagens: 22 }),
      100,
    )

    expect(c.querySelector('[data-papel="analisados"]')?.textContent).toBe('152')
    expect(c.querySelector('[data-papel="encontrados"]')?.textContent).toBe('18')
    expect(c.querySelector('[data-papel="rolagens"]')?.textContent).toBe('22')
  })

  it('a barra mede os encontrados contra o alvo, não os analisados', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ analisados: 900, encontrados: 25 }), 100)

    const barra = c.querySelector<HTMLElement>('[data-papel="barra"]')
    expect(barra?.style.width).toBe('25%')
  })

  it('a barra não passa de 100% quando o lote cruza o alvo', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ encontrados: 105 }), 100)

    const barra = c.querySelector<HTMLElement>('[data-papel="barra"]')
    expect(barra?.style.width).toBe('100%')
  })

  it('pausar chama o que foi passado', () => {
    const espiao = vi.fn()
    const c = montarProgresso(document, espiao)

    c.querySelector<HTMLElement>('[data-acao="pausar"]')?.click()

    expect(espiao).toHaveBeenCalledTimes(1)
  })

  it('some o botão pausar quando a mineração termina', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ estado: 'esgotado' }), 100)

    const pausar = c.querySelector<HTMLElement>('[data-acao="pausar"]')
    expect(pausar?.hidden).toBe(true)
  })

  it('mantém o pausar durante uma pausa, para poder retomar', () => {
    const c = montarProgresso(document, () => {})
    atualizarProgresso(c, progresso({ estado: 'pausado' }), 100)

    const pausar = c.querySelector<HTMLElement>('[data-acao="pausar"]')
    expect(pausar?.hidden).toBe(false)
    expect(pausar?.textContent).toBe('Retomar')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx.cmd vitest run tests/content/progresso.test.ts`

Expected: FAIL, import sem resolver.

- [ ] **Step 3: Acrescentar o CSS**

Em `src/content/estilo.ts`, junto de `CSS_GAVETA`:

```ts
/** O cartão de progresso, que ocupa o lugar do botão durante a varredura. */
export const CSS_PROGRESSO = `
  .progresso {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 36px;
    padding: 0 14px;
    border-radius: 10px;
    background: #08070D;
    color: #FFFFFF;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    white-space: nowrap;
  }

  .progresso .trilho {
    width: 90px;
    height: 6px;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.14);
    overflow: hidden;
  }
  .progresso .barra {
    height: 100%;
    width: 0%;
    background: #7C3AED;
    transition: width 300ms ease;
  }

  .progresso .numero { font-weight: 600; color: #C4A7FF; }

  .progresso .pausar {
    border: 0;
    background: transparent;
    color: #C4A7FF;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }
`
```

Inclua `CSS_PROGRESSO` nas duas montagens de folha, junto das outras.

- [ ] **Step 4: Escrever a implementação**

Criar `src/content/progresso.ts`:

```ts
import type { EstadoMineracao, Progresso } from '../core/miner'

/**
 * O cartão que substitui o botão Minerar durante a varredura (spec, 7.9).
 *
 * **A interface não fala de risco** (spec, 6.2). O motor distingue
 * `limite-seguranca` de `incompreensivel`, e essa distinção é nossa, para o
 * console e para o log: ao usuário, os dois são o mesmo fim de mineração.
 * Dizer "limite de segurança" convida a perguntar de que segurança se trata.
 */

const ROTULOS: Record<EstadoMineracao, string> = {
  parado: 'Pronto',
  minerando: 'Minerando',
  pausado: 'Pausado',
  concluido: 'Concluído',
  esgotado: 'Fim dos resultados',
  incompreensivel: 'Mineração encerrada',
  'limite-seguranca': 'Mineração encerrada',
}

/** Estados em que não há mais o que pausar nem retomar. */
const TERMINAIS: ReadonlySet<EstadoMineracao> = new Set([
  'concluido',
  'esgotado',
  'incompreensivel',
  'limite-seguranca',
])

export function rotuloDoEstado(estado: EstadoMineracao): string {
  return ROTULOS[estado]
}

export function montarProgresso(
  doc: Document,
  aoPausar: () => void,
): HTMLElement {
  const cartao = doc.createElement('div')
  cartao.className = 'progresso'

  const estado = doc.createElement('span')
  estado.dataset.papel = 'estado'
  estado.textContent = ROTULOS.parado

  const trilho = doc.createElement('div')
  trilho.className = 'trilho'
  const barra = doc.createElement('div')
  barra.className = 'barra'
  barra.dataset.papel = 'barra'
  trilho.appendChild(barra)

  const pausar = doc.createElement('button')
  pausar.className = 'pausar'
  pausar.dataset.acao = 'pausar'
  pausar.textContent = 'Pausar'
  pausar.addEventListener('click', (ev) => {
    ev.stopPropagation()
    aoPausar()
  })

  cartao.append(
    estado,
    trilho,
    contador(doc, 'encontrados', 'encontrados'),
    contador(doc, 'analisados', 'analisados'),
    contador(doc, 'rolagens', 'rolagens'),
    pausar,
  )

  return cartao
}

export function atualizarProgresso(
  cartao: HTMLElement,
  p: Progresso,
  alvo: number,
): void {
  const põe = (papel: string, texto: string): void => {
    const el = cartao.querySelector(`[data-papel="${papel}"]`)
    if (el) el.textContent = texto
  }

  põe('estado', ROTULOS[p.estado])
  põe('analisados', String(p.analisados))
  põe('encontrados', String(p.encontrados))
  põe('rolagens', String(p.rolagens))

  const barra = cartao.querySelector<HTMLElement>('[data-papel="barra"]')
  if (barra) {
    // Contra o alvo, não contra os analisados: o usuário pediu N aprovados, e
    // é isso que ele espera ver encher. O lote que cruza o alvo pode passar
    // dele por um instante — `miner.ts` corta depois.
    const pct = alvo > 0 ? Math.min(100, (p.encontrados / alvo) * 100) : 0
    barra.style.width = `${Math.round(pct)}%`
  }

  const pausar = cartao.querySelector<HTMLButtonElement>('[data-acao="pausar"]')
  if (pausar) {
    pausar.hidden = TERMINAIS.has(p.estado)
    pausar.textContent = p.estado === 'pausado' ? 'Retomar' : 'Pausar'
  }
}

function contador(doc: Document, papel: string, rotulo: string): HTMLElement {
  const wrap = doc.createElement('span')

  const numero = doc.createElement('span')
  numero.className = 'numero'
  numero.dataset.papel = papel
  numero.textContent = '0'

  const texto = doc.createElement('span')
  texto.textContent = ` ${rotulo}`

  wrap.append(numero, texto)
  return wrap
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

Run: `npx.cmd vitest run tests/content/progresso.test.ts`

Expected: PASS, 8 testes.

- [ ] **Step 6: Rodar a suíte e o typecheck**

```
npm.cmd test
npm.cmd run typecheck
```

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): mostrar o progresso da mineração no lugar do botão

Como foi feito:
- A barra mede os encontrados contra o alvo, que é o que o usuário pediu

Considerações:
- `limite-seguranca` e `incompreensivel` viram o mesmo recado ao usuário: a
  seção 6.2 do spec proíbe a interface de falar de risco
```

E pare. Quem commita é o revisor.

---

## Task 9: Ligar tudo, e aposentar o painel flutuante

A tarefa que faz a mineração começar por um botão. Também remove o painel de
344 px, que a seção 7.3 aposenta: sem abas nem campos para abrigar, ele deixou
de ter função.

**Files:**
- Modify: `src/content/index.ts`
- Modify: `src/manifest.config.ts`
- Test: `tests/content/index.test.ts` — o arquivo já existe, da Task 7 do plano
  do motor; acrescente a ele.

**Interfaces:**
- Consumes: tudo das Tasks 1 a 8.
- Produces: nada novo para fora; `iniciarMineracao` continua exportada.

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `tests/content/index.test.ts`:

```ts
it('planta os três enxertos na barra da Meta', async () => {
  document.body.innerHTML = `
    <div id="barra" style="display:flex;flex-direction:row">
      <div><div role="combobox">Brazil</div></div>
      <div><input type="search"></div>
    </div>
  `

  await import('../../src/content/index')

  await vi.waitFor(() => {
    const host = document.getElementById('copyhaunt-enxertos')
    expect(host).not.toBeNull()

    const shadow = host?.shadowRoot
    expect(shadow?.querySelector('[data-chave="ajuda"]')).not.toBeNull()
    expect(shadow?.querySelector('[data-chave="calendario"]')).not.toBeNull()
    expect(shadow?.querySelector('[data-chave="minerar"]')).not.toBeNull()
  })
})

it('não monta mais o painel flutuante em iframe', async () => {
  await import('../../src/content/index')
  expect(document.getElementById('copyhaunt-panel')).toBeNull()
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx.cmd vitest run tests/content/index.test.ts`

Expected: FAIL — nenhum host `copyhaunt-enxertos`, e o painel ainda montado.

- [ ] **Step 3: Ligar os enxertos no content script**

Em `src/content/index.ts`:

1. Acrescentar aos imports:

```ts
import { plantarEnxertos, type Enxerto, type Plantio } from './enxertos'
import { alternarGaveta, fecharGaveta } from './gaveta'
import { escreverNaBusca, montarExemplos } from './gaveta-exemplos'
import { montarCalendario } from './gaveta-calendario'
import { montarMinerar, type PedidoMineracao } from './gaveta-minerar'
import { atualizarProgresso, montarProgresso } from './progresso'
import { lerFaixaDaUrl, rotuloDaFaixa, montarUrlFiltro } from '../core/dateFilter'
import { precisaOrdenar, urlOrdenada } from '../core/ordenacao'
```

2. **Remover** a função `mountPanel`, a constante `PANEL_ID`, a variável
   `painel`, a chamada `mountPanel()` dentro de `iniciar()`, o import de
   `veioDoPainel` e o ramo `panel-command` do listener de `message`. Com o
   painel fora, `tratarComandoFiltro` deixa de ter chamador no content
   script — mas **não apague `src/content/comando.ts` nem os testes dele**:
   `tratarComandoFiltro` continua sendo a função que aplica uma faixa à URL,
   e é ela que o calendário usa no passo seguinte.

3. Acrescentar, antes de `iniciar()`:

```ts
/** O plantio dos enxertos. Vive enquanto a aba viver. */
let plantio: Plantio | null = null

/** O alvo da mineração em curso, para a barra de progresso ter denominador. */
let alvoAtual = 100

/**
 * Troca o botão Minerar pelo cartão de progresso, e o mantém atualizado.
 *
 * O cartão é replantado junto com os enxertos: quando a Meta refaz a barra, o
 * host novo não tem cartão, e sem isto o progresso sumiria no meio da
 * varredura.
 */
function mostrarProgresso(shadow: ShadowRoot): void {
  fecharGaveta(shadow)

  const botao = shadow.querySelector<HTMLElement>('[data-chave="minerar"]')
  if (!botao) return

  const cartao = montarProgresso(document, () => {
    const p = minerador?.progresso()
    if (p?.estado === 'pausado') void minerador?.iniciar()
    else minerador?.parar()
  })
  cartao.dataset.chave = 'progresso'
  botao.replaceWith(cartao)
}

/** Um enxerto por gaveta, mais o disparo. */
function montarEnxertos(): Enxerto[] {
  return [
    {
      chave: 'ajuda',
      glifo: '?',
      titulo: 'Exemplos de busca',
      variante: 'contorno',
      aoClicar: (botao) => {
        const shadow = botao.getRootNode() as ShadowRoot
        alternarGaveta(shadow, botao, () =>
          montarExemplos(document, (termo) => {
            escreverNaBusca(document, termo)
            fecharGaveta(shadow)
          }),
        )
      },
    },
    {
      chave: 'calendario',
      glifo: rotuloDaFaixa(lerFaixaDaUrl(location.href, new Date())),
      titulo: 'Tempo ativo',
      variante: 'contorno',
      aoClicar: (botao) => {
        const shadow = botao.getRootNode() as ShadowRoot
        const agora = new Date()
        alternarGaveta(shadow, botao, () =>
          montarCalendario(document, lerFaixaDaUrl(location.href, agora), (f) => {
            location.assign(montarUrlFiltro(location.href, f, new Date()))
          }),
        )
      },
    },
    {
      chave: 'minerar',
      glifo: 'Minerar',
      titulo: 'Minerar',
      variante: 'solido',
      aoClicar: (botao) => {
        const shadow = botao.getRootNode() as ShadowRoot
        alternarGaveta(shadow, botao, () =>
          montarMinerar(document, location.href, new Date(), (pedido) => {
            dispararMineracao(pedido, shadow)
          }),
        )
      },
    },
  ]
}

/**
 * O que acontece ao apertar Iniciar.
 *
 * A ordenação é verificada com a URL **em vigor agora** — a Meta já a
 * reescreveu ao carregar, e decidir com a URL digitada recarregaria à toa. A
 * recarga descarta o `AdStore`, que ainda está vazio neste instante, então
 * não custa nada (spec, 7.6).
 */
function dispararMineracao(pedido: PedidoMineracao, shadow: ShadowRoot): void {
  if (precisaOrdenar(location.href)) {
    location.assign(urlOrdenada(location.href))
    return
  }

  alvoAtual = pedido.limiteEncontrados
  mostrarProgresso(shadow)
  iniciarMineracao(pedido)
}
```

4. Dentro de `iniciar()`, no lugar de `mountPanel()`:

```ts
  plantio = plantarEnxertos(document, montarEnxertos())
```

5. Em `criarMinerador`, acrescentar a atualização do cartão dentro de
   `aoProgredir`, logo depois do `console.info` que já existe:

```ts
      const cartao = plantio
        ?.hospedeiro()
        ?.shadowRoot?.querySelector<HTMLElement>('[data-chave="progresso"]')
      if (cartao) atualizarProgresso(cartao, p, alvoAtual)
```

6. Remover a porta provisória do console, que a gaveta substituiu:

```ts
// Porta provisória para o teste manual no contexto do content script. A
// futura gaveta chama a mesma função e elimina a necessidade do console.
Object.assign(globalThis, { iniciarMineracao })
```

- [ ] **Step 4: Sair o painel do manifest**

Em `src/manifest.config.ts`, remover o bloco `web_accessible_resources`
inteiro. Ele existia para a página da Meta poder carregar o iframe do painel;
sem iframe, ele só amplia a superfície exposta.

Os arquivos `src/panel/` **ficam no repositório**: o plano irmão reaproveita
esse esqueleto como a página de resultados em aba própria, e uma página da
extensão aberta em aba não precisa de `web_accessible_resources`.

- [ ] **Step 5: Rodar e confirmar que passa**

```
npx.cmd vitest run tests/content/index.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

Expected: tudo passa. O `verify:build` precisa aceitar o manifest sem
`web_accessible_resources` — se `tests/manifest.test.ts` afirmar a presença
dele, **atualize essa afirmação**: o manifest travado é o de permissões e
hosts, e o painel saiu por decisão de desenho.

- [ ] **Step 6: Verificar que nada ficou órfão**

```
npx.cmd tsc --noEmit
```

E confirme à mão que `veioDoPainel` não tem mais chamador:

```
rg "veioDoPainel" src/
```

Esperado: só a definição em `src/content/comando.ts` e os testes dela. Se for
o caso, **remova `veioDoPainel` e os testes dela** — ela existia para separar
o nosso painel de outros scripts no main world, e sem painel não separa nada.
`tratarComandoFiltro` fica.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): iniciar a mineração pelo botão na barra da Meta

O que foi feito:
- Plantar os três enxertos e ligar cada um à sua gaveta
- Trocar o botão Minerar pelo cartão de progresso durante a varredura
- Aposentar o painel flutuante e a porta provisória do console

Como foi feito:
- A ordenação é verificada com a URL em vigor no clique, porque a Meta já a
  reescreve sozinha ao carregar
- O cartão de progresso é procurado no shadow root a cada aviso, e não
  guardado: o host é replantado quando a Meta refaz a barra

Considerações:
- `web_accessible_resources` saiu do manifest junto do iframe: sem página da
  Meta carregando o painel, ele só ampliava a superfície exposta
- Os arquivos de `src/panel/` ficam: o plano irmão os reaproveita como a
  página de resultados em aba própria
```

E pare. Quem commita é o revisor.

---

## Task 10: O pós-filtro de Instagram sobre os aprovados

A única exceção à coleta passiva (spec, 2 e 6.4). Ela vale porque acontece
**depois** do laço, sobre a lista final, e em ordem de grandeza menor: minerou
806, aprovou 18, consulta 18.

**A trava que não pode cair:** o `Minerador` nunca chama a consulta dentro do
laço. Se alguma implementação precisar do Instagram *para decidir* se aprova, o
desenho está errado — o critério é pós-filtro, nunca pré-filtro.

A consulta já existe: `buscarInstagram` em `src/content/instagram.ts`, com
cache por `pageId` e o interruptor remoto `definirDocIdAnunciante`. O que falta
é o espaçamento. Hoje cada consulta nasce de um clique humano, naturalmente
espaçada; um laço de dezoito seguidas não é a mesma coisa.

**Files:**
- Create: `src/content/pos-instagram.ts`
- Test: `tests/content/pos-instagram.test.ts`
- Modify: `src/content/index.ts` — chamar o pós-filtro ao fim da varredura

**Interfaces:**
- Consumes: `Ad` de `src/core/types`; `buscarInstagram` de `./instagram`;
  `relogioDeWorker` de `src/core/clock`.
- Produces:
  - `interface DepsPosFiltro { consultar: (pageId: string) => Promise<string | null>; esperar: (ms: number) => Promise<void>; espacoMs?: number; aoProgredir?: (feitos: number, total: number) => void }`
  - `filtrarPorInstagram(aprovados: Ad[], deps: DepsPosFiltro): Promise<Ad[]>`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/content/pos-instagram.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { filtrarPorInstagram } from '../../src/content/pos-instagram'
import type { Ad } from '../../src/core/types'

function ad(id: string, pageId: string): Ad {
  return {
    id,
    iniciouEm: new Date('2026-09-01T00:00:00Z'),
    colacao: 5,
    anunciante: { pageId, pageName: `pagina ${pageId}` },
    midias: [],
    plataformas: ['Facebook'],
    ativo: true,
  }
}

/** Espera instantânea: o teste mede a ordem das chamadas, não o relógio. */
const semEspera = () => Promise.resolve()

describe('filtrarPorInstagram', () => {
  it('mantém quem tem Instagram e descarta quem não tem', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2')]
    const consultar = vi.fn(async (pageId: string) =>
      pageId === 'p1' ? 'https://instagram.com/um' : null,
    )

    const r = await filtrarPorInstagram(aprovados, {
      consultar,
      esperar: semEspera,
    })

    expect(r.map((a) => a.id)).toEqual(['1'])
  })

  it('consulta uma vez por anunciante, não uma por anúncio', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p1'), ad('3', 'p1')]
    const consultar = vi.fn(async () => 'https://instagram.com/um')

    await filtrarPorInstagram(aprovados, { consultar, esperar: semEspera })

    expect(consultar).toHaveBeenCalledTimes(1)
  })

  it('mantém todos os anúncios do anunciante que tem Instagram', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p1')]
    const consultar = vi.fn(async () => 'https://instagram.com/um')

    const r = await filtrarPorInstagram(aprovados, {
      consultar,
      esperar: semEspera,
    })

    expect(r).toHaveLength(2)
  })

  it('espaça as consultas, uma espera entre cada par', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2'), ad('3', 'p3')]
    const esperas: number[] = []

    await filtrarPorInstagram(aprovados, {
      consultar: async () => null,
      esperar: async (ms) => {
        esperas.push(ms)
      },
      espacoMs: 2000,
    })

    // Três anunciantes, duas esperas: não se espera antes da primeira nem
    // depois da última.
    expect(esperas).toEqual([2000, 2000])
  })

  it('não espera quando há um anunciante só', async () => {
    const esperar = vi.fn(async () => {})

    await filtrarPorInstagram([ad('1', 'p1')], {
      consultar: async () => 'x',
      esperar,
    })

    expect(esperar).not.toHaveBeenCalled()
  })

  it('consulta que falha mantém o anúncio, em vez de descartar', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2')]
    const consultar = vi.fn(async (pageId: string) => {
      if (pageId === 'p1') throw new Error('rede caiu')
      return 'https://instagram.com/dois'
    })

    const r = await filtrarPorInstagram(aprovados, {
      consultar,
      esperar: semEspera,
    })

    expect(r.map((a) => a.id)).toEqual(['1', '2'])
  })

  it('avisa o progresso a cada anunciante consultado', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2')]
    const aoProgredir = vi.fn()

    await filtrarPorInstagram(aprovados, {
      consultar: async () => null,
      esperar: semEspera,
      aoProgredir,
    })

    expect(aoProgredir).toHaveBeenNthCalledWith(1, 1, 2)
    expect(aoProgredir).toHaveBeenNthCalledWith(2, 2, 2)
  })

  it('lista vazia não consulta nada', async () => {
    const consultar = vi.fn(async () => null)
    const r = await filtrarPorInstagram([], { consultar, esperar: semEspera })

    expect(r).toEqual([])
    expect(consultar).not.toHaveBeenCalled()
  })

  it('preserva a ordem original dos aprovados', async () => {
    const aprovados = [ad('1', 'p1'), ad('2', 'p2'), ad('3', 'p1')]

    const r = await filtrarPorInstagram(aprovados, {
      consultar: async () => 'x',
      esperar: semEspera,
    })

    expect(r.map((a) => a.id)).toEqual(['1', '2', '3'])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

Run: `npx.cmd vitest run tests/content/pos-instagram.test.ts`

Expected: FAIL, import sem resolver.

- [ ] **Step 3: Escrever a implementação**

Criar `src/content/pos-instagram.ts`:

```ts
import type { Ad } from '../core/types'

/**
 * O pós-filtro de Instagram, sobre os aprovados (spec, 6.4).
 *
 * **Depois do laço, nunca dentro dele.** Como critério de mineração, obrigaria
 * consultar todo anunciante encontrado: a medição de 2026-09-10 viu 806
 * anúncios em 4 minutos, algo como 200 anunciantes distintos, logo 200
 * requisições forjadas em 4 minutos. É exatamente a varredura que a seção 2
 * do spec proíbe. Sobre os aprovados são dezoito.
 *
 * Duas economias que fazem a diferença entre "algumas consultas" e "uma
 * varredura": agrupar por anunciante, porque vários aprovados costumam ser do
 * mesmo, e espaçar as consultas — cada uma nasce hoje de um clique humano, e
 * um laço de dezoito seguidas não se parece com isso.
 */

export interface DepsPosFiltro {
  /** A consulta em si. Em produção, `buscarInstagram`. */
  consultar: (pageId: string) => Promise<string | null>
  esperar: (ms: number) => Promise<void>
  /**
   * Espaço entre consultas.
   *
   * ponytail: valor fixo, sem jitter. O laço da mineração espalha a cadência
   * porque roda centenas de vezes; aqui são dezoito. Se virar sinal, reusar
   * `esperaComJitter` de `miner.ts`.
   */
  espacoMs?: number
  aoProgredir?: (feitos: number, total: number) => void
}

const ESPACO_PADRAO_MS = 2000

export async function filtrarPorInstagram(
  aprovados: Ad[],
  deps: DepsPosFiltro,
): Promise<Ad[]> {
  const espaco = deps.espacoMs ?? ESPACO_PADRAO_MS

  // Um anunciante pode ter vários aprovados; a consulta é por anunciante.
  const paginas = [...new Set(aprovados.map((a) => a.anunciante.pageId))]
  if (paginas.length === 0) return []

  const temInstagram = new Map<string, boolean>()

  for (const [i, pageId] of paginas.entries()) {
    if (i > 0) await deps.esperar(espaco)

    try {
      const perfil = await deps.consultar(pageId)
      temInstagram.set(pageId, perfil !== null)
    } catch {
      // Falha de rede não é ausência de Instagram. Descartar aqui apagaria um
      // aprovado legítimo por causa de um erro nosso; manter deixa o filtro
      // um pouco permissivo, que é o lado certo para errar.
      temInstagram.set(pageId, true)
    }

    deps.aoProgredir?.(i + 1, paginas.length)
  }

  return aprovados.filter((a) => temInstagram.get(a.anunciante.pageId))
}
```

- [ ] **Step 4: Rodar e confirmar que passam**

Run: `npx.cmd vitest run tests/content/pos-instagram.test.ts`

Expected: PASS, 9 testes.

- [ ] **Step 5: Ligar ao fim da varredura**

Em `src/content/index.ts`, dentro de `dispararMineracao`, substituir a linha
`iniciarMineracao(pedido)` por:

```ts
  const motor = iniciarMineracao(pedido)

  // O pós-filtro só roda quando o laço termina — a trava da seção 6.4.
  void motor.iniciar().then(async () => {
    const p = motor.progresso()
    if (p.estado === 'pausado') return

    let finais = motor.encontrados()

    if (pedido.exigirInstagram) {
      const relogio = relogioDeWorker()
      finais = await filtrarPorInstagram(finais, {
        consultar: async (pageId) => buscarInstagram(pageId),
        esperar: (ms) => relogio.esperar(ms),
        aoProgredir: (feitos, total) => {
          console.info(
            `[CopyHaunt] Instagram: ${feitos} de ${total} anunciantes`,
          )
        },
      })
    }

    console.info(
      `[CopyHaunt] mineração encerrada em ${p.estado}: ${finais.length} aprovados finais`,
    )
  })
```

E acrescentar aos imports do arquivo:

```ts
import { buscarInstagram } from './instagram'
import { filtrarPorInstagram } from './pos-instagram'
```

`iniciarMineracao` já devolve o `Minerador` e já chama `iniciar()`; chamar de
novo devolve o mesmo laço, não abre um segundo — está documentado no próprio
`miner.ts`. É isso que torna seguro encadear o `then` aqui.

**Confira a assinatura de `buscarInstagram`** antes de escrever a linha
`consultar`: ela recebe dependências no ponto de chamada da bandeja. Se o
segundo parâmetro for obrigatório, monte-o aqui do mesmo modo que
`src/content/tray.ts` monta, em vez de mudar a assinatura — a bandeja é
chamadora dela e não pode quebrar.

- [ ] **Step 6: Rodar a verificação completa**

```
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

Expected: tudo passa. **As permissões continuam `["storage"]`** — a consulta
usa os hosts já declarados, exatamente como a bandeja faz hoje.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(miner): filtrar os aprovados por presença no Instagram ao final

O que foi feito:
- Consultar o Instagram dos anunciantes aprovados depois do laço, e descartar
  quem não tiver
- Ligar o toggle da gaveta a esse pós-filtro

Como foi feito:
- Agrupar por anunciante, porque vários aprovados costumam ser do mesmo
- Espaçar as consultas: cada uma nasce hoje de um clique humano, e dezoito
  seguidas não se parecem com isso

Considerações:
- Consulta que falha mantém o anúncio. Falha de rede não é ausência de
  Instagram, e descartar apagaria um aprovado legítimo por erro nosso
- A trava da seção 6.4 continua de pé: o Minerador não consulta dentro do
  laço, e este filtro só roda depois que ele encerra
```

E pare. Quem commita é o revisor.

---
## Verificação final

```
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git status --short
```

**Mais o teste manual**, na Biblioteca real, em perfil deslogado, com a
extensão carregada. Este plano é de interface: a suíte não vê nada do que
importa aqui.

1. Abrir a Biblioteca com uma busca de nicho grande. Conferir que os três
   enxertos aparecem depois dos controles da Meta, com o divisor entre eles.
2. **Estreitar a janela até cerca de 760 px e alargar de volta.** Medido em
   2026-09-10: a barra é `row` em toda essa faixa e **não quebra em duas
   linhas**. O que se confere aqui é que os enxertos continuam na linha da
   busca e não empurram a altura da barra. Se em alguma largura a barra
   quebrar mesmo assim, o código já cobre o caso — mas registre a largura, que
   nenhuma medição a produziu.
3. Abrir cada gaveta e conferir que abrir uma fecha a outra.
4. No `?`, clicar num exemplo: o texto entra na busca da Meta.
5. No calendário, aplicar `14+`: a página recarrega com o filtro, e o rótulo
   do botão passa a dizer `14+ dias no ar`.
6. **Fazer uma busca nova pelo campo da Meta.** Os enxertos têm de sobreviver
   — é o caso que troca o nó do input e refaz a barra.
7. Rolar dez vezes e conferir que os enxertos continuam lá.
8. Em Minerar, conferir a linha "Vai varrer" batendo com a busca em vigor.
   Iniciar com alvo baixo, como 10.
9. Se a URL não tiver ordenação, a página recarrega uma vez antes de começar.
   **Apertar Iniciar de novo depois da recarga não deve recarregar outra vez.**
10. Conferir que o botão vira cartão, que os números sobem, e que Pausar
    pausa e Retomar retoma.
11. Deixar chegar ao alvo e conferir que o estado vira `Concluído`.
12. **Minerar de novo com "Possui Instagram" ligado**, alvo baixo. Ao fim do
    laço, o console mostra `Instagram: N de M anunciantes`, uma consulta de
    cada vez e espaçada — não todas de uma vez. O total final pode ser menor
    que o alvo, e isso é o esperado (spec, 6.4).
13. Conferir na aba Network que **nenhuma consulta de Instagram saiu durante a
    varredura**. Se alguma sair antes do laço encerrar, a trava da seção 6.4
    caiu e o desenho está errado.

### Resultado da verificação final

*(preencher ao executar — sem a saída conferida, a tarefa não está pronta)*

**O que este plano NÃO entrega**, tudo indo para o plano irmão:

- a **página de resultados** em aba própria da extensão, e a gravação dos
  aprovados no `chrome.storage.local` que a alimenta. Medido: 3.569 bytes por
  anúncio, 349 KB para 100 aprovados, contra 10 MB de quota;
- o **clique no ícone da extensão** que reabre essa página — o `action` no
  manifest, que hoje não existe;
- a **ordenação dos aprovados** por tempo ativo, colação e presença (spec, 8).

---

## Autorrevisão do plano

Feita contra o spec em 2026-09-10, antes da primeira execução.

**Cobertura das seções do spec:**

| Seção | Onde |
|---|---|
| 7.1 três enxertos, divisor, estilos por papel | Tasks 2 e 9 |
| 7.1 uma gaveta por vez | Task 3 |
| 7.2 calendário com atalhos e aplicar | Task 5 |
| 7.2 critérios, alvo e "Vai varrer" | Task 6 |
| 7.2 toggle Instagram | Task 6 |
| 6.4 pós-filtro de Instagram, depois do laço | Task 10 |
| 7.3 o que desaparece | Task 9 |
| 7.4 faixa no lugar dos modos | já entregue pelo plano do motor |
| 7.5 exemplos, sem aviso de operadores | Task 4 |
| 7.6 ordenação e recarga | Tasks 7 e 9 |
| 7.7 degradar em silêncio | Tasks 1 e 2 |
| 7.9 progresso na página | Tasks 8 e 9 |
| 6.2 a interface não fala de risco | Task 8 |
| 8 tela de resultados | **fora** — plano irmão |

**Consistência de nomes entre tarefas:** `acharLinhaDaBusca` (Task 1) é o que
a Task 2 consome; `alternarGaveta`/`fecharGaveta` (Task 3) são os nomes usados
na Task 9; `PedidoMineracao` (Task 6) é o tipo que `dispararMineracao` recebe;
`Progresso` e `EstadoMineracao` vêm de `src/core/miner.ts`, que já existe e
não é tocado.

**Riscos conhecidos, registrados de propósito:**

1. `acharLinhaDaBusca` **foi validada contra a Meta real** em 2026-09-10,
   depois de a primeira versão da regra ter falhado ali. A regra que este
   plano traz plantou um enxerto de 36 px na linha da busca, em 1602 px e em
   1038 px. O risco que restava foi gasto aqui.
2. A forma de coluna **não foi observada de forma estável** em nenhuma largura
   entre 762 e 1602 px. O suporte a ela fica no código porque é barato e cobre
   o estado transitório de carregamento, mas nenhuma decisão de produto se
   apoia nela.
3. A troca de país ou categoria pelo dropdown da Meta não foi verificada. A
   busca nova, que é a mudança mais comum, foi.
