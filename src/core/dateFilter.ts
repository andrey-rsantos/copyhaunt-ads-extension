/**
 * "Ativo há X" tem duas leituras opostas, e as duas são úteis:
 *
 * - `provadas`: ativo há PELO MENOS X dias — ofertas sobreviventes
 * - `subindo`:  ativo há NO MÁXIMO X dias — ofertas novas em ascensão
 */
export type ModoFiltro = 'provadas' | 'subindo'

/** 3 e 5 dias, depois 1, 2, 3 e 4 semanas. */
export const PRESETS = [3, 5, 7, 14, 21, 28]

const UM_DIA = 24 * 60 * 60 * 1000

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Reescreve a URL da Biblioteca com o filtro de data.
 *
 * Reescrever a URL é bem mais estável que simular cliques no menu de filtros
 * da Meta, que muda de layout com frequência.
 */
export function montarUrlFiltro(
  urlAtual: string,
  modo: ModoFiltro,
  dias: number,
  agora: Date,
): string {
  const url = new URL(urlAtual)
  const corte = iso(new Date(agora.getTime() - dias * UM_DIA))

  // Sempre limpar os dois antes, senão um filtro anterior sobrevive e o
  // resultado vira a interseção de dois cortes.
  url.searchParams.delete('start_date[min]')
  url.searchParams.delete('start_date[max]')

  if (modo === 'provadas') url.searchParams.set('start_date[max]', corte)
  else url.searchParams.set('start_date[min]', corte)

  // Os escalados vêm primeiro; sem isso, a mineração rola muito mais.
  url.searchParams.set('sort_data[mode]', 'total_impressions')
  url.searchParams.set('sort_data[direction]', 'desc')

  return url.toString()
}
