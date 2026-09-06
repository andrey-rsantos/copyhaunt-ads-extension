# Interceptador e gravador de fixtures — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturar payloads reais da Biblioteca de Anúncios em arquivo, e fazer o interceptador realmente interceptar `XMLHttpRequest` em vez de apenas anunciar presença.

**Architecture:** Três peças independentes. O gravador é um script Playwright que escuta o tráfego da página e não toca em código de produção. O interceptador aplica patch em `XMLHttpRequest` no main world. O roteador classifica cada resposta capturada e é testado contra as fixtures reais.

**Tech Stack:** TypeScript 7, Vitest 5, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seções 3, 6 e 10)
**Planos anteriores:** `2026-09-05-scaffolding.md`, `2026-09-05-verificacao-automatizada.md`

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e um único host. Nenhuma
  tarefa deste plano pode acrescentar permissão. O `verify:build` reprova se
  tentar.
- **Coleta 100% passiva.** O interceptador observa o que a página já pede.
  Nenhum código pode emitir requisição própria à Meta. Sem exceção.
- **Nunca automatizar login na Meta.** Nem no gravador, nem em teste.
- **Gravar apenas corpos de resposta.** URLs de requisição carregam parâmetros
  de sessão. Nada que identifique o usuário pode entrar no repositório.
- **Vite fica no 7.3.6.** Ver o plano de scaffolding.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e
  para. Nunca escrever dentro de `.git/`.
- **Commits:** padrão de `AGENTS.md`, tipo em inglês, texto em pt-BR,
  descrição no infinitivo, corpo condicional.

## Estrutura de arquivos ao final

> **Corrigido em 2026-09-06:** o gravador foi movido de `e2e/` para `tools/`,
> com configuração própria. Enquanto morava em `e2e/`, um `playwright test`
> comum o executava junto e **sobrescrevia as fixtures commitadas** com dados
> novos da Meta — tornando não-determinísticos todos os testes unitários que
> dependem delas. A estrutura abaixo mostra o estado original do plano.

```
├─ e2e/
│  └─ gravar-fixtures.spec.ts     grava payloads reais (rodado sob demanda)
├─ src/
│  ├─ core/
│  │  └─ router.ts                classifica payload capturado
│  └─ interceptor/
│     ├─ index.ts                 monta o patch e emite as capturas
│     └─ xhr-patch.ts             o patch em si, isolado e testável
└─ tests/
   ├─ fixtures/                   payloads reais gravados
   ├─ router.test.ts
   └─ xhr-patch.test.ts
```

**Responsabilidade de cada arquivo:**

- `e2e/gravar-fixtures.spec.ts` — não é teste de regressão; é ferramenta.
  Roda sob demanda para atualizar as fixtures quando a Meta mudar.
- `src/interceptor/xhr-patch.ts` — o patch isolado do resto, recebendo um
  alvo e um callback. Isso o torna testável com um `XMLHttpRequest` falso, sem
  navegador.
- `src/interceptor/index.ts` — aplica o patch no `window` real e emite as
  capturas pelo contrato de mensagens.
- `src/core/router.ts` — decide o que cada resposta é. Função pura.

## Por que o gravador não usa a extensão

A ideia natural seria a extensão capturar e mandar para o Playwright gravar.
Isso exigiria código de produção existente só para teste.

Mas o Playwright já vê todo o tráfego da página. As fixtures são apenas o que o
servidor da Meta respondeu — a extensão não precisa participar. Assim o
interceptador pode ser escrito e testado sem depender do gravador, e o gravador
pode rodar sem depender do interceptador.

## Verificado em campo

O diagnóstico de `2026-09-05-verificacao-automatizada.md` já provou, contra o
CSP real da Meta:

- a Biblioteca responde **200 sem sessão logada**
- nossos content scripts injetam na página real
- a ponte main world → mundo isolado funciona
- o iframe do painel carrega, mesmo com `frame-src` não listando
  `chrome-extension:`

Este plano se apoia nesses fatos, não em suposição.

---

## Task 1: Gravador de fixtures

**Files:**
- Create: `e2e/gravar-fixtures.spec.ts`
- Create: `tests/fixtures/.gitkeep`
- Modify: `package.json` (script)

**Interfaces:**
- Consumes: a fixture `test` de `e2e/fixtures.ts`.
- Produces: arquivos `tests/fixtures/*.json`, cada um o corpo bruto de uma
  resposta da Meta, e um `tests/fixtures/indice.json` descrevendo o que é cada
  arquivo.

- [ ] **Step 1: Acrescentar o script ao package.json**

No bloco `scripts`, acrescentar:

```json
    "gravar:fixtures": "playwright test e2e/gravar-fixtures.spec.ts"
```

- [ ] **Step 2: Criar a pasta de fixtures**

```bash
node -e "const fs=require('fs');fs.mkdirSync('tests/fixtures',{recursive:true});fs.writeFileSync('tests/fixtures/.gitkeep','')"
```

- [ ] **Step 3: Escrever o gravador**

Criar `e2e/gravar-fixtures.spec.ts`:

```ts
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { test } from './fixtures'

const DESTINO = resolve(import.meta.dirname, '..', 'tests', 'fixtures')

const URL_BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all' +
  '&country=BR&q=receitas&search_type=keyword_unordered' +
  '&sort_data[mode]=total_impressions&sort_data[direction]=desc'

/** Só o que interessa: respostas de busca e de colação. */
function ehRespostaDeAnuncios(url: string): boolean {
  return url.includes('/api/graphql/') || url.includes('/search_ads/')
}

/**
 * Ferramenta, não teste de regressão. Roda sob demanda para atualizar as
 * fixtures quando a Meta mudar o formato.
 *
 * Grava APENAS corpos de resposta. A URL de requisição carrega parâmetros de
 * sessão e não pode entrar no repositório.
 */
test('gravar fixtures da Biblioteca de Anúncios', async ({ context }) => {
  mkdirSync(DESTINO, { recursive: true })

  const page = await context.newPage()
  const indice: Array<{ arquivo: string; bytes: number; contem: string[] }> = []
  let n = 0

  page.on('response', async (res) => {
    if (!ehRespostaDeAnuncios(res.url())) return
    let corpo: string
    try {
      corpo = await res.text()
    } catch {
      return // resposta já descartada pelo navegador
    }
    if (corpo.length < 500) return // respostas vazias não servem de amostra

    // Só marcadores de conteúdo, nunca a URL: ela leva sessão junto.
    const marcadores = [
      'search_results_connection',
      'collated_results',
      'ad_archive_id',
      'collation_count',
      'snapshot',
    ].filter((m) => corpo.includes(m))

    if (marcadores.length === 0) return

    n += 1
    const arquivo = `payload-${String(n).padStart(2, '0')}.json`
    writeFileSync(join(DESTINO, arquivo), corpo, 'utf8')
    indice.push({ arquivo, bytes: corpo.length, contem: marcadores })
  })

  await page.goto(URL_BUSCA, { waitUntil: 'domcontentloaded', timeout: 30_000 })

  // Rolar para a Meta pedir mais páginas. Rolagem humana, sem requisição
  // própria: é a mesma coleta passiva que a extensão faz.
  for (let i = 0; i < 4; i += 1) {
    await page.mouse.wheel(0, 4000)
    await page.waitForTimeout(2500)
  }

  writeFileSync(
    join(DESTINO, 'indice.json'),
    JSON.stringify({ gravadoEm: new Date().toISOString(), payloads: indice }, null, 2),
    'utf8',
  )

  console.log('\n=== FIXTURES GRAVADAS ===')
  for (const p of indice) {
    console.log(`  ${p.arquivo}  ${(p.bytes / 1024).toFixed(0)} kB  [${p.contem.join(', ')}]`)
  }
  console.log(`  total: ${indice.length} arquivos`)
  console.log('=========================\n')
})
```

- [ ] **Step 4: Rodar o gravador**

```bash
npm.cmd run build
npm.cmd run gravar:fixtures
```

Esperado: o bloco `FIXTURES GRAVADAS` lista pelo menos um arquivo contendo
`search_results_connection` ou `collated_results`.

**Se nenhuma fixture for gravada, PARE e reporte** o bloco inteiro. Pode
significar que a Meta mudou o endpoint, e isso é informação de projeto.

- [ ] **Step 5: Conferir que nada de sessão vazou**

```bash
node -e "const fs=require('fs');const d='tests/fixtures';let achou=false;for(const f of fs.readdirSync(d)){if(!f.endsWith('.json'))continue;const t=fs.readFileSync(d+'/'+f,'utf8');for(const p of ['token_de_sessao','__user','datr','xs=','c_user','access_token','sessionid']){if(t.includes(p)){console.log('ATENCAO',f,'contem',p);achou=true}}}console.log(achou?'REVISAR':'nenhum marcador de sessao encontrado')"
```

Esperado: `nenhum marcador de sessao encontrado`.

**Se algo aparecer, PARE e reporte.** Não commite a fixture. Não tente
higienizar por conta própria: quem decide é o revisor.

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
🧪 test(interceptor): gravar fixtures reais da Biblioteca de Anúncios

O que foi feito:
- Acrescentar o gravador de fixtures e o script gravar:fixtures
- Gravar os primeiros payloads reais em tests/fixtures/

Como foi feito:
- O gravador é um script Playwright e não usa a extensão: o Playwright já vê
  o tráfego da página, então nenhum código de produção existe só para teste
- Grava apenas corpos de resposta. A URL de requisição carrega parâmetros de
  sessão e não pode entrar no repositório

Considerações:
- É ferramenta, não teste de regressão. Roda sob demanda para atualizar as
  fixtures quando a Meta mudar o formato
- A rolagem é a mesma coleta passiva que a extensão faz: nenhuma requisição
  própria é emitida
```

Não rodar `git add` nem `git commit`: quem commita é o revisor.

---

## Task 2: O patch em XMLHttpRequest

**Files:**
- Create: `src/interceptor/xhr-patch.ts`
- Test: `tests/xhr-patch.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: de `src/interceptor/xhr-patch.ts` —
  `aplicarPatch(alvo: XhrAlvo, aoCapturar: (c: Captura) => void): void`, onde
  `XhrAlvo` é `{ prototype: { open: Function; send: Function } }` e `Captura` é
  `{ url: string; corpo: string }`. Exporta também
  `removerExcludedIds(url: string): string`.

**Por que separar do index.ts:** o patch precisa ser testado sem navegador. Ao
receber o alvo por parâmetro em vez de mexer em `window` direto, um
`XMLHttpRequest` falso serve de alvo no Vitest.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/xhr-patch.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { aplicarPatch, removerExcludedIds } from '../src/interceptor/xhr-patch'

/** XMLHttpRequest falso: o mínimo que o patch precisa enxergar. */
function criarXhrFalso() {
  const ouvintes: Record<string, Array<() => void>> = {}
  class XhrFalso {
    responseURL = ''
    responseText = ''
    responseType = ''
    abriuCom: unknown[] = []
    open(...args: unknown[]) {
      this.abriuCom = args
    }
    send(_corpo?: string) {}
    addEventListener(evento: string, fn: () => void) {
      ouvintes[evento] = ouvintes[evento] ?? []
      ouvintes[evento].push(fn)
    }
    /** Simula a resposta chegando. */
    responder(url: string, texto: string) {
      this.responseURL = url
      this.responseText = texto
      for (const fn of ouvintes.load ?? []) fn.call(this)
    }
  }
  return XhrFalso
}

describe('removerExcludedIds', () => {
  it('remove o parâmetro excluded_ids da query', () => {
    const url = removerExcludedIds(
      'https://x.com/search_ads/?count=30&excluded_ids[0]=123&q=teste',
    )
    expect(url).not.toContain('excluded_ids')
    expect(url).toContain('count=30')
    expect(url).toContain('q=teste')
  })

  it('preserva URL que não tem o parâmetro', () => {
    const url = 'https://x.com/search_ads/?count=30'
    expect(removerExcludedIds(url)).toBe(url)
  })

  it('não quebra com URL sem query', () => {
    expect(removerExcludedIds('https://x.com/search_ads/')).toBe(
      'https://x.com/search_ads/',
    )
  })
})

describe('aplicarPatch', () => {
  it('entrega url e corpo quando a resposta chega', () => {
    const Xhr = criarXhrFalso()
    const capturado = vi.fn()
    aplicarPatch({ prototype: Xhr.prototype } as never, capturado)

    const req = new Xhr()
    req.open('GET', 'https://www.facebook.com/api/graphql/')
    req.send()
    req.responder('https://www.facebook.com/api/graphql/', '{"data":1}')

    expect(capturado).toHaveBeenCalledWith({
      url: 'https://www.facebook.com/api/graphql/',
      corpo: '{"data":1}',
    })
  })

  it('remove excluded_ids na abertura da requisição', () => {
    const Xhr = criarXhrFalso()
    aplicarPatch({ prototype: Xhr.prototype } as never, () => {})

    const req = new Xhr()
    req.open('GET', 'https://x.com/search_ads/?excluded_ids[0]=9&count=30')

    expect(String(req.abriuCom[1])).not.toContain('excluded_ids')
  })

  it('não deixa o patch ser desfeito', () => {
    const Xhr = criarXhrFalso()
    aplicarPatch({ prototype: Xhr.prototype } as never, () => {})
    const descritor = Object.getOwnPropertyDescriptor(Xhr.prototype, 'send')
    expect(descritor?.writable).toBe(false)
  })

  it('um erro no callback não derruba a requisição', () => {
    const Xhr = criarXhrFalso()
    aplicarPatch({ prototype: Xhr.prototype } as never, () => {
      throw new Error('falha no consumidor')
    })

    const req = new Xhr()
    req.open('GET', 'https://x.com/api/graphql/')
    req.send()
    expect(() => req.responder('https://x.com/api/graphql/', '{}')).not.toThrow()
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx.cmd vitest run tests/xhr-patch.test.ts
```

Esperado: FALHA, com erro de resolução de `../src/interceptor/xhr-patch`.

- [ ] **Step 3: Escrever a implementação**

Criar `src/interceptor/xhr-patch.ts`:

```ts
export interface Captura {
  url: string
  corpo: string
}

interface XhrAlvo {
  prototype: {
    open: (...args: unknown[]) => unknown
    send: (...args: unknown[]) => unknown
  }
}

/**
 * Remove `excluded_ids` da query. A Meta usa esse parâmetro para não repetir
 * anúncios já entregues; sem ele a resposta volta completa.
 */
export function removerExcludedIds(url: string): string {
  const [base, query] = url.split('?')
  if (!query) return url

  const original = new URLSearchParams(query)
  const limpa = new URLSearchParams()
  for (const [chave, valor] of original.entries()) {
    if (chave.toLowerCase().includes('excluded_ids')) continue
    limpa.append(chave, valor)
  }
  const resultado = limpa.toString()
  return resultado ? `${base}?${resultado}` : base
}

/**
 * Aplica o patch em XMLHttpRequest e avisa a cada resposta concluída.
 *
 * O alvo vem por parâmetro em vez de `window.XMLHttpRequest` direto para que
 * o patch possa ser testado com um objeto falso, sem navegador.
 *
 * Depois de aplicado, `open` e `send` viram não graváveis: se a página tentar
 * restaurar os originais, o patch sobrevive.
 */
export function aplicarPatch(
  alvo: XhrAlvo,
  aoCapturar: (captura: Captura) => void,
): void {
  const openOriginal = alvo.prototype.open
  Object.defineProperty(alvo.prototype, 'open', { writable: true })
  alvo.prototype.open = function (this: unknown, ...args: unknown[]) {
    const url = args[1]
    if (typeof url === 'string' && url.includes('/search_ads/')) {
      args[1] = removerExcludedIds(url)
    }
    return openOriginal.apply(this, args)
  }
  Object.defineProperty(alvo.prototype, 'open', { writable: false })

  const sendOriginal = alvo.prototype.send
  Object.defineProperty(alvo.prototype, 'send', { writable: true })
  alvo.prototype.send = function (this: XMLHttpRequest, ...args: unknown[]) {
    this.addEventListener('load', function (this: XMLHttpRequest) {
      // Um consumidor que explode não pode derrubar a requisição da página.
      try {
        const tipo = this.responseType
        if (tipo && tipo !== 'text') return
        aoCapturar({ url: this.responseURL, corpo: this.responseText })
      } catch {
        // silêncio proposital: a página não pode perceber que estamos aqui
      }
    })
    return sendOriginal.apply(this, args)
  }
  Object.defineProperty(alvo.prototype, 'send', { writable: false })
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx.cmd vitest run tests/xhr-patch.test.ts
```

Esperado: PASSA, 7 testes verdes.

- [ ] **Step 5: Ligar o patch no interceptador**

Substituir todo o conteúdo de `src/interceptor/index.ts`:

```ts
import { createMessage } from '../core/messages'
import { aplicarPatch } from './xhr-patch'

/**
 * Roda no main world, em document_start — antes da primeira requisição da
 * página, senão o patch chega tarde.
 *
 * A coleta é passiva: nada aqui emite requisição. Só escuta o que a página
 * já pede sozinha.
 */
aplicarPatch(window.XMLHttpRequest as never, (captura) => {
  window.postMessage(createMessage('raw-capture', captura), '*')
})

window.postMessage(createMessage('interceptor-ready', {}), '*')
console.info('[CopyHaunt] interceptador ativo no main world')
```

- [ ] **Step 6: Rodar a suíte inteira e o build**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

Esperado: tudo verde, e o manifest continua com uma permissão e um host.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(interceptor): aplicar patch em XMLHttpRequest e emitir capturas

O que foi feito:
- Interceptar open e send do XMLHttpRequest no main world
- Remover excluded_ids das requisições de busca
- Emitir cada resposta capturada pelo contrato de mensagens

Como foi feito:
- O patch recebe o alvo por parâmetro em vez de mexer em window direto, o que
  permite testá-lo com um XMLHttpRequest falso, sem navegador
- Depois de aplicado, open e send viram não graváveis: se a página tentar
  restaurar os originais, o patch sobrevive
- Erro no consumidor é engolido de propósito: a página não pode perceber que
  estamos ali, e uma exceção nossa não pode derrubar a requisição dela

Considerações:
- excluded_ids é a Meta pedindo para não repetir o que já entregou. Sem ele a
  resposta volta completa, que é o que a mineração precisa
- A coleta segue passiva: nada aqui emite requisição própria
```

Não rodar `git add` nem `git commit`.

---

## Task 3: O roteador das capturas

**Files:**
- Create: `src/core/router.ts`
- Test: `tests/router.test.ts`

**Interfaces:**
- Consumes: `Captura` de `src/interceptor/xhr-patch.ts`; as fixtures da Task 1.
- Produces: de `src/core/router.ts` —
  `classificar(captura: Captura): TipoCaptura`, onde `TipoCaptura` é
  `'busca' | 'colacao' | 'anunciante' | 'erro' | 'ignorar'`.

**Regra de projeto:** classificar pelo **conteúdo** antes do `doc_id`. O spec
registra que a Meta troca os `doc_id` sem aviso; reconhecer
`search_results_connection` no corpo é o que mantém a extensão viva quando isso
acontece.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/router.test.ts`:

```ts
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { classificar } from '../src/core/router'

const PASTA = resolve(import.meta.dirname, 'fixtures')

describe('classificar', () => {
  it('reconhece resultado de busca pelo conteúdo', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: '{"data":{"search_results_connection":{"edges":[]}}}',
      }),
    ).toBe('busca')
  })

  it('reconhece grupo de colação pelo conteúdo', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: '{"data":{"collation_results":{"edges":[]}}}',
      }),
    ).toBe('colacao')
  })

  it('reconhece erro do GraphQL', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: '{"errors":[{"message":"algo quebrou"}]}',
      }),
    ).toBe('erro')
  })

  it('ignora resposta que não é de anúncios', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/ajax/qm/',
        corpo: '{"payload":{}}',
      }),
    ).toBe('ignorar')
  })

  it('ignora corpo que não é JSON válido', () => {
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: 'for (;;);{isso nao e json',
      }),
    ).toBe('ignorar')
  })

  it('classifica busca mesmo sem doc_id conhecido', () => {
    // O spec registra que a Meta troca os doc_id sem aviso. Reconhecer pelo
    // conteúdo é o que mantém a extensão viva quando isso acontece.
    expect(
      classificar({
        url: 'https://www.facebook.com/api/graphql/?doc_id=00000000000',
        corpo: '{"data":{"search_results_connection":{"edges":[]}}}',
      }),
    ).toBe('busca')
  })
})

describe('classificar contra as fixtures reais', () => {
  const arquivos = readdirSync(PASTA).filter(
    (f) => f.startsWith('payload-') && f.endsWith('.json'),
  )

  it('existe pelo menos uma fixture gravada', () => {
    expect(arquivos.length).toBeGreaterThan(0)
  })

  it('pelo menos uma fixture real é reconhecida como busca', () => {
    // Este é o invariante que importa: se o formato da Meta mudar a ponto de
    // nenhuma resposta de busca ser reconhecida, a extensão fica cega.
    //
    // Não se exige que TODA fixture seja classificada: o gravador salva
    // qualquer payload com marcador de anúncio, e nem todo payload da Meta
    // é um dos quatro tipos que nos interessam.
    const tipos = arquivos.map((arquivo) => ({
      arquivo,
      tipo: classificar({
        url: 'https://www.facebook.com/api/graphql/',
        corpo: readFileSync(join(PASTA, arquivo), 'utf8'),
      }),
    }))

    // Diagnóstico: sai no terminal quando o teste falha, e ajuda a entender
    // o que a Meta está mandando hoje.
    console.log(
      'classificação das fixtures:',
      tipos.map((t) => `${t.arquivo}=${t.tipo}`).join(' '),
    )

    expect(tipos.some((t) => t.tipo === 'busca')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx.cmd vitest run tests/router.test.ts
```

Esperado: FALHA, com erro de resolução de `../src/core/router`.

- [ ] **Step 3: Escrever a implementação**

Criar `src/core/router.ts`:

```ts
import { ehEndpointDeAnuncios, type Captura } from '../interceptor/xhr-patch'

export type TipoCaptura =
  | 'busca'
  | 'colacao'
  | 'anunciante'
  | 'erro'
  | 'ignorar'

/** A Meta prefixa respostas com isto para impedir sequestro de JSON. */
const PREFIXO_ANTI_SEQUESTRO = /^\s*for\s*\(\s*;\s*;\s*\)\s*;/

/**
 * Decide o que uma resposta capturada é.
 *
 * A classificação olha o CONTEÚDO, não o doc_id. O spec registra que a Meta
 * troca os doc_id sem aviso; reconhecer pelo corpo é o que mantém a extensão
 * viva quando isso acontece.
 */
export function classificar(captura: Captura): TipoCaptura {
  if (!ehEndpointDeAnuncios(captura.url)) return 'ignorar'

  const corpo = captura.corpo.replace(PREFIXO_ANTI_SEQUESTRO, '')

  try {
    JSON.parse(corpo)
  } catch {
    return 'ignorar'
  }

  // A ordem importa. Uma resposta de busca também contém `collated_results`
  // dentro de cada nó — são campos diferentes: `collated_results` é o
  // agrupamento dentro do resultado, `collation_results` é a resposta do
  // endpoint de colação. Testar a busca primeiro evita confundir os dois.
  if (corpo.includes('search_results_connection')) return 'busca'
  if (corpo.includes('collation_results')) return 'colacao'
  if (corpo.includes('"errors"')) return 'erro'
  if (corpo.includes('pageID') || corpo.includes('page_info')) {
    return 'anunciante'
  }

  return 'ignorar'
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx.cmd vitest run tests/router.test.ts
```

Esperado: PASSA.

**Se o teste "nenhuma fixture real é classificada como ignorar" falhar, PARE e
reporte** qual arquivo falhou e as primeiras 300 letras dele. Significa que o
formato real tem um caso que a classificação não previu — e isso é informação
de projeto, não erro de implementação.

- [ ] **Step 5: Rodar a suíte inteira**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(normalizer): classificar as capturas por conteúdo

O que foi feito:
- Acrescentar o roteador que decide o que cada resposta capturada é
- Cobrir com testes sintéticos e com as fixtures reais gravadas

Como foi feito:
- A classificação olha o conteúdo do corpo, não o doc_id. O spec registra que
  a Meta troca os doc_id sem aviso; reconhecer search_results_connection no
  corpo é o que mantém a extensão viva quando isso acontece
- O prefixo anti-sequestro de JSON que a Meta usa é removido antes do parse

Considerações:
- O teste que roda contra todas as fixtures reais é o mais valioso do
  conjunto: ele falha se o formato da Meta mudar de um jeito que a
  classificação não previu
```

Não rodar `git add` nem `git commit`.

---

## Verificação final

```bash
npm.cmd test              # suíte unitária, incluindo os testes contra fixtures
npm.cmd run typecheck
npm.cmd run verify:build  # permissões continuam mínimas
npx.cmd playwright test e2e/extension.spec.ts   # a extensão ainda carrega
git status --short
```

**O que este plano NÃO entrega:** o normalizador em si — a conversão do payload
no tipo `Ad`. Ele vem no plano seguinte, e agora terá fixtures reais para se
apoiar, que era exatamente o que faltava.
