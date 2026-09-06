# Verificação automatizada da extensão — Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir por teste automatizado a parte verificável do Step 11 da Task 3 do plano de scaffolding, e transformar a pergunta em aberto sobre o CSP da Meta num diagnóstico repetível.

**Architecture:** Playwright carrega a extensão compilada num Chromium persistente. O teste determinístico serve uma página local numa URL que casa com o padrão do manifest, sem tocar na rede da Meta. Um segundo teste, de diagnóstico, tenta a página real e apenas relata o que encontrou.

**Tech Stack:** Playwright 1.63, Chromium (já em cache local).

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md`
**Plano anterior:** `docs/superpowers/plans/2026-09-05-scaffolding.md`

## Global Constraints

- **Nunca automatizar login na Meta.** Arrisca bloqueio da conta do usuário e
  contraria os termos de uso. Nenhum teste deste plano faz login, preenche
  credencial ou tenta contornar bloqueio de bot.
- **O teste determinístico não toca a rede da Meta.** Ele serve HTML local
  numa URL que casa com o padrão, via `context.route`.
- **O teste de diagnóstico nunca falha o build.** Ele relata. Se a Meta
  bloquear, isso é informação, não erro.
- **Vite fica no 7.3.6.** Ver o plano de scaffolding.
- **npm no PowerShell do Windows:** usar `npm.cmd`.
- **Quem commita é o revisor.** O executor escreve `.commit-msg` na raiz e
  para. Nunca escrever dentro de `.git/`.
- **Commits:** padrão de `CLAUDE.md`, tipo em inglês, texto em pt-BR.

## Estrutura de arquivos ao final

```
├─ playwright.config.ts          configuração dos testes de navegador
└─ e2e/
   ├─ fixtures.ts                carrega a extensão num contexto persistente
   ├─ extension.spec.ts          teste determinístico, offline
   └─ csp-diagnostico.spec.ts    diagnóstico da página real, não bloqueante
```

Os testes de navegador ficam em `e2e/`, separados de `tests/`. O `vitest.config.ts`
já restringe a `tests/**/*.test.ts`, então não há colisão — mas a separação
também deixa claro que são suítes com custo e propósito diferentes.

## Incerteza conhecida

**Não está verificado que o Playwright expõe `console.info` de content script**
(mundo isolado) no evento `page.on('console')`. Se não expuser, o Step 4 da
Task 1 vai falhar mesmo com a extensão funcionando.

Nesse caso, **não mudar o código de produção para facilitar o teste**. A
alternativa é assertar pelo DOM: a presença do iframe `#copyhaunt-panel` já
prova que o content script rodou. Para a ponte entre mundos, usar
`page.evaluate` com um listener registrado antes da navegação.

Se cair nesse caso, PARE e reporte antes de escolher o caminho.

---

## Task 1: Carregar a extensão e provar a ponte entre os mundos

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/fixtures.ts`
- Create: `e2e/extension.spec.ts`
- Modify: `package.json` (dependência e scripts)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: a extensão compilada em `dist/`, produzida por `npm run build`.
- Produces: de `e2e/fixtures.ts` — `test` e `expect` estendidos, onde `test`
  fornece a fixture `context` (um `BrowserContext` persistente com a extensão
  carregada) e `extensionId` (string).

- [ ] **Step 1: Instalar o Playwright**

```bash
npm.cmd install -D @playwright/test@1.63.0
```

Depois, garantir o navegador (usa o cache local, não rebaixa nada):

```bash
npx.cmd playwright install chromium
```

- [ ] **Step 2: Acrescentar os scripts ao package.json**

No bloco `scripts` do `package.json`, acrescentar as duas linhas:

```json
    "e2e": "playwright test",
    "e2e:report": "playwright show-report"
```

- [ ] **Step 3: Ignorar os artefatos do Playwright**

Acrescentar ao final de `.gitignore`:

```
# Artefatos do Playwright
/test-results
/playwright-report
/.playwright
```

- [ ] **Step 4: Criar a configuração do Playwright**

Criar `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // A extensão é carregada num contexto persistente compartilhado por teste;
  // rodar em paralelo criaria perfis concorrentes sem ganho real.
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
```

- [ ] **Step 5: Criar a fixture que carrega a extensão**

Criar `e2e/fixtures.ts`:

```ts
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test as base, chromium, type BrowserContext } from '@playwright/test'

const CAMINHO_EXTENSAO = resolve(import.meta.dirname, '..', 'dist')

export const test = base.extend<{
  context: BrowserContext
  extensionId: string
}>({
  context: async ({}, use) => {
    // Extensões no Chromium só funcionam em contexto persistente, e cada
    // execução ganha um perfil descartável para não herdar estado.
    const perfil = mkdtempSync(join(tmpdir(), 'copyhaunt-'))
    const context = await chromium.launchPersistentContext(perfil, {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${CAMINHO_EXTENSAO}`,
        `--load-extension=${CAMINHO_EXTENSAO}`,
      ],
    })
    await use(context)
    await context.close()
    rmSync(perfil, { recursive: true, force: true })
  },

  extensionId: async ({ context }, use) => {
    // O service worker MV3 pode ainda não ter acordado quando o contexto sobe.
    let [worker] = context.serviceWorkers()
    if (!worker) worker = await context.waitForEvent('serviceworker')
    const id = new URL(worker.url()).host
    await use(id)
  },
})

export const expect = test.expect
```

- [ ] **Step 6: Escrever o teste que falha**

Criar `e2e/extension.spec.ts`:

```ts
import { expect, test } from './fixtures'

/** Página local servida na URL que casa com o padrão do manifest. */
const PAGINA_FALSA = `
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Biblioteca de Anúncios (simulada)</title></head>
  <body style="margin:0;font-family:system-ui">
    <div id="grade" style="width:400px;padding:24px;background:#fff;color:#000">
      Identificação da biblioteca: 2366492917183805
    </div>
  </body>
</html>`

const URL_ALVO =
  'https://www.facebook.com/ads/library/?active_status=active&q=teste'

test('a extensão carrega e o service worker sobe', async ({ extensionId }) => {
  expect(extensionId).toMatch(/^[a-z]{32}$/)
})

test('o interceptador roda no main world e o content script confirma', async ({
  context,
}) => {
  const page = await context.newPage()
  const logs: string[] = []
  page.on('console', (msg) => logs.push(msg.text()))

  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )

  await page.goto(URL_ALVO)
  await expect
    .poll(() => logs.join('\n'), { timeout: 10_000 })
    .toContain('[CopyHaunt] interceptador confirmado pelo content script')

  // As outras duas linhas provam que ambos os mundos executaram.
  expect(logs.join('\n')).toContain('[CopyHaunt] interceptador ativo no main world')
  expect(logs.join('\n')).toContain('[CopyHaunt] content script ativo')
})

test('o painel monta como iframe sem vazar estilo na página', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.locator('#copyhaunt-panel')
  await expect(painel).toBeAttached({ timeout: 10_000 })

  // O iframe precisa estar por cima de tudo e no canto superior direito.
  const estilo = await painel.evaluate((el) => {
    const s = getComputedStyle(el)
    return { position: s.position, zIndex: s.zIndex, top: s.top }
  })
  expect(estilo.position).toBe('fixed')
  expect(Number(estilo.zIndex)).toBeGreaterThan(1000)

  // A página hospedeira não pode ter sido tocada: fundo branco, texto preto.
  const grade = await page.locator('#grade').evaluate((el) => {
    const s = getComputedStyle(el)
    return { cor: s.color, fundo: s.backgroundColor }
  })
  expect(grade.cor).toBe('rgb(0, 0, 0)')
  expect(grade.fundo).toBe('rgb(255, 255, 255)')

  // O conteúdo do painel vive dentro do iframe, não na página.
  await expect(page.locator('body >> text=CopyHaunt')).toHaveCount(0)
})

test('o painel React renderiza a marca dentro do iframe', async ({
  context,
}) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.frameLocator('#copyhaunt-panel')
  await expect(painel.locator('h1')).toContainText('CopyHaunt', {
    timeout: 10_000,
  })

  const roxo = await painel
    .locator('h1 span')
    .evaluate((el) => getComputedStyle(el).color)
  // #7C3AED é o roxo principal do CopyHaunt-IDV.md
  expect(roxo).toBe('rgb(124, 58, 237)')
})
```

- [ ] **Step 7: Compilar a extensão e rodar o teste**

```bash
npm.cmd run build
npm.cmd run e2e
```

Se os testes passarem de primeira, ótimo. Se o teste da ponte falhar por o
Playwright não expor console de content script, **PARE e reporte** — ver a
seção "Incerteza conhecida". Não altere código de produção para o teste passar.

- [ ] **Step 8: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
🧪 test(build): verificar a extensão carregada com Playwright

O que foi feito:
- Carregar a extensão compilada num Chromium persistente
- Provar que a mensagem cruza do main world para o mundo isolado
- Verificar que o painel monta em iframe sem vazar estilo na página

Como foi feito:
- A página de teste é servida por context.route numa URL que casa com o
  padrão do manifest. A injeção de content script é decidida pela URL, não
  pelo conteúdo, então nada precisa vir da rede da Meta
- Perfil de navegador descartável por execução, para não herdar estado

Considerações:
- Isto verifica o mecanismo, não o ambiente. O CSP real da Meta e a grade
  real de anúncios continuam exigindo verificação manual com sessão logada
```

Não rodar `git add` nem `git commit`: quem commita é o revisor.

---

## Task 2: Diagnóstico do CSP da página real

**Files:**
- Create: `e2e/csp-diagnostico.spec.ts`

**Interfaces:**
- Consumes: a fixture `test` de `e2e/fixtures.ts` (Task 1).
- Produces: nada consumido por outra tarefa. É diagnóstico.

**Propósito:** o plano de scaffolding afirma que declarar `world: "MAIN"` no
manifest dispensa remover o `Content-Security-Policy` da página, como a
extensão de referência faz. **Isso é dedução, não fato verificado.** Este teste
tenta verificar sem login e relata o que encontrou.

- [ ] **Step 1: Escrever o diagnóstico**

Criar `e2e/csp-diagnostico.spec.ts`:

```ts
import { test } from './fixtures'

const URL_REAL =
  'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=receitas&search_type=keyword_unordered'

/**
 * Diagnóstico, não asserção. A Biblioteca de Anúncios é pública por obrigação
 * de transparência, mas a Meta bloqueia clientes que parecem robô. Se o acesso
 * falhar, isso é informação — não erro. Este teste nunca reprova.
 *
 * Nenhum login é feito. Nenhuma tentativa de contornar bloqueio.
 */
test('diagnóstico: o que a página real entrega sem sessão', async ({
  context,
}) => {
  const page = await context.newPage()
  const logs: string[] = []
  page.on('console', (msg) => logs.push(msg.text()))

  let csp: string | null = null
  let status: number | null = null

  page.on('response', (res) => {
    if (res.url().includes('/ads/library/') && res.request().isNavigationRequest()) {
      status = res.status()
      csp = res.headers()['content-security-policy'] ?? null
    }
  })

  try {
    await page.goto(URL_REAL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  } catch (erro) {
    console.log('RELATÓRIO: navegação falhou —', (erro as Error).message)
    return
  }

  const urlFinal = page.url()
  const aindaNaBiblioteca = urlFinal.includes('/ads/library/')
  const nossoScriptRodou = logs.some((l) => l.includes('[CopyHaunt]'))
  const ponteFuncionou = logs.some((l) =>
    l.includes('interceptador confirmado pelo content script'),
  )
  const painelMontou = (await page.locator('#copyhaunt-panel').count()) > 0

  console.log('\n=== RELATÓRIO DO DIAGNÓSTICO ===')
  console.log('status da navegação:      ', status)
  console.log('URL final:                ', urlFinal)
  console.log('continua em /ads/library: ', aindaNaBiblioteca)
  console.log('CSP presente:             ', csp ? 'sim' : 'não')
  if (csp) console.log('CSP:', csp.slice(0, 400))
  console.log('nosso script rodou:       ', nossoScriptRodou)
  console.log('ponte entre mundos:       ', ponteFuncionou)
  console.log('painel montou:            ', painelMontou)
  console.log('linhas do console:        ', logs.filter((l) => l.includes('[CopyHaunt]')))
  console.log('================================\n')
})
```

- [ ] **Step 2: Rodar e capturar o relatório**

```bash
npm.cmd run e2e
```

Copiar o bloco `RELATÓRIO DO DIAGNÓSTICO` inteiro no relatório final. Ele é o
produto desta tarefa — mesmo que a Meta bloqueie o acesso.

- [ ] **Step 3: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
🧪 test(build): diagnosticar o CSP da Biblioteca de Anúncios real

Como foi feito:
- O teste navega até a página real sem sessão e relata status, CSP,
  se nosso script rodou e se a ponte entre mundos funcionou
- Nunca reprova: se a Meta bloquear o acesso, isso é informação

Considerações:
- Nenhum login é automatizado. A Biblioteca é pública por obrigação de
  transparência, mas automatizar login na Meta arriscaria a conta do usuário
- O plano de scaffolding afirma que world MAIN dispensa remover o CSP da
  página, como a extensão de referência faz. Isso era dedução; este
  diagnóstico é a primeira tentativa de verificar
```

---

## Verificação final

```bash
npm.cmd test           # a suíte unitária continua verde
npm.cmd run verify:build
npm.cmd run e2e        # 5 testes: 4 asserções e 1 diagnóstico
git status --short
```

**O que continua fora do alcance de qualquer automação daqui:** a grade real de
anúncios, que exige sessão logada. Verificação manual permanece necessária
antes de publicar na Chrome Web Store.
