# Onboarding pós-instalação — Implementation Plan

## Progresso

- **Estado:** não iniciado
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** layout aprovado em boas-vindas-preview.html; nenhum código da extensão foi alterado.

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Adicionar uma página de boas-vindas visualmente aprovada e abri-la automaticamente apenas após uma instalação nova da extensão.

**Architecture:** Migrar o preview para uma página HTML/CSS interna da extensão, incluí-la como entrada do Vite e abrir sua URL pelo service worker no evento onInstalled quando reason for install. O CTA será um link externo direto para a Biblioteca de Anúncios, sem nova mensagem, storage ou permissão.

**Tech Stack:** HTML, CSS, TypeScript, Vite/CRXJS, Chrome MV3, Vitest e Playwright.

**Spec:** docs/superpowers/specs/2026-09-17-boas-vindas-design.md

## Global Constraints

- Toda comunicação, documentação e mensagem de commit deverá permanecer em pt-BR; identificadores de código permanecerão em inglês.
- Seguir teste antes da implementação; nenhum Step será marcado antes da verificação correspondente passar.
- No PowerShell, usar npm.cmd e npx.cmd.
- Nunca executar npm.cmd run gravar:fixtures.
- Não adicionar permissões a permissions ou host_permissions.
- Não abrir onboarding em update, chrome_update ou shared_module_update.
- Preservar o clique da action para resultados e a busca de Instagram já implementada.
- Não adicionar fetch, storage, telemetria, popup ou options page.
- Não usar espera fixa nos testes; usar auto-waiting do Playwright e vi.waitFor.
- Atualizar o bloco Progresso do plano e criar checkpoint ao concluir cada Task.

## Mapa de arquivos

- src/boas-vindas/index.html: documento interno servido pela extensão.
- src/boas-vindas/boas-vindas.css: composição visual migrada do preview.
- vite.config.ts: entrada HTML adicional para o build.
- src/background/index.ts: abertura condicional da página no install.
- tests/background.test.ts: contrato do listener onInstalled.
- e2e/boas-vindas.spec.ts: existência, conteúdo, assets e CTA da página construída.
- boas-vindas-preview.html: referência temporária; remover ao final para evitar duas fontes de verdade.

---

## Task 1: migrar o layout aprovado para uma página da extensão

**Arquivos:**

- Criar src/boas-vindas/index.html.
- Criar src/boas-vindas/boas-vindas.css.
- Modificar vite.config.ts.
- Criar e2e/boas-vindas.spec.ts.

**Interfaces:**

- Produz a página em chrome-extension://<id>/src/boas-vindas/index.html.
- O link principal deve ter href https://www.facebook.com/ads/library/ e
  target="_blank".

- [ ] **Step 1: escrever o teste E2E da página interna**

Criar e2e/boas-vindas.spec.ts:

~~~ts
import { expect, test } from './fixtures'

test('exibe a página de boas-vindas construída pela extensão', async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage()

  await page.goto(
    'chrome-extension://' + extensionId + '/src/boas-vindas/index.html',
  )

  await expect(
    page.getByRole('heading', { name: 'Pronto para caçar.' }),
  ).toBeVisible()
  await expect(page.getByText('Extensão instalada')).toBeVisible()
  await expect(page.locator('img[alt="CopyHaunt Ads"]')).toBeVisible()

  const cta = page.getByRole('link', {
    name: 'Abrir Biblioteca de Anúncios',
  })
  await expect(cta).toHaveAttribute(
    'href',
    'https://www.facebook.com/ads/library/',
  )
  await expect(cta).toHaveAttribute('target', '_blank')
})
~~~

O teste deverá usar o build existente e falhar inicialmente porque a rota
src/boas-vindas/index.html ainda não foi gerada.

- [ ] **Step 2: executar o E2E em RED**

Executar:

~~~powershell
npx.cmd playwright test e2e/boas-vindas.spec.ts
~~~

Esperado: falha ao navegar ou ao encontrar o heading, pois a nova entrada
ainda não existe no dist carregado pelo fixture.

- [ ] **Step 3: criar o documento HTML da extensão**

Criar src/boas-vindas/index.html com a estrutura semântica:

~~~html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pronto para caçar | CopyHaunt Ads</title>
    <link rel="stylesheet" href="./boas-vindas.css" />
  </head>
  <body>
    <main class="page">
      <header class="topbar">
        <a class="brand" href="#" aria-label="CopyHaunt Ads">
          <img class="brand-icon" src="../../logo/icone-branco.png" alt="" />
          <img class="brand-name" src="../../logo/logotipo-branco.png" alt="CopyHaunt Ads" />
        </a>
        <div class="topbar-note"><strong>01</strong> / first hunt</div>
      </header>

      <section class="hero" aria-labelledby="hero-title">
        <p class="eyebrow">Ads intelligence for winning creatives</p>
        <h1 id="hero-title">Pronto para <span>caçar.</span></h1>
        <div class="stamp">Extensão instalada</div>
        <p class="intro">
          A CopyHaunt está pronta. Abra a Biblioteca de Anúncios e comece a
          investigar as referências que movem o seu mercado.
        </p>
        <a
          class="cta"
          href="https://www.facebook.com/ads/library/"
          target="_blank"
          rel="noreferrer"
        >
          Abrir Biblioteca de Anúncios
        </a>
      </section>

      <footer class="footer">
        <span>Biblioteca de Anúncios</span>
        <span>CopyHaunt Ads</span>
        <span>Observe · Capture · Modele</span>
      </footer>
    </main>
  </body>
</html>
~~~

Manter exatamente os textos e o contrato dos atributos usados pelo E2E.

- [ ] **Step 4: extrair o CSS do preview aprovado**

Copiar o conteúdo do bloco style de boas-vindas-preview.html para
src/boas-vindas/boas-vindas.css, preservando:

- as variáveis de identidade #08070D, #7C3AED, #A855F7 e #C4A7FF;
- a composição de tela única;
- o headline responsivo;
- o selo inclinado;
- o CTA com seta;
- o rodapé editorial;
- os media queries para largura máxima de 680px;
- o suporte a prefers-reduced-motion.

Remover o style inline de src/boas-vindas/index.html: o HTML deverá depender
somente do arquivo CSS externo.

- [ ] **Step 5: adicionar a entrada do Vite**

Em vite.config.ts, preservar as entradas existentes e adicionar:

~~~ts
input: {
  panel: 'src/panel/index.html',
  resultados: 'src/resultados/index.html',
  boasVindas: 'src/boas-vindas/index.html',
},
~~~

Não alterar os plugins, o manifest ou as entradas existentes.

- [ ] **Step 6: construir e executar o E2E em GREEN**

Executar:

~~~powershell
npm.cmd run verify:build
npx.cmd playwright test e2e/boas-vindas.spec.ts
~~~

Esperado:

- o build gera src/boas-vindas/index.html em dist;
- o HTML é navegável pela URL da extensão;
- heading, selo, logo e CTA passam;
- verify:build não acusa permissão ou manifest inválido.

- [ ] **Step 7: checkpoint**

Atualizar o bloco Progresso com Task 1 concluída e Task 2 como próxima tarefa.
Registrar as saídas dos comandos e criar o commit:

~~~powershell
git add src/boas-vindas/index.html src/boas-vindas/boas-vindas.css vite.config.ts e2e/boas-vindas.spec.ts docs/superpowers/plans/2026-09-17-boas-vindas.md
git commit -m "✨ feat(ui): adicionar página de boas-vindas"
~~~

---

## Task 2: abrir o onboarding somente em uma instalação nova

**Arquivos:**

- Modificar src/background/index.ts.
- Modificar tests/background.test.ts.

**Interfaces:**

- Consome detalhes do evento chrome.runtime.onInstalled.
- Produz uma chamada a chrome.tabs.create com a URL gerada por
  chrome.runtime.getURL('src/boas-vindas/index.html') e active: true somente
  para reason === 'install'.
- Não altera abrirResultados nem intermediarInstagram.

- [ ] **Step 1: preparar o mock e escrever os testes RED**

Em tests/background.test.ts, substituir o mock simples de onInstalled por um
registro de listeners:

~~~ts
const onInstalled = vi.hoisted(() => {
  const listeners: Array<(details: { reason: string }) => void> = []
  return {
    listeners,
    addListener: vi.fn((listener: (details: { reason: string }) => void) => {
      listeners.push(listener)
    }),
  }
})
~~~

Usar onInstalled no mock de chrome.runtime e alterar getURL para retornar a
URL conforme o caminho:

~~~ts
getURL: vi.fn((path: string) => 'chrome-extension://id/' + path),
~~~

Adicionar estes testes:

~~~ts
it('abre onboarding ao instalar pela primeira vez', async () => {
  await import('../src/background/index')

  onInstalled.listeners[0]({ reason: 'install' })

  expect(criarAba).toHaveBeenCalledWith({
    url: 'chrome-extension://id/src/boas-vindas/index.html',
    active: true,
  })
})

it.each(['update', 'chrome_update', 'shared_module_update'])(
  'não abre onboarding em %s',
  async reason => {
    await import('../src/background/index')

    onInstalled.listeners[0]({ reason })

    expect(criarAba).not.toHaveBeenCalled()
  },
)
~~~

Antes da implementação, o teste de install deverá falhar porque o listener
atual apenas registra o log e não abre a página.

- [ ] **Step 2: executar os testes RED**

Executar:

~~~powershell
npx.cmd vitest run tests/background.test.ts
~~~

Esperado: os testes novos de install falham; os testes existentes de action,
resultados e Instagram permanecem como referência de regressão.

- [ ] **Step 3: implementar a abertura condicional**

Em src/background/index.ts, substituir o listener atual por uma implementação
equivalente a:

~~~ts
const CAMINHO_BOAS_VINDAS = 'src/boas-vindas/index.html'

function abrirBoasVindas(): void {
  void chrome.tabs.create({
    url: chrome.runtime.getURL(CAMINHO_BOAS_VINDAS),
    active: true,
  })
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  console.info('[CopyHaunt] service worker instalado')
  if (reason !== 'install') return
  abrirBoasVindas()
})
~~~

Manter abrirResultados, o listener de action, o listener de mensagens e toda a
ponte do Instagram sem mudança de comportamento.

- [ ] **Step 4: executar GREEN e as regressões do service worker**

Executar:

~~~powershell
npx.cmd vitest run tests/background.test.ts
npm.cmd test -- --run tests/manifest.test.ts tests/background.test.ts
npm.cmd run typecheck
~~~

Esperado: todos os testes do service worker passam, as três razões que não
representam instalação não abrem aba, o manifest continua com as permissões
atuais e o TypeScript não emite erros.

- [ ] **Step 5: checkpoint**

Atualizar o bloco Progresso com Task 2 concluída e Task 3 como próxima tarefa.
Registrar as saídas e criar o commit:

~~~powershell
git add src/background/index.ts tests/background.test.ts docs/superpowers/plans/2026-09-17-boas-vindas.md
git commit -m "✨ feat(background): abrir onboarding após instalação"
~~~

---

## Task 3: validar o fluxo construído e a experiência de atualização

**Arquivos:**

- Manter e2e/boas-vindas.spec.ts como teste da página.
- Alterar somente docs/superpowers/plans/2026-09-17-boas-vindas.md para registrar a validação.

**Interfaces:**

- A página construída deve ser acessível diretamente pela URL da extensão.
- A instalação nova deve abrir a página uma vez.
- Atualizações não devem abrir a página.

- [ ] **Step 1: executar a suíte E2E relacionada**

Executar:

~~~powershell
npm.cmd run verify:build
npx.cmd playwright test e2e/boas-vindas.spec.ts e2e/resultados.spec.ts
~~~

Conferir que a nova entrada não interfere na página de resultados, no clique da
action ou na ponte de abertura existente.

- [ ] **Step 2: validar manualmente em instalação local**

Com o build atualizado:

1. Abrir chrome://extensions.
2. Remover a instalação local da CopyHaunt.
3. Carregar novamente o diretório dist como extensão descompactada.
4. Confirmar que uma aba abre em
   chrome-extension://<id>/src/boas-vindas/index.html.
5. Clicar em “Abrir Biblioteca de Anúncios” e confirmar a nova aba da Meta.
6. Recarregar a extensão em chrome://extensions e confirmar que nenhuma nova
   aba de boas-vindas é criada.

Para a CWS, repetir o teste removendo a versão instalada e instalando uma nova
versão publicada. A validação local de reload representa update, não install.

- [ ] **Step 3: checkpoint**

Atualizar o bloco Progresso com Task 3 concluída e Task 4 como próxima tarefa.
Registrar o resultado manual, incluindo se a aba foi aberta uma única vez.

Criar o commit:

~~~powershell
git add docs/superpowers/plans/2026-09-17-boas-vindas.md
git commit -m "🧪 test(e2e): validar onboarding pós-instalação"
~~~

---

## Task 4: verificação final e limpeza do preview

**Arquivos:**

- Remover boas-vindas-preview.html após a validação da Task 3.
- Atualizar docs/superpowers/plans/2026-09-17-boas-vindas.md.

- [ ] **Step 1: rodar a verificação completa**

Executar:

~~~powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npm.cmd run e2e
~~~

Não executar npm.cmd run gravar:fixtures.

Esperado:

- testes unitários passando;
- typecheck limpo;
- build e verificação do manifest passando;
- E2E passando, salvo a instabilidade conhecida e isolada de
  e2e/acoes.spec.ts, que deverá ser reexecutada isoladamente se aparecer na
  suíte completa.

- [ ] **Step 2: revisar o diff final**

Executar:

~~~powershell
git diff --check
git status --short
git diff --stat HEAD~3..HEAD
~~~

Conferir:

- nenhum novo item em permissions ou host_permissions;
- onboarding condicionado estritamente a reason === 'install';
- action e resultados preservados;
- nenhum fetch, storage, telemetria ou mensagem nova;
- preview da raiz removido somente depois de a página interna passar no E2E.

- [ ] **Step 3: remover a fonte visual duplicada**

Depois de verify:build e da suíte E2E passarem, remover
boas-vindas-preview.html. A fonte visual oficial passará a ser
src/boas-vindas/index.html e src/boas-vindas/boas-vindas.css.

- [ ] **Step 4: fechar o plano**

Marcar os Steps 1 a 3 como [x], definir:

- Estado: concluído;
- Última tarefa concluída: Task 4;
- Próxima tarefa: —;
- Notas de retomada: comandos executados, resultado manual e qualquer falha
  isolada.

Criar o commit final:

~~~powershell
git add docs/superpowers/plans/2026-09-17-boas-vindas.md
git commit -m "📚 docs(plan): concluir onboarding pós-instalação"
~~~

## Critério de conclusão

A feature estará concluída quando a página aprovada estiver empacotada em
src/boas-vindas/index.html, abrir automaticamente somente em instalações novas,
levar o usuário à Biblioteca de Anúncios pelo CTA, preservar resultados e
action existentes, não adicionar permissões e passar pela verificação completa.
