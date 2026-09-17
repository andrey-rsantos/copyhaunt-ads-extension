import { ehEndpointDeAnuncios, type Captura } from '../interceptor/xhr-patch'
import { extrairObjetosJson } from './json-stream'

export type TipoCaptura =
  | 'busca'
  | 'colacao'
  | 'anunciante'
  | 'erro'
  | 'ignorar'

/** A Meta prefixa respostas com isto para impedir sequestro de JSON. */
const PREFIXO_ANTI_SEQUESTRO = /^\s*for\s*\(\s*;\s*;\s*\)\s*;/

/**
 * Decide o que uma resposta capturada é.
 *
 * A classificação olha o CONTEÚDO, não o doc_id. O spec registra que a Meta
 * troca os doc_id sem aviso; reconhecer pelo corpo é o que mantém a extensão
 * viva quando isso acontece.
 */
export function classificar(captura: Captura): TipoCaptura {
  if (!ehEndpointDeAnuncios(captura.url)) return 'ignorar'

  const corpo = captura.corpo.replace(PREFIXO_ANTI_SEQUESTRO, '')

  const objetos = extrairObjetosJson(captura.corpo)
  if (objetos.length === 0) return 'ignorar'

  // A ordem importa. Uma resposta de busca também contém `collated_results`
  // dentro de cada nó — são campos diferentes: `collated_results` é o
  // agrupamento dentro do resultado, `collation_results` é a resposta do
  // endpoint de colação. Testar a busca primeiro evita confundir os dois.
  if (corpo.includes('search_results_connection')) return 'busca'
  if (corpo.includes('collation_results')) return 'colacao'
  if (corpo.includes('"errors"')) return 'erro'
  if (corpo.includes('pageID') || corpo.includes('page_info')) {
    return 'anunciante'
  }

  return 'ignorar'
}
