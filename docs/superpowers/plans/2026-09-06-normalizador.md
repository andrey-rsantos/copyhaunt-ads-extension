# Normalizador — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Converter o payload da Meta no tipo `Ad` do projeto, testado contra as três fixtures reais.

**Architecture:** Uma função pura recebe o corpo já analisado de uma resposta classificada como `busca` e devolve uma lista de `Ad`. É a única camada do sistema que conhece o formato da Meta; todo o resto fala `Ad`.

**Tech Stack:** TypeScript 7, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 6, estágio 3)
**Plano anterior:** `2026-09-05-interceptador.md`

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e um único host.
- **Coleta 100% passiva.** Nada aqui emite requisição.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e para.
- **Commits:** padrão de `CLAUDE.md`, tipo em inglês, texto em pt-BR.
- **Não alterar as fixtures.** Elas são a fonte de verdade do formato real.

## O formato real, levantado das fixtures

Isto **não é suposição**: foi extraído dos três payloads em `tests/fixtures/`.

**Caminho até os anúncios:**

```
data > ad_library_main > search_results_connection > edges[] > node > collated_results[]
```

Cada `edge` tem `node` e `cursor`. Cada `node.collated_results` é um array com
um ou mais anúncios que compartilham criativo.

**Campos no nível do anúncio:**

| Campo | Tipo real | Observação |
|---|---|---|
| `ad_archive_id` | string | o ID da biblioteca |
| `collation_count` | number \| ausente | **pode faltar** — visto ausente em 1 de 27 |
| `collation_id` | string | |
| `start_date` | number | epoch em **segundos**, não milissegundos |
| `end_date` | number | |
| `is_active` | boolean | |
| `page_id` | string | |
| `page_name` | string | |
| `publisher_platform` | array de string | |

**Campos dentro de `snapshot`:**

| Campo | Tipo real | Observação |
|---|---|---|
| `link_url` | string | destino real |
| `caption` | string | domínio de exibição |
| `title` | string \| null | |
| `body` | **objeto** `{ text }` | **não é string** |
| `cta_type` / `cta_text` | string | |
| `page_profile_uri` | string | perfil do anunciante |
| `display_format` | string | `VIDEO`, `IMAGE`, … |
| `videos` | array | com `video_hd_url` e `video_sd_url` |
| `images` | array | com `original_image_url` e `resized_image_url` |

## Achado que contraria o spec

**Nenhum campo de Instagram existe nas três fixtures.** Foram varridas todas as
chaves com `instagram` no nome, nos três arquivos: zero ocorrências.

A seção 7 do spec descreve o item "Instagram do anunciante" no menu OPEN, e a
seção 3 registra `instagram_actor_name` como campo confirmado na análise da
extensão de referência. O campo existe no bundle deles — mas **não vem na
resposta de busca**. Deve vir da consulta de detalhe do anúncio.

**Consequência para este plano:** `Ad.advertiser.instagram` é opcional e nasce
`undefined`. O menu OPEN já prevê item desabilitado quando falta dado, então o
desenho aguenta. Descobrir de onde o Instagram vem fica registrado como
pendência, não entra aqui.

## Achado de produto que precisa de decisão

Nos 27 anúncios das fixtures, o `collation_count` máximo é **3** — mesmo com a
busca ordenada por impressões totais. A seção 7 do spec propõe como padrão
"criativo repetido ≥ 5".

Com dados reais, esse corte pode zerar a busca. **Não mudar o padrão neste
plano:** a amostra é de uma única palavra-chave, e o normalizador não é o lugar
de decidir regra de negócio. Fica registrado para quando o painel de critérios
for construído.

## Estrutura de arquivos ao final

```
├─ src/core/
│  ├─ types.ts          o tipo Ad e o que o acompanha
│  └─ normalize.ts      payload da Meta -> Ad[]
└─ tests/
   └─ normalize.test.ts
```

---

## Task 1: O tipo Ad

**Files:**
- Create: `src/core/types.ts`
- Test: coberto indiretamente pela Task 2

**Interfaces:**
- Produces: de `src/core/types.ts` — os tipos `Ad`, `Anunciante`, `Midia` e
  `FormatoMidia`.

- [ ] **Step 1: Criar o tipo**

Criar `src/core/types.ts`:

```ts
export type FormatoMidia = 'video' | 'imagem'

export interface Midia {
  formato: FormatoMidia
  /** Melhor qualidade disponível. Nunca vazio. */
  alta: string
  /** Versão leve, para pré-visualização. Cai para `alta` se não houver. */
  baixa: string
}

export interface Anunciante {
  pageId: string
  pageName: string
  /** Perfil no Facebook, quando a Meta informa. */
  perfil?: string
  /**
   * Perfil no Instagram. Não vem na resposta de busca — ver a pendência
   * registrada no plano do normalizador.
   */
  instagram?: string
}

/**
 * Um anúncio, no vocabulário do CopyHaunt.
 *
 * Todo o sistema fala este tipo. Só `normalize.ts` conhece o formato da Meta,
 * e é lá que o conserto acontece quando o schema deles mudar.
 */
export interface Ad {
  /** ad_archive_id: o número que a Meta mostra no card. */
  id: string
  /** Quando a veiculação começou. */
  iniciouEm: Date
  /** Quantos anúncios usam este mesmo criativo. Mínimo 1. */
  colacao: number
  anunciante: Anunciante
  /** URL de destino real, com parâmetros de campanha. */
  destino?: string
  /** Texto principal do criativo. */
  texto?: string
  titulo?: string
  /** Chamada para ação, como "Saiba mais". */
  cta?: string
  midias: Midia[]
  /** Facebook, Instagram, Messenger… como a Meta nomeia. */
  plataformas: string[]
  ativo: boolean
}
```

- [ ] **Step 2: Conferir que compila**

```bash
npm.cmd run typecheck
```

Esperado: nenhum erro. Sem commit ainda: a Task 2 usa este tipo e as duas vão
juntas no mesmo commit.

---

## Task 2: A normalização

**Files:**
- Create: `src/core/normalize.ts`
- Test: `tests/normalize.test.ts`

**Interfaces:**
- Consumes: `Ad`, `Midia`, `Anunciante` de `src/core/types.ts`.
- Produces: de `src/core/normalize.ts` — `normalizarBusca(corpo: unknown): Ad[]`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/normalize.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { normalizarBusca } from '../src/core/normalize'

const PASTA = resolve(import.meta.dirname, 'fixtures')

function carregar(arquivo: string): unknown {
  const bruto = readFileSync(join(PASTA, arquivo), 'utf8').replace(
    /^\s*for\s*\(\s*;\s*;\s*\)\s*;/,
    '',
  )
  return JSON.parse(bruto)
}

describe('normalizarBusca com payload sintético', () => {
  it('devolve lista vazia para corpo que não é do formato esperado', () => {
    expect(normalizarBusca({})).toEqual([])
    expect(normalizarBusca(null)).toEqual([])
    expect(normalizarBusca('texto')).toEqual([])
  })

  it('converte start_date de epoch em segundos para Date', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '123',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      is_active: true,
                      publisher_platform: ['FACEBOOK'],
                      snapshot: {},
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    const [ad] = normalizarBusca(corpo)
    expect(ad.iniciouEm.getTime()).toBe(1757574000 * 1000)
  })

  it('assume colação 1 quando collation_count falta', () => {
    // Visto em 1 de 27 anúncios reais: o campo simplesmente não vem.
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '123',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      snapshot: {},
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    expect(normalizarBusca(corpo)[0].colacao).toBe(1)
  })

  it('lê o texto de snapshot.body.text, que é objeto e não string', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '123',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      snapshot: { body: { text: 'Compre já' } },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    expect(normalizarBusca(corpo)[0].texto).toBe('Compre já')
  })

  it('descarta anúncio sem ad_archive_id em vez de derrubar o lote', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              { node: { collated_results: [{ snapshot: {} }] } },
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: 'bom',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'Alguém',
                      snapshot: {},
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    const ads = normalizarBusca(corpo)
    expect(ads).toHaveLength(1)
    expect(ads[0].id).toBe('bom')
  })

  it('prefere video_hd_url e cai para video_sd_url', () => {
    const corpo = {
      data: {
        ad_library_main: {
          search_results_connection: {
            edges: [
              {
                node: {
                  collated_results: [
                    {
                      ad_archive_id: '1',
                      start_date: 1757574000,
                      page_id: '9',
                      page_name: 'A',
                      snapshot: {
                        videos: [
                          { video_hd_url: 'hd.mp4', video_sd_url: 'sd.mp4' },
                          { video_hd_url: null, video_sd_url: 'so-sd.mp4' },
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    }
    const [ad] = normalizarBusca(corpo)
    expect(ad.midias).toEqual([
      { formato: 'video', alta: 'hd.mp4', baixa: 'sd.mp4' },
      { formato: 'video', alta: 'so-sd.mp4', baixa: 'so-sd.mp4' },
    ])
  })
})

describe('normalizarBusca contra as fixtures reais', () => {
  const arquivos = ['payload-01.json', 'payload-02.json', 'payload-03.json']

  it('extrai anúncios de todas as fixtures', () => {
    for (const arquivo of arquivos) {
      const ads = normalizarBusca(carregar(arquivo))
      expect(ads.length, `${arquivo} não rendeu anúncio`).toBeGreaterThan(0)
    }
  })

  it('todo anúncio real tem os campos obrigatórios preenchidos', () => {
    for (const arquivo of arquivos) {
      for (const ad of normalizarBusca(carregar(arquivo))) {
        expect(ad.id, `${arquivo}: id vazio`).toBeTruthy()
        expect(ad.anunciante.pageId, `${arquivo}: pageId vazio`).toBeTruthy()
        expect(ad.anunciante.pageName, `${arquivo}: pageName vazio`).toBeTruthy()
        expect(ad.colacao).toBeGreaterThanOrEqual(1)
        expect(Number.isNaN(ad.iniciouEm.getTime())).toBe(false)
      }
    }
  })

  it('nenhuma URL de mídia vem vazia', () => {
    for (const arquivo of arquivos) {
      for (const ad of normalizarBusca(carregar(arquivo))) {
        for (const m of ad.midias) {
          expect(m.alta, `${arquivo}: mídia sem url`).toBeTruthy()
          expect(m.baixa, `${arquivo}: mídia sem url leve`).toBeTruthy()
        }
      }
    }
  })

  it('relata o que foi extraído das fixtures reais', () => {
    let total = 0
    let comVideo = 0
    let comImagem = 0
    let comDestino = 0
    let comTexto = 0
    const colacoes: number[] = []

    for (const arquivo of arquivos) {
      for (const ad of normalizarBusca(carregar(arquivo))) {
        total += 1
        if (ad.midias.some((m) => m.formato === 'video')) comVideo += 1
        if (ad.midias.some((m) => m.formato === 'imagem')) comImagem += 1
        if (ad.destino) comDestino += 1
        if (ad.texto) comTexto += 1
        colacoes.push(ad.colacao)
      }
    }

    console.log(
      `anúncios reais normalizados: ${total} | com vídeo: ${comVideo} | ` +
        `com imagem: ${comImagem} | com destino: ${comDestino} | ` +
        `com texto: ${comTexto} | colação máxima: ${Math.max(...colacoes)}`,
    )

    expect(total).toBeGreaterThan(20)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx.cmd vitest run tests/normalize.test.ts
```

Esperado: FALHA, com erro de resolução de `../src/core/normalize`.

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/normalize.ts`:

```ts
import type { Ad, Midia } from './types'

/** Lê uma propriedade sem estourar quando o caminho não existe. */
function prop(alvo: unknown, chave: string): unknown {
  if (typeof alvo !== 'object' || alvo === null) return undefined
  return (alvo as Record<string, unknown>)[chave]
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : []
}

function extrairMidias(snapshot: unknown): Midia[] {
  const midias: Midia[] = []

  for (const v of lista(prop(snapshot, 'videos'))) {
    const hd = texto(prop(v, 'video_hd_url'))
    const sd = texto(prop(v, 'video_sd_url'))
    const alta = hd ?? sd
    if (!alta) continue
    midias.push({ formato: 'video', alta, baixa: sd ?? alta })
  }

  for (const i of lista(prop(snapshot, 'images'))) {
    const original = texto(prop(i, 'original_image_url'))
    const reduzida = texto(prop(i, 'resized_image_url'))
    const alta = original ?? reduzida
    if (!alta) continue
    midias.push({ formato: 'imagem', alta, baixa: reduzida ?? alta })
  }

  return midias
}

function normalizarAnuncio(bruto: unknown): Ad | null {
  const id = texto(prop(bruto, 'ad_archive_id'))
  const pageId = texto(prop(bruto, 'page_id'))
  const pageName = texto(prop(bruto, 'page_name'))
  if (!id || !pageId || !pageName) return null

  const inicio = prop(bruto, 'start_date')
  if (typeof inicio !== 'number') return null

  const snapshot = prop(bruto, 'snapshot')
  const colacaoBruta = prop(bruto, 'collation_count')

  return {
    id,
    // A Meta manda epoch em segundos; Date espera milissegundos.
    iniciouEm: new Date(inicio * 1000),
    // O campo pode simplesmente não vir: visto em 1 de 27 anúncios reais.
    colacao: typeof colacaoBruta === 'number' && colacaoBruta > 0
      ? colacaoBruta
      : 1,
    anunciante: {
      pageId,
      pageName,
      perfil: texto(prop(snapshot, 'page_profile_uri')),
      // O Instagram não vem na resposta de busca. Ver a pendência no plano.
      instagram: undefined,
    },
    destino: texto(prop(snapshot, 'link_url')),
    // body é objeto, não string: o texto mora em body.text.
    texto: texto(prop(prop(snapshot, 'body'), 'text')),
    titulo: texto(prop(snapshot, 'title')),
    cta: texto(prop(snapshot, 'cta_text')),
    midias: extrairMidias(snapshot),
    plataformas: lista(prop(bruto, 'publisher_platform')).filter(
      (p): p is string => typeof p === 'string',
    ),
    ativo: prop(bruto, 'is_active') === true,
  }
}

/**
 * Converte uma resposta de busca da Meta em anúncios do CopyHaunt.
 *
 * Esta é a única função do sistema que conhece o formato deles. Quando a Meta
 * mudar o schema, o conserto é aqui e em nenhum outro lugar.
 *
 * Cada anúncio é normalizado isoladamente: um card com formato inesperado é
 * descartado sem derrubar o lote, como manda a seção 9 do spec.
 */
export function normalizarBusca(corpo: unknown): Ad[] {
  const edges = lista(
    prop(
      prop(prop(prop(corpo, 'data'), 'ad_library_main'), 'search_results_connection'),
      'edges',
    ),
  )

  const ads: Ad[] = []
  for (const edge of edges) {
    for (const bruto of lista(prop(prop(edge, 'node'), 'collated_results'))) {
      try {
        const ad = normalizarAnuncio(bruto)
        if (ad) ads.push(ad)
      } catch {
        // Um anúncio estranho não pode derrubar os outros.
      }
    }
  }
  return ads
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx.cmd vitest run tests/normalize.test.ts --disableConsoleIntercept
```

Esperado: PASSA, e a linha `anúncios reais normalizados: …` aparece no
terminal.

**Se algum teste contra fixture falhar, PARE e reporte** qual asserção e qual
arquivo. Significa que o formato real tem um caso que o levantamento não
previu — informação de projeto, não erro de implementação. Não ajuste o teste
para passar.

- [ ] **Step 5: Rodar a suíte inteira**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(normalizer): converter o payload da Meta no tipo Ad

O que foi feito:
- Definir o tipo Ad e o vocabulário que o resto do sistema vai falar
- Converter a resposta de busca em Ad[], testado contra as fixtures reais

Como foi feito:
- O caminho até os anúncios foi levantado das fixtures, não suposto:
  data > ad_library_main > search_results_connection > edges > node >
  collated_results
- Leitura defensiva campo a campo: o payload é grande e irregular, e um
  acesso direto estouraria no primeiro campo ausente
- Cada anúncio é normalizado isoladamente. Um card com formato inesperado é
  descartado sem derrubar o lote, como manda a seção 9 do spec

Considerações:
- Três surpresas do formato real, todas cobertas por teste: start_date vem em
  segundos e não milissegundos; snapshot.body é objeto e o texto mora em
  body.text; collation_count pode simplesmente não vir, visto ausente em 1 de
  27 anúncios
- Ad.anunciante.instagram nasce undefined. Nenhum campo de Instagram existe
  nas três fixtures, embora o spec o descreva no menu OPEN. Ele deve vir da
  consulta de detalhe do anúncio, não da busca. Pendência registrada
- Nos 27 anúncios reais a colação máxima é 3, e o spec propõe ≥ 5 como padrão
  do filtro de escala. A amostra é de uma única palavra-chave, mas o padrão
  precisa ser revisto quando o painel de critérios for construído
```

Não rodar `git add` nem `git commit`.

---

## Verificação final

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
git status --short
```

**O que este plano NÃO entrega:** o índice em memória, os critérios de escala e
qualquer interface. O normalizador é peça de tradução; consumi-lo é assunto do
Bloco A e do Bloco B.
