# Config remota: consertar em minutos, não em dias · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buscar de um JSON hospedado os valores que a Meta pode mudar sem
aviso, para que uma quebra seja consertada em minutos em vez de esperar dias
pela revisão da Chrome Web Store.

**Architecture:** O service worker busca o JSON, valida e cacheia; o content
script pede a ele. Dado, nunca código — nada do que vem do arquivo é
executado. Se a busca falhar ou o conteúdo não passar na validação, vale a
cópia embutida no pacote, e a extensão segue funcionando.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md` (seção 8,
que a marca como **requisito de MVP, não melhoria futura**)

## Por que isto existe

Sem config remota, cada mudança da Meta deixa a base instalada quebrada pelos
dias que a revisão da Chrome Web Store levar. Com ela, a correção é um commit.

A configuração remota mantém os valores operacionais separados da
  lógica da extensão. O projeto adota essa decisão para que mudanças da
  plataforma possam ser corrigidas sem alterar o código publicado.
  
  **Onde o arquivo mora:** `raw.githubusercontent.com`, no próprio repositório.
Confirmado que responde com `Access-Control-Allow-Origin: *`, não exige
infraestrutura nova, e atualizar a config vira um commit. Trocar de hospedagem
depois é mudar uma constante e um host no manifest.

**Quem busca:** o service worker. O content script roda dentro de
`facebook.com` e ficaria sujeito à CSP da página; o service worker, com
`host_permissions`, não.

**O que entra agora:** só `anchors.libraryIdPattern`, que tem consumidor real
imediato — é o padrão que acha os cards, e a peça que quebra se a Meta mexer no
DOM. O `advertiserDocId` da seção 8 **não entra**: ele só serve à consulta
forjada do Instagram, e campo sem consumidor é peso morto. Ele entra no plano
daquela consulta, junto com quem o usa.

## Global Constraints

- **`permissions` continua exatamente `["storage"]`.** Nenhuma permissão nova.
- **`host_permissions` passa de um para dois hosts**, e o verificador do build
  passa a travar nesses dois. A trava não afrouxa: continua exata.
- **Somente dados, nunca código.** Nada vindo do arquivo pode ser executado:
  proibido `eval`, `new Function`, `import()` dinâmico ou injeção de `<script>`.
- **Nenhuma requisição à Meta.** Este plano fala com o GitHub, nunca com a Meta.
- **npm no PowerShell do Windows:** usar `npm.cmd` e `npx.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg-codex` na raiz e para.
- **Commits:** padrão de `CLAUDE.md`, tipo em inglês, texto em pt-BR, com rodapé
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

---

## Task 1: Ler e validar a config

**Files:**
- Create: `src/core/config.ts`
- Create: `tests/config.test.ts`

**Interfaces:**
- Produces: de `src/core/config.ts` —
  `ConfigRemota { version: number; anchors: { libraryIdPattern: string } }`,
  `CONFIG_EMBUTIDA: ConfigRemota`,
  `validarConfig(bruto: unknown): ConfigRemota | null`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  CONFIG_EMBUTIDA,
  validarConfig,
  type ConfigRemota,
} from '../src/core/config'

const VALIDA: ConfigRemota = {
  version: 7,
  anchors: { libraryIdPattern: '(?<!\\d)(\\d{15,17})(?!\\d)' },
}

describe('CONFIG_EMBUTIDA', () => {
  it('é ela própria válida, senão a queda não teria para onde cair', () => {
    expect(validarConfig(CONFIG_EMBUTIDA)).toEqual(CONFIG_EMBUTIDA)
  })

  it('traz o padrão de ancoragem que o código usa hoje', () => {
    const re = new RegExp(CONFIG_EMBUTIDA.anchors.libraryIdPattern)
    expect('Library ID: 2366492917183805').toMatch(re)
  })
})

describe('validarConfig', () => {
  it('aceita uma config bem formada', () => {
    expect(validarConfig(VALIDA)).toEqual(VALIDA)
  })

  it('devolve só os campos conhecidos, descartando o resto', () => {
    const comLixo = { ...VALIDA, extra: 'ignorado', scripts: ['perigoso'] }
    expect(validarConfig(comLixo)).toEqual(VALIDA)
  })

  it.each([
    ['nulo', null],
    ['string', 'nada disso'],
    ['sem version', { anchors: VALIDA.anchors }],
    ['version não numérica', { version: 'sete', anchors: VALIDA.anchors }],
    ['sem anchors', { version: 7 }],
    ['anchors nulo', { version: 7, anchors: null }],
    ['padrão vazio', { version: 7, anchors: { libraryIdPattern: '' } }],
    [
      'padrão não string',
      { version: 7, anchors: { libraryIdPattern: 123 } },
    ],
  ])('recusa config %s', (_caso, bruto) => {
    expect(validarConfig(bruto)).toBeNull()
  })

  it('recusa padrão que não compila como regex', () => {
    const quebrado = { version: 7, anchors: { libraryIdPattern: '(?<!\\d' } }
    expect(validarConfig(quebrado)).toBeNull()
  })

  it('recusa padrão longo demais, que poderia travar a aba', () => {
    const gigante = { version: 7, anchors: { libraryIdPattern: 'a'.repeat(501) } }
    expect(validarConfig(gigante)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/config.test.ts
```

Esperado: FALHA, módulo `../src/core/config` não encontrado.

- [ ] **Step 3: Escrever a validação**

Criar `src/core/config.ts`:

```ts
/**
 * A config remota: os valores que a Meta pode mudar sem aviso.
 *
 * **Somente dados, nunca código.** Nada daqui é executado — a proibição de
 * código remoto do MV3 é o que torna esta abordagem legítima, e é ela que
 * separa "config" de "carregar script de fora".
 */
export interface ConfigRemota {
  version: number
  anchors: {
    /** Padrão que acha o ID da biblioteca no texto do card. */
    libraryIdPattern: string
  }
}

/**
 * O padrão de expressão regular vem de fora, e expressão regular mal escrita
 * trava a aba por backtracking. Um teto de tamanho não impede toda armadilha,
 * mas descarta o caso grosseiro sem custo.
 *
 * ponytail: teto simples de tamanho, não análise de complexidade. Se algum dia
 * a config trouxer padrões grandes de propósito, medir o tempo de execução
 * contra uma entrada de teste antes de adotar.
 */
const TAMANHO_MAXIMO_PADRAO = 500

/**
 * A cópia que viaja no pacote.
 *
 * É para onde a extensão cai quando a busca falha ou o conteúdo não passa na
 * validação. Sem ela, uma indisponibilidade do arquivo deixaria a extensão sem
 * saber ancorar nada.
 */
export const CONFIG_EMBUTIDA: ConfigRemota = {
  version: 0,
  anchors: { libraryIdPattern: '(?<!\\d)(\\d{15,17})(?!\\d)' },
}

/**
 * Devolve uma config confiável, ou `null`.
 *
 * Copia campo a campo de propósito: o que chega de fora entra na extensão
 * apenas pelas portas que esta função abre, e um arquivo comprometido não
 * consegue contrabandear chave nenhuma para dentro do objeto.
 */
export function validarConfig(bruto: unknown): ConfigRemota | null {
  if (typeof bruto !== 'object' || bruto === null) return null
  const raiz = bruto as Record<string, unknown>

  if (typeof raiz.version !== 'number') return null

  const anchors = raiz.anchors
  if (typeof anchors !== 'object' || anchors === null) return null

  const padrao = (anchors as Record<string, unknown>).libraryIdPattern
  if (typeof padrao !== 'string') return null
  if (padrao.length === 0 || padrao.length > TAMANHO_MAXIMO_PADRAO) return null

  // Um padrão que não compila derrubaria a ancoragem de todos os cards.
  try {
    new RegExp(padrao)
  } catch {
    return null
  }

  return { version: raiz.version, anchors: { libraryIdPattern: padrao } }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/config.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 2: Buscar, cachear e cair para a cópia embutida

**Files:**
- Create: `src/background/config-remota.ts`
- Create: `tests/config-remota.test.ts`

**Interfaces:**
- Consumes: `ConfigRemota`, `CONFIG_EMBUTIDA`, `validarConfig` da Task 1.
- Produces: de `src/background/config-remota.ts` —
  `URL_CONFIG: string`,
  `VALIDADE_MS: number`,
  `Dependencias { buscar; ler; gravar; agora }`,
  `obterConfig(deps: Dependencias): Promise<ConfigRemota>`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/config-remota.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import {
  obterConfig,
  VALIDADE_MS,
  type Dependencias,
} from '../src/background/config-remota'
import { CONFIG_EMBUTIDA } from '../src/core/config'

const REMOTA = {
  version: 7,
  anchors: { libraryIdPattern: '(?<!\\d)(\\d{16,18})(?!\\d)' },
}

function resposta(corpo: unknown, ok = true) {
  return { ok, json: async () => corpo } as unknown as Response
}

/** Dependências de mentira, com um cache em memória. */
function deps(extra: Partial<Dependencias> = {}): Dependencias {
  const memoria = new Map<string, unknown>()
  return {
    buscar: vi.fn(async () => resposta(REMOTA)),
    ler: vi.fn(async (chave: string) => memoria.get(chave)),
    gravar: vi.fn(async (chave: string, valor: unknown) => {
      memoria.set(chave, valor)
    }),
    agora: () => 1_000_000,
    ...extra,
  }
}

describe('obterConfig', () => {
  it('busca, valida e devolve a config remota', async () => {
    expect(await obterConfig(deps())).toEqual(REMOTA)
  })

  it('guarda o que buscou, para não buscar de novo na validade', async () => {
    const d = deps()
    await obterConfig(d)
    await obterConfig(d)
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })

  it('busca de novo quando o cache venceu', async () => {
    const d = deps()
    await obterConfig(d)
    const depois = { ...d, agora: () => 1_000_000 + VALIDADE_MS + 1 }
    await obterConfig(depois)
    expect(d.buscar).toHaveBeenCalledTimes(1)
    expect(depois.buscar).toHaveBeenCalledTimes(1)
  })

  it('cai para a cópia embutida quando a rede falha', async () => {
    const d = deps({
      buscar: vi.fn(async () => {
        throw new Error('sem rede')
      }),
    })
    expect(await obterConfig(d)).toEqual(CONFIG_EMBUTIDA)
  })

  it('cai para a cópia embutida quando a resposta não é ok', async () => {
    const d = deps({ buscar: vi.fn(async () => resposta(REMOTA, false)) })
    expect(await obterConfig(d)).toEqual(CONFIG_EMBUTIDA)
  })

  it('cai para a cópia embutida quando o conteúdo não passa na validação', async () => {
    const d = deps({
      buscar: vi.fn(async () => resposta({ version: 'errado' })),
    })
    expect(await obterConfig(d)).toEqual(CONFIG_EMBUTIDA)
  })

  it('não guarda no cache o que reprovou na validação', async () => {
    const d = deps({ buscar: vi.fn(async () => resposta({ lixo: true })) })
    await obterConfig(d)
    expect(d.gravar).not.toHaveBeenCalled()
  })

  it('descarta cache gravado que não passe mais na validação', async () => {
    const memoria = new Map<string, unknown>([
      ['copyhaunt-config', { em: 1_000_000, config: { version: 'errado' } }],
    ])
    const d = deps({
      ler: vi.fn(async (c: string) => memoria.get(c)),
      buscar: vi.fn(async () => resposta(REMOTA)),
    })
    expect(await obterConfig(d)).toEqual(REMOTA)
    expect(d.buscar).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/config-remota.test.ts
```

Esperado: FALHA, módulo não encontrado.

- [ ] **Step 3: Escrever a busca**

Criar `src/background/config-remota.ts`:

```ts
import { CONFIG_EMBUTIDA, validarConfig, type ConfigRemota } from '../core/config'

/**
 * Onde a config mora.
 *
 * `raw.githubusercontent.com` responde com `Access-Control-Allow-Origin: *`,
 * não exige infraestrutura nova e atualizar a config vira um commit. Trocar de
 * hospedagem é mudar esta constante e o host no manifest.
 */
export const URL_CONFIG =
  'https://raw.githubusercontent.com/andrey-rsantos/CopyHaunt-Ads/main/config/config.json'

/** Seis horas. A Meta não muda de hora em hora, e buscar por sessão bastaria. */
export const VALIDADE_MS = 6 * 60 * 60 * 1000

const CHAVE = 'copyhaunt-config'

/**
 * O que este módulo precisa do mundo, injetado para poder ser testado sem
 * rede e sem `chrome`. É o mesmo padrão do relógio em `src/core/clock.ts` e do
 * alvo do patch em `src/interceptor/xhr-patch.ts`.
 */
export interface Dependencias {
  buscar: typeof fetch
  ler: (chave: string) => Promise<unknown>
  gravar: (chave: string, valor: unknown) => Promise<void>
  agora: () => number
}

interface Guardado {
  em: number
  config: unknown
}

/**
 * Devolve a config, preferindo o cache válido, depois a rede, depois a cópia
 * embutida.
 *
 * Nunca lança: uma config indisponível não pode derrubar a extensão. O pior
 * caso é a extensão trabalhar com os valores que vieram no pacote — que é
 * exatamente como ela trabalharia sem este módulo.
 */
export async function obterConfig(deps: Dependencias): Promise<ConfigRemota> {
  const guardado = (await deps.ler(CHAVE).catch(() => undefined)) as
    | Guardado
    | undefined

  if (guardado && deps.agora() - guardado.em < VALIDADE_MS) {
    const doCache = validarConfig(guardado.config)
    // Cache que não passa mais na validação é lixo: segue para a rede.
    if (doCache) return doCache
  }

  try {
    const resposta = await deps.buscar(URL_CONFIG)
    if (!resposta.ok) return CONFIG_EMBUTIDA

    const config = validarConfig(await resposta.json())
    if (!config) return CONFIG_EMBUTIDA

    await deps.gravar(CHAVE, { em: deps.agora(), config })
    return config
  } catch {
    // Sem rede, DNS caído, JSON quebrado: a extensão continua com o pacote.
    return CONFIG_EMBUTIDA
  }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/config-remota.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 3: Abrir o host no manifest, sem afrouxar a trava

**Files:**
- Modify: `src/manifest.config.ts`
- Modify: `scripts/verify-manifest.mjs`
- Modify: `tests/manifest.test.ts`
- Create: `config/config.json`

**Interfaces:**
- Consumes: `URL_CONFIG` da Task 2.

- [ ] **Step 1: Ajustar o teste primeiro**

Em `tests/manifest.test.ts`, substituir a asserção de `host_permissions` (a que
hoje espera um único item) por:

```ts
  it('pede exatamente os dois hosts necessários, e nada além', () => {
    expect(manifest.host_permissions).toEqual([
      '*://*.facebook.com/ads/library/*',
      'https://raw.githubusercontent.com/andrey-rsantos/CopyHaunt-Ads/*',
    ])
  })
```

A asserção de `permissions` **não muda**: continua `['storage']`.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/manifest.test.ts
```

Esperado: FALHA — o manifest ainda declara um host só.

- [ ] **Step 3: Declarar o host**

Em `src/manifest.config.ts`, acrescentar abaixo da constante `AD_LIBRARY`:

```ts
/**
 * O host da config remota. Escopo estreito de propósito: só este repositório,
 * não o `raw.githubusercontent.com` inteiro.
 */
const CONFIG_REMOTA =
  'https://raw.githubusercontent.com/andrey-rsantos/CopyHaunt-Ads/*'
```

E trocar a linha do `host_permissions` por:

```ts
  host_permissions: [AD_LIBRARY, CONFIG_REMOTA],
```

- [ ] **Step 4: Atualizar o verificador do build**

Em `scripts/verify-manifest.mjs`, substituir o bloco que checa
`host_permissions` por:

```js
const hosts = manifest.host_permissions ?? []
const esperados = [
  '*://*.facebook.com/ads/library/*',
  'https://raw.githubusercontent.com/andrey-rsantos/CopyHaunt-Ads/*',
]
if (hosts.length !== esperados.length || hosts.some((h, i) => h !== esperados[i])) {
  falhas.push(`host_permissions inesperado: ${JSON.stringify(hosts)}`)
}
```

A trava continua exata: dois hosts, nesta ordem, e nada mais. Um host a mais
reprova o build do mesmo jeito que antes.

- [ ] **Step 5: Publicar o arquivo de config**

Criar `config/config.json`:

```json
{
  "version": 1,
  "anchors": {
    "libraryIdPattern": "(?<!\\d)(\\d{15,17})(?!\\d)"
  }
}
```

O arquivo entra no repositório e passa a ser servido por
`raw.githubusercontent.com` assim que o commit chegar em `main`. Enquanto não
chegar, a extensão usa a cópia embutida — que é este mesmo conteúdo.

- [ ] **Step 6: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/manifest.test.ts
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

Esperado: PASSA, e o verificador imprime
`manifest gerado OK: world MAIN preservado, permissões mínimas`.

---

## Task 4: Entregar a config a quem ancora os cards

**Files:**
- Modify: `src/background/index.ts`
- Modify: `src/content/anchor.ts`
- Modify: `src/content/index.ts`
- Create: `tests/anchor-config.test.ts`

**Interfaces:**
- Consumes: `obterConfig` (Task 2), `ConfigRemota` (Task 1).
- Produces: de `src/content/anchor.ts` —
  `definirPadraoAncora(padrao: string): void`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/anchor-config.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
  acharCards,
  definirPadraoAncora,
  PADRAO_LIBRARY_ID,
} from '../src/content/anchor'

function card(texto: string): Document {
  const doc = document.implementation.createHTMLDocument('teste')
  const div = document.createElement('div')
  const span = document.createElement('span')
  span.textContent = texto
  div.appendChild(span)
  doc.body.appendChild(div)
  return doc
}

afterEach(() => {
  // Estado de módulo: sem isto um teste contamina o seguinte.
  definirPadraoAncora(PADRAO_LIBRARY_ID.source)
})

describe('definirPadraoAncora', () => {
  it('faz a ancoragem passar a usar o padrão novo', () => {
    // Padrão de 18 dígitos: o de 16 deixa de ser reconhecido.
    definirPadraoAncora('(?<!\\d)(\\d{18})(?!\\d)')
    expect(acharCards(card('Library ID: 1223312153071533')).size).toBe(0)
    expect(acharCards(card('Library ID: 122331215307153312')).size).toBe(1)
  })

  it('volta a ancorar normalmente com o padrão de fábrica', () => {
    definirPadraoAncora(PADRAO_LIBRARY_ID.source)
    expect(acharCards(card('Library ID: 1223312153071533')).size).toBe(1)
  })

  it('ignora padrão que não compila, mantendo o que funcionava', () => {
    definirPadraoAncora('(?<!\\d')
    expect(acharCards(card('Library ID: 1223312153071533')).size).toBe(1)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/anchor-config.test.ts
```

Esperado: FALHA, `definirPadraoAncora` não é exportada.

- [ ] **Step 3: Tornar o padrão trocável**

Em `src/content/anchor.ts`, logo **depois** da declaração de
`PADRAO_LIBRARY_ID`, acrescentar:

```ts
/**
 * O padrão em uso. Começa igual ao de fábrica e só muda se a config remota
 * trouxer outro — é a peça que a Meta quebra quando mexe no DOM, e trocá-la
 * de fora é o motivo de a config remota existir.
 */
let padraoAtual = PADRAO_LIBRARY_ID

/**
 * Troca o padrão de ancoragem. Padrão inválido é ignorado: perder a ancoragem
 * inteira por causa de uma config ruim seria pior que ignorar a config.
 */
export function definirPadraoAncora(padrao: string): void {
  try {
    padraoAtual = new RegExp(padrao)
  } catch {
    // Mantém o que já funcionava.
  }
}
```

E trocar, **nas três funções que usam o padrão**, as referências a
`PADRAO_LIBRARY_ID` por `padraoAtual`:

- em `extrairLibraryId`: `return texto.match(padraoAtual)?.[1] ?? null`
- em `contarIds`: `const g = new RegExp(padraoAtual.source, 'g')`
- em `acharCards`: continua chamando `extrairLibraryId`, sem mudança

`PADRAO_LIBRARY_ID` **continua exportada** — os testes existentes a usam, e ela
é a referência de fábrica.

- [ ] **Step 4: Servir a config pelo service worker**

Substituir o conteúdo de `src/background/index.ts` por:

```ts
import { obterConfig } from './config-remota'

chrome.runtime.onInstalled.addListener(() => {
  console.info('[CopyHaunt] service worker instalado')
})

/**
 * O content script não busca a config sozinho: ele roda dentro de
 * `facebook.com` e ficaria sujeito à CSP da página. O service worker, com
 * `host_permissions`, não fica.
 *
 * O canal `chrome.runtime` é privado da extensão, então aqui não é preciso o
 * carimbo de namespace que `src/core/messages.ts` exige no main world.
 */
chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.tipo !== 'obter-config') return false

  obterConfig({
    buscar: (...args) => fetch(...args),
    ler: async (chave) => (await chrome.storage.local.get(chave))[chave],
    gravar: async (chave, valor) =>
      chrome.storage.local.set({ [chave]: valor }),
    agora: () => Date.now(),
  }).then(responder)

  // `true` mantém o canal aberto para a resposta assíncrona.
  return true
})
```

- [ ] **Step 5: Pedir a config ao subir**

Em `src/content/index.ts`, acrescentar aos imports:

```ts
import { definirPadraoAncora } from './anchor'
```

Acrescentar, **antes** da função `iniciar`:

```ts
/**
 * Pede a config ao service worker e aplica o que dela depende.
 *
 * Não bloqueia a subida: a extensão começa com o padrão de fábrica e troca
 * quando a resposta chegar. Esperar pela rede para pintar o primeiro card
 * seria trocar um risco raro por uma lentidão certa.
 */
function aplicarConfig(): void {
  chrome.runtime.sendMessage({ tipo: 'obter-config' }, (config) => {
    if (chrome.runtime.lastError || !config?.anchors?.libraryIdPattern) return
    definirPadraoAncora(config.anchors.libraryIdPattern)
  })
}
```

E acrescentar a chamada como **primeira linha** de `iniciar`:

```ts
function iniciar(): void {
  aplicarConfig()
  mountPanel()
  lerLoteInicial()
  garantirObservador()
  repintar()
}
```

- [ ] **Step 6: Rodar tudo**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Esperado: PASSA, tudo verde, incluindo os testes de e2e que já existiam.

- [ ] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg-codex` na raiz com:

```
✨ feat(config): buscar do repositório os valores que a Meta pode mudar

O que foi feito:
- Buscar, validar e cachear um JSON de configuração hospedado
- Cair para a cópia embutida quando a busca ou a validação falharem
- Passar a ancoragem dos cards a ler o padrão da config

Como foi feito:
- Quem busca é o service worker, não o content script: aquele roda dentro de
  facebook.com e ficaria sujeito à CSP da página
- A validação copia campo a campo, nunca o objeto inteiro: o que chega de
  fora entra apenas pelas portas que a função abre
- O padrão de regex tem teto de tamanho, porque expressão mal escrita trava a
  aba por backtracking
- A config não bloqueia a subida: a extensão começa com o padrão de fábrica e
  troca quando a resposta chega

Considerações:
- Somente dados, nunca código. Nada vindo do arquivo é executado, que é o que
  separa configuração remota de carregamento de código remoto, proibido no
  MV3. É a alternativa que a própria documentação do Chrome recomenda, e o
  que a extensão de referência já faz com os seletores dela
- host_permissions passa de um host para dois, e o verificador do build passa
  a travar nos dois, na ordem. A trava não afrouxou: um host a mais continua
  reprovando o build. permissions segue exatamente ["storage"]
- O escopo do host é o repositório, não o raw.githubusercontent.com inteiro
- advertiserDocId não entra aqui. Ele só serve à consulta forjada do
  Instagram, e campo sem consumidor é peso morto: entra no plano de quem o usa

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

**O que este plano NÃO entrega:** a consulta forjada do Instagram, o
`advertiserDocId` e os `fieldPaths` da seção 8. Entrega o mecanismo e um
consumidor real; os demais campos entram junto com quem os consome.
