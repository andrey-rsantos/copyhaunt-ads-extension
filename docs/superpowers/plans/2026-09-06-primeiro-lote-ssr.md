# O primeiro lote, o que vem no HTML · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Indexar os anúncios que a Meta embute no HTML da primeira carga, para
que os cards do topo deixem de nascer sem bandeja.

**Architecture:** A Meta serve o primeiro lote num `<script
type="application/json" data-sjs>`, e não por XHR. O envelope é do empacotador
deles, mas lá dentro há um nó com exatamente a mesma forma da resposta de busca
que já sabemos normalizar. Achamos esse nó **por forma, não por caminho**, e o
entregamos ao mesmo tubo que já trata o XHR.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seções 6 e 9)

## O problema, medido

Na busca real por `receitas`, na carga da página, antes de qualquer rolagem:

```
respostas XHR com anúncios: 0
scripts do HTML com search_results_connection: 1  (179 kB, type=application/json, data-sjs)
ids visíveis na grade:  25
destes, vindos do HTML: 25
```

O interceptador só remenda `XMLHttpRequest`. Logo, os anúncios da primeira tela
**nunca entram no índice**, e o overlay — corretamente — não pinta card cujo
anúncio ele não conhece. Não é bug do overlay. É lote perdido.

Dentro daquele script há **30 anúncios** em `collated_results`, de **17
anunciantes distintos** — mais do que os 25 cards renderizados. Todos os 30
passam pelas regras do normalizador; nenhum é recusado.

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e um único host.
- **Nenhuma requisição à Meta.** A coleta é passiva: lemos o que a página já
  trouxe sozinha. Nada aqui pode emitir `fetch`, `XMLHttpRequest` ou navegação.
- **Só `src/core/normalize.ts` conhece o formato da Meta.** Nenhum arquivo novo
  pode ler `ad_archive_id`, `start_date`, `snapshot` ou irmãos.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e para.
- **Commits:** padrão de `CLAUDE.md`, tipo em inglês, texto em pt-BR, com
  rodapé `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## Decisões de desenho, e o motivo de cada uma

**Buscar por forma, nunca por caminho.** Hoje o payload mora em
`require[0][3][0].__bbox.require[0][3][1].__bbox.result`. Esses índices são do
empacotador da Meta e mudam sem aviso. A busca desce a árvore procurando
qualquer nó que tenha `data.ad_library_main.search_results_connection` — o mesmo
princípio que já rege `src/core/router.ts`, que classifica pelo conteúdo e não
pelo `doc_id`.

**Filtrar por substring antes de `JSON.parse`.** A página serve muitos
`<script type="application/json">`. Parsear todos custaria caro e sem motivo.
`includes('search_results_connection')` é uma varredura de string barata que
elimina todos menos um.

**Parar de descer ao achar.** Colhido o nó de busca, não se entra nele. Os
`edges` lá dentro são fundos e numerosos, e nada de interesse se esconde abaixo
do que já achamos.

**Um só tubo para as duas origens.** O XHR e o HTML entregam a mesma forma.
Duplicar a indexação seria criar dois lugares para consertar quando a Meta
mudar. `processarCaptura` cede a parte comum para `indexarBusca`, e a leitura do
HTML passa pelo mesmo funil.

**Ler o HTML uma única vez, no início.** O script é servido com a página e não
muda depois. A paginação seguinte volta a ser XHR, que o interceptador já pega.
Reler a cada mutação seria parsear 179 kB por rolagem, para nada.

---

## Task 1: Achar o payload dentro do envelope

**Files:**
- Create: `src/content/ssr.ts`
- Create: `tests/ssr.test.ts`
- Modify: `tools/gravar-fixtures.spec.ts`
- Fixture já commitada, **não regravar**: `tests/fixtures/ssr-01.json`

**Interfaces:**
- Produces: de `src/content/ssr.ts` —
  `extrairPayloadsSsr(raiz: ParentNode): unknown[]`.
  Cada item devolvido tem a forma
  `{ data: { ad_library_main: { search_results_connection: ... } } }`, aceita
  como está por `normalizarBusca` de `src/core/normalize.ts`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/ssr.test.ts`:

```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extrairPayloadsSsr } from '../src/content/ssr'
import { normalizarBusca } from '../src/core/normalize'

const FIXTURE = readFileSync(
  resolve(import.meta.dirname, 'fixtures', 'ssr-01.json'),
  'utf8',
)

/** Monta um documento com um script do tipo que a Meta serve. */
function comScript(conteudo: string, tipo = 'application/json'): Document {
  const doc = document.implementation.createHTMLDocument('teste')
  const script = doc.createElement('script')
  script.setAttribute('type', tipo)
  script.setAttribute('data-sjs', '')
  script.textContent = conteudo
  doc.body.appendChild(script)
  return doc
}

describe('extrairPayloadsSsr', () => {
  it('acha o payload dentro do envelope real da Meta', () => {
    const achados = extrairPayloadsSsr(comScript(FIXTURE))
    expect(achados).toHaveLength(1)
  })

  it('o payload achado tem a forma que o normalizador espera', () => {
    const [payload] = extrairPayloadsSsr(comScript(FIXTURE))
    const ads = normalizarBusca(payload)
    expect(ads).toHaveLength(30)
  })

  it('os anúncios saem completos, não só o id', () => {
    const [payload] = extrairPayloadsSsr(comScript(FIXTURE))
    const ads = normalizarBusca(payload)
    const anunciantes = new Set(ads.map((a) => a.anunciante.pageId))
    expect(anunciantes.size).toBe(17)
    for (const ad of ads) {
      expect(ad.id).toMatch(/^\d{15,17}$/)
      expect(ad.iniciouEm.getTime()).toBeGreaterThan(0)
      expect(ad.anunciante.pageName.length).toBeGreaterThan(0)
    }
  })

  it('ignora script que não carrega busca, sem parsear', () => {
    const doc = comScript('{"require":[["Bootloader",[],[],[]]]}')
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })

  it('sobrevive a JSON malformado', () => {
    const doc = comScript('{"search_results_connection": ')
    expect(() => extrairPayloadsSsr(doc)).not.toThrow()
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })

  it('não olha script de outro tipo', () => {
    const doc = comScript(FIXTURE, 'text/javascript')
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })

  it('devolve vazio num documento sem script nenhum', () => {
    const doc = document.implementation.createHTMLDocument('vazio')
    expect(extrairPayloadsSsr(doc)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/ssr.test.ts
```

Esperado: FALHA, com erro de módulo não encontrado para `../src/content/ssr`.

- [ ] **Step 3: Escrever a implementação**

Criar `src/content/ssr.ts`:

```ts
/**
 * O primeiro lote de anúncios não chega por XHR.
 *
 * Medido na busca real: 25 cards visíveis na carga, zero respostas XHR com
 * anúncios, e um único `<script type="application/json" data-sjs>` de 179 kB
 * carregando `search_results_connection`. O interceptador só remenda
 * `XMLHttpRequest`, então esses anúncios nunca entravam no índice — e o
 * overlay, corretamente, não pinta card cujo anúncio ele não conhece.
 *
 * Aqui eles entram.
 */

/**
 * Varredura de string barata, feita antes de qualquer `JSON.parse`.
 *
 * A página serve muitos scripts JSON. Parsear todos custaria caro e sem
 * motivo: só um deles carrega busca.
 */
const MARCADOR = 'search_results_connection'

/**
 * Fundo suficiente para o caminho real, que hoje tem doze níveis, com folga
 * para a Meta reempacotar. Sem o limite, um objeto cíclico travaria a aba.
 */
const PROFUNDIDADE_MAXIMA = 20

/** Reconhece um nó com a forma de resposta de busca. */
function ehRespostaDeBusca(no: object): boolean {
  const data = (no as Record<string, unknown>).data
  if (typeof data !== 'object' || data === null) return false

  const main = (data as Record<string, unknown>).ad_library_main
  if (typeof main !== 'object' || main === null) return false

  return MARCADOR in main
}

/**
 * Desce a árvore procurando respostas de busca.
 *
 * Procura por FORMA, não por caminho. Hoje o payload mora em
 * `require[0][3][0].__bbox.require[0][3][1].__bbox.result`, mas esses índices
 * são do empacotador da Meta e mudam sem aviso. É o mesmo princípio que rege
 * `src/core/router.ts`, que classifica pelo conteúdo e não pelo `doc_id`.
 */
function coletar(no: unknown, profundidade: number, achados: unknown[]): void {
  if (profundidade > PROFUNDIDADE_MAXIMA) return
  if (typeof no !== 'object' || no === null) return

  if (ehRespostaDeBusca(no)) {
    // Colhido o payload, não se desce nele: os `edges` lá dentro são fundos
    // e numerosos, e nada de interesse se esconde abaixo.
    achados.push(no)
    return
  }

  for (const valor of Object.values(no)) {
    coletar(valor, profundidade + 1, achados)
  }
}

/**
 * Colhe do HTML as respostas de busca que a Meta embutiu.
 *
 * Devolve nós prontos para `normalizarBusca`: a forma é idêntica à da
 * resposta XHR, porque é literalmente a mesma resposta, servida junto com a
 * página em vez de pedida depois.
 */
export function extrairPayloadsSsr(raiz: ParentNode): unknown[] {
  const achados: unknown[] = []

  const scripts = raiz.querySelectorAll('script[type="application/json"]')
  for (const script of Array.from(scripts)) {
    const bruto = script.textContent ?? ''
    if (!bruto.includes(MARCADOR)) continue

    try {
      coletar(JSON.parse(bruto), 0, achados)
    } catch {
      // Um script malformado não pode derrubar a leitura dos outros.
    }
  }

  return achados
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/ssr.test.ts
```

Esperado: PASSA, 7 testes.

- [ ] **Step 5: Ensinar o gravador a colher também o lote do HTML**

Em `tools/gravar-fixtures.spec.ts`, logo **depois** da linha do `page.goto` e
**antes** do laço de rolagem, inserir:

```ts
  // O primeiro lote não passa por XHR: vem embutido no HTML. Gravado com o
  // envelope inteiro de propósito — é o envelope que o extrator precisa
  // atravessar, e guardar só o miolo tornaria o teste cego para a travessia.
  const embutidos = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script[type="application/json"]'))
      .map((s) => s.textContent ?? '')
      .filter((t) => t.includes('search_results_connection')),
  )

  embutidos.forEach((conteudo, i) => {
    const arquivo = `ssr-${String(i + 1).padStart(2, '0')}.json`
    writeFileSync(join(DESTINO, arquivo), conteudo, 'utf8')
    indice.push({
      arquivo,
      bytes: conteudo.length,
      contem: ['search_results_connection', 'html-embutido'],
    })
  })
```

**NÃO rodar `npm.cmd run gravar:fixtures`.** Ele sobrescreveria as fixtures
commitadas com dados novos da Meta e quebraria os testes que dependem delas. A
fixture `tests/fixtures/ssr-01.json` já está no repositório.

- [ ] **Step 6: Conferir que a suíte inteira segue verde**

```bash
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA. O total sobe de 177 para 184 testes.

---

## Task 2: Um só tubo para as duas origens

**Files:**
- Modify: `src/content/pipeline.ts`
- Create: `tests/pipeline-ssr.test.ts`
- Não tocar: `tests/pipeline.test.ts`

**Interfaces:**
- Consumes: `extrairPayloadsSsr` da Task 1.
- Produces: de `src/content/pipeline.ts` —
  `ResultadoBusca { novos: number; total: number }`,
  `indexarBusca(corpo: unknown, store: AdStore): ResultadoBusca`,
  `processarSsr(raiz: ParentNode, store: AdStore): ResultadoBusca`.
  `processarCaptura` mantém a assinatura e o tipo de retorno que já tinha.

- [ ] **Step 1: Escrever o teste que falha**

Arquivo novo, e não um bloco dentro de `tests/pipeline.test.ts`: aquele arquivo
roda no ambiente `node`, e estes testes montam documento. Trocar o ambiente
dele arrastaria para o jsdom uma dezena de testes que não precisam de DOM, e
que hoje rodam mais rápido sem ele.

Criar `tests/pipeline-ssr.test.ts`:

```ts
// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { processarSsr } from '../src/content/pipeline'
import { AdStore } from '../src/core/store'

describe('processarSsr', () => {
  const FIXTURE_SSR = readFileSync(
    resolve(import.meta.dirname, 'fixtures', 'ssr-01.json'),
    'utf8',
  )

  function docComSsr(): Document {
    const doc = document.implementation.createHTMLDocument('teste')
    const script = doc.createElement('script')
    script.setAttribute('type', 'application/json')
    script.textContent = FIXTURE_SSR
    doc.body.appendChild(script)
    return doc
  }

  it('indexa o lote embutido no HTML', () => {
    const store = new AdStore()
    const r = processarSsr(docComSsr(), store)
    expect(r.novos).toBe(30)
    expect(r.total).toBe(30)
  })

  it('é idempotente: reler o mesmo HTML não duplica', () => {
    const store = new AdStore()
    const doc = docComSsr()
    processarSsr(doc, store)
    const segunda = processarSsr(doc, store)
    expect(segunda.novos).toBe(0)
    expect(segunda.total).toBe(30)
  })

  it('não estoura em documento sem lote embutido', () => {
    const store = new AdStore()
    const vazio = document.implementation.createHTMLDocument('vazio')
    const r = processarSsr(vazio, store)
    expect(r).toEqual({ novos: 0, total: 0 })
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/pipeline-ssr.test.ts
```

Esperado: FALHA, `processarSsr is not a function` ou erro de importação.

- [ ] **Step 3: Escrever a implementação**

Em `src/content/pipeline.ts`, acrescentar aos imports:

```ts
import { extrairPayloadsSsr } from './ssr'
```

Acrescentar, **depois** da interface `ResultadoCaptura`:

```ts
export interface ResultadoBusca {
  /** Quantos anúncios inéditos entraram no índice. */
  novos: number
  /** Tamanho do índice depois desta leitura. */
  total: number
}

/**
 * Indexa uma resposta de busca já parseada, venha ela de onde vier.
 *
 * Extraída de `processarCaptura` porque agora há duas origens: o XHR que o
 * interceptador remenda, e o script que a Meta embute no HTML. As duas
 * entregam exatamente a mesma forma, e duplicar a indexação criaria dois
 * lugares para consertar quando o schema deles mudar.
 */
export function indexarBusca(corpo: unknown, store: AdStore): ResultadoBusca {
  const antes = store.total()
  store.adicionar(normalizarBusca(corpo))
  const total = store.total()
  return { novos: total - antes, total }
}

/**
 * Lê do HTML o lote que a Meta serviu junto com a página.
 *
 * Idempotente pelo store, que descarta id repetido: reler o mesmo documento
 * não infla o índice.
 */
export function processarSsr(
  raiz: ParentNode,
  store: AdStore,
): ResultadoBusca {
  const antes = store.total()
  for (const payload of extrairPayloadsSsr(raiz)) {
    indexarBusca(payload, store)
  }
  const total = store.total()
  return { novos: total - antes, total }
}
```

Substituir o corpo de `processarCaptura` pelo que reaproveita `indexarBusca`:

```ts
export function processarCaptura(
  captura: Captura,
  store: AdStore,
): ResultadoCaptura {
  const tipo = classificar(captura)
  if (tipo !== 'busca') {
    return { tipo, novos: 0, total: store.total() }
  }

  const antes = store.total()
  try {
    const corpo = JSON.parse(
      captura.corpo.replace(PREFIXO_ANTI_SEQUESTRO, ''),
    ) as unknown
    const { novos, total } = indexarBusca(corpo, store)
    return { tipo, novos, total }
  } catch {
    // Uma resposta estranha não pode derrubar a sessão inteira.
    return { tipo: 'ignorar', novos: 0, total: antes }
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/pipeline-ssr.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA, sem nenhum teste antigo quebrado. O total sobe para 187, em
21 arquivos.

---

## Task 3: Ligar no content script e provar no navegador

**Files:**
- Modify: `src/content/index.ts`
- Create: `e2e/ssr.spec.ts`

**Interfaces:**
- Consumes: `processarSsr` da Task 2.

- [ ] **Step 1: Ligar a leitura do HTML**

Em `src/content/index.ts`, trocar a linha de importação do pipeline por:

```ts
import { processarCaptura, processarSsr } from './pipeline'
```

Acrescentar, **antes** da função `iniciar`:

```ts
/**
 * Lê o lote que a Meta embutiu no HTML da primeira carga.
 *
 * Roda uma vez só. O script é servido com a página e não muda depois; a
 * paginação seguinte volta a ser XHR, que o interceptador já pega. Reler a
 * cada mutação seria parsear 179 kB por rolagem, para nada.
 */
function lerLoteInicial(): void {
  const r = processarSsr(document, store)
  if (r.novos > 0) {
    console.info(`[CopyHaunt] lote do HTML: ${r.novos} | índice: ${r.total}`)
  }
}
```

E trocar o corpo de `iniciar` para:

```ts
function iniciar(): void {
  mountPanel()
  lerLoteInicial()
  garantirObservador()
  repintar()
}
```

A ordem importa: sem indexar antes, a primeira pintura não teria o que pintar.

- [ ] **Step 2: Escrever o teste de navegador**

Criar `e2e/ssr.spec.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from './fixtures'

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered'

const CAPTURAS = resolve(import.meta.dirname, '..', 'capturas')

/**
 * A prova do lote embutido: sem rolagem nenhuma, os cards do topo já têm
 * bandeja. Antes desta mudança eram zero, porque nenhum XHR trazia anúncio
 * na carga.
 */
test('os cards do topo já nascem com bandeja', async ({ context }) => {
  mkdirSync(CAPTURAS, { recursive: true })

  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })

  const linhas: string[] = []
  page.on('console', (m) => {
    if (m.text().includes('[CopyHaunt]')) linhas.push(m.text())
  })

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  // Sem rolar: é justamente a primeira tela que estava descoberta.
  await page.waitForTimeout(8000)

  const bandejas = await page.locator('[data-copyhaunt-id]').count()

  console.log('  bandejas na primeira tela:', bandejas)
  for (const l of linhas.filter((l) => l.includes('lote do HTML'))) {
    console.log('  ' + l)
  }

  await page.screenshot({
    path: resolve(CAPTURAS, 'topo-com-bandeja.png'),
    fullPage: false,
  })

  expect(bandejas).toBeGreaterThanOrEqual(20)
})
```

- [ ] **Step 3: Compilar e rodar**

```bash
npm.cmd run build
npx.cmd playwright test e2e/ssr.spec.ts --timeout=120000
```

Esperado: PASSA, com `bandejas na primeira tela:` em 25 ou perto disso, e a
linha `[CopyHaunt] lote do HTML: 30 | índice: 30`.

**Se der zero bandeja, PARE e reporte** as linhas de console capturadas. Não
tente consertar aumentando a espera: o sintoma seria outro problema.

- [ ] **Step 4: Conferir a captura com olho humano**

Abrir `capturas/topo-com-bandeja.png` e confirmar que os cards da primeira tela
têm os três botões no canto superior esquerdo e o badge de dias no direito.
Acabamento visual não se verifica por asserção.

- [ ] **Step 5: Rodar tudo**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(interceptor): indexar o lote que a Meta embute no HTML

O que foi feito:
- Ler do HTML da primeira carga os anúncios que nunca passam por XHR
- Unificar num só tubo a indexação das duas origens
- Ensinar o gravador de fixtures a colher também o lote embutido

Como foi feito:
- O payload é achado por forma, não por caminho: qualquer nó com
  data.ad_library_main.search_results_connection serve. O caminho real hoje
  passa por require[0][3][0].__bbox, e índices assim são do empacotador da
  Meta, que muda sem aviso
- Uma varredura de substring elimina todos os scripts JSON menos um antes de
  qualquer JSON.parse, porque a página serve muitos e só um traz busca
- processarCaptura cedeu a indexação para indexarBusca, e a leitura do HTML
  passa pelo mesmo funil: XHR e HTML entregam a mesma forma, e dois caminhos
  seriam dois lugares para consertar

Considerações:
- Sem isto os cards da primeira tela nasciam sem bandeja. Medido na busca
  real: 25 cards visíveis, zero respostas XHR com anúncio na carga, e um
  único script de 179 kB carregando os 30 anúncios de 17 anunciantes
- A leitura roda uma vez só, no início. O script vem com a página e não muda;
  a paginação seguinte volta a ser XHR. Reler a cada mutação seria parsear
  179 kB por rolagem, para nada
- O gravador ganhou o passo mas não foi executado: rodá-lo sobrescreveria as
  fixtures commitadas com dados novos da Meta e tornaria não determinísticos
  os testes que dependem delas

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

Esperado: 187 testes passando, typecheck limpo, manifest verificado, e a suíte
Playwright inteira verde.

**O que este plano NÃO entrega:** o botão OPEN funcional, o download em HD, a
cópia de texto e o painel de mineração. Continuam sem ação, como antes. Este
plano só faz o índice deixar de perder o primeiro lote.
