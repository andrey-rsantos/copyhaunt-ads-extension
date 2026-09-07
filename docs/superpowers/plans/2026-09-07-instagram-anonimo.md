# Instagram do anunciante sem a conta do usuário · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Progresso

- **Estado:** em andamento
- **Última tarefa concluída:** Task 2 — o token anônimo da página
- **Próxima tarefa:** Task 3
- **Notas de retomada:** Task 2 concluída em 2026-09-07. `extrairLsd` substitui
  `extrairTokenDeSessao` em `sessao.ts`; o typecheck permanece quebrado de propósito
  até a Task 3, que atualizará `instagram.ts`. A suíte específica passou com
  5 testes. Verificação feita em 2026-09-07, numa aba da
  Biblioteca com sessão ativa — confirmada pelo `token_de_sessao` preenchido, que é o
  único indicador confiável ali: `USER_ID` vem `0` e o cookie `c_user` não é
  visível a JavaScript mesmo com o usuário logado. A consulta com
  `credentials: 'omit'` devolveu `__typename: LoggedOutUser` e o handle
  `britaniaeletro`. **O `lsd` não carrega contexto de sessão**: o desenho está
  validado e a implementação, liberada. Nenhum código foi escrito ainda.

**Goal:** Trocar a consulta do Instagram do anunciante por uma versão anônima,
que não usa token nem cookies da conta do usuário, e dar notícia do resultado
dentro do próprio menu.

**Architecture:** Três camadas independentes. O token muda em `sessao.ts`
(`token_de_sessao` sai, `lsd` entra), a requisição muda em `instagram.ts` (novo
`doc_id`, `credentials: 'omit'`, `variables` completas), e a interface muda em
`menu.ts` mais `tray.ts` (o menu passa a poder atualizar um item sem fechar).
Nenhuma dessas camadas precisa das outras para ser testada.

**Tech Stack:** TypeScript 7, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-07-instagram-anonimo-design.md`
**Superado por ele:** a seção do Instagram em `2026-09-05-copyhaunt-ads-design.md`

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e os hosts atuais. Nenhuma
  tarefa aqui pede permissão nova; se parecer pedir, o desenho está errado.
- **`npm.cmd` e `npx.cmd`** no PowerShell do Windows.
- **Nunca rodar `npm run gravar:fixtures`.**
- **Quem commita é o revisor.** Executor escreve `.commit-msg` na raiz e para.
- **Commits** no padrão de `AGENTS.md`: tipo em inglês, texto em pt-BR.
- **A consulta continua sendo disparada só por clique explícito**, uma por
  anunciante, com cache em memória pela sessão.

## Os valores medidos, para não serem redescobertos

| Valor | Medido em 2026-09-07 |
|---|---|
| `doc_id` | `26617181747964058` |
| Caminho do campo | `data.ad_library_page_info.page_info.ig_username` |
| Cobertura | 83% (15 de 18 anunciantes) |
| Latência | 1,3 – 3,3 s, mediana ~2 s |
| Tráfego | 78 – 381 KB |

**A resposta vem em múltiplas linhas JSON.** A consulta real devolveu três
linhas, e o campo estava na segunda. O código atual faz um único
`JSON.parse(texto.slice(inicio))`, que **lança** nesse formato. A Task 3 trata
isso, e é a causa mais provável de a implementação falhar em produção passando
nos testes se for ignorada.

---

## Task 1: A verificação que destrava as demais

**Não escreve código.** O spec condiciona toda a implementação a este
resultado, porque ele pode invalidar o desenho.

**Por quê:** o `lsd` é extraído do HTML da página, que num usuário logado foi
carregada com a sessão dele. Se o servidor associar o `lsd` à sessão, a
requisição não é anônima e o ganho de segurança não existe.

- [x] **Step 1: Rodar a consulta numa aba logada**

Numa aba da Biblioteca de Anúncios **com o Facebook logado**, no console:

```js
const lsd = document.documentElement.innerHTML
  .match(/"LSD",\s*\[\],\s*\{\s*"token"\s*:\s*"([^"]+)"/)?.[1]

const variables = {
  activeStatus:'ALL', adType:'ALL', audienceTimeframe:'LAST_7_DAYS', bylines:[],
  collationToken:null, contentLanguages:[], countries:['BR'], country:'BR',
  deeplinkAdID:null, excludedIDs:[], fetchPageInfo:true,
  fetchSharedDisclaimers:false, hasDeeplinkAdID:false, isAboutTab:true,
  isAudienceTab:false, isLandingPage:false, isTargetedCountry:false,
  location:null, mediaType:'ALL', multiCountryFilterMode:null, pageIDs:[],
  potentialReachInput:[], publisherPlatforms:[], queryString:'', regions:[],
  searchType:'PAGE', sessionID:crypto.randomUUID(),
  sortData:{mode:'SORT_BY_TOTAL_IMPRESSIONS',direction:'DESCENDING'},
  source:null, startDate:null, v:'10d60d', viewAllPageID:'282903192055132',
}

const r = await fetch('https://www.facebook.com/api/graphql/', {
  method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'},
  body: new URLSearchParams({ lsd, doc_id:'26617181747964058',
                              variables: JSON.stringify(variables) }).toString(),
  credentials:'omit',
})
const t = await r.text()
console.log('typename:', t.match(/"__typename":"(\w*User)"/)?.[1])
console.log('ig:', t.match(/"ig_username":"([^"]*)"/)?.[1])
```

- [x] **Step 2: Ler o resultado e decidir**

| `typename` | Significado | Ação |
|---|---|---|
| `LoggedOutUser` | o servidor tratou como anônima apesar do `lsd` | **seguir para a Task 2** |
| `User` | o `lsd` carrega contexto de sessão | **PARAR.** Registrar em "Notas de retomada" e devolver ao dono do projeto: o desenho precisa mudar antes de virar código |

Esperado: `ig` deve vir `britaniaeletro` nos dois casos — ele não é o critério.
O critério é só o `typename`.

- [x] **Step 3: Registrar o resultado no plano**

Escrever em **Notas de retomada** o `typename` observado e a data. Sem esse
registro, a próxima sessão não sabe se a verificação aconteceu.

---

## Task 2: O token anônimo da página

**Files:**
- Modify: `src/content/sessao.ts` (arquivo inteiro)
- Modify: `tests/sessao.test.ts` (arquivo inteiro)

**Interfaces:**
- Produces: `extrairLsd(html: string): string | null` de `src/content/sessao.ts`
- Removes: `extrairTokenDeSessao` — depois desta tarefa, nada no projeto o usa

- [x] **Step 1: Escrever o teste que falha**

Substituir o conteúdo de `tests/sessao.test.ts` por:

```ts
import { describe, expect, it } from 'vitest'
import { extrairLsd } from '../src/content/sessao'

describe('extrairLsd', () => {
  it('acha o token na forma corrente, minificada', () => {
    const html = `["LSD",[],{"token":"AdSDYILJ7_i9b2I1qLsLqVgbYR4"},323]`
    expect(extrairLsd(html)).toBe('AdSDYILJ7_i9b2I1qLsLqVgbYR4')
  })

  it('tolera espaços, porque a minificação é escolha deles e não contrato', () => {
    const html = `[ "LSD" , [] , { "token" : "AdFolgado" } ]`
    expect(extrairLsd(html)).toBe('AdFolgado')
  })

  it('cai para o campo escondido do formulário', () => {
    const html = `<input type="hidden" name="lsd" value="AdForm456" autocomplete="off">`
    expect(extrairLsd(html)).toBe('AdForm456')
  })

  it('devolve null quando não há token, que é estado possível e não erro', () => {
    expect(extrairLsd('<html><body>nada aqui</body></html>')).toBeNull()
  })

  it('não confunde o token do DTSG com o do LSD', () => {
    const html = `["DTSGInitData",[],{"token":"NAcMnaoEhEste"},1]`
    expect(extrairLsd(html)).toBeNull()
  })
})
```

- [x] **Step 2: Rodar e confirmar que falha**

Run: `npx.cmd vitest run tests/sessao.test.ts`
Expected: FAIL — `extrairLsd` não existe (erro de importação)

- [x] **Step 3: Escrever a implementação**

Substituir o conteúdo de `src/content/sessao.ts` por:

```ts
/**
 * O token público da página, lido do HTML.
 *
 * O `lsd` é o token anti-CSRF que a Biblioteca usa em toda requisição, e
 * existe **com ou sem login** — foi medido num perfil deslogado. É ele que
 * torna possível consultar o Instagram do anunciante sem a conta do usuário.
 *
 * Não confundir com o `token_de_sessao`, que esta extensão usava até 2026-09-07: esse
 * era vinculado à sessão, e é justamente o que se quis parar de mandar.
 */

/**
 * Os dois lugares onde o token aparece, na ordem em que valem a pena.
 *
 * O primeiro é a forma corrente. O segundo é o campo escondido dos
 * formulários, mantido porque custa uma linha.
 *
 * Os `\s*` existem porque o HTML vem minificado hoje, mas isso é escolha
 * deles, não contrato.
 */
const PADROES = [
  /"LSD"\s*,\s*\[\]\s*,\s*\{\s*"token"\s*:\s*"([^"]+)"/,
  /name="lsd"\s+value="([^"]+)"/,
]

/**
 * Devolve o token, ou `null`.
 *
 * `null` significa que a página não é o que esperávamos — quem chama trata
 * como "não dá para perguntar".
 */
export function extrairLsd(html: string): string | null {
  for (const padrao of PADROES) {
    const achado = html.match(padrao)?.[1]
    if (achado) return achado
  }
  return null
}
```

- [x] **Step 4: Rodar e confirmar que passa**

Run: `npx.cmd vitest run tests/sessao.test.ts`
Expected: PASS, 5 testes

Run: `npm.cmd run typecheck`
Expected: falha em `src/content/instagram.ts`, que ainda importa
`extrairTokenDeSessao`. **É esperado** e some na Task 3.

- [x] **Step 5: Escrever a mensagem de commit**

Escrever em `.commit-msg` na raiz:

```
♻️ refactor(overlay): trocar o token_de_sessao pelo lsd na leitura do HTML

O que foi feito:
- Substituir extrairTokenDeSessao por extrairLsd, com os padrões do token público

Considerações:
- O lsd existe com ou sem login, medido em perfil deslogado. É a peça que
  permite consultar sem a conta do usuário
- O typecheck fica quebrado até a Task 3, que é quem consome o novo token
```

---

## Task 3: A consulta anônima

**Files:**
- Modify: `src/content/instagram.ts:1` (import), `:112-150` (a função `consultar`)
- Modify: `src/core/config.ts` (o `advertiserDocId` da `CONFIG_EMBUTIDA`)
- Modify: `config/config.json`
- Modify: `src/core/links.ts` (exportar a constante de país)
- Modify: `tests/instagram.test.ts`

**Interfaces:**
- Consumes: `extrairLsd` de `src/content/sessao.ts` (Task 2)
- Produces: `PAIS` de `src/core/links.ts`; `buscarInstagram` e
  `definirDocIdAnunciante` mantêm as assinaturas atuais

- [ ] **Step 1: Escrever o teste que falha**

Em `tests/instagram.test.ts`, trocar as constantes do topo e acrescentar os
testes novos. As constantes:

```ts
const PAGE_ID = '378128628724966'
const DOC_ID = '26617181747964058'
const HTML_COM_LSD = `["LSD",[],{"token":"AdLsdToken"},323]`

// A Meta devolve o corpo em várias linhas JSON; o campo veio na segunda.
const RESPOSTA_BOA = [
  JSON.stringify({ data: { viewer: { actor: { __typename: 'LoggedOutUser' } } } }),
  JSON.stringify({
    data: {
      ad_library_page_info: {
        page_info: { page_name: 'Renan Botelho Dr', ig_username: 'renanbotelhodr' },
      },
    },
  }),
].join('\n')
```

E os testes, dentro do `describe('buscarInstagram')`:

```ts
it('acha o handle mesmo quando o corpo vem em várias linhas JSON', async () => {
  expect(await buscarInstagram(PAGE_ID, deps())).toBe(
    'https://www.instagram.com/renanbotelhodr',
  )
})

it('não manda cookie nem token de sessão', async () => {
  const buscar = vi.fn(async () => resposta(RESPOSTA_BOA))
  await buscarInstagram(PAGE_ID, deps({ buscar }))

  const [, init] = buscar.mock.calls[0]
  expect(init.credentials).toBe('omit')

  const corpo = new URLSearchParams(init.body as string)
  expect(corpo.get('lsd')).toBe('AdLsdToken')
  expect(corpo.get('token_de_sessao')).toBeNull()
})

it('manda o doc_id da config e o anunciante pedido', async () => {
  const buscar = vi.fn(async () => resposta(RESPOSTA_BOA))
  await buscarInstagram(PAGE_ID, deps({ buscar }))

  const corpo = new URLSearchParams(buscar.mock.calls[0][1].body as string)
  expect(corpo.get('doc_id')).toBe(DOC_ID)
  expect(JSON.parse(corpo.get('variables') as string)).toMatchObject({
    viewAllPageID: PAGE_ID,
    isAboutTab: true,
    fetchPageInfo: true,
    isLandingPage: false,
    countries: ['BR'],
  })
})

it('desiste sem lsd, e não chega a pedir nada', async () => {
  const buscar = vi.fn(async () => resposta(RESPOSTA_BOA))
  expect(await buscarInstagram(PAGE_ID, deps({ buscar, html: () => '<html></html>' })))
    .toBeNull()
  expect(buscar).not.toHaveBeenCalled()
})

it('devolve null quando o anunciante não tem Instagram vinculado', async () => {
  const semIg = JSON.stringify({
    data: { ad_library_page_info: { page_info: { page_name: 'Susana Ateliê' } } },
  })
  expect(await buscarInstagram(PAGE_ID, deps({ buscar: async () => resposta(semIg) })))
    .toBeNull()
})

it('não quebra quando uma das linhas não é JSON', async () => {
  const sujo = `for (;;);\n${RESPOSTA_BOA}`
  expect(await buscarInstagram(PAGE_ID, deps({ buscar: async () => resposta(sujo) })))
    .toBe('https://www.instagram.com/renanbotelhodr')
})
```

Ajustar também o `deps()` do arquivo para usar `HTML_COM_LSD` no `html` e
`RESPOSTA_BOA` no `buscar`, e o `beforeEach` para
`definirDocIdAnunciante(DOC_ID)`. Remover os testes que exercitam `token_de_sessao`.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx.cmd vitest run tests/instagram.test.ts`
Expected: FAIL — `credentials` é `'include'`, o corpo tem `token_de_sessao`, e o corpo
multi-linha estoura o `JSON.parse`

- [ ] **Step 3: Exportar a constante de país**

Em `src/core/links.ts`, trocar o `'BR'` embutido em `buscaNaBiblioteca` por
uma constante exportada, para a consulta e os links usarem a mesma fonte:

```ts
/**
 * O país das buscas. A extensão é de mercado brasileiro, e o valor aparece
 * tanto nos links da Biblioteca quanto nas `variables` da consulta do
 * Instagram — que responde 200 **sem o campo** se o país vier vazio.
 */
export const PAIS = 'BR'
```

E dentro de `buscaNaBiblioteca`, usar `country: PAIS`.

- [ ] **Step 4: Escrever a implementação da consulta**

Em `src/content/instagram.ts`: trocar o import do topo por
`import { extrairLsd } from './sessao'`, acrescentar
`import { PAIS } from '../core/links'`, e substituir `consultar` por:

```ts
/**
 * As `variables` da consulta, copiadas da requisição real da Biblioteca.
 *
 * Não foram podadas: as tentativas estão no spec, e nenhuma compensou.
 * `fetchPageInfo` e `isAboutTab` são o que resolve `page_info`;
 * `isLandingPage: true` faz a query devolver só o viewer, e `countries` vazio
 * responde 200 sem o campo — falha silenciosa, o pior desfecho possível.
 */
function variaveis(pageId: string) {
  return {
    activeStatus: 'ALL', adType: 'ALL', audienceTimeframe: 'LAST_7_DAYS',
    bylines: [], collationToken: null, contentLanguages: [],
    countries: [PAIS], country: PAIS, deeplinkAdID: null, excludedIDs: [],
    fetchPageInfo: true, fetchSharedDisclaimers: false, hasDeeplinkAdID: false,
    isAboutTab: true, isAudienceTab: false, isLandingPage: false,
    isTargetedCountry: false, location: null, mediaType: 'ALL',
    multiCountryFilterMode: null, pageIDs: [], potentialReachInput: [],
    publisherPlatforms: [], queryString: '', regions: [], searchType: 'PAGE',
    sessionID: crypto.randomUUID(),
    sortData: { mode: 'SORT_BY_TOTAL_IMPRESSIONS', direction: 'DESCENDING' },
    source: null, startDate: null, v: '10d60d', viewAllPageID: pageId,
  }
}

/**
 * Acha o handle num corpo que vem em várias linhas JSON.
 *
 * A Meta responde em streaming: a consulta medida devolveu três linhas, e o
 * campo estava na segunda. Um `JSON.parse` do texto inteiro **lança**. Linha
 * que não parseia é ignorada — cobre também o `for (;;);` que eles às vezes
 * prefixam.
 */
function acharNoCorpo(texto: string): string | null {
  for (const linha of texto.split('\n')) {
    const inicio = linha.indexOf('{')
    if (inicio < 0) continue
    try {
      const achado = acharIgUsername(JSON.parse(linha.slice(inicio)))
      if (achado) return achado
    } catch {
      // Linha truncada ou não-JSON: a próxima pode servir.
    }
  }
  return null
}

/** A requisição em si. Nunca lança: todo fracasso vira `null`. */
async function consultar(
  pageId: string,
  deps: Dependencias,
): Promise<string | null> {
  if (!docIdAtual) return desistir('sem doc_id na config, recurso desligado')

  const lsd = extrairLsd(deps.html())
  if (!lsd) return desistir('sem lsd no HTML, página não reconhecida')

  try {
    const resposta = await deps.buscar(GRAPHQL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        lsd,
        doc_id: docIdAtual,
        variables: JSON.stringify(variaveis(pageId)),
      }).toString(),
      // 'omit' é o ponto inteiro desta mudança: nenhum cookie da conta do
      // usuário viaja. Trocar por 'include' desfaz o ganho de segurança.
      credentials: 'omit',
    })
    if (!resposta.ok) return desistir(`resposta HTTP ${resposta.status}`)

    const handle = acharNoCorpo(await resposta.text())
    if (!handle) return desistir('sem ig_username: anunciante sem Instagram vinculado')
    return `https://www.instagram.com/${handle}`
  } catch (erro) {
    return desistir(`falhou: ${erro instanceof Error ? erro.message : erro}`)
  }
}
```

Atualizar também o comentário do topo do arquivo: ele afirma que este é o
único ponto que fabrica pedido **em nome da conta do usuário**, e isso deixa
de ser verdade. A requisição continua fabricada, mas anônima.

- [ ] **Step 5: Trocar o doc_id nos dois arquivos**

Em `config/config.json` e na `CONFIG_EMBUTIDA` de `src/core/config.ts`, trocar
`"7193625857423421"` por `"26617181747964058"`. O teste de sincronia entre os
dois já existe e vai cobrar se só um for alterado.

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `npx.cmd vitest run tests/instagram.test.ts tests/config.test.ts tests/links.test.ts`
Expected: PASS

Run: `npm.cmd test` e `npm.cmd run typecheck`
Expected: suíte inteira verde, typecheck limpo

- [ ] **Step 7: Escrever a mensagem de commit**

```
✨ feat(overlay): consultar o Instagram do anunciante sem a conta do usuário

O que foi feito:
- Trocar a consulta credenciada pela que a própria Biblioteca dispara na aba
  "Sobre": doc_id novo, token lsd e nenhum cookie
- Ler o handle de um corpo que vem em várias linhas JSON

Como foi feito:
- credentials: 'omit', que é o ponto da mudança: nenhuma credencial viaja
- variables copiadas da requisição real, sem poda; o spec registra as
  tentativas de enxugá-las e por que nenhuma compensou

Considerações:
- Cobertura medida em 83%, idêntica à da consulta antiga, que lia o mesmo
  campo. Troca-se quem paga a conta, não o alcance
- O corpo multi-linha é o detalhe que quebraria em produção passando nos
  testes: a resposta medida tinha três linhas e o campo na segunda
```

---

## Task 4: O menu que dá notícia sem fechar

**Files:**
- Modify: `src/content/menu.ts`
- Modify: `tests/menu.test.ts`

**Interfaces:**
- Produces: `ItemMenu` ganha `mantemAberto?: boolean`;
  `atualizarItem(raiz: ParentNode, chave: string, mudanca: MudancaItem): void`
  com `MudancaItem = { rotulo: string; estado: 'buscando' | 'achou' | 'apagado' }`

- [ ] **Step 1: Escrever o teste que falha**

Acrescentar a `tests/menu.test.ts`:

```ts
describe('item que mantém o menu aberto', () => {
  it('não fecha o menu quando o item pede para ficar', () => {
    const raiz = document.createElement('div')
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x', mantemAberto: true }], () => {})
    ;(raiz.querySelector('[data-chave="ig"]') as HTMLElement).click()
    expect(raiz.querySelector('.menu')).not.toBeNull()
  })

  it('fecha normalmente quando o item não pede nada', () => {
    const raiz = document.createElement('div')
    abrirMenu(raiz, [{ chave: 'site', rotulo: 'Site', valor: 'x' }], () => {})
    ;(raiz.querySelector('[data-chave="site"]') as HTMLElement).click()
    expect(raiz.querySelector('.menu')).toBeNull()
  })
})

describe('atualizarItem', () => {
  it('troca o rótulo e marca o item como buscando', () => {
    const raiz = document.createElement('div')
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x' }], () => {})
    atualizarItem(raiz, 'ig', { rotulo: 'buscando…', estado: 'buscando' })

    const linha = raiz.querySelector('[data-chave="ig"]') as HTMLElement
    expect(linha.textContent).toBe('buscando…')
    expect(linha.dataset.estado).toBe('buscando')
  })

  it('deixa o item apagado e sem ação quando o estado é apagado', () => {
    const raiz = document.createElement('div')
    const escolhas: string[] = []
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x' }], (i) => escolhas.push(i.chave))
    atualizarItem(raiz, 'ig', { rotulo: 'sem Instagram vinculado', estado: 'apagado' })
    ;(raiz.querySelector('[data-chave="ig"]') as HTMLElement).click()

    expect(raiz.querySelector('[data-chave="ig"]')!.getAttribute('data-desabilitado')).toBe('sim')
    expect(escolhas).toEqual([])
  })

  it('instala a ação nova, porque a troca descarta a antiga', () => {
    const raiz = document.createElement('div')
    const antiga = vi.fn()
    const nova = vi.fn()
    abrirMenu(raiz, [{ chave: 'ig', rotulo: 'Instagram', valor: 'x' }], antiga)
    atualizarItem(raiz, 'ig', { rotulo: 'Abrir @perfil', estado: 'achou', aoClicar: nova })
    ;(raiz.querySelector('[data-chave="ig"]') as HTMLElement).click()

    expect(nova).toHaveBeenCalledTimes(1)
    expect(antiga).not.toHaveBeenCalled()
  })

  it('não explode quando o menu já foi fechado', () => {
    const raiz = document.createElement('div')
    expect(() => atualizarItem(raiz, 'ig', { rotulo: 'x', estado: 'achou' })).not.toThrow()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx.cmd vitest run tests/menu.test.ts`
Expected: FAIL — `atualizarItem` não existe

- [ ] **Step 3: Escrever a implementação**

Em `src/content/menu.ts`, acrescentar ao `ItemMenu`:

```ts
  /**
   * Impede o fechamento ao escolher.
   *
   * Existe para o item que precisa dar notícia depois: a busca do Instagram
   * demora ~2 s, e um menu fechado não teria onde mostrar o resultado.
   */
  mantemAberto?: boolean
```

Dentro do listener de clique de `abrirMenu`, trocar o `fecharMenu(raiz)`
incondicional por:

```ts
        if (!item.mantemAberto) fecharMenu(raiz)
```

E acrescentar ao fim do arquivo:

```ts
export interface MudancaItem {
  rotulo: string
  /** `apagado` também remove a ação: o item vira aviso, não botão. */
  estado: 'buscando' | 'achou' | 'apagado'
  /**
   * O que fazer no próximo clique.
   *
   * Obrigatório na prática para o estado `achou`: a troca abaixo descarta os
   * listeners antigos, e sem isto o item viraria um rótulo bonito e morto.
   */
  aoClicar?: () => void
}

/**
 * Troca o texto e o estado de um item do menu aberto.
 *
 * Idempotente e tolerante ao menu já fechado: a resposta pode chegar depois
 * de o usuário clicar em outro lugar, e isso é uso normal, não erro.
 *
 * Substituir a linha por um clone raso descarta os listeners de uma vez —
 * mais barato que rastrear qual foi registrado. O preço é que a ação nova
 * precisa vir junto, em `aoClicar`.
 */
export function atualizarItem(
  raiz: ParentNode,
  chave: string,
  mudanca: MudancaItem,
): void {
  const linha = raiz.querySelector(`.menu .item[data-chave="${chave}"]`)
  if (!linha) return

  const nova = linha.cloneNode(false) as HTMLElement
  nova.textContent = mudanca.rotulo
  nova.dataset.estado = mudanca.estado
  if (mudanca.estado === 'apagado') nova.dataset.desabilitado = 'sim'
  else delete nova.dataset.desabilitado

  if (mudanca.aoClicar && mudanca.estado !== 'apagado') {
    nova.addEventListener('click', (evento) => {
      // A Meta escuta clique no card inteiro: sem isto, escolher um item
      // abriria o anúncio deles junto.
      evento.stopPropagation()
      evento.preventDefault()
      mudanca.aoClicar!()
    })
  }

  linha.replaceWith(nova)
}
```

- [ ] **Step 4: Estilo dos estados novos**

Em `src/content/estilo.ts`, dentro de `CSS_BANDEJA`, depois das regras de
`.menu .item`:

```css
  .menu .item[data-estado="buscando"] {
    color: #C4A7FF;
    opacity: 0.7;
    cursor: progress;
  }
  .menu .item[data-estado="buscando"]:hover { background: transparent; }
  .menu .item[data-estado="achou"] { color: #A855F7; font-weight: 600; }
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `npx.cmd vitest run tests/menu.test.ts tests/estilo.test.ts`
Expected: PASS

- [ ] **Step 6: Escrever a mensagem de commit**

```
✨ feat(overlay): permitir que um item do menu dê notícia sem fechar

O que foi feito:
- ItemMenu ganha mantemAberto, e atualizarItem troca rótulo e estado
- Estilos dos estados buscando e achou

Considerações:
- Sem isto não haveria onde mostrar o resultado da busca do Instagram, que
  chega ~2 s depois do clique. O projeto não ganha um componente de toast
  para exibir uma frase
- atualizarItem tolera o menu já fechado de propósito: um clique em outro
  lugar da página fecha o menu antes da resposta, e isso é uso normal
```

---

## Task 5: O fluxo do clique

**Files:**
- Modify: `src/content/tray.ts:52-89` (`destinosComoItens` e `buscarEAbrirInstagram`)
- Modify: `tests/instagram-menu.test.ts`

**Interfaces:**
- Consumes: `atualizarItem` e `ItemMenu.mantemAberto` (Task 4);
  `buscarInstagram` (Task 3)

- [ ] **Step 1: Substituir os testes que a mudança invalida**

O arquivo já tem os auxiliares — use-os como estão: `ad()`, `plantar()`,
`abrirOpen(shadow)`, `itemInstagram(shadow)`, `respostaBoa()`, e
`vi.stubGlobal('fetch' | 'open', ...)`.

**Três testes existentes descrevem o comportamento antigo e passam a estar
errados.** Remova os três e ponha os novos no lugar:

| Remover | Por quê |
|---|---|
| `o clique busca e abre a aba com o perfil achado` | a aba não abre mais no primeiro clique |
| `depois de achar, o item vira link direto e não busca de novo` | o rótulo agora é `Abrir @handle`, e o clique fecha o menu |
| `quando a busca não acha, o item volta a desabilitado e cala` | não cala mais: passa a dizer o motivo |

Atualize também o topo do arquivo, que ainda arma o mundo antigo:

```ts
const HTML_COM_LSD = `["LSD",[],{"token":"AdLsdToken"},323]`

const RESPOSTA_BOA = {
  data: {
    ad_library_page_info: { page_info: { ig_username: 'renanbotelhodr' } },
  },
}

beforeEach(() => {
  document.body.innerHTML = ''
  limparCacheInstagram()
  definirDocIdAnunciante('26617181747964058')
  document.documentElement.innerHTML =
    `<head></head><body><script>${HTML_COM_LSD}</script></body>`
})
```

Os testes novos:

```ts
it('mostra buscando e depois o handle, sem fechar o menu', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => respostaBoa()))
  const shadow = plantar()
  abrirOpen(shadow)

  itemInstagram(shadow).click()
  expect(itemInstagram(shadow).textContent).toBe('buscando…')

  await vi.waitFor(() =>
    expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr'),
  )
  expect(shadow.querySelector('.menu')).not.toBeNull()
})

it('avisa quando o anunciante não tem Instagram vinculado', async () => {
  const semIg = {
    ok: true,
    text: async () =>
      JSON.stringify({ data: { ad_library_page_info: { page_info: {} } } }),
  } as unknown as Response
  vi.stubGlobal('fetch', vi.fn(async () => semIg))
  const shadow = plantar()
  abrirOpen(shadow)

  itemInstagram(shadow).click()
  await vi.waitFor(() =>
    expect(itemInstagram(shadow).textContent).toBe('sem Instagram vinculado'),
  )
  expect(itemInstagram(shadow).dataset.desabilitado).toBe('sim')
})

it('só abre a aba no segundo clique, com ativação do usuário', async () => {
  const open = vi.fn()
  vi.stubGlobal('open', open)
  vi.stubGlobal('fetch', vi.fn(async () => respostaBoa()))
  const shadow = plantar()
  abrirOpen(shadow)

  itemInstagram(shadow).click()
  await vi.waitFor(() =>
    expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr'),
  )
  expect(open).not.toHaveBeenCalled()

  itemInstagram(shadow).click()
  expect(open).toHaveBeenCalledWith(
    'https://www.instagram.com/renanbotelhodr', '_blank', 'noopener',
  )
})

it('uma segunda abertura do menu já mostra o handle, sem requisitar de novo', async () => {
  const buscar = vi.fn(async () => respostaBoa())
  vi.stubGlobal('open', vi.fn())
  vi.stubGlobal('fetch', buscar)
  const shadow = plantar()

  abrirOpen(shadow)
  itemInstagram(shadow).click()
  await vi.waitFor(() =>
    expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr'),
  )

  abrirOpen(shadow)
  expect(itemInstagram(shadow).textContent).toBe('Abrir @renanbotelhodr')
  expect(buscar).toHaveBeenCalledTimes(1)
})
```

O último teste é o que sustenta a decisão de interface registrada no spec:
perder o menu no meio da espera custa a notícia, nunca o dado. Ele depende de
`destinosComoItens` passar a montar o rótulo a partir do cache — veja o Step 3.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npx.cmd vitest run tests/instagram-menu.test.ts`
Expected: FAIL — o item some do menu ao clicar, porque o menu fecha

- [ ] **Step 3: Escrever a implementação**

Em `src/content/tray.ts`, o ramo do Instagram dentro de `destinosComoItens`
passa a montar o rótulo a partir do cache — é isso que faz a segunda abertura
do menu já nascer certa, sem requisitar de novo:

```ts
    // `undefined` = nunca perguntamos, então ofereça a busca. `null` = já
    // perguntamos e o anunciante não tem. Qualquer string é o perfil achado,
    // e o rótulo mostra o handle antes de abrir.
    const sabido = instagramConhecido(ad.anunciante.pageId)

    if (sabido === undefined) {
      return {
        chave: d.chave,
        rotulo: `${d.rotulo} (buscar)`,
        valor: BUSCAR_INSTAGRAM,
        // Sem isto o menu fecharia no clique, e a resposta que chega ~2 s
        // depois não teria onde aparecer.
        mantemAberto: true,
      }
    }

    if (sabido === null) {
      return { chave: d.chave, rotulo: 'sem Instagram vinculado', valor: null }
    }

    return {
      chave: d.chave,
      rotulo: `Abrir @${sabido.split('/').pop()}`,
      valor: sabido,
    }
```

Note que o item achado devolve a **URL** como `valor`, e não
`BUSCAR_INSTAGRAM`: o clique cai no ramo comum do callback, que já abre a aba
e fecha o menu. Isso dispensa tratamento especial para o segundo clique
quando o menu foi reaberto.

E substituir `buscarEAbrirInstagram` por:

```ts
/**
 * Dispara a consulta e dá a notícia no próprio item do menu.
 *
 * Não abre a aba sozinha de propósito. A consulta leva ~2 s, e a essa altura
 * a ativação transitória do clique já expirou: o `window.open` seria bloqueado
 * como popup, e o caso de sucesso falharia em silêncio. O segundo clique abre
 * com ativação legítima — e, de quebra, o handle fica legível antes de abrir.
 */
function buscarInstagramNoMenu(raiz: ParentNode, ad: Ad): void {
  atualizarItem(raiz, 'instagram', { rotulo: 'buscando…', estado: 'buscando' })

  void buscarInstagram(ad.anunciante.pageId, {
    buscar: (...args) => fetch(...args),
    html: () => document.documentElement.innerHTML,
  }).then((url) => {
    if (!url) {
      atualizarItem(raiz, 'instagram', {
        rotulo: 'sem Instagram vinculado',
        estado: 'apagado',
      })
      return
    }
    atualizarItem(raiz, 'instagram', {
      rotulo: `Abrir @${url.split('/').pop()}`,
      estado: 'achou',
      // A ação precisa vir junto: `atualizarItem` troca a linha por um clone
      // e o listener original morre com ela.
      aoClicar: () => {
        window.open(url, '_blank', 'noopener')
        fecharMenu(raiz)
      },
    })
  })
}
```

No callback do menu OPEN, só troque a função chamada:

```ts
        abrirMenu(raiz, destinosComoItens(ad), (item) => {
          if (!item.valor) return
          if (item.valor === BUSCAR_INSTAGRAM) {
            buscarInstagramNoMenu(raiz, ad)
            return
          }
          // `noopener`: a aba aberta não recebe referência para esta.
          window.open(item.valor, '_blank', 'noopener')
        })
```

O callback não precisa consultar o cache: quando o perfil já é conhecido,
`destinosComoItens` entrega a URL como `valor` e o clique cai no ramo comum
acima. Os dois caminhos até a aba — item atualizado na hora e item já nascido
pronto — chamam `window.open` a partir de um clique real, que é a condição
para o navegador não bloquear.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npx.cmd vitest run tests/instagram-menu.test.ts`
Expected: PASS

- [ ] **Step 5: Rodar a verificação inteira**

```
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Expected: tudo verde, e o `verify:build` confirmando permissões mínimas
inalteradas.

- [ ] **Step 6: Escrever a mensagem de commit**

```
✨ feat(overlay): dar a notícia da busca do Instagram no próprio menu

O que foi feito:
- Item vira "buscando…", depois "Abrir @handle" ou "sem Instagram vinculado"
- A aba abre no segundo clique, não sozinha

Considerações:
- Abrir sozinha seria o passo natural e não funciona: depois de ~2 s a
  ativação do clique expirou e o Chrome bloqueia como popup
- O menu prende o usuário durante a espera, e um clique fora apaga o recado.
  Aceita-se porque o cache guarda a resposta: reabrir o card mostra na hora
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

E o teste manual, que nenhuma suíte cobre: carregar `dist/` no Chrome, abrir a
Biblioteca **deslogado**, clicar em "Instagram do anunciante" num anunciante
conhecido por ter perfil (`Britânia`, `Receitas Nestlé`) e num sem
(`Susana Ateliê`), e conferir os dois desfechos no menu.

**O que este plano NÃO entrega:** a busca no hover, o item que só aparece
quando há perfil, e a política de risco do Bloco B — que é o maior risco de
conta da extensão e está pendente da pesquisa de referências do dono do
projeto.
