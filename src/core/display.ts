const UM_DIA = 24 * 60 * 60 * 1000

/** Dias inteiros desde o início da veiculação. Nunca negativo. */
export function diasAtivos(inicio: Date, agora: Date): number {
  const dias = Math.floor((agora.getTime() - inicio.getTime()) / UM_DIA)
  return dias > 0 ? dias : 0
}

export type FaixaBadge = 'novo' | 'provado' | 'validado'

/**
 * A faixa do badge diz o que o número significa, conforme a seção 7 do spec:
 * anunciante não queima verba por meses em criativo ruim.
 */
export function faixaBadge(dias: number): FaixaBadge {
  if (dias < 7) return 'novo'
  if (dias <= 30) return 'provado'
  return 'validado'
}
