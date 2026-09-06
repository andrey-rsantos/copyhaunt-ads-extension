import { normalizarBusca } from '../core/normalize'
import { classificar, type TipoCaptura } from '../core/router'
import type { AdStore } from '../core/store'
import type { Captura } from '../interceptor/xhr-patch'

/** A Meta prefixa respostas com isto para impedir sequestro de JSON. */
const PREFIXO_ANTI_SEQUESTRO = /^\s*for\s*\(\s*;\s*;\s*\)\s*;/

export interface ResultadoCaptura {
  tipo: TipoCaptura
  /** Quantos anúncios inéditos entraram no índice. */
  novos: number
  /** Tamanho do índice depois desta captura. */
  total: number
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
  try {
    const corpo = JSON.parse(
      captura.corpo.replace(PREFIXO_ANTI_SEQUESTRO, ''),
    ) as unknown
    store.adicionar(normalizarBusca(corpo))
  } catch {
    // Uma resposta estranha não pode derrubar a sessão inteira.
    return { tipo: 'ignorar', novos: 0, total: antes }
  }

  const total = store.total()
  return { tipo, novos: total - antes, total }
}
