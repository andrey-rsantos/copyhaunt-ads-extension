/**
 * O primeiro lote de anúncios não chega por XHR.
 *
 * Medido na busca real: 25 cards visíveis na carga, zero respostas XHR com
 * anúncios, e um único `<script type="application/json" data-sjs>` de 179 kB
 * carregando `search_results_connection`. O interceptador só remenda
 * `XMLHttpRequest`, então esses anúncios nunca entravam no índice — e o
 * overlay, corretamente, não pinta card cujo anúncio ele não conhece.
 *
 * Aqui eles entram.
 */

/**
 * Varredura de string barata, feita antes de qualquer `JSON.parse`.
 *
 * A página serve muitos scripts JSON. Parsear todos custaria caro e sem
 * motivo: só um deles carrega busca.
 */
const MARCADOR = 'search_results_connection'

/**
 * Fundo suficiente para o caminho real, que hoje tem doze níveis, com folga
 * para a Meta reempacotar. Sem o limite, um objeto cíclico travaria a aba.
 */
const PROFUNDIDADE_MAXIMA = 20

/** Reconhece um nó com a forma de resposta de busca. */
function ehRespostaDeBusca(no: object): boolean {
  const data = (no as Record<string, unknown>).data
  if (typeof data !== 'object' || data === null) return false

  const main = (data as Record<string, unknown>).ad_library_main
  if (typeof main !== 'object' || main === null) return false

  return MARCADOR in main
}

/**
 * Desce a árvore procurando respostas de busca.
 *
 * Procura por FORMA, não por caminho. Hoje o payload mora em
 * `require[0][3][0].__bbox.require[0][3][1].__bbox.result`, mas esses índices
 * são do empacotador da Meta e mudam sem aviso. É o mesmo princípio que rege
 * `src/core/router.ts`, que classifica pelo conteúdo e não pelo `doc_id`.
 */
function coletar(no: unknown, profundidade: number, achados: unknown[]): void {
  if (profundidade > PROFUNDIDADE_MAXIMA) return
  if (typeof no !== 'object' || no === null) return

  if (ehRespostaDeBusca(no)) {
    // Colhido o payload, não se desce nele: os `edges` lá dentro são fundos
    // e numerosos, e nada de interesse se esconde abaixo.
    achados.push(no)
    return
  }

  for (const valor of Object.values(no)) {
    coletar(valor, profundidade + 1, achados)
  }
}

/**
 * Colhe do HTML as respostas de busca que a Meta embutiu.
 *
 * Devolve nós prontos para `normalizarBusca`: a forma é idêntica à da
 * resposta XHR, porque é literalmente a mesma resposta, servida junto com a
 * página em vez de pedida depois.
 */
export function extrairPayloadsSsr(raiz: ParentNode): unknown[] {
  const achados: unknown[] = []

  const scripts = raiz.querySelectorAll('script[type="application/json"]')
  for (const script of Array.from(scripts)) {
    const bruto = script.textContent ?? ''
    if (!bruto.includes(MARCADOR)) continue

    try {
      coletar(JSON.parse(bruto), 0, achados)
    } catch {
      // Um script malformado não pode derrubar a leitura dos outros.
    }
  }

  return achados
}
