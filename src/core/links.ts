import type { Ad } from './types'

export interface DestinoOpen {
  chave: string
  rotulo: string
  url: string | null
}

const AD_LIBRARY = 'https://www.facebook.com/ads/library/'

function buscaNaBiblioteca(params: Record<string, string>): string {
  const p = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: 'BR',
    ...params,
  })
  return `${AD_LIBRARY}?${p.toString()}`
}

function dominioDe(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Deriva o perfil de Instagram do destino do anúncio.
 *
 * Quando o anúncio manda para o Instagram, o destino é o próprio perfil do
 * anunciante. Medido: cobre 11% dos anúncios, sem nenhuma requisição.
 *
 * A Meta usa a forma de deep link `/_u/<handle>`, que precisa ser normalizada.
 */
function instagramDoDestino(destino: string | undefined): string | null {
  if (!destino) return null
  try {
    const u = new URL(destino)
    if (!/(^|\.)instagram\.com$/.test(u.hostname)) return null
    const handle = u.pathname.replace(/^\/_u\//, '/').replace(/^\/|\/$/g, '')
    return handle ? `https://www.instagram.com/${handle}` : null
  } catch {
    return null
  }
}

/**
 * Os seis destinos do menu OPEN, sempre na mesma ordem.
 *
 * Item sem dado vem com `url: null` e é exibido desabilitado, com o motivo no
 * tooltip. Ocultar faria o menu mudar de tamanho a cada card.
 */
export function montarDestinos(ad: Ad): DestinoOpen[] {
  const dominio = dominioDe(ad.destino)
  const instagram =
    ad.anunciante.instagram ?? instagramDoDestino(ad.destino)

  return [
    { chave: 'site', rotulo: 'Site do anúncio', url: ad.destino ?? null },
    {
      chave: 'perfil',
      rotulo: 'Perfil do anunciante',
      url: `https://www.facebook.com/${ad.anunciante.pageId}`,
    },
    { chave: 'instagram', rotulo: 'Instagram do anunciante', url: instagram },
    {
      chave: 'anunciosDoSite',
      rotulo: 'Buscar anúncios deste site',
      url: dominio
        ? buscaNaBiblioteca({ q: dominio, search_type: 'keyword_unordered' })
        : null,
    },
    {
      chave: 'anunciosDoAnunciante',
      rotulo: 'Buscar anúncios deste anunciante',
      url: buscaNaBiblioteca({
        view_all_page_id: ad.anunciante.pageId,
        search_type: 'page',
      }),
    },
    {
      chave: 'permalink',
      rotulo: 'URL do anúncio na Biblioteca',
      url: buscaNaBiblioteca({ id: ad.id }),
    },
  ]
}
