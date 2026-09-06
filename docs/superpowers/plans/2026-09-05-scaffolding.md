# CopyHaunt Ads — Plano de scaffolding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o repositório com um projeto MV3 que compila, carrega no Chrome, aplica os tokens da marca e tem o ciclo de testes provado.

**Architecture:** A raiz do repositório é a raiz da extensão — sem monorepo. O Vite com CRXJS compila quatro contextos de execução independentes: um interceptador no *main world*, um content script no mundo isolado que age como hub, um service worker e um painel React embutido por iframe. A lógica pura vive em `src/core/` e é testada sem navegador.

**Tech Stack:** Vite 7, CRXJS 2.7, TypeScript 7, Tailwind CSS 4, React 19, Vitest 5, Node 22.

**Spec:** `docs/superpowers/specs/2026-09-05-copyhaunt-ads-design.md`

## Global Constraints

Valem para todas as tarefas. Valores copiados literalmente do spec.

- **Permissões:** exatamente `["storage"]`. Nenhuma outra pode ser adicionada.
- **Host permissions:** exatamente `["*://*.facebook.com/ads/library/*"]`.
- **Sem `declarativeNetRequest`**, sem `tabs`, sem `contextMenus`, sem `downloads`, sem `scripting`.
- **O interceptador roda com `world: "MAIN"` e `run_at: "document_start"`.** Os dois são obrigatórios: o patch em `XMLHttpRequest` precisa existir antes da primeira requisição da página.
- **Coleta passiva.** Nenhum código pode emitir requisição própria para a Meta. Sem exceção.
- **Sem código remoto.** Proibido pelo MV3.
- **Idioma:** comentários, documentação e mensagens de commit em pt-BR com acentuação correta. Identificadores de código em inglês.
- **Commits:** seguir o padrão de `CLAUDE.md`. Tipo em inglês, texto em pt-BR, descrição no infinitivo, corpo condicional.
- **Quem commita é o revisor, não o executor.** O executor escreve a mensagem
  em `.commit-msg` na raiz e para por ali. O revisor confere o trabalho e só
  então commita. Ver "Modelo de commit" abaixo.
- **Cores da marca:** vindas de `CopyHaunt-IDV.md`. Nunca inventar valor de cor.
- **Node 22, npm 11.** Instalar com `npm install`. No PowerShell do Windows,
  `npm` pode não resolver: usar `npm.cmd` nesse caso.
- **As versões de `@types/react` e `@types/react-dom` NÃO acompanham a do
  `react`.** São pacotes do DefinitelyTyped, versionados por conta própria.
  Usar exatamente os números escritos no `package.json` desta página.
- **Vite fica travado no 7.3.6.** O CRXJS 2.7.1 quebra no Vite 8 apesar de
  declarar suporte. Ver a seção "Por que Vite 7 e não Vite 8".
- **Todas as versões são fixadas sem acento circunflexo.** `"7.3.6"`, nunca
  `"^7.3.6"`: o build da extensão é sensível demais a mudança de dependência.

---

## Estrutura de arquivos ao final do plano

```
CopyHaunt Ads/
├─ package.json                  dependências e scripts
├─ tsconfig.json                 configuração do TypeScript
├─ vite.config.ts                build da extensão (com CRXJS)
├─ vitest.config.ts              testes (sem CRXJS, de propósito)
├─ scripts/
│  └─ verify-manifest.mjs        confere o manifest que o CRXJS gerou
├─ public/
│  └─ icon-128.png               ícone da extensão
├─ src/
│  ├─ manifest.config.ts         manifest MV3 tipado
│  ├─ core/
│  │  └─ messages.ts             contrato de mensagens entre contextos
│  ├─ interceptor/
│  │  └─ index.ts                main world
│  ├─ content/
│  │  └─ index.ts                mundo isolado, hub
│  ├─ background/
│  │  └─ index.ts                service worker
│  ├─ panel/
│  │  ├─ index.html              página do iframe
│  │  ├─ main.tsx                ponto de entrada React
│  │  └─ App.tsx                 componente raiz
│  └─ styles/
│     └─ tokens.css              tokens da identidade visual
└─ tests/
   ├─ manifest.test.ts
   ├─ tokens.test.ts
   └─ messages.test.ts
```

**Responsabilidade de cada arquivo:**

- `scripts/verify-manifest.mjs` — o manifest que o Chrome carrega não é o que escrevemos: o CRXJS o reescreve no build. Este script confere que a reescrita preservou `world: "MAIN"` e as permissões mínimas.
- `src/manifest.config.ts` — única fonte de verdade do manifest. Exporta o objeto puro para teste e o `defineManifest` para o build.
- `src/core/messages.ts` — tipos e guardas das mensagens trocadas entre contextos. É o contrato; nenhum contexto conhece o outro além disto.
- `src/interceptor/index.ts` — roda no main world. Nesta fase apenas anuncia presença.
- `src/content/index.ts` — hub. Nesta fase apenas escuta o interceptador e injeta o iframe.
- `src/background/index.ts` — service worker. Nesta fase apenas registra a instalação.
- `src/panel/*` — painel React isolado por iframe.
- `src/styles/tokens.css` — tokens do `CopyHaunt-IDV.md` no formato `@theme` do Tailwind 4.

**Fora do escopo deste plano:** normalização de payload, critérios de escala, bandeja de botões, filtro de data, download, motor de mineração. Tudo isso entra em planos de funcionalidade posteriores. Este plano entrega apenas o esqueleto que compila, carrega e testa.

---

## Modelo de commit

O executor **não commita**. Ele conclui o trabalho, escreve a mensagem em
`.commit-msg` na raiz do repositório e para. O revisor confere e commita.

Isso não é contorno: é o desenho certo. Um commit afirma "este trabalho está
bom", e essa afirmação é do revisor. Foi também o que a realidade impôs — o
sandbox do executor nega escrita em `.git/`, e `git commit` precisa criar
`.git/index.lock`. A restrição está certa: `.git/` guarda o histórico, e um
agente com escrita ali pode reescrever o passado.

Cada passo de commit deste plano, portanto, se lê assim:

- **executor**: escreve `.commit-msg` com o conteúdo indicado e reporta
- **revisor**: verifica, roda `git add` e `git commit -F .commit-msg`, apaga o
  arquivo

O `.commit-msg` está no `.gitignore`. Nunca escrever dentro de `.git/`.

## Por que Vite 7 e não Vite 8

**O `@crxjs/vite-plugin` 2.7.1 não funciona com o Vite 8**, apesar de declarar
`vite: "^8.0.0"` nos `peerDependencies`. A faixa declarada é uma promessa falsa.

O Vite 8 substituiu o Rollup pelo **Rolldown**, e a lógica de referência de
chunks do CRXJS assume a semântica do Rollup. Na prática o build morre com:

```
[plugin crx:manifest-post]
Error: Content script fileName is undefined: "src/interceptor/index.ts"
```

A causa está em `finalizeBuildContentScripts`: ela só processa entradas cuja
chave no `Map` é igual ao `refId` do script. No build sob Rolldown, os content
scripts são registrados com a chave sendo o caminho do arquivo e o `refId`
sendo o hash do `emitFile` — as duas nunca coincidem, o `fileName` nunca é
preenchido, e a busca posterior encontra `undefined`.

Isso foi diagnosticado com dois experimentos de uma variável cada:

| Teste | Resultado |
|---|---|
| Remover `world: "MAIN"`, manter Vite 8 | falha idêntica — não é o main world |
| Manter `world: "MAIN"`, usar Vite 7.3.6 | **build passa em 87ms** |

**Não subir o Vite para 8** enquanto o CRXJS não anunciar suporte a Rolldown.
Ao avaliar a subida no futuro, o teste é o `npm run verify:build` desta página.

## Risco encerrado: `world: "MAIN"` sobrevive ao build

Era o maior risco do projeto e está **verificado**. Com Vite 7.3.6, o
`dist/manifest.json` gerado contém:

```json
{
  "js": ["assets/index.ts-CZ7RVp1c.js"],
  "matches": ["*://*.facebook.com/ads/library/*"],
  "world": "MAIN",
  "run_at": "document_start"
}
```

A permissão `scripting` **não é necessária**. A arquitetura do spec se mantém.

O passo `verify:build` da Tarefa 1 protege isso contra regressão. Se algum dia
ele falhar, **pare e reporte** em vez de adicionar permissão: essa troca é
decisão de projeto, não de implementação.

---

## Task 1: Projeto base e manifest MV3

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `src/manifest.config.ts`
- Create: `src/background/index.ts`
- Create: `src/content/index.ts`
- Create: `src/interceptor/index.ts`
- Create: `public/icon-128.png` (cópia de `logo/icone.png`)
- Modify: `.gitignore`
- Test: `tests/manifest.test.ts`

**Interfaces:**
- Consumes: nada. Primeira tarefa.
- Produces: `manifest` (objeto `chrome.runtime.ManifestV3` exportado nomeado de `src/manifest.config.ts`); scripts npm `dev`, `build`, `test`, `typecheck`.

- [ ] **Step 1: Criar o package.json**

Criar `package.json` com este conteúdo exato:

```json
{
  "name": "copyhaunt-ads",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Ad intelligence para a Biblioteca de Anúncios da Meta",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "verify:build": "vite build && node scripts/verify-manifest.mjs"
  },
  "dependencies": {
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "2.7.1",
    "@tailwindcss/vite": "4.3.3",
    "@types/chrome": "0.2.9",
    "@types/node": "26.4.1",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.7",
    "@vitejs/plugin-react": "5.2.0",
    "tailwindcss": "4.3.3",
    "typescript": "7.0.2",
    "vite": "7.3.6",
    "vitest": "5.0.0"
  }
}
```

- [ ] **Step 2: Instalar as dependências**

```bash
npm install
```

Esperado: `node_modules/` criado, `package-lock.json` gerado, sem erro de peer dependency.

- [ ] **Step 3: Atualizar o .gitignore**

Acrescentar ao final de `.gitignore` (manter o que já existe):

```
# Dependências e artefatos de build
/node_modules
/dist
/.vite

# Mensagem de commit temporária
/.commit-msg
```

O arquivo `.commit-msg` fica na raiz do repositório, e não dentro de `.git/`:
sandboxes de agente costumam negar escrita em `.git/`, e com razão.

- [ ] **Step 4: Escrever o teste que falha**

Criar `tests/manifest.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { manifest } from '../src/manifest.config'

/**
 * Tipo largo para inspeção. As duas entradas de content_scripts têm formatos
 * diferentes — só a do interceptador declara `world` — e o TypeScript infere
 * uma união onde o campo opcional não é acessível direto.
 */
type ScriptEntry = { js?: string[]; world?: string; run_at?: string }
const scripts = manifest.content_scripts as ScriptEntry[]

describe('manifest MV3', () => {
  it('declara manifest_version 3', () => {
    expect(manifest.manifest_version).toBe(3)
  })

  it('pede exatamente a permissão storage', () => {
    expect(manifest.permissions).toEqual(['storage'])
  })

  it('restringe o host à Biblioteca de Anúncios', () => {
    expect(manifest.host_permissions).toEqual([
      '*://*.facebook.com/ads/library/*',
    ])
  })

  it('não pede nenhuma permissão proibida pelo spec', () => {
    const proibidas = [
      'declarativeNetRequest',
      'tabs',
      'contextMenus',
      'downloads',
      'scripting',
    ]
    for (const p of proibidas) {
      expect(manifest.permissions).not.toContain(p)
    }
  })

  it('registra o interceptador no main world, em document_start', () => {
    const interceptor = scripts.find((s) =>
      s.js?.some((f) => f.includes('interceptor')),
    )
    expect(interceptor).toBeDefined()
    expect(interceptor?.world).toBe('MAIN')
    expect(interceptor?.run_at).toBe('document_start')
  })

  it('registra o content script no mundo isolado, em document_start', () => {
    const content = scripts.find((s) =>
      s.js?.some((f) => f.includes('content/')),
    )
    expect(content).toBeDefined()
    expect(content?.world).toBeUndefined()
    expect(content?.run_at).toBe('document_start')
  })

  it('usa service worker do tipo module', () => {
    expect(manifest.background?.type).toBe('module')
  })
})
```

- [ ] **Step 5: Criar o vitest.config.ts**

Criar `vitest.config.ts`. **Não incluir o plugin CRXJS aqui** — durante os testes ele tentaria construir a extensão:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

```bash
npm test
```

Esperado: FALHA. A mensagem deve indicar que `../src/manifest.config` não existe (`Failed to resolve import` ou `Cannot find module`).

- [ ] **Step 7: Criar o manifest**

Criar `src/manifest.config.ts`:

```ts
import { defineManifest } from '@crxjs/vite-plugin'
import pkg from '../package.json'

const AD_LIBRARY = '*://*.facebook.com/ads/library/*'

/**
 * Objeto puro do manifest, exportado à parte para poder ser testado sem
 * depender do build. É a única fonte de verdade das permissões.
 */
export const manifest = {
  manifest_version: 3 as const,
  name: 'CopyHaunt Ads',
  version: pkg.version,
  description: pkg.description,
  icons: { '128': 'icon-128.png' },
  permissions: ['storage'],
  host_permissions: [AD_LIBRARY],
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module' as const,
  },
  content_scripts: [
    {
      matches: [AD_LIBRARY],
      js: ['src/interceptor/index.ts'],
      world: 'MAIN' as const,
      run_at: 'document_start' as const,
    },
    {
      matches: [AD_LIBRARY],
      js: ['src/content/index.ts'],
      run_at: 'document_start' as const,
    },
  ],
}

export default defineManifest(manifest)
```

Se o TypeScript reclamar do campo `world` por ausência na tipagem do CRXJS, **não remover o campo**: trocar a linha do export default por
`export default defineManifest(manifest as Parameters<typeof defineManifest>[0])`.

- [ ] **Step 8: Criar os três pontos de entrada mínimos**

Criar `src/background/index.ts`:

```ts
chrome.runtime.onInstalled.addListener(() => {
  console.info('[CopyHaunt] service worker instalado')
})
```

Criar `src/content/index.ts`:

```ts
console.info('[CopyHaunt] content script ativo')
```

Criar `src/interceptor/index.ts`:

```ts
console.info('[CopyHaunt] interceptador ativo no main world')
```

- [ ] **Step 9: Criar o tsconfig.json**

Criar `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["chrome", "node", "vite/client"]
  },
  "include": ["src", "tests", "vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 10: Rodar o teste e confirmar que passa**

```bash
npm test
```

Esperado: PASSA, 7 testes verdes em `tests/manifest.test.ts`.

- [ ] **Step 11: Criar o vite.config.ts**

Criar `vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import manifest from './src/manifest.config'

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  build: {
    rollupOptions: {
      // O painel precisa ser declarado como entrada. HTML citado apenas em
      // web_accessible_resources é COPIADO, não compilado: o arquivo gerado
      // continuaria apontando para ./main.tsx e o React nunca montaria.
      input: { panel: 'src/panel/index.html' },
    },
  },
})
```

O bloco `build.rollupOptions.input` não é decoração. Sem ele o build passa, o
manifest fica correto, o iframe monta — e o painel aparece **em branco**, porque
o navegador recebe um `<script src="./main.tsx">` que não sabe executar. Falha
silenciosa clássica: tudo verde, nada funcionando.

- [ ] **Step 12: Copiar o ícone**

Usar Node em vez de comandos de shell — `mkdir -p` e `cp` não existem no
PowerShell do Windows, onde este projeto é desenvolvido:

```bash
node -e "const fs=require('fs');fs.mkdirSync('public',{recursive:true});fs.copyFileSync('logo/icone.png','public/icon-128.png')"
```

Verificar: `public/icon-128.png` existe.

- [ ] **Step 13: Criar o verificador do manifest gerado**

O manifest que o Chrome carrega não é o que escrevemos: o CRXJS o reescreve
durante o build, trocando caminhos de código-fonte por nomes de chunk. Este
script confere que a reescrita preservou o que o spec exige.

Criar `scripts/verify-manifest.mjs`:

```js
import { readFileSync } from 'node:fs'

const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'))
const falhas = []

const scripts = manifest.content_scripts ?? []
const main = scripts.find((s) => s.world === 'MAIN')

if (!main) {
  falhas.push(
    'nenhum content script com world MAIN no manifest gerado — ' +
      'o CRXJS descartou o campo durante o build',
  )
} else if (main.run_at !== 'document_start') {
  falhas.push(`o script do main world tem run_at "${main.run_at}"`)
}

if (scripts.length !== 2) {
  falhas.push(`esperados 2 content scripts, encontrados ${scripts.length}`)
}

const permissoes = manifest.permissions ?? []
if (permissoes.length !== 1 || permissoes[0] !== 'storage') {
  falhas.push(`permissions deveria ser ["storage"], é ${JSON.stringify(permissoes)}`)
}

const hosts = manifest.host_permissions ?? []
if (hosts.length !== 1 || hosts[0] !== '*://*.facebook.com/ads/library/*') {
  falhas.push(`host_permissions inesperado: ${JSON.stringify(hosts)}`)
}

if (falhas.length > 0) {
  console.error('\nmanifest gerado não passou na verificação:\n')
  for (const f of falhas) console.error('  - ' + f)
  console.error('')
  process.exit(1)
}

console.log('manifest gerado OK: world MAIN preservado, permissões mínimas')
```

- [ ] **Step 14: Compilar e verificar o manifest gerado**

```bash
npm run verify:build
```

Esperado: o build conclui e o script imprime
`manifest gerado OK: world MAIN preservado, permissões mínimas`.

**Se a verificação falhar, PARE.** Não contornar, não adicionar permissão.
Reportar a saída e o conteúdo de `dist/manifest.json` e aguardar decisão — a
alternativa exigiria a permissão `scripting`, proibida pelos Global
Constraints.

- [ ] **Step 15: Verificar a tipagem**

```bash
npm run typecheck
```

Esperado: nenhum erro.

- [ ] **Step 16: Commit**

Escrever a mensagem num arquivo e commitar com `-F`. **Não usar heredoc
(`<<'MSG'`)**: não existe no PowerShell do Windows.

Criar `.commit-msg` com este conteúdo:

```
📦 build: criar projeto Vite com CRXJS e manifest MV3

O que foi feito:
- Configurar Vite 8, CRXJS 2.7, TypeScript 7 e Vitest 5
- Declarar o manifest MV3 com os três pontos de entrada
- Cobrir o manifest com testes das restrições do spec

Como foi feito:
- O manifest é exportado como objeto puro além do defineManifest, para
  poder ser testado sem depender do build
- O vitest.config.ts não carrega o plugin CRXJS: durante os testes ele
  tentaria construir a extensão

Considerações:
- Os testes travam as permissões em exatamente ["storage"] e um único
  host. Qualquer permissão a mais quebra a suíte de propósito
```

Depois:

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts .gitignore src tests public scripts
git commit -F .commit-msg
```

---

## Task 2: Tokens da identidade visual

**Files:**
- Create: `src/styles/tokens.css`
- Test: `tests/tokens.test.ts`

**Interfaces:**
- Consumes: `package.json` com `tailwindcss` e `@tailwindcss/vite` instalados (Task 1).
- Produces: `src/styles/tokens.css`, importável por qualquer contexto. Define as variáveis CSS `--color-ink`, `--color-charcoal`, `--color-purple`, `--color-neon`, `--color-lavender`, `--color-deep`, `--color-muted`, `--font-display`, `--font-sans`, `--radius-card`, `--radius-btn`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/tokens.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(
  resolve(import.meta.dirname, '../src/styles/tokens.css'),
  'utf8',
)

/** Extrai o valor de uma custom property do CSS. */
function token(nome: string): string | undefined {
  const match = css.match(new RegExp(`--${nome}:\\s*([^;]+);`))
  return match?.[1].trim()
}

describe('tokens da identidade visual', () => {
  it('importa o Tailwind', () => {
    expect(css).toContain('@import "tailwindcss"')
  })

  it('declara o bloco @theme', () => {
    expect(css).toContain('@theme')
  })

  it.each([
    ['color-ink', '#08070D'],
    ['color-charcoal', '#111019'],
    ['color-purple', '#7C3AED'],
    ['color-neon', '#A855F7'],
    ['color-lavender', '#C4A7FF'],
    ['color-deep', '#3B1D73'],
    ['color-muted', '#B8B5C6'],
  ])('define %s com o valor do CopyHaunt-IDV.md', (nome, valor) => {
    expect(token(nome)).toBe(valor)
  })

  it('usa Sora como tipografia de marca', () => {
    expect(token('font-display')).toContain('Sora')
  })

  it('usa Inter como tipografia de produto', () => {
    expect(token('font-sans')).toContain('Inter')
  })

  it('define o raio dos cards dentro da faixa do IDV', () => {
    const raio = Number.parseInt(token('radius-card') ?? '0', 10)
    expect(raio).toBeGreaterThanOrEqual(12)
    expect(raio).toBeLessThanOrEqual(16)
  })

  it('define o raio dos botões dentro da faixa do IDV', () => {
    const raio = Number.parseInt(token('radius-btn') ?? '0', 10)
    expect(raio).toBeGreaterThanOrEqual(8)
    expect(raio).toBeLessThanOrEqual(10)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run tests/tokens.test.ts
```

Esperado: FALHA, com erro de leitura do arquivo (`ENOENT`), porque `src/styles/tokens.css` ainda não existe.

- [ ] **Step 3: Criar os tokens**

Criar `src/styles/tokens.css`:

```css
@import "tailwindcss";

/* Tokens da identidade visual. Valores normativos, definidos em
   CopyHaunt-IDV.md. Não alterar sem atualizar aquele documento. */
@theme {
  --color-ink: #08070D;
  --color-charcoal: #111019;
  --color-purple: #7C3AED;
  --color-neon: #A855F7;
  --color-lavender: #C4A7FF;
  --color-deep: #3B1D73;
  --color-muted: #B8B5C6;

  --font-display: "Sora", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;

  --radius-card: 14px;
  --radius-btn: 9px;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npm test
```

Esperado: PASSA. A suíte inteira fica verde, somando os testes da Task 1.

- [ ] **Step 5: Commit**

Sobrescrever `.commit-msg` com:

```
✨ feat(ui): adicionar tokens da identidade visual

Como foi feito:
- Tokens no bloco @theme do Tailwind 4, sem arquivo de configuração
- Os testes comparam cada cor com o valor de CopyHaunt-IDV.md, para que
  uma cor digitada errada quebre a suíte em vez de chegar na interface
```

Depois:

```bash
git add src/styles/tokens.css tests/tokens.test.ts
git commit -F .commit-msg
```

---

## Task 3: Os quatro contextos de execução

**Files:**
- Create: `src/core/messages.ts`
- Create: `src/panel/index.html`
- Create: `src/panel/main.tsx`
- Create: `src/panel/App.tsx`
- Modify: `src/interceptor/index.ts` (substituir o conteúdo inteiro)
- Modify: `src/content/index.ts` (substituir o conteúdo inteiro)
- Modify: `src/manifest.config.ts` (acrescentar `web_accessible_resources`)
- Test: `tests/messages.test.ts`

**Interfaces:**
- Consumes: `manifest` de `src/manifest.config.ts` (Task 1); `src/styles/tokens.css` (Task 2).
- Produces: de `src/core/messages.ts` — a constante `NAMESPACE` (string `'copyhaunt'`), o tipo `CopyHauntMessage`, a função `createMessage(kind, payload)` e a guarda `isCopyHauntMessage(value): value is CopyHauntMessage`. Todo contexto futuro conversa por este contrato.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/messages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  NAMESPACE,
  createMessage,
  isCopyHauntMessage,
} from '../src/core/messages'

describe('contrato de mensagens', () => {
  it('usa um namespace próprio', () => {
    expect(NAMESPACE).toBe('copyhaunt')
  })

  it('cria mensagem carimbada com o namespace', () => {
    const msg = createMessage('interceptor-ready', {})
    expect(msg.namespace).toBe(NAMESPACE)
    expect(msg.kind).toBe('interceptor-ready')
  })

  it('reconhece a própria mensagem', () => {
    const msg = createMessage('panel-ready', {})
    expect(isCopyHauntMessage(msg)).toBe(true)
  })

  it('rejeita mensagem de terceiros com outro namespace', () => {
    const intruso = { namespace: 'outra-extensao', kind: 'panel-ready' }
    expect(isCopyHauntMessage(intruso)).toBe(false)
  })

  it('rejeita valores que não são objeto', () => {
    expect(isCopyHauntMessage(null)).toBe(false)
    expect(isCopyHauntMessage('texto')).toBe(false)
    expect(isCopyHauntMessage(42)).toBe(false)
    expect(isCopyHauntMessage(undefined)).toBe(false)
  })

  it('preserva o payload', () => {
    const msg = createMessage('raw-capture', {
      url: 'https://www.facebook.com/api/graphql/',
      body: '{}',
    })
    expect(msg.payload).toEqual({
      url: 'https://www.facebook.com/api/graphql/',
      body: '{}',
    })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

```bash
npx vitest run tests/messages.test.ts
```

Esperado: FALHA, com erro de resolução de `../src/core/messages`.

- [ ] **Step 3: Criar o contrato de mensagens**

Criar `src/core/messages.ts`:

```ts
/**
 * Contrato de mensagens entre os quatro contextos de execução.
 *
 * O main world é território compartilhado: qualquer script da página, ou de
 * outra extensão, também posta mensagens ali. Por isso toda mensagem nossa
 * é carimbada com um namespace e verificada na chegada.
 */
export const NAMESPACE = 'copyhaunt'

export type MessageKind =
  | 'interceptor-ready'
  | 'raw-capture'
  | 'panel-ready'
  | 'panel-command'

export interface CopyHauntMessage<P = unknown> {
  namespace: typeof NAMESPACE
  kind: MessageKind
  payload: P
}

export function createMessage<P>(
  kind: MessageKind,
  payload: P,
): CopyHauntMessage<P> {
  return { namespace: NAMESPACE, kind, payload }
}

export function isCopyHauntMessage(
  value: unknown,
): value is CopyHauntMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as CopyHauntMessage).namespace === NAMESPACE
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

```bash
npx vitest run tests/messages.test.ts
```

Esperado: PASSA, 6 testes verdes.

- [ ] **Step 5: Fazer o interceptador anunciar presença**

Substituir todo o conteúdo de `src/interceptor/index.ts`:

```ts
import { createMessage } from '../core/messages'

/**
 * Roda no main world, em document_start. Nesta fase apenas anuncia
 * presença — o patch em XMLHttpRequest entra num plano posterior.
 */
window.postMessage(createMessage('interceptor-ready', {}), '*')
console.info('[CopyHaunt] interceptador ativo no main world')
```

- [ ] **Step 6: Fazer o content script escutar e montar o painel**

Substituir todo o conteúdo de `src/content/index.ts`:

```ts
import { isCopyHauntMessage } from '../core/messages'

const PANEL_ID = 'copyhaunt-panel'

/** Monta o painel num iframe, que isola o CSS da página da Meta. */
function mountPanel(): void {
  if (document.getElementById(PANEL_ID)) return

  const frame = document.createElement('iframe')
  frame.id = PANEL_ID
  frame.src = chrome.runtime.getURL('src/panel/index.html')
  frame.style.cssText = [
    'position:fixed',
    'top:16px',
    'right:16px',
    'width:320px',
    'height:180px',
    'border:0',
    'border-radius:14px',
    'z-index:2147483647',
    'box-shadow:0 0 20px rgba(124, 58, 237, 0.18)',
  ].join(';')

  document.documentElement.appendChild(frame)
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return
  if (!isCopyHauntMessage(event.data)) return

  if (event.data.kind === 'interceptor-ready') {
    console.info('[CopyHaunt] interceptador confirmado pelo content script')
  }
})

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountPanel, { once: true })
} else {
  mountPanel()
}

console.info('[CopyHaunt] content script ativo')
```

- [ ] **Step 7: Criar a página do painel**

Criar `src/panel/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CopyHaunt Ads</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Criar `src/panel/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '../styles/tokens.css'

const root = document.getElementById('root')
if (!root) throw new Error('elemento #root não encontrado no painel')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

Criar `src/panel/App.tsx`:

```tsx
import { useEffect } from 'react'
import { createMessage } from '../core/messages'

export function App() {
  useEffect(() => {
    window.parent.postMessage(createMessage('panel-ready', {}), '*')
  }, [])

  return (
    <div className="flex h-full flex-col gap-2 bg-charcoal p-4 font-sans text-white">
      <h1 className="font-display text-lg font-bold">
        Copy<span className="text-purple">Haunt</span>
      </h1>
      <p className="text-sm text-muted">Painel pronto. Nada minerando ainda.</p>
    </div>
  )
}
```

- [ ] **Step 8: Expor o painel como recurso acessível**

Em `src/manifest.config.ts`, acrescentar a chave `web_accessible_resources` ao objeto `manifest`, logo após `content_scripts`:

```ts
  web_accessible_resources: [
    {
      resources: ['src/panel/index.html'],
      matches: ['*://*.facebook.com/*'],
    },
  ],
```

- [ ] **Step 9: Rodar a suíte inteira**

```bash
npm test && npm run typecheck
```

Esperado: todos os testes passam e a tipagem não acusa erro.

- [ ] **Step 10: Compilar**

```bash
npm run build
```

Esperado: build conclui sem erro. `dist/manifest.json` contém `web_accessible_resources` com `src/panel/index.html`.

- [ ] **Step 11: Verificação manual no navegador**

Esta camada não tem como ser testada em CI: exige o Chrome com sessão na Meta.

1. Abrir `chrome://extensions`, ligar o **Modo do desenvolvedor**
2. **Carregar sem compactação** e escolher a pasta `dist/`
3. Abrir `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=receitas&search_type=keyword_unordered`
4. Abrir o DevTools no console da página

Confirmar as três linhas:

```
[CopyHaunt] interceptador ativo no main world
[CopyHaunt] content script ativo
[CopyHaunt] interceptador confirmado pelo content script
```

A terceira é a que importa: prova que a mensagem cruzou do main world para o mundo isolado.

5. Confirmar que o painel escuro aparece no canto superior direito, com "CopyHaunt" em Sora e o "Haunt" em roxo
6. Confirmar que o layout da Meta continua intacto — o iframe não pode ter vazado estilo nenhum

Se qualquer um dos seis pontos falhar, reportar o que aconteceu em vez de contornar.

- [ ] **Step 12: Commit**

Sobrescrever `.commit-msg` com:

```
✨ feat(ui): ligar os quatro contextos de execução

O que foi feito:
- Criar o contrato de mensagens entre main world, content script e painel
- Fazer o interceptador anunciar presença e o content script confirmar
- Montar o painel React num iframe, com os tokens da marca

Como foi feito:
- Toda mensagem carrega um namespace verificado na chegada: o main world é
  território compartilhado com a página e com outras extensões
- O painel vai em iframe, não em Shadow DOM: o iframe isola também fontes e
  variáveis CSS, e a página da Meta não pode ser afetada

Considerações:
- O interceptador ainda não faz patch em XMLHttpRequest; nesta fase só prova
  que a ponte entre os mundos funciona
```

Depois:

```bash
git add src tests
git commit -F .commit-msg
```

---

## Verificação final do plano

Ao terminar as três tarefas, confirmar:

```bash
npm test              # todas as suítes verdes
npm run typecheck     # sem erro
npm run verify:build  # dist/ gerado e manifest conferido
git status --short    # árvore limpa
```

E, no navegador, as seis confirmações do Step 11 da Task 3.

**O que este plano NÃO entrega,** e precisa de plano próprio: patch em `XMLHttpRequest`, normalização de payload, tipo `Ad`, critérios de escala, bandeja de botões no card, badge de dias, menu OPEN, filtro de data, download em HD, motor de mineração e config remota.
