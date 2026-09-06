import type { Ad, Midia } from './types'

/** Lê uma propriedade sem estourar quando o caminho não existe. */
function prop(alvo: unknown, chave: string): unknown {
  if (typeof alvo !== 'object' || alvo === null) return undefined
  return (alvo as Record<string, unknown>)[chave]
}

function texto(valor: unknown): string | undefined {
  return typeof valor === 'string' && valor.length > 0 ? valor : undefined
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : []
}

/** Lê o vídeo de um objeto que use os nomes de campo da Meta. */
function video(fonte: unknown): Midia | null {
  const hd = texto(prop(fonte, 'video_hd_url'))
  const sd = texto(prop(fonte, 'video_sd_url'))
  const alta = hd ?? sd
  return alta ? { formato: 'video', alta, baixa: sd ?? alta } : null
}

/** Lê a imagem de um objeto que use os nomes de campo da Meta. */
function imagem(fonte: unknown): Midia | null {
  const original = texto(prop(fonte, 'original_image_url'))
  const reduzida = texto(prop(fonte, 'resized_image_url'))
  const alta = original ?? reduzida
  return alta ? { formato: 'imagem', alta, baixa: reduzida ?? alta } : null
}

function extrairMidias(snapshot: unknown): Midia[] {
  const midias: Midia[] = []

  for (const v of lista(prop(snapshot, 'videos'))) {
    const m = video(v)
    if (m) midias.push(m)
  }

  for (const i of lista(prop(snapshot, 'images'))) {
    const m = imagem(i)
    if (m) midias.push(m)
  }

  // Formatos DCO, CAROUSEL e DPA guardam o criativo em `cards`, não em
  // `videos`/`images` — e são a maioria: 16 dos 27 anúncios das fixtures.
  // Os cards usam exatamente os mesmos nomes de campo.
  for (const card of lista(prop(snapshot, 'cards'))) {
    // Vídeo ganha da imagem no mesmo card: quando os dois vêm, a imagem é a
    // miniatura do vídeo, e contá-la separado inflaria a lista de criativos.
    const m = video(card) ?? imagem(card)
    if (m) midias.push(m)
  }

  return midias
}

function normalizarAnuncio(bruto: unknown): Ad | null {
  const id = texto(prop(bruto, 'ad_archive_id'))
  const pageId = texto(prop(bruto, 'page_id'))
  const pageName = texto(prop(bruto, 'page_name'))
  if (!id || !pageId || !pageName) return null

  const inicio = prop(bruto, 'start_date')
  if (typeof inicio !== 'number') return null

  const snapshot = prop(bruto, 'snapshot')
  const colacaoBruta = prop(bruto, 'collation_count')

  return {
    id,
    // A Meta manda epoch em segundos; Date espera milissegundos.
    iniciouEm: new Date(inicio * 1000),
    // O campo pode simplesmente não vir: visto em 1 de 27 anúncios reais.
    colacao: typeof colacaoBruta === 'number' && colacaoBruta > 0
      ? colacaoBruta
      : 1,
    anunciante: {
      pageId,
      pageName,
      perfil: texto(prop(snapshot, 'page_profile_uri')),
      // O Instagram não vem na resposta de busca. Ver a pendência no plano.
      instagram: undefined,
    },
    destino: texto(prop(snapshot, 'link_url')),
    // body é objeto, não string: o texto mora em body.text.
    texto: texto(prop(prop(snapshot, 'body'), 'text')),
    titulo: texto(prop(snapshot, 'title')),
    descricao: texto(prop(snapshot, 'link_description')),
    cta: texto(prop(snapshot, 'cta_text')),
    midias: extrairMidias(snapshot),
    plataformas: lista(prop(bruto, 'publisher_platform')).filter(
      (p): p is string => typeof p === 'string',
    ),
    ativo: prop(bruto, 'is_active') === true,
  }
}

/**
 * Converte uma resposta de busca da Meta em anúncios do CopyHaunt.
 *
 * Esta é a única função do sistema que conhece o formato deles. Quando a Meta
 * mudar o schema, o conserto é aqui e em nenhum outro lugar.
 *
 * Cada anúncio é normalizado isoladamente: um card com formato inesperado é
 * descartado sem derrubar o lote, como manda a seção 9 do spec.
 */
export function normalizarBusca(corpo: unknown): Ad[] {
  const edges = lista(
    prop(
      prop(prop(prop(corpo, 'data'), 'ad_library_main'), 'search_results_connection'),
      'edges',
    ),
  )

  const ads: Ad[] = []
  for (const edge of edges) {
    for (const bruto of lista(prop(prop(edge, 'node'), 'collated_results'))) {
      try {
        const ad = normalizarAnuncio(bruto)
        if (ad) ads.push(ad)
      } catch {
        // Um anúncio estranho não pode derrubar os outros.
      }
    }
  }
  return ads
}
