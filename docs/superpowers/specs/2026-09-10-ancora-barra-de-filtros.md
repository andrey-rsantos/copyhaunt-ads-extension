# Âncora na barra de filtros da Meta — levantamento

**Data:** 2026-09-10
**Resolve:** incerteza 4 do spec `2026-09-10-bloco-b-integracao-design.md`
**Ambiente:** Chrome 152, perfil descartável, **sem login no Facebook**, CDP
anexado. A porta de depuração é aceitável aqui — este levantamento lê estrutura
de DOM, não mede ritmo de paginação. Foi ela que invalidou a medição da aba
oculta, e é por isso que aquela medição correu à parte.
**Busca usada:** `q=emagrecimento` e depois `q=receita de bolo`, `country=BR`.

## Veredito

**Existe âncora estável. O plantio na barra se sustenta, e o fallback da seção
7.7 não precisa ser acionado.** Mas a barra tem duas formas, e o plano de
plantio tem de suportar as duas — ver "A ressalva que mais custa" abaixo.

## A âncora

`input[type="search"]` é **único na página**: 1 entre 253 `input`, todos os
outros `type="radio"`. Ele não tem `aria-label`, não tem `data-*`, e o seu `id`
(`js_2`) é gerado e não sobrevive. O tipo é o sinal, e é semântico.

A barra é o **ancestral mais próximo da busca que também contém um
`[role="combobox"]`**:

```js
function acharBarraDeFiltros(doc = document) {
  const busca = doc.querySelector('input[type="search"]')
  if (!busca) return null
  let el = busca.parentElement
  while (el && el !== doc.body) {
    if (el.querySelector('[role="combobox"]')) return el
    el = el.parentElement
  }
  return null
}
```

Sem profundidade fixa e sem classe CSS, no mesmo espírito de `acharCards` em
`src/content/anchor.ts`. A profundidade medida foi de 17 níveis, e **esse
número não deve entrar no código**: é justamente o que quebra quando a Meta
mexe no aninhamento.

## O que foi verificado

| Verificação | Resultado |
|---|---|
| Enxerto plantado na barra | entra, e a busca cede espaço sozinha (655 → 618 px). A barra é flex |
| Sobrevive à rolagem | **sim** — 12 rolagens, página de 8.791 a 21.211 px, enxerto vivo |
| Sobrevive a uma busca nova (SPA) | **sim** — a barra continua conectada e o enxerto permanece |
| A referência ao `input` sobrevive | **NÃO** — ver abaixo |
| Sobrevive a abrir um dropdown de filtro | sim |
| `id` dos controles | `js_2`, `js_f`, `js_14i` — gerados, inúteis como âncora |
| Classes CSS | 32 a 51 classes ofuscadas por controle. Inúteis, como esperado |
| Os comboboxes | `div[role="combobox"]`, **sem `<select>` nativo** na página |

## O achado que muda o código

**Numa busca nova, a Meta substitui o nó do `input`, mas mantém a barra.**
Medido: `busca.isConnected === false` e
`document.querySelector('input[type="search"]') !== buscaAntiga`, enquanto a
barra seguia conectada, com o `data-*` de teste e o enxerto intactos.

Guardar referência ao `input` entre buscas é um defeito. A referência à barra
serve, mas o replantio deve reexecutar `acharBarraDeFiltros()` a partir do
documento, não a partir de um nó guardado.

## Correção de 2026-09-10, na validação contra a Meta real

Este spec afirmava, na primeira redação, que **a barra tinha duas formas**
decididas em JS sobre `innerWidth` — uma linha acima de ~1280 px e duas linhas
por volta de 1036 px. **Isso estava errado, e a correção veio antes de o plano
ser executado.**

A segunda sessão mediu a barra em 762, 1002, 1036, 1038 e 1602 px, antes e
depois de uma busca nova, amostrando `flexDirection` a cada 200 ms por 2,6 s
após o carregamento. **A barra foi `row` em todas as amostras, sem exceção.**

A forma de coluna observada na primeira sessão era **estado transitório de
carregamento**: ela foi medida logo depois de um `Enter` na busca, cedo demais,
enquanto o layout ainda assentava. A leitura foi real; a causa atribuída a ela
não era.

O que sobra de verdadeiro: a barra é uma fila horizontal, e é isso que o
plantio precisa saber. O suporte à forma de coluna fica no código mesmo assim,
porque é barato e cobre o estado transitório sem custo — mas nenhuma decisão de
produto deve se apoiar numa quebra em duas linhas que não foi observada de
forma estável.

## A regra de inserção, e a armadilha que ela evita

A primeira regra escrita para achar onde inserir — *"o ancestral mais próximo
da busca cujo display seja flex e a direção row"* — **falha na Meta real**.
Medido: ela devolve um wrapper interno do próprio campo de busca, de 1246 px de
largura e **20 px de altura**, muito antes de chegar à barra. Plantar ali
poria os botões dentro da caixa de busca.

A regra que funciona, validada plantando um elemento de verdade e medindo onde
ele caiu:

```js
function acharLinhaDaBusca(doc) {
  const busca = doc.querySelector('input[type="search"]')
  const barra = acharBarraDeFiltros(doc)
  if (!busca || !barra) return null

  // Forma normal: a barra é a própria fila, e o append cai depois da busca,
  // que é o último controle dela.
  if (formaDaBarra(doc) === 'linha') return barra

  // Forma de coluna (transitória): descer ao filho direto que tem a busca,
  // para o enxerto acompanhá-la em vez de virar uma terceira linha.
  for (const filho of barra.children) {
    if (filho.contains(busca)) return filho
  }
  return barra
}
```

Verificado com um enxerto real de 36 px plantado por ela: em 1602 px e em
1038 px, ele caiu na mesma linha da busca (`top` 73, contra `top` 81 do campo),
à direita dela, sem alterar a altura da barra.

## Outros achados úteis ao plano irmão

- **O `Sort by` não está na barra.** Ele é o terceiro combobox da página e vive
  na área de resultados, junto do `>50,000 results`. A seção 7.6, que força a
  ordenação, não deve procurá-lo na barra.
- **A Meta reescreve a URL sozinha ao carregar**, acrescentando
  `sort_data[mode]=total_impressions&sort_data[direction]=desc` e
  `is_targeted_country=false` a uma URL que não os tinha. A seção 7.6 decide
  recarregar conforme a ordenação esteja ou não na URL: essa decisão tem de ser
  tomada **depois** dessa reescrita, ou a recarga dispara à toa.
- Os comboboxes têm nome acessível legível (`"Brazil"`, `"All ads"`, `"Sort"`)
  vindo do conteúdo, não de `aria-label`. Servem para diagnóstico, **não** como
  âncora: são texto de interface e mudam com o idioma.

## O que fica em aberto

- Se a forma de coluna existe de fato em alguma largura, ou se é apenas o
  estado transitório de carregamento. Nenhuma medição estável a produziu.
- Se a barra sobrevive à troca de país ou categoria pelo dropdown. O clique
  abre o menu, mas a lista de opções não aparece na árvore de acessibilidade,
  e a seleção não foi concluída. A busca nova, que é a mudança de filtro mais
  comum, foi verificada e passou.
- Como as duas formas se comportam com os três enxertos juntos, e não com um
  só de 40 px.
