# Instagram do anunciante: forjar a consulta quando a derivação falha · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preencher o item "Instagram do anunciante" do menu OPEN nos 89% de
anúncios em que a derivação passiva não alcança, forjando uma consulta GraphQL
com a sessão do próprio usuário — só ao clique, uma vez por anunciante.

**Architecture:** A derivação passiva, já pronta em `src/core/links.ts`,
continua sendo tentada primeiro e continua custando zero. Quando ela devolve
`null`, o item deixa de ser um beco sem saída e vira uma ação: o clique dispara
um `POST` para `/api/graphql/` de dentro do content script, na mesma origem da
página, com o `token_de_sessao` lido do HTML e o `doc_id` vindo da config remota. O
resultado — ou o fracasso — fica num cache de sessão, e o mesmo anunciante
nunca é consultado duas vezes.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 7,
"O Instagram do anunciante: decidido em 2026-09-06", e seção 8)

## Por que isto existe

Medido em 27 anúncios, a derivação passiva cobre **11%** dos casos. Nos outros
89% o item aparece desabilitado, e o usuário sai da extensão para achar à mão
o que ela deveria dar.

O caminho 2 é a única forma de fechar essa lacuna, e isso foi **verificado, não
suposto**: sem login não existe `token_de_sessao` no HTML, a página do anunciante nunca
dispara essa query sozinha, e a consulta sem token responde 200 com `data`
vazio e 12 erros.

## O risco, e por que ele foi aceito

Esta é a única parte da extensão que **fabrica** um pedido em nome da conta do
usuário. Todo o resto apenas escuta o que a página já pediu, e é indistinguível
de uso humano. Para a Meta, isto é uma conta autenticada gerando tráfego que
não corresponde a nenhuma ação de tela, e quem paga se der errado é o usuário
final, não o produto.

O risco foi apresentado por extenso na seção 7 do spec e **aceito pelo
usuário**. As travas abaixo são o que mantém isso no mínimo, e nenhuma delas é
negociável.

## Global Constraints

- **`permissions` continua exatamente `["storage"]`.** Nenhuma permissão nova.
- **`host_permissions` não muda.** Continua com os dois hosts que já tem. A
  consulta sai do content script, que já roda em `www.facebook.com`, e
  requisição de mesma origem não pede host novo. Se alguma tarefa parecer
  precisar de um host, **pare e pergunte**: o desenho está errado.
- **Nenhuma dependência nova** no `package.json`.
- **As quatro travas do spec, todas obrigatórias:**
  1. só dispara em **clique explícito** no item do menu — nunca durante a
     mineração, nunca ao plantar a bandeja, nunca ao abrir o menu;
  2. **uma requisição por anunciante**, com cache em memória pela sessão;
  3. o `doc_id` vem da **config remota**, nunca fixo no código;
  4. falha é **silenciosa**: o item volta a desabilitado, sem erro na cara do
     usuário e sem nenhuma repetição automática.
- **Somente dados, nunca código.** Nada da resposta é executado.
- **`src/core/links.ts` não muda.** A fronteira dele é o que dá para saber sem
  requisição nenhuma; a consulta forjada é da camada `content`. Os testes de
  `tests/links.test.ts` continuam valendo como estão, inclusive o que exige
  `null` quando não dá para derivar.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Nunca rodar `npm.cmd run gravar:fixtures`.**
- **Quem commita é o revisor.** O executor escreve `.commit-msg-codex` e para.
- **Commits:** padrão de `CLAUDE.md`, tipo em inglês, texto em pt-BR, com rodapé
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## O que este plano NÃO verifica

Nenhum teste aqui fala com o Facebook. Todos rodam com dependências injetadas e
respostas de mentira. **A verificação de ponta a ponta exige a sessão
autenticada do usuário e fica fora deste plano** — está registrada como
pendência no final.

---

## Task 1: O `doc_id` na config remota

**Files:**
- Modify: `src/core/config.ts`
- Modify: `tests/config.test.ts`
- Modify: `config/config.json`

**Interfaces:**
- Produces: `ConfigRemota.advertiserDocId?: string` (opcional).

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/config.test.ts`, acrescentar ao final do arquivo:

```ts
describe('advertiserDocId', () => {
  const COM_DOC = {
    ...VALIDA,
    advertiserDocId: '7193625857423421',
  }

  it('aceita e devolve o doc_id quando ele vem', () => {
    expect(validarConfig(COM_DOC)).toEqual(COM_DOC)
  })

  it('config sem doc_id continua válida, apenas sem ele', () => {
    // É assim que se desliga a consulta forjada em minutos: apagando o campo
    // do JSON hospedado, sem passar pela revisão da Chrome Web Store.
    expect(validarConfig(VALIDA)).toEqual(VALIDA)
    expect(validarConfig(VALIDA)).not.toHaveProperty('advertiserDocId')
  })

  it.each([
    ['não string', 7193625857423421],
    ['vazio', ''],
    ['com letras', '71936a25857423421'],
    ['com espaço', '7193625857 423421'],
  ])('descarta doc_id %s, mantendo o resto da config', (_caso, docId) => {
    expect(validarConfig({ ...VALIDA, advertiserDocId: docId })).toEqual(VALIDA)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/config.test.ts
```

Esperado: FALHA — `validarConfig` ainda descarta `advertiserDocId`.

- [ ] **Step 3: Aceitar o campo**

Em `src/core/config.ts`, acrescentar o campo à interface, **depois** de
`anchors`:

```ts
  /**
   * `doc_id` da consulta que devolve o Instagram do anunciante.
   *
   * Opcional de propósito. É a peça mais frágil de toda a extensão — some
   * assim que a Meta desregistrar a query —, e apagar este campo do arquivo
   * hospedado desliga a consulta forjada em minutos, sem esperar revisão da
   * loja. Uma config sem ele é uma config válida com o recurso desligado.
   */
  advertiserDocId?: string
```

E trocar o `return` final de `validarConfig` por:

```ts
  const config: ConfigRemota = {
    version: raiz.version,
    anchors: { libraryIdPattern: padrao },
  }

  // Só dígitos: o doc_id da Meta é numérico, e exigir isso impede que um
  // arquivo comprometido contrabandeie qualquer outra coisa para dentro do
  // corpo de uma requisição feita com a sessão do usuário.
  const docId = raiz.advertiserDocId
  if (typeof docId === 'string' && /^\d+$/.test(docId)) {
    config.advertiserDocId = docId
  }

  return config
```

- [ ] **Step 4: Publicar o campo no arquivo hospedado**

Substituir o conteúdo de `config/config.json` por:

```json
{
  "version": 2,
  "anchors": {
    "libraryIdPattern": "(?<!\\d)(\\d{15,17})(?!\\d)"
  },
  "advertiserDocId": "7193625857423421"
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/config.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 2: O token da sessão

**Files:**
- Create: `src/content/sessao.ts`
- Create: `tests/sessao.test.ts`

**Interfaces:**
- Produces: de `src/content/sessao.ts` —
  `extrairTokenDeSessao(html: string): string | null`.

A função recebe HTML como **string**, não lê o DOM. É o que a torna testável
sem navegador; quem lê o DOM é a Task 4.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/sessao.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extrairTokenDeSessao } from '../src/content/sessao'

describe('extrairTokenDeSessao', () => {
  it('acha o token na forma DTSGInitialData', () => {
    const html = `<script>require("DTSGInitialData",[],{"token":"NAcMabc123"},258);</script>`
    expect(extrairTokenDeSessao(html)).toBe('NAcMabc123')
  })

  it('acha o token na forma DTSGInitData, com os campos extras', () => {
    const html = `["DTSGInitData",[],{"token":"NAcMxyz789","async_get_token":"outro"},123]`
    expect(extrairTokenDeSessao(html)).toBe('NAcMxyz789')
  })

  it('tolera espaços em volta dos dois-pontos e das vírgulas', () => {
    const html = `[ "DTSGInitData" , [] , { "token" : "NAcMfolgado" } ]`
    expect(extrairTokenDeSessao(html)).toBe('NAcMfolgado')
  })

  it('cai para o campo escondido do formulário quando não há o JSON', () => {
    const html = `<form><input type="hidden" name="token_de_sessao" value="NAcMform456"></form>`
    expect(extrairTokenDeSessao(html)).toBe('NAcMform456')
  })

  it('devolve nulo sem sessão, que é o caso medido de navegador deslogado', () => {
    // Medido em perfil descartável: sem login, o token simplesmente não está
    // no HTML. É por isso que o caminho 2 exige a sessão do usuário.
    expect(extrairTokenDeSessao('<html><body>nada aqui</body></html>')).toBeNull()
  })

  it('devolve nulo para HTML vazio', () => {
    expect(extrairTokenDeSessao('')).toBeNull()
  })

  it('não confunde o token do LSD com o dtsg', () => {
    expect(extrairTokenDeSessao(`["LSD",[],{"token":"AVqQnaoEhEste"},321]`)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/sessao.test.ts
```

Esperado: FALHA, módulo `../src/content/sessao` não encontrado.

- [ ] **Step 3: Escrever a extração**

Criar `src/content/sessao.ts`:

```ts
/**
 * O token da sessão do Facebook, lido do HTML da própria página.
 *
 * Sem ele a consulta forjada não sai: medido num perfil descartável, sem
 * login o token não existe no HTML, e a consulta sem token responde 200 com
 * `data` vazio e 12 erros. Não há versão anônima deste caminho.
 */

/**
 * Os dois lugares onde o Facebook publica o token, na ordem em que valem a
 * pena ser tentados.
 *
 * O primeiro cobre as duas grafias que a Meta alterna, `DTSGInitData` e
 * `DTSGInitialData`, e é a forma corrente. O segundo é o campo escondido dos
 * formulários, mais antigo, mantido porque custa uma linha e cobre páginas
 * que a Meta ainda não migrou.
 *
 * Os `\s*` existem porque o HTML vem minificado hoje, mas isso é escolha
 * deles, não contrato.
 */
const PADROES = [
  /"DTSGInit(?:ial)?Data"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/,
  /name="token_de_sessao"\s+value="([^"]+)"/,
]

/**
 * Devolve o token, ou `null`.
 *
 * `null` não é erro: é o estado normal de quem não está logado, e quem chama
 * precisa tratá-lo como "não dá para perguntar", em silêncio.
 */
export function extrairTokenDeSessao(html: string): string | null {
  for (const padrao of PADROES) {
    const achado = html.match(padrao)?.[1]
    if (achado) return achado
  }
  return null
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/sessao.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 3: A consulta forjada

**Files:**
- Create: `src/content/instagram.ts`
- Create: `tests/instagram.test.ts`

**Interfaces:**
- Consumes: `extrairTokenDeSessao` (Task 2).
- Produces: de `src/content/instagram.ts` —
  `BUSCAR_INSTAGRAM: string`,
  `Dependencias { buscar: typeof fetch; html: () => string }`,
  `definirDocIdAnunciante(id: string | undefined): void`,
  `instagramConhecido(pageId: string): string | null | undefined`,
  `buscarInstagram(pageId: string, deps: Dependencias): Promise<string | null>`,
  `limparCacheInstagram(): void`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/instagram.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buscarInstagram,
  definirDocIdAnunciante,
  instagramConhecido,
  limparCacheInstagram,
  type Dependencias,
} from '../src/content/instagram'

const PAGE_ID = '378128628724966'
const DOC_ID = '7193625857423421'
const HTML_LOGADO = `["DTSGInitData",[],{"token":"NAcMtoken"},1]`

function resposta(corpo: unknown, ok = true) {
  const texto = typeof corpo === 'string' ? corpo : JSON.stringify(corpo)
  return { ok, text: async () => texto } as unknown as Response
}

const RESPOSTA_BOA = {
  data: {
    page: {
      extraPageInfo: { page_info: { ig_username: 'renanbotelho', ig_followers: 12 } },
    },
  },
}

function deps(extra: Partial<Dependencias> = {}): Dependencias {
  return {
    buscar: vi.fn(async () => resposta(RESPOSTA_BOA)),
    html: () => HTML_LOGADO,
    ...extra,
  }
}

beforeEach(() => {
  // Cache de módulo: sem isto um teste contamina o seguinte.
  limparCacheInstagram()
  definirDocIdAnunciante(DOC_ID)
})

describe('buscarInstagram', () => {
  it('devolve a URL do perfil quando a resposta traz o handle', async () => {
    expect(await buscarInstagram(PAGE_ID, deps())).toBe(
      'https://www.instagram.com/renanbotelho',
    )
  })

  it('acha o handle em qualquer profundidade do envelope', async () => {
    // O caminho exato dentro de `data` não foi medido, e a Meta reorganiza
    // envelope com frequência. Procurar a chave sobrevive a isso; um caminho
    // fixo errado falharia em silêncio para sempre.
    const fundo = { a: [{ b: { c: { ig_username: 'fundo' } } }] }
    const d = deps({ buscar: vi.fn(async () => resposta(fundo)) })
    expect(await buscarInstagram(PAGE_ID, d)).toBe(
      'https://www.instagram.com/fundo',
    )
  })

  it('tolera o prefixo anti-roubo de JSON que a Meta às vezes manda', async () => {
    const d = deps({
      buscar: vi.fn(async () => resposta(`for (;;);${JSON.stringify(RESPOSTA_BOA)}`)),
    })
    expect(await buscarInstagram(PAGE_ID, d)).toBe(
      'https://www.instagram.com/renanbotelho',
    )
  })

  it('manda o token, o doc_id e o pageId, com os cookies da sessão', async () => {
    const buscar = vi.fn(async () => resposta(RESPOSTA_BOA))
    await buscarInstagram(PAGE_ID, deps({ buscar }))

    const [url, init] = buscar.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://www.facebook.com/api/graphql/')
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')

    const corpo = new URLSearchParams(init.body as string)
    expect(corpo.get('token_de_sessao')).toBe('NAcMtoken')
    expect(corpo.get('doc_id')).toBe(DOC_ID)
    expect(JSON.parse(corpo.get('variables')!)).toEqual({ viewAllPageID: PAGE_ID })
  })
})

describe('as travas do spec', () => {
  it('não sai requisição nenhuma sem doc_id na config', async () => {
    // Apagar o campo do arquivo hospedado desliga o recurso. Esta é a trava
    // que faz esse desligamento valer.
    definirDocIdAnunciante(undefined)
    const d = deps()
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(d.buscar).not.toHaveBeenCalled()
  })

  it('não sai requisição nenhuma sem sessão', async () => {
    const d = deps({ html: () => '<html>deslogado</html>' })
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(d.buscar).not.toHaveBeenCalled()
  })

  it('pergunta uma vez só por anunciante', async () => {
    const d = deps()
    await buscarInstagram(PAGE_ID, d)
    await buscarInstagram(PAGE_ID, d)
    await buscarInstagram(PAGE_ID, d)
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })

  it('guarda também o fracasso, para insistir no clique não virar repetição', async () => {
    const d = deps({ buscar: vi.fn(async () => resposta({ data: {} })) })
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(await buscarInstagram(PAGE_ID, d)).toBeNull()
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })

  it('anunciantes diferentes são perguntas diferentes', async () => {
    const d = deps()
    await buscarInstagram(PAGE_ID, d)
    await buscarInstagram('999999999999999', d)
    expect(d.buscar).toHaveBeenCalledTimes(2)
  })
})

describe('falha silenciosa', () => {
  it.each([
    ['a resposta não é ok', () => resposta(RESPOSTA_BOA, false)],
    ['não há handle na resposta', () => resposta({ data: { page: null } })],
    ['o handle vem vazio', () => resposta({ ig_username: '' })],
    ['o corpo não é JSON', () => resposta('<html>erro</html>')],
    ['a rede cai', () => { throw new Error('sem rede') }],
  ])('devolve nulo, sem lançar, quando %s', async (_caso, montar) => {
    const d = deps({ buscar: vi.fn(async () => montar()) })
    await expect(buscarInstagram(PAGE_ID, d)).resolves.toBeNull()
  })
})

describe('instagramConhecido', () => {
  it('é indefinido antes de perguntar, e nisso difere de não ter achado', async () => {
    expect(instagramConhecido(PAGE_ID)).toBeUndefined()
  })

  it('guarda o achado', async () => {
    await buscarInstagram(PAGE_ID, deps())
    expect(instagramConhecido(PAGE_ID)).toBe('https://www.instagram.com/renanbotelho')
  })

  it('guarda o nulo de quem já foi perguntado e não deu', async () => {
    await buscarInstagram(PAGE_ID, deps({ buscar: vi.fn(async () => resposta({})) }))
    expect(instagramConhecido(PAGE_ID)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/instagram.test.ts
```

Esperado: FALHA, módulo `../src/content/instagram` não encontrado.

- [ ] **Step 3: Escrever a consulta**

Criar `src/content/instagram.ts`:

```ts
import { extrairTokenDeSessao } from './sessao'

/**
 * A consulta forjada: o caminho 2 da seção 7 do spec.
 *
 * Esta é a única parte da extensão que **fabrica** um pedido em nome da conta
 * do usuário. Todo o resto apenas escuta o que a página já pediu. O risco foi
 * apresentado por extenso e aceito, e as travas deste arquivo são o que o
 * mantém no mínimo: um pedido, por clique deliberado, por anunciante, por
 * sessão.
 *
 * **Somente dados, nunca código.** Nada da resposta é executado.
 */

const GRAPHQL = 'https://www.facebook.com/api/graphql/'

/**
 * O valor que o item do menu carrega quando ainda não se sabe o Instagram.
 *
 * Não é uma URL: é um pedido de busca que só `tray.ts` entende. Existe para o
 * item poder ser clicável sem que `menu.ts` precise saber que há uma consulta
 * atrás dele — o menu continua sabendo apenas "tem valor, logo é clicável".
 */
export const BUSCAR_INSTAGRAM = 'copyhaunt:buscar-instagram'

/**
 * O que já se perguntou nesta sessão.
 *
 * Guarda o fracasso junto com o acerto, e é essa a trava de "uma requisição
 * por anunciante": sem guardar o `null`, o usuário insistindo no clique viraria
 * exatamente a repetição que o spec proíbe.
 *
 * Vive na memória da aba e morre com ela, de propósito. Levar isto para o
 * `storage` seria manter, no disco do usuário, um registro de quais
 * anunciantes ele investigou.
 */
const cache = new Map<string, string | null>()

/** Zera o cache. Existe para os testes; nada em produção chama. */
export function limparCacheInstagram(): void {
  cache.clear()
}

/**
 * O `doc_id` vindo da config remota, nunca fixo no código.
 *
 * `undefined` desliga a consulta por completo, e é assim que o recurso é
 * desligado em minutos quando a Meta desregistrar a query: basta apagar o
 * campo do arquivo hospedado.
 */
let docIdAtual: string | undefined

export function definirDocIdAnunciante(id: string | undefined): void {
  docIdAtual = id
}

/**
 * O que já se sabe deste anunciante nesta sessão.
 *
 * `undefined` = nunca perguntamos. `null` = perguntamos e não veio nada, e não
 * se pergunta de novo. Os dois casos são diferentes, e o menu depende dessa
 * diferença para saber se oferece a busca ou mostra o item desabilitado.
 */
export function instagramConhecido(pageId: string): string | null | undefined {
  return cache.get(pageId)
}

export interface Dependencias {
  buscar: typeof fetch
  /** O HTML de onde sai o `token_de_sessao`. Injetado para testar sem navegador. */
  html: () => string
}

/**
 * Acha `ig_username` em qualquer profundidade da resposta.
 *
 * O caminho exato dentro de `data` não foi medido, e a Meta reorganiza
 * envelope com frequência. Procurar a chave sobrevive a isso; um caminho fixo
 * errado falharia em silêncio para sempre, que é o pior modo de falha
 * possível para um recurso que já falha em silêncio de propósito.
 *
 * ponytail: varredura ingênua da árvore inteira. A resposta é de um anunciante
 * só e cabe em alguns kilobytes; se algum dia crescer, medir antes de trocar
 * por caminho fixo com queda para a varredura.
 */
function acharIgUsername(no: unknown): string | null {
  if (typeof no !== 'object' || no === null) return null

  for (const [chave, valor] of Object.entries(no)) {
    if (chave === 'ig_username' && typeof valor === 'string' && valor) {
      return valor
    }
    const fundo = acharIgUsername(valor)
    if (fundo) return fundo
  }

  return null
}

/** A requisição em si. Nunca lança: todo fracasso vira `null`. */
async function consultar(
  pageId: string,
  deps: Dependencias,
): Promise<string | null> {
  if (!docIdAtual) return null

  const token = extrairTokenDeSessao(deps.html())
  // Sem sessão não há o que perguntar. Não é erro: é o estado de quem não
  // está logado, e foi medido que não existe versão anônima deste caminho.
  if (!token) return null

  try {
    const resposta = await deps.buscar(GRAPHQL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token_de_sessao: token,
        doc_id: docIdAtual,
        variables: JSON.stringify({ viewAllPageID: pageId }),
      }).toString(),
      credentials: 'omit',
    })
    if (!resposta.ok) return null

    // A Meta às vezes prefixa a resposta com `for (;;);`, defesa antiga contra
    // roubo de JSON. Cortar até a primeira chave custa menos que adivinhar
    // qual das formas veio.
    const texto = await resposta.text()
    const inicio = texto.indexOf('{')
    if (inicio < 0) return null

    const handle = acharIgUsername(JSON.parse(texto.slice(inicio)))
    return handle ? `https://www.instagram.com/${handle}` : null
  } catch {
    // Rede caída, JSON quebrado, resposta truncada: tudo vira silêncio.
    return null
  }
}

/**
 * Devolve o perfil de Instagram do anunciante, ou `null`.
 *
 * **Só chame isto a partir de um clique explícito do usuário.** Chamar durante
 * a mineração, ao plantar a bandeja ou ao abrir o menu romperia a primeira
 * trava do spec e transformaria uma requisição deliberada em tráfego
 * automático na conta do usuário.
 */
export async function buscarInstagram(
  pageId: string,
  deps: Dependencias,
): Promise<string | null> {
  const sabido = cache.get(pageId)
  if (sabido !== undefined) return sabido

  const resultado = await consultar(pageId, deps)
  cache.set(pageId, resultado)
  return resultado
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/instagram.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 4: Ligar o item do menu à consulta

**Files:**
- Modify: `src/content/tray.ts`
- Modify: `src/content/index.ts`
- Create: `tests/instagram-menu.test.ts`

**Interfaces:**
- Consumes: `BUSCAR_INSTAGRAM`, `buscarInstagram`, `instagramConhecido`,
  `definirDocIdAnunciante` (Task 3); `montarDestinos` (existente, **não muda**).

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/instagram-menu.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  definirDocIdAnunciante,
  limparCacheInstagram,
} from '../src/content/instagram'
import { plantarBandeja } from '../src/content/tray'
import type { Ad } from '../src/core/types'

const HTML_LOGADO = `["DTSGInitData",[],{"token":"NAcMtoken"},1]`

const RESPOSTA_BOA = {
  data: { page: { extraPageInfo: { page_info: { ig_username: 'renanbotelho' } } } },
}

function ad(extra: Partial<Ad> = {}): Ad {
  return {
    id: '652131454176487',
    iniciouEm: new Date('2026-08-01T00:00:00Z'),
    colacao: 1,
    anunciante: { pageId: '378128628724966', pageName: 'Renan Botelho Dr' },
    texto: 'O texto do anúncio',
    // Destino que não é Instagram: força o caminho 2, que é o caso de 89%.
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
  return card.querySelector('[data-copyhaunt-id]')!.shadowRoot!
}

function abrirOpen(shadow: ShadowRoot): void {
  shadow.querySelector<HTMLElement>('.botao[data-acao="abrir"]')!.click()
}

function itemInstagram(shadow: ShadowRoot): HTMLElement {
  return shadow.querySelector<HTMLElement>('.item[data-chave="instagram"]')!
}

function respostaBoa() {
  return {
    ok: true,
    text: async () => JSON.stringify(RESPOSTA_BOA),
  } as unknown as Response
}

beforeEach(() => {
  document.body.innerHTML = ''
  limparCacheInstagram()
  definirDocIdAnunciante('7193625857423421')
  document.documentElement.innerHTML = `<head></head><body><script>${HTML_LOGADO}</script></body>`
})

describe('o item do Instagram quando a derivação passiva não alcança', () => {
  it('fica clicável, e diz que vai buscar', () => {
    const shadow = plantar()
    abrirOpen(shadow)
    const item = itemInstagram(shadow)
    expect(item.dataset.desabilitado).toBeUndefined()
    expect(item.textContent).toContain('buscar')
  })

  it('o menu continua com os seis itens de sempre', () => {
    const shadow = plantar()
    abrirOpen(shadow)
    expect(shadow.querySelectorAll('.menu .item')).toHaveLength(6)
  })

  it('não requisita nada só por abrir o menu', () => {
    const buscar = vi.fn(async () => respostaBoa())
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar()
    abrirOpen(shadow)

    // A primeira trava do spec: nada sai sem clique explícito no item.
    expect(buscar).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('o clique busca e abre a aba com o perfil achado', async () => {
    const open = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('fetch', vi.fn(async () => respostaBoa()))

    const shadow = plantar()
    abrirOpen(shadow)
    itemInstagram(shadow).click()

    await vi.waitFor(() => {
      expect(open).toHaveBeenCalledWith(
        'https://www.instagram.com/renanbotelho',
        '_blank',
        'noopener',
      )
    })
    vi.unstubAllGlobals()
  })

  it('depois de achar, o item vira link direto e não busca de novo', async () => {
    const buscar = vi.fn(async () => respostaBoa())
    vi.stubGlobal('open', vi.fn())
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar()
    abrirOpen(shadow)
    itemInstagram(shadow).click()
    await vi.waitFor(() => expect(buscar).toHaveBeenCalledTimes(1))

    abrirOpen(shadow)
    const item = itemInstagram(shadow)
    expect(item.dataset.desabilitado).toBeUndefined()
    expect(item.textContent).not.toContain('buscar')

    item.click()
    await vi.waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(
        'https://www.instagram.com/renanbotelho',
        '_blank',
        'noopener',
      ),
    )
    // A segunda trava: o anunciante não é perguntado duas vezes.
    expect(buscar).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it('quando a busca não acha, o item volta a desabilitado e cala', async () => {
    const buscar = vi.fn(
      async () => ({ ok: true, text: async () => '{"data":{}}' }) as unknown as Response,
    )
    const open = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar()
    abrirOpen(shadow)
    itemInstagram(shadow).click()
    await vi.waitFor(() => expect(buscar).toHaveBeenCalledTimes(1))

    // Falha silenciosa: nenhuma aba, nenhum erro na cara do usuário.
    expect(open).not.toHaveBeenCalled()

    abrirOpen(shadow)
    expect(itemInstagram(shadow).dataset.desabilitado).toBe('sim')

    itemInstagram(shadow).click()
    // E nenhuma repetição automática nem manual.
    expect(buscar).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})

describe('quando a derivação passiva alcança', () => {
  it('o item é link direto, e nada é requisitado', async () => {
    const buscar = vi.fn(async () => respostaBoa())
    const open = vi.fn()
    vi.stubGlobal('open', open)
    vi.stubGlobal('fetch', buscar)

    const shadow = plantar(ad({ destino: 'https://www.instagram.com/_u/ricardoperuffo' }))
    abrirOpen(shadow)
    itemInstagram(shadow).click()

    expect(open).toHaveBeenCalledWith(
      'https://www.instagram.com/ricardoperuffo',
      '_blank',
      'noopener',
    )
    // Os 11% que custam zero continuam custando zero.
    expect(buscar).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/instagram-menu.test.ts
```

Esperado: FALHA — o item do Instagram ainda vem desabilitado quando a
derivação não alcança.

- [ ] **Step 3: Ligar o item à consulta**

Em `src/content/tray.ts`, acrescentar aos imports:

```ts
import {
  BUSCAR_INSTAGRAM,
  buscarInstagram,
  instagramConhecido,
} from './instagram'
```

Substituir a função `destinosComoItens` inteira por:

```ts
/**
 * Os destinos do OPEN na forma que o menu entende.
 *
 * O item do Instagram é o único que não sai pronto de `montarDestinos`: lá
 * mora só o que dá para saber sem requisição nenhuma, e quando isso não
 * alcança — 89% dos anúncios medidos — o item vira uma ação em vez de um beco
 * sem saída.
 */
function destinosComoItens(ad: Ad): ItemMenu[] {
  return montarDestinos(ad).map((d) => {
    if (d.chave !== 'instagram' || d.url !== null) {
      return { chave: d.chave, rotulo: d.rotulo, valor: d.url }
    }

    // `undefined` = nunca perguntamos, então ofereça a busca. Qualquer outra
    // coisa já é resposta: o perfil achado, ou o `null` de quem já foi
    // perguntado e não deu, que volta a item desabilitado.
    const sabido = instagramConhecido(ad.anunciante.pageId)
    if (sabido === undefined) {
      return {
        chave: d.chave,
        rotulo: `${d.rotulo} (buscar)`,
        valor: BUSCAR_INSTAGRAM,
      }
    }
    return { chave: d.chave, rotulo: d.rotulo, valor: sabido }
  })
}

/**
 * Dispara a consulta forjada e abre o perfil, se vier.
 *
 * Só é chamada de dentro do callback de clique do menu. É a única requisição
 * que esta extensão fabrica em nome da conta do usuário, e o clique deliberado
 * é a trava que o spec exige.
 */
function buscarEAbrirInstagram(ad: Ad): void {
  void buscarInstagram(ad.anunciante.pageId, {
    buscar: (...args) => fetch(...args),
    html: () => document.documentElement.innerHTML,
  }).then((url) => {
    // Não achou: silêncio. O item já sabe que vai voltar desabilitado na
    // próxima abertura do menu.
    if (url) window.open(url, '_blank', 'noopener')
  })
}
```

E substituir o bloco `else if (b.chave === 'abrir')` por:

```ts
      } else if (b.chave === 'abrir') {
        abrirMenu(raiz, destinosComoItens(ad), (item) => {
          if (!item.valor) return
          if (item.valor === BUSCAR_INSTAGRAM) {
            buscarEAbrirInstagram(ad)
            return
          }
          // `noopener`: a aba aberta não recebe referência para esta.
          window.open(item.valor, '_blank', 'noopener')
        })
      }
```

- [ ] **Step 4: Entregar o `doc_id` da config**

Em `src/content/index.ts`, acrescentar aos imports:

```ts
import { definirDocIdAnunciante } from './instagram'
```

E, dentro de `aplicarConfig`, acrescentar a linha do `doc_id` **depois** da do
padrão de ancoragem:

```ts
function aplicarConfig(): void {
  chrome.runtime.sendMessage({ tipo: 'obter-config' }, (config) => {
    if (chrome.runtime.lastError || !config?.anchors?.libraryIdPattern) return
    definirPadraoAncora(config.anchors.libraryIdPattern)
    // Sem este campo, a consulta forjada nem sai. É o interruptor remoto do
    // recurso: apagar o campo do arquivo hospedado o desliga em minutos.
    definirDocIdAnunciante(config.advertiserDocId)
  })
}
```

- [ ] **Step 5: Rodar tudo**

```bash
npx.cmd vitest run tests/instagram-menu.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Esperado: PASSA, tudo verde. Em especial, `tests/links.test.ts` e
`tests/tray-acoes.test.ts` continuam passando sem alteração — se um deles
quebrar, o desenho vazou para onde não devia.

`npm.cmd run verify:build` deve continuar imprimindo
`manifest gerado OK: world MAIN preservado, permissões mínimas`, com os mesmos
dois `host_permissions` e `permissions` ainda em `["storage"]`.

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg-codex` na raiz com:

```
✨ feat(overlay): achar o Instagram do anunciante forjando a consulta

O que foi feito:
- Aceitar o doc_id da consulta como campo opcional da config remota
- Ler o token da sessão do HTML da própria página
- Consultar o GraphQL da Meta ao clique, uma vez por anunciante
- Fazer o item do menu virar ação quando a derivação passiva não alcança

Como foi feito:
- A requisição sai do content script, que já roda em www.facebook.com: mesma
  origem não pede host_permission nova, e permissions segue ["storage"]
- O handle é procurado por chave em qualquer profundidade da resposta, não
  por caminho fixo: o caminho dentro de data não foi medido, e caminho fixo
  errado falharia em silêncio para sempre
- O cache de sessão guarda o fracasso junto com o acerto, senão o usuário
  insistindo no clique viraria a repetição que o spec proíbe
- src/core/links.ts não mudou: lá mora só o que dá para saber sem requisição

Considerações:
- Esta é a única parte da extensão que fabrica um pedido em nome da conta do
  usuário; todo o resto apenas escuta o que a página já pediu. O risco foi
  apresentado por extenso na seção 7 do spec e aceito. As quatro travas —
  clique explícito, uma vez por anunciante, doc_id remoto, falha silenciosa —
  são o que o mantém no mínimo
- O doc_id é opcional na config: apagar o campo do arquivo hospedado desliga
  o recurso em minutos, sem esperar revisão da Chrome Web Store. É a saída
  pronta para quando a Meta desregistrar a query
- O cache vive na memória da aba e morre com ela. Levá-lo para o storage
  seria manter no disco do usuário um registro de quem ele investigou
- Nenhum teste aqui fala com o Facebook: todos usam dependências injetadas.
  A verificação de ponta a ponta exige sessão autenticada e ficou de fora

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

## Pendências que este plano deixa de propósito

- **Verificação com sessão real.** Nada aqui prova que o `doc_id`
  `7193625857423421` ainda responde, nem que o caminho do `ig_username` na
  resposta é o que se supõe. Só uma sessão autenticada mostra isso, e é a
  primeira coisa a fazer com a extensão carregada no navegador do usuário.
- **`ig_followers`, `ig_verification` e a data de criação da página** vêm na
  mesma resposta, de graça, e não são lidos. Entram quando houver um consumidor
  — critério de mineração ou item de menu. Campo sem consumidor é peso morto.
- **`fieldPaths` da seção 8 do spec** continua fora: a busca por chave dispensa
  caminho configurável para este caso.
