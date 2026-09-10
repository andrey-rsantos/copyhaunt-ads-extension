/**
 * "Ativo há X" é uma faixa, não um modo.
 *
 * O mínimo de dias no ar corta pela data MÁXIMA de início, e o máximo de dias
 * corta pela MÍNIMA — mais dias no ar significa começar mais cedo. A inversão
 * parece erro de digitação e não é.
 *
 * Substitui os modos `provadas` e `subindo`, decididos em 2026-09-06 e
 * removidos em 2026-09-10: os nomes exigiam explicação, os campos não. E a
 * faixa permite o que os modos não permitiam — mínimo e máximo ao mesmo tempo.
 */

export interface FaixaDias {
  /** No ar há pelo menos tantos dias. */
  diasMin: number | null
  /** No ar há no máximo tantos dias. */
  diasMax: number | null
}

/** 3 e 5 dias, depois 2 semanas, 1 mês e 2 meses. */
export const PRESETS = [3, 5, 14, 30, 60]

const UM_DIA = 24 * 60 * 60 * 1000

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function corte(agora: Date, dias: number): string {
  return iso(new Date(agora.getTime() - dias * UM_DIA))
}

/**
 * Reescreve a URL da Biblioteca com a faixa de tempo ativo.
 *
 * Reescrever a URL é bem mais estável que simular cliques no menu de filtros
 * da Meta, que muda de layout com frequência.
 */
export function montarUrlFiltro(
  urlAtual: string,
  faixa: FaixaDias,
  agora: Date,
): string {
  const url = new URL(urlAtual)

  // Sempre limpar os dois antes, senão um filtro anterior sobrevive e o
  // resultado vira a interseção de dois cortes.
  url.searchParams.delete('start_date[min]')
  url.searchParams.delete('start_date[max]')

  if (faixa.diasMin !== null) {
    url.searchParams.set('start_date[max]', corte(agora, faixa.diasMin))
  }
  if (faixa.diasMax !== null) {
    url.searchParams.set('start_date[min]', corte(agora, faixa.diasMax))
  }

  // Os escalados vêm primeiro; sem isso, a mineração rola muito mais.
  url.searchParams.set('sort_data[mode]', 'total_impressions')
  url.searchParams.set('sort_data[direction]', 'desc')

  return url.toString()
}

/**
 * O rótulo do botão, que mostra o filtro em vigor (spec, 7.2).
 *
 * O travessão de `7–30` é `en dash`, não hífen: é intervalo, e a tipografia
 * de `CopyHaunt-IDV.md` pede o traço de intervalo.
 */
export function rotuloDaFaixa(faixa: FaixaDias): string {
  const { diasMin, diasMax } = faixa

  if (diasMin !== null && diasMax !== null) {
    return `${diasMin}–${diasMax} dias no ar`
  }
  if (diasMin !== null) return `${diasMin}+ dias no ar`
  if (diasMax !== null) return `até ${diasMax} dias no ar`
  return 'Tempo ativo'
}

/**
 * A faixa que a URL em vigor representa — o inverso de `montarUrlFiltro`.
 *
 * Sem isto o botão mente depois de qualquer recarga: a URL carrega o filtro,
 * e a gaveta abriria em branco. A inversão é a mesma da ida, e pelo mesmo
 * motivo: `start_date[max]` guarda o mínimo de dias no ar.
 */
export function lerFaixaDaUrl(url: string, agora: Date): FaixaDias {
  const p = new URL(url).searchParams
  return {
    diasMin: diasDesde(p.get('start_date[max]'), agora),
    diasMax: diasDesde(p.get('start_date[min]'), agora),
  }
}

function diasDesde(iso: string | null, agora: Date): number | null {
  if (!iso) return null

  const quando = new Date(`${iso}T00:00:00Z`).getTime()
  if (Number.isNaN(quando)) return null

  const dias = Math.floor((agora.getTime() - quando) / UM_DIA)
  return dias >= 1 ? dias : null
}
