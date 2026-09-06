# Bloco B — Motor de mineração · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar os critérios de escala aos anúncios coletados e conduzir a mineração automática, com timers que sobrevivem à aba em segundo plano.

**Architecture:** Três peças independentes e puras — os critérios, a máquina de estados e o relógio — mais a cola que as liga ao `AdStore`. Nada aqui toca o DOM nem a rede; a rolagem é um efeito injetado, o que torna todo o motor testável sem navegador.

**Tech Stack:** TypeScript 7, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 7, Bloco B)
**Planos anteriores:** `2026-09-06-normalizador.md`, `2026-09-06-bloco-a-overlay.md`

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e um único host.
- **O motor de mineração NÃO PODE emitir requisição.** A seção 2 do spec abre
  uma única exceção à coleta passiva, para o Instagram ao clicar, e diz
  literalmente que nada no motor de mineração pode emitir requisição — porque
  é ali que o volume transformaria um pedido isolado em varredura. Se você
  escrever um `fetch` neste plano, está errado.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e para.
- **Commits:** padrão de `AGENTS.md`, tipo em inglês, texto em pt-BR.

## Os critérios, com os números medidos

Os três critérios estão na seção 7 do spec. A distribuição real, medida em 94
anúncios de quatro nichos, sustenta os padrões:

| Corte de colação | Anúncios que passam |
|---|---|
| ≥ 2 | 49% |
| ≥ 3 | 33% |
| **≥ 5** (padrão) | **18%** |
| ≥ 10 | 1% |

Máximo observado: 14. Um em cada cinco é filtro apertado sem ser estéril.

## Por que o relógio é injetado

O Chrome estrangula `setTimeout` em aba não focada. A seção 7 do spec resolve
com timers em Web Worker, que não sofrem o estrangulamento.

Mas Web Worker não existe no Vitest em ambiente node, e um motor que só roda
com navegador aberto é um motor que ninguém testa. Por isso a máquina de
estados recebe o relógio **por parâmetro**: nos testes entra um relógio falso
que avança na hora; em produção entra o de Web Worker.

---

## Task 1: Os critérios de escala

**Files:**
- Create: `src/core/criteria.ts`
- Test: `tests/criteria.test.ts`

**Interfaces:**
- Consumes: `Ad` de `src/core/types.ts`; `AdStore` de `src/core/store.ts`.
- Produces: de `src/core/criteria.ts` —
  `interface Criterios { colacaoMinima: number | null; diasMin: number | null; diasMax: number | null; presencaMinima: number | null }`,
  `CRITERIOS_PADRAO: Criterios`,
  `avaliar(ad: Ad, c: Criterios, ctx: { presenca: number; agora: Date }): { passa: boolean; motivos: string[] }`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/criteria.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { avaliar, CRITERIOS_PADRAO, type Criterios } from '../src/core/criteria'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '1',
    iniciouEm: new Date('2026-08-01T12:00:00Z'), // 36 dias
    colacao: 5,
    anunciante: { pageId: 'p1', pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
    ...extra,
  }
}

function ctx(presenca = 10) {
  return { presenca, agora: AGORA }
}

describe('CRITERIOS_PADRAO', () => {
  it('usa os padrões do spec', () => {
    expect(CRITERIOS_PADRAO).toEqual({
      colacaoMinima: 5,
      diasMin: 7,
      diasMax: 90,
      presencaMinima: 10,
    })
  })
})

describe('avaliar', () => {
  it('aprova quando tudo bate', () => {
    expect(avaliar(ad(), CRITERIOS_PADRAO, ctx()).passa).toBe(true)
  })

  it('reprova por colação baixa e diz o motivo', () => {
    const r = avaliar(ad({ colacao: 2 }), CRITERIOS_PADRAO, ctx())
    expect(r.passa).toBe(false)
    expect(r.motivos.join(' ')).toContain('colação')
  })

  it('reprova anúncio novo demais', () => {
    const novo = ad({ iniciouEm: new Date('2026-09-04T12:00:00Z') }) // 2 dias
    const r = avaliar(novo, CRITERIOS_PADRAO, ctx())
    expect(r.passa).toBe(false)
    expect(r.motivos.join(' ')).toContain('dias')
  })

  it('reprova anúncio velho demais', () => {
    const velho = ad({ iniciouEm: new Date('2025-01-01T12:00:00Z') })
    expect(avaliar(velho, CRITERIOS_PADRAO, ctx()).passa).toBe(false)
  })

  it('reprova por presença baixa do anunciante', () => {
    const r = avaliar(ad(), CRITERIOS_PADRAO, ctx(3))
    expect(r.passa).toBe(false)
    expect(r.motivos.join(' ')).toContain('presença')
  })

  it('acumula todos os motivos, não só o primeiro', () => {
    const ruim = ad({ colacao: 1, iniciouEm: new Date('2026-09-05T12:00:00Z') })
    const r = avaliar(ruim, CRITERIOS_PADRAO, ctx(1))
    expect(r.motivos.length).toBe(3)
  })

  it('critério nulo é critério desligado', () => {
    const so: Criterios = {
      colacaoMinima: null,
      diasMin: null,
      diasMax: null,
      presencaMinima: null,
    }
    expect(avaliar(ad({ colacao: 1 }), so, ctx(0)).passa).toBe(true)
  })

  it('desligar um critério não afeta os outros', () => {
    const c: Criterios = { ...CRITERIOS_PADRAO, colacaoMinima: null }
    expect(avaliar(ad({ colacao: 1 }), c, ctx()).passa).toBe(true)
    expect(avaliar(ad({ colacao: 1 }), c, ctx(2)).passa).toBe(false)
  })

  it('aceita exatamente no limite', () => {
    // O corte é inclusivo: >= 5 deixa passar o 5.
    expect(avaliar(ad({ colacao: 5 }), CRITERIOS_PADRAO, ctx(10)).passa).toBe(
      true,
    )
  })

  it('a colação padrão de 5 reprova a maioria, como medido', () => {
    // 94 anúncios reais: só 18% têm colação >= 5.
    const passam = [1, 1, 2, 3, 5, 1, 2, 14, 1, 1].filter(
      (n) => avaliar(ad({ colacao: n }), CRITERIOS_PADRAO, ctx()).passa,
    )
    expect(passam).toEqual([5, 14])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/criteria.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/criteria.ts`:

```ts
import { diasAtivos } from './display'
import type { Ad } from './types'

/** Critério em `null` é critério desligado pelo usuário. */
export interface Criterios {
  colacaoMinima: number | null
  diasMin: number | null
  diasMax: number | null
  presencaMinima: number | null
}

/**
 * Padrões da seção 7 do spec.
 *
 * Colação ≥ 5 foi confirmada com dado real: em 94 anúncios de quatro nichos,
 * deixa passar 18%. Filtro apertado sem ser estéril.
 */
export const CRITERIOS_PADRAO: Criterios = {
  colacaoMinima: 5,
  diasMin: 7,
  diasMax: 90,
  presencaMinima: 10,
}

export interface Contexto {
  /** Quantos anúncios deste anunciante já apareceram na busca. */
  presenca: number
  agora: Date
}

export interface Veredito {
  passa: boolean
  /** Todos os motivos de reprovação, não só o primeiro. */
  motivos: string[]
}

/**
 * Aplica os critérios de escala a um anúncio.
 *
 * Acumula todos os motivos em vez de parar no primeiro: quem está calibrando
 * o filtro precisa saber tudo que reprovou, senão ajusta um critério por vez
 * às cegas.
 */
export function avaliar(ad: Ad, c: Criterios, ctx: Contexto): Veredito {
  const motivos: string[] = []
  const dias = diasAtivos(ad.iniciouEm, ctx.agora)

  if (c.colacaoMinima !== null && ad.colacao < c.colacaoMinima) {
    motivos.push(`colação ${ad.colacao} abaixo de ${c.colacaoMinima}`)
  }
  if (c.diasMin !== null && dias < c.diasMin) {
    motivos.push(`${dias} dias ativos, abaixo de ${c.diasMin}`)
  }
  if (c.diasMax !== null && dias > c.diasMax) {
    motivos.push(`${dias} dias ativos, acima de ${c.diasMax}`)
  }
  if (c.presencaMinima !== null && ctx.presenca < c.presencaMinima) {
    motivos.push(`presença ${ctx.presenca} abaixo de ${c.presencaMinima}`)
  }

  return { passa: motivos.length === 0, motivos }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/criteria.test.ts
```

Esperado: PASSA, 11 testes verdes.

- [ ] **Step 5: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(miner): aplicar os critérios de escala

Como foi feito:
- Critério em null é critério desligado, para o usuário poder isolar um de
  cada vez sem que os outros interfiram
- A avaliação acumula todos os motivos de reprovação em vez de parar no
  primeiro: quem calibra o filtro precisa ver tudo que reprovou

Considerações:
- O padrão de colação ≥ 5 tem teste ancorado no dado medido: em 94 anúncios
  reais de quatro nichos, esse corte deixa passar 18%
```

---

## Task 2: O relógio, e por que ele é injetado

**Files:**
- Create: `src/core/clock.ts`
- Test: `tests/clock.test.ts`

**Interfaces:**
- Produces: de `src/core/clock.ts` —
  `interface Relogio { agora(): Date; esperar(ms: number): Promise<void> }`,
  `relogioDeTeste(inicio: Date): Relogio & { avancar(ms: number): Promise<void> }`,
  `relogioDeWorker(): Relogio`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/clock.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { relogioDeTeste } from '../src/core/clock'

describe('relogioDeTeste', () => {
  it('começa no instante dado', () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    expect(r.agora().toISOString()).toBe('2026-09-06T12:00:00.000Z')
  })

  it('avançar move o tempo', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    await r.avancar(5000)
    expect(r.agora().toISOString()).toBe('2026-09-06T12:00:05.000Z')
  })

  it('esperar só resolve quando o tempo avança', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    let resolveu = false
    const p = r.esperar(1000).then(() => {
      resolveu = true
    })
    await Promise.resolve()
    expect(resolveu).toBe(false)
    await r.avancar(1000)
    await p
    expect(resolveu).toBe(true)
  })

  it('um avanço grande libera várias esperas', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    const ordem: number[] = []
    const a = r.esperar(1000).then(() => ordem.push(1))
    const b = r.esperar(2000).then(() => ordem.push(2))
    await r.avancar(3000)
    await Promise.all([a, b])
    expect(ordem).toEqual([1, 2])
  })

  it('esperar zero resolve no avanço seguinte', async () => {
    const r = relogioDeTeste(new Date('2026-09-06T12:00:00Z'))
    let ok = false
    const p = r.esperar(0).then(() => {
      ok = true
    })
    await r.avancar(0)
    await p
    expect(ok).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/clock.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/clock.ts`:

```ts
/**
 * O motor recebe o relógio por parâmetro.
 *
 * Em produção ele é cravado em Web Worker, porque o Chrome estrangula
 * `setTimeout` em aba não focada e a mineração morreria assim que o usuário
 * trocasse de janela.
 *
 * Nos testes entra um relógio falso que avança na hora. Sem essa injeção, o
 * motor só rodaria com navegador aberto — e um motor que ninguém testa é um
 * motor que ninguém conserta.
 */
export interface Relogio {
  agora(): Date
  esperar(ms: number): Promise<void>
}

interface Pendente {
  quando: number
  liberar: () => void
}

export function relogioDeTeste(
  inicio: Date,
): Relogio & { avancar(ms: number): Promise<void> } {
  let t = inicio.getTime()
  let pendentes: Pendente[] = []

  return {
    agora: () => new Date(t),
    esperar: (ms) =>
      new Promise<void>((liberar) => {
        pendentes.push({ quando: t + ms, liberar })
      }),
    avancar: async (ms) => {
      t += ms
      const vencidos = pendentes
        .filter((p) => p.quando <= t)
        .sort((a, b) => a.quando - b.quando)
      pendentes = pendentes.filter((p) => p.quando > t)
      for (const p of vencidos) {
        p.liberar()
        // Deixa a microtask do consumidor rodar antes da próxima.
        await Promise.resolve()
      }
    },
  }
}

/**
 * Relógio de produção: os tiques vêm de um Web Worker, imune ao
 * estrangulamento de timer em aba de segundo plano.
 *
 * O worker é criado a partir de um blob para não exigir arquivo separado no
 * empacotamento da extensão.
 */
export function relogioDeWorker(): Relogio {
  const fonte = `
    self.onmessage = (e) => {
      setTimeout(() => self.postMessage(e.data), e.data.ms)
    }
  `
  const worker = new Worker(
    URL.createObjectURL(new Blob([fonte], { type: 'text/javascript' })),
  )
  let proximo = 0
  const pendentes = new Map<number, () => void>()

  worker.onmessage = (e: MessageEvent<{ id: number }>) => {
    const liberar = pendentes.get(e.data.id)
    if (liberar) {
      pendentes.delete(e.data.id)
      liberar()
    }
  }

  return {
    agora: () => new Date(),
    esperar: (ms) =>
      new Promise<void>((liberar) => {
        const id = (proximo += 1)
        pendentes.set(id, liberar)
        worker.postMessage({ id, ms })
      }),
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/clock.test.ts
```

Esperado: PASSA, 5 testes verdes.

- [ ] **Step 5: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(miner): injetar o relógio para o motor ser testável

Como foi feito:
- O relógio de produção tira os tiques de um Web Worker, imune ao
  estrangulamento de setTimeout em aba de segundo plano
- O worker nasce de um blob, para não exigir arquivo separado no
  empacotamento da extensão
- Nos testes entra um relógio falso que avança na hora

Considerações:
- Sem a injeção, o motor de mineração só rodaria com navegador aberto. Um
  motor que ninguém testa é um motor que ninguém conserta
```

---

## Task 3: A máquina de estados da mineração

**Files:**
- Create: `src/core/miner.ts`
- Test: `tests/miner.test.ts`

**Interfaces:**
- Consumes: `Relogio` de `clock.ts`; `Criterios` e `avaliar` de `criteria.ts`;
  `AdStore` de `store.ts`; `Ad` de `types.ts`.
- Produces: de `src/core/miner.ts` —
  `type EstadoMineracao = 'parado' | 'minerando' | 'pausado' | 'concluido'`,
  `interface Progresso { estado; analisados; encontrados; rolagens }`,
  `interface OpcoesMineracao { store; criterios; relogio; rolar; intervaloMs; maxRolagens; limiteEncontrados; aoProgredir }`,
  `class Minerador` com `iniciar(): Promise<void>`, `parar(): void`,
  `progresso(): Progresso`, `encontrados(): Ad[]`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/miner.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { relogioDeTeste } from '../src/core/clock'
import { CRITERIOS_PADRAO, type Criterios } from '../src/core/criteria'
import { Minerador } from '../src/core/miner'
import { AdStore } from '../src/core/store'
import type { Ad } from '../src/core/types'

const AGORA = new Date('2026-09-06T12:00:00Z')

function ad(id: string, colacao: number, pageId = 'p1'): Ad {
  return {
    id,
    iniciouEm: new Date('2026-08-01T12:00:00Z'), // 36 dias
    colacao,
    anunciante: { pageId, pageName: 'A' },
    midias: [],
    plataformas: [],
    ativo: true,
  }
}

/** Sem presença mínima, para os testes isolarem a colação. */
const CRIT: Criterios = { ...CRITERIOS_PADRAO, presencaMinima: null }

function montar(opts: Partial<Record<string, unknown>> = {}) {
  const store = new AdStore()
  const relogio = relogioDeTeste(AGORA)
  const rolar = vi.fn()
  const minerador = new Minerador({
    store,
    criterios: CRIT,
    relogio,
    rolar,
    intervaloMs: 1000,
    maxRolagens: 3,
    limiteEncontrados: 100,
    ...opts,
  })
  return { store, relogio, rolar, minerador }
}

describe('Minerador', () => {
  it('começa parado', () => {
    expect(montar().minerador.progresso().estado).toBe('parado')
  })

  it('rola a página a cada ciclo', async () => {
    const { relogio, rolar, minerador } = montar()
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await p
    expect(rolar).toHaveBeenCalledTimes(3)
  })

  it('conclui ao atingir o máximo de rolagens', async () => {
    const { relogio, minerador } = montar({ maxRolagens: 2 })
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().estado).toBe('concluido')
    expect(minerador.progresso().rolagens).toBe(2)
  })

  it('conta analisados e encontrados conforme os critérios', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 1 })
    store.adicionar([ad('1', 5), ad('2', 1), ad('3', 9)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    const g = minerador.progresso()
    expect(g.analisados).toBe(3)
    expect(g.encontrados).toBe(2)
  })

  it('encontrados devolve os anúncios aprovados', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 1 })
    store.adicionar([ad('1', 5), ad('2', 1)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    expect(minerador.encontrados().map((a) => a.id)).toEqual(['1'])
  })

  it('parar interrompe antes do máximo', async () => {
    const { relogio, rolar, minerador } = montar({ maxRolagens: 10 })
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    minerador.parar()
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().estado).toBe('pausado')
    expect(rolar).toHaveBeenCalledTimes(1)
  })

  it('conclui ao atingir o limite de encontrados', async () => {
    const { store, relogio, minerador } = montar({
      maxRolagens: 10,
      limiteEncontrados: 2,
    })
    store.adicionar([ad('1', 5), ad('2', 6), ad('3', 7)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().estado).toBe('concluido')
  })

  it('avisa o progresso a cada ciclo', async () => {
    const aoProgredir = vi.fn()
    const { relogio, minerador } = montar({ maxRolagens: 2, aoProgredir })
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await p
    expect(aoProgredir).toHaveBeenCalledTimes(2)
    expect(aoProgredir.mock.calls[0][0].estado).toBe('minerando')
  })

  it('não conta o mesmo anúncio duas vezes entre ciclos', async () => {
    const { store, relogio, minerador } = montar({ maxRolagens: 2 })
    store.adicionar([ad('1', 5)])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    store.adicionar([ad('1', 5), ad('2', 5)])
    await relogio.avancar(1000)
    await p
    expect(minerador.progresso().analisados).toBe(2)
  })

  it('iniciar duas vezes não roda dois laços', async () => {
    const { relogio, rolar, minerador } = montar({ maxRolagens: 2 })
    const a = minerador.iniciar()
    const b = minerador.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(1000)
    await Promise.all([a, b])
    expect(rolar).toHaveBeenCalledTimes(2)
  })

  it('a presença do anunciante entra na avaliação', async () => {
    const { store, relogio, minerador } = montar({
      maxRolagens: 1,
      criterios: { ...CRITERIOS_PADRAO, presencaMinima: 2 },
    })
    // Dois anúncios do mesmo anunciante: presença 2, passa.
    store.adicionar([ad('1', 5, 'px'), ad('2', 5, 'px'), ad('3', 5, 'py')])
    const p = minerador.iniciar()
    await relogio.avancar(1000)
    await p
    expect(minerador.encontrados().map((a) => a.id)).toEqual(['1', '2'])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/miner.test.ts
```

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/miner.ts`:

```ts
import type { Relogio } from './clock'
import { avaliar, type Criterios } from './criteria'
import type { AdStore } from './store'
import type { Ad } from './types'

export type EstadoMineracao =
  | 'parado'
  | 'minerando'
  | 'pausado'
  | 'concluido'

export interface Progresso {
  estado: EstadoMineracao
  analisados: number
  encontrados: number
  rolagens: number
}

export interface OpcoesMineracao {
  store: AdStore
  criterios: Criterios
  relogio: Relogio
  /** Efeito injetado: rolar a página. Nos testes, um espião. */
  rolar: () => void
  intervaloMs: number
  maxRolagens: number
  limiteEncontrados: number
  aoProgredir?: (p: Progresso) => void
}

/**
 * Conduz a mineração: rola, deixa a página pedir mais, e avalia o que
 * chegou ao store.
 *
 * **Não emite requisição nenhuma.** A coleta continua passiva: quem pede é a
 * página, e nós só reagimos ao que o interceptador capturou. A seção 2 do
 * spec proíbe explicitamente requisição no motor de mineração.
 */
export class Minerador {
  private estado: EstadoMineracao = 'parado'
  private rolagens = 0
  private readonly avaliados = new Set<string>()
  private readonly aprovados: Ad[] = []
  private laco: Promise<void> | null = null

  constructor(private readonly opcoes: OpcoesMineracao) {}

  progresso(): Progresso {
    return {
      estado: this.estado,
      analisados: this.avaliados.size,
      encontrados: this.aprovados.length,
      rolagens: this.rolagens,
    }
  }

  encontrados(): Ad[] {
    return [...this.aprovados]
  }

  parar(): void {
    if (this.estado === 'minerando') this.estado = 'pausado'
  }

  /** Chamar duas vezes devolve o mesmo laço, não abre um segundo. */
  iniciar(): Promise<void> {
    if (this.laco) return this.laco
    this.estado = 'minerando'
    this.laco = this.rodar().finally(() => {
      this.laco = null
    })
    return this.laco
  }

  private async rodar(): Promise<void> {
    const o = this.opcoes

    while (this.estado === 'minerando') {
      await o.relogio.esperar(o.intervaloMs)
      if (this.estado !== 'minerando') break

      o.rolar()
      this.rolagens += 1

      this.avaliarNovos()
      o.aoProgredir?.(this.progresso())

      if (this.aprovados.length >= o.limiteEncontrados) {
        this.estado = 'concluido'
        break
      }
      if (this.rolagens >= o.maxRolagens) {
        this.estado = 'concluido'
        break
      }
    }
  }

  /** Só o que ainda não passou pelo crivo, para não recontar a cada ciclo. */
  private avaliarNovos(): void {
    const o = this.opcoes
    const agora = o.relogio.agora()

    for (const ad of o.store.todos()) {
      if (this.avaliados.has(ad.id)) continue
      this.avaliados.add(ad.id)

      const veredito = avaliar(ad, o.criterios, {
        presenca: o.store.presenca(ad.anunciante.pageId),
        agora,
      })
      if (veredito.passa) this.aprovados.push(ad)
    }
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/miner.test.ts
```

Esperado: PASSA, 12 testes verdes.

**Se o teste "a presença do anunciante entra na avaliação" falhar, PARE e
reporte.** A presença é contada no store no momento da inserção, e a ordem em
que os anúncios são avaliados pode afetar o resultado — é decisão de projeto,
não de implementação.

- [ ] **Step 5: Rodar a suíte inteira e verificar o build**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(miner): conduzir a mineração com máquina de estados

O que foi feito:
- Rolar em ciclo, avaliar o que chega ao store e relatar progresso
- Encerrar por limite de encontrados, máximo de rolagens ou parada manual

Como foi feito:
- A rolagem é um efeito injetado, não uma chamada direta ao DOM. Isso
  mantém o motor inteiro testável sem navegador
- Só anúncios ainda não avaliados passam pelo crivo a cada ciclo, senão a
  contagem inflaria a cada rolagem que reentrega os mesmos cards
- Chamar iniciar duas vezes devolve o mesmo laço em vez de abrir um segundo

Considerações:
- O motor não emite requisição nenhuma. Quem pede é a página; nós só
  reagimos ao que o interceptador capturou. A seção 2 do spec proíbe
  explicitamente requisição no motor de mineração, porque é onde o volume
  transformaria um pedido isolado em varredura
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

**O que este plano NÃO entrega:** o painel de controle da mineração, a
aplicação visual dos critérios nos cards (esconder e destacar) e a bandeja de
botões. Tudo isso é DOM e interface, e vem no plano de acabamento do Bloco A.
