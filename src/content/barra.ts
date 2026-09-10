/**
 * A barra de filtros da Meta, achada pelo que ela significa, não por onde
 * ela está.
 *
 * O levantamento de 2026-09-10 mediu: `input[type="search"]` é único na
 * página — 1 entre 253 `input`, todo o resto `type="radio"` —, os `id` são
 * gerados (`js_2`, `js_f`) e as classes são 32 a 51 strings ofuscadas por
 * controle. Sobra o tipo do campo, que é semântico.
 *
 * A profundidade medida foi de 17 níveis, e esse número não aparece aqui de
 * propósito: é exatamente o que quebra quando a Meta mexe no aninhamento.
 * Mesmo espírito de `acharCards` em `./anchor.ts`.
 */

/**
 * A forma da barra. Medida entre 762 e 1602 px em 2026-09-10, ela foi sempre
 * `linha`; `coluna` cobre o estado transitório de carregamento, que é barato
 * de suportar e apareceu numa medição feita cedo demais.
 */
export type FormaDaBarra = 'linha' | 'coluna'

function acharBusca(doc: Document): HTMLInputElement | null {
  return doc.querySelector('input[type="search"]')
}

/**
 * O ancestral mais próximo da busca que também contenha um combobox.
 *
 * Nunca lança e nunca devolve o `body`: sem âncora, o chamador degrada em
 * silêncio (spec, 7.7).
 */
export function acharBarraDeFiltros(doc: Document): HTMLElement | null {
  const busca = acharBusca(doc)
  if (!busca) return null

  let el = busca.parentElement
  while (el && el !== doc.body) {
    if (el.querySelector('[role="combobox"]')) return el
    el = el.parentElement
  }
  return null
}

export function formaDaBarra(doc: Document): FormaDaBarra | null {
  const barra = acharBarraDeFiltros(doc)
  if (!barra) return null
  const dir = doc.defaultView?.getComputedStyle(barra).flexDirection
  return dir === 'column' ? 'coluna' : 'linha'
}

/**
 * A fila onde os enxertos entram.
 *
 * **Não suba procurando o primeiro flex-row.** Essa regra foi escrita, testada
 * contra a Meta real em 2026-09-10, e falhou: ela devolve um wrapper interno
 * do próprio campo de busca, com 1246 px de largura e **20 px de altura**. Os
 * botões acabariam dentro da caixa de busca.
 *
 * A regra certa é mais simples. Na forma normal a barra já é a fila, e o
 * `append` cai depois da busca, que é o último controle dela. Só na forma de
 * coluna é preciso descer um nível, para o enxerto acompanhar a busca em vez
 * de virar uma terceira linha — decisão do dono do projeto em 2026-09-10.
 */
export function acharLinhaDaBusca(doc: Document): HTMLElement | null {
  const busca = acharBusca(doc)
  const barra = acharBarraDeFiltros(doc)
  if (!busca || !barra) return null

  if (formaDaBarra(doc) === 'linha') return barra

  for (const filho of Array.from(barra.children)) {
    if (filho.contains(busca)) return filho as HTMLElement
  }
  return barra
}
