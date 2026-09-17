# Tela de resultados da mineração — Plano de implementação

> **Para agentes:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam checkboxes (`- [ ]`) para acompanhamento.

**Objetivo:** Persistir os aprovados finais da mineração e exibi-los em uma página própria da extensão, com ordenação, ações de card e menu de links igual ao gerenciador da Biblioteca.

**Arquitetura:** O contrato de resultados fica em um módulo puro, com codec versionado para `Date`, hidratação e ordenação sobre um `AdStore` reconstruído. Um adaptador pequeno encapsula `chrome.storage.local`; o content script grava apenas após o pós-filtro e a nova página React lê o snapshot sem conhecer o DOM da Meta. O service worker abre a mesma página pelo ícone da extensão.

**Tech Stack:** TypeScript 7, React 19, Vitest 5 com jsdom, Playwright, Vite/CRXJS, `chrome.storage.local`.

**Spec:** `docs/superpowers/specs/2026-09-17-resultados-design.md`

## Progresso

- **Estado:** não iniciado
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** —

## Restrições globais

- Toda comunicação, documentação e mensagem de commit em pt-BR; identificadores em inglês.
- Permissões continuam exatamente `['storage']`; não adicionar `tabs`, `downloads`, `scripting` ou host novo.
- Usar `npm.cmd` e `npx.cmd` no PowerShell.
- Nunca executar `npm.cmd run gravar:fixtures`.
- Teste antes da implementação: cada comportamento novo precisa de RED observado antes do GREEN.
- Nenhuma espera fixa em testes; usar `vi.waitFor`, auto-waiting do Playwright ou eventos reais.
- O resultado é substituído pela próxima mineração; não criar histórico.
- A consulta de Instagram não roda na página de resultados. Se a URL já estiver em `ad.anunciante.instagram` ou puder ser derivada sem rede, ela é link; caso contrário, o item fica desabilitado com o texto `Abrir na Biblioteca`.

---

### Task 1: Criar o contrato puro do resultado

**Arquivos:**

- Criar: `src/core/resultados.ts`
- Testar: `tests/resultados.test.ts`

**Interfaces:**

- Consome: `Ad`, `AdStore`, `EstadoMineracao` e `diasAtivos` existentes.
- Produz: `CHAVE_RESULTADO`, `ResultadoPersistidoV1`, `ResultadoLocal`, `OrdenacaoResultado`, `serializarResultado`, `hidratarResultado` e `ordenarAnuncios`.

- [ ] **Step 1: Escrever os testes que falham**

Cobrir pelo menos:

```ts
it('serializa e hidrata iniciouEm sem perder os campos opcionais', () => {
  const persistido = serializarResultado({
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    estado: 'esgotado',
    salvoEm: AGORA,
    anuncios: [anuncio({ iniciouEm: INICIO, titulo: undefined })],
  })

  const hidratado = hidratarResultado(persistido)

  expect(hidratado?.anuncios[0].iniciouEm).toEqual(INICIO)
  expect(hidratado?.anuncios[0].titulo).toBeUndefined()
})

it('rejeita versão, data e anúncio inválidos sem lançar', () => {
  expect(hidratarResultado({ versao: 2 })).toBeNull()
  expect(hidratarResultado({ versao: 1, salvoEm: 'x', anuncios: [] })).toBeNull()
  expect(hidratarResultado({ versao: 1, salvoEm: AGORA.toISOString(), origem: 'x', estado: 'esgotado', anuncios: [{ id: '' }] })).toBeNull()
})

it('ordena por tempo ativo, colação e presença do anunciante', () => {
  const anuncios = [anuncio({ id: 'novo', iniciouEm: DIAS_7_ATRAS, colacao: 2, colacaoId: 'grupo-a', pageId: 'p1' }),
    anuncio({ id: 'antigo', iniciouEm: DIAS_90_ATRAS, colacao: 1, colacaoId: 'grupo-a', pageId: 'p1' }),
    anuncio({ id: 'outro', iniciouEm: DIAS_30_ATRAS, colacao: 1, pageId: 'p2' })]

  expect(ordenarAnuncios(anuncios, 'tempo', AGORA).map((a) => a.id)).toEqual(['antigo', 'outro', 'novo'])
  expect(ordenarAnuncios(anuncios, 'colacao', AGORA).map((a) => a.id)).toEqual(['novo', 'antigo', 'outro'])
  expect(ordenarAnuncios(anuncios, 'anunciante', AGORA).map((a) => a.id)).toEqual(['novo', 'antigo', 'outro'])
})
```

Os helpers de teste devem criar `Ad` reais, com `colacaoId` e `pageId` variados, para provar as métricas do `AdStore`, não apenas comparar números artificiais.

No topo do arquivo de teste, definir `AGORA`, `INICIO`, `DIAS_7_ATRAS`, `DIAS_30_ATRAS` e `DIAS_90_ATRAS` como `Date` determinísticas e um helper `anuncio(opcoes: Partial<...> = {}): Ad` que parte de um anúncio válido, aplica `id`, `iniciouEm`, `colacao`, `colacaoId` e `pageId`, e retorna `Ad` completo com `midias: []`.

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Rodar: `npx.cmd vitest run tests/resultados.test.ts`

Esperado: FAIL porque `src/core/resultados.ts` ainda não existe.

- [ ] **Step 3: Escrever a implementação mínima**

Usar estes contratos:

```ts
export const CHAVE_RESULTADO = 'copyhaunt:resultado:v1'
export type OrdenacaoResultado = 'tempo' | 'colacao' | 'anunciante'

export interface ResultadoPersistidoV1 {
  versao: 1
  salvoEm: string
  origem: string
  estado: EstadoMineracao
  anuncios: Array<Omit<Ad, 'iniciouEm'> & { iniciouEm: string }>
}

export interface ResultadoLocal {
  salvoEm: Date
  origem: string
  estado: EstadoMineracao
  anuncios: Ad[]
}
```

`serializarResultado` deve converter somente `iniciouEm` e `salvoEm` para ISO. `hidratarResultado` deve validar `versao === 1`, datas finitas, `origem` string e o mínimo `id`, `iniciouEm`, `anunciante.pageId`, `anunciante.pageName`, `midias` array e `ativo` boolean. Carga inválida retorna `null`.

`ordenarAnuncios` deve reconstruir um `AdStore`, adicionar todos os anúncios e ordenar uma cópia estável por `diasAtivos`, `store.colacaoDe` ou `store.presenca`, sempre descendente. Em empate, preservar a ordem original.

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Rodar: `npx.cmd vitest run tests/resultados.test.ts`

Esperado: todos os testes do arquivo passam.

- [ ] **Step 5: Rodar typecheck e registrar o checkpoint**

Rodar: `npm.cmd run typecheck`

Esperado: sem erros. Atualizar o bloco Progresso para Task 1 e preparar a mensagem:

```text
✨ feat(core): adicionar contrato dos resultados
```

---

### Task 2: Encapsular o armazenamento local

**Arquivos:**

- Criar: `src/storage/resultados.ts`
- Testar: `tests/resultados-storage.test.ts`

**Interfaces:**

- Consome: `CHAVE_RESULTADO`, `ResultadoLocal`, `serializarResultado` e `hidratarResultado`.
- Produz: `StorageLocal`, `criarStorageChrome`, `salvarResultado`, `carregarResultado`.

- [ ] **Step 1: Escrever os testes que falham**

Testar com um mapa em memória injetado:

```ts
interface StorageLocal {
  get(chave: string): Promise<unknown>
  set(chave: string, valor: unknown): Promise<void>
}

it('salva usando a chave versionada e lê o resultado hidratado', async () => {
  const storage = mapaStorage()
  await salvarResultado(resultadoDeTeste(), storage)
  const lido = await carregarResultado(storage)
  expect(lido?.anuncios[0].iniciouEm).toBeInstanceOf(Date)
})

it('trata storage vazio ou corrompido como ausência de resultado', async () => {
  expect(await carregarResultado(mapaStorage())).toBeNull()
  expect(await carregarResultado(mapaStorage({ [CHAVE_RESULTADO]: { versao: 2 } }))).toBeNull()
})
```

O arquivo deve definir `mapaStorage(inicial?: Record<string, unknown>): StorageLocal`, `resultadoDeTeste(): ResultadoLocal` e manter o mapa mutável fechado no helper para que o teste observe a chave gravada sem mockar implementação interna.

- [ ] **Step 2: Rodar e confirmar que falha**

Rodar: `npx.cmd vitest run tests/resultados-storage.test.ts`

Esperado: FAIL por módulo e funções ausentes.

- [ ] **Step 3: Implementar o adaptador mínimo**

`criarStorageChrome()` deve adaptar `chrome.storage.local.get(chave)` e `set({ [chave]: valor })` para `StorageLocal`. Não importar Chrome no módulo puro da Task 1. As assinaturas são `salvarResultado(resultado: ResultadoLocal, storage?: StorageLocal): Promise<void>` e `carregarResultado(storage?: StorageLocal): Promise<ResultadoLocal | null>`; quando o segundo parâmetro não vier, usar `criarStorageChrome()`. `salvarResultado` deve persistir o payload serializado; `carregarResultado` deve retornar `null` em storage vazio, inválido ou quando a API rejeitar, registrando apenas `[CopyHaunt] resultados: falha ao ler/gravar` no console.

- [ ] **Step 4: Rodar e confirmar que passa**

Rodar: `npx.cmd vitest run tests/resultados-storage.test.ts`

Esperado: todos os testes passam.

- [ ] **Step 5: Rodar a suíte de lógica**

Rodar: `npx.cmd vitest run tests/resultados.test.ts tests/resultados-storage.test.ts`

Esperado: todos os testes passam. Atualizar Progresso e preparar:

```text
✨ feat(core): persistir snapshot dos resultados
```

---

### Task 3: Gravar o resultado ao fim da mineração e liberar o atalho

**Arquivos:**

- Modificar: `src/content/index.ts`
- Modificar: `src/content/progresso.ts`
- Criar: `src/content/resultados.ts`
- Testar: `tests/content/progresso.test.ts`, `tests/content/resultados.test.ts`

**Interfaces:**

- Consome: `salvarResultado`, `chrome.runtime.getURL`, `ResultadoLocal` e o `Minerador` já existente.
- Produz: `urlDaPaginaResultados`, `abrirPaginaResultados`, `liberarResultados` e o botão `[data-acao="resultados"]`.

- [ ] **Step 1: Escrever os testes que falham**

Cobrir:

```ts
it('o cartão começa sem resultado e libera o atalho quando solicitado', () => {
  const cartao = montarProgresso(document, vi.fn(), vi.fn())
  const botao = cartao.querySelector<HTMLButtonElement>('[data-acao="resultados"]')!
  expect(botao.hidden).toBe(true)
  liberarResultados(cartao)
  expect(botao.hidden).toBe(false)
  expect(botao.disabled).toBe(false)
})

it('a URL de resultados usa o recurso da própria extensão', () => {
  vi.stubGlobal('chrome', { runtime: { getURL: vi.fn(() => 'chrome-extension://id/src/resultados/index.html') } })
  expect(urlDaPaginaResultados()).toBe('chrome-extension://id/src/resultados/index.html')
})

it('não grava quando a mineração termina pausada', async () => {
  const salvar = vi.fn()
  // Exercitar a função de finalização com estado pausado e storage espião.
  expect(salvar).not.toHaveBeenCalled()
})
```

O teste de integração deve provar que, com `exigirInstagram`, o snapshot recebe os anúncios depois que `filtrarPorInstagram` resolve, e não durante o laço. A alteração necessária em `filtrarPorInstagram` deve preservar no anúncio final o perfil retornado por `consultar`, em `anunciante.instagram`, para que o menu Links tenha o destino conhecido na página de resultados.

- [ ] **Step 2: Rodar e confirmar que falha**

Rodar: `npx.cmd vitest run tests/content/progresso.test.ts tests/content/resultados.test.ts`

Esperado: FAIL pelos contratos novos.

- [ ] **Step 3: Implementar o atalho e a persistência**

Alterar `montarProgresso` para receber `aoAbrirResultados`, criar o botão escondido e manter o botão de pausa existente. `liberarResultados` apenas revela e habilita o botão.

Criar `src/content/resultados.ts` com `urlDaPaginaResultados()` e `abrirPaginaResultados()`; a segunda deve chamar `window.open(urlDaPaginaResultados(), '_blank', 'noopener')` somente como resposta ao clique.

Em `dispararMineracao`, guardar a referência do cartão retornado por `mostrarProgresso`. Depois de `finais` receber o pós-filtro, chamar `await salvarResultado({ origem: location.href, estado: p.estado, salvoEm: new Date(), anuncios: finais })`; só depois liberar o atalho. Se o storage falhar, manter o botão escondido e o log de erro.

- [ ] **Step 4: Rodar e confirmar que passa**

Rodar: `npx.cmd vitest run tests/content/progresso.test.ts tests/content/resultados.test.ts`

Esperado: todos os testes passam.

- [ ] **Step 5: Rodar suíte e typecheck**

Rodar: `npm.cmd test` e `npm.cmd run typecheck`

Esperado: suíte inteira verde e tipagem sem erros. Atualizar Progresso e preparar:

```text
✨ feat(content): salvar aprovados ao concluir mineração
```

---

### Task 4: Registrar página, ação e abertura no service worker

**Arquivos:**

- Criar: `src/resultados/index.html`
- Modificar: `vite.config.ts`
- Modificar: `src/manifest.config.ts`
- Modificar: `src/background/index.ts`
- Modificar: `scripts/verify-manifest.mjs`
- Testar: `tests/manifest.test.ts`, `tests/background.test.ts`

**Interfaces:**

- Consome: `urlDaPaginaResultados` e a URL gerada pelo Vite/CRXJS.
- Produz: `manifest.action.default_title`, entrada de build `resultados` e abertura pelo ícone.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao teste do manifest:

```ts
it('declara ação para abrir resultados sem pedir permissões novas', () => {
  expect(manifest.action).toEqual({ default_title: 'Abrir resultados' })
  expect(manifest.permissions).toEqual(['storage'])
})
```

No teste do service worker, usar um `chrome.action.onClicked.addListener` espião e verificar que o callback chama `chrome.tabs.create({ url: 'chrome-extension://id/src/resultados/index.html' })`.

- [ ] **Step 2: Rodar e confirmar que falha**

Rodar: `npx.cmd vitest run tests/manifest.test.ts tests/background.test.ts`

Esperado: FAIL porque `action`, a entrada e o listener ainda não existem.

- [ ] **Step 3: Implementar o registro**

Adicionar `action: { default_title: 'Abrir resultados' }` ao objeto exportado do manifest. Acrescentar `resultados: 'src/resultados/index.html'` aos inputs do Rollup.

No background, registrar `chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('src/resultados/index.html') }))`. Não adicionar `tabs` às permissões.

Atualizar o verificador para exigir `manifest.action.default_title` e a existência de `dist/src/resultados/index.html`, mantendo as verificações atuais de `world MAIN`, dois content scripts, hosts e `['storage']`.

- [ ] **Step 4: Rodar e confirmar que passa**

Rodar: `npx.cmd vitest run tests/manifest.test.ts tests/background.test.ts`

Esperado: todos os testes passam.

- [ ] **Step 5: Rodar build verificável**

Rodar: `npm.cmd run verify:build`

Esperado: build concluído, página presente e `manifest gerado OK`.

- [ ] **Step 6: Atualizar Progresso e preparar:**

```text
✨ feat(build): registrar página de resultados na extensão
```

---

### Task 5: Criar a aplicação React da página de resultados

**Arquivos:**

- Criar: `src/resultados/main.tsx`
- Criar: `src/resultados/App.tsx`
- Criar: `src/resultados/CartaoResultado.tsx`
- Criar: `src/resultados/LinksMenu.tsx`
- Criar: `src/resultados/resultados.css`
- Modificar: `src/resultados/index.html`
- Testar: `tests/resultados-ui.test.tsx`

**Interfaces:**

- Consome: `carregarResultado`, `ordenarAnuncios`, `montarDestinos`, `montarCopias`, `baixarCriativos`, tokens de `src/styles/tokens.css`.
- Produz: estado vazio, estado corrompido tratado, cabeçalho, seletor de ordenação, grade de cards e menu de links.

- [ ] **Step 1: Escrever os testes que falham**

Renderizar `App` em jsdom com storage injetado e verificar:

```ts
it('mostra estado vazio quando ainda não há resultado', async () => {
  renderizarComStorage(null)
  await vi.waitFor(() => expect(document.body.textContent).toContain('Nenhuma mineração concluída'))
})

it('mostra cards e troca a ordem pelo seletor', async () => {
  renderizarComStorage(resultadoComTresAnuncios())
  await vi.waitFor(() => expect(document.querySelectorAll('[data-testid="resultado-card"]')).toHaveLength(3))
  selecionar('Mais criativos repetidos')
  expect(idsDosCards()).toEqual(['criativo-mais-repetido', 'antigo', 'outro'])
})

it('abre o menu Links com os seis destinos do gerenciador', async () => {
  renderizarComStorage(resultadoComTresAnuncios())
  clicar('[data-acao="links"]')
  expect([...document.querySelectorAll('[data-link-chave]')].map((el) => el.textContent)).toEqual([
    'Site do anúncio', 'Perfil do anunciante', 'Instagram do anunciante',
    'Buscar anúncios deste site', 'Buscar anúncios deste anunciante',
    'URL do anúncio na Biblioteca',
  ])
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Rodar: `npx.cmd vitest run tests/resultados-ui.test.tsx`

Esperado: FAIL porque a página ainda não possui componentes.

- [ ] **Step 3: Implementar o shell visual**

`main.tsx` deve importar `../styles/tokens.css` e `resultados.css`, encontrar `#root` e montar `App` em `StrictMode`.

`App` deve carregar uma vez o snapshot, capturar `agora` uma vez, manter `OrdenacaoResultado` em estado local e renderizar:

- marca CopyHaunt;
- cabeçalho com `N aprovados`, origem e `salvoEm`;
- `select` com os três rótulos do spec;
- grade responsiva;
- estado vazio ou inválido com link para a Biblioteca;
- cards com primeiro preview, nome do anunciante, dias ativos, colação, presença, copy/título e plataformas.

Usar os tokens da IDV: `#08070D`, `#111019`, `#7C3AED`, `#A855F7`, `#C4A7FF`, `#B8B5C6`, Sora e Inter. Não criar fetch nem requisição para a Meta na página.

No topo do teste, definir `renderizarComStorage(resultado)`, `resultadoComTresAnuncios()`, `selecionar(rotulo)`, `idsDosCards()` e `clicar(seletor)`; `renderizarComStorage` deve injetar a dependência de storage da `App` em vez de substituir módulos com mock global.

- [ ] **Step 4: Implementar ações do card e menu Links colapsável**

`LinksMenu` deve ser aberto/fechado pelo botão `data-acao="links"`, chamar `montarDestinos(ad)` e conservar a ordem e os rótulos retornados. Cada item com `url` vira link externo com `target="_blank"` e `rel="noreferrer"`; item sem URL fica disabled. Instagram desconhecido mostra `Abrir na Biblioteca` como motivo e não chama `buscarInstagram`. Só um menu pode ficar aberto por vez; abrir outro fecha o anterior e clicar fora fecha o menu atual.

O botão `Copiar` abre os cinco itens de `montarCopias(ad)` e usa `navigator.clipboard.writeText` quando houver valor. O botão `Baixar` chama `baixarCriativos(ad, { buscar: fetch, salvar })`; `salvar` usa âncora temporária e revoga o object URL no próximo tique, como o tray atual.

- [ ] **Step 5: Rodar e confirmar que passa**

Rodar: `npx.cmd vitest run tests/resultados-ui.test.tsx tests/resultados.test.ts tests/resultados-storage.test.ts`

Esperado: todos os testes passam.

- [ ] **Step 6: Rodar typecheck e preparar:**

Rodar: `npm.cmd run typecheck`

Esperado: sem erros. Mensagem:

```text
✨ feat(ui): criar página de resultados da mineração
```

---

### Task 6: Cobrir a jornada no Playwright

**Arquivos:**

- Criar: `e2e/resultados.spec.ts`
- Não modificar: `e2e/fixtures.ts`; a fixture já expõe `context` e `extensionId` suficientes para abrir a página da extensão.

**Interfaces:**

- Consome: `extensionId`, contexto persistente e a página `src/resultados/index.html` do build.
- Produz: verificação de página vazia, página preenchida, ordenação e menu Links no navegador real da extensão.

- [ ] **Step 1: Escrever os testes que falham**

Cobrir sem navegar na Meta:

```ts
test('a página nova começa com estado vazio', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/resultados/index.html`)
  await expect(page.getByText('Nenhuma mineração concluída')).toBeVisible()
})

test('renderiza resultado salvo, ordena e abre Links', async ({ context, extensionId }) => {
  const page = await context.newPage()
  await page.goto(`chrome-extension://${extensionId}/src/resultados/index.html`)
  await page.evaluate(async (payload) => {
    await chrome.storage.local.set({ 'copyhaunt:resultado:v1': payload })
    location.reload()
  }, payloadPersistidoDeTeste())
  await expect(page.locator('[data-testid="resultado-card"]')).toHaveCount(3)
  await page.selectOption('[data-testid="ordenacao"]', 'colacao')
  await expect(page.locator('[data-testid="resultado-card"]').first()).toHaveAttribute('data-ad-id', 'criativo-mais-repetido')
  await page.locator('[data-acao="links"]').first().click()
  await expect(page.locator('[data-link-chave="perfil"]')).toBeVisible()
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Rodar: `npm.cmd run verify:build; npx.cmd playwright test e2e/resultados.spec.ts`

Esperado: FAIL porque a entrada da página e seus seletores ainda não existem.

`payloadPersistidoDeTeste()` deve ser um helper do próprio arquivo, montado com `serializarResultado` e os mesmos três anúncios determinísticos dos testes unitários; não duplicar um JSON de produção.

- [ ] **Step 3: Ajustar a implementação apenas pelo comportamento observado**

Garantir que o carregamento assíncrono não dependa de espera fixa. Depois de gravar o payload no `chrome.storage.local`, o teste deve aguardar a UI por locators.

- [ ] **Step 4: Rodar o E2E e confirmar que passa**

Rodar: `npm.cmd run verify:build; npx.cmd playwright test e2e/resultados.spec.ts`

Esperado: os testes da página passam.

- [ ] **Step 5: Preparar:**

```text
🧪 test(e2e): cobrir jornada da tela de resultados
```

---

### Task 7: Verificação completa e fechamento do plano

**Arquivos:**

- Modificar: `docs/superpowers/plans/2026-09-17-resultados.md`
- Opcionalmente modificar: testes que revelem regressão real nas etapas anteriores.

- [ ] **Step 1: Rodar a verificação completa**

Rodar, nesta ordem:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git status --short
```

Esperado: suíte unitária verde, typecheck sem erros, manifest gerado OK, E2E verde e apenas alterações esperadas.

- [ ] **Step 2: Conferir manualmente o build**

Verificar que `dist/src/resultados/index.html` existe, que o manifest tem `action.default_title`, que as permissões continuam `['storage']` e que nenhum `fetch` de Instagram foi introduzido em `src/resultados/`.

- [ ] **Step 3: Atualizar o bloco Progresso**

Marcar todas as Tasks concluídas, registrar os números reais da suíte e anotar qualquer decisão que tenha divergido do plano. Só marcar `[x]` depois de a verificação correspondente passar.

- [ ] **Step 4: Escrever a mensagem do checkpoint final**

```text
✨ feat(ui): entregar tela persistente de resultados

O que foi feito:
- Persistir os aprovados finais após a mineração
- Exibir cards ordenáveis com ações e menu de links da bandeja
- Abrir a página pelo cartão de progresso e pelo ícone da extensão

Como foi feito:
- Codec versionado e ordenação mantidos em módulos puros
- Página React lê apenas o snapshot local e não consulta a Meta

Considerações:
- A busca de Instagram continua na Biblioteca quando o perfil ainda não é conhecido
```

---

## Critério de conclusão

O plano só está concluído quando:

- os aprovados finais são persistidos após o pós-filtro;
- a página abre pelo cartão e pelo ícone;
- os cards aparecem com as três ordenações;
- o botão colapsável `Links` oferece os seis destinos na mesma ordem do gerenciador e fecha menus concorrentes;
- Instagram desconhecido fica sem requisição na página de resultados;
- `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run verify:build` e `npx.cmd playwright test` passam;
- o bloco Progresso está atualizado e o checkpoint está commitado pelo reviewer.
