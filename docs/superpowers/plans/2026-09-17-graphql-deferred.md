# Corrigir captura de respostas GraphQL deferred — Plano de implementação

## Progresso

- **Estado:** em andamento
- **Última tarefa concluída:** Task 2 — integração e regressões deferred
- **Próxima tarefa:** revisão final da branch e validação manual
- **Notas de retomada:** Parser e integração concluídos; commits `ab8a9a5`, `fcf546a` e `8be4de8`; Vitest 528/528, typecheck e build aprovados. E2E 17/18 por falha pré-existente em onboarding.

> **Para agentes:** SUBSKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam checkboxes (`- [ ]`) para acompanhamento.

**Goal:** Fazer a extensão indexar respostas GraphQL deferred da Meta durante pesquisas SPA, sem regredir respostas JSON únicas nem o lote SSR.

**Architecture:** Criar um parser puro que tenta primeiro um JSON único e, quando o corpo contém múltiplos objetos JSON separados por linhas, interpreta cada linha válida de forma independente. O roteador usará esse parser para validar e classificar a captura; o pipeline indexará todos os blocos da resposta, de modo que um envelope inicial sem anúncios não impeça o segundo envelope de ser processado.

**Tech Stack:** TypeScript, Vitest, Vite/CRXJS, `AdStore` e normalizador existentes.

**Spec:** Diagnóstico aprovado na conversa em 2026-09-17; não há spec adicional porque esta é uma correção delimitada no fluxo existente.

## Global Constraints

- Toda documentação e mensagem de commit devem estar em pt-BR; identificadores de código permanecem em inglês.
- Não adicionar dependências, permissões ou novos endpoints.
- Preservar o comportamento para respostas JSON únicas, prefixo anti-sequestro `for (;;);` e lote SSR.
- O parser não pode lançar exceção para corpo inválido ou parcialmente inválido; deve retornar somente objetos JSON que conseguiu interpretar.
- Teste antes da implementação; não usar espera fixa nos testes.
- Verificar com `npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run verify:build` e, quando a implementação estiver completa, `npm.cmd run e2e`.
- Nunca executar `npm.cmd run gravar:fixtures`.

---

## Mapa de arquivos

- Criar `src/core/json-stream.ts`: parser puro para um ou vários objetos JSON no corpo de uma resposta.
- Criar `tests/json-stream.test.ts`: testes unitários do parser, incluindo o formato observado na Meta.
- Modificar `src/core/router.ts`: validar o corpo pelo parser sem exigir que a resposta inteira seja um único JSON.
- Modificar `src/content/pipeline.ts`: indexar cada objeto interpretado da captura.
- Modificar `tests/router.test.ts`: cobrir classificação de resposta deferred.
- Modificar `tests/pipeline.test.ts`: provar que o lote de anúncios no segundo objeto é indexado.

## Task 1: Criar parser para corpos JSON simples e deferred

**Arquivos:**
- Criar: `src/core/json-stream.ts`
- Criar: `tests/json-stream.test.ts`

**Interfaces:**
- Produz `extrairObjetosJson(corpo: string): unknown[]`.
- Deve remover o prefixo anti-sequestro inicial `for (;;);` antes de tentar interpretar o corpo.
- Deve tentar `JSON.parse` do corpo completo primeiro.
- Se o corpo completo não for um JSON único, deve separar por `\r?\n`, ignorar linhas vazias, interpretar cada linha individualmente e descartar linhas inválidas.
- Nunca deve lançar exceção para entrada inválida.

- [x] **Step 1: Escrever os testes que falham**

Adicionar em `tests/json-stream.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { extrairObjetosJson } from '../src/core/json-stream'

describe('extrairObjetosJson', () => {
  it('lê um JSON único', () => {
    expect(extrairObjetosJson('{"data":{"ok":true}}')).toEqual([
      { data: { ok: true } },
    ])
  })

  it('remove o prefixo anti-sequestro de um JSON único', () => {
    expect(extrairObjetosJson('for (;;);{"data":{"ok":true}}')).toEqual([
      { data: { ok: true } },
    ])
  })

  it('lê objetos JSON deferred separados por quebra de linha', () => {
    const corpo = [
      '{"data":{"page":null},"extensions":{"is_final":false}}',
      '{"label":"resultados","data":{"ad_library_main":{"search_results_connection":{"edges":[]}}}}',
    ].join('\n')

    expect(extrairObjetosJson(corpo)).toHaveLength(2)
  })

  it('ignora linhas inválidas sem perder linhas válidas', () => {
    const corpo = '{"data":{"primeiro":true}}\nisto não é JSON\n{"data":{"segundo":true}}'

    expect(extrairObjetosJson(corpo)).toEqual([
      { data: { primeiro: true } },
      { data: { segundo: true } },
    ])
  })

  it('retorna lista vazia para corpo inválido', () => {
    expect(extrairObjetosJson('isto não é JSON')).toEqual([])
  })
})
```

- [x] **Step 2: Rodar o teste para confirmar o RED**

Executar:

```powershell
npm.cmd test -- tests/json-stream.test.ts
```

Esperado: falha porque `src/core/json-stream.ts` e `extrairObjetosJson` ainda não existem.

- [x] **Step 3: Implementar o parser mínimo**

Criar `src/core/json-stream.ts` com esta forma:

```ts
const PREFIXO_ANTI_SEQUESTRO = /^\s*for\s*\(\s*;\s*;\s*\)\s*;/

export function extrairObjetosJson(corpo: string): unknown[] {
  const normalizado = corpo.replace(PREFIXO_ANTI_SEQUESTRO, '').trim()
  if (!normalizado) return []

  try {
    return [JSON.parse(normalizado) as unknown]
  } catch {
    const objetos: unknown[] = []
    for (const linha of normalizado.split(/\r?\n/)) {
      const trecho = linha.trim()
      if (!trecho) continue
      try {
        objetos.push(JSON.parse(trecho) as unknown)
      } catch {
        // Respostas deferred podem conter trechos incompletos; ignorá-los é seguro.
      }
    }
    return objetos
  }
}
```

- [x] **Step 4: Rodar os testes do parser**

Executar:

```powershell
npm.cmd test -- tests/json-stream.test.ts
```

Esperado: 5 testes passando.

- [x] **Step 5: Fazer checkpoint**

Como executor e reviewer são agentes distintos neste fluxo, o executor não deve
criar o commit. Deve escrever a mensagem proposta em `.commit-msg-codex` e
encerrar a tarefa; o reviewer/controller fará o checkpoint após a aprovação.

```powershell
Set-Content .commit-msg-codex "✨ feat(core): interpretar respostas JSON deferred"
```

## Task 2: Integrar parser ao roteador e ao pipeline

**Arquivos:**
- Modificar: `src/core/router.ts`
- Modificar: `src/content/pipeline.ts`
- Modificar: `tests/router.test.ts`
- Modificar: `tests/pipeline.test.ts`

**Interfaces:**
- `classificar(captura: Captura): TipoCaptura` continua com a mesma assinatura e tipos de retorno.
- `processarCaptura(captura: Captura, store: AdStore): ResultadoCaptura` continua com a mesma assinatura e acumula anúncios encontrados em qualquer objeto JSON válido da captura.
- `extrairObjetosJson` da Task 1 é a única fronteira de parsing; não duplicar lógica de `JSON.parse` nos consumidores.

- [x] **Step 1: Escrever regressões que falham**

Em `tests/router.test.ts`, adicionar um caso com dois objetos válidos separados por linha e o marcador no segundo:

```ts
it('reconhece busca quando o marcador está no segundo objeto deferred', () => {
  const corpo = [
    '{"data":{"page":null},"extensions":{"is_final":false}}',
    '{"label":"resultados","data":{"ad_library_main":{"search_results_connection":{"edges":[]}}}}',
  ].join('\n')

  expect(
    classificar({
      url: 'https://www.facebook.com/api/graphql/',
      corpo,
    }),
  ).toBe('busca')
})
```

Em `tests/pipeline.test.ts`, adicionar:

```ts
it('indexa uma busca que chega no segundo bloco de uma resposta deferred', () => {
  const store = new AdStore()
  const lote = readFileSync(join(PASTA, 'payload-01.json'), 'utf8')
  const corpo = [
    '{"data":{"page":null},"extensions":{"is_final":false}}',
    lote,
  ].join('\n')

  const r = processarCaptura(
    { url: 'https://www.facebook.com/api/graphql/', corpo },
    store,
  )

  expect(r.tipo).toBe('busca')
  expect(r.novos).toBeGreaterThan(0)
  expect(store.total()).toBe(r.novos)
})
```

- [x] **Step 2: Rodar as regressões para confirmar o RED**

Executar:

```powershell
npm.cmd test -- tests/router.test.ts tests/pipeline.test.ts
```

Esperado: os dois novos testes falham porque o roteador e o pipeline ainda tentam interpretar o corpo inteiro como um único JSON.

- [x] **Step 3: Integrar o parser no roteador**

Em `src/core/router.ts`:

- importar `extrairObjetosJson` de `../core/json-stream`;
- substituir o `JSON.parse(corpo)` usado apenas para validação por `extrairObjetosJson(captura.corpo)`;
- retornar `'ignorar'` quando a lista for vazia;
- manter a classificação por conteúdo na mesma ordem: `search_results_connection`, `collation_results`, `errors`, `pageID/page_info`.

O roteador deve continuar reconhecendo o marcador no corpo completo, pois ele pode estar em qualquer bloco deferred:

```ts
const objetos = extrairObjetosJson(captura.corpo)
if (objetos.length === 0) return 'ignorar'

const corpo = captura.corpo.replace(PREFIXO_ANTI_SEQUESTRO, '')
if (corpo.includes('search_results_connection')) return 'busca'
```

- [x] **Step 4: Integrar o parser no pipeline**

Em `src/content/pipeline.ts`:

- importar `extrairObjetosJson`;
- manter `classificar(captura)` como primeira decisão;
- quando o tipo for `'busca'`, percorrer `extrairObjetosJson(captura.corpo)` e chamar `indexarBusca(payload, store)` para cada objeto;
- retornar `novos` como a soma dos novos anúncios de todos os blocos e `total` como o total final do store;
- manter o retorno atual para tipos não busca e para corpo sem objetos válidos.

Forma esperada do núcleo:

```ts
const antes = store.total()
for (const payload of extrairObjetosJson(captura.corpo)) {
  indexarBusca(payload, store)
}
const total = store.total()
return { tipo, novos: total - antes, total }
```

- [x] **Step 5: Rodar os testes de integração**

Executar:

```powershell
npm.cmd test -- tests/router.test.ts tests/pipeline.test.ts
```

Esperado: todos os testes dos dois arquivos passando, incluindo os casos deferred.

- [x] **Step 6: Rodar a verificação completa**

Executar, nesta ordem:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npm.cmd run e2e
```

Esperado: suíte Vitest, typecheck, build/manifest e E2E sem regressão. Se o E2E ao vivo falhar por instabilidade da Meta, registrar a saída exata e repetir apenas o spec afetado antes de concluir.

- [x] **Step 7: Fazer checkpoint**

Como executor e reviewer são agentes distintos neste fluxo, o executor não deve
criar o commit. Deve escrever a mensagem proposta em `.commit-msg-codex` e
encerrar a tarefa; o reviewer/controller fará o checkpoint após a aprovação.

```powershell
Set-Content .commit-msg-codex "🐛 fix(interceptor): indexar respostas GraphQL deferred"
```

## Validação manual após a implementação

1. Recarregar a extensão em `chrome://extensions`.
2. Abrir a Biblioteca de Anúncios sem Ctrl+Shift+R.
3. Fazer uma nova pesquisa que gere os `graphql/` observados.
4. No Console, filtrar por `[CopyHaunt]` e confirmar ao menos uma linha `indexados: N`.
5. Confirmar que as bandejas aparecem nos cards sem recarregar a página.
6. Repetir um refresh normal e confirmar que o lote SSR continua aparecendo.

