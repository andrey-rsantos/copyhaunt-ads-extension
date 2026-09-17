import { normalizarBusca } from '../core/normalize'
import { extrairObjetosJson } from '../core/json-stream'
import { classificar, type TipoCaptura } from '../core/router'
import type { AdStore } from '../core/store'
import type { Captura } from '../interceptor/xhr-patch'
import { extrairPayloadsSsr } from './ssr'

export interface ResultadoCaptura {
  tipo: TipoCaptura
  /** Quantos anúncios inéditos entraram no índice. */
  novos: number
  /** Tamanho do índice depois desta captura. */
  total: number
}

export interface ResultadoBusca {
  /** Quantos anúncios inéditos entraram no índice. */
  novos: number
  /** Tamanho do índice depois desta leitura. */
  total: number
}

/**
 * Indexa uma resposta de busca já parseada, venha ela de onde vier.
 *
 * Extraída de `processarCaptura` porque agora há duas origens: o XHR que o
 * interceptador remenda, e o script que a Meta embute no HTML. As duas
 * entregam exatamente a mesma forma, e duplicar a indexação criaria dois
 * lugares para consertar quando o schema deles mudar.
 */
export function indexarBusca(corpo: unknown, store: AdStore): ResultadoBusca {
  const antes = store.total()
  store.adicionar(normalizarBusca(corpo))
  const total = store.total()
  return { novos: total - antes, total }
}

/**
 * Lê do HTML o lote que a Meta serviu junto com a página.
 *
 * Idempotente pelo store, que descarta id repetido: reler o mesmo documento
 * não infla o índice.
 */
export function processarSsr(
  raiz: ParentNode,
  store: AdStore,
): ResultadoBusca {
  const antes = store.total()
  for (const payload of extrairPayloadsSsr(raiz)) {
    indexarBusca(payload, store)
  }
  const total = store.total()
  return { novos: total - antes, total }
}

/**
 * O tubo: uma captura crua entra, anúncios indexados saem.
 *
 * É função pura sobre o store para poder ser testada contra as fixtures
 * reais, sem navegador. O content script fica sendo só a cola entre a
 * mensagem que chega e esta função.
 */
export function processarCaptura(
  captura: Captura,
  store: AdStore,
): ResultadoCaptura {
  const tipo = classificar(captura)
  if (tipo !== 'busca') {
    return { tipo, novos: 0, total: store.total() }
  }

  const antes = store.total()
  for (const payload of extrairObjetosJson(captura.corpo)) {
    indexarBusca(payload, store)
  }
  const total = store.total()
  return { tipo, novos: total - antes, total }
}
