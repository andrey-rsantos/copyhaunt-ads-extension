# Filtro de data: o painel ganha o primeiro comando · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Sem essas skills carregadas, siga `AGENTS.md`, seção "O plano é o estado":
> o comportamento exigido é o mesmo e não depende de harness.

## Progresso

- **Estado:** não iniciado
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** —

**Goal:** Dar ao usuário os dois cortes de data que o spec define — *provadas*
e *subindo* — a partir do painel, reescrevendo a URL da Biblioteca e deixando
a Meta recarregar.

**Architecture:** `montarUrlFiltro` já existe e já está testada; ninguém a
chama. O que falta é o caminho: o painel emite um comando, o content script o
valida, monta a URL e navega. Este plano abre esse caminho — o mesmo que o
Bloco B vai usar depois para `iniciar` e `parar` a mineração.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, React 19, Playwright 1.63.
**Nenhuma dependência nova.**

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md`
(seção 7, "A4 · Filtro de data"; seção 5, "O iframe é deliberadamente burro")

## Por que isto existe

É o último item do Bloco A. `src/core/dateFilter.ts` está pronto desde o plano
do Bloco A, com teste passando, e é código morto: nenhum arquivo o importa. Um
módulo que ninguém chama não é funcionalidade, é dívida com aparência de
trabalho feito.

## Duas decisões tomadas em 2026-09-06, e o que elas dispensam

**Os controles moram no painel que já existe.** O iframe já está na tela desde
o scaffolding, dizendo "Painel pronto"; o Bloco B vai precisar dele de todo
jeito para o botão de iniciar e para o placar. Isso dispensa uma segunda
superfície de UI, e dispensa Shadow DOM novo.

**"Intervalo personalizado" é um campo de dias, não duas datas.** Cobre o
intento da seção 7 do spec com `montarUrlFiltro` como ela está. Duas datas
absolutas exigiriam uma segunda função e um segundo caminho de teste, para um
ganho que ninguém pediu ainda.

## O canal painel → content script, que hoje não existe

O listener em `src/content/index.ts` começa com:

```ts
if (event.source !== window) return
```

O iframe posta com `window.parent.postMessage`, e ali `event.source` é o
`contentWindow` do iframe — nunca `window`. **Toda mensagem do painel é
descartada hoje.** A Task 2 abre exatamente esta porta, e só ela.

O main world é território compartilhado: qualquer script da página posta
mensagem ali. Por isso o comando é validado campo a campo na chegada, e não
apenas lido. Isto não é cerimônia — é a fronteira de confiança do recurso.

---

## Task 1: O comando, e o que conta como comando válido

**Files:**
- Create: `src/core/filtro.ts`
- Create: `tests/filtro.test.ts`

**Interfaces:**
- Consumes: `ModoFiltro`, `montarUrlFiltro` (`src/core/dateFilter.ts`).
- Produces: de `src/core/filtro.ts` —
  `ComandoFiltro { modo: ModoFiltro; dias: number }`,
  `DIAS_MAX`, `lerComandoFiltro(valor: unknown): ComandoFiltro | null`,
  `urlDoComando(cmd: ComandoFiltro, urlAtual: string, agora: Date): string`.

Módulo puro. É onde mora a desconfiança: `lerComandoFiltro` recebe `unknown`
vindo de `postMessage` e devolve `null` para tudo que não for exatamente o que
esperamos.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/filtro.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { DIAS_MAX, lerComandoFiltro, urlDoComando } from '../src/core/filtro'

const BUSCA =
  'https://www.facebook.com/ads/library/?active_status=active&q=emagrecer'

describe('lerComandoFiltro', () => {
  it.each([
    ['provadas', 7],
    ['subindo', 3],
    ['provadas', DIAS_MAX],
  ])('aceita o comando bem formado %s/%i', (modo, dias) => {
    expect(lerComandoFiltro({ modo, dias })).toEqual({ modo, dias })
  })

  it.each([
    ['modo desconhecido', { modo: 'escaladas', dias: 7 }],
    ['modo ausente', { dias: 7 }],
    ['dias zero', { modo: 'provadas', dias: 0 }],
    ['dias negativo', { modo: 'provadas', dias: -7 }],
    ['dias fracionário', { modo: 'provadas', dias: 7.5 }],
    ['dias acima do teto', { modo: 'provadas', dias: DIAS_MAX + 1 }],
    ['dias como texto', { modo: 'provadas', dias: '7' }],
    ['dias NaN', { modo: 'provadas', dias: Number.NaN }],
    ['objeto vazio', {}],
    ['nulo', null],
    ['texto solto', 'provadas 7'],
    ['array', ['provadas', 7]],
  ])('recusa %s', (_caso, valor) => {
    // O main world é território compartilhado: qualquer script da página posta
    // mensagem ali. Nada entra sem passar por aqui.
    expect(lerComandoFiltro(valor)).toBeNull()
  })

  it('ignora campos a mais em vez de recusar o comando', () => {
    // Campo extra é sinal de versão diferente, não de ataque. O que
    // interessa é que os dois campos conhecidos estejam certos.
    expect(lerComandoFiltro({ modo: 'subindo', dias: 5, extra: 'x' })).toEqual({
      modo: 'subindo',
      dias: 5,
    })
  })
})

describe('urlDoComando', () => {
  const agora = new Date('2026-09-06T12:00:00Z')

  it('corta pelo máximo no modo provadas', () => {
    const url = new URL(urlDoComando({ modo: 'provadas', dias: 7 }, BUSCA, agora))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
    expect(url.searchParams.get('start_date[min]')).toBeNull()
  })

  it('corta pelo mínimo no modo subindo', () => {
    const url = new URL(urlDoComando({ modo: 'subindo', dias: 3 }, BUSCA, agora))
    expect(url.searchParams.get('start_date[min]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[max]')).toBeNull()
  })

  it('preserva a busca do usuário', () => {
    const url = new URL(urlDoComando({ modo: 'provadas', dias: 7 }, BUSCA, agora))
    expect(url.searchParams.get('q')).toBe('emagrecer')
    expect(url.searchParams.get('active_status')).toBe('active')
  })

  it('troca o filtro anterior em vez de acumular', () => {
    // Sem isto, provadas depois de subindo viraria a interseção dos dois
    // cortes, e a grade voltaria vazia sem explicação.
    const antes = urlDoComando({ modo: 'subindo', dias: 3 }, BUSCA, agora)
    const url = new URL(urlDoComando({ modo: 'provadas', dias: 7 }, antes, agora))
    expect(url.searchParams.get('start_date[min]')).toBeNull()
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/filtro.test.ts
```

Esperado: FALHA, módulo `../src/core/filtro` não encontrado.

- [ ] **Step 3: Escrever o comando**

Criar `src/core/filtro.ts`:

```ts
import { montarUrlFiltro, type ModoFiltro } from './dateFilter'

/**
 * O comando que o painel manda e o content script obedece.
 *
 * Módulo puro, e a fronteira de confiança do recurso: `lerComandoFiltro`
 * recebe o que veio de `postMessage`, que qualquer script da página pode ter
 * escrito, e só deixa passar o que for exatamente isto.
 */

export interface ComandoFiltro {
  modo: ModoFiltro
  dias: number
}

/**
 * Um ano. Acima disso o corte deixa de filtrar coisa alguma: a Biblioteca só
 * guarda anúncios ativos, e nenhum está no ar desde antes disso.
 */
export const DIAS_MAX = 365

const MODOS: readonly string[] = ['provadas', 'subindo']

/** O comando, ou `null` se o que chegou não for um. */
export function lerComandoFiltro(valor: unknown): ComandoFiltro | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return null
  }

  const { modo, dias } = valor as Record<string, unknown>

  if (typeof modo !== 'string' || !MODOS.includes(modo)) return null
  if (typeof dias !== 'number' || !Number.isInteger(dias)) return null
  if (dias < 1 || dias > DIAS_MAX) return null

  return { modo: modo as ModoFiltro, dias }
}

/** A URL da Biblioteca com o corte do comando aplicado. */
export function urlDoComando(
  cmd: ComandoFiltro,
  urlAtual: string,
  agora: Date,
): string {
  return montarUrlFiltro(urlAtual, cmd.modo, cmd.dias, agora)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/filtro.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 2: O content script obedece

**Files:**
- Create: `src/content/comando.ts`
- Create: `tests/comando.test.ts`
- Modify: `src/content/index.ts`

**Interfaces:**
- Consumes: `lerComandoFiltro`, `urlDoComando` (Task 1).
- Produces: de `src/content/comando.ts` —
  `veioDoPainel(source: unknown, painel: HTMLIFrameElement | null): boolean`,
  `tratarComandoFiltro(valor, urlAtual, agora, navegar): boolean`.

A navegação entra injetada, como o `salvar` do download entrou: assim o
caminho inteiro é testável sem navegador, e o jsdom não precisa fingir que
sabe mudar de página.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/comando.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { tratarComandoFiltro, veioDoPainel } from '../src/content/comando'

const BUSCA = 'https://www.facebook.com/ads/library/?q=emagrecer'
const AGORA = new Date('2026-09-06T12:00:00Z')

describe('veioDoPainel', () => {
  function painel(): HTMLIFrameElement {
    const frame = document.createElement('iframe')
    document.body.appendChild(frame)
    return frame
  }

  it('reconhece a janela do próprio painel', () => {
    const frame = painel()
    expect(veioDoPainel(frame.contentWindow, frame)).toBe(true)
  })

  it('recusa qualquer outra janela', () => {
    const frame = painel()
    const intruso = painel()
    expect(veioDoPainel(intruso.contentWindow, frame)).toBe(false)
    expect(veioDoPainel(window, frame)).toBe(false)
  })

  it('recusa quando o painel ainda não montou', () => {
    expect(veioDoPainel(window, null)).toBe(false)
  })
})

describe('tratarComandoFiltro', () => {
  it('navega para a URL com o corte aplicado', () => {
    const navegar = vi.fn()
    const ok = tratarComandoFiltro(
      { modo: 'provadas', dias: 7 },
      BUSCA,
      AGORA,
      navegar,
    )

    expect(ok).toBe(true)
    expect(navegar).toHaveBeenCalledTimes(1)
    const url = new URL(navegar.mock.calls[0][0] as string)
    expect(url.searchParams.get('start_date[max]')).toBe('2026-08-30')
  })

  it('não navega quando o comando não presta', () => {
    const navegar = vi.fn()
    expect(tratarComandoFiltro({ modo: 'x' }, BUSCA, AGORA, navegar)).toBe(false)
    expect(navegar).not.toHaveBeenCalled()
  })

  it('não navega quando a URL já é a que o comando pede', () => {
    // Recarregar a mesma página seria perder o índice da sessão por nada.
    const navegar = vi.fn()
    const alvo = urlDeReferencia()
    expect(
      tratarComandoFiltro({ modo: 'provadas', dias: 7 }, alvo, AGORA, navegar),
    ).toBe(false)
    expect(navegar).not.toHaveBeenCalled()
  })

  /** A URL que o próprio comando produz, para comparar com ela mesma. */
  function urlDeReferencia(): string {
    const navegar = vi.fn()
    tratarComandoFiltro({ modo: 'provadas', dias: 7 }, BUSCA, AGORA, navegar)
    return navegar.mock.calls[0][0] as string
  }
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/comando.test.ts
```

Esperado: FALHA, módulo `../src/content/comando` não encontrado.

- [ ] **Step 3: Escrever o obediente**

Criar `src/content/comando.ts`:

```ts
import { lerComandoFiltro, urlDoComando } from '../core/filtro'

/**
 * Os comandos que vêm do painel.
 *
 * O painel é deliberadamente burro (seção 5 do spec): manda o que o usuário
 * pediu e não sabe o que acontece depois. Quem decide é aqui.
 */

/**
 * A mensagem veio da janela do nosso painel?
 *
 * O main world é território compartilhado. Comparar a `source` com o
 * `contentWindow` do iframe que nós mesmos criamos é o que separa o nosso
 * painel de qualquer outro script que poste mensagem na mesma página.
 */
export function veioDoPainel(
  source: unknown,
  painel: HTMLIFrameElement | null,
): boolean {
  return painel !== null && source === painel.contentWindow
}

/**
 * Aplica o filtro de data, navegando para a URL reescrita.
 *
 * Devolve `false` — sem navegar — quando o comando não presta ou quando a
 * página já está exatamente onde ele pede. Recarregar à toa custaria o índice
 * da sessão inteiro.
 */
export function tratarComandoFiltro(
  valor: unknown,
  urlAtual: string,
  agora: Date,
  navegar: (url: string) => void,
): boolean {
  const cmd = lerComandoFiltro(valor)
  if (!cmd) return false

  const destino = urlDoComando(cmd, urlAtual, agora)
  if (destino === urlAtual) return false

  navegar(destino)
  return true
}
```

- [ ] **Step 4: Ligar no content script**

Em `src/content/index.ts`:

1. Acrescentar aos imports:

```ts
import { tratarComandoFiltro, veioDoPainel } from './comando'
```

2. Guardar o iframe do painel. Logo abaixo de `const PANEL_ID = 'copyhaunt-panel'`:

```ts
let painel: HTMLIFrameElement | null = null
```

   e, em `mountPanel`, guardar o que foi criado antes de anexar:

```ts
  painel = frame
  document.documentElement.appendChild(frame)
```

3. No listener de `message`, trocar a primeira linha

```ts
  if (event.source !== window) return
```

   por:

```ts
  // Duas fontes legítimas, e nenhuma outra: o main world, que manda capturas,
  // e o iframe do painel, que manda comandos.
  const doPainel = veioDoPainel(event.source, painel)
  if (event.source !== window && !doPainel) return
```

4. Acrescentar o ramo do comando, logo depois do ramo `interceptor-ready`:

```ts
  if (doPainel && event.data.kind === 'panel-command') {
    tratarComandoFiltro(
      event.data.payload,
      location.href,
      new Date(),
      (url) => location.assign(url),
    )
    return
  }
```

- [ ] **Step 5: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/comando.test.ts
npm.cmd test
npm.cmd run typecheck
```

Esperado: PASSA.

---

## Task 3: Os controles no painel

**Files:**
- Modify: `src/panel/App.tsx`
- Modify: `src/content/index.ts` (altura do iframe)
- Create: `e2e/filtro.spec.ts`

**Interfaces:**
- Consumes: `PRESETS` (`src/core/dateFilter.ts`), `createMessage`
  (`src/core/messages.ts`), `DIAS_MAX` (Task 1).

O componente não ganha teste unitário: seria `@testing-library/react` mais
mudar o `include` do Vitest, que hoje só varre `tests/**/*.test.ts`. Uma
dependência e uma mudança de configuração para testar seis botões que só
postam mensagem não se pagam. Quem prova que o painel funciona é o Playwright,
clicando de verdade — e é ele que também prova o canal inteiro, ponta a ponta.

- [ ] **Step 1: Escrever o e2e que falha**

Criar `e2e/filtro.spec.ts`:

```ts
import { expect, test } from './fixtures'

const PAGINA_FALSA = `
<!doctype html>
<html lang="pt-BR">
  <head><meta charset="utf-8"><title>Biblioteca de Anúncios (simulada)</title></head>
  <body style="margin:0"><div id="grade">Identificação da biblioteca: 2366492917183805</div></body>
</html>`

const URL_ALVO =
  'https://www.facebook.com/ads/library/?active_status=active&q=emagrecer'

test('o preset do painel reescreve a URL da Biblioteca', async ({ context }) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.frameLocator('#copyhaunt-panel')
  await painel.getByRole('button', { name: 'Provadas' }).click()
  await painel.getByRole('button', { name: '1 sem' }).click()

  // A Meta recarrega com o corte; a busca do usuário sobrevive.
  await expect
    .poll(() => decodeURIComponent(page.url()), { timeout: 10_000 })
    .toContain('start_date[max]=')
  expect(page.url()).toContain('q=emagrecer')
})

test('o modo subindo corta pelo mínimo', async ({ context }) => {
  const page = await context.newPage()
  await page.route('https://www.facebook.com/ads/library/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: PAGINA_FALSA }),
  )
  await page.goto(URL_ALVO)

  const painel = page.frameLocator('#copyhaunt-panel')
  await painel.getByRole('button', { name: 'Subindo' }).click()
  await painel.getByRole('button', { name: '3 dias' }).click()

  await expect
    .poll(() => decodeURIComponent(page.url()), { timeout: 10_000 })
    .toContain('start_date[min]=')
})
```

O rótulo `1 sem` sai de `rotulo(7)`, definido no Step 3. Se você mudar o
rótulo, mude aqui também — e deixe os dois iguais, sem inventar um terceiro
nome.

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd playwright test filtro
```

Esperado: FALHA, o painel não tem botão nenhum.

- [ ] **Step 3: Escrever o painel**

Substituir `src/panel/App.tsx` inteiro por:

```tsx
import { useState } from 'react'
import { PRESETS, type ModoFiltro } from '../core/dateFilter'
import { DIAS_MAX } from '../core/filtro'
import { createMessage } from '../core/messages'

/** Rótulo curto: até uma semana em dias, daí em diante em semanas. */
function rotulo(dias: number): string {
  return dias < 7 ? `${dias} dias` : `${dias / 7} sem`
}

const MODOS: { chave: ModoFiltro; nome: string; ajuda: string }[] = [
  { chave: 'provadas', nome: 'Provadas', ajuda: 'no ar há pelo menos X' },
  { chave: 'subindo', nome: 'Subindo', ajuda: 'no ar há no máximo X' },
]

export function App() {
  const [modo, setModo] = useState<ModoFiltro>('provadas')
  const [personalizado, setPersonalizado] = useState('')

  function filtrar(dias: number): void {
    window.parent.postMessage(createMessage('panel-command', { modo, dias }), '*')
  }

  const dias = Number(personalizado)
  const podeEnviar = Number.isInteger(dias) && dias >= 1 && dias <= DIAS_MAX

  return (
    <div className="flex h-full flex-col gap-3 bg-charcoal p-4 font-sans text-white">
      <h1 className="font-display text-lg font-bold">
        Copy<span className="text-purple">Haunt</span>
      </h1>

      <div className="flex gap-2">
        {MODOS.map((m) => (
          <button
            key={m.chave}
            type="button"
            title={m.ajuda}
            onClick={() => setModo(m.chave)}
            className={`flex-1 rounded-btn px-2 py-1 text-sm ${
              modo === m.chave ? 'bg-purple text-white' : 'bg-ink text-muted'
            }`}
          >
            {m.nome}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => filtrar(d)}
            className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender"
          >
            {rotulo(d)}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (podeEnviar) filtrar(dias)
        }}
      >
        <input
          type="number"
          min={1}
          max={DIAS_MAX}
          value={personalizado}
          onChange={(e) => setPersonalizado(e.target.value)}
          placeholder="dias"
          aria-label="dias"
          className="w-20 rounded-btn bg-ink px-2 py-1 text-xs text-white"
        />
        <button
          type="submit"
          disabled={!podeEnviar}
          className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender disabled:opacity-40"
        >
          Aplicar
        </button>
      </form>
    </div>
  )
}
```

Sem cor nova: `bg-charcoal`, `bg-ink`, `bg-purple`, `text-lavender` e
`text-muted` já existem em `src/styles/tokens.css`, e `tests/tokens.test.ts`
reprova qualquer valor que não conste do `CopyHaunt-IDV.md`.

- [ ] **Step 4: Dar altura ao painel**

O iframe tem `height:180px`, suficiente para uma frase e nada mais. Em
`src/content/index.ts`, em `mountPanel`, trocar por:

```ts
    'height:220px',
```

Só a altura. Posição, largura e `z-index` estão travados pelo e2e
`o painel monta como iframe sem vazar estilo na página`, e continuam valendo.

- [ ] **Step 5: Rodar tudo**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

Esperado: PASSA, inclusive `e2e/filtro.spec.ts`. O `verify:build` precisa
seguir dizendo "permissões mínimas": este plano não pede permissão nenhuma.

- [ ] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg-codex` na raiz com:

```
✨ feat(ui): filtrar por data pelo painel, nos dois sentidos

O que foi feito:
- Oferecer os dois cortes do spec: provadas, no ar há pelo menos X dias, e
  subindo, no ar há no máximo X
- Seis presets, de 3 dias a 4 semanas, mais um campo de dias livre
- Abrir o canal painel → content script, que o Bloco B também vai usar

Como foi feito:
- Reescrita da URL e recarga, não simulação de clique no menu da Meta, que
  muda de layout com frequência
- O comando é validado campo a campo na chegada: o main world é território
  compartilhado, e qualquer script da página posta mensagem ali
- Só a janela do nosso próprio iframe é aceita como fonte de comando
- A navegação entra injetada, e por isso o caminho inteiro tem teste sem
  navegador

Considerações:
- src/core/dateFilter.ts existia desde o Bloco A sem nenhum chamador. Este
  plano o liga; nada nele precisou mudar
- Intervalo personalizado é um campo de dias, não duas datas absolutas. Cobre
  o intento da seção 7 com a função que já estava testada
- O painel não ganhou teste unitário: exigiria @testing-library/react e mudar
  o include do Vitest para seis botões que só postam mensagem. Quem o prova é
  o Playwright, que de quebra prova o canal ponta a ponta
- Fecha o Bloco A

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

## O que este plano NÃO entrega

- **Duas datas absolutas.** Decidido em 2026-09-06: campo de dias cobre o
  intento. Volta se alguém pedir.
- **Lembrar o filtro entre sessões.** Exigiria guardar estado, e o filtro já
  vive na URL — que o usuário guarda sozinho, no favorito.
- **Filtrar sem recarregar**, escondendo cards fora da faixa. Seria trabalho
  do overlay, não do filtro, e brigaria com a paginação da Meta.
