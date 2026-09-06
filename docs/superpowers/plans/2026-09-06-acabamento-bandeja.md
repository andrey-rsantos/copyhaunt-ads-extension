# Acabamento visual — a bandeja no card · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plantar em cada card da Biblioteca uma bandeja de botões e o badge de dias ativos, com a identidade CopyHaunt, sem tocar no layout da Meta.

**Architecture:** Cada bandeja vive em seu próprio shadow root, e todos compartilham uma única folha de estilo construída. O plantio é idempotente e observa a grade com `MutationObserver` em lote, porque a Meta recicla nós durante a rolagem.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 7, A1 e A2)
**IDV:** `CopyHaunt-IDV.md` — normativo para cores, tipografia e raios.

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e um único host.
- **Nenhuma requisição à Meta.**
- **Não quebrar o layout da Meta.** Nada de `border` no card (deslocaria todos
  os cards em 2px); nada de mudar `display`, `width` ou `margin` deles.
- **Cores só do `CopyHaunt-IDV.md`.** Nunca inventar hexadecimal.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e para.
- **Commits:** padrão de `AGENTS.md`, tipo em inglês, texto em pt-BR.

## Decisões de desenho, e o motivo de cada uma

**Shadow root por bandeja, folha construída compartilhada.** Um iframe por card
seria inviável com 25 cards. O shadow root isola nosso CSS do deles e o deles
do nosso. A `CSSStyleSheet` é construída uma única vez e adotada por todos os
shadow roots, então o custo de memória não cresce com o número de cards.

**`outline`, não `border`, para destacar.** `border` ocupa espaço e empurraria
todos os cards da grade. `outline` é desenhado por fora da caixa e não afeta
layout nenhum.

**`position: relative` no card só se ele for `static`.** A bandeja é
posicionada de forma absoluta sobre o card, o que exige um ancestral
posicionado. Mexer nisso quando a Meta já posicionou seria alterar o layout
deles.

**Plantio idempotente.** A Meta recicla nós durante a rolagem: o mesmo
elemento pode reaparecer com outro anúncio. Cada bandeja carrega o ID que
plantou, e replantar num card que mudou de anúncio troca o conteúdo em vez de
duplicar.

---

## Task 1: Estilo isolado e compartilhado

**Files:**
- Create: `src/content/estilo.ts`
- Test: `tests/estilo.test.ts`

**Interfaces:**
- Produces: de `src/content/estilo.ts` —
  `CSS_BANDEJA: string`,
  `criarShadow(host: HTMLElement): ShadowRoot`,
  `folhaCompartilhada(): CSSStyleSheet | null`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/estilo.test.ts`:

```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { criarShadow, CSS_BANDEJA } from '../src/content/estilo'

const IDV = readFileSync(
  resolve(import.meta.dirname, '..', 'CopyHaunt-IDV.md'),
  'utf8',
)

describe('CSS_BANDEJA', () => {
  it.each(['#7C3AED', '#A855F7', '#C4A7FF'])(
    'usa a cor %s, que consta no IDV',
    (cor) => {
      expect(CSS_BANDEJA).toContain(cor)
      expect(IDV).toContain(cor)
    },
  )

  it('não inventa cor fora do IDV', () => {
    const usadas = CSS_BANDEJA.match(/#[0-9A-Fa-f]{6}/g) ?? []
    for (const cor of new Set(usadas)) {
      // Branco é permitido: o IDV o define como texto principal.
      if (cor.toUpperCase() === '#FFFFFF') continue
      expect(IDV, `${cor} não está no IDV`).toContain(cor.toUpperCase())
    }
  })

  it('não usa border no card, que deslocaria a grade', () => {
    expect(CSS_BANDEJA).not.toMatch(/\bborder\s*:/)
  })
})

describe('criarShadow', () => {
  it('cria um shadow root aberto no host', () => {
    const host = document.createElement('div')
    const shadow = criarShadow(host)
    expect(shadow).toBeTruthy()
    expect(host.shadowRoot).toBe(shadow)
  })

  it('devolve o mesmo shadow se já existir', () => {
    const host = document.createElement('div')
    const a = criarShadow(host)
    const b = criarShadow(host)
    expect(b).toBe(a)
  })

  it('o estilo fica dentro do shadow, não vaza para o documento', () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    criarShadow(host)
    // Nenhum <style> nosso no documento principal.
    expect(document.head.querySelector('style[data-copyhaunt]')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/estilo.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/content/estilo.ts`:

```ts
/**
 * Estilo da bandeja, com as cores normativas de `CopyHaunt-IDV.md`.
 *
 * Vive dentro de shadow root: o CSS da Meta não alcança o nosso, e o nosso
 * não alcança o deles. Nenhuma regra aqui pode usar `border` no card — isso
 * ocuparia espaço e empurraria todos os cards da grade.
 */
export const CSS_BANDEJA = `
  :host { all: initial; }

  .bandeja {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    gap: 6px;
    z-index: 9;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
  }

  .botao {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    background: #7C3AED;
    color: #FFFFFF;
    cursor: pointer;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.18);
    transition: filter 150ms ease;
    user-select: none;
    font-size: 13px;
    line-height: 1;
  }
  .botao:hover { filter: brightness(1.15); }

  .badge {
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 9;
    padding: 4px 9px;
    border-radius: 9px;
    background: #08070D;
    color: #FFFFFF;
    font-family: Sora, Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .badge[data-faixa="novo"] { color: #C4A7FF; }
  .badge[data-faixa="provado"] { color: #7C3AED; }
  .badge[data-faixa="validado"] {
    color: #A855F7;
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.25);
  }
`

let folha: CSSStyleSheet | null = null

/**
 * Uma folha construída para todos os shadow roots.
 *
 * Construída uma vez e adotada por todos: com 25 cards na tela, duplicar o
 * CSS 25 vezes seria desperdício puro.
 */
export function folhaCompartilhada(): CSSStyleSheet | null {
  if (typeof CSSStyleSheet === 'undefined') return null
  if (folha) return folha
  try {
    folha = new CSSStyleSheet()
    folha.replaceSync(CSS_BANDEJA)
    return folha
  } catch {
    return null // navegador sem folha construída: cai para <style>
  }
}

/** Cria (ou reaproveita) o shadow root do host, já com o estilo dentro. */
export function criarShadow(host: HTMLElement): ShadowRoot {
  if (host.shadowRoot) return host.shadowRoot

  const shadow = host.attachShadow({ mode: 'open' })
  const compartilhada = folhaCompartilhada()

  if (compartilhada && 'adoptedStyleSheets' in shadow) {
    shadow.adoptedStyleSheets = [compartilhada]
  } else {
    const style = document.createElement('style')
    style.textContent = CSS_BANDEJA
    shadow.appendChild(style)
  }

  return shadow
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/estilo.test.ts
```

Esperado: PASSA, 7 testes verdes.

---

## Task 2: A bandeja e o badge

**Files:**
- Create: `src/content/tray.ts`
- Test: `tests/tray.test.ts`

**Interfaces:**
- Consumes: `criarShadow` de `estilo.ts`; `diasAtivos` e `faixaBadge` de
  `src/core/display.ts`; `Ad` de `src/core/types.ts`.
- Produces: de `src/content/tray.ts` —
  `ATRIBUTO_ID = 'data-copyhaunt-id'`,
  `plantarBandeja(card: HTMLElement, ad: Ad, agora: Date): void`,
  `aplicarVeredito(card: HTMLElement, passa: boolean): void`,
  `limparVeredito(card: HTMLElement): void`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/tray.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  aplicarVeredito,
  ATRIBUTO_ID,
  limparVeredito,
  plantarBandeja,
} from '../src/content/tray'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')

function ad(id = '1', iniciouEm = new Date('2026-08-01T12:00:00Z')): Ad {
  return {
    id,
    iniciouEm,
    colacao: 3,
    anunciante: { pageId: 'p', pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

function card(): HTMLElement {
  const el = document.createElement('div')
  el.textContent = 'Library ID: 1'
  document.body.appendChild(el)
  return el
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('plantarBandeja', () => {
  it('planta um host com shadow root no card', () => {
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    const host = c.querySelector(`[${ATRIBUTO_ID}]`) as HTMLElement
    expect(host).toBeTruthy()
    expect(host.shadowRoot).toBeTruthy()
  })

  it('marca o host com o id do anúncio', () => {
    const c = card()
    plantarBandeja(c, ad('652131454176487'), AGORA)
    const host = c.querySelector(`[${ATRIBUTO_ID}]`)
    expect(host?.getAttribute(ATRIBUTO_ID)).toBe('652131454176487')
  })

  it('plantar duas vezes não duplica', () => {
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    plantarBandeja(c, ad(), AGORA)
    expect(c.querySelectorAll(`[${ATRIBUTO_ID}]`)).toHaveLength(1)
  })

  it('replantar com outro anúncio troca o conteúdo, não duplica', () => {
    // A Meta recicla nós na rolagem: o mesmo elemento reaparece com outro ad.
    const c = card()
    plantarBandeja(c, ad('111'), AGORA)
    plantarBandeja(c, ad('222'), AGORA)
    const hosts = c.querySelectorAll(`[${ATRIBUTO_ID}]`)
    expect(hosts).toHaveLength(1)
    expect(hosts[0].getAttribute(ATRIBUTO_ID)).toBe('222')
  })

  it('exibe os dias ativos no badge', () => {
    const c = card()
    plantarBandeja(c, ad('1', new Date('2026-08-01T12:00:00Z')), AGORA)
    const badge = c
      .querySelector(`[${ATRIBUTO_ID}]`)
      ?.shadowRoot?.querySelector('.badge')
    expect(badge?.textContent).toContain('36')
  })

  it('marca a faixa do badge conforme os dias', () => {
    const c = card()
    plantarBandeja(c, ad('1', new Date('2026-09-05T12:00:00Z')), AGORA)
    const badge = c
      .querySelector(`[${ATRIBUTO_ID}]`)
      ?.shadowRoot?.querySelector('.badge')
    expect(badge?.getAttribute('data-faixa')).toBe('novo')
  })

  it('planta os três botões da bandeja', () => {
    const c = card()
    plantarBandeja(c, ad(), AGORA)
    const botoes = c
      .querySelector(`[${ATRIBUTO_ID}]`)
      ?.shadowRoot?.querySelectorAll('.botao')
    expect(botoes).toHaveLength(3)
  })

  it('posiciona o card só se ele for estático', () => {
    const c = card()
    c.style.position = 'absolute'
    plantarBandeja(c, ad(), AGORA)
    // Já estava posicionado: não mexemos.
    expect(c.style.position).toBe('absolute')
  })

  it('não altera o texto original do card', () => {
    const c = card()
    const antes = c.textContent
    plantarBandeja(c, ad(), AGORA)
    expect(c.textContent).toContain(antes ?? '')
  })
})

describe('aplicarVeredito', () => {
  it('esconde o card reprovado', () => {
    const c = card()
    aplicarVeredito(c, false)
    expect(c.style.display).toBe('none')
  })

  it('destaca o card aprovado com outline, nunca border', () => {
    const c = card()
    aplicarVeredito(c, true)
    expect(c.style.display).not.toBe('none')
    expect(c.style.outline).toContain('#7C3AED')
    // border deslocaria todos os cards da grade.
    expect(c.style.border).toBe('')
  })

  it('limparVeredito devolve o card ao estado original', () => {
    const c = card()
    aplicarVeredito(c, false)
    limparVeredito(c)
    expect(c.style.display).toBe('')
    expect(c.style.outline).toBe('')
  })

  it('aprovar depois de reprovar volta a exibir', () => {
    const c = card()
    aplicarVeredito(c, false)
    aplicarVeredito(c, true)
    expect(c.style.display).not.toBe('none')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/tray.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/content/tray.ts`:

```ts
import { diasAtivos, faixaBadge } from '../core/display'
import type { Ad } from '../core/types'
import { criarShadow } from './estilo'

export const ATRIBUTO_ID = 'data-copyhaunt-id'

const BOTOES = [
  { chave: 'baixar', glifo: '⤓', titulo: 'Baixar criativo' },
  { chave: 'copiar', glifo: '⧉', titulo: 'Copiar texto' },
  { chave: 'abrir', glifo: '↗', titulo: 'Abrir links' },
]

/**
 * Planta a bandeja e o badge no card.
 *
 * Idempotente por desenho: a Meta recicla nós durante a rolagem, e o mesmo
 * elemento pode reaparecer com outro anúncio. O host carrega o ID que
 * plantou; replantar com ID diferente troca o conteúdo em vez de duplicar.
 */
export function plantarBandeja(
  card: HTMLElement,
  ad: Ad,
  agora: Date,
): void {
  const existente = card.querySelector<HTMLElement>(`[${ATRIBUTO_ID}]`)
  if (existente?.getAttribute(ATRIBUTO_ID) === ad.id) return

  // A bandeja é posicionada de forma absoluta sobre o card, o que exige um
  // ancestral posicionado. Se a Meta já posicionou, não mexemos.
  if (getComputedStyle(card).position === 'static') {
    card.style.position = 'relative'
  }

  const host = existente ?? document.createElement('div')
  host.setAttribute(ATRIBUTO_ID, ad.id)
  if (!existente) card.prepend(host)

  const shadow = criarShadow(host)
  const dias = diasAtivos(ad.iniciouEm, agora)

  shadow.querySelector('.raiz')?.remove()
  const raiz = document.createElement('div')
  raiz.className = 'raiz'

  const bandeja = document.createElement('div')
  bandeja.className = 'bandeja'
  for (const b of BOTOES) {
    const botao = document.createElement('div')
    botao.className = 'botao'
    botao.dataset.acao = b.chave
    botao.title = b.titulo
    botao.textContent = b.glifo
    bandeja.appendChild(botao)
  }

  const badge = document.createElement('div')
  badge.className = 'badge'
  badge.dataset.faixa = faixaBadge(dias)
  badge.textContent = `${dias} DIAS`

  raiz.append(bandeja, badge)
  shadow.appendChild(raiz)
}

/**
 * Esconde o card reprovado, destaca o aprovado.
 *
 * O destaque é `outline`, nunca `border`: border ocupa espaço e empurraria
 * todos os cards da grade em dois pixels.
 */
export function aplicarVeredito(card: HTMLElement, passa: boolean): void {
  if (passa) {
    card.style.display = ''
    card.style.outline = '2px solid #7C3AED'
    card.style.outlineOffset = '-2px'
    card.style.boxShadow = '0 0 20px rgba(124, 58, 237, 0.18)'
    card.style.borderRadius = '14px'
  } else {
    card.style.display = 'none'
  }
}

/** Devolve o card ao estado em que a Meta o entregou. */
export function limparVeredito(card: HTMLElement): void {
  card.style.display = ''
  card.style.outline = ''
  card.style.outlineOffset = ''
  card.style.boxShadow = ''
  card.style.borderRadius = ''
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/tray.test.ts
```

Esperado: PASSA, 13 testes verdes.

---

## Task 3: Plantar em toda a grade, e ver na Biblioteca real

**Files:**
- Create: `src/content/overlay.ts`
- Modify: `src/content/index.ts` (chamar o overlay quando o índice mudar)
- Test: `tests/overlay.test.ts`
- Test: `e2e/overlay.spec.ts`

**Interfaces:**
- Consumes: `acharCards` de `anchor.ts`; `plantarBandeja` e `aplicarVeredito`
  de `tray.ts`; `AdStore`; `Criterios` e `avaliar` de `criteria.ts`.
- Produces: de `src/content/overlay.ts` —
  `interface ResumoOverlay { plantados: number; aprovados: number; escondidos: number }`
  e `pintarGrade(raiz: ParentNode, store: AdStore, criterios: Criterios, agora: Date, esconderReprovados: boolean): ResumoOverlay`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/overlay.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { pintarGrade } from '../src/content/overlay'
import { ATRIBUTO_ID } from '../src/content/tray'
import { CRITERIOS_PADRAO, type Criterios } from '../src/core/criteria'
import { AdStore } from '../src/core/store'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')
const SO_COLACAO: Criterios = {
  ...CRITERIOS_PADRAO,
  diasMin: null,
  diasMax: null,
  presencaMinima: null,
}

function ad(id: string, colacao: number): Ad {
  return {
    id,
    iniciouEm: new Date('2026-08-01T12:00:00Z'),
    colacao,
    anunciante: { pageId: 'p', pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

function montarGrade(ids: string[]): void {
  const grade = document.createElement('div')
  for (const id of ids) {
    const card = document.createElement('div')
    const span = document.createElement('span')
    span.textContent = `Library ID: ${id}`
    card.appendChild(span)
    const extra = document.createElement('div')
    extra.textContent = 'Started running'
    card.appendChild(extra)
    grade.appendChild(card)
  }
  document.body.appendChild(grade)
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('pintarGrade', () => {
  it('planta bandeja só nos cards cujo anúncio está no índice', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(r.plantados).toBe(1)
    expect(document.querySelectorAll(`[${ATRIBUTO_ID}]`)).toHaveLength(1)
  })

  it('aprova e reprova conforme os critérios', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9), ad('222222222222222', 1)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(r.aprovados).toBe(1)
  })

  it('esconde os reprovados quando pedido', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9), ad('222222222222222', 1)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, true)
    expect(r.escondidos).toBe(1)
  })

  it('não esconde nada quando não pedido', () => {
    montarGrade(['222222222222222'])
    const store = new AdStore()
    store.adicionar([ad('222222222222222', 1)])

    const r = pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(r.escondidos).toBe(0)
  })

  it('pintar duas vezes não duplica bandejas', () => {
    montarGrade(['111111111111111'])
    const store = new AdStore()
    store.adicionar([ad('111111111111111', 9)])

    pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    pintarGrade(document.body, store, SO_COLACAO, AGORA, false)
    expect(document.querySelectorAll(`[${ATRIBUTO_ID}]`)).toHaveLength(1)
  })

  it('grade vazia devolve tudo zerado', () => {
    const r = pintarGrade(document.body, new AdStore(), SO_COLACAO, AGORA, true)
    expect(r).toEqual({ plantados: 0, aprovados: 0, escondidos: 0 })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/overlay.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/content/overlay.ts`:

```ts
import { avaliar, type Criterios } from '../core/criteria'
import type { AdStore } from '../core/store'
import { acharCards } from './anchor'
import { aplicarVeredito, plantarBandeja } from './tray'

export interface ResumoOverlay {
  plantados: number
  aprovados: number
  escondidos: number
}

/**
 * Percorre a grade e pinta cada card cujo anúncio já esteja indexado.
 *
 * Cards sem anúncio conhecido ficam intocados: o payload pode chegar depois
 * do DOM, e mexer neles agora seria esconder o que ainda vamos aprovar.
 */
export function pintarGrade(
  raiz: ParentNode,
  store: AdStore,
  criterios: Criterios,
  agora: Date,
  esconderReprovados: boolean,
): ResumoOverlay {
  const resumo: ResumoOverlay = { plantados: 0, aprovados: 0, escondidos: 0 }

  for (const [id, card] of acharCards(raiz)) {
    const ad = store.obter(id)
    if (!ad) continue

    plantarBandeja(card, ad, agora)
    resumo.plantados += 1

    const veredito = avaliar(ad, criterios, {
      presenca: store.presenca(ad.anunciante.pageId),
      agora,
    })

    if (veredito.passa) {
      aplicarVeredito(card, true)
      resumo.aprovados += 1
    } else if (esconderReprovados) {
      aplicarVeredito(card, false)
      resumo.escondidos += 1
    }
  }

  return resumo
}
```

- [ ] **Step 4: Ligar no content script**

Em `src/content/index.ts`, acrescentar aos imports:

```ts
import { CRITERIOS_PADRAO } from '../core/criteria'
import { pintarGrade } from './overlay'
```

E, dentro do bloco que trata `raw-capture`, logo após o `console.info` de
indexados, acrescentar:

```ts
    if (resultado.novos > 0) {
      const r = pintarGrade(
        document.body,
        store,
        CRITERIOS_PADRAO,
        new Date(),
        false,
      )
      console.info(
        `[CopyHaunt] pintados: ${r.plantados} | aprovados: ${r.aprovados}`,
      )
    }
```

- [ ] **Step 5: Escrever o teste de navegador com captura de tela**

Criar `e2e/overlay.spec.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

const CAPTURAS = resolve(import.meta.dirname, '..', 'capturas')

/**
 * Prova que a bandeja aparece nos cards da Biblioteca real, e guarda
 * capturas de tela para conferência humana do acabamento.
 */
test('a bandeja aparece nos cards reais', async ({ context }) => {
  mkdirSync(CAPTURAS, { recursive: true })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  const linhas: string[] = []
  page.on('console', (m) => {
    if (m.text().includes('[CopyHaunt]')) linhas.push(m.text())
  })

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(2500)
  }
  await page.mouse.wheel(0, -20000)
  await page.waitForTimeout(2000)

  const bandejas = await page
    .locator('[data-copyhaunt-id]')
    .count()

  console.log('  bandejas plantadas:', bandejas)
  for (const l of linhas.filter((l) => l.includes('pintados'))) {
    console.log('  ' + l)
  }

  await page.screenshot({
    path: resolve(CAPTURAS, 'grade-completa.png'),
    fullPage: false,
  })

  const primeiro = page.locator('[data-copyhaunt-id]').first()
  const card = primeiro.locator('xpath=..')
  await card.screenshot({ path: resolve(CAPTURAS, 'card-detalhe.png') })

  expect(bandejas).toBeGreaterThan(5)
})
```

- [ ] **Step 6: Ignorar as capturas no git**

Acrescentar ao final de `.gitignore`:

```
# Capturas de tela para conferência
/capturas
```

- [ ] **Step 7: Compilar e rodar**

```bash
npm.cmd run build
npx.cmd playwright test e2e/overlay.spec.ts --timeout=120000
```

Esperado: PASSA, com `bandejas plantadas:` acima de 5, e dois arquivos em
`capturas/`.

**Se nenhuma bandeja aparecer, PARE e reporte** as linhas de console.

- [ ] **Step 8: Rodar tudo**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

- [ ] **Step 9: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): plantar a bandeja e o badge nos cards

O que foi feito:
- Plantar bandeja de botões e badge de dias em cada card indexado
- Destacar os aprovados e permitir esconder os reprovados
- Guardar capturas de tela da Biblioteca real para conferência humana

Como foi feito:
- Cada bandeja vive em shadow root próprio, e todos compartilham uma única
  CSSStyleSheet construída: com 25 cards na tela, duplicar o CSS 25 vezes
  seria desperdício
- O destaque usa outline, nunca border: border ocupa espaço e empurraria
  todos os cards da grade em dois pixels
- O card só recebe position relative se estiver estático, para não desfazer
  posicionamento que a Meta já tenha aplicado
- O plantio é idempotente e carrega o id do anúncio: a Meta recicla nós na
  rolagem, e o mesmo elemento reaparece com outro anúncio

Considerações:
- Cards cujo anúncio ainda não está indexado ficam intocados. O payload pode
  chegar depois do DOM, e escondê-los agora seria ocultar o que ainda vamos
  aprovar
- As cores saem todas do CopyHaunt-IDV.md, e há teste que reprova qualquer
  hexadecimal que não conste lá
```

---

## Verificação final

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git status --short
```

**O que este plano NÃO entrega:** o menu OPEN funcional ao clicar, o download
em HD com ZIP, a cópia de texto e o painel de controle da mineração. Os botões
são plantados com os glifos e os títulos, mas ainda sem ação — cada um deles
tem comportamento próprio e merece seu próprio ciclo.
