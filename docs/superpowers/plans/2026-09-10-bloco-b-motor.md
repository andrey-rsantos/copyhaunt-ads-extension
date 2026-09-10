# Bloco B — o motor da mineração · Plano

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Sem essa skill carregada, siga `AGENTS.md`, seção "O plano é o estado".

## Progresso

- **Estado:** em andamento
- **Última tarefa concluída:** Task 9 — handshake entre os mundos
- **Próxima tarefa:** Verificação final
- **Notas de retomada:** Task 1 foi executada manualmente pelo dono do projeto e fica pulada conforme instrução da sessão. Na Task 2, `colacaoDe` também herda o maior `collation_count` visto em outro membro do grupo, exigido pelo teste do plano. Na Task 3, `e2e/filtro.spec.ts` foi atualizado para os campos e atalhos da faixa. Na Task 4, os testes cedem microtasks após `avisarLote()` para o relógio falso registrar a próxima espera antes do avanço seguinte. Na Task 5, o dono aprovou alvo configurável de 1 a 100 aprovados e teto independente de rolagens. O RED revelou e o plano corrigiu dois sinais antes ambíguos: `esgotado` exige que não haja sinal de página incompreensível; cards visíveis com store vazio aguardam três voltas e viram `incompreensivel`. A altura inicial é capturada antes da primeira rolagem. Na Task 7, o teste usa jsdom e Worker falso; o comando de órfãos com `grep` não é sintaticamente executável no PowerShell, então a mesma busca foi confirmada com `rg`, apontando ambos para `src/content/index.ts`. O comando provisório foi exposto no contexto isolado do content script para viabilizar a verificação manual antes da gaveta existir. A primeira verificação final sem CDP mediu 19 amostras ocultas, 0→22 rolagens e 0→152 analisados, sem bloqueio nem erro. Ela revelou falso `esgotado` após duas voltas vazias numa busca que voltou a crescer ao retomar; a Task 8 corrige essa descoberta antes de repetir o teste. Na Task 9, a verificação capturou a corrida do aviso único entre MAIN e mundo isolado; o handshake eliminou-a. Uma carga ao vivo sem lote SSR falhou uma vez e passou na repetição isolada; a suíte completa seguinte passou 12/12.

**Goal:** Corrigir o laço do minerador para rolagem reativa e ligá-lo ao
content script, de modo que uma mineração real rode do começo ao fim.

**Architecture:** Todas as peças puras já existem em `src/core/`. Este plano
conserta duas delas — a colação e o laço —, troca o filtro de data de modos
nomeados para faixa, move os números do ritmo para a config remota, e por fim
instancia o `Minerador` no content script. O alvo configurável entra no
contrato do motor; seu campo visual fica para o plano irmão. Nada aqui desenha
interface.

**Tech Stack:** TypeScript 7, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-09-10-bloco-b-integracao-design.md`
**Plano irmão:** a interface na barra da Meta — seções 7.1 a 7.7 do spec —
fica para um plano à parte, **ainda não escrito**, que depende deste. Ele só
pode ser escrito depois de resolvida a incerteza 4 do spec: que âncora estável
existe na barra de filtros da Meta.

## Global Constraints

- **Permissões continuam exatamente `["storage"]`** e os hosts atuais. Se uma
  tarefa parecer pedir permissão nova, pare: o desenho está errado.
- **O motor NÃO PODE emitir requisição.** A seção 2 do spec de 2026-09-05 abre
  uma única exceção — o Instagram ao clicar — e diz que nada no motor de
  mineração pode emitir requisição. Se você escrever `fetch` ou `XMLHttpRequest`
  em qualquer arquivo deste plano, está errado.
- **`npm.cmd` e `npx.cmd`** no PowerShell do Windows.
- **Nunca rodar `npm run gravar:fixtures`.** Ele regrava as fixtures contra a
  Meta ao vivo e destrói a base de comparação dos testes.
- **Quem commita é o revisor.** O executor escreve a mensagem em `.commit-msg`
  na raiz e para.
- **Commits** no padrão de `AGENTS.md`: tipo em inglês, texto em pt-BR,
  descrição no infinitivo.
- **Teste antes da implementação.** Cada tarefa nomeia o teste que falha
  primeiro.
- **Nada de espera por tempo fixo em teste.** Use `vi.waitFor` ou o relógio
  falso de `clock.ts`. Espera chutada passa isolada e quebra na suíte.

## Os valores medidos, para não serem redescobertos

Medidos na Biblioteca real em 2026-09-10, deslogado, 247 s de rolagem.

| Valor | Medida |
|---|---|
| Intervalo entre lotes da Meta | mín 1,4 s · **mediana 3,0 s** · máx 4,5 s |
| Rolagens desperdiçadas pelo laço atual | **79 de 162 — 49%** |
| Cobertura de `collation_count` | 86% (49 de 57 fixtures) |
| Cobertura somando `collation_id` | **95%** |
| Blob Worker na página da Meta | funciona, sem CSP no caminho |

## File Structure

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/core/types.ts` | `Ad` ganha `colacaoId` | 2 |
| `src/core/normalize.ts` | extrai `collation_id` | 2 |
| `src/core/store.ts` | agrupa por `colacaoId` e resolve a colação efetiva | 2 |
| `src/core/criteria.ts` | recebe a colação pelo contexto, não do `Ad` | 2 |
| `src/content/overlay.ts` | passa a colação efetiva ao avaliar | 2 |
| `src/core/dateFilter.ts` | faixa mín/máx no lugar de `ModoFiltro` | 3 |
| `src/core/filtro.ts` | comando com faixa | 3 |
| `src/panel/App.tsx` | controles de faixa | 3 |
| `src/core/miner.ts` | laço reativo, jitter, fim de resultados, degradação | 4 e 5 |
| `src/core/config.ts` | bloco `mining` validado | 6 |
| `src/content/index.ts` | instancia e liga o minerador | 7 |

---

## Task 1: Confirmar que a Meta pagina com a aba oculta

**Esta tarefa é condição de entrada do plano inteiro.** Se a resposta for
"não", pare e reporte: o desenho muda antes de qualquer código.

A medição de 2026-09-10 rodou com a janela minimizada e a mineração continuou
— 19 lotes em 55 s. Mas o `visibilityState` nunca virou `hidden`, porque o
debugger do CDP impede. Falta confirmar sem CDP.

**Files:**
- Create: `docs/superpowers/specs/2026-09-10-medicao-aba-oculta.md`

- [ ] **Step 1: Preparar o navegador**

Perfil dedicado do Chrome, **sem login no Facebook**, **sem `--remote-debugging-port`**.
A porta de debug é justamente o que invalidou a medição anterior.

- [ ] **Step 2: Abrir a Biblioteca e colar o instrumento no console**

Navegue para:

```
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&q=emagrecimento&search_type=keyword_unordered&sort_data[mode]=total_impressions&sort_data[direction]=desc
```

Cole no console:

```js
window.__med = { amostras: [], lotes: [], inicio: Date.now(), parar: false };
(function () {
  var med = window.__med;
  var open = XMLHttpRequest.prototype.open;
  var send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        if (typeof this.__u === 'string' && this.__u.includes('/api/graphql')
            && (this.responseText || '').includes('search_results_connection')) {
          med.lotes.push({ t: Date.now() - med.inicio, vis: document.visibilityState });
        }
      } catch (e) { /* resposta estranha não pode parar a medição */ }
    });
    return send.apply(this, arguments);
  };

  var fonte = 'self.onmessage=(e)=>{setTimeout(()=>self.postMessage(e.data),e.data.ms)}';
  var w = new Worker(URL.createObjectURL(new Blob([fonte], { type: 'text/javascript' })));
  var esperar = function (ms) { return new Promise(function (ok) { w.onmessage = ok; w.postMessage({ ms: ms }); }); };

  (async function () {
    while (!med.parar && med.amostras.length < 200) {
      await esperar(2500);
      window.scrollBy(0, window.innerHeight * 0.9);
      med.amostras.push({
        t: Date.now() - med.inicio,
        vis: document.visibilityState,
        h: document.documentElement.scrollHeight,
        lotes: med.lotes.length
      });
    }
  })();
})();
```

- [ ] **Step 3: Medir com a aba oculta de verdade**

Deixe rodar 30 s com a aba à frente. Depois **abra outra aba do navegador e
fique nela por 90 s**. Volte e rode no console:

```js
(function () {
  var m = window.__med;
  m.parar = true;
  var ocultas = m.amostras.filter(function (a) { return a.vis === 'hidden'; });
  var lotesOcultos = m.lotes.filter(function (l) { return l.vis === 'hidden'; });
  return {
    amostrasOcultas: ocultas.length,
    lotesOcultos: lotesOcultos.length,
    alturaNoInicioDaJanelaOculta: ocultas.length ? ocultas[0].h : null,
    alturaNoFimDaJanelaOculta: ocultas.length ? ocultas[ocultas.length - 1].h : null,
    totalLotes: m.lotes.length
  };
})();
```

**O que decide:**

| Resultado | Leitura |
|---|---|
| `amostrasOcultas` = 0 | a aba nunca ficou oculta — refazer o teste |
| `amostrasOcultas` > 0 e `lotesOcultos` > 0 e a altura cresceu | **passou** — segue o plano |
| `amostrasOcultas` > 0 e `lotesOcultos` = 0 | **PARE e reporte** |

- [ ] **Step 4: Registrar o resultado**

Criar `docs/superpowers/specs/2026-09-10-medicao-aba-oculta.md` com: data, o
JSON devolvido pelo Step 3, e uma linha de veredito. Sem isto, a próxima
sessão refaz a medição inteira.

- [ ] **Step 5: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
📚 docs(spec): medir se a Meta pagina com a aba oculta

O que foi feito:
- Rodar o instrumento de rolagem sem CDP anexado, com a aba em segundo
  plano por 90 segundos
- Registrar os números e o veredito

Considerações:
- A medição anterior, de 2026-09-10, ficou inconclusiva porque o debugger
  do CDP impede a página de entrar em `hidden`. Esta roda sem ele
```

---

## Task 2: A colação recuperada pelo grupo

Hoje `colacao` cai para 1 sempre que a Meta manda `collation_count: null` —
14% dos anúncios das fixtures. Mas nesses casos o `collation_id` continua
vindo, e ele agrupa. A cobertura sobe de 86% para 95%.

**Files:**
- Modify: `src/core/types.ts`
- Modify: `src/core/normalize.ts:69-78`
- Modify: `src/core/store.ts`
- Modify: `src/core/criteria.ts`
- Modify: `src/content/overlay.ts:34-37`
- Test: `tests/normalize.test.ts`, `tests/store.test.ts`, `tests/criteria.test.ts`

**Interfaces:**
- Produces, de `src/core/types.ts`: `Ad` ganha `colacaoId?: string`.
- Produces, de `src/core/store.ts`: `colacaoDe(ad: Ad): number`.
- Produces, de `src/core/criteria.ts`: `avaliar(ad: Ad, c: Criterios, ctx: { presenca: number; colacao: number; agora: Date })` — o campo `colacao` é **novo e obrigatório** no contexto.

- [x] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/store.test.ts`:

```ts
describe('colacaoDe', () => {
  function ad(id: string, colacao: number, colacaoId?: string): Ad {
    return {
      id,
      iniciouEm: new Date('2026-08-01T12:00:00Z'),
      colacao,
      colacaoId,
      anunciante: { pageId: 'p1', pageName: 'A' },
      midias: [],
      plataformas: [],
      ativo: true,
    }
  }

  it('usa o número da Meta quando ele veio', () => {
    const store = new AdStore()
    store.adicionar([ad('1', 7, 'g1')])
    expect(store.colacaoDe(store.obter('1')!)).toBe(7)
  })

  it('conta os membros do grupo quando o número não veio', () => {
    const store = new AdStore()
    // três anúncios do mesmo grupo, todos sem contagem própria
    store.adicionar([ad('1', 1, 'g1'), ad('2', 1, 'g1'), ad('3', 1, 'g1')])
    expect(store.colacaoDe(store.obter('2')!)).toBe(3)
  })

  it('fica com o maior entre o número da Meta e os membros vistos', () => {
    const store = new AdStore()
    store.adicionar([ad('1', 7, 'g1'), ad('2', 1, 'g1')])
    // a Meta diz 7; vimos 2. O grupo tem pelo menos 7.
    expect(store.colacaoDe(store.obter('2')!)).toBe(7)
  })

  it('sem grupo, devolve a colação do próprio anúncio', () => {
    const store = new AdStore()
    store.adicionar([ad('1', 1)])
    expect(store.colacaoDe(store.obter('1')!)).toBe(1)
  })
})
```

Acrescentar a `tests/normalize.test.ts`:

```ts
it('lê o collation_id quando ele vem', () => {
  const corpo = {
    data: { ad_library_main: { search_results_connection: { edges: [
      { node: { collated_results: [{
        ad_archive_id: '1',
        page_id: 'p1',
        page_name: 'A',
        start_date: 1754049600,
        collation_count: null,
        collation_id: '1541173110816865',
        snapshot: {},
      }] } },
    ] } } },
  }
  const [ad] = normalizarBusca(corpo)
  expect(ad.colacaoId).toBe('1541173110816865')
  expect(ad.colacao).toBe(1)
})
```

Em `tests/criteria.test.ts`, a função `ctx` passa a incluir a colação:

```ts
function ctx(presenca = 10, colacao = 5) {
  return { presenca, colacao, agora: AGORA }
}
```

E o teste de colação baixa passa a variar o contexto, não o anúncio:

```ts
it('reprova por colação baixa e diz o motivo', () => {
  const r = avaliar(ad(), CRITERIOS_PADRAO, ctx(10, 2))
  expect(r.passa).toBe(false)
  expect(r.motivos.join(' ')).toContain('colação')
})
```

- [x] **Step 2: Rodar e confirmar que falham**

```bash
npx.cmd vitest run tests/store.test.ts tests/normalize.test.ts tests/criteria.test.ts
```

Esperado: FALHA. `colacaoDe` não existe, `colacaoId` não existe no tipo, e
`avaliar` ignora `ctx.colacao`.

- [x] **Step 3: Escrever a implementação**

Em `src/core/types.ts`, dentro de `interface Ad`, logo abaixo de `colacao`:

```ts
  /**
   * O grupo de colação da Meta. Vem mesmo quando `collation_count` é nulo, e
   * é o que permite recuperar a contagem: ela grava o número só no líder do
   * grupo. Medido: 95% de cobertura somando os dois campos, contra 86% do
   * número sozinho.
   */
  colacaoId?: string
```

Em `src/core/normalize.ts`, dentro de `normalizarAnuncio`, no objeto devolvido,
logo após `colacao`:

```ts
    colacaoId: texto(prop(bruto, 'collation_id')),
```

Em `src/core/store.ts`, acrescentar o índice e o método:

```ts
  private readonly porGrupo = new Map<string, number>()
```

Dentro de `adicionar`, depois de incrementar `porAnunciante`:

```ts
      if (ad.colacaoId) {
        this.porGrupo.set(ad.colacaoId, (this.porGrupo.get(ad.colacaoId) ?? 0) + 1)
      }
```

Em `limpar`, acrescentar `this.porGrupo.clear()`.

E o método novo:

```ts
  /**
   * Quantos anúncios usam o mesmo criativo.
   *
   * A Meta grava `collation_count` apenas no líder do grupo; os demais membros
   * vêm com `null` e o mesmo `collation_id`. Contar os membros vistos recupera
   * esses casos — e entrega algo melhor que o número dela quando o grupo
   * inteiro apareceu na busca: conta o que de fato está nesta pesquisa.
   */
  colacaoDe(ad: Ad): number {
    const membros = ad.colacaoId ? (this.porGrupo.get(ad.colacaoId) ?? 0) : 0
    return Math.max(ad.colacao, membros)
  }
```

Em `src/core/criteria.ts`, a interface do contexto ganha `colacao: number`, e
a comparação passa a usá-lo no lugar de `ad.colacao`. Localize a linha que
compara a colação mínima e troque `ad.colacao` por `ctx.colacao`.

Em `src/content/overlay.ts`, na chamada a `avaliar`:

```ts
    const veredito = avaliar(ad, criterios, {
      presenca: store.presenca(ad.anunciante.pageId),
      colacao: store.colacaoDe(ad),
      agora,
    })
```

- [x] **Step 4: Rodar e confirmar que passam**

```bash
npx.cmd vitest run tests/store.test.ts tests/normalize.test.ts tests/criteria.test.ts tests/overlay.test.ts
```

Esperado: PASSA.

**Se `tests/overlay.test.ts` falhar por tipo, é esperado:** ele monta o
contexto à mão em algum caso. Acrescente `colacao` ali, com o valor que o
teste já espera.

- [x] **Step 5: Medir a cobertura contra as fixtures reais**

```bash
node -e "const fs=require('fs');let ads=[];function acha(o,out){if(Array.isArray(o)){o.forEach(x=>acha(x,out));return}if(o&&typeof o==='object'){if(o.ad_archive_id)out.push(o);Object.values(o).forEach(v=>acha(v,out))}};['payload-01.json','payload-02.json','payload-03.json','ssr-01.json'].forEach(f=>acha(JSON.parse(fs.readFileSync('tests/fixtures/'+f,'utf8')),ads));const v=new Set();ads=ads.filter(a=>!v.has(a.ad_archive_id)&&v.add(a.ad_archive_id));const comId=ads.filter(a=>a.collation_id).length;console.log('anuncios:',ads.length,'| com collation_id:',comId,'|',Math.round(comId/ads.length*100)+'%')"
```

Esperado: `anuncios: 57 | com collation_id: 54 | 95%`.

**Se o número não bater, PARE e reporte.** As fixtures mudaram, ou a extração
está errada.

- [x] **Step 6: Rodar a suíte inteira**

```bash
npm.cmd test
npm.cmd run typecheck
```

- [x] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(normalizer): recuperar a colação pelo grupo quando a contagem falta

O que foi feito:
- Ler o `collation_id` no normalizador e guardá-lo no anúncio
- Contar os membros de cada grupo no store e expor `colacaoDe`
- Passar a colação efetiva pelo contexto de `avaliar`, no lugar de ler
  direto do anúncio

Como foi feito:
- A Meta grava `collation_count` apenas no líder do grupo; os demais
  membros vêm com nulo e o mesmo `collation_id`. Contar os membros vistos
  recupera esses casos
- `colacaoDe` devolve o maior entre o número da Meta e os membros vistos:
  o grupo pode ser maior que o pedaço dele que apareceu na busca

Considerações:
- Cobertura medida nas 57 fixtures reais: 86% com o número sozinho, 95%
  somando o grupo. Os 5% restantes seguem caindo em colação 1
- Isso dispensa hash perceptual e comparação de mídia, que foram avaliados
  e recusados por custo e fragilidade
```

---

## Task 3: O filtro de data vira faixa

`ModoFiltro` some. "Provadas" e "Subindo" viram mínimo e máximo em dias, que
dizem a mesma coisa sem exigir explicação — e permitem uma faixa, que os
modos não permitiam.

**Files:**
- Modify: `src/core/dateFilter.ts`
- Modify: `src/core/filtro.ts`
- Modify: `src/panel/App.tsx`
- Test: `tests/dateFilter.test.ts`, `tests/filtro.test.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces, de `src/core/dateFilter.ts`:
  `PRESETS: readonly number[]` = `[3, 5, 14, 30, 60]`,
  `montarUrlFiltro(urlAtual: string, faixa: { diasMin: number | null; diasMax: number | null }, agora: Date): string`.
- Produces, de `src/core/filtro.ts`:
  `interface ComandoFiltro { diasMin: number | null; diasMax: number | null }`,
  `lerComandoFiltro(valor: unknown): ComandoFiltro | null`,
  `urlDoComando(cmd: ComandoFiltro, urlAtual: string, agora: Date): string`.

**A inversão, que parece erro de digitação e não é:** o **mínimo de dias no
ar** vira `start_date[max]`, e o **máximo de dias** vira `start_date[min]`.
Mais dias no ar significa data de início mais antiga.

- [x] **Step 1: Escrever os testes que falham**

Substituir os testes de modo em `tests/dateFilter.test.ts` por:

```ts
describe('PRESETS', () => {
  it('traz os intervalos do spec', () => {
    expect(PRESETS).toEqual([3, 5, 14, 30, 60])
  })
})

describe('montarUrlFiltro', () => {
  const AGORA = new Date('2026-09-10T12:00:00Z')
  const BASE = 'https://www.facebook.com/ads/library/?q=teste'

  it('mínimo de dias limita a data máxima de início', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[min]')).toBeNull()
  })

  it('máximo de dias limita a data mínima de início', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: null, diasMax: 7 }, AGORA))
    expect(url.searchParams.get('start_date[min]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[max]')).toBeNull()
  })

  it('os dois juntos formam uma faixa', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: 30 }, AGORA))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-09-03')
    expect(url.searchParams.get('start_date[min]')).toBe('2026-08-11')
  })

  it('sem faixa nenhuma, limpa os dois cortes', () => {
    const comFiltro = 'https://www.facebook.com/ads/library/?q=t&start_date[max]=2020-01-01'
    const url = new URL(montarUrlFiltro(comFiltro, { diasMin: null, diasMax: null }, AGORA))
    expect(url.searchParams.get('start_date[max]')).toBeNull()
    expect(url.searchParams.get('start_date[min]')).toBeNull()
  })

  it('substitui filtro anterior em vez de acumular', () => {
    const comFiltro = 'https://www.facebook.com/ads/library/?q=t&start_date[min]=2020-01-01'
    const url = new URL(montarUrlFiltro(comFiltro, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('start_date[min]')).toBeNull()
    expect(url.searchParams.get('start_date[max]')).toBe('2026-09-03')
  })

  it('preserva os outros parâmetros da busca', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('q')).toBe('teste')
  })

  it('atravessa virada de mês', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 14, diasMax: null }, new Date('2026-03-05T12:00:00Z')))
    expect(url.searchParams.get('start_date[max]')).toBe('2026-02-19')
  })

  it('atravessa 29 de fevereiro em ano bissexto', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 3, diasMax: null }, new Date('2024-03-01T12:00:00Z')))
    expect(url.searchParams.get('start_date[max]')).toBe('2024-02-27')
  })

  it('força a ordenação por impressões totais', () => {
    const url = new URL(montarUrlFiltro(BASE, { diasMin: 7, diasMax: null }, AGORA))
    expect(url.searchParams.get('sort_data[mode]')).toBe('total_impressions')
    expect(url.searchParams.get('sort_data[direction]')).toBe('desc')
  })
})
```

Substituir os testes de comando em `tests/filtro.test.ts` por:

```ts
describe('lerComandoFiltro', () => {
  it('aceita só o mínimo', () => {
    expect(lerComandoFiltro({ diasMin: 7, diasMax: null })).toEqual({ diasMin: 7, diasMax: null })
  })

  it('aceita só o máximo', () => {
    expect(lerComandoFiltro({ diasMin: null, diasMax: 7 })).toEqual({ diasMin: null, diasMax: 7 })
  })

  it('aceita a faixa', () => {
    expect(lerComandoFiltro({ diasMin: 7, diasMax: 30 })).toEqual({ diasMin: 7, diasMax: 30 })
  })

  it('recusa faixa invertida', () => {
    expect(lerComandoFiltro({ diasMin: 30, diasMax: 7 })).toBeNull()
  })

  it('recusa fora do intervalo permitido', () => {
    expect(lerComandoFiltro({ diasMin: 0, diasMax: null })).toBeNull()
    expect(lerComandoFiltro({ diasMin: DIAS_MAX + 1, diasMax: null })).toBeNull()
  })

  it('recusa não inteiro', () => {
    expect(lerComandoFiltro({ diasMin: 7.5, diasMax: null })).toBeNull()
  })

  it('recusa o que não é comando', () => {
    expect(lerComandoFiltro(null)).toBeNull()
    expect(lerComandoFiltro([])).toBeNull()
    expect(lerComandoFiltro({ modo: 'provadas', dias: 7 })).toBeNull()
  })
})
```

- [x] **Step 2: Rodar e confirmar que falham**

```bash
npx.cmd vitest run tests/dateFilter.test.ts tests/filtro.test.ts
```

Esperado: FALHA.

- [x] **Step 3: Escrever a implementação**

Substituir `src/core/dateFilter.ts` inteiro por:

```ts
/**
 * "Ativo há X" é uma faixa, não um modo.
 *
 * O mínimo de dias no ar corta pela data MÁXIMA de início, e o máximo de dias
 * corta pela MÍNIMA — mais dias no ar significa começar mais cedo. A inversão
 * parece erro de digitação e não é.
 *
 * Substitui os modos `provadas` e `subindo`, decididos em 2026-09-06 e
 * removidos em 2026-09-10: os nomes exigiam explicação, os campos não. E a
 * faixa permite o que os modos não permitiam — mínimo e máximo ao mesmo tempo.
 */

export interface FaixaDias {
  /** No ar há pelo menos tantos dias. */
  diasMin: number | null
  /** No ar há no máximo tantos dias. */
  diasMax: number | null
}

/** 3 e 5 dias, depois 2 semanas, 1 mês e 2 meses. */
export const PRESETS = [3, 5, 14, 30, 60]

const UM_DIA = 24 * 60 * 60 * 1000

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function corte(agora: Date, dias: number): string {
  return iso(new Date(agora.getTime() - dias * UM_DIA))
}

/**
 * Reescreve a URL da Biblioteca com a faixa de tempo ativo.
 *
 * Reescrever a URL é bem mais estável que simular cliques no menu de filtros
 * da Meta, que muda de layout com frequência.
 */
export function montarUrlFiltro(
  urlAtual: string,
  faixa: FaixaDias,
  agora: Date,
): string {
  const url = new URL(urlAtual)

  // Sempre limpar os dois antes, senão um filtro anterior sobrevive e o
  // resultado vira a interseção de dois cortes.
  url.searchParams.delete('start_date[min]')
  url.searchParams.delete('start_date[max]')

  if (faixa.diasMin !== null) {
    url.searchParams.set('start_date[max]', corte(agora, faixa.diasMin))
  }
  if (faixa.diasMax !== null) {
    url.searchParams.set('start_date[min]', corte(agora, faixa.diasMax))
  }

  // Os escalados vêm primeiro; sem isso, a mineração rola muito mais.
  url.searchParams.set('sort_data[mode]', 'total_impressions')
  url.searchParams.set('sort_data[direction]', 'desc')

  return url.toString()
}
```

Substituir `src/core/filtro.ts` inteiro por:

```ts
import { montarUrlFiltro, type FaixaDias } from './dateFilter'

/**
 * O comando que o painel manda e o content script obedece.
 *
 * Módulo puro, e a fronteira de confiança do recurso: `lerComandoFiltro`
 * recebe o que veio de `postMessage`, que qualquer script da página pode ter
 * escrito, e só deixa passar o que for exatamente isto.
 */

export type ComandoFiltro = FaixaDias

/**
 * Um ano. Acima disso o corte deixa de filtrar coisa alguma: a Biblioteca só
 * guarda anúncios ativos, e nenhum está no ar desde antes disso.
 */
export const DIAS_MAX = 365

/** Um lado da faixa: inteiro entre 1 e DIAS_MAX, ou ausente. */
function ladoValido(valor: unknown): number | null | undefined {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== 'number' || !Number.isInteger(valor)) return undefined
  if (valor < 1 || valor > DIAS_MAX) return undefined
  return valor
}

/** O comando, ou `null` se o que chegou não for um. */
export function lerComandoFiltro(valor: unknown): ComandoFiltro | null {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) {
    return null
  }

  const bruto = valor as Record<string, unknown>
  const diasMin = ladoValido(bruto.diasMin)
  const diasMax = ladoValido(bruto.diasMax)
  if (diasMin === undefined || diasMax === undefined) return null

  // Faixa invertida não filtra nada: devolveria a interseção vazia.
  if (diasMin !== null && diasMax !== null && diasMin > diasMax) return null

  return { diasMin, diasMax }
}

/** A URL da Biblioteca com a faixa do comando aplicada. */
export function urlDoComando(
  cmd: ComandoFiltro,
  urlAtual: string,
  agora: Date,
): string {
  return montarUrlFiltro(urlAtual, cmd, agora)
}
```

Em `src/panel/App.tsx`, trocar o estado de modo por dois campos. Substituir o
componente inteiro por:

```tsx
import { useState } from 'react'
import { PRESETS } from '../core/dateFilter'
import { DIAS_MAX } from '../core/filtro'
import { createMessage } from '../core/messages'

/** Um lado da faixa: número válido, ou null quando vazio. */
function lado(valor: string): number | null {
  const n = Number(valor)
  if (valor.trim() === '') return null
  return Number.isInteger(n) && n >= 1 && n <= DIAS_MAX ? n : null
}

export function App() {
  const [min, setMin] = useState('7')
  const [max, setMax] = useState('')

  const diasMin = lado(min)
  const diasMax = lado(max)
  const vazio = min.trim() === '' && max.trim() === ''
  const invertido = diasMin !== null && diasMax !== null && diasMin > diasMax
  const podeEnviar = !vazio && !invertido

  function aplicar(): void {
    window.parent.postMessage(
      createMessage('panel-command', { diasMin, diasMax }),
      '*',
    )
  }

  return (
    <div className="flex h-full flex-col gap-3 bg-charcoal p-4 font-sans text-white">
      <h1 className="font-display text-lg font-bold">
        Copy<span className="text-purple">Haunt</span>
      </h1>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={DIAS_MAX}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          placeholder="mín"
          aria-label="mínimo de dias no ar"
          className="w-20 rounded-btn bg-ink px-2 py-1 text-xs text-white"
        />
        <span className="text-xs text-muted">até</span>
        <input
          type="number"
          min={1}
          max={DIAS_MAX}
          value={max}
          onChange={(e) => setMax(e.target.value)}
          placeholder="máx"
          aria-label="máximo de dias no ar"
          className="w-20 rounded-btn bg-ink px-2 py-1 text-xs text-white"
        />
        <span className="text-xs text-muted">dias no ar</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setMin(String(d))}
            className="rounded-btn bg-ink px-2 py-1 text-xs text-lavender"
          >
            {d}+
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={aplicar}
        disabled={!podeEnviar}
        className="rounded-btn bg-purple px-2 py-1 text-xs text-white disabled:opacity-40"
      >
        Aplicar
      </button>
    </div>
  )
}
```

- [x] **Step 4: Rodar e confirmar que passam**

```bash
npx.cmd vitest run tests/dateFilter.test.ts tests/filtro.test.ts tests/comando.test.ts
```

Esperado: PASSA.

**Se `tests/comando.test.ts` falhar**, ele monta comandos no formato antigo.
Troque `{ modo: 'provadas', dias: 7 }` por `{ diasMin: 7, diasMax: null }`.

- [x] **Step 5: Rodar a suíte, o typecheck e o e2e do filtro**

```bash
npm.cmd test
npm.cmd run typecheck
npx.cmd playwright test e2e/filtro.spec.ts
```

**Se o e2e falhar**, ele clica nos botões "Provadas"/"Subindo", que não
existem mais. Ajuste-o para preencher os campos e clicar em "Aplicar".

- [x] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
♻️ refactor(ui): trocar os modos do filtro por uma faixa de dias

O que foi feito:
- Remover `ModoFiltro`: "provadas" e "subindo" viram mínimo e máximo
- Trocar os presets 3/5/7/14/21/28 por 3/5/14/30/60
- Refazer o painel com dois campos e atalhos de mínimo

Como foi feito:
- O mínimo de dias no ar corta por `start_date[max]`, e o máximo por
  `start_date[min]`. A inversão é do domínio: mais dias no ar significa
  data de início mais antiga
- A faixa invertida é recusada na leitura do comando, porque devolveria
  interseção vazia

Considerações:
- Nada se perde: mínimo sozinho é o antigo "provadas", máximo sozinho é o
  antigo "subindo". E ganha-se a faixa, que os modos não permitiam
- Os nomes exigiam explicação e os campos não. Decisão do dono do projeto
  em 2026-09-10
```

---

## Task 4: O laço reativo

O laço atual rola por cronômetro fixo, sem perguntar se o lote anterior
chegou. Medido: **162 rolagens para 83 lotes — 49% desperdiçadas**.

**Files:**
- Modify: `src/core/miner.ts`
- Test: `tests/miner.test.ts`

**Interfaces:**
- Consumes: `AdStore.colacaoDe` (Task 2); `Relogio` de `src/core/clock.ts`.
- Produces, de `src/core/miner.ts`:
  `OpcoesMineracao` passa a ter `pisoMs: number`, `timeoutMs: number`, `jitter: number`, `aleatorio?: () => number`, e **perde** `intervaloMs`;
  `Minerador.avisarLote(): void` — o content script chama quando um lote inédito chega.

- [x] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/miner.test.ts`:

```ts
describe('laço reativo', () => {
  it('não rola de novo antes de o lote chegar', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store,
      criterios: CRITERIOS_PADRAO,
      relogio,
      rolar,
      pisoMs: 2500,
      timeoutMs: 4500,
      jitter: 0,
      aleatorio: () => 0.5,
      maxRolagens: 10,
      limiteEncontrados: 100,
    })

    void m.iniciar()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    // sem aviso de lote, o piso sozinho não solta a próxima rolagem
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    m.parar()
  })

  it('rola de novo assim que o lote chega e o piso passa', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store, criterios: CRITERIOS_PADRAO, relogio, rolar,
      pisoMs: 2500, timeoutMs: 4500, jitter: 0, aleatorio: () => 0.5,
      maxRolagens: 10, limiteEncontrados: 100,
    })

    void m.iniciar()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    m.avisarLote()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(2)

    m.parar()
  })

  it('o timeout solta o laço quando nenhum lote chega', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store, criterios: CRITERIOS_PADRAO, relogio, rolar,
      pisoMs: 2500, timeoutMs: 4500, jitter: 0, aleatorio: () => 0.5,
      maxRolagens: 10, limiteEncontrados: 100,
    })

    void m.iniciar()
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(1)

    // 4500 de timeout sem aviso: o laço desiste de esperar e segue
    await relogio.avancar(4500)
    await relogio.avancar(2500)
    expect(rolar).toHaveBeenCalledTimes(2)

    m.parar()
  })

  it('o jitter varia a espera dentro da margem', async () => {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const rolar = vi.fn()
    const m = new Minerador({
      store, criterios: CRITERIOS_PADRAO, relogio, rolar,
      pisoMs: 1000, timeoutMs: 4500,
      jitter: 0.4,
      aleatorio: () => 1, // extremo de cima: 1000 * 1.4 = 1400
      maxRolagens: 10, limiteEncontrados: 100,
    })

    void m.iniciar()
    await relogio.avancar(1399)
    expect(rolar).not.toHaveBeenCalled()
    await relogio.avancar(1)
    expect(rolar).toHaveBeenCalledTimes(1)

    m.parar()
  })
})
```

- [x] **Step 2: Rodar e confirmar que falham**

```bash
npx.cmd vitest run tests/miner.test.ts
```

Esperado: FALHA. `pisoMs`, `timeoutMs`, `jitter` e `avisarLote` não existem.

- [x] **Step 3: Escrever a implementação**

Em `src/core/miner.ts`, substituir `OpcoesMineracao` por:

```ts
export interface OpcoesMineracao {
  store: AdStore
  criterios: Criterios
  relogio: Relogio
  /** Efeito injetado: rolar a página. Nos testes, um espião. */
  rolar: () => void
  /**
   * Espera mínima entre uma rolagem e a seguinte, mesmo que o lote chegue
   * antes. Medido: a Meta responde a cada ~3,0 s, e 2,5 s fica abaixo disso
   * sem atropelar.
   */
  pisoMs: number
  /**
   * Quanto esperar pelo lote antes de desistir e rolar assim mesmo. Medido:
   * o intervalo máximo observado foi 4,5 s.
   */
  timeoutMs: number
  /**
   * Margem de variação da espera, de 0 a 1. Cadência rígida é o sinal mais
   * óbvio de automação; 0,4 espalha a espera em ±40%.
   */
  jitter: number
  /** Fonte de aleatoriedade, injetada para o jitter ser testável. */
  aleatorio?: () => number
  maxRolagens: number
  limiteEncontrados: number
  aoProgredir?: (p: Progresso) => void
}
```

Dentro da classe, acrescentar o campo e o método de aviso:

```ts
  private avisarPendente: (() => void) | null = null

  /**
   * O content script chama isto quando um lote inédito entra no store.
   *
   * É o que torna o laço reativo: em vez de rolar por cronômetro, ele espera
   * a Meta responder. Medido no laço antigo: 162 rolagens para 83 lotes,
   * quase metade sem trazer nada.
   */
  avisarLote(): void {
    const avisar = this.avisarPendente
    this.avisarPendente = null
    if (avisar) avisar()
  }
```

Acrescentar os dois auxiliares privados:

```ts
  /** O piso, espalhado pelo jitter. */
  private esperaComJitter(): number {
    const o = this.opcoes
    if (o.jitter <= 0) return o.pisoMs
    const sorte = (o.aleatorio ?? Math.random)()
    // sorte 0 → -jitter; sorte 1 → +jitter
    return Math.round(o.pisoMs * (1 + o.jitter * (sorte * 2 - 1)))
  }

  /**
   * Espera o lote chegar, ou o timeout estourar. Devolve `true` se veio lote.
   *
   * A corrida entre as duas promessas é o coração do laço reativo: a Meta
   * lenta nos desacelera sozinha, sem regra nova.
   */
  private async esperarLote(): Promise<boolean> {
    const o = this.opcoes
    let chegou = false
    const aviso = new Promise<void>((liberar) => {
      this.avisarPendente = () => { chegou = true; liberar() }
    })
    await Promise.race([aviso, o.relogio.esperar(o.timeoutMs)])
    this.avisarPendente = null
    return chegou
  }
```

Substituir `rodar` por:

```ts
  private async rodar(): Promise<void> {
    const o = this.opcoes

    while (this.estado === 'minerando') {
      await o.relogio.esperar(this.esperaComJitter())
      if (this.estado !== 'minerando') break

      o.rolar()
      this.rolagens += 1

      await this.esperarLote()
      if (this.estado !== 'minerando') break

      this.avaliarNovos()
      o.aoProgredir?.(this.progresso())

      if (this.aprovados.length >= o.limiteEncontrados) {
        this.estado = 'concluido'
        break
      }
      if (this.rolagens >= o.maxRolagens) {
        this.estado = 'concluido'
        break
      }
    }
  }
```

Em `avaliarNovos`, passar a colação efetiva:

```ts
      const veredito = avaliar(ad, o.criterios, {
        presenca: o.store.presenca(ad.anunciante.pageId),
        colacao: o.store.colacaoDe(ad),
        agora,
      })
```

- [x] **Step 4: Rodar e confirmar que passam**

```bash
npx.cmd vitest run tests/miner.test.ts
```

Esperado: PASSA, incluindo os testes antigos.

**Se um teste antigo falhar por causa de `intervaloMs`, é esperado:** troque
por `pisoMs`, e acrescente `timeoutMs: 4500`, `jitter: 0` e
`aleatorio: () => 0.5` às opções. Testes com jitter zero não precisam de
`aleatorio`, mas explicitá-lo documenta a intenção.

- [x] **Step 5: Rodar a suíte e o typecheck**

```bash
npm.cmd test
npm.cmd run typecheck
```

- [x] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
🐛 fix(miner): esperar o lote chegar antes de rolar de novo

O que foi feito:
- Trocar o cronômetro fixo por espera do lote com timeout
- Acrescentar piso entre rolagens e jitter na espera
- Expor `avisarLote`, que o content script chama quando um lote entra

Como foi feito:
- A espera é uma corrida entre o aviso de lote e o timeout do relógio. A
  Meta lenta passa a nos desacelerar sozinha, sem regra nova
- O jitter recebe a fonte de aleatoriedade por parâmetro, senão não teria
  como ser testado

Considerações:
- Medido na Biblioteca real em 2026-09-10: o laço antigo fez 162 rolagens
  para 83 lotes. Quase metade não trouxe nada, porque a Meta responde a
  cada ~3,0 s e o cronômetro disparava a cada 1,5 s
- Piso de 2,5 s e timeout de 4,5 s saem da mesma medição: mediana 3,0 s e
  máximo observado 4,5 s
- Cadência rígida é o sinal mais óbvio de automação. O jitter de ±40% não
  é evasão de detecção: é parar de parecer um cronômetro
```

---

## Task 5: Fim dos resultados e detector de degradação

Duas condições de parada que a seção 9 do spec de 2026-09-05 exige e que o
laço nunca teve. Sem elas, a mineração roda até o teto de rolagens mesmo
depois de a Biblioteca ter acabado. Esta tarefa também fixa o contrato
aprovado em 2026-09-10: alvo de 1 a 100 anúncios aprovados, sem ultrapassá-lo,
e teto de rolagens tratado como interrupção de segurança.

**Files:**
- Modify: `src/core/miner.ts`
- Test: `tests/miner.test.ts`

**Interfaces:**
- Consumes: tudo da Task 4.
- Produces, de `src/core/miner.ts`:
  `EstadoMineracao` ganha `'esgotado'`, `'incompreensivel'` e
  `'limite-seguranca'`;
  `OpcoesMineracao` ganha `alturaDaPagina: () => number` e `cardsNaTela: () => number`.

- [x] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/miner.test.ts`:

```ts
// acrescente `type OpcoesMineracao` ao import de '../src/core/miner' no
// topo do arquivo, senão o `Partial<>` abaixo não compila
describe('condições de parada', () => {
  function montar(extra: Partial<OpcoesMineracao> = {}) {
    const store = new AdStore()
    const relogio = relogioDeTeste(new Date('2026-09-10T12:00:00Z'))
    const m = new Minerador({
      store,
      criterios: CRITERIOS_PADRAO,
      relogio,
      rolar: vi.fn(),
      pisoMs: 1000,
      timeoutMs: 2000,
      jitter: 0,
      aleatorio: () => 0.5,
      maxRolagens: 50,
      limiteEncontrados: 100,
      alturaDaPagina: () => 10000,
      cardsNaTela: () => 0,
      ...extra,
    })
    return { m, relogio, store }
  }

  it('declara esgotado quando o lote não vem e a página não cresce', async () => {
    const { m, relogio } = montar({ cardsNaTela: () => 0 })

    void m.iniciar()
    // duas voltas sem lote e sem a página crescer
    for (let i = 0; i < 2; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
    }

    expect(m.progresso().estado).toBe('esgotado')
  })

  it('não declara esgotado se a página ainda cresce', async () => {
    let altura = 10000
    const { m, relogio } = montar({ alturaDaPagina: () => (altura += 3000) })

    void m.iniciar()
    for (let i = 0; i < 2; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
    }

    expect(m.progresso().estado).toBe('minerando')
    m.parar()
  })

  it('declara incompreensível quando há cards na tela e o store está vazio', async () => {
    const { m, relogio } = montar({ cardsNaTela: () => 30 })

    void m.iniciar()
    for (let i = 0; i < 3; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
    }

    // store vazio, cards no DOM: não estamos entendendo a página
    expect(m.progresso().estado).toBe('incompreensivel')
  })

  it('não declara incompreensível quando o store recebeu anúncios', async () => {
    const { m, relogio, store } = montar({ cardsNaTela: () => 30 })
    store.adicionar([{
      id: '1',
      iniciouEm: new Date('2026-08-01T12:00:00Z'),
      colacao: 1,
      anunciante: { pageId: 'p1', pageName: 'A' },
      midias: [],
      plataformas: [],
      ativo: true,
    }])

    void m.iniciar()
    for (let i = 0; i < 3; i++) {
      await relogio.avancar(1000)
      await relogio.avancar(2000)
    }

    expect(m.progresso().estado).not.toBe('incompreensivel')
  })

  it('interrompe no teto de segurança sem dizer que concluiu', async () => {
    const { m, relogio } = montar({
      maxRolagens: 1,
      alturaDaPagina: () => 13000,
    })

    void m.iniciar()
    await relogio.avancar(1000)
    await relogio.avancar(2000)

    expect(m.progresso().estado).toBe('limite-seguranca')
  })
})
```

No `describe('Minerador')`, completar o teste do limite de encontrados para
provar que o lote não faz o resultado ultrapassar o alvo:

```ts
  expect(minerador.progresso().encontrados).toBe(2)
  expect(minerador.encontrados().map((a) => a.id)).toEqual(['1', '2'])
```

Acrescentar também um teste de validação: `limiteEncontrados` menor que 1,
maior que 100, fracionário ou não finito deve lançar `RangeError`. Reprovados
continuam entrando em `analisados`, mas nunca aproximam o contador do alvo.

- [x] **Step 2: Rodar e confirmar que falham**

```bash
npx.cmd vitest run tests/miner.test.ts
```

Esperado: FALHA. Os estados novos, os dois efeitos injetados, a validação e o
corte exato do alvo não existem.

- [x] **Step 3: Escrever a implementação**

Em `src/core/miner.ts`, ampliar o tipo de estado:

```ts
export type EstadoMineracao =
  | 'parado'
  | 'minerando'
  | 'pausado'
  | 'concluido'
  /** A Biblioteca acabou: sem lote novo e sem página crescendo. */
  | 'esgotado'
  /** Há cards na tela e nada no store: não estamos entendendo a página. */
  | 'incompreensivel'
  /** A trava de rolagens interrompeu a sessão antes do alvo. */
  | 'limite-seguranca'
```

Acrescentar a `OpcoesMineracao`:

```ts
  /** Altura do documento. Cresce quando a Meta entrega mais anúncios. */
  alturaDaPagina: () => number
  /**
   * Quantos cards a Meta renderizou. Comparado ao store, é o detector de
   * degradação da seção 9 do spec: cards na tela e store vazio significa que
   * o formato deles mudou e paramos de entender a resposta.
   */
  cardsNaTela: () => number
```

Acrescentar os contadores à classe:

```ts
  private voltasVazias = 0
  private alturaAnterior = 0
```

No construtor, rejeitar `limiteEncontrados` que não seja inteiro entre 1 e
100. Em `iniciar`, zerar as voltas vazias e capturar
`this.alturaAnterior = this.opcoes.alturaDaPagina()` antes de abrir o laço.
Assim a primeira volta compara a altura com uma linha de base real, e retomar
depois de uma pausa não herda uma suspeita incompleta.

E as verificações no fim de cada volta de `rodar`, logo depois de
`this.avaliarNovos()` e do `aoProgredir`:

```ts
      const altura = o.alturaDaPagina()
      const cresceu = altura > this.alturaAnterior
      this.alturaAnterior = altura

      if (!veioLote && !cresceu) this.voltasVazias += 1
      else this.voltasVazias = 0

      // Falha barulhenta, nunca silenciosa: o modo de falha que importa é a
      // extensão parecer funcionar e não coletar nada.
      const paginaIncompreensivel = o.cardsNaTela() > 0 && o.store.total() === 0

      if (this.voltasVazias >= 3 && paginaIncompreensivel) {
        this.estado = 'incompreensivel'
        o.aoProgredir?.(this.progresso())
        break
      }

      if (this.voltasVazias >= 2 && !paginaIncompreensivel) {
        this.estado = 'esgotado'
        o.aoProgredir?.(this.progresso())
        break
      }
```

Para isso, guarde o retorno da espera:

```ts
      const veioLote = await this.esperarLote()
```

**O sinal importa:** uma busca sem cards esgota em duas voltas. Cards visíveis
com store vazio não podem virar `esgotado` antes da terceira volta; são sinal
de que deixamos de compreender a página e terminam como `incompreensivel`.

Em `avaliarNovos`, parar de acrescentar aprovados assim que
`this.aprovados.length === o.limiteEncontrados`. No teste antigo que atingia
`maxRolagens`, trocar o estado esperado de `concluido` para
`limite-seguranca`; atingir `limiteEncontrados` continua sendo a única saída
`concluido`.

- [x] **Step 4: Rodar e confirmar que passam**

```bash
npx.cmd vitest run tests/miner.test.ts
```

Esperado: PASSA.

**Se os testes da Task 4 falharem por falta de `alturaDaPagina` ou
`cardsNaTela`, é esperado:** acrescente-os às opções daqueles testes, com
`() => 10000` e `() => 30`. Nos testes que não param sozinhos, faça a altura
crescer, senão eles esgotam antes do esperado.

- [x] **Step 5: Rodar a suíte e o typecheck**

```bash
npm.cmd test
npm.cmd run typecheck
```

- [x] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(miner): reconhecer o fim dos resultados e a página incompreensível

O que foi feito:
- Encerrar como `esgotado` após duas voltas sem lote e sem a página crescer
- Encerrar como `incompreensivel` quando há cards na tela e o store vazio
- Receber a altura da página e a contagem de cards como efeitos injetados
- Limitar o alvo a 100 aprovados e não ultrapassá-lo dentro do último lote
- Distinguir o teto de rolagens como `limite-seguranca`

Como foi feito:
- As duas condições saem da mesma volta do laço: se não veio lote e a
  altura não mudou, a volta foi vazia. Duas seguidas encerram
- A degradação aguarda três voltas com cards e store vazio; o esgotamento só
  vale quando esse sinal de página incompreensível não existe

Considerações:
- A seção 9 do spec de 2026-09-05 diz que o modo de falha que importa é a
  extensão parecer funcionar e não coletar nada. `incompreensivel` é a
  falha barulhenta que ela exige
```

---

## Task 6: Os números do ritmo na config remota

Piso, timeout e jitter precisam ser recalibráveis sem passar pela revisão da
Chrome Web Store. É o propósito declarado da config remota.

**Files:**
- Modify: `src/core/config.ts`
- Test: `tests/config.test.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores.
- Produces, de `src/core/config.ts`:
  `ConfigRemota` ganha `mining?: { pisoMs: number; timeoutMs: number; jitter: number }`;
  `CONFIG_EMBUTIDA.mining` traz os valores medidos.

- [x] **Step 1: Escrever os testes que falham**

Acrescentar a `tests/config.test.ts`:

```ts
describe('bloco mining', () => {
  const base = { version: 1, anchors: { libraryIdPattern: '(\\d+)' } }

  it('a config embutida traz os valores medidos', () => {
    expect(CONFIG_EMBUTIDA.mining).toEqual({
      pisoMs: 2500,
      timeoutMs: 4500,
      jitter: 0.4,
    })
  })

  it('aceita um bloco mining bem formado', () => {
    const c = validarConfig({ ...base, mining: { pisoMs: 3000, timeoutMs: 5000, jitter: 0.2 } })
    expect(c?.mining).toEqual({ pisoMs: 3000, timeoutMs: 5000, jitter: 0.2 })
  })

  it('config sem mining continua válida', () => {
    const c = validarConfig(base)
    expect(c).not.toBeNull()
    expect(c?.mining).toBeUndefined()
  })

  it('descarta o bloco quando um campo está fora da faixa', () => {
    // piso abaixo de 1 s atropelaria a Meta
    expect(validarConfig({ ...base, mining: { pisoMs: 500, timeoutMs: 5000, jitter: 0.2 } })?.mining).toBeUndefined()
    // timeout acima de 30 s trava a mineração
    expect(validarConfig({ ...base, mining: { pisoMs: 3000, timeoutMs: 40000, jitter: 0.2 } })?.mining).toBeUndefined()
    // jitter fora de 0..1 não faz sentido
    expect(validarConfig({ ...base, mining: { pisoMs: 3000, timeoutMs: 5000, jitter: 2 } })?.mining).toBeUndefined()
  })

  it('descarta o bloco quando um campo não é número', () => {
    expect(validarConfig({ ...base, mining: { pisoMs: '3000', timeoutMs: 5000, jitter: 0.2 } })?.mining).toBeUndefined()
  })

  it('descarta o bloco quando o timeout não passa do piso', () => {
    expect(validarConfig({ ...base, mining: { pisoMs: 5000, timeoutMs: 3000, jitter: 0.2 } })?.mining).toBeUndefined()
  })
})
```

- [x] **Step 2: Rodar e confirmar que falham**

```bash
npx.cmd vitest run tests/config.test.ts
```

Esperado: FALHA.

- [x] **Step 3: Escrever a implementação**

Em `src/core/config.ts`, acrescentar à interface, depois de `advertiserDocId`:

```ts
  /**
   * O ritmo da mineração.
   *
   * Vive aqui, e não no pacote, porque é o parâmetro que o mundo real obriga
   * a recalibrar: se a Meta apertar o cerco, a base instalada desacelera pela
   * edição deste arquivo, sem esperar revisão da loja.
   *
   * Opcional: uma config sem ele é válida, e a extensão usa os valores
   * medidos que viajam em `CONFIG_EMBUTIDA`.
   */
  mining?: {
    /** Espera mínima entre rolagens. */
    pisoMs: number
    /** Quanto esperar pelo lote antes de desistir. */
    timeoutMs: number
    /** Margem de variação da espera, de 0 a 1. */
    jitter: number
  }
```

Acrescentar as faixas aceitas, junto de `TAMANHO_MAXIMO_PADRAO`:

```ts
/**
 * As faixas do ritmo. Um piso curto demais atropela a Meta; um timeout longo
 * demais trava a mineração numa espera que nunca termina. Os limites são
 * folgados de propósito — servem para barrar valor absurdo, não para
 * substituir o julgamento de quem edita o arquivo.
 */
const MINING_FAIXAS = {
  pisoMs: { min: 1000, max: 30000 },
  timeoutMs: { min: 1000, max: 30000 },
  jitter: { min: 0, max: 1 },
} as const
```

Acrescentar aos valores embutidos, dentro de `CONFIG_EMBUTIDA`:

```ts
  // Medidos na Biblioteca real em 2026-09-10: a Meta responde a cada ~3,0 s,
  // com máximo observado de 4,5 s.
  mining: { pisoMs: 2500, timeoutMs: 4500, jitter: 0.4 },
```

E, em `validarConfig`, antes do `return config`:

```ts
  // O bloco é aceito inteiro ou descartado inteiro: meia configuração de
  // ritmo é pior que nenhuma, porque esconde qual metade valeu.
  const mining = raiz.mining
  if (typeof mining === 'object' && mining !== null) {
    const m = mining as Record<string, unknown>
    const dentro = (chave: keyof typeof MINING_FAIXAS): boolean => {
      const v = m[chave]
      const faixa = MINING_FAIXAS[chave]
      return typeof v === 'number' && Number.isFinite(v) && v >= faixa.min && v <= faixa.max
    }

    if (dentro('pisoMs') && dentro('timeoutMs') && dentro('jitter')) {
      const pisoMs = m.pisoMs as number
      const timeoutMs = m.timeoutMs as number
      // Timeout menor que o piso faria o laço desistir antes de começar.
      if (timeoutMs > pisoMs) {
        config.mining = { pisoMs, timeoutMs, jitter: m.jitter as number }
      }
    }
  }
```

- [x] **Step 4: Rodar e confirmar que passam**

```bash
npx.cmd vitest run tests/config.test.ts tests/config-remota.test.ts
```

Esperado: PASSA.

- [x] **Step 5: Rodar a suíte, o typecheck e o build**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
```

Esperado no build: `manifest gerado OK: world MAIN preservado, permissões mínimas`.

- [x] **Step 6: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(config): permitir recalibrar o ritmo da mineração pela config remota

O que foi feito:
- Acrescentar o bloco `mining` com piso, timeout e jitter
- Validar campo a campo, com faixas, e descartar o bloco inteiro se um
  campo não passar
- Levar os valores medidos na config embutida

Como foi feito:
- O bloco é aceito inteiro ou descartado inteiro: meia configuração de
  ritmo esconde qual metade valeu
- Timeout menor ou igual ao piso é recusado, porque faria o laço desistir
  da espera antes de ela começar

Considerações:
- É o parâmetro que o mundo real obriga a recalibrar. Se a Meta apertar o
  cerco, a base instalada desacelera pela edição de um JSON hospedado, sem
  esperar revisão da Chrome Web Store
- As faixas são folgadas de propósito: barram valor absurdo, não
  substituem o julgamento de quem edita o arquivo
```

---

## Task 7: Ligar o minerador ao content script

O motor deixa de ser órfão. Esta tarefa é a que fecha o vão registrado na
seção 1 do spec.

**Files:**
- Modify: `src/content/index.ts`
- Test: `tests/content-mineracao.test.ts` (criar)

**Interfaces:**
- Consumes: `Minerador` e `OpcoesMineracao` (Tasks 4 e 5); `relogioDeWorker` de `src/core/clock.ts`; `AdStore.colacaoDe` (Task 2); `ConfigRemota.mining` (Task 6).
- Produces, de `src/content/index.ts`:
  `criarMinerador(store: AdStore, criterios: Criterios, limiteEncontrados: number, ritmo: { pisoMs: number; timeoutMs: number; jitter: number }): Minerador` — exportada para poder ser testada sem navegador;
  `iniciarMineracao({ criterios, limiteEncontrados })` — contrato provisório
  para o console e contrato definitivo da futura gaveta, também exposto em
  `globalThis` no contexto isolado do content script.

- [x] **Step 1: Escrever o teste que falha**

Criar `tests/content-mineracao.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { criarMinerador } from '../src/content/index'
import { CRITERIOS_PADRAO } from '../src/core/criteria'
import { AdStore } from '../src/core/store'

describe('criarMinerador', () => {
  const RITMO = { pisoMs: 2500, timeoutMs: 4500, jitter: 0.4 }

  it('monta um minerador parado, sem rolar nada', () => {
    const m = criarMinerador(new AdStore(), CRITERIOS_PADRAO, 100, RITMO)
    expect(m.progresso()).toEqual({
      estado: 'parado',
      analisados: 0,
      encontrados: 0,
      rolagens: 0,
    })
  })

  it('rola a janela de verdade quando o efeito é disparado', () => {
    const scrollBy = vi.fn()
    vi.stubGlobal('scrollBy', scrollBy)
    vi.stubGlobal('innerHeight', 800)

    const m = criarMinerador(new AdStore(), CRITERIOS_PADRAO, 100, RITMO)
    // o efeito é privado ao minerador; disparamos pela porta pública
    m.parar()
    expect(m.progresso().estado).toBe('parado')

    vi.unstubAllGlobals()
  })
})
```

**Nota para quem executa:** o segundo teste é deliberadamente raso. Rolagem
real, aba oculta e chegada de lote são comportamento de navegador, e vão para
o teste manual da verificação final — não para o jsdom, onde passariam sem
provar nada. Na execução, ele foi substituído pela prova de que o limite chega
ao construtor, e o arquivo usa jsdom com Worker falso para isolar a fiação sem
iniciar relógio nem rolagem.

- [x] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/content-mineracao.test.ts
```

Esperado: FALHA com `criarMinerador is not a function`.

- [x] **Step 3: Escrever a implementação**

Em `src/content/index.ts`, acrescentar aos imports:

```ts
import type { Criterios } from '../core/criteria'
import { relogioDeWorker } from '../core/clock'
import { Minerador } from '../core/miner'
```

Acrescentar, depois da declaração de `SEM_CRITERIOS`:

```ts
/** O ritmo de fábrica. A config remota pode substituí-lo. */
let ritmo = { pisoMs: 2500, timeoutMs: 4500, jitter: 0.4 }

let minerador: Minerador | null = null

/**
 * Monta o minerador com os efeitos de navegador ligados.
 *
 * Exportada para poder ser testada sem navegador: os efeitos entram por
 * parâmetro do `Minerador`, e o que sobra aqui é a fiação.
 */
export function criarMinerador(
  store: AdStore,
  criterios: Criterios,
  limiteEncontrados: number,
  ritmoAtual: { pisoMs: number; timeoutMs: number; jitter: number },
): Minerador {
  return new Minerador({
    store,
    criterios,
    relogio: relogioDeWorker(),
    rolar: () => window.scrollBy(0, window.innerHeight * 0.9),
    pisoMs: ritmoAtual.pisoMs,
    timeoutMs: ritmoAtual.timeoutMs,
    jitter: ritmoAtual.jitter,
    maxRolagens: 400,
    limiteEncontrados,
    alturaDaPagina: () => document.documentElement.scrollHeight,
    cardsNaTela: () => acharCards(document.body).size,
    aoProgredir: (p) => {
      console.info(
        `[CopyHaunt] ${p.estado}: ${p.encontrados} de ${p.analisados} em ${p.rolagens} rolagens`,
      )
    },
  })
}

/**
 * Liga a mineração com os critérios pedidos.
 *
 * Chamar duas vezes não abre uma segunda: o `Minerador` devolve o mesmo laço.
 */
export function iniciarMineracao(pedido: {
  criterios: Criterios
  limiteEncontrados: number
}): Minerador {
  minerador ??= criarMinerador(
    store,
    pedido.criterios,
    pedido.limiteEncontrados,
    ritmo,
  )
  void minerador.iniciar()
  return minerador
}

// Porta provisória para o teste manual no contexto do content script.
Object.assign(globalThis, { iniciarMineracao })
```

Acrescentar o import de `acharCards`, que já existe em `./anchor`:

```ts
import { acharCards, definirPadraoAncora } from './anchor'
```

Em `aplicarConfig`, absorver o ritmo remoto:

```ts
    if (config.mining) ritmo = config.mining
```

E, no tratador de `raw-capture`, avisar o minerador quando um lote inédito
chegar — é o que fecha o laço reativo:

```ts
  if (event.data.kind === 'raw-capture') {
    const resultado = processarCaptura(event.data.payload as Captura, store)
    if (resultado.novos > 0) {
      console.info(`[CopyHaunt] indexados: ${resultado.total}`)
      // Sem este aviso o laço reativo espera até o timeout a cada volta, e
      // volta a ser um cronômetro — mais lento, agora.
      minerador?.avisarLote()
      repintar()
    }
  }
```

- [x] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/content-mineracao.test.ts
```

Esperado: PASSA.

- [x] **Step 5: Verificar que o motor deixou de ser órfão**

```bash
node -e "const{execSync}=require('child_process');for(const m of ['miner','clock']){const r=execSync(`grep -rl \"core/${m}'\" src || true`).toString().trim();console.log('core/'+m+' ->',r||'AINDA ÓRFÃO')}"
```

Esperado: os dois apontam para `src/content/index.ts`.

**Se algum ainda disser `AINDA ÓRFÃO`, PARE e reporte.** O objetivo do plano
inteiro é justamente esse.

- [x] **Step 6: Rodar a verificação completa**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

- [x] **Step 7: Escrever a mensagem de commit**

Criar `.commit-msg` na raiz com:

```
✨ feat(miner): ligar o motor de mineração ao content script

O que foi feito:
- Montar o minerador com o relógio de Web Worker e a rolagem real
- Avisar o laço quando um lote inédito entra no store
- Absorver o ritmo da config remota, com o medido como padrão de fábrica

Como foi feito:
- `criarMinerador` é exportada para poder ser testada sem navegador: os
  efeitos entram por parâmetro, e o que sobra na função é a fiação
- O aviso de lote sai do mesmo ponto que já contava os inéditos. Sem ele o
  laço espera o timeout a cada volta e vira um cronômetro mais lento

Considerações:
- `miner.ts` e `clock.ts` deixam de ser órfãos. Eles estavam escritos e
  testados desde 2026-09-06, e nenhum plano tinha assumido a integração —
  o vão está registrado na seção 1 do spec
- A interface fica de fora deste plano. Sem ela, a mineração é acionável
  por `iniciarMineracao` no console, o que basta para o teste manual
```

---

## Task 8: Evitar falso fim durante uma pausa da Meta

A verificação real sem CDP mostrou que duas rolagens sem lote e sem aumento de
altura não significam necessariamente fim. A busca marcou `esgotado` com 76
anúncios indexados; ao retomar seis segundos depois, voltou a crescer e chegou
a 152. Uma busca genuinamente vazia continua distinguível porque nunca colocou
nenhum anúncio no store.

**Files:**
- Modify: `src/core/miner.ts`
- Test: `tests/miner.test.ts`

- [x] **Step 1: Escrever o teste que falha**

Acrescentar às condições de parada um caso com store já preenchido, cards na
tela, altura estável e nenhum lote: duas voltas não encerram; a quinta encerra
como `esgotado`. O caso já existente de busca vazia continua encerrando em
duas voltas.

- [x] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/miner.test.ts
```

Esperado: FALHA porque o motor ainda encerra na segunda volta vazia mesmo com
store preenchido.

- [x] **Step 3: Implementar a margem distinta**

Usar duas voltas somente quando `store.total() === 0` e não houver cards. Se o
store já recebeu anúncios, exigir cinco voltas vazias consecutivas antes de
declarar `esgotado`. O detector `incompreensivel` continua em três voltas com
cards e store vazio.

Cinco voltas são uma margem conservadora: com o ritmo medido, dão à Meta cerca
de 35 segundos e algumas novas rolagens para sair de uma pausa transitória,
sem remover o teto independente de 400 rolagens.

- [x] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/miner.test.ts
```

- [x] **Step 5: Rodar a verificação completa**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

- [x] **Step 6: Commitar**

```text
🐛 fix(miner): evitar falso fim durante pausas da Meta

O que foi feito:
- Manter a busca ativa após duas voltas vazias quando o store já tem anúncios
- Exigir cinco voltas vazias para encerrar uma busca que vinha produzindo
- Preservar o encerramento rápido de uma busca realmente vazia

Considerações:
- O limiar foi corrigido a partir da verificação real sem CDP: a busca voltou
  a crescer logo depois de ter sido declarada esgotada
```

---

## Task 9: Tornar a confirmação entre os dois mundos determinística

Na verificação final, os logs mostraram o interceptador e o content script
ativos, mas a confirmação não chegou. O `interceptor-ready` era emitido uma
vez só e podia anteceder o registro do listener no mundo isolado.

**Files:**
- Create: `src/interceptor/handshake.ts`
- Modify: `src/interceptor/index.ts`
- Modify: `src/content/index.ts`
- Modify: `src/core/messages.ts`
- Test: `tests/handshake.test.ts`

- [x] **Step 1: Escrever o teste que falha**

Provar que a confirmação é enviada na instalação e enviada novamente quando
chega `content-ready` da própria janela; mensagens de outra origem ou outro
namespace não recebem resposta.

- [x] **Step 2: Rodar e confirmar que falha**

```bash
npx.cmd vitest run tests/handshake.test.ts
```

- [x] **Step 3: Implementar o handshake**

Acrescentar `content-ready` ao contrato. O content script posta essa mensagem
logo depois de instalar seu listener. O interceptador mantém o anúncio inicial
e responde a cada `content-ready`, cobrindo as duas ordens possíveis de carga.

- [x] **Step 4: Rodar e confirmar que passa**

```bash
npx.cmd vitest run tests/handshake.test.ts tests/messages.test.ts
```

- [x] **Step 5: Rodar a verificação completa**

```bash
npm.cmd test
npm.cmd run typecheck
npm.cmd run verify:build
npx.cmd playwright test
```

- [x] **Step 6: Commitar**

```text
🐛 fix(interceptor): confirmar o content script sem corrida
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

**Mais o teste manual**, na Biblioteca real, em perfil deslogado, com a
extensão carregada:

1. Abrir a Biblioteca com uma busca de nicho grande.
2. No console, selecionando o contexto do content script da CopyHaunt:
   `iniciarMineracao({ criterios: { colacaoMinima: 5, diasMin: 7, diasMax: null, presencaMinima: 10 }, limiteEncontrados: 100 })`.
3. Conferir no console que os progressos aparecem e que os números sobem.
4. **Trocar de aba por dois minutos** e voltar: os números continuaram subindo.
5. Deixar rodar até o fim dos resultados e conferir que o estado vira
   `esgotado` — não `concluido` por teto de rolagens.

**O que este plano NÃO entrega**, tudo indo para o plano irmão:

- os três enxertos na barra da Meta — o `?`, o calendário e o Minerar
  (spec, 7.1 e 7.2);
- **a recarga que força a ordenação** ao iniciar a mineração (spec, 7.6). Ela
  nasce com o botão Minerar, e sem ele não há onde disparar. Enquanto isso, o
  teste manual da verificação final aplica a ordenação pela URL, à mão;
- a tela de resultados (spec, 8);
- o pós-filtro de Instagram sobre os aprovados (spec, 6.4).
