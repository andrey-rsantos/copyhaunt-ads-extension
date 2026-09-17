# Ciclo da mineração e resultados parciais — Plano de implementação

> **Para agentes:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam checkboxes (`- [ ]`) para acompanhamento.

**Objetivo:** Permitir pausar, retomar, interromper e iniciar novamente a mineração, persistindo e exibindo resultados parciais com estado honesto.

**Arquitetura:** O motor ganha a transição terminal `interrompida` e recebe uma fronteira de IDs já processados. O content script passa a controlar uma sessão por `PedidoMineracao`, salvando parciais em pausa/interrupção e criando um `Minerador` novo ao repetir. O snapshot continua único; a tela de resultados apenas comunica o estado persistido.

**Tech Stack:** TypeScript 7, Vitest 5 com jsdom, React 19, Playwright, `chrome.storage.local`, Vite/CRXJS.

**Spec:** `docs/superpowers/specs/2026-09-17-ciclo-mineracao-design.md`

## Progresso

- **Estado:** não iniciado
- **Última tarefa concluída:** —
- **Próxima tarefa:** Task 1
- **Notas de retomada:** A tela de resultados já está implementada e o snapshot usa a chave `copyhaunt:resultado:v1`. Não reabrir o plano anterior de resultados; esta evolução tem checkpoints próprios.

## Restrições globais

- Toda comunicação, documentação e mensagem de commit em pt-BR; identificadores em inglês.
- Permissões continuam exatamente `['storage']`; não adicionar `tabs`, `downloads`, `scripting` ou host novo.
- Usar `npm.cmd` e `npx.cmd` no PowerShell.
- Nunca executar `npm.cmd run gravar:fixtures`.
- Teste antes da implementação: cada comportamento novo precisa de RED observado antes do GREEN.
- Nenhuma espera fixa em testes; usar `vi.waitFor`, `expect.poll`, auto-waiting do Playwright ou eventos reais.
- O resultado é substituído pelo snapshot mais recente; não criar histórico.
- Pausa e interrupção salvam aprovados parciais sem executar o pós-filtro de Instagram.

---

### Task 1: Tornar o motor interrompível e reiniciável

**Arquivos:**

- Modificar: `src/core/miner.ts`
- Testar: `tests/miner.test.ts`

**Interfaces:**

- Consome: `AdStore`, `Criterios`, `Relogio` e o loop reativo atual.
- Produz: `EstadoMineracao` com `'interrompida'`, `Minerador.interromper()` e a opção `idsAvaliadosInicialmente?: Iterable<string>`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar ao conjunto `describe('Minerador')`:

```ts
it('interrompe a sessão e não permite retomada', async () => {
  const { relogio, rolar, minerador } = montar({ maxRolagens: 10 })
  const trabalho = minerador.iniciar()

  await relogio.avancar(1000)
  minerador.interromper()
  await trabalho

  expect(minerador.progresso().estado).toBe('interrompida')
  expect(rolar).toHaveBeenCalledTimes(1)

  const novaTentativa = minerador.iniciar()
  await novaTentativa
  expect(minerador.progresso().estado).toBe('interrompida')
  expect(rolar).toHaveBeenCalledTimes(1)
})

it('interrompe uma mineração já pausada', async () => {
  const { relogio, minerador } = montar({ maxRolagens: 10 })
  const trabalho = minerador.iniciar()

  await relogio.avancar(1000)
  minerador.parar()
  await trabalho
  expect(minerador.progresso().estado).toBe('pausado')

  minerador.interromper()
  expect(minerador.progresso().estado).toBe('interrompida')
})

it('começa uma sessão ignorando IDs já processados', async () => {
  const { store, relogio, minerador } = montar({
    maxRolagens: 1,
    idsAvaliadosInicialmente: ['antigo'],
  })
  store.adicionar([ad('antigo', 5), ad('novo', 5)])

  const trabalho = minerador.iniciar()
  await avancarCiclo(relogio, minerador)
  await trabalho

  expect(minerador.progresso().analisados).toBe(1)
  expect(minerador.encontrados().map((item) => item.id)).toEqual(['novo'])
})
```

Alterar o helper `montar` para aceitar `Partial<OpcoesMineracao>` já cobre a nova opção sem criar um segundo construtor de teste.

- [ ] **Step 2: Rodar os testes e confirmar o RED**

Rodar:

```powershell
npx.cmd vitest run tests/miner.test.ts
```

Esperado: falha por `interromper`/`interrompida` ausentes e pelo ID inicial ainda ser avaliado.

- [ ] **Step 3: Implementar o contrato mínimo**

Em `src/core/miner.ts`:

1. incluir `'interrompida'` na união `EstadoMineracao`;
2. adicionar `idsAvaliadosInicialmente?: Iterable<string>` a `OpcoesMineracao`;
3. inicializar `avaliados` no construtor com esses IDs;
4. implementar:

```ts
interromper(): void {
  if (this.estado === 'minerando' || this.estado === 'pausado') {
    this.estado = 'interrompida'
    this.opcoes.aoProgredir?.(this.progresso())
  }
}
```

5. fazer `iniciar()` devolver uma Promise resolvida sem alterar o estado quando o motor já estiver em estado terminal (`interrompida`, `concluido`, `esgotado`, `incompreensivel` ou `limite-seguranca`);
6. manter `parar()` exclusivamente como transição para `pausado`;
7. deixar o `while (this.estado === 'minerando')` encerrar naturalmente e emitir `aoProgredir` com `interrompida` quando `interromper()` for chamado durante um ciclo.

Não resetar `avaliados`, `aprovados` ou `rolagens` ao chamar `iniciar()` depois de uma pausa: retomar continua sendo a mesma sessão.

- [ ] **Step 4: Rodar os testes e confirmar o GREEN**

Rodar:

```powershell
npx.cmd vitest run tests/miner.test.ts
```

Esperado: todos os testes existentes e os três novos passam.

- [ ] **Step 5: Atualizar estado e checkpoint**

Atualizar o bloco `Progresso` para Task 1 e registrar:

```text
✨ feat(miner): permitir interromper e repetir sessões
```

Se executor e reviewer forem agentes distintos, escrever essa mensagem em `.commit-msg-codex`; caso contrário, o reviewer deve fazer o commit após conferir o diff.

---

### Task 2: Aceitar o estado interrompido no contrato de resultados

**Arquivos:**

- Modificar: `src/core/resultados.ts`
- Testar: `tests/resultados.test.ts`

**Interfaces:**

- Consome: `EstadoMineracao` e o codec versionado existente.
- Produz: `rotuloDoResultado(estado: EstadoMineracao): string` e hidratação de snapshots `interrompida`.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar:

```ts
it('serializa e hidrata um snapshot interrompido', () => {
  const resultado = resultadoDeTeste({ estado: 'interrompida' })
  const hidratado = hidratarResultado(serializarResultado(resultado))

  expect(hidratado?.estado).toBe('interrompida')
  expect(hidratado?.anuncios).toHaveLength(resultado.anuncios.length)
})

it('traduz estados do snapshot para o cabeçalho', () => {
  expect(rotuloDoResultado('pausado')).toBe('Resultados parciais — mineração pausada')
  expect(rotuloDoResultado('interrompida')).toBe(
    'Resultados parciais — mineração interrompida',
  )
  expect(rotuloDoResultado('concluido')).toBe('Mineração concluída')
  expect(rotuloDoResultado('esgotado')).toBe('Fim dos resultados')
})
```

O helper `resultadoDeTeste` deve aceitar `Partial<ResultadoLocal>` e partir de um resultado válido já usado no arquivo.

- [ ] **Step 2: Rodar e confirmar o RED**

Rodar:

```powershell
npx.cmd vitest run tests/resultados.test.ts
```

Esperado: falha porque o conjunto de estados rejeita `interrompida` e o rótulo ainda não existe.

- [ ] **Step 3: Implementar**

Incluir `'interrompida'` no `ESTADOS` e exportar:

```ts
export function rotuloDoResultado(estado: EstadoMineracao): string {
  if (estado === 'pausado') return 'Resultados parciais — mineração pausada'
  if (estado === 'interrompida') {
    return 'Resultados parciais — mineração interrompida'
  }
  if (estado === 'concluido') return 'Mineração concluída'
  if (estado === 'esgotado') return 'Fim dos resultados'
  return 'Mineração encerrada'
}
```

O codec não deve alterar a versão nem aceitar estados desconhecidos.

- [ ] **Step 4: Rodar e confirmar o GREEN**

Rodar:

```powershell
npx.cmd vitest run tests/resultados.test.ts
npm.cmd run typecheck
```

Esperado: testes verdes e tipagem sem erros.

- [ ] **Step 5: Atualizar estado e checkpoint**

Atualizar o bloco `Progresso` e preparar:

```text
✨ feat(core): reconhecer resultados parciais interrompidos
```

---

### Task 3: Persistir parciais sem executar o pós-filtro

**Arquivos:**

- Modificar: `src/content/resultados.ts`
- Testar: `tests/content/resultados.test.ts`

**Interfaces:**

- Consome: `salvarResultado`, `Progresso` e `Ad`.
- Produz:

```ts
export interface DependenciasParcial {
  salvar?: DependenciasFinalizacao['salvar']
  agora?: () => Date
}

export function salvarResultadoParcial(
  progresso: Progresso,
  aprovados: Ad[],
  origem: string,
  deps?: DependenciasParcial,
): Promise<boolean>
```

- [ ] **Step 1: Escrever os testes que falham**

Adicionar:

```ts
it('salva os aprovados atuais quando a sessão está pausada', async () => {
  const salvar = vi.fn(async () => {})
  const parcial = ad()

  const salvo = await salvarResultadoParcial(
    { estado: 'pausado', analisados: 4, encontrados: 1, rolagens: 2 },
    [parcial],
    'https://www.facebook.com/ads/library/?q=receitas',
    { salvar },
  )

  expect(salvo).toBe(true)
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({
    estado: 'pausado',
    anuncios: [parcial],
  }))
})

it('salva uma interrupção sem chamar filtro ou liberar ação', async () => {
  const salvar = vi.fn(async () => {})
  const trabalho = await salvarResultadoParcial(
    { estado: 'interrompida', analisados: 4, encontrados: 1, rolagens: 2 },
    [ad()],
    'https://www.facebook.com/ads/library/?q=receitas',
    { salvar },
  )

  expect(trabalho).toBe(true)
  expect(salvar).toHaveBeenCalledTimes(1)
})

it('não salva parcial para estado que não seja pausado ou interrompido', async () => {
  const salvar = vi.fn(async () => {})
  const salvo = await salvarResultadoParcial(
    { estado: 'concluido', analisados: 1, encontrados: 1, rolagens: 1 },
    [ad()],
    'https://exemplo.test',
    { salvar },
  )

  expect(salvo).toBe(false)
  expect(salvar).not.toHaveBeenCalled()
})

it('finalização normal continua bloqueada para estados parciais', async () => {
  const salvar = vi.fn(async () => {})

  await finalizarResultado(
    { estado: 'interrompida', analisados: 1, encontrados: 1, rolagens: 1 },
    [ad()],
    'https://exemplo.test',
    { salvar },
  )

  expect(salvar).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Rodar e confirmar o RED**

Rodar:

```powershell
npx.cmd vitest run tests/content/resultados.test.ts
```

Esperado: falha porque `salvarResultadoParcial` não existe e `finalizarResultado` ainda não conhece `interrompida`.

- [ ] **Step 3: Implementar**

Criar `salvarResultadoParcial` com a guarda explícita:

```ts
const estadosParciais = new Set<Progresso['estado']>([
  'pausado',
  'interrompida',
])
```

Quando a guarda passar, chamar `deps.salvar ?? salvarResultado` com `salvoEm` vindo de `deps.agora?.() ?? new Date()`, retornar `true` após o `await` e retornar `false` se a gravação rejeitar. Não chamar `filtrar`, `liberar` ou qualquer consulta de Instagram. Atualizar a guarda de `finalizarResultado` para retornar `null` nos dois estados parciais.

- [ ] **Step 4: Rodar e confirmar o GREEN**

Rodar:

```powershell
npx.cmd vitest run tests/content/resultados.test.ts
npm.cmd run typecheck
```

Esperado: testes verdes e sem erro de tipagem.

- [ ] **Step 5: Atualizar estado e checkpoint**

Registrar:

```text
✨ feat(content): persistir resultados parciais da mineração
```

---

### Task 4: Expor as ações no cartão de progresso

**Arquivos:**

- Modificar: `src/content/progresso.ts`
- Modificar: `tests/content/progresso.test.ts`

**Interfaces:**

- Consome: `EstadoMineracao`, `Progresso` e callbacks de sessão.
- Produz:

```ts
export interface AcoesProgresso {
  aoAlternarPausa: () => void
  aoAbrirResultados: () => void
  aoParar: () => void
  aoMinerarNovamente: () => void
}

export function montarProgresso(
  doc: Document,
  acoes: AcoesProgresso,
): HTMLElement
```

Manter `liberarResultados(cartao)` como operação que revela e habilita o botão de resultados.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar:

```ts
it('mostra parar e resultados somente depois de uma pausa', () => {
  const acoes = {
    aoAlternarPausa: vi.fn(),
    aoAbrirResultados: vi.fn(),
    aoParar: vi.fn(),
    aoMinerarNovamente: vi.fn(),
  }
  const cartao = montarProgresso(document, acoes)

  atualizarProgresso(cartao, progresso({ estado: 'pausado' }), 100)

  expect(cartao.querySelector('[data-acao="parar"]')?.hidden).toBe(false)
  expect(cartao.querySelector('[data-acao="resultados"]')?.hidden).toBe(false)
  expect(cartao.querySelector('[data-acao="resultados"]')?.hasAttribute('disabled')).toBe(true)
  expect(cartao.querySelector('[data-acao="repetir"]')?.hidden).toBe(true)
})

it('mostra resultados e minerar novamente após interrupção', () => {
  const cartao = montarProgresso(document, {
    aoAlternarPausa: vi.fn(),
    aoAbrirResultados: vi.fn(),
    aoParar: vi.fn(),
    aoMinerarNovamente: vi.fn(),
  })

  atualizarProgresso(cartao, progresso({ estado: 'interrompida' }), 100)

  expect(cartao.querySelector('[data-acao="resultados"]')?.hidden).toBe(false)
  expect(cartao.querySelector('[data-acao="repetir"]')?.hidden).toBe(false)
  expect(cartao.querySelector('[data-acao="parar"]')?.hidden).toBe(true)
})

it('dispara parar e repetir pelos callbacks corretos', () => {
  const aoParar = vi.fn()
  const aoMinerarNovamente = vi.fn()
  const cartao = montarProgresso(document, {
    aoAlternarPausa: vi.fn(),
    aoAbrirResultados: vi.fn(),
    aoParar,
    aoMinerarNovamente,
  })

  cartao.querySelector<HTMLButtonElement>('[data-acao="parar"]')?.click()
  cartao.querySelector<HTMLButtonElement>('[data-acao="repetir"]')?.click()

  expect(aoParar).toHaveBeenCalledTimes(1)
  expect(aoMinerarNovamente).toHaveBeenCalledTimes(1)
})
```

Atualizar os testes existentes que chamam `montarProgresso(document, vi.fn())` para usar `AcoesProgresso`.

- [ ] **Step 2: Rodar e confirmar o RED**

Rodar:

```powershell
npx.cmd vitest run tests/content/progresso.test.ts
```

Esperado: falha porque a assinatura e os botões novos ainda não existem.

- [ ] **Step 3: Implementar**

Criar os botões `data-acao="parar"` com texto `Parar mineração` e `data-acao="repetir"` com texto `Minerar novamente`, inicialmente escondidos. O botão de resultados continua inicialmente escondido e desabilitado.

Em `atualizarProgresso`:

- `minerando`: mostrar apenas `Pausar`;
- `pausado`: manter `Retomar`, mostrar `parar` e revelar `resultados` ainda desabilitado;
- `interrompida` e terminais normais: esconder `Pausar` e `parar`, mostrar `resultados` e `repetir`;
- manter os contadores, a barra e o texto dos estados existentes.

Os listeners devem impedir propagação e chamar somente o callback correspondente. `liberarResultados` passa a remover `disabled` sem mudar a visibilidade definida pelo estado.

- [ ] **Step 4: Rodar e confirmar o GREEN**

Rodar:

```powershell
npx.cmd vitest run tests/content/progresso.test.ts
npm.cmd run typecheck
```

Esperado: todos os testes do cartão passam.

- [ ] **Step 5: Atualizar estado e checkpoint**

Registrar:

```text
✨ feat(ui): expor ações do ciclo de mineração
```

---

### Task 5: Conectar o controlador de sessão da Biblioteca

**Arquivos:**

- Criar: `src/content/controle-mineracao.ts`
- Modificar: `src/content/index.ts`
- Modificar: `src/content/resultados.ts` apenas para reutilizar a operação parcial
- Testar: `tests/content/controle-mineracao.test.ts`, `tests/content-mineracao.test.ts`

**Interfaces:**

- Consome: `Minerador.interromper`, `salvarResultadoParcial` e `AcoesProgresso`.
- Produz: `criarControleMineracao`, com `pausar`, `retomar`, `interromper`, `estado` e `resultadosDisponiveis`; o controlador de `index.ts` usará esse contrato para uma sessão por `PedidoMineracao`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/content/controle-mineracao.test.ts`. O helper abaixo cria um motor falso com o contrato consumido pelo controle, sem relógio real nem DOM:

```ts
function montarMotorFalso(aprovados: Ad[]) {
  let estado: Progresso['estado'] = 'minerando'
  const motor = {
    progresso: vi.fn(() => ({
      estado,
      analisados: aprovados.length,
      encontrados: aprovados.length,
      rolagens: 1,
    })),
    encontrados: vi.fn(() => aprovados),
    parar: vi.fn(() => { estado = 'pausado' }),
    interromper: vi.fn(() => { estado = 'interrompida' }),
    iniciar: vi.fn(async () => { estado = 'minerando' }),
  }
  return { motor, estadoAtual: () => estado }
}

it('salva a parcial ao pausar e só libera resultados depois da gravação', async () => {
  const salvar = vi.fn(async () => {})
  const falso = montarMotorFalso([ad('a1')])
  const sessao = criarControleMineracao({
    motor: falso.motor as unknown as Minerador,
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    salvarParcial: salvar,
  })

  await sessao.pausar()

  expect(falso.estadoAtual()).toBe('pausado')
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({
    estado: 'pausado',
    anuncios: [expect.objectContaining({ id: 'a1' })],
  }))
  expect(sessao.resultadosDisponiveis()).toBe(true)
})

it('interrompe, salva parcial e não permite retomar', async () => {
  const salvar = vi.fn(async () => {})
  const falso = montarMotorFalso([ad('a1')])
  falso.motor.parar()
  const sessao = criarControleMineracao({
    motor: falso.motor as unknown as Minerador,
    origem: 'https://www.facebook.com/ads/library/?q=receitas',
    salvarParcial: salvar,
  })

  await sessao.interromper()
  expect(falso.estadoAtual()).toBe('interrompida')
  expect(salvar).toHaveBeenCalledWith(expect.objectContaining({
    estado: 'interrompida',
  }))
  expect(sessao.estado()).toBe('interrompida')
})
```

O teste de criação de nova sessão deve ficar em `tests/content-mineracao.test.ts` e verificar diretamente que `iniciarMineracao` passa `store.todos().map((anuncio) => anuncio.id)` ao novo `criarMinerador`.

- [ ] **Step 2: Rodar e confirmar o RED**

Rodar:

```powershell
npx.cmd vitest run tests/content-mineracao.test.ts tests/content/resultados.test.ts
```

Esperado: falha porque `src/content/controle-mineracao.ts` e `criarControleMineracao` ainda não existem, além da falha de integração na passagem dos IDs iniciais.

- [ ] **Step 3: Implementar o controlador**

Criar em `src/content/controle-mineracao.ts`:

```ts
export interface DependenciasControle {
  motor: Minerador
  origem: string
  salvarParcial: (resultado: {
    origem: string
    estado: Progresso['estado']
    salvoEm: Date
    anuncios: Ad[]
  }) => Promise<void>
  agora?: () => Date
}

export interface ControleMineracao {
  pausar(): Promise<boolean>
  retomar(): Promise<void>
  interromper(): Promise<boolean>
  estado(): Progresso['estado']
  resultadosDisponiveis(): boolean
}

export function criarControleMineracao(
  deps: DependenciasControle,
): ControleMineracao
```

O controle deve chamar `motor.parar()` em `pausar`, salvar com `motor.progresso()` e `motor.encontrados()` somente depois de o estado virar `pausado`, e marcar resultados disponíveis apenas se o salvamento resolver. `retomar` deve chamar `motor.iniciar()` somente quando o estado for `pausado`. `interromper` deve chamar `motor.interromper()` a partir de `minerando` ou `pausado`, salvar somente depois de o estado virar `interrompida` e nunca tornar a sessão retomável.

O objeto de dependências usa a função de persistência no formato da operação de storage já existente. Para manter o módulo puro e testável, `index.ts` adapta `salvarResultadoParcial` ao callback antes de construir o controle.

No estado do módulo de `src/content/index.ts`:

```ts
let pedidoAtual: PedidoMineracao | null = null
let motorAtual: Minerador | null = null
```

Alterar `criarMinerador` para aceitar `idsAvaliadosInicialmente: Iterable<string> = []` e repassar a opção ao construtor.

Alterar `iniciarMineracao(pedido)` para:

1. se houver motor em `minerando` ou `pausado`, reutilizá-lo apenas para retomar a sessão atual;
2. se o motor for `null` ou estiver em estado terminal, criar nova instância;
3. na nova instância, passar `store.todos().map((anuncio) => anuncio.id)` como IDs iniciais;
4. guardar uma cópia de `pedidoAtual`;
5. iniciar uma única vez o motor, sem as duas chamadas concorrentes existentes.

No callback de pausa, criar `criarControleMineracao` com `salvarResultadoParcial`, chamar `controle.pausar()` e, se resolver, chamar `liberarResultados(cartao)`. Se a gravação rejeitar, manter o botão de resultados desabilitado.

No callback de parada, chamar `controle.interromper()`; não executar `filtrarPorInstagram`. Depois da gravação, liberar resultados e atualizar o cartão.

No callback de repetir, usar `pedidoAtual` para criar uma nova sessão, substituir o cartão de progresso no mesmo shadow root e preservar o overlay/store.

O fluxo que aguarda `motor.iniciar()` deve continuar chamando `finalizarResultado` somente para estados normais. Ao finalizar, mostrar `Ver resultados` e `Minerar novamente`. Ao pausar, não logar “mineração encerrada”; ao interromper, registrar que a sessão terminou com parcial.

- [ ] **Step 4: Rodar e confirmar o GREEN**

Rodar:

```powershell
npx.cmd vitest run tests/content-mineracao.test.ts tests/content/resultados.test.ts tests/content/progresso.test.ts
npm.cmd run typecheck
```

Esperado: fluxo de sessão verde e typecheck sem erros.

- [ ] **Step 5: Atualizar estado e checkpoint**

Registrar:

```text
✨ feat(content): controlar pausa interrupção e nova mineração
```

---

### Task 6: Comunicar o estado na página de resultados

**Arquivos:**

- Modificar: `src/resultados/App.tsx`
- Testar: `tests/resultados-ui.test.tsx`

**Interfaces:**

- Consome: `rotuloDoResultado` e `ResultadoLocal.estado`.
- Produz: cabeçalho com `data-testid="resultado-estado"` e texto correto para snapshots parciais e finais.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar:

```ts
it.each([
  ['pausado', 'Resultados parciais — mineração pausada'],
  ['interrompida', 'Resultados parciais — mineração interrompida'],
  ['concluido', 'Mineração concluída'],
  ['esgotado', 'Fim dos resultados'],
] as const)('exibe o estado %s no cabeçalho', async (estado, rotulo) => {
  renderizarComStorage({
    ...resultadoComTresAnuncios(),
    estado,
  })

  await aguardarCards()
  expect(document.querySelector('[data-testid="resultado-estado"]')?.textContent).toBe(rotulo)
})
```

- [ ] **Step 2: Rodar e confirmar o RED**

Rodar:

```powershell
npx.cmd vitest run tests/resultados-ui.test.tsx
```

Esperado: falha porque o cabeçalho ainda não renderiza o estado.

- [ ] **Step 3: Implementar**

Importar `rotuloDoResultado` em `App.tsx` e renderizar no resumo:

```tsx
<strong data-testid="resultado-estado">
  {rotuloDoResultado(resultado.estado)}
</strong>
```

Manter a quantidade de aprovados, origem, data, ordenação, cards e Links sem alteração comportamental.

- [ ] **Step 4: Rodar e confirmar o GREEN**

Rodar:

```powershell
npx.cmd vitest run tests/resultados-ui.test.tsx
npm.cmd run typecheck
```

Esperado: testes verdes e layout tipado.

- [ ] **Step 5: Atualizar estado e checkpoint**

Registrar:

```text
✨ feat(ui): comunicar estado dos resultados parciais
```

---

### Task 7: Verificação completa e fechamento

**Arquivos:**

- Modificar: `docs/superpowers/plans/2026-09-17-ciclo-mineracao.md`

- [ ] **Step 1: Rodar a suíte completa**

Rodar nesta ordem:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
git status --short
```

Esperado: todos os testes passam, `manifest gerado OK`, E2E verde e somente alterações deste plano aparecem no status.

- [ ] **Step 2: Conferir manualmente os fluxos**

Na Biblioteca:

1. iniciar uma mineração;
2. clicar `Pausar`;
3. confirmar `Retomar`, `Ver resultados` e `Parar mineração`;
4. abrir resultados e verificar `Resultados parciais — mineração pausada`;
5. voltar à Biblioteca, retomar e depois clicar `Parar mineração`;
6. confirmar `Resultados parciais — mineração interrompida`;
7. clicar `Minerar novamente` e confirmar que o contador começa numa nova sessão, sem apagar o overlay.

Não declarar sucesso se a gravação do parcial ainda estiver pendente ou se o estado exibido disser “concluída” para uma parcial.

- [ ] **Step 3: Atualizar o bloco Progresso**

Marcar cada Task somente após sua verificação correspondente passar, registrar os números reais de testes e anotar divergências descobertas no teste manual.

- [ ] **Step 4: Preparar o checkpoint final**

Mensagem:

```text
✨ feat(miner): completar ciclo com parciais e nova mineração

O que foi feito:
- Permitir pausar, retomar, interromper e repetir a mineração
- Persistir resultados parciais com estado explícito
- Comunicar o estado do snapshot na página de resultados

Considerações:
- O snapshot continua único e não há histórico
- Parciais não executam o pós-filtro de Instagram
```

## Critério de conclusão

O plano só está concluído quando:

- pausa salva parcial e libera `Ver resultados` depois da gravação;
- parada salva parcial como `interrompida` e não permite retomar;
- nova mineração cria motor novo e ignora IDs presentes no store;
- finalização normal mantém o pós-filtro antes da gravação;
- a página distingue pausada, interrompida e estados terminais;
- `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run verify:build` e `npx.cmd playwright test` passam;
- o bloco `Progresso` está atualizado e o checkpoint está versionado pelo reviewer.
