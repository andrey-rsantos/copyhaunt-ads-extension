# Bloco A — Overlay · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Plantar a bandeja de botões, o badge de dias ativos, o menu OPEN e o filtro de data nos cards da Biblioteca de Anúncios.

**Architecture:** O content script indexa os `Ad` que chegam do normalizador, encontra os cards no DOM pelo ID da biblioteca, e injeta em cada um uma bandeja isolada por shadow root. Toda a lógica de cálculo é pura e testada sem navegador; só a injeção depende do DOM.

**Tech Stack:** TypeScript 7, Vitest 5, jsdom 30, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 7, Bloco A)
**Planos anteriores:** `2026-09-05-interceptador.md`, `2026-09-06-normalizador.md`

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e um único host.
- **Coleta passiva.** Nada neste plano emite requisição à Meta. A exceção do
  Instagram (seção 7 do spec) **não entra aqui** — fica para o plano do menu
  OPEN com requisição, depois.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e para.
- **Commits:** padrão de `CLAUDE.md`, tipo em inglês, texto em pt-BR.
- **Cores vêm de `src/styles/tokens.css`.** Nunca escrever hexadecimal solto.

## O DOM real, medido

Levantado num navegador de verdade, na Biblioteca real. **Não é suposição.**

```
n=0  span  w=164  h=14   "Library ID: 2366492917183805"
n=4  div   w=169  h=99
n=7  div   w=392  h=485
n=8  div   w=392  h=557   ← O CARD
n=9  div   w=1280 h=5423  ← a grade, com os 25 cards
```

**Regra de ancoragem:** o card é o **último ancestral que ainda contém
exatamente um ID de biblioteca**. Subindo 8 níveis a partir de cada uma das 25
folhas encontradas, obtêm-se 25 cards distintos — correspondência perfeita.

A regra não depende de classe CSS, rótulo de texto nem profundidade fixa. Se a
Meta mudar o aninhamento, ela se ajusta sozinha.

### Três armadilhas medidas

**1. A regex não pode ter `\b` no fim.** O `textContent` concatena sem espaço,
e o ID encosta na palavra seguinte (`...183805Started running`). Como dígito e
letra são ambos caracteres de palavra, o `\b` falha. Usar:

```ts
/(?<!\d)(\d{15,17})(?!\d)/
```

**2. A interface muda de idioma.** Em sessão anônima a Biblioteca responde em
inglês (`Library ID`, `Started running`); logado em pt-BR, em português.
**Nunca ancorar por rótulo** — só pelo número.

**3. A grade leva cerca de 5 segundos para renderizar.** Antes disso o corpo
tem 376 caracteres e nenhum card. Qualquer teste de navegador precisa esperar
o primeiro card aparecer, não um tempo fixo.

## Estrutura de arquivos ao final

```
src/
├─ core/
│  ├─ store.ts        índice de anúncios e presença por anunciante
│  ├─ display.ts      dias ativos, faixa do badge, rótulos
│  ├─ links.ts        os seis destinos do menu OPEN
│  └─ dateFilter.ts   filtro de data por reescrita de URL
├─ content/
│  ├─ anchor.ts       acha cards e grade no DOM
│  └─ tray.ts         planta a bandeja isolada por shadow root
tests/
├─ store.test.ts
├─ display.test.ts
├─ links.test.ts
├─ dateFilter.test.ts
└─ anchor.test.ts     jsdom
e2e/
└─ overlay.spec.ts    a bandeja aparece na Biblioteca real
```

---

## Task 1: Ancoragem no DOM

**Files:**
- Create: `src/content/anchor.ts`
- Test: `tests/anchor.test.ts`
- Modify: `vitest.config.ts` (ambiente jsdom para este arquivo)

**Interfaces:**
- Produces: de `src/content/anchor.ts` —
  `PADRAO_LIBRARY_ID: RegExp`,
  `extrairLibraryId(texto: string): string | null`,
  `acharCards(raiz: ParentNode): Map<string, HTMLElement>`,
  `acharGrade(cards: Map<string, HTMLElement>): HTMLElement | null`.

- [ ] **Step 1: Permitir jsdom por arquivo no Vitest**

Substituir `vitest.config.ts` inteiro:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Padrão continua node; arquivos que precisam de DOM declaram
    // `@vitest-environment jsdom` no topo.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `tests/anchor.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import {
  acharCards,
  acharGrade,
  extrairLibraryId,
  PADRAO_LIBRARY_ID,
} from '../src/content/anchor'

/** Monta uma grade parecida com a da Meta: id enterrado fundo no card. */
function montarGrade(ids: string[], rotulo = 'Library ID: '): HTMLElement {
  const grade = document.createElement('div')
  for (const id of ids) {
    const card = document.createElement('div')
    let atual = card
    // Oito níveis, como medido no DOM real.
    for (let i = 0; i < 7; i += 1) {
      const filho = document.createElement('div')
      atual.appendChild(filho)
      atual = filho
    }
    const span = document.createElement('span')
    span.textContent = `${rotulo}${id}`
    atual.appendChild(span)
    // Um irmão com texto, para o card não ser só o id.
    const extra = document.createElement('div')
    extra.textContent = 'Started running on Apr 17, 2026'
    card.appendChild(extra)
    grade.appendChild(card)
  }
  document.body.appendChild(grade)
  return grade
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('extrairLibraryId', () => {
  it('extrai o id de um texto com rótulo', () => {
    expect(extrairLibraryId('Library ID: 2366492917183805')).toBe(
      '2366492917183805',
    )
  })

  it('funciona em português', () => {
    expect(
      extrairLibraryId('Identificação da biblioteca: 2366492917183805'),
    ).toBe('2366492917183805')
  })

  it('acha o id mesmo colado na palavra seguinte', () => {
    // textContent concatena sem espaço: um \b no fim da regex falharia aqui.
    expect(extrairLibraryId('ID: 2366492917183805Started running')).toBe(
      '2366492917183805',
    )
  })

  it('ignora número curto demais', () => {
    expect(extrairLibraryId('total 12345')).toBeNull()
  })

  it('ignora número longo demais', () => {
    expect(extrairLibraryId('x 123456789012345678901')).toBeNull()
  })

  it('devolve null quando não há id', () => {
    expect(extrairLibraryId('Started running on Apr 17')).toBeNull()
  })
})

describe('PADRAO_LIBRARY_ID', () => {
  it('não usa \\b no fim, que quebraria com texto colado', () => {
    expect(PADRAO_LIBRARY_ID.source).not.toContain('\\b')
  })
})

describe('acharCards', () => {
  it('acha um card por id', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const cards = acharCards(document.body)
    expect(cards.size).toBe(2)
    expect(cards.has('111111111111111')).toBe(true)
    expect(cards.has('222222222222222')).toBe(true)
  })

  it('o elemento devolvido contém exatamente um id', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const card = acharCards(document.body).get('111111111111111')
    const achados = (card?.textContent ?? '').match(
      new RegExp(PADRAO_LIBRARY_ID.source, 'g'),
    )
    expect(achados).toHaveLength(1)
  })

  it('o card não é a folha: contém também o resto do texto', () => {
    montarGrade(['111111111111111'])
    const card = acharCards(document.body).get('111111111111111')
    expect(card?.textContent).toContain('Started running')
  })

  it('funciona com rótulo em português', () => {
    montarGrade(['333333333333333'], 'Identificação da biblioteca: ')
    expect(acharCards(document.body).size).toBe(1)
  })

  it('devolve vazio quando não há card', () => {
    document.body.innerHTML = '<div>nada aqui</div>'
    expect(acharCards(document.body).size).toBe(0)
  })

  it('não devolve o mesmo elemento para ids diferentes', () => {
    montarGrade(['111111111111111', '222222222222222'])
    const cards = acharCards(document.body)
    const a = cards.get('111111111111111')
    const b = cards.get('222222222222222')
    expect(a).not.toBe(b)
  })
})

describe('acharGrade', () => {
  it('devolve o ancestral comum dos cards', () => {
    const grade = montarGrade(['111111111111111', '222222222222222'])
    expect(acharGrade(acharCards(document.body))).toBe(grade)
  })

  it('devolve null sem cards', () => {
    expect(acharGrade(new Map())).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

```bash
npx.cmd vitest run tests/anchor.test.ts
```

Esperado: FALHA, resolução de `../src/content/anchor`.

- [ ] **Step 4: Instalar jsdom**

```bash
npm.cmd install -D jsdom@30.0.1
```

- [ ] **Step 5: Escrever a implementação**

Criar `src/content/anchor.ts`:

```ts
/**
 * O ID da biblioteca é a âncora entre o DOM e os dados.
 *
 * Sem `\b` no fim de propósito: `textContent` concatena sem espaço, e o
 * número encosta na palavra seguinte (`...183805Started running`). Como
 * dígito e letra são ambos caracteres de palavra, `\b` não casaria ali.
 */
export const PADRAO_LIBRARY_ID = /(?<!\d)(\d{15,17})(?!\d)/

export function extrairLibraryId(texto: string): string | null {
  return texto.match(PADRAO_LIBRARY_ID)?.[1] ?? null
}

function contarIds(texto: string): number {
  const g = new RegExp(PADRAO_LIBRARY_ID.source, 'g')
  return new Set(texto.match(g) ?? []).size
}

/**
 * Encontra os cards e os indexa pelo ID da biblioteca.
 *
 * A regra: sobe a partir da folha que contém o ID enquanto o ancestral ainda
 * contiver **exatamente um** ID. O último que satisfaz isso é o card.
 *
 * Não depende de classe CSS, de rótulo nem de profundidade fixa — quando a
 * Meta mexer no aninhamento, a regra se ajusta sozinha.
 */
export function acharCards(raiz: ParentNode): Map<string, HTMLElement> {
  const cards = new Map<string, HTMLElement>()

  for (const el of Array.from(raiz.querySelectorAll('span, div, a'))) {
    if (el.children.length > 0) continue
    const id = extrairLibraryId(el.textContent ?? '')
    if (!id || cards.has(id)) continue

    let card = el as HTMLElement
    let pai = card.parentElement
    while (pai && contarIds(pai.textContent ?? '') === 1) {
      card = pai
      pai = card.parentElement
    }
    cards.set(id, card)
  }

  return cards
}

/** O container da grade é o pai comum dos cards. */
export function acharGrade(
  cards: Map<string, HTMLElement>,
): HTMLElement | null {
  const primeiro = cards.values().next().value
  return primeiro?.parentElement ?? null
}
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

```bash
npx.cmd vitest run tests/anchor.test.ts
```

Esperado: PASSA, 12 testes verdes.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): ancorar os cards do DOM pelo ID da biblioteca

Como foi feito:
- O card é o último ancestral que ainda contém exatamente um ID. A regra não
  depende de classe CSS, rótulo nem profundidade fixa, então se ajusta quando
  a Meta mexer no aninhamento
- A regex não tem \b no fim: textContent concatena sem espaço e o número
  encosta na palavra seguinte, onde \b não casaria

Considerações:
- Medido no DOM real: subindo a partir de cada uma das 25 folhas com ID
  chega-se a 25 cards distintos, correspondência perfeita
- A âncora é o número, nunca o rótulo: a interface responde em inglês numa
  sessão anônima e em português quando logada
```

---

## Task 2: Índice de anúncios e presença do anunciante

**Files:**
- Create: `src/core/store.ts`
- Test: `tests/store.test.ts`

**Interfaces:**
- Consumes: `Ad` de `src/core/types.ts`.
- Produces: classe `AdStore` com
  `adicionar(ads: Ad[]): void`,
  `obter(id: string): Ad | undefined`,
  `presenca(pageId: string): number`,
  `total(): number`,
  `todos(): Ad[]`,
  `limpar(): void`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/store.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { AdStore } from '../src/core/store'
import type { Ad } from '../src/core/types'

function ad(id: string, pageId = '9', colacao = 1): Ad {
  return {
    id,
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao,
    anunciante: { pageId, pageName: 'Anunciante ' + pageId },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

describe('AdStore', () => {
  it('guarda e devolve por id', () => {
    const s = new AdStore()
    s.adicionar([ad('1'), ad('2')])
    expect(s.obter('1')?.id).toBe('1')
    expect(s.total()).toBe(2)
  })

  it('não duplica o mesmo anúncio', () => {
    const s = new AdStore()
    s.adicionar([ad('1')])
    s.adicionar([ad('1')])
    expect(s.total()).toBe(1)
  })

  it('conta a presença do anunciante na sessão', () => {
    const s = new AdStore()
    s.adicionar([ad('1', 'p1'), ad('2', 'p1'), ad('3', 'p2')])
    expect(s.presenca('p1')).toBe(2)
    expect(s.presenca('p2')).toBe(1)
  })

  it('presença não cresce com anúncio repetido', () => {
    const s = new AdStore()
    s.adicionar([ad('1', 'p1')])
    s.adicionar([ad('1', 'p1')])
    expect(s.presenca('p1')).toBe(1)
  })

  it('presença de anunciante desconhecido é zero', () => {
    expect(new AdStore().presenca('nunca-visto')).toBe(0)
  })

  it('limpar zera tudo', () => {
    const s = new AdStore()
    s.adicionar([ad('1', 'p1')])
    s.limpar()
    expect(s.total()).toBe(0)
    expect(s.presenca('p1')).toBe(0)
  })

  it('todos devolve na ordem de inserção', () => {
    const s = new AdStore()
    s.adicionar([ad('1'), ad('2'), ad('3')])
    expect(s.todos().map((a) => a.id)).toEqual(['1', '2', '3'])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/store.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/store.ts`:

```ts
import type { Ad } from './types'

/**
 * Índice em memória dos anúncios vistos na sessão.
 *
 * A presença por anunciante é contada aqui, incrementalmente: é o critério de
 * escala da seção 7 do spec, e sai de graça porque o `pageId` já vem em cada
 * anúncio. Nenhuma requisição é feita para obtê-la.
 */
export class AdStore {
  private readonly porId = new Map<string, Ad>()
  private readonly porAnunciante = new Map<string, number>()

  adicionar(ads: Ad[]): void {
    for (const ad of ads) {
      if (this.porId.has(ad.id)) continue
      this.porId.set(ad.id, ad)
      const pageId = ad.anunciante.pageId
      this.porAnunciante.set(pageId, (this.porAnunciante.get(pageId) ?? 0) + 1)
    }
  }

  obter(id: string): Ad | undefined {
    return this.porId.get(id)
  }

  /** Quantos anúncios deste anunciante apareceram nesta busca. */
  presenca(pageId: string): number {
    return this.porAnunciante.get(pageId) ?? 0
  }

  total(): number {
    return this.porId.size
  }

  todos(): Ad[] {
    return [...this.porId.values()]
  }

  limpar(): void {
    this.porId.clear()
    this.porAnunciante.clear()
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/store.test.ts
```

Esperado: PASSA, 7 testes verdes.

- [ ] **Step 5: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): indexar anúncios e contar presença do anunciante

Como foi feito:
- A presença é contada incrementalmente na inserção, não recalculada: o
  pageId já vem em cada anúncio, então o critério de escala sai de graça
- Anúncio repetido não incrementa nada, senão a presença inflaria a cada
  rolagem que reentrega os mesmos cards

Considerações:
- Mede presença no nicho pesquisado, não o total global do anunciante, como
  decidido na seção 7 do spec
```

---

## Task 3: Cálculos de exibição e links do menu OPEN

**Files:**
- Create: `src/core/display.ts`
- Create: `src/core/links.ts`
- Test: `tests/display.test.ts`
- Test: `tests/links.test.ts`

**Interfaces:**
- Produces: de `display.ts` — `diasAtivos(inicio: Date, agora: Date): number`,
  `faixaBadge(dias: number): 'novo' | 'provado' | 'validado'`.
- Produces: de `links.ts` — `type DestinoOpen = { chave: string; rotulo: string; url: string | null }`
  e `montarDestinos(ad: Ad): DestinoOpen[]`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/display.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { diasAtivos, faixaBadge } from '../src/core/display'

describe('diasAtivos', () => {
  it('conta zero no mesmo dia', () => {
    expect(
      diasAtivos(new Date('2026-09-06T08:00:00Z'), new Date('2026-09-06T20:00:00Z')),
    ).toBe(0)
  })

  it('conta um dia', () => {
    expect(
      diasAtivos(new Date('2026-09-05T00:00:00Z'), new Date('2026-09-06T00:00:00Z')),
    ).toBe(1)
  })

  it('atravessa virada de mês', () => {
    expect(
      diasAtivos(new Date('2026-08-30T00:00:00Z'), new Date('2026-09-02T00:00:00Z')),
    ).toBe(3)
  })

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    expect(
      diasAtivos(new Date('2024-02-28T00:00:00Z'), new Date('2024-03-01T00:00:00Z')),
    ).toBe(2)
  })

  it('nunca devolve negativo', () => {
    expect(
      diasAtivos(new Date('2026-09-10T00:00:00Z'), new Date('2026-09-06T00:00:00Z')),
    ).toBe(0)
  })
})

describe('faixaBadge', () => {
  it('menos de 7 dias é oferta nova', () => {
    expect(faixaBadge(0)).toBe('novo')
    expect(faixaBadge(6)).toBe('novo')
  })

  it('de 7 a 30 dias passou do teste', () => {
    expect(faixaBadge(7)).toBe('provado')
    expect(faixaBadge(30)).toBe('provado')
  })

  it('mais de 30 dias é validada', () => {
    expect(faixaBadge(31)).toBe('validado')
    expect(faixaBadge(141)).toBe('validado')
  })
})
```

Criar `tests/links.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { montarDestinos } from '../src/core/links'
import type { Ad } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    destino: 'https://exemplo.com/oferta?utm_source=fb',
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function url(ad: Ad, chave: string): string | null {
  return montarDestinos(ad).find((d) => d.chave === chave)?.url ?? null
}

describe('montarDestinos', () => {
  it('devolve os seis destinos, sempre na mesma ordem', () => {
    const chaves = montarDestinos(ad()).map((d) => d.chave)
    expect(chaves).toEqual([
      'site',
      'perfil',
      'instagram',
      'anunciosDoSite',
      'anunciosDoAnunciante',
      'permalink',
    ])
  })

  it('site é a URL de destino real, com parâmetros', () => {
    expect(url(ad(), 'site')).toBe('https://exemplo.com/oferta?utm_source=fb')
  })

  it('perfil usa o pageId', () => {
    expect(url(ad(), 'perfil')).toContain('378128628724966')
  })

  it('permalink aponta para o anúncio na Biblioteca', () => {
    const u = url(ad(), 'permalink') ?? ''
    expect(u).toContain('/ads/library/')
    expect(u).toContain('652131454176487')
  })

  it('anúncios do anunciante usa view_all_page_id', () => {
    expect(url(ad(), 'anunciosDoAnunciante')).toContain(
      'view_all_page_id=378128628724966',
    )
  })

  it('anúncios do site busca pelo domínio, sem o caminho', () => {
    const u = url(ad(), 'anunciosDoSite') ?? ''
    expect(u).toContain('exemplo.com')
    expect(u).not.toContain('utm_source')
  })

  it('sem destino, os itens de site ficam nulos', () => {
    const a = ad({ destino: undefined })
    expect(url(a, 'site')).toBeNull()
    expect(url(a, 'anunciosDoSite')).toBeNull()
  })

  it('deriva o Instagram quando o destino é um perfil', () => {
    // Medido: 11% dos anúncios apontam para o Instagram, e nesses o destino
    // é o próprio perfil do anunciante.
    const a = ad({ destino: 'https://www.instagram.com/_u/ricardoperuffo' })
    expect(url(a, 'instagram')).toBe('https://www.instagram.com/ricardoperuffo')
  })

  it('normaliza a forma sem www e com barra final', () => {
    const a = ad({ destino: 'http://instagram.com/rap10oficial/' })
    expect(url(a, 'instagram')).toBe('https://www.instagram.com/rap10oficial')
  })

  it('Instagram fica nulo quando não dá para derivar', () => {
    expect(url(ad(), 'instagram')).toBeNull()
  })

  it('usa o Instagram do anunciante quando ele existe', () => {
    const a = ad({
      anunciante: {
        pageId: '1',
        pageName: 'X',
        instagram: 'https://www.instagram.com/oficial',
      },
    })
    expect(url(a, 'instagram')).toBe('https://www.instagram.com/oficial')
  })

  it('todo destino tem rótulo em pt-BR', () => {
    for (const d of montarDestinos(ad())) {
      expect(d.rotulo.length).toBeGreaterThan(0)
    }
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falham**

```bash
npx.cmd vitest run tests/display.test.ts tests/links.test.ts
```

- [ ] **Step 3: Escrever `display.ts`**

Criar `src/core/display.ts`:

```ts
const UM_DIA = 24 * 60 * 60 * 1000

/** Dias inteiros desde o início da veiculação. Nunca negativo. */
export function diasAtivos(inicio: Date, agora: Date): number {
  const dias = Math.floor((agora.getTime() - inicio.getTime()) / UM_DIA)
  return dias > 0 ? dias : 0
}

export type FaixaBadge = 'novo' | 'provado' | 'validado'

/**
 * A faixa do badge diz o que o número significa, conforme a seção 7 do spec:
 * anunciante não queima verba por meses em criativo ruim.
 */
export function faixaBadge(dias: number): FaixaBadge {
  if (dias < 7) return 'novo'
  if (dias <= 30) return 'provado'
  return 'validado'
}
```

- [ ] **Step 4: Escrever `links.ts`**

Criar `src/core/links.ts`:

```ts
import type { Ad } from './types'

export interface DestinoOpen {
  chave: string
  rotulo: string
  url: string | null
}

const AD_LIBRARY = 'https://www.facebook.com/ads/library/'

function buscaNaBiblioteca(params: Record<string, string>): string {
  const p = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: 'BR',
    ...params,
  })
  return `${AD_LIBRARY}?${p.toString()}`
}

function dominioDe(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Deriva o perfil de Instagram do destino do anúncio.
 *
 * Quando o anúncio manda para o Instagram, o destino é o próprio perfil do
 * anunciante. Medido: cobre 11% dos anúncios, sem nenhuma requisição.
 *
 * A Meta usa a forma de deep link `/_u/<handle>`, que precisa ser normalizada.
 */
function instagramDoDestino(destino: string | undefined): string | null {
  if (!destino) return null
  try {
    const u = new URL(destino)
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null
    const handle = u.pathname.replace(/^\/_u\//, '/').replace(/^\/|\/$/g, '')
    return handle ? `https://www.instagram.com/${handle}` : null
  } catch {
    return null
  }
}

/**
 * Os seis destinos do menu OPEN, sempre na mesma ordem.
 *
 * Item sem dado vem com `url: null` e é exibido desabilitado, com o motivo no
 * tooltip. Ocultar faria o menu mudar de tamanho a cada card.
 */
export function montarDestinos(ad: Ad): DestinoOpen[] {
  const dominio = dominioDe(ad.destino)
  const instagram =
    ad.anunciante.instagram ?? instagramDoDestino(ad.destino)

  return [
    { chave: 'site', rotulo: 'Site do anúncio', url: ad.destino ?? null },
    {
      chave: 'perfil',
      rotulo: 'Perfil do anunciante',
      url: `https://www.facebook.com/${ad.anunciante.pageId}`,
    },
    { chave: 'instagram', rotulo: 'Instagram do anunciante', url: instagram },
    {
      chave: 'anunciosDoSite',
      rotulo: 'Buscar anúncios deste site',
      url: dominio
        ? buscaNaBiblioteca({ q: dominio, search_type: 'keyword_unordered' })
        : null,
    },
    {
      chave: 'anunciosDoAnunciante',
      rotulo: 'Buscar anúncios deste anunciante',
      url: buscaNaBiblioteca({
        view_all_page_id: ad.anunciante.pageId,
        search_type: 'page',
      }),
    },
    {
      chave: 'permalink',
      rotulo: 'URL do anúncio na Biblioteca',
      url: buscaNaBiblioteca({ id: ad.id }),
    },
  ]
}
```

- [ ] **Step 5: Rodar e confirmar que passam**

```bash
npx.cmd vitest run tests/display.test.ts tests/links.test.ts
```

Esperado: PASSA, 8 + 12 testes verdes.

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): calcular badge de dias e montar os destinos do menu OPEN

O que foi feito:
- Calcular dias ativos e a faixa de cor do badge
- Montar os seis destinos do menu OPEN a partir do tipo Ad

Como foi feito:
- O Instagram é derivado do destino quando o anúncio aponta para um perfil,
  normalizando a forma de deep link /_u/ da Meta. Cobre 11% dos anúncios
  sem nenhuma requisição
- Item sem dado vem com url nula, para ser exibido desabilitado: ocultar
  faria o menu mudar de tamanho a cada card

Considerações:
- A consulta forjada que traria o Instagram nos outros 89% está decidida na
  seção 7 do spec, mas não entra aqui: é requisição, e este plano é passivo
```

---

## Task 4: Filtro de data por reescrita de URL

**Files:**
- Create: `src/core/dateFilter.ts`
- Test: `tests/dateFilter.test.ts`

**Interfaces:**
- Produces: `type ModoFiltro = 'provadas' | 'subindo'`,
  `PRESETS: number[]`,
  `montarUrlFiltro(urlAtual: string, modo: ModoFiltro, dias: number, agora: Date): string`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/dateFilter.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { montarUrlFiltro, PRESETS } from '../src/core/dateFilter'

const AGORA = new Date('2026-09-06T12:00:00Z')
const BASE =
  'https://www.facebook.com/ads/library/?active_status=active&q=receitas'

function params(u: string): URLSearchParams {
  return new URLSearchParams(new URL(u).search)
}

describe('PRESETS', () => {
  it('traz os intervalos do spec', () => {
    expect(PRESETS).toEqual([3, 5, 7, 14, 21, 28])
  })
})

describe('montarUrlFiltro', () => {
  it('modo provadas limita a data máxima de início', () => {
    // "ativo há pelo menos 7 dias" = começou em 30/08 ou antes.
    const p = params(montarUrlFiltro(BASE, 'provadas', 7, AGORA))
    expect(p.get('start_date[max]')).toBe('2026-08-30')
    expect(p.get('start_date[min]')).toBeNull()
  })

  it('modo subindo limita a data mínima de início', () => {
    const p = params(montarUrlFiltro(BASE, 'subindo', 7, AGORA))
    expect(p.get('start_date[min]')).toBe('2026-08-30')
    expect(p.get('start_date[max]')).toBeNull()
  })

  it('preserva os outros parâmetros da busca', () => {
    const p = params(montarUrlFiltro(BASE, 'provadas', 3, AGORA))
    expect(p.get('q')).toBe('receitas')
    expect(p.get('active_status')).toBe('active')
  })

  it('substitui filtro anterior em vez de acumular', () => {
    const comFiltro = `${BASE}&start_date[min]=2020-01-01`
    const p = params(montarUrlFiltro(comFiltro, 'provadas', 3, AGORA))
    expect(p.get('start_date[min]')).toBeNull()
    expect(p.get('start_date[max]')).toBe('2026-09-03')
  })

  it('atravessa virada de mês', () => {
    const p = params(
      montarUrlFiltro(BASE, 'provadas', 7, new Date('2026-03-03T00:00:00Z')),
    )
    expect(p.get('start_date[max]')).toBe('2026-02-24')
  })

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    const p = params(
      montarUrlFiltro(BASE, 'provadas', 2, new Date('2024-03-01T00:00:00Z')),
    )
    expect(p.get('start_date[max]')).toBe('2024-02-28')
  })

  it('força a ordenação por impressões totais', () => {
    // Sem isso os escalados só aparecem depois de muita rolagem.
    const p = params(montarUrlFiltro(BASE, 'provadas', 7, AGORA))
    expect(p.get('sort_data[mode]')).toBe('total_impressions')
    expect(p.get('sort_data[direction]')).toBe('desc')
  })

  it('a data sai em ISO, sem hora', () => {
    const p = params(montarUrlFiltro(BASE, 'subindo', 5, AGORA))
    expect(p.get('start_date[min]')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/dateFilter.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/dateFilter.ts`:

```ts
/**
 * "Ativo há X" tem duas leituras opostas, e as duas são úteis:
 *
 * - `provadas`: ativo há PELO MENOS X dias — ofertas sobreviventes
 * - `subindo`:  ativo há NO MÁXIMO X dias — ofertas novas em ascensão
 */
export type ModoFiltro = 'provadas' | 'subindo'

/** 3 e 5 dias, depois 1, 2, 3 e 4 semanas. */
export const PRESETS = [3, 5, 7, 14, 21, 28]

const UM_DIA = 24 * 60 * 60 * 1000

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Reescreve a URL da Biblioteca com o filtro de data.
 *
 * Reescrever a URL é bem mais estável que simular cliques no menu de filtros
 * da Meta, que muda de layout com frequência.
 */
export function montarUrlFiltro(
  urlAtual: string,
  modo: ModoFiltro,
  dias: number,
  agora: Date,
): string {
  const url = new URL(urlAtual)
  const corte = iso(new Date(agora.getTime() - dias * UM_DIA))

  // Sempre limpar os dois antes, senão um filtro anterior sobrevive e o
  // resultado vira a interseção de dois cortes.
  url.searchParams.delete('start_date[min]')
  url.searchParams.delete('start_date[max]')

  if (modo === 'provadas') url.searchParams.set('start_date[max]', corte)
  else url.searchParams.set('start_date[min]', corte)

  // Os escalados vêm primeiro; sem isso, a mineração rola muito mais.
  url.searchParams.set('sort_data[mode]', 'total_impressions')
  url.searchParams.set('sort_data[direction]', 'desc')

  return url.toString()
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/dateFilter.test.ts
```

Esperado: PASSA, 9 testes verdes.

- [ ] **Step 5: Rodar a suíte inteira e verificar o build**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(overlay): filtrar por data reescrevendo a URL da Biblioteca

Como foi feito:
- Reescrever a URL em vez de simular cliques no menu de filtros da Meta, que
  muda de layout com frequência
- Os dois parâmetros de data são apagados antes de escrever, senão um filtro
  anterior sobrevive e o resultado vira a interseção de dois cortes
- A ordenação por impressões totais é forçada junto: sem ela os escalados só
  aparecem depois de muita rolagem

Considerações:
- Dois modos, porque "ativo há X" tem leituras opostas e ambas são úteis:
  provadas busca sobreviventes, subindo busca oferta nova em ascensão
```

---

## Verificação final

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test e2e/extension.spec.ts
git status --short
```

**O que este plano NÃO entrega:** a bandeja de botões no DOM, o download em HD
com ZIP e a interface do menu. Eles vêm no plano seguinte, que é todo de DOM e
depende destas quatro peças puras estarem prontas e testadas.
