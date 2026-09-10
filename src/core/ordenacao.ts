/**
 * A ordenação por impressões, e a recarga que ela obriga (spec, 7.6).
 *
 * Antes, quem escrevia estes parâmetros era o filtro de data, de carona. Sem
 * painel montando URL, iniciar a mineração passa a verificar a URL em vigor.
 *
 * **Chame com a URL do momento do clique.** A Meta reescreve a URL sozinha
 * ao carregar, acrescentando exatamente estes dois parâmetros — medido em
 * 2026-09-10. Decidir com a URL digitada dispararia recarga à toa.
 */

const MODO = 'total_impressions'
const DIRECAO = 'desc'

export function precisaOrdenar(url: string): boolean {
  const p = new URL(url).searchParams
  return (
    p.get('sort_data[mode]') !== MODO ||
    p.get('sort_data[direction]') !== DIRECAO
  )
}

export function urlOrdenada(url: string): string {
  const u = new URL(url)
  u.searchParams.set('sort_data[mode]', MODO)
  u.searchParams.set('sort_data[direction]', DIRECAO)
  return u.toString()
}
