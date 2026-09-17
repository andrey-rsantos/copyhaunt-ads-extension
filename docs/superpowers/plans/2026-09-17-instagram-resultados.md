# Busca de Instagram na tela de resultados — Plano de implementação

> **Para agentes:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recomendado) ou superpowers:executing-plans para executar este plano tarefa a tarefa. Os passos usam checkboxes (- [ ]) para acompanhamento.

**Objetivo:** oferecer a busca explícita de Instagram no menu Links da tela de resultados, executando a consulta no contexto da Biblioteca e persistindo o perfil encontrado.

**Arquitetura:** a tela de resultados envia uma mensagem privada ao service worker. O worker valida a origem, abre uma aba da Biblioteca e encaminha o comando ao content script; o content script aguarda a configuração e reaproveita buscarInstagram. A UI deduplica consultas por pageId, atualiza todos os cards relacionados e grava a URL encontrada no snapshot.

**Tech Stack:** TypeScript 7, React 19, Vitest 5 com jsdom, Playwright, chrome.runtime, chrome.tabs, chrome.storage.local, Vite/CRXJS.

**Spec:** docs/superpowers/specs/2026-09-17-instagram-resultados-design.md

## Progresso

- **Estado:** em andamento — implementação concluída, falta a validação manual (Task 6, Step 3) e o commit do reviewer
- **Última tarefa concluída:** Task 6 (Steps 1, 2 e 4)
- **Próxima tarefa:** Task 6, Step 3 — validação manual na Biblioteca
- **Notas de retomada:**
  - Verificação em 2026-09-17: `npm.cmd test` 509/509 (55 arquivos); `typecheck` limpo; `verify:build` "manifest gerado OK, permissões mínimas"; Playwright 15/16 na suíte completa por flakiness de navegação em `acoes.spec.ts`, repetido isoladamente com 1/1.
  - Este plano foi executado no mesmo diff do plano `2026-09-17-ciclo-mineracao.md`; os dois compartilham `src/content/index.ts`, `src/resultados/App.tsx` e `tests/resultados-ui.test.tsx`. Commits separados exigem partir o diff na revisão.
  - `chrome.tabs.create`, `tabs.sendMessage` e `tabs.onUpdated` não exigem a permissão `tabs` (só `url`/`title` da aba exigem); o manifest segue `['storage']`.
  - `aplicarConfig` agora devolve Promise e `configPronta` guarda a primeira; o listener de `buscar-instagram` espera por ela antes de consultar. Ela resolve também quando a config falha — aí `buscarInstagram` desiste sozinha por falta de `doc_id`.
  - No `App`, `encontrado` não fica no mapa de estados: o perfil entra no próprio `resultado` em memória (depois de persistir), e `montarDestinos` transforma o item em link em todos os cards do anunciante.
  - O E2E cobre só a ausência de consulta automática; a resposta do runtime é simulada nos testes jsdom (não dá para sobrescrever `chrome.runtime.sendMessage` no contexto persistente sem criar endpoint de produção).
  - Revisão pós-implementação: a ponte consulta `chrome.tabs.get` depois de registrar `tabs.onUpdated`, cobrindo a corrida em que a aba já está completa. Regressão coberta em `tests/background.test.ts`.
  - O menu Links já é colapsável e usa `montarDestinos`. Instagram conhecido continua link; o item desconhecido agora é `Buscar Instagram`.

## Restrições globais

- Toda comunicação, documentação e mensagem de commit em pt-BR; identificadores em inglês.
- Permissões continuam exatamente ['storage']; não adicionar tabs, downloads, scripting ou host novo.
- Usar npm.cmd e npx.cmd no PowerShell.
- Nunca executar npm.cmd run gravar:fixtures.
- Teste antes da implementação: cada comportamento novo precisa de RED observado antes do GREEN.
- Nenhuma espera fixa em testes; usar vi.waitFor, expect.poll, auto-waiting do Playwright ou eventos reais.
- A consulta só começa após clique explícito em Buscar Instagram.
- A tela de resultados não pode fazer fetch para a Meta nem receber HTML, tokens ou respostas brutas.
- O credentials: 'omit' e o cache por anunciante de src/content/instagram.ts permanecem inalterados.

---

### Task 1: Criar o contrato puro e validar a origem da Biblioteca

**Arquivos:**

- Criar: src/core/instagram-ponte.ts
- Testar: tests/instagram-ponte.test.ts

**Interfaces produzidas:**

~~~ts
export interface BuscarInstagramMensagem {
  tipo: 'buscar-instagram'
  pageId: string
  origem: string
}

export type RespostaInstagram =
  | { ok: true; url: string | null }
  | {
      ok: false
      motivo: 'origem-invalida' | 'aba-indisponivel' | 'conteudo-indisponivel'
    }

export function origemBibliotecaValida(origem: string): boolean
export function ehBuscarInstagramMensagem(
  mensagem: unknown,
): mensagem is BuscarInstagramMensagem
~~~

- [x] **Step 1: Escrever os testes que falham**

Criar estes casos:

~~~ts
it('aceita somente a Biblioteca HTTPS da Meta', () => {
  expect(origemBibliotecaValida(
    'https://www.facebook.com/ads/library/?q=receitas',
  )).toBe(true)
  expect(origemBibliotecaValida(
    'https://facebook.com/ads/library/?q=receitas',
  )).toBe(true)
  expect(origemBibliotecaValida('http://www.facebook.com/ads/library/')).toBe(false)
  expect(origemBibliotecaValida('https://evil.test/ads/library/')).toBe(false)
  expect(origemBibliotecaValida('https://www.facebook.com/profile.php')).toBe(false)
})

it('rejeita pageId vazio e tipos desconhecidos', () => {
  expect(ehBuscarInstagramMensagem({
    tipo: 'buscar-instagram',
    pageId: '123',
    origem: 'https://www.facebook.com/ads/library/?q=x',
  })).toBe(true)
  expect(ehBuscarInstagramMensagem({
    tipo: 'buscar-instagram',
    pageId: '',
    origem: 'https://www.facebook.com/ads/library/?q=x',
  })).toBe(false)
  expect(ehBuscarInstagramMensagem({ tipo: 'outra' })).toBe(false)
})
~~~

- [x] **Step 2: Rodar o RED**

Rodar:

~~~powershell
npx.cmd vitest run tests/instagram-ponte.test.ts
~~~

Esperado: FAIL porque o módulo e as funções ainda não existem.

- [x] **Step 3: Implementar**

origemBibliotecaValida deve aceitar somente URL HTTPS cujo hostname seja facebook.com ou www.facebook.com e cujo pathname seja exatamente /ads/library/. Retornar false para URL inválida, pageId vazio, tipos desconhecidos e campos que não sejam strings.

- [x] **Step 4: Rodar o GREEN**

~~~powershell
npx.cmd vitest run tests/instagram-ponte.test.ts
npm.cmd run typecheck
~~~

Esperado: testes verdes e tipagem limpa.

- [x] **Step 5: Checkpoint**

Atualizar o bloco Progresso e preparar:

~~~text
✨ feat(core): definir contrato da ponte de Instagram
~~~

---

### Task 2: Intermediar a consulta no service worker

**Arquivos:**

- Modificar: src/background/index.ts
- Modificar: tests/background.test.ts

**Interfaces:**

- Consome: BuscarInstagramMensagem, RespostaInstagram, origemBibliotecaValida, chrome.tabs.create, chrome.tabs.onUpdated e chrome.tabs.sendMessage.
- Produz: listener privado para tipo buscar-instagram, mantendo os listeners existentes de abrir resultados e obter config.

- [x] **Step 1: Escrever os testes que falham**

Expandir o mock de tests/background.test.ts com tabs.create, tabs.sendMessage e tabs.onUpdated.addListener. Adicionar:

~~~ts
it('rejeita origem inválida sem abrir aba', async () => {
  await import('../src/background/index')
  const responder = vi.fn()

  const manterAberto = onMessage.listeners[0]({
    tipo: 'buscar-instagram',
    pageId: '123',
    origem: 'https://evil.test/ads/library/',
  }, {}, responder)

  expect(manterAberto).toBe(true)
  await vi.waitFor(() => expect(responder).toHaveBeenCalledWith({
    ok: false,
    motivo: 'origem-invalida',
  }))
  expect(criarAba).not.toHaveBeenCalled()
})

it('abre a Biblioteca em aba inativa e repassa o comando', async () => {
  criarAba.mockResolvedValue({ id: 41 })
  enviarParaAba.mockResolvedValue({ ok: true, url: null })
  await import('../src/background/index')

  const responder = vi.fn()
  const manterAberto = onMessage.listeners[0]({
    tipo: 'buscar-instagram',
    pageId: '123',
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
  }, {}, responder)

  expect(manterAberto).toBe(true)
  expect(criarAba).toHaveBeenCalledWith({
    url: 'https://www.facebook.com/ads/library/?q=receitas',
    active: false,
  })
  await vi.waitFor(() => expect(enviarParaAba).toHaveBeenCalledWith(
    41,
    { tipo: 'buscar-instagram', pageId: '123' },
  ))
  expect(responder).toHaveBeenCalledWith({ ok: true, url: null })
})
~~~

- [x] **Step 2: Rodar o RED**

~~~powershell
npx.cmd vitest run tests/background.test.ts
~~~

Esperado: FAIL porque o worker ainda ignora buscar-instagram.

- [x] **Step 3: Implementar**

No ramo de buscar-instagram:

1. validar a mensagem e a origem;
2. retornar origem-invalida sem abrir aba quando inválida;
3. executar chrome.tabs.create({ url: mensagem.origem, active: false });
4. aguardar status complete em chrome.tabs.onUpdated para o ID criado;
5. chamar chrome.tabs.sendMessage(aba.id, { tipo: 'buscar-instagram', pageId: mensagem.pageId });
6. repassar somente ok/url ou erro controlado;
7. mapear falha de criação para aba-indisponivel e falha de envio para conteudo-indisponivel;
8. retornar true para manter o canal assíncrono.

Remover o listener de tabs.onUpdated após o primeiro evento da aba. Não fechar a aba, não usar tabs.query e não adicionar permissão.

- [x] **Step 4: Rodar o GREEN**

~~~powershell
npx.cmd vitest run tests/background.test.ts tests/instagram-ponte.test.ts
npm.cmd run typecheck
~~~

- [x] **Step 5: Checkpoint**

~~~text
✨ feat(background): intermediar busca de Instagram na Biblioteca
~~~

---

### Task 3: Responder ao comando no content script

**Arquivos:**

- Criar: src/content/ponte-instagram.ts
- Modificar: src/content/index.ts
- Testar: tests/content/ponte-instagram.test.ts

**Interfaces produzidas:**

~~~ts
export interface DependenciasPonteInstagram {
  aguardarConfig: () => Promise<void>
  buscar: (pageId: string) => Promise<string | null>
}

export function atenderBuscaInstagram(
  mensagem: unknown,
  deps: DependenciasPonteInstagram,
): Promise<RespostaInstagram>
~~~

- [x] **Step 1: Escrever os testes que falham**

~~~ts
it('aguarda configuração antes de consultar', async () => {
  let liberar!: () => void
  const config = new Promise<void>((resolve) => { liberar = resolve })
  const buscar = vi.fn(async () => 'https://www.instagram.com/oficial')

  const resposta = atenderBuscaInstagram(
    { tipo: 'buscar-instagram', pageId: '123' },
    { aguardarConfig: () => config, buscar },
  )

  await Promise.resolve()
  expect(buscar).not.toHaveBeenCalled()
  liberar()

  await expect(resposta).resolves.toEqual({
    ok: true,
    url: 'https://www.instagram.com/oficial',
  })
})

it('representa ausência sem inventar URL', async () => {
  await expect(atenderBuscaInstagram(
    { tipo: 'buscar-instagram', pageId: '123' },
    { aguardarConfig: async () => {}, buscar: async () => null },
  )).resolves.toEqual({ ok: true, url: null })
})

it('converte falha de conteúdo em resposta controlada', async () => {
  await expect(atenderBuscaInstagram(
    { tipo: 'buscar-instagram', pageId: '123' },
    { aguardarConfig: async () => { throw new Error('config') }, buscar: vi.fn() },
  )).resolves.toEqual({
    ok: false,
    motivo: 'conteudo-indisponivel',
  })
})
~~~

- [x] **Step 2: Rodar o RED**

~~~powershell
npx.cmd vitest run tests/content/ponte-instagram.test.ts
~~~

- [x] **Step 3: Implementar e ligar ao content script**

atenderBuscaInstagram deve validar tipo/pageId, aguardar aguardarConfig, chamar buscar(pageId) e retornar ok/url. Nunca incluir HTML, token, resposta bruta ou mensagem de exceção.

Fazer aplicarConfig retornar Promise<void>, guardar essa Promise em configPronta e instalar no content script:

~~~ts
chrome.runtime.onMessage.addListener((mensagem, _remetente, responder) => {
  if (mensagem?.tipo !== 'buscar-instagram') return false

  void atenderBuscaInstagram(mensagem, {
    aguardarConfig: () => configPronta,
    buscar: (pageId) => buscarInstagram(pageId, {
      buscar: (...args) => fetch(...args),
      html: () => document.documentElement.innerHTML,
    }),
  }).then(responder)

  return true
})
~~~

Não misturar esta mensagem com window.postMessage.

- [x] **Step 4: Rodar o GREEN**

~~~powershell
npx.cmd vitest run tests/content/ponte-instagram.test.ts tests/instagram.test.ts
npm.cmd run typecheck
~~~

- [x] **Step 5: Checkpoint**

~~~text
✨ feat(content): atender busca de Instagram por mensagem privada
~~~

---

### Task 4: Persistir o perfil encontrado

**Arquivos:**

- Modificar: src/storage/resultados.ts
- Testar: tests/resultados-storage.test.ts

**Interface produzida:**

~~~ts
export function atualizarInstagramResultado(
  pageId: string,
  instagram: string,
  storage?: StorageLocal,
): Promise<boolean>
~~~

- [x] **Step 1: Escrever os testes que falham**

Cobrir:

~~~ts
it('atualiza todos os anúncios do anunciante e preserva campos', async () => {
  const resultado = resultadoDeTeste({
    anuncios: [
      anuncio({ id: 'a1', anunciante: { pageId: 'p1', pageName: 'Página 1' } }),
      anuncio({ id: 'a2', anunciante: { pageId: 'p1', pageName: 'Página 1' } }),
      anuncio({ id: 'b1', anunciante: { pageId: 'p2', pageName: 'Página 2' } }),
    ],
  })
  const storage = mapaStorage(resultado)

  await expect(atualizarInstagramResultado(
    'p1',
    'https://www.instagram.com/oficial',
    storage,
  )).resolves.toBe(true)

  const atualizado = await carregarResultado(storage)
  expect(atualizado?.anuncios[0].anunciante.instagram).toBe(
    'https://www.instagram.com/oficial',
  )
  expect(atualizado?.anuncios[1].anunciante.instagram).toBe(
    'https://www.instagram.com/oficial',
  )
  expect(atualizado?.anuncios[2].anunciante.instagram).toBeUndefined()
  expect(atualizado?.anuncios[0].texto).toBe(resultado.anuncios[0].texto)
})

it('não cria resultado quando storage está vazio ou pageId não existe', async () => {
  expect(await atualizarInstagramResultado(
    'p1',
    'https://www.instagram.com/oficial',
    mapaStorage(null),
  )).toBe(false)
})
~~~

- [x] **Step 2: Rodar o RED**

~~~powershell
npx.cmd vitest run tests/resultados-storage.test.ts
~~~

- [x] **Step 3: Implementar fila local**

Serializar atualizações com uma Promise de módulo. Cada operação deve carregar o snapshot atual, retornar false sem snapshot ou sem pageId correspondente, mapear somente os anúncios daquele anunciante, preservar os demais campos e chamar salvarResultado. Rejeições de storage devem subir para que a UI exiba falha; não criar snapshot novo.

- [x] **Step 4: Rodar o GREEN**

~~~powershell
npx.cmd vitest run tests/resultados-storage.test.ts
npm.cmd run typecheck
~~~

- [x] **Step 5: Checkpoint**

~~~text
✨ feat(storage): persistir Instagram encontrado nos resultados
~~~

---

### Task 5: Transformar o item Instagram do menu em ação explícita

**Arquivos:**

- Modificar: src/resultados/LinksMenu.tsx
- Modificar: src/resultados/App.tsx
- Modificar: src/resultados/CartaoResultado.tsx somente para repassar props
- Modificar: tests/resultados-ui.test.tsx

**Interface de UI:**

~~~ts
type EstadoInstagram =
  | 'desconhecido'
  | 'buscando'
  | 'encontrado'
  | 'ausente'
  | 'falha'
~~~

- [x] **Step 1: Escrever os testes que falham**

Substituir o teste que espera Abrir na Biblioteca por:

~~~ts
it('oferece Buscar Instagram somente por ação explícita', async () => {
  const resultado = resultadoComTresAnuncios()
  for (const anuncio of resultado.anuncios) anuncio.anunciante.instagram = undefined
  const enviar = vi.fn()
  vi.stubGlobal('chrome', { runtime: { sendMessage: enviar } })

  renderizarComStorage(resultado)
  await aguardarCards()
  clicar('[data-acao="links"]')

  const instagram = document.querySelector<HTMLButtonElement>(
    '[data-link-chave="instagram"]',
  )!
  expect(instagram.disabled).toBe(false)
  expect(instagram.textContent).toContain('Buscar Instagram')
  expect(enviar).not.toHaveBeenCalled()
})

it('mostra o perfil encontrado e compartilha consulta pelo anunciante', async () => {
  const resultado = resultadoComTresAnuncios()
  for (const anuncio of resultado.anuncios) anuncio.anunciante.instagram = undefined
  const enviar = vi.fn((_mensagem: unknown, responder: (resposta: unknown) => void) => {
    responder({ ok: true, url: 'https://www.instagram.com/oficial' })
  })
  vi.stubGlobal('chrome', { runtime: { sendMessage: enviar } })

  renderizarComStorage(resultado)
  await aguardarCards()
  act(() => document.querySelector<HTMLButtonElement>('[data-acao="links"]')?.click())
  await act(async () => {
    document.querySelector<HTMLButtonElement>('[data-link-chave="instagram"]')?.click()
  })

  await vi.waitFor(() => expect(enviar).toHaveBeenCalledTimes(1))
  expect(document.body.textContent).toContain('Instagram do anunciante')
})
~~~

Adicionar casos para buscando, ausente e falha, verificando texto e disabled.

- [x] **Step 2: Rodar o RED**

~~~powershell
npx.cmd vitest run tests/resultados-ui.test.tsx
~~~

Esperado: FAIL porque o item ainda é desabilitado e App não possui callback.

- [x] **Step 3: Implementar estado e deduplicação no App**

Manter um mapa de estado por pageId e um mapa de Promises pendentes por pageId. Ao primeiro clique, marcar buscando e chamar chrome.runtime.sendMessage com:

~~~ts
{
  tipo: 'buscar-instagram',
  pageId,
  origem: resultado.origem,
}
~~~

Se já houver Promise pendente para o mesmo pageId, reutilizá-la. Resposta ok/url atualiza todos os cards do anunciante; ok/null mostra ausência; ok false mostra falha. Em caso de URL, chamar atualizarInstagramResultado antes de marcar encontrado.

Resolver chrome.runtime.lastError como conteudo-indisponivel. Não usar fetch em App, LinksMenu ou CartaoResultado.

- [x] **Step 4: Implementar o LinksMenu**

Quando o destino instagram não tiver URL:

- desconhecido: botão habilitado com Buscar Instagram;
- buscando: disabled com Buscando Instagram…;
- ausente: disabled com Instagram não encontrado;
- falha: disabled com Não foi possível buscar Instagram.

Ao encontrar URL, renderizar o link externo de montarDestinos. Não fechar o menu durante a busca e manter os outros cinco destinos, ordem, fechamento externo, target e rel atuais.

- [x] **Step 5: Rodar o GREEN**

~~~powershell
npx.cmd vitest run tests/resultados-ui.test.tsx tests/resultados-storage.test.ts
npm.cmd run typecheck
~~~

- [x] **Step 6: Checkpoint**

~~~text
✨ feat(ui): buscar Instagram pelo menu de resultados
~~~

---

### Task 6: Verificar navegador, integração e permissões

**Arquivos:**

- Modificar: e2e/resultados.spec.ts
- Modificar: docs/superpowers/plans/2026-09-17-instagram-resultados.md

- [x] **Step 1: Cobrir a ausência de consulta automática**

No E2E, salvar snapshot com Instagram desconhecido, abrir Links e confirmar Buscar Instagram. Verificar que abrir o menu não gera fetch nem navegação para a Meta. A simulação da resposta do runtime deve ficar nos testes jsdom se a API do Chrome não puder ser sobrescrita no contexto persistente; não criar endpoint de produção somente para satisfazer o E2E.

- [x] **Step 2: Rodar a suíte**

~~~powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git status --short
~~~

Esperado: suíte verde, manifest gerado OK, permissões exatamente ['storage'] e nenhuma alteração inesperada.

- [ ] **Step 3: Validar manualmente**

1. abrir resultados com card sem Instagram;
2. abrir Links e confirmar que nada ocorre;
3. clicar Buscar Instagram;
4. confirmar uma aba da Biblioteca em segundo plano;
5. confirmar Buscando Instagram…;
6. validar a resposta real na Biblioteca;
7. confirmar o link encontrado nos resultados;
8. recarregar resultados e confirmar persistência;
9. repetir em dois cards do mesmo anunciante e confirmar uma única consulta.

Não declarar sucesso se a página de resultados fizer fetch, se origem inválida abrir aba ou se HTML/token sair do content script.

- [x] **Step 4: Checkpoint final**

Atualizar Progresso com números reais e preparar:

~~~text
✨ feat(ui): integrar busca explícita de Instagram nos resultados

O que foi feito:
- Buscar Instagram pelo menu Links da tela de resultados
- Encaminhar a consulta pela Biblioteca sem requisição automática
- Persistir o perfil encontrado em todos os cards do anunciante

Considerações:
- Ausência não cria URL falsa
- Nenhuma permissão nova foi adicionada
~~~

## Critério de conclusão

O plano só está concluído quando Instagram desconhecido consulta somente após clique, consultas concorrentes do mesmo pageId são deduplicadas, origem inválida não abre aba, o content script aguarda a configuração, o perfil encontrado é persistido sem perder o snapshot, a página não faz fetch para a Meta e todos os comandos de verificação passam.
