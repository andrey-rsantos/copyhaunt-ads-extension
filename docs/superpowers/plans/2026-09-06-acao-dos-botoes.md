# Ação dos botões: copiar e abrir · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer os botões Copiar e OPEN responderem ao clique, cada um abrindo
seu menu, com a lógica que já existe e está testada.

**Architecture:** Os dois botões abrem menu, então o menu é uma peça só, usada
duas vezes. Os itens vêm de funções puras que espelham a mesma forma
(`{chave, rotulo, valor}`), e o menu não sabe se está listando links ou textos.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 7,
A1 e A3)
**IDV:** `CopyHaunt-IDV.md` — normativo para cores.

## O que já existe e NÃO deve ser reescrito

Metade deste plano é ligação, não construção. O que já está pronto e testado:

| Peça | Onde | O que faz |
|---|---|---|
| `montarDestinos(ad)` | `src/core/links.ts` | os 6 destinos do OPEN, com `url: null` no que falta |
| `instagramDoDestino` | `src/core/links.ts` | derivação passiva do Instagram, já embutida |
| `plantarBandeja` | `src/content/tray.ts` | planta os 3 botões, hoje sem listener |
| `criarShadow` | `src/content/estilo.ts` | shadow root com a folha compartilhada |

**Não recrie nenhuma delas.** Se algo parecer faltar, procure antes de escrever.

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e um único host. Nada aqui
  precisa de permissão nova: `navigator.clipboard` e `window.open` são nativos.
- **Nenhuma requisição à Meta.** Este ciclo entrega **apenas a derivação
  passiva** do Instagram, que `montarDestinos` já faz. A consulta forjada da
  seção 7 do spec fica para ciclo próprio — é a única parte do sistema que
  falaria com a Meta e merece revisão isolada.
- **Cores só do `CopyHaunt-IDV.md`.** Há teste que reprova hexadecimal que não
  conste lá. As disponíveis já em uso: `#7C3AED`, `#A855F7`, `#C4A7FF`,
  `#08070D`, `#FFFFFF`.
- **Não quebrar o layout da Meta.** Nada de `border` nos cards.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e para.
- **Commits:** padrão de `CLAUDE.md`, tipo em inglês, texto em pt-BR, com rodapé
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Decisões de desenho, e o motivo de cada uma

**Um menu, não dois.** Copiar e OPEN têm o mesmo comportamento: lista de itens,
alguns indisponíveis, escolher um faz algo e fecha. Escrever dois seria decidir
duas vezes como um menu se comporta.

**`{chave, rotulo, valor}` como forma comum.** `montarDestinos` já devolve
`{chave, rotulo, url}`. O menu recebe `valor`, e os destinos são adaptados com
um `.map` de uma linha. Renomear `url` para `valor` em `DestinoOpen` quebraria
`tests/links.test.ts` sem ganho.

**Item sem dado fica desabilitado, nunca oculto.** É o que a seção 7 do spec
manda, e pela razão que ela dá: ocultar faria o menu mudar de tamanho a cada
card.

**Fechar ao clicar fora com um único listener no `document`.** Um listener por
bandeja seriam centenas. O único listener percorre os hosts e fecha o que
estiver aberto.

---

## Task 1: Os itens de cópia

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/normalize.ts`
- Create: `src/core/copy.ts`
- Create: `tests/copy.test.ts`
- Modify: `tests/normalize.test.ts`

**Interfaces:**
- Produces: de `src/core/copy.ts` —
  `ItemCopia { chave: string; rotulo: string; valor: string | null }`,
  `montarCopias(ad: Ad): ItemCopia[]` (5 itens, sempre na mesma ordem).
- Produces: `Ad.descricao?: string` em `src/core/types.ts`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/copy.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { montarCopias } from '../src/core/copy'
import type { Ad } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    texto: 'O que é EBITDA em um post',
    titulo: 'Aprenda a calcular',
    descricao: 'Passo a passo em cinco minutos',
    destino: 'https://exemplo.com/oferta?utm_source=fb',
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function valor(a: Ad, chave: string): string | null {
  return montarCopias(a).find((i) => i.chave === chave)?.valor ?? null
}

describe('montarCopias', () => {
  it('devolve os cinco itens, sempre na mesma ordem', () => {
    expect(montarCopias(ad()).map((i) => i.chave)).toEqual([
      'texto',
      'titulo',
      'descricao',
      'site',
      'tudo',
    ])
  })

  it('leva cada campo do anúncio ao seu item', () => {
    const a = ad()
    expect(valor(a, 'texto')).toBe('O que é EBITDA em um post')
    expect(valor(a, 'titulo')).toBe('Aprenda a calcular')
    expect(valor(a, 'descricao')).toBe('Passo a passo em cinco minutos')
    expect(valor(a, 'site')).toBe('https://exemplo.com/oferta?utm_source=fb')
  })

  it('"tudo" junta as partes existentes, separadas por linha em branco', () => {
    expect(valor(ad(), 'tudo')).toBe(
      'O que é EBITDA em um post\n\n' +
        'Aprenda a calcular\n\n' +
        'Passo a passo em cinco minutos\n\n' +
        'https://exemplo.com/oferta?utm_source=fb',
    )
  })

  it('"tudo" pula o que falta em vez de deixar buraco', () => {
    const a = ad({ titulo: undefined, descricao: undefined })
    expect(valor(a, 'tudo')).toBe(
      'O que é EBITDA em um post\n\nhttps://exemplo.com/oferta?utm_source=fb',
    )
  })

  it('item sem dado vem com valor null, e continua na lista', () => {
    const a = ad({ descricao: undefined })
    expect(valor(a, 'descricao')).toBeNull()
    expect(montarCopias(a)).toHaveLength(5)
  })

  it('anúncio sem nada aproveitável deixa "tudo" nulo', () => {
    const a = ad({
      texto: undefined,
      titulo: undefined,
      descricao: undefined,
      destino: undefined,
    })
    expect(valor(a, 'tudo')).toBeNull()
  })
})
```

Acrescentar ao final de `tests/normalize.test.ts`, dentro do `describe` que já
existe para `normalizarBusca`:

```ts
  it('lê a descrição do link quando a Meta a envia', () => {
    const ads = normalizarBusca(
      JSON.parse(readFileSync(join(PASTA, 'payload-01.json'), 'utf8')),
    )
    const comDescricao = ads.filter((a) => a.descricao)
    // Nem todo anúncio traz link_description: medido, 13 de 30 no lote do HTML.
    expect(comDescricao.length).toBeGreaterThan(0)
    for (const a of comDescricao) {
      expect(typeof a.descricao).toBe('string')
      expect(a.descricao!.length).toBeGreaterThan(0)
    }
  })
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/copy.test.ts tests/normalize.test.ts
```

Esperado: FALHA — módulo `../src/core/copy` não encontrado, e `descricao` não
existe em `Ad`.

- [ ] **Step 3: Acrescentar o campo ao tipo**

Em `src/core/types.ts`, dentro da interface `Ad`, logo **depois** da linha do
`titulo?: string`:

```ts
  /** Descrição do link. A Meta a envia em 13 de 30 anúncios medidos. */
  descricao?: string
```

- [ ] **Step 4: Ensinar o normalizador a lê-lo**

Em `src/core/normalize.ts`, dentro do objeto devolvido por `normalizarAnuncio`,
logo **depois** da linha do `titulo:`:

```ts
    descricao: texto(prop(snapshot, 'link_description')),
```

- [ ] **Step 5: Escrever os itens de cópia**

Criar `src/core/copy.ts`:

```ts
import type { Ad } from './types'

export interface ItemCopia {
  chave: string
  rotulo: string
  /** `null` quando o anúncio não traz o dado. O item continua na lista. */
  valor: string | null
}

/**
 * Os cinco itens do menu Copiar, sempre na mesma ordem.
 *
 * Espelha `montarDestinos` de propósito: mesma forma, mesma regra para dado
 * ausente. O menu que exibe os dois é o mesmo, e uma forma só evita duas.
 */
export function montarCopias(ad: Ad): ItemCopia[] {
  const partes = [ad.texto, ad.titulo, ad.descricao, ad.destino].filter(
    (p): p is string => Boolean(p),
  )

  return [
    { chave: 'texto', rotulo: 'Texto principal', valor: ad.texto ?? null },
    { chave: 'titulo', rotulo: 'Título', valor: ad.titulo ?? null },
    { chave: 'descricao', rotulo: 'Descrição', valor: ad.descricao ?? null },
    { chave: 'site', rotulo: 'URL do site', valor: ad.destino ?? null },
    // "Tudo" pula o que falta: um anúncio sem título não merece um buraco de
    // duas quebras de linha no meio do texto colado.
    {
      chave: 'tudo',
      rotulo: 'Tudo',
      valor: partes.length > 0 ? partes.join('\n\n') : null,
    },
  ]
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/copy.test.ts tests/normalize.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA, sem nenhum teste antigo quebrado.

---

## Task 2: O menu, uma peça para os dois botões

**Files:**
- Create: `src/content/menu.ts`
- Create: `tests/menu.test.ts`
- Modify: `src/content/estilo.ts`

**Interfaces:**
- Produces: de `src/content/menu.ts` —
  `ItemMenu { chave: string; rotulo: string; valor: string | null }`,
  `abrirMenu(raiz: ParentNode, itens: ItemMenu[], aoEscolher: (item: ItemMenu) => void): void`,
  `fecharMenu(raiz: ParentNode): void`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/menu.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { abrirMenu, fecharMenu, type ItemMenu } from '../src/content/menu'

const ITENS: ItemMenu[] = [
  { chave: 'a', rotulo: 'Com dado', valor: 'valor-a' },
  { chave: 'b', rotulo: 'Sem dado', valor: null },
]

function raiz(): HTMLElement {
  const el = document.createElement('div')
  document.body.appendChild(el)
  return el
}

function item(r: ParentNode, chave: string): HTMLElement {
  const el = r.querySelector<HTMLElement>(`.item[data-chave="${chave}"]`)
  if (!el) throw new Error(`item ${chave} não encontrado`)
  return el
}

describe('abrirMenu', () => {
  it('desenha um item por entrada, na ordem recebida', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    const rotulos = [...r.querySelectorAll('.item')].map((e) => e.textContent)
    expect(rotulos).toEqual(['Com dado', 'Sem dado'])
  })

  it('escolher um item avisa e fecha o menu', () => {
    const r = raiz()
    const aoEscolher = vi.fn()
    abrirMenu(r, ITENS, aoEscolher)
    item(r, 'a').click()
    expect(aoEscolher).toHaveBeenCalledWith(ITENS[0])
    expect(r.querySelector('.menu')).toBeNull()
  })

  it('item sem dado não dispara nada e não fecha o menu', () => {
    const r = raiz()
    const aoEscolher = vi.fn()
    abrirMenu(r, ITENS, aoEscolher)
    item(r, 'b').click()
    expect(aoEscolher).not.toHaveBeenCalled()
    expect(r.querySelector('.menu')).not.toBeNull()
  })

  it('item sem dado explica o motivo no tooltip', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    expect(item(r, 'b').title.length).toBeGreaterThan(0)
    expect(item(r, 'b').dataset.desabilitado).toBe('sim')
  })

  it('abrir duas vezes não empilha dois menus', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    abrirMenu(r, ITENS, () => {})
    expect(r.querySelectorAll('.menu')).toHaveLength(1)
  })
})

describe('fecharMenu', () => {
  it('remove o menu aberto', () => {
    const r = raiz()
    abrirMenu(r, ITENS, () => {})
    fecharMenu(r)
    expect(r.querySelector('.menu')).toBeNull()
  })

  it('não estoura quando não há menu', () => {
    expect(() => fecharMenu(raiz())).not.toThrow()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/menu.test.ts
```

Esperado: FALHA, módulo `../src/content/menu` não encontrado.

- [ ] **Step 3: Escrever o menu**

Criar `src/content/menu.ts`:

```ts
/**
 * O menu que serve aos dois botões.
 *
 * Copiar e OPEN têm o mesmo comportamento: uma lista, alguns itens
 * indisponíveis, escolher um faz algo e fecha. Escrever dois menus seria
 * decidir duas vezes como um menu se comporta.
 */
export interface ItemMenu {
  chave: string
  rotulo: string
  /** `null` desabilita o item, com o motivo no tooltip. */
  valor: string | null
}

/** Fecha o menu aberto nesta raiz, se houver. Idempotente. */
export function fecharMenu(raiz: ParentNode): void {
  raiz.querySelector('.menu')?.remove()
}

/**
 * Abre o menu, substituindo o que estivesse aberto.
 *
 * Item sem dado fica desabilitado, nunca oculto: a seção 7 do spec pede assim,
 * porque ocultar faria o menu mudar de tamanho a cada card.
 */
export function abrirMenu(
  raiz: ParentNode,
  itens: ItemMenu[],
  aoEscolher: (item: ItemMenu) => void,
): void {
  fecharMenu(raiz)

  const menu = document.createElement('div')
  menu.className = 'menu'

  for (const item of itens) {
    const linha = document.createElement('div')
    linha.className = 'item'
    linha.dataset.chave = item.chave
    linha.textContent = item.rotulo

    if (item.valor === null) {
      linha.dataset.desabilitado = 'sim'
      linha.title = 'Este anúncio não traz este dado'
    } else {
      linha.addEventListener('click', (evento) => {
        // A Meta escuta clique no card inteiro: sem isto, escolher um item
        // abriria o anúncio deles junto.
        evento.stopPropagation()
        evento.preventDefault()
        fecharMenu(raiz)
        aoEscolher(item)
      })
    }

    menu.appendChild(linha)
  }

  raiz.appendChild(menu)
}
```

- [ ] **Step 4: Vestir o menu**

Em `src/content/estilo.ts`, acrescentar ao final da template string
`CSS_BANDEJA`, **antes** da crase de fechamento:

```css
  .menu {
    position: absolute;
    top: 44px;
    left: 8px;
    z-index: 10;
    min-width: 210px;
    padding: 6px;
    border-radius: 12px;
    background: #08070D;
    box-shadow: 0 0 20px rgba(124, 58, 237, 0.25);
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    font-size: 13px;
  }

  .menu .item {
    padding: 8px 10px;
    border-radius: 8px;
    color: #FFFFFF;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .menu .item:hover { background: #7C3AED; }

  .menu .item[data-desabilitado="sim"] {
    color: #C4A7FF;
    opacity: 0.45;
    cursor: not-allowed;
  }
  .menu .item[data-desabilitado="sim"]:hover { background: transparent; }
```

Todas as cores já constam no `CopyHaunt-IDV.md`. O teste de identidade em
`tests/estilo.test.ts` reprova qualquer hexadecimal que não conste lá — se ele
falhar, a cor é que está errada, não o teste.

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/menu.test.ts tests/estilo.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 3: Ligar os cliques na bandeja

**Files:**
- Modify: `src/content/tray.ts`
- Create: `tests/tray-acoes.test.ts`
- Create: `e2e/acoes.spec.ts`

**Interfaces:**
- Consumes: `montarCopias` (Task 1), `abrirMenu`/`fecharMenu` (Task 2),
  `montarDestinos` de `src/core/links.ts` (já existe).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/tray-acoes.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { plantarBandeja } from '../src/content/tray'
import type { Ad } from '../src/core/types'

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    texto: 'O texto do anúncio',
    destino: 'https://exemplo.com/oferta',
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function plantar(a: Ad = ad()): ShadowRoot {
  const card = document.createElement('div')
  document.body.appendChild(card)
  plantarBandeja(card, a, new Date('2026-09-06T00:00:00Z'))
  const host = card.querySelector('[data-copyhaunt-id]')!
  return host.shadowRoot!
}

function botao(shadow: ShadowRoot, acao: string): HTMLElement {
  return shadow.querySelector<HTMLElement>(`.botao[data-acao="${acao}"]`)!
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('botão copiar', () => {
  it('abre o menu com os cinco itens de cópia', () => {
    const shadow = plantar()
    botao(shadow, 'copiar').click()
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(5)
  })

  it('escolher um item escreve o valor na área de transferência', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const shadow = plantar()
    botao(shadow, 'copiar').click()
    shadow.querySelector<HTMLElement>('.item[data-chave="texto"]')!.click()

    expect(writeText).toHaveBeenCalledWith('O texto do anúncio')
    vi.unstubAllGlobals()
  })
})

describe('botão abrir', () => {
  it('abre o menu com os seis destinos', () => {
    const shadow = plantar()
    botao(shadow, 'abrir').click()
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(6)
  })

  it('escolher um destino abre nova aba, sem passar opener', () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)

    const shadow = plantar()
    botao(shadow, 'abrir').click()
    shadow.querySelector<HTMLElement>('.item[data-chave="perfil"]')!.click()

    expect(open).toHaveBeenCalledWith(
      'https://www.facebook.com/378128628724966',
      '_blank',
      'noopener',
    )
    vi.unstubAllGlobals()
  })
})

describe('botão baixar', () => {
  it('ainda não faz nada, e não estoura ao ser clicado', () => {
    const shadow = plantar()
    expect(() => botao(shadow, 'baixar').click()).not.toThrow()
    expect(shadow.querySelector('.menu')).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/tray-acoes.test.ts
```

Esperado: FALHA — o menu não abre, porque os botões ainda não escutam clique.

- [ ] **Step 3: Ligar os cliques**

Em `src/content/tray.ts`, acrescentar aos imports:

```ts
import { montarCopias } from '../core/copy'
import { montarDestinos } from '../core/links'
import { abrirMenu, fecharMenu, type ItemMenu } from './menu'
```

Acrescentar, **depois** da constante `BOTOES`:

```ts
/**
 * Fecha qualquer menu aberto na página.
 *
 * Um listener por bandeja seriam centenas; este é único e percorre os hosts.
 *
 * ponytail: varre todos os hosts a cada clique, O(n) com n = cards na tela
 * (25 a 60 medidos). Se a grade crescer muito, guardar o host aberto numa
 * variável de módulo e fechar só ele.
 */
let fechamentoLigado = false

function ligarFechamentoGlobal(): void {
  if (fechamentoLigado) return
  fechamentoLigado = true
  document.addEventListener('click', () => {
    for (const host of document.querySelectorAll(`[${ATRIBUTO_ID}]`)) {
      const shadow = (host as HTMLElement).shadowRoot
      if (shadow) fecharMenu(shadow)
    }
  })
}

/** Os destinos do OPEN na forma que o menu entende. */
function destinosComoItens(ad: Ad): ItemMenu[] {
  return montarDestinos(ad).map((d) => ({
    chave: d.chave,
    rotulo: d.rotulo,
    valor: d.url,
  }))
}
```

Dentro de `plantarBandeja`, no laço `for (const b of BOTOES)`, logo **depois**
da linha `botao.textContent = b.glifo`, acrescentar:

```ts
    botao.addEventListener('click', (evento) => {
      // A Meta escuta clique no card inteiro: sem isto, abrir o menu abriria
      // o anúncio deles junto.
      evento.stopPropagation()
      evento.preventDefault()

      if (b.chave === 'copiar') {
        abrirMenu(raiz, montarCopias(ad), (item) => {
          if (item.valor) void navigator.clipboard.writeText(item.valor)
        })
      } else if (b.chave === 'abrir') {
        abrirMenu(raiz, destinosComoItens(ad), (item) => {
          // `noopener`: a aba aberta não recebe referência para esta.
          if (item.valor) window.open(item.valor, '_blank', 'noopener')
        })
      }
      // 'baixar' ainda não tem ação. Ciclo próprio.
    })
```

E, ao final de `plantarBandeja`, logo **depois** de `shadow.appendChild(raiz)`:

```ts
  ligarFechamentoGlobal()
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/tray-acoes.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

- [ ] **Step 5: Escrever o teste de navegador**

Criar `e2e/acoes.spec.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

const CAPTURAS = resolve(import.meta.dirname, '..', 'capturas')

/**
 * Prova no navegador real que o menu abre e que escolher um destino abre aba.
 *
 * A área de transferência não entra aqui: exigiria permissão de clipboard no
 * contexto do Playwright, e o teste unitário já cobre a escrita.
 */
test('o menu abre e o destino escolhido abre nova aba', async ({ context }) => {
  mkdirSync(CAPTURAS, { recursive: true })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForTimeout(8000)

  const host = page.locator('[data-copyhaunt-id]').first()
  await host.locator('.botao[data-acao="abrir"]').click()

  const itens = host.locator('.menu .item')
  await expect(itens).toHaveCount(6)

  await page.screenshot({
    path: resolve(CAPTURAS, 'menu-open.png'),
    fullPage: false,
  })

  const [nova] = await Promise.all([
    context.waitForEvent('page'),
    host.locator('.item[data-chave="perfil"]').click(),
  ])
  expect(nova.url()).toContain('facebook.com/')
  await nova.close()
})
```

O Playwright atravessa shadow root sozinho nos seletores CSS, então
`.botao[data-acao="abrir"]` alcança o botão dentro do shadow sem sintaxe
especial.

- [ ] **Step 6: Compilar e rodar**

```bash
npm.cmd run build
npx.cmd playwright test e2e/acoes.spec.ts --timeout=120000
```

Esperado: PASSA, com a captura `capturas/menu-open.png` gravada.

**Se o menu não abrir, PARE e reporte** — não aumente a espera, o sintoma seria
outro problema.

- [ ] **Step 7: Conferir a captura com olho humano**

Abrir `capturas/menu-open.png` e confirmar que o menu aparece sobre o card,
legível, com os itens sem dado visivelmente apagados.

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
✨ feat(overlay): dar ação aos botões copiar e abrir

O que foi feito:
- Abrir menu de cópia com texto, título, descrição, URL e tudo
- Abrir menu OPEN com os seis destinos já montados pelo núcleo
- Ler a descrição do link, que o normalizador ainda descartava

Como foi feito:
- Um menu só serve aos dois botões: ambos listam itens, desabilitam o que
  falta e fecham ao escolher. Dois menus seriam decidir duas vezes como um
  menu se comporta
- Os destinos são adaptados à forma do menu com um map de uma linha, em vez
  de renomear url para valor em DestinoOpen e quebrar os testes que já existem
- Um único listener no document fecha os menus, porque um por bandeja seriam
  centenas
- Todo clique para a propagação: a Meta escuta clique no card inteiro, e sem
  isso abrir o menu abriria o anúncio deles junto

Considerações:
- Só a derivação passiva do Instagram entra aqui. A consulta forjada da
  seção 7 do spec é a única parte do sistema que falaria com a Meta e fica
  para ciclo próprio, para ser revisada isolada
- O botão baixar continua sem ação: busca no fbcdn, escolha de HD e ZIP são
  problema de outra natureza
- O fechamento global percorre todos os hosts a cada clique, O(n) com n entre
  25 e 60 cards medidos. Marcado com comentário ponytail: no código, com o
  caminho de upgrade se a grade crescer

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

Então **parar**. Quem commita é o revisor.

---

## Verificação final

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git status --short
```

**O que este plano NÃO entrega:** o botão Baixar, a consulta forjada do
Instagram, e o painel de mineração. O Baixar continua plantado com glifo e
título, sem ação.
