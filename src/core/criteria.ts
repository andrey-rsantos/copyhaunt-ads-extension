import { diasAtivos } from './display'
import type { Ad } from './types'

/** Critério em `null` é critério desligado pelo usuário. */
export interface Criterios {
  colacaoMinima: number | null
  diasMin: number | null
  diasMax: number | null
  presencaMinima: number | null
}

/**
 * Padrões da seção 7 do spec.
 *
 * Colação ≥ 5 foi confirmada com dado real: em 94 anúncios de quatro nichos,
 * deixa passar 18%. Filtro apertado sem ser estéril.
 */
export const CRITERIOS_PADRAO: Criterios = {
  colacaoMinima: 5,
  diasMin: 7,
  diasMax: 90,
  presencaMinima: 10,
}

export interface Contexto {
  /** Quantos anúncios deste anunciante já apareceram na busca. */
  presenca: number
  agora: Date
}

export interface Veredito {
  passa: boolean
  /** Todos os motivos de reprovação, não só o primeiro. */
  motivos: string[]
}

/**
 * Aplica os critérios de escala a um anúncio.
 *
 * Acumula todos os motivos em vez de parar no primeiro: quem está calibrando
 * o filtro precisa saber tudo que reprovou, senão ajusta um critério por vez
 * às cegas.
 */
export function avaliar(ad: Ad, c: Criterios, ctx: Contexto): Veredito {
  const motivos: string[] = []
  const dias = diasAtivos(ad.iniciouEm, ctx.agora)

  if (c.colacaoMinima !== null && ad.colacao < c.colacaoMinima) {
    motivos.push(`colação ${ad.colacao} abaixo de ${c.colacaoMinima}`)
  }
  if (c.diasMin !== null && dias < c.diasMin) {
    motivos.push(`${dias} dias ativos, abaixo de ${c.diasMin}`)
  }
  if (c.diasMax !== null && dias > c.diasMax) {
    motivos.push(`${dias} dias ativos, acima de ${c.diasMax}`)
  }
  if (c.presencaMinima !== null && ctx.presenca < c.presencaMinima) {
    motivos.push(`presença ${ctx.presenca} abaixo de ${c.presencaMinima}`)
  }

  return { passa: motivos.length === 0, motivos }
}
